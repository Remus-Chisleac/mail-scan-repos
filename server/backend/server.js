const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { initDB, getPool, DB_DRIVER } = require('./db');

const app = express();
app.use(express.json());
app.use(cors())

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'economistiiDigitaliDoiPunctZero';
const SALT_ROUNDS = 10;

function pool() {
    return getPool();
}

// ─── Swagger ──────────────────────────────────────────────────────────────────

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Legacy API-key authentication (kept for backward compatibility with /api/logs
 * endpoints that external tools may already be using).
 */
const authenticateApiKey = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: 'Unauthorized: Missing API Key' });

    try {
        const [rows] = await pool().query(
            'SELECT id FROM api_keys WHERE api_key = ? AND is_active = TRUE',
            [apiKey]
        );
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Unauthorized: Invalid or inactive API Key' });
        }
        next();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error during authentication' });
    }
};

/**
 * JWT-based authentication for user-facing endpoints.
 * Attaches the decoded payload to req.user.
 */
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) return res.status(401).json({ error: 'Unauthorized: Missing token' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
        req.user = decoded; // { id, username, role, organization_id, org_status }
        next();
    });
};

/**
 * Require the authenticated user to be an org admin.
 */
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function issueToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            role: user.role,
            organization_id: user.organization_id,
            org_status: user.org_status,
        },
        JWT_SECRET,
        { expiresIn: '8h' }
    );
}

// ─── Auth / User Endpoints ────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Body: { username, password, organization_id? }
 *
 * - If organization_id is provided the user starts with org_status = 'pending'
 *   and waits for admin approval.
 * - Without organization_id the user is created with org_status = 'none'.
 */
app.post('/auth/register', async (req, res) => {
    const { username, password, organization_id } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'username and password are required' });
    }

    try {
        // Validate org exists when provided
        if (organization_id) {
            const [orgs] = await pool().query('SELECT id FROM organizations WHERE id = ?', [organization_id]);
            if (orgs.length === 0) {
                return res.status(400).json({ error: 'Organization not found' });
            }
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const orgStatus = organization_id ? 'pending' : 'none';

        const [result] = await pool().query(
            'INSERT INTO users (username, password_hash, role, organization_id, org_status) VALUES (?, ?, ?, ?, ?)',
            [username, passwordHash, 'user', organization_id || null, orgStatus]
        );

        res.status(201).json({
            success: true,
            user_id: result.insertId,
            message: organization_id
                ? 'Registration successful. Your request to join the organization is pending admin approval.'
                : 'Registration successful.',
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Username already taken' });
        }
        console.error(error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

/**
 * POST /auth/login
 * Body: { username, password }
 * Returns a JWT.
 */
app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'username and password are required' });
    }

    try {
        const [rows] = await pool().query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = issueToken(user);
        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ─── Organization Endpoints ───────────────────────────────────────────────────

/**
 * POST /api/organizations
 * Body: { name }
 *
 * Creates an organization and a default admin user: <orgName>Admin / admin
 */
app.post('/api/organizations', async (req, res) => {
    const { name } = req.body;

    if (!name) return res.status(400).json({ error: 'Organization name is required' });

    const conn = await pool().getConnection();
    try {
        await conn.beginTransaction();

        // Create organization
        const [orgResult] = await conn.query(
            'INSERT INTO organizations (name) VALUES (?)',
            [name]
        );
        const orgId = orgResult.insertId;

        // Create default admin user: <orgName>Admin  password: admin
        const adminUsername = `${name}Admin`;
        const passwordHash = await bcrypt.hash('admin', SALT_ROUNDS);

        const [userResult] = await conn.query(
            'INSERT INTO users (username, password_hash, role, organization_id, org_status) VALUES (?, ?, ?, ?, ?)',
            [adminUsername, passwordHash, 'admin', orgId, 'approved']
        );

        await conn.commit();

        res.status(201).json({
            success: true,
            organization: { id: orgId, name },
            default_admin: {
                id: userResult.insertId,
                username: adminUsername,
                note: 'Default password is "admin" — change it immediately.',
            },
        });
    } catch (error) {
        await conn.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Organization name already exists' });
        }
        console.error(error);
        res.status(500).json({ error: 'Failed to create organization' });
    } finally {
        conn.release();
    }
});

/**
 * GET /api/organizations
 * Public list of organizations (so users can find an org id to apply to).
 */
app.get('/api/organizations', async (req, res) => {
    try {
        const [rows] = await pool().query('SELECT id, name, created_at FROM organizations ORDER BY name');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to retrieve organizations' });
    }
});

// ─── Admin: Approve / Reject Pending Users ────────────────────────────────────

/**
 * GET /api/organizations/pending-users
 * Admin only. Lists users with org_status = 'pending' in the admin's organization.
 */
app.get('/api/organizations/pending-users', authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool().query(
            `SELECT id, username, created_at
             FROM users
             WHERE organization_id = ? AND org_status = 'pending'`,
            [req.user.organization_id]
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to retrieve pending users' });
    }
});

