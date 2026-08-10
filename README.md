# Tecsidel NMS

Network Management System for monitoring device availability via ICMP ping, managing alerts, inventory, logs, scheduled jobs, and reports.

## Features

- **ICMP ping monitoring** with automatic alerts and availability timeline
- **Device inventory** — add, edit, search, and manually poll devices
- **Alerts** — acknowledge, resolve, real-time WebSocket notifications
- **Logs** — syslog event timeline and audit trail
- **Scheduler** — automated ping checks, config backup, reports (backup/report jobs log simulated runs)
- **Reports** — CSV export for devices, alerts, and uptime
- **Settings** — poll interval, thresholds, user management, role permissions

## Requirements

- Node.js 20+
- MySQL 8+
- ICMP `ping` available on the host OS

## Local Development

### 1. Database

Create a MySQL database (or use an existing one). **Do not run `db:seed` on a database that already has production data** unless you intend to wipe it (`FORCE_SEED=true`).

```bash
cd backend
cp .env.example .env
# Edit .env with your MySQL credentials and JWT_SECRET
npm install
npm run db:push        # Creates/updates tables — does NOT delete existing rows
npm run db:seed        # Only for fresh installs — requires empty DB or FORCE_SEED=true
```

### 2. Backend

```bash
cd backend
npm run dev            # http://localhost:3001
```

### 3. Frontend

```bash
# From project root
npm install
npm run dev            # http://localhost:5173 (proxies /api → backend)
```

### Default logins (after seed only)

| Email | Password | Role |
|-------|----------|------|
| admin@tecsidel.com | admin123 | admin |
| j.garcia@tecsidel.com | pass1234 | operator |

Change these passwords immediately in production.

## Production Deployment

### Option A — Docker Compose

```bash
cp .env.docker.example .env.docker
# Edit .env.docker — set a strong JWT_SECRET

docker compose --env-file .env.docker up -d --build
```

First-time setup (empty database):

```bash
docker compose exec app sh -c "cd /app/backend && npm run db:push"
docker compose exec app sh -c "cd /app/backend && npm run db:seed"
```

Open **http://localhost:3001** — the API serves the built frontend in production mode.

### Option B — Manual

```bash
# Build frontend
npm ci && npm run build

# Build and start backend
cd backend
npm ci && npm run build
NODE_ENV=production npm start
```

Set these environment variables:

| Variable | Description |
|----------|-------------|
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port (default 3306) |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name |
| `JWT_SECRET` | **Required** in production — long random string |
| `JWT_EXPIRES_IN` | Token expiry (default `24h`) |
| `FRONTEND_URL` | Frontend origin for CORS/WebSocket |
| `CORS_ORIGINS` | Extra comma-separated origins |
| `PORT` | API port (default 3001) |
| `NODE_ENV` | Set to `production` |

## Data Safety

- `npm run db:push` only syncs schema — **existing device and user data is preserved**
- `npm run db:seed` wipes and re-inserts data when `FORCE_SEED=true` — **never run on production**
- Your existing `backend/.env` credentials are not modified by this project setup

## API Health Check

```
GET http://localhost:3001/health
```

## Project Structure

```
NMS/
├── src/              React frontend
├── backend/src/      Express API + ping monitor + scheduler
├── dist/             Built frontend (after npm run build)
├── Dockerfile        Production image (frontend + backend)
└── docker-compose.yml
```
