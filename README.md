# mail-scan-repos

Phishing detection platform for university research. Includes a Chrome extension that scans Gmail and Outlook emails, plus **SENTRY_LOG** — a backend API and web dashboard for storing and analyzing scan results.

## Project structure

```
mail-scan-repos/
├── mail-scan/          Chrome extension (React + TypeScript + Vite)
├── server/
│   ├── backend/        SENTRY_LOG API (Express + SQLite/MySQL)
│   └── frontend/       SENTRY_LOG dashboard (React + Vite + Recharts)
└── PROJECTS.md         Detailed architecture notes
```

## Prerequisites

- **Node.js** 20+ (22+ recommended for the extension build)
- **npm**
- **Google Chrome** (for loading the extension)
- Optional: **MySQL** if you don't want to use the default SQLite database

## Quick start

Run these in three separate terminals.

### 1. Backend API

```bash
cd server/backend
npm install
npm start
```

Server runs at **http://localhost:8080**

- API docs: http://localhost:8080/api-docs
- Uses **SQLite** by default (`server/backend/sentrylog.db` is created automatically)

### 2. Web dashboard

```bash
cd server/frontend
npm install
npm run dev
```

Dashboard runs at **http://localhost:5173** (or the next free port Vite picks, e.g. 5174)

### 3. Chrome extension

```bash
cd mail-scan
npm install
npm run dev
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `mail-scan/dist/` folder

> After code changes, reload the extension on `chrome://extensions` and refresh your Gmail/Outlook tab.

---

## First-time account setup

### Option A — Create an organization (dashboard)

1. Open http://localhost:5173
2. Go to the **new_org** tab
3. Enter an organization name (e.g. `AcmeCorp`)
4. A default admin is created:
   - **Username:** `AcmeCorpAdmin`
   - **Password:** `admin`

### Option B — Register via API

```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"myuser","password":"mypassword"}'
```

---

## Connect the extension to SENTRY_LOG

1. Open the Mail Scan popup in Chrome
2. Set a **master password** (encrypts stored API keys locally)
3. Enable **SENTRY_LOG Server**
4. Configure:
   - **Server URL:** `http://localhost:8080`
   - **Username / Password:** your SENTRY_LOG account
5. Click **Connect to Server**
6. Open an email in **Gmail** or **Outlook**, then click **Scan Current Email**

Scan results are sent to `POST /api/logs` when logging is enabled.

---

## Supported mail clients

| Client | URL |
|--------|-----|
| Gmail | https://mail.google.com |
| Outlook | https://outlook.live.com, outlook.office.com, outlook.office365.com |

---

## Environment variables (backend)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | API port |
| `JWT_SECRET` | built-in dev value | JWT signing secret — **change in production** |
| `DB_DRIVER` | `sqlite` | `sqlite` or `mysql` |
| `SQLITE_PATH` | `./sentrylog.db` | SQLite file path |
| `DB_HOST` | `localhost` | MySQL host (when `DB_DRIVER=mysql`) |
| `DB_USER` | — | MySQL user |
| `DB_PASSWORD` | — | MySQL password |
| `DB_NAME` | — | MySQL database name |

### MySQL example

```bash
DB_DRIVER=mysql \
DB_HOST=localhost \
DB_USER=your_user \
DB_PASSWORD=your_password \
DB_NAME=your_db \
JWT_SECRET=your-secret \
npm start
```

---

## Production build

```bash
# Extension
cd mail-scan && npm run build
# Output: mail-scan/dist/

# Dashboard
cd server/frontend && npm run build
# Output: server/frontend/dist/
```

---

## Dashboard pages

| Page | Description |
|------|-------------|
| **Feed** | Threat log with stats, filters, and search |
| **Analytics** | Charts — threats, providers, scan methods, timeline |
| **Requests** | Admin: approve pending org members |
| **Orgs** | Create and list organizations |

---

## Troubleshooting

**Extension can't scan the current email**
- Make sure a specific email is open in the reading pane (not just the inbox list)
- Refresh the Gmail/Outlook tab after reloading the extension

**"Could not establish connection"**
- Refresh the mail tab — the content script injects on page load

**Backend won't start**
- Check port 8080 isn't already in use: `ss -tlnp | grep 8080`

**Login fails on dashboard**
- Confirm the backend is running
- Create an org or register a user first (see above)

**Extension logging fails**
- Verify SENTRY_LOG credentials in the popup
- Confirm backend is reachable at the configured URL

---

## License

University research project. See repository for details.