/**
 * POST /api/organizations/approve-user/:userId
 * Admin only. Approves a pending user into the admin's organization.
 */
app.post('/api/organizations/approve-user/:userId', authenticateJWT, requireAdmin, async (req, res) => {
    const { userId } = req.params;
    try {
        const [result] = await pool().query(
            `UPDATE users
             SET org_status = 'approved'
             WHERE id = ? AND organization_id = ? AND org_status = 'pending'`,
            [userId, req.user.organization_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Pending user not found in your organization' });
        }

        res.json({ success: true, message: 'User approved.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to approve user' });
    }
});

/**
 * POST /api/organizations/reject-user/:userId
 * Admin only. Rejects (removes org association from) a pending user.
 */
app.post('/api/organizations/reject-user/:userId', authenticateJWT, requireAdmin, async (req, res) => {
    const { userId } = req.params;
    try {
        const [result] = await pool().query(
            `UPDATE users
             SET org_status = 'none', organization_id = NULL
             WHERE id = ? AND organization_id = ? AND org_status = 'pending'`,
            [userId, req.user.organization_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Pending user not found in your organization' });
        }

        res.json({ success: true, message: 'User rejected.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to reject user' });
    }
});

// ─── Log Endpoints (JWT-authenticated) ───────────────────────────────────────

/**
 * POST /api/logs
 * Authenticated users submit a log. The log is automatically linked to the
 * user (and their organization, if approved).
 */
app.post('/api/logs', authenticateJWT, async (req, res) => {
    const { analysis_mode, ai_provider, phishing_detected, raw_data } = req.body;

    const orgId =
        req.user.org_status === 'approved' ? req.user.organization_id : null;

    try {
        const [result] = await pool().query(
            'INSERT INTO logs (user_id, organization_id, analysis_mode, ai_provider, phishing_detected, raw_data) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, orgId, analysis_mode, ai_provider, phishing_detected, JSON.stringify(raw_data)]
        );
        res.status(201).json({ success: true, log_id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to store log' });
    }
});

/**
 * GET /api/logs
 * - Admin: returns all logs that belong to their organization.
 * - Regular user: returns only their own logs.
 */
app.get('/api/logs', authenticateJWT, async (req, res) => {
    try {
        let rows;

        if (req.user.role === 'admin') {
            // Admin sees every log in their organization
            [rows] = await pool().query(
                `SELECT l.*, u.username
                 FROM logs l
                 JOIN users u ON l.user_id = u.id
                 WHERE l.organization_id = ?
                 ORDER BY l.timestamp DESC`,
                [req.user.organization_id]
            );
        } else {
            // Regular user sees only their own logs
            [rows] = await pool().query(
                'SELECT * FROM logs WHERE user_id = ? ORDER BY timestamp DESC',
                [req.user.id]
            );
        }

        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to retrieve logs' });
    }
});

// ─── Legacy Endpoints (API-key authenticated) ────────────────────────────────
// Kept so existing integrations continue to work.

app.post('/api/legacy/logs', authenticateApiKey, async (req, res) => {
    const { analysis_mode, ai_provider, phishing_detected, raw_data } = req.body;
    try {
        // Legacy logs are stored without a user; use a sentinel approach:
        // they require a valid api_key but are not scoped to a user.
        // NOTE: user_id is NOT NULL in the new schema, so legacy callers must
        // either be migrated or the column can be made nullable — adjust as needed.
        res.status(410).json({
            error: 'This endpoint is deprecated. Please migrate to /auth/register + /api/logs.',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to store log' });
    }
});

// ─── Start ────────────────────────────────────────────────────────────────────

initDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT} (${DB_DRIVER})`);
            console.log(`Swagger Docs available at http://localhost:${PORT}/api-docs`);
        });
    })
    .catch((error) => {
        console.error('Database initialization failed:', error.message);
        process.exit(1);
    });