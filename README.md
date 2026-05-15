# CAP Portal

A governance portal for submitting, reviewing, and tracking Cardano Amendment Proposals (CAPs) and Cardano Improvement Standards (CISs). Wallet authentication via CIP-30, role-based editorial workflow, public read API.

## Stack

| Layer | Technology |
|---|---|
| Backend | Python · FastAPI · SQLAlchemy · PostgreSQL |
| Frontend | Vanilla JS · nginx |
| Auth | Cardano CIP-30 wallet (Eternl, Vespr, Lace, …) |
| Deployment | Docker · Render Blueprint |

---

## Self-hosting (Docker Compose)

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

### 4. Email notifications (optional)

Add SMTP credentials to `.env`:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USERNAME=resend
SMTP_PASSWORD=<your-resend-api-key>
SMTP_FROM=noreply@yourdomain.com
APP_URL=https://your-domain.com
```

[Resend](https://resend.com) offers a free tier with no credit card required.

---

## Deploying to Render

Use the included `render.yaml` Blueprint to deploy two Docker web services and a managed PostgreSQL instance in one click.

1. Fork or push this repo to GitHub.
2. In the Render dashboard, **New → Blueprint** and connect the repo.
3. After deploy, set the following environment variables manually in the `cap-portal` (frontend) service:
   - `API_BASE` → `https://<cap-portal-api-url>.onrender.com`
4. Optionally set SMTP variables in the `cap-portal-api` (backend) service for email notifications.

---

## Public API

All read endpoints are public and require no authentication.

Write operations require a Cardano wallet JWT:

1. `GET /auth/challenge` — fetch a one-time challenge string
2. Sign it with `cardano.signData` (CIP-30)
3. `POST /auth/verify` — submit the signature, receive a Bearer token
4. Pass `Authorization: Bearer <token>` on authenticated requests

Interactive documentation: `https://<your-api-url>/docs`

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

# Frontend — static files served directly, no build step
# Open frontend/index.html or serve with any static file server
```

The backend defaults to SQLite (`cap.db`) when `DATABASE_URL` is not set.
