const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const DB_DRIVER = process.env.DB_DRIVER || "sqlite";
const SQLITE_PATH =
  process.env.SQLITE_PATH || path.join(__dirname, "sentrylog.db");

let sqliteDb = null;
let mysqlPool = null;
let sqliteInTransaction = false;

function persistSqlite() {
  if (!sqliteDb) return;
  fs.writeFileSync(SQLITE_PATH, Buffer.from(sqliteDb.export()));
}

function mapSqliteError(error) {
  if (String(error?.message || error).includes("UNIQUE constraint failed")) {
    const mapped = new Error(error.message);
    mapped.code = "ER_DUP_ENTRY";
    return mapped;
  }
  return error;
}

function runSqlite(sql, params = []) {
  const trimmed = sql.trim().toUpperCase();
  const isSelect = trimmed.startsWith("SELECT");

  if (isSelect) {
    const stmt = sqliteDb.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return [rows];
  }

  sqliteDb.run(sql, params);
  const insertId = sqliteDb.exec("SELECT last_insert_rowid() AS id")[0]?.values[0][0] ?? 0;
  const affectedRows = sqliteDb.getRowsModified();

  if (!sqliteInTransaction &&
      !sql.trim().toUpperCase().startsWith("BEGIN") &&
      !sql.trim().toUpperCase().startsWith("COMMIT") &&
      !sql.trim().toUpperCase().startsWith("ROLLBACK")) {
    persistSqlite();
  }

  const header = {
    insertId,
    affectedRows,
  };
  return [header];
}

function createSqlitePool() {
  const conn = {
    query: async (sql, params = []) => {
      try {
        return runSqlite(sql, params);
      } catch (error) {
        throw mapSqliteError(error);
      }
    },
    beginTransaction: async () => {
      sqliteDb.run("BEGIN IMMEDIATE");
      sqliteInTransaction = true;
    },
    commit: async () => {
      if (!sqliteInTransaction) return;
      sqliteDb.run("COMMIT");
      sqliteInTransaction = false;
      persistSqlite();
    },
    rollback: async () => {
      if (!sqliteInTransaction) return;
      try {
        sqliteDb.run("ROLLBACK");
      } catch {
        // SQLite aborts the transaction after a failed statement.
      }
      sqliteInTransaction = false;
    },
    release: () => {},
  };

  return {
    query: conn.query,
    getConnection: async () => conn,
  };
}

async function initSqlite() {
  const SQL = await initSqlJs();
  if (fs.existsSync(SQLITE_PATH)) {
    sqliteDb = new SQL.Database(fs.readFileSync(SQLITE_PATH));
  } else {
    sqliteDb = new SQL.Database();
  }

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key TEXT UNIQUE NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      organization_id INTEGER DEFAULT NULL,
      org_status TEXT DEFAULT 'none',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
    )
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      organization_id INTEGER DEFAULT NULL,
      analysis_mode TEXT,
      ai_provider TEXT,
      phishing_detected INTEGER,
      raw_data TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
    )
  `);

  persistSqlite();
  mysqlPool = createSqlitePool();
  console.log(`SQLite database ready at ${SQLITE_PATH}`);
}

async function initMysql() {
  const mysql = require("mysql2/promise");
  mysqlPool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "economistii",
    password: process.env.DB_PASSWORD || "C@talin255",
    database: process.env.DB_NAME || "economistii",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INT AUTO_INCREMENT PRIMARY KEY,
      api_key VARCHAR(255) UNIQUE NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'user') DEFAULT 'user',
      organization_id INT DEFAULT NULL,
      org_status ENUM('none', 'pending', 'approved') DEFAULT 'none',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
    )
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      organization_id INT DEFAULT NULL,
      analysis_mode VARCHAR(50),
      ai_provider VARCHAR(50),
      phishing_detected BOOLEAN,
      raw_data JSON,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
    )
  `);

  console.log("MySQL database initialized successfully.");
}

async function initDB() {
  if (DB_DRIVER === "mysql") {
    await initMysql();
    return;
  }
  await initSqlite();
}

function getPool() {
  if (!mysqlPool) {
    throw new Error("Database not initialized yet");
  }
  return mysqlPool;
}

module.exports = { initDB, getPool, DB_DRIVER };
