# CAP Portal

A governance portal for submitting, reviewing, and tracking Constitutional Amendment Proposals (CAPs) and Constitutional Issue Submissions (CIS) for the Cardano Constitution. Wallet authentication via CIP-30, role-based editorial workflow, public read API.

## Stack

| Layer | Technology |
|---|---|
| Backend | Python · FastAPI · SQLAlchemy · PostgreSQL (SQLite for local dev) |
| Frontend | Vanilla JS (ES modules, no build step) · any static file server |
| Auth | Cardano CIP-30 wallet (Eternl, Vespr, Lace, …) |
| Hosting | Render (native Python web service + static site) |
| Backups | GitHub Actions · hourly `pg_dump`, 400-day retention |

---

## Setting up a fresh instance

### 1. Deploy

**On Render (what the reference deployment uses):**

1. Fork or clone this repository to your own GitHub account.
2. In Render: **New → Blueprint**, connect the repo. `render.yaml` creates the PostgreSQL database and the backend API service automatically.
3. In Render: **New → Static Site**, same repo. Set **Publish Directory** to `frontend` and add a Rewrite rule `/*` → `/index.html`.
4. Update `API_BASE` in `frontend/js/config.js` to your backend service URL.

**Anywhere else:** any host that can run `pip install -r requirements.txt` and `uvicorn main:app` works. Set the environment variables below and serve `frontend/` from any static file server.

### 2. Environment variables (backend)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes (production) | PostgreSQL connection string. Defaults to local SQLite `cap.db` when unset. |
| `JWT_SECRET` | Yes | JWT signing secret. Generate with `openssl rand -hex 32`. |
| `ENVIRONMENT` | No | Set to `production` in production. |

### 3. Claim the admin role

A fresh instance has no admins or editors. The **first authenticated user can claim the admin role** (and likewise the first editor role) from the Editors/Admins page in the portal — the claim option is shown only while no real admin/editor exists. As soon as one exists, the bootstrap locks itself permanently and further roles can only be granted by an existing admin.

So: deploy, open the portal, connect your wallet, claim admin. Done.

### 4. Enable backups (recommended)

The backup workflow (`.github/workflows/backup.yml`) runs hourly from the **default branch** of your GitHub repo and stores compressed database dumps as workflow artifacts for 400 days.

One-time setup: in GitHub → **Settings → Secrets and variables → Actions**, add a secret named `DATABASE_URL` containing your PostgreSQL connection string (from the Render database's "External Connection String").

A keep-alive workflow (`.github/workflows/keep-alive.yml`) pings the backend every 10 minutes so Render's free tier doesn't spin it down; update the URL in that file to your own backend.

---

## Backup and restore

### What is backed up

Everything user-generated lives in the PostgreSQL database and is captured by every dump: proposals, comments, edit-history versions, the audit trail, users, **editors and admins**, guides, bug reports, and generated constitution drafts. Code, configuration, and the base constitution text live in this git repository.

### Restoring (disaster recovery)

Works even if the original host disappears entirely — backups are stored on GitHub, independent of the hosting provider.

1. Download the most recent backup artifact: GitHub → **Actions → Database Backup** → latest run → Artifacts.
2. Create a fresh PostgreSQL database anywhere (Render, Fly.io, Supabase, a VPS, …).
3. Restore the dump:
   ```bash
   gunzip < cap_portal_YYYYMMDD_HHMMSS.sql.gz | psql "$NEW_DATABASE_URL"
   ```
4. Deploy the code (step 1 above) with `DATABASE_URL` pointing at the restored database and any fresh `JWT_SECRET` (users simply reconnect their wallets).

All roles, proposals, and discussion history come back with the restore. Note that because the restored database already contains admins, the first-claim bootstrap stays locked — if you need to add yourself as admin on your own instance, insert your stake address directly:

```sql
INSERT INTO admins (stake_address, display_name) VALUES ('stake1...', 'Your Name');
```

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
| **User** | Submit proposals, comment, report bugs |
| **Editor** | Apply lifecycle labels, suggest edits, flag content for admin review |
| **Admin** | Manage editor and admin roles, moderate content |

Roles are assigned by an existing admin via the portal's Editors page. On a brand-new instance the first admin/editor is self-claimed (see above).

---

## Local development

```bash
# Backend (SQLite, no configuration needed)
cd backend
pip install -r requirements.txt
py -3 -m uvicorn main:app --reload --port 8000

# Frontend
cd frontend
py -3 dev-server.py 8765
```

Set `API_BASE` in `frontend/js/config.js` — it defaults to `http://localhost:8000` when served from localhost. The portal is then available at http://localhost:8765.
