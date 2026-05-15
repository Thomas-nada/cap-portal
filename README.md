# CAP Portal

A governance portal for submitting, reviewing, and tracking Cardano Amendment Proposals (CAPs) and Cardano Improvement Standards (CISs). Wallet authentication via CIP-30, role-based editorial workflow, public read API.

## Stack

| Layer | Technology |
|---|---|
| Backend | Python · FastAPI · SQLAlchemy · PostgreSQL |
| Frontend | Vanilla JS · nginx |
| Auth | Cardano CIP-30 wallet (Eternl, Vespr, Lace, …) |
| Deployment | Docker Compose |

---

## Deployment

The portal ships as three Docker services: `backend` (FastAPI), `frontend` (nginx), and `backup` (scheduled PostgreSQL dumps). A `docker-compose.yml` is included for running everything on a single host.

### 1. Prerequisites

- Docker and Docker Compose
- A Cardano mainnet wallet extension installed in your browser

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
POSTGRES_PASSWORD=<long random string>
JWT_SECRET=<long random string>
```

Generate secrets with `openssl rand -hex 32`.

### 3. Run

```bash
docker compose up -d
```

The portal is available at `http://localhost`.

### 4. Reverse proxy / TLS (recommended for production)

Put a reverse proxy such as [Caddy](https://caddyserver.com) or nginx in front of the stack to terminate TLS and serve the portal over HTTPS. Point it at `http://localhost:80`.

### 5. Email notifications (optional)

Add SMTP credentials to `.env`:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=<username>
SMTP_PASSWORD=<password>
SMTP_FROM=noreply@yourdomain.com
APP_URL=https://your-domain.com
```

Any SMTP provider works. Leave these blank to disable email notifications.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `JWT_SECRET` | Yes | JWT signing secret |
| `SMTP_HOST` | No | SMTP server hostname |
| `SMTP_PORT` | No | SMTP port (default: 587) |
| `SMTP_USERNAME` | No | SMTP username |
| `SMTP_PASSWORD` | No | SMTP password |
| `SMTP_FROM` | No | Sender address for notifications |
| `APP_URL` | No | Public URL of the portal (used in email links) |
| `BACKUP_RETAIN_DAYS` | No | Days of backup files to keep (default: 7) |

---

## Public API

All read endpoints are public and require no authentication.

Write operations require a Cardano wallet JWT:

1. `GET /auth/challenge` — fetch a one-time challenge string
2. Sign it with `cardano.signData` (CIP-30)
3. `POST /auth/verify` — submit the signature, receive a Bearer token
4. Pass `Authorization: Bearer <token>` on authenticated requests

Interactive documentation is available at `/docs` on the backend service.

---

## Roles

| Role | Capabilities |
|---|---|
| **User** | Submit proposals, comment, follow proposals |
| **Editor** | Apply lifecycle labels, suggest edits to proposals |
| **Admin** | Manage editor and admin roles |

Roles are assigned by an existing admin via the portal's admin panel.

---

## Local development

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend — static files, no build step required
# Open frontend/index.html or serve with any static file server
```

The backend defaults to SQLite (`cap.db`) when `DATABASE_URL` is not set.
