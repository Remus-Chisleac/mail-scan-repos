# Master Workspace — Project Overview

This document describes the projects in `/home/remus/master` for AI agents and developers working in this workspace.

## Layout

```
master/
├── mail-scan/          # Chrome extension — email phishing scanner (client-side)
├── server/
│   ├── frontend/       # SENTRY_LOG web dashboard (React)
│   └── backend/        # SENTRY_LOG API server (Express + MySQL)
└── PROJECTS.md         # This file
```

The **mail-scan** extension and the **server** stack are related: the extension scans Gmail for phishing; the server collects and displays threat logs per organization.

---

## 1. `mail-scan/` — Chrome Extension

**Purpose:** University research project. A Manifest V3 browser extension that scans open Gmail messages for phishing indicators and optionally sends anonymized results to a remote logging API.

**Stack:** React 19, TypeScript, Vite, `@crxjs/vite-plugin`

**Run:**
```bash
cd mail-scan
npm install
npm run dev    # watch/build for extension loading
npm run build  # production build → dist/
```

Load unpacked extension from `mail-scan/dist/` in Chrome.

### Architecture

| Area | Path | Role |
|------|------|------|
| Popup UI | `src/popup/` | Settings, scan trigger, results display, master-password vault |
| Content script | `src/content/` | Runs on Gmail; extracts email data via `extractors/gmail.ts` |
| Service worker | `src/background/` | Message routing, analysis engines, AI calls, telemetry |
| Shared | `src/shared/` | Types, storage, crypto, messaging constants |

### Key flows

1. **Content script** reads the open Gmail thread (subject, sender, body, links).
2. **Background worker** runs analysis:
   - **Basic mode** (`analysis/basic-engine.ts`, `url-checker.ts`) — heuristic scoring, no external AI.
   - **Advanced mode** — calls an AI provider (`ai/gemini.ts`, `chatgpt.ts`, `claude.ts`, or `custom.ts`).
3. **Popup** shows results and lets the user configure mode, AI provider, and logging.
4. **Logging** (`logging/telemetry.ts`) POSTs a `LogPayload` to a configurable endpoint when enabled.

### Settings & security

- User settings stored in `chrome.storage.local` (`shared/storage.ts`).
- Optional master password encrypts sensitive data (`shared/crypto.ts`).
- AI providers need API keys configured in the popup.

### Types (`src/shared/types.ts`)

- `AnalysisMode`: `"basic" | "advanced"`
- `AIProvider`: `"gemini" | "chatgpt" | "claude" | "custom"`
- `LogPayload`: timestamp, email meta, basic/AI analysis, extension version

### Integration with server

The extension sends scan results to the SENTRY_LOG backend when logging is enabled in the popup:

1. Set **Server URL** (default `http://localhost:8080`)
2. Enter SENTRY_LOG **username** and **password** (from `/auth/register` or org admin)
3. Click **Connect to Server** — stores a JWT in the encrypted vault
4. Each scan POSTs to `/api/logs` with `Authorization: Bearer <token>`

Payload shape matches the backend: `analysis_mode`, `ai_provider`, `phishing_detected`, and full scan details in `raw_data`.

---

## 2. `server/` — SENTRY_LOG Platform

**Purpose:** Web dashboard + REST API for organizations to register users, approve memberships, and store/view phishing scan logs from clients (e.g. mail-scan).

**Branding in UI:** SENTRY_LOG — "Phishing Detection Platform"

### 2a. `server/backend/` — API Server

**File:** `server.js`  
**Stack:** Express, MySQL (`mysql2`), JWT, bcrypt, Swagger UI, CORS  
**Default port:** `8080`

**Run (requires Node deps and MySQL):**
```bash
cd server/backend
npm init -y   # if no package.json yet
npm install express mysql2 swagger-ui-express bcrypt jsonwebtoken cors
node server.js
```

**Swagger:** `http://localhost:8080/api-docs` (expects `swagger.json` alongside `server.js` — not yet present in repo)

#### Database tables (auto-created on startup)

| Table | Purpose |
|-------|---------|
| `organizations` | Multi-tenant orgs |
| `users` | Accounts with `role` (admin/user) and `org_status` (none/pending/approved) |
| `logs` | Scan records linked to user + org |
| `api_keys` | Legacy API-key auth (deprecated path) |

#### Main endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Public | Create user; optional `organization_id` → pending approval |
| POST | `/auth/login` | Public | Returns JWT (8h) |
| GET/POST | `/api/organizations` | Public | List / create org (creates default `<name>Admin` / `admin`) |
| GET | `/api/organizations/pending-users` | JWT admin | Pending join requests |
| POST | `/api/organizations/approve-user/:id` | JWT admin | Approve user |
| POST | `/api/organizations/reject-user/:id` | JWT admin | Reject user |
| GET/POST | `/api/logs` | JWT | List/submit scan logs (admin sees org feed; user sees own) |

**Config:** Uses env vars `PORT`, `JWT_SECRET`, `DB_*` with hardcoded fallbacks in source — prefer env vars in production.

### 2b. `server/frontend/` — Dashboard UI

**File:** `App.jsx`  
**Stack:** Single-file React component (inline styles, no build step assumed)  
**API base:** `http://localhost:8080`

**Purpose:** Operator/admin dashboard for SENTRY_LOG.

**Screens:**
- **Auth** — login, register (with optional org join), create organization
- **Feed** — view and submit threat logs (JSON raw_data)
- **Requests** — admin-only pending user approvals
- **Orgs** — list and create organizations

**Session:** JWT stored in `sessionStorage` as `sl_tok`.

**Run:** Mount in any React app (e.g. Vite/CRA) or serve as standalone; no `package.json` in `server/frontend/` yet.

---

## How the pieces connect

```
┌─────────────────┐     scan Gmail      ┌──────────────────┐
│  mail-scan      │ ──────────────────► │  User's browser  │
│  (extension)    │                     └──────────────────┘
└────────┬────────┘
         │ POST /api/logs (when logging enabled)
         ▼
┌─────────────────┐     JWT REST API    ┌──────────────────┐
│  server/backend │ ◄────────────────── │  server/frontend │
│  Express+MySQL  │                     │  SENTRY_LOG UI   │
└─────────────────┘                     └──────────────────┘
```

---

## Gaps / TODO for agents

1. **`server/backend/swagger.json`** — referenced but missing; add or remove Swagger setup.
2. **`server/backend/package.json`** — not committed; create for reproducible installs.
3. **`server/frontend/`** — single JSX file; may need a small Vite/React scaffold to run.
4. **Auth alignment** — extension uses JWT login; legacy API-key path on server is deprecated.
5. **Secrets** — move DB credentials and JWT secret to environment variables.

---

## Quick reference

| Project | Type | Primary language | Entry point |
|---------|------|------------------|-------------|
| `mail-scan` | Chrome extension | TypeScript/React | `src/background/index.ts`, `src/popup/main.tsx` |
| `server/backend` | REST API | JavaScript/Node | `server.js` |
| `server/frontend` | Web dashboard | JavaScript/React | `App.jsx` |
