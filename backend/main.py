import hashlib
import json
import logging
import os
import uuid

logger = logging.getLogger(__name__)
from dotenv import load_dotenv
load_dotenv()

if os.environ.get("ENVIRONMENT") == "production":
    for _var in ("DATABASE_URL", "JWT_SECRET"):
        if not os.environ.get(_var):
            raise RuntimeError(f"Required environment variable '{_var}' is not set")
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import text
from sqlalchemy.orm import Session

from auth import verify_cip8_signature, create_token, decode_token
from database import engine, get_db, Base
from emails import (notify_new_proposal, notify_new_comment, notify_new_suggestion,
                    notify_suggestion_resolved, notify_lifecycle_change, _send as _send_email,
                    SMTP_HOST, SMTP_FROM, APP_URL as EMAIL_APP_URL)
from models import Proposal, Label, Comment, AuditEvent, Editor, Admin, AuthChallenge, User, Suggestion, ProposalVersion, ProposalSubscriber, BugReport, Guide

Base.metadata.create_all(bind=engine)

# Lightweight migrations for columns added after initial schema creation
with engine.connect() as _conn:
    for _stmt in [
        "ALTER TABLE proposals ADD COLUMN structured_data TEXT",
        "ALTER TABLE proposal_versions ADD COLUMN previous_hash TEXT",
        "ALTER TABLE proposal_versions ADD COLUMN content_hash TEXT",
        "ALTER TABLE users ADD COLUMN email TEXT",
        "ALTER TABLE users ADD COLUMN notification_prefs TEXT",
        "ALTER TABLE bug_reports ADD COLUMN screenshot TEXT",
        "ALTER TABLE bug_reports ADD COLUMN environment TEXT",
        """CREATE TABLE IF NOT EXISTS proposal_subscribers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            proposal_number INTEGER NOT NULL REFERENCES proposals(number),
            email TEXT NOT NULL,
            unsubscribe_token TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS guides (
            slug TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_by TEXT,
            updated_by_name TEXT
        )""",
        "ALTER TABLE guides ADD COLUMN section TEXT DEFAULT 'general'",
        "ALTER TABLE guides ADD COLUMN section_label TEXT",
        "ALTER TABLE guides ADD COLUMN sort_order INTEGER DEFAULT 0",
    ]:
        try:
            _conn.execute(text(_stmt))
            _conn.commit()
        except Exception:
            _conn.rollback()  # Reset aborted transaction so next migration can run

limiter = Limiter(key_func=get_remote_address)

from fastapi.security import HTTPBearer
_bearer_scheme = HTTPBearer(auto_error=False)

app = FastAPI(
    title="CAP Portal API",
    version="1.0.0",
    description="""
The **CAP Portal** public API. Use it to build your own frontend, integrate proposals into
other tools, or display governance activity in any language or format.

## Authentication

Most read endpoints are **public** — no authentication required.

Write operations (submitting proposals, commenting, suggestions) require a **Cardano wallet
JWT**. To obtain one:

1. `GET /auth/challenge` — fetch a one-time challenge string.
2. Sign the challenge with `cardano.signData` (CIP-30) in the user's wallet.
3. `POST /auth/verify` — submit the signature to receive a Bearer token.
4. Pass the token as `Authorization: Bearer <token>` on all authenticated requests.

## Rate limits

| Scope | Limit |
|---|---|
| Auth endpoints | 10 requests / minute |
| Proposal creation | 10 requests / minute |
| Comments | 20 requests / minute |
| Suggestions | 10 requests / minute |

All other endpoints are unrestricted.
""",
    contact={
        "name": "Intersect MBO",
        "url": "https://www.intersectmbo.org",
    },
    license_info={
        "name": "Apache 2.0",
        "url": "https://www.apache.org/licenses/LICENSE-2.0",
    },
    openapi_tags=[
        {"name": "auth",          "description": "Wallet authentication and user profile"},
        {"name": "proposals",     "description": "Create and manage governance proposals"},
        {"name": "comments",      "description": "Discussion threads on proposals"},
        {"name": "labels",        "description": "Lifecycle labels applied by editors"},
        {"name": "suggestions",   "description": "Editor-suggested edits, approved or rejected by the author"},
        {"name": "versions",      "description": "Immutable version history with hash-chained integrity"},
        {"name": "subscriptions", "description": "Email follow / unfollow for any proposal"},
        {"name": "audit",         "description": "Append-only event log for every proposal"},
        {"name": "constitution",  "description": "Published constitution document versions"},
        {"name": "editors",       "description": "Editor role management"},
        {"name": "admins",        "description": "Admin role management"},
    ],
    swagger_ui_parameters={"persistAuthorization": True},
)

# Register Bearer token security scheme so Swagger shows the Authorize button
from fastapi.openapi.utils import get_openapi
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        tags=app.openapi_tags,
    )
    schema.setdefault("components", {})
    schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Paste the token returned by `POST /auth/verify`",
        }
    }
    app.openapi_schema = schema
    return schema

app.openapi = custom_openapi

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

from fastapi.responses import JSONResponse as _JSONResponse

@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> _JSONResponse:
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return _JSONResponse(status_code=500, content={"detail": "Internal server error"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONSTITUTION_DIR = Path(__file__).parent / "data" / "constitution"


# ── Auth helpers ─────────────────────────────────────────────────────────────

def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    return decode_token(token)


def require_user(authorization: Optional[str] = Header(None)) -> dict:
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def require_editor(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> dict:
    user = require_user(authorization)
    editor = db.query(Editor).filter(Editor.stake_address == user["sub"]).first()
    if not editor:
        raise HTTPException(status_code=403, detail="Editor access required")
    return user


def require_admin(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> dict:
    user = require_user(authorization)
    admin = db.query(Admin).filter(Admin.stake_address == user["sub"]).first()
    if not admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_editor_or_admin(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> dict:
    user = require_user(authorization)
    is_editor = db.query(Editor).filter(Editor.stake_address == user["sub"]).first()
    is_admin = db.query(Admin).filter(Admin.stake_address == user["sub"]).first()
    if not is_editor and not is_admin:
        raise HTTPException(status_code=403, detail="Editor or admin access required")
    return user


def is_editor(stake_address: str, db: Session) -> bool:
    return db.query(Editor).filter(Editor.stake_address == stake_address).first() is not None


def is_admin(stake_address: str, db: Session) -> bool:
    return db.query(Admin).filter(Admin.stake_address == stake_address).first() is not None


# ── Serialisers ───────────────────────────────────────────────────────────────

def proposal_to_dict(p: Proposal) -> dict:
    # body stores JSON for new proposals; fall back gracefully for legacy markdown
    structured = None
    legacy_body = None
    if p.body:
        try:
            parsed = json.loads(p.body)
            if isinstance(parsed, dict):
                structured = parsed
        except Exception:
            legacy_body = p.body  # old markdown — kept for display only
    return {
        "id": p.id,
        "number": p.number,
        "title": p.title,
        "body": legacy_body,       # None for JSON proposals; legacy markdown if old
        "structured": structured,  # primary content for all new proposals
        "type": p.type,
        "state": p.state,
        "author_stake_address": p.author_stake_address,
        "author_display_name": p.author_display_name,
        "labels": [{"name": l.name} for l in p.labels],
        "comments": len(p.comments),
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def comment_to_dict(c: Comment) -> dict:
    return {
        "id": c.id,
        "proposal_number": c.proposal_number,
        "body": c.body,
        "author_stake_address": c.author_stake_address,
        "author_display_name": c.author_display_name,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def audit_to_dict(e: AuditEvent) -> dict:
    return {
        "id": e.id,
        "proposal_number": e.proposal_number,
        "event_type": e.event_type,
        "actor_stake_address": e.actor_stake_address,
        "actor_display_name": e.actor_display_name,
        "data": json.loads(e.data) if e.data else None,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


def create_version(db: Session, proposal: Proposal, actor: dict, summary: str):
    last = db.query(ProposalVersion).filter(
        ProposalVersion.proposal_number == proposal.number
    ).order_by(ProposalVersion.version.desc()).first()
    next_ver = (last.version + 1) if last else 1
    previous_hash = last.content_hash if last else "genesis"
    payload = f"{proposal.title}|{proposal.body}|{previous_hash}"
    content_hash = hashlib.sha256(payload.encode()).hexdigest()
    db.add(ProposalVersion(
        proposal_number=proposal.number,
        version=next_ver,
        title=proposal.title,
        body=proposal.body,
        change_summary=summary,
        created_by=actor["sub"],
        created_by_name=actor.get("display_name"),
        previous_hash=previous_hash,
        content_hash=content_hash,
    ))


def record_audit(db: Session, proposal_number: int, event_type: str,
                 actor: dict, data: dict = None):
    event = AuditEvent(
        proposal_number=proposal_number,
        event_type=event_type,
        actor_stake_address=actor["sub"],
        actor_display_name=actor.get("display_name"),
        data=json.dumps(data) if data else None,
    )
    db.add(event)


# ── Auth endpoints ────────────────────────────────────────────────────────────

@app.get("/auth/challenge", tags=["auth"], summary="Get a one-time auth challenge",
         description="Returns a unique challenge string. Sign it with `cardano.signData` (CIP-30) and pass the result to `POST /auth/verify`.")
@limiter.limit("10/minute")
def get_challenge(request: Request, db: Session = Depends(get_db)):
    # Clean up expired challenges (older than 10 minutes)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    db.query(AuthChallenge).filter(AuthChallenge.created_at < cutoff).delete()
    challenge = f"CAP-Portal-Auth-{uuid.uuid4()}"
    db.add(AuthChallenge(challenge=challenge))
    db.commit()
    return {"challenge": challenge}


class VerifyRequest(BaseModel):
    stake_address: str
    challenge: str
    signature: str
    key: str
    display_name: Optional[str] = None


@app.post("/auth/verify", tags=["auth"], summary="Verify wallet signature and receive JWT",
          description="Submit the CIP-30 `signData` result to obtain a Bearer token. Tokens expire after 24 hours.")
@limiter.limit("10/minute")
def verify_auth(request: Request, req: VerifyRequest, db: Session = Depends(get_db)):
    # Check challenge exists and is fresh
    record = db.query(AuthChallenge).filter(AuthChallenge.challenge == req.challenge).first()
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired challenge")

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    if record.created_at < cutoff:
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=400, detail="Challenge expired")

    # Verify CIP-8 signature
    if not verify_cip8_signature(req.signature, req.key, req.challenge):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Consume challenge
    db.delete(record)

    # Look up or create user record; stored name takes priority over request name
    user_record = db.query(User).filter(User.stake_address == req.stake_address).first()
    if user_record:
        # If a new name was supplied and differs from stored, update only if not taken
        if req.display_name and req.display_name != user_record.display_name:
            clash = db.query(User).filter(
                User.display_name == req.display_name,
                User.stake_address != req.stake_address,
            ).first()
            if not clash:
                user_record.display_name = req.display_name
        display_name = user_record.display_name
    else:
        # New user — use requested name only if it's not already taken
        chosen_name = None
        if req.display_name:
            clash = db.query(User).filter(
                User.display_name == req.display_name,
                User.stake_address != req.stake_address,
            ).first()
            if not clash:
                chosen_name = req.display_name
        user_record = User(stake_address=req.stake_address, display_name=chosen_name)
        db.add(user_record)
        display_name = chosen_name

    db.commit()

    token = create_token(req.stake_address, display_name)
    editor = is_editor(req.stake_address, db)
    admin = is_admin(req.stake_address, db)
    return {
        "token": token,
        "stake_address": req.stake_address,
        "display_name": display_name,
        "is_editor": editor,
        "is_admin": admin,
    }


@app.get("/auth/me", tags=["auth"], summary="Get current user profile",
         description="Returns the authenticated user's stake address, display name, email, notification preferences, and roles.")
def get_me(user: dict = Depends(require_user), db: Session = Depends(get_db)):
    user_record = db.query(User).filter(User.stake_address == user["sub"]).first()
    prefs = json.loads(user_record.notification_prefs) if user_record and user_record.notification_prefs else {}
    return {
        "stake_address": user["sub"],
        "display_name": user.get("display_name"),
        "email": user_record.email if user_record else None,
        "notification_prefs": prefs,
        "is_editor": is_editor(user["sub"], db),
        "is_admin": is_admin(user["sub"], db),
    }


@app.post("/auth/test-email", tags=["auth"], summary="Send a test email to the current user")
def test_email(user: dict = Depends(require_user), db: Session = Depends(get_db)):
    user_record = db.query(User).filter(User.stake_address == user["sub"]).first()
    to = user_record.email if user_record else None
    if not SMTP_HOST:
        raise HTTPException(status_code=503, detail="SMTP is not configured on this server")
    if not to:
        raise HTTPException(status_code=400, detail="No email address on your profile — set one first")
    try:
        _send_email(to, "CAP Portal — test email", f"""
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b;padding:32px">
            <h2 style="margin:0 0 12px">Test email</h2>
            <p style="color:#64748b">If you received this, email notifications are working correctly.</p>
            <p style="color:#64748b;font-size:12px;margin-top:24px">Sent from <a href="{EMAIL_APP_URL}">{EMAIL_APP_URL}</a></p>
        </div>""")
        return {"status": "queued", "to": to, "from": SMTP_FROM}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SetNameRequest(BaseModel):
    display_name: str


@app.post("/auth/set-name", tags=["auth"], summary="Set display name (first-time setup)")
def set_display_name(req: SetNameRequest, user: dict = Depends(require_user), db: Session = Depends(get_db)):
    name = req.display_name.strip()[:40] or None
    if name:
        clash = db.query(User).filter(User.display_name == name, User.stake_address != user["sub"]).first()
        if clash:
            raise HTTPException(status_code=409, detail="That username is already taken")
    user_record = db.query(User).filter(User.stake_address == user["sub"]).first()
    if user_record:
        user_record.display_name = name
    else:
        db.add(User(stake_address=user["sub"], display_name=name))
    db.commit()
    token = create_token(user["sub"], name)
    return {
        "token": token,
        "stake_address": user["sub"],
        "display_name": name,
        "is_editor": is_editor(user["sub"], db),
        "is_admin": is_admin(user["sub"], db),
    }


class UpdateProfileRequest(BaseModel):
    display_name: str
    email: Optional[str] = None
    notification_prefs: Optional[dict] = None


@app.patch("/auth/profile", tags=["auth"], summary="Update display name, email and notification preferences")
def update_profile(req: UpdateProfileRequest, user: dict = Depends(require_user), db: Session = Depends(get_db)):
    name = req.display_name.strip()[:40] or None
    stake = user["sub"]

    if name:
        clash = db.query(User).filter(User.display_name == name, User.stake_address != stake).first()
        if clash:
            raise HTTPException(status_code=409, detail="That username is already taken")

    email = req.email.strip().lower() if req.email else None

    prefs_json = json.dumps(req.notification_prefs) if req.notification_prefs is not None else None
    user_record = db.query(User).filter(User.stake_address == stake).first()
    if user_record:
        user_record.display_name = name
        user_record.email = email
        if prefs_json is not None:
            user_record.notification_prefs = prefs_json
    else:
        db.add(User(stake_address=stake, display_name=name, email=email, notification_prefs=prefs_json))

    # Propagate name to all authored content
    db.query(Proposal).filter(Proposal.author_stake_address == stake).update({"author_display_name": name})
    db.query(Comment).filter(Comment.author_stake_address == stake).update({"author_display_name": name})
    db.query(AuditEvent).filter(AuditEvent.actor_stake_address == stake).update({"actor_display_name": name})

    db.commit()
    token = create_token(stake, name)
    prefs = json.loads(user_record.notification_prefs) if user_record and user_record.notification_prefs else {}
    return {
        "token": token,
        "stake_address": stake,
        "display_name": name,
        "email": email,
        "notification_prefs": prefs,
        "is_editor": is_editor(stake, db),
        "is_admin": is_admin(stake, db),
    }


# ── Proposals ─────────────────────────────────────────────────────────────────

@app.get("/health", tags=["meta"], summary="Health check / keep-alive ping")
def health_check():
    return {"status": "ok"}


@app.get("/proposals", tags=["proposals"], summary="List all proposals",
         description="Returns all proposals ordered by number descending. Each item includes title, type, lifecycle labels, author, and comment count. **Public.**")
def list_proposals(state: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Proposal)
    if state:
        q = q.filter(Proposal.state == state)
    proposals = q.order_by(Proposal.number.desc()).all()
    return [proposal_to_dict(p) for p in proposals]


@app.get("/proposals/{number}", tags=["proposals"], summary="Get a single proposal",
         description="Returns the full proposal including structured content fields, labels, and metadata. **Public.**")
def get_proposal(number: int, db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.number == number).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return proposal_to_dict(p)


class ProposalCreate(BaseModel):
    title: str
    type: str = "CAP"
    structured: dict  # required — all content lives here


@app.post("/proposals", status_code=201, tags=["proposals"], summary="Submit a new proposal",
          description="Creates a new proposal. The `consultation` lifecycle label is automatically applied. **Requires authentication.**")
@limiter.limit("10/minute")
def create_proposal(request: Request, req: ProposalCreate, user: dict = Depends(require_user),
                    db: Session = Depends(get_db)):
    last = db.query(Proposal).order_by(Proposal.number.desc()).first()
    next_number = (last.number + 1) if last else 1

    p = Proposal(
        number=next_number,
        title=req.title,
        body=json.dumps(req.structured),
        type=req.type,
        state="open",
        author_stake_address=user["sub"],
        author_display_name=user.get("display_name"),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    db.add(Label(proposal_number=p.number, name="consultation"))
    record_audit(db, p.number, "proposal_created", user, {"title": req.title, "type": req.type})
    create_version(db, p, user, "Initial submission")
    db.commit()
    notify_new_proposal(p.number, p.title, user.get("display_name") or user["sub"], db)
    return proposal_to_dict(p)


class ProposalUpdate(BaseModel):
    title: Optional[str] = None
    structured: Optional[dict] = None


@app.patch("/proposals/{number}", tags=["proposals"], summary="Update a proposal",
           description="Update title and/or structured content. Only the proposal author can edit. Edits are blocked once the proposal reaches `ready`, `done`, or `withdrawn`. A new version is created on every save. **Requires authentication.**")
def update_proposal(number: int, req: ProposalUpdate, user: dict = Depends(require_user),
                    db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.number == number).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if p.author_stake_address != user["sub"] and not is_editor(user["sub"], db):
        raise HTTPException(status_code=403, detail="Only the author or an editor can edit this proposal")

    locked_stages = {"ready", "done", "withdrawn"}
    current_labels = {l.name for l in p.labels}
    if current_labels & locked_stages:
        raise HTTPException(status_code=403, detail="Proposal is locked for editing once it reaches the ready stage")

    changes = {}
    parts = []
    if req.title is not None:
        changes["title"] = {"from": p.title, "to": req.title}
        parts.append("Title updated")
        p.title = req.title
    if req.structured is not None:
        changes["body_updated"] = True
        parts.append("Content updated")
        p.body = json.dumps(req.structured)

    p.updated_at = datetime.now(timezone.utc)
    record_audit(db, number, "proposal_edited", user, changes)
    if parts:
        create_version(db, p, user, ", ".join(parts))
    db.commit()
    db.refresh(p)
    return proposal_to_dict(p)


# ── Labels ─────────────────────────────────────────────────────────────────────

LIFECYCLE_LABELS = {"consultation", "ready", "done", "withdrawn"}
CATEGORY_LABELS = {"Procedural", "Substantive", "Technical", "Interpretive", "Editorial", "Other"}
AUTHOR_LABELS = {"author-ready", "CAP", "CIS"} | CATEGORY_LABELS
EDITOR_ONLY_LABELS = {
    "review", "revision", "finalizing", "onchain",
    "editor-ok", "editor-concern", "editor-suggested",
    "major", "minor", "bundle", "fast-track", "pause",
    "CAP", "CIS",
}


@app.post("/proposals/{number}/labels", tags=["labels"], summary="Add a label to a proposal",
          description="Lifecycle labels (`consultation`, `ready`, `done`, `withdrawn`) can only be applied by editors. Custom labels are also supported. Applying a lifecycle label clears any previous lifecycle label and the `author-ready` signal. **Requires editor role.**")
def add_label(number: int, body: dict, user: dict = Depends(require_user),
              db: Session = Depends(get_db)):
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Label name required")

    p = db.query(Proposal).filter(Proposal.number == number).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    # Editors can set any label; authors can only set author-ready
    editor = is_editor(user["sub"], db)
    if not editor and name not in AUTHOR_LABELS and name not in {"author-ready"}:
        raise HTTPException(status_code=403, detail="Editors only")

    # Remove conflicting lifecycle labels if adding a new lifecycle label
    if name in LIFECYCLE_LABELS:
        db.query(Label).filter(
            Label.proposal_number == number,
            Label.name.in_(LIFECYCLE_LABELS | {"author-ready"})
        ).delete(synchronize_session=False)
        if name == "done":
            p.state = "closed"
        elif name == "withdrawn":
            p.state = "closed"
        else:
            p.state = "open"

    existing = db.query(Label).filter(Label.proposal_number == number, Label.name == name).first()
    if not existing:
        db.add(Label(proposal_number=number, name=name))

    record_audit(db, number, "label_added", user, {"label": name})
    db.commit()
    db.refresh(p)
    if name in LIFECYCLE_LABELS:
        notify_lifecycle_change(p.number, p.title, p.author_stake_address, name, db)
    return proposal_to_dict(p)


@app.delete("/proposals/{number}/labels/{name}", tags=["labels"], summary="Remove a label",
            description="**Requires editor role.**")
def remove_label(number: int, name: str, user: dict = Depends(require_user),
                 db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.number == number).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    editor = is_editor(user["sub"], db)
    if not editor and name not in AUTHOR_LABELS:
        raise HTTPException(status_code=403, detail="Editors only")

    db.query(Label).filter(Label.proposal_number == number, Label.name == name).delete()
    record_audit(db, number, "label_removed", user, {"label": name})
    db.commit()
    db.refresh(p)
    return proposal_to_dict(p)


# ── Comments ───────────────────────────────────────────────────────────────────

@app.get("/proposals/{number}/comments", tags=["comments"], summary="List comments on a proposal",
         description="Returns all comments ordered by creation time. **Public.**")
def list_comments(number: int, db: Session = Depends(get_db)):
    comments = db.query(Comment).filter(Comment.proposal_number == number)\
        .order_by(Comment.created_at.asc()).all()
    return [comment_to_dict(c) for c in comments]


class CommentCreate(BaseModel):
    body: str


@app.post("/proposals/{number}/comments", status_code=201, tags=["comments"], summary="Post a comment",
          description="**Requires authentication.** Comments are attributed to the authenticated wallet address.")
@limiter.limit("20/minute")
def create_comment(request: Request, number: int, req: CommentCreate, user: dict = Depends(require_user),
                   db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.number == number).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    c = Comment(
        proposal_number=number,
        body=req.body,
        author_stake_address=user["sub"],
        author_display_name=user.get("display_name"),
    )
    db.add(c)
    record_audit(db, number, "comment_added", user)
    db.commit()
    db.refresh(c)
    notify_new_comment(p.number, p.title, p.author_stake_address,
                       user["sub"], user.get("display_name") or user["sub"], req.body, db)
    return comment_to_dict(c)


@app.patch("/comments/{comment_id}", tags=["comments"], summary="Edit a comment",
           description="Only the comment author can edit their own comment. **Requires authentication.**")
def update_comment(comment_id: int, req: CommentCreate, user: dict = Depends(require_user),
                   db: Session = Depends(get_db)):
    c = db.query(Comment).filter(Comment.id == comment_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Comment not found")
    if c.author_stake_address != user["sub"]:
        raise HTTPException(status_code=403, detail="Only the author can edit their comment")
    c.body = req.body
    c.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(c)
    return comment_to_dict(c)


# ── Audit trail ────────────────────────────────────────────────────────────────

@app.get("/proposals/{number}/audit", tags=["audit"], summary="Get audit trail for a proposal",
         description="Returns the full append-only event log: creation, edits, label changes, comments, and suggestions. **Public.**")
def get_audit(number: int, db: Session = Depends(get_db)):
    events = db.query(AuditEvent).filter(AuditEvent.proposal_number == number)\
        .order_by(AuditEvent.created_at.desc()).all()
    return [audit_to_dict(e) for e in events]


# ── Constitution ───────────────────────────────────────────────────────────────

@app.get("/constitution", tags=["constitution"], summary="List published constitution versions",
         description="Returns available constitution document filenames. **Public.**")
def list_constitution():
    if not CONSTITUTION_DIR.exists():
        return []
    files = sorted(
        [f.name for f in CONSTITUTION_DIR.iterdir() if f.suffix == ".md"],
        reverse=True
    )
    def display_name(f):
        name = f.replace(".md", "")
        import re
        m = re.match(r"cap-(\d+)-proposed", name)
        if m:
            return f"CAP-{m.group(1)} Proposed Draft"
        return name
    return [{"filename": f, "display_name": display_name(f)} for f in files]


@app.get("/constitution/{filename}", tags=["constitution"], summary="Get constitution document content",
         description="Returns the raw markdown content of a specific constitution version. **Public.**")
def get_constitution(filename: str):
    # Sanitise — only allow filenames, no path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = CONSTITUTION_DIR / filename
    if not path.exists() or path.suffix != ".md":
        raise HTTPException(status_code=404, detail="Constitution file not found")
    return {"filename": filename, "content": path.read_text(encoding="utf-8")}


@app.post("/proposals/{number}/generate-draft-constitution", tags=["constitution"], summary="Generate a draft constitution from a proposal",
          description="**Requires authentication.**")
def generate_draft_constitution(number: int, user: dict = Depends(require_user),
                                db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.number == number).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if p.author_stake_address != user["sub"] and not is_editor(user["sub"], db):
        raise HTTPException(status_code=403, detail="Not authorised")

    try:
        structured = json.loads(p.body) if p.body else {}
    except Exception:
        raise HTTPException(status_code=400, detail="No structured data")

    revisions = structured.get("revisions", [])
    if not revisions:
        raise HTTPException(status_code=400, detail="Proposal has no revisions")

    # Find the current (latest) constitution file
    if not CONSTITUTION_DIR.exists():
        raise HTTPException(status_code=500, detail="Constitution directory missing")
    files = sorted([f for f in CONSTITUTION_DIR.iterdir() if f.suffix == ".md" and not f.name.startswith("cap-")], reverse=True)
    if not files:
        raise HTTPException(status_code=404, detail="No base constitution file found")

    content = files[0].read_text(encoding="utf-8")

    # Apply each revision: simple text substitution
    modified = content
    applied = 0
    for rev in revisions:
        proposed = rev.get("proposed", "").strip()
        if not proposed:
            continue
        if rev.get("type") == "addition":
            anchor = rev.get("insert_after", "").strip()
            if anchor and anchor in modified:
                modified = modified.replace(anchor, anchor + "\n\n" + proposed, 1)
                applied += 1
        else:
            original = rev.get("original", "").strip()
            if original and original in modified:
                modified = modified.replace(original, proposed, 1)
                applied += 1

    filename = f"cap-{number}-proposed.md"
    with open(CONSTITUTION_DIR / filename, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(modified)

    return {"filename": filename, "applied": applied, "total": len(revisions)}


# ── Editors ────────────────────────────────────────────────────────────────────

@app.get("/editors", tags=["editors"], summary="List all editors", description="**Public.**")
def list_editors(db: Session = Depends(get_db)):
    return [{"stake_address": e.stake_address, "display_name": e.display_name}
            for e in db.query(Editor).all()]


class EditorCreate(BaseModel):
    stake_address: str
    display_name: Optional[str] = None


@app.post("/editors/bootstrap", status_code=201, tags=["editors"], summary="Claim the first editor role",
          description="One-time bootstrap: allowed only when no editors exist yet. **Requires authentication.**")
def bootstrap_editor(user: dict = Depends(require_user), db: Session = Depends(get_db)):
    """Allows the very first editor to self-register when no real editors exist yet."""
    real_editors = db.query(Editor).filter(~Editor.stake_address.like("stake1dev_%")).count()
    if real_editors > 0:
        raise HTTPException(status_code=403, detail="Editors already exist. Ask an existing editor to add you.")
    existing = db.query(Editor).filter(Editor.stake_address == user["sub"]).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already an editor")
    profile = db.query(User).filter(User.stake_address == user["sub"]).first()
    dn = profile.display_name if profile and profile.display_name else user["sub"][:20]
    db.add(Editor(stake_address=user["sub"], display_name=dn))
    db.commit()
    return {"stake_address": user["sub"], "display_name": dn}


@app.post("/editors", status_code=201, tags=["editors"], summary="Add an editor",
          description="**Requires admin role.**")
def add_editor(req: EditorCreate, user: dict = Depends(require_admin),
               db: Session = Depends(get_db)):
    existing = db.query(Editor).filter(Editor.stake_address == req.stake_address).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already an editor")
    # Auto-resolve display name from their registered profile if not explicitly provided
    display_name = req.display_name
    if not display_name:
        profile = db.query(User).filter(User.stake_address == req.stake_address).first()
        display_name = profile.display_name if profile and profile.display_name else req.stake_address[:20]
    db.add(Editor(stake_address=req.stake_address, display_name=display_name))
    db.commit()
    return {"ok": True}


@app.delete("/editors/{stake_address}", tags=["editors"], summary="Remove an editor",
            description="**Requires admin role.**")
def remove_editor(stake_address: str, user: dict = Depends(require_admin),
                  db: Session = Depends(get_db)):
    db.query(Editor).filter(Editor.stake_address == stake_address).delete()
    db.commit()
    return {"ok": True}


# ── Admins ─────────────────────────────────────────────────────────────────────

@app.get("/admins", tags=["admins"], summary="List all admins", description="**Public.**")
def list_admins(db: Session = Depends(get_db)):
    return [{"stake_address": a.stake_address, "display_name": a.display_name}
            for a in db.query(Admin).all()]


class AdminCreate(BaseModel):
    stake_address: str
    display_name: Optional[str] = None


@app.post("/admins/bootstrap", status_code=201, tags=["admins"], summary="Claim the first admin role",
          description="One-time bootstrap: allowed only when no admins exist yet. **Requires authentication.**")
def bootstrap_admin(user: dict = Depends(require_user), db: Session = Depends(get_db)):
    """Allows the very first admin to self-register when no real admins exist yet."""
    real_admins = db.query(Admin).filter(~Admin.stake_address.like("stake1dev_%")).count()
    if real_admins > 0:
        raise HTTPException(status_code=403, detail="Admins already exist. Ask an existing admin to add you.")
    existing = db.query(Admin).filter(Admin.stake_address == user["sub"]).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already an admin")
    profile = db.query(User).filter(User.stake_address == user["sub"]).first()
    dn = profile.display_name if profile and profile.display_name else user["sub"][:20]
    db.add(Admin(stake_address=user["sub"], display_name=dn))
    db.commit()
    return {"stake_address": user["sub"], "display_name": dn}


@app.post("/admins", status_code=201, tags=["admins"], summary="Add an admin",
          description="**Requires admin role.**")
def add_admin(req: AdminCreate, user: dict = Depends(require_admin),
              db: Session = Depends(get_db)):
    existing = db.query(Admin).filter(Admin.stake_address == req.stake_address).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already an admin")
    display_name = req.display_name
    if not display_name:
        profile = db.query(User).filter(User.stake_address == req.stake_address).first()
        display_name = profile.display_name if profile and profile.display_name else req.stake_address[:20]
    db.add(Admin(stake_address=req.stake_address, display_name=display_name))
    db.commit()
    return {"ok": True}


@app.delete("/admins/{stake_address}", tags=["admins"], summary="Remove an admin",
            description="**Requires admin role.**")
def remove_admin(stake_address: str, user: dict = Depends(require_admin),
                 db: Session = Depends(get_db)):
    if stake_address == user["sub"]:
        raise HTTPException(status_code=400, detail="Cannot remove yourself as admin")
    db.query(Admin).filter(Admin.stake_address == stake_address).delete()
    db.commit()
    return {"ok": True}


# ── Proposal versions ─────────────────────────────────────────────────────────

def version_to_dict(v: ProposalVersion) -> dict:
    structured = None
    try:
        parsed = json.loads(v.body)
        if isinstance(parsed, dict):
            structured = parsed
    except Exception:
        pass
    return {
        "id": v.id,
        "proposal_number": v.proposal_number,
        "version": v.version,
        "title": v.title,
        "structured": structured,
        "change_summary": v.change_summary,
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "created_by": v.created_by,
        "created_by_name": v.created_by_name,
        "previous_hash": v.previous_hash,
        "content_hash": v.content_hash,
    }


@app.get("/proposals/{number}/versions", tags=["versions"], summary="List all versions of a proposal",
         description="Returns the full version history ordered newest first. Each version includes a SHA-256 content hash chained to the previous version for tamper-evidence. **Public.**")
def list_versions(number: int, db: Session = Depends(get_db)):
    versions = db.query(ProposalVersion).filter(ProposalVersion.proposal_number == number)\
        .order_by(ProposalVersion.version.desc()).all()
    return [version_to_dict(v) for v in versions]


@app.get("/proposals/{number}/versions/{version_num}", tags=["versions"], summary="Get a specific version",
         description="Returns the full snapshot of a proposal at a specific version number. **Public.**")
def get_version(number: int, version_num: int, db: Session = Depends(get_db)):
    v = db.query(ProposalVersion).filter(
        ProposalVersion.proposal_number == number,
        ProposalVersion.version == version_num,
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Version not found")
    return version_to_dict(v)


# ── Suggestions ───────────────────────────────────────────────────────────────

SUGGESTION_FIELDS = {"title", "abstract", "motivation", "analysis", "impact", "exhibits"}


def suggestion_to_dict(s: Suggestion) -> dict:
    return {
        "id": s.id,
        "proposal_number": s.proposal_number,
        "field": s.field,
        "current_value": s.current_value,
        "suggested_value": s.suggested_value,
        "reason": s.reason,
        "status": s.status,
        "editor_stake_address": s.editor_stake_address,
        "editor_display_name": s.editor_display_name,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "resolved_at": s.resolved_at.isoformat() if s.resolved_at else None,
        "resolved_by": s.resolved_by,
    }


@app.get("/proposals/{number}/suggestions", tags=["suggestions"], summary="List suggestions on a proposal",
         description="Returns all editor suggestions with their status (`pending`, `approved`, `rejected`). **Public.**")
def list_suggestions(number: int, db: Session = Depends(get_db)):
    return [suggestion_to_dict(s) for s in
            db.query(Suggestion).filter(Suggestion.proposal_number == number)
            .order_by(Suggestion.created_at.desc()).all()]


class SuggestionCreate(BaseModel):
    field: str
    suggested_value: str
    reason: Optional[str] = None


@app.post("/proposals/{number}/suggestions", status_code=201, tags=["suggestions"], summary="Submit an edit suggestion",
          description="Editors can suggest changes to any field (`title`, `abstract`, `motivation`, `analysis`, `impact`). The proposal author is notified and can approve or reject. **Requires editor role.**")
@limiter.limit("10/minute")
def create_suggestion(request: Request, number: int, req: SuggestionCreate,
                      user: dict = Depends(require_editor), db: Session = Depends(get_db)):
    if req.field not in SUGGESTION_FIELDS:
        raise HTTPException(status_code=400, detail=f"Invalid field. Must be one of: {', '.join(SUGGESTION_FIELDS)}")

    p = db.query(Proposal).filter(Proposal.number == number).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if p.author_stake_address == user["sub"]:
        raise HTTPException(status_code=400, detail="Authors cannot suggest changes to their own proposal — edit it directly")

    # Snapshot current value
    structured = json.loads(p.body) if p.body else {}
    current = p.title if req.field == "title" else structured.get(req.field, "")

    s = Suggestion(
        proposal_number=number,
        field=req.field,
        current_value=current,
        suggested_value=req.suggested_value,
        reason=req.reason,
        editor_stake_address=user["sub"],
        editor_display_name=user.get("display_name"),
    )
    db.add(s)
    record_audit(db, number, "suggestion_created", user, {"field": req.field})
    db.commit()
    db.refresh(s)
    notify_new_suggestion(p.number, p.title, p.author_stake_address,
                          user.get("display_name") or user["sub"], req.field, db)
    return suggestion_to_dict(s)


@app.post("/proposals/{number}/suggestions/{suggestion_id}/approve", tags=["suggestions"], summary="Approve a suggestion",
          description="Applies the suggested value to the proposal field and creates a new version. **Only the proposal author.**")
def approve_suggestion(number: int, suggestion_id: int,
                       user: dict = Depends(require_user), db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.number == number).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if p.author_stake_address != user["sub"]:
        raise HTTPException(status_code=403, detail="Only the proposal author can approve suggestions")

    s = db.query(Suggestion).filter(Suggestion.id == suggestion_id, Suggestion.proposal_number == number).first()
    if not s:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    if s.status != "pending":
        raise HTTPException(status_code=400, detail="Suggestion is already resolved")

    # Apply the change to the proposal
    if s.field == "title":
        p.title = s.suggested_value
    else:
        structured = json.loads(p.body) if p.body else {}
        structured[s.field] = s.suggested_value
        p.body = json.dumps(structured)
    p.updated_at = datetime.now(timezone.utc)

    s.status = "approved"
    s.resolved_at = datetime.now(timezone.utc)
    s.resolved_by = user["sub"]

    field_labels = {"title": "Title", "abstract": "Summary", "motivation": "Why", "analysis": "Analysis", "impact": "Impact", "exhibits": "Links & Files"}
    summary = f"Editor suggestion applied: {field_labels.get(s.field, s.field)}"
    record_audit(db, number, "suggestion_approved", user, {"field": s.field, "suggestion_id": s.id})
    create_version(db, p, user, summary)
    db.commit()
    notify_suggestion_resolved(p.number, p.title, s.editor_stake_address, s.field, "approved", db)
    return suggestion_to_dict(s)


@app.post("/proposals/{number}/suggestions/{suggestion_id}/reject", tags=["suggestions"], summary="Reject a suggestion",
          description="Marks the suggestion as rejected. No changes are made to the proposal. **Only the proposal author.**")
def reject_suggestion(number: int, suggestion_id: int,
                      user: dict = Depends(require_user), db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.number == number).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if p.author_stake_address != user["sub"]:
        raise HTTPException(status_code=403, detail="Only the proposal author can reject suggestions")

    s = db.query(Suggestion).filter(Suggestion.id == suggestion_id, Suggestion.proposal_number == number).first()
    if not s:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    if s.status != "pending":
        raise HTTPException(status_code=400, detail="Suggestion is already resolved")

    s.status = "rejected"
    s.resolved_at = datetime.now(timezone.utc)
    s.resolved_by = user["sub"]

    record_audit(db, number, "suggestion_rejected", user, {"field": s.field, "suggestion_id": s.id})
    db.commit()
    notify_suggestion_resolved(p.number, p.title, s.editor_stake_address, s.field, "rejected", db)
    return suggestion_to_dict(s)


# ── Subscriptions ─────────────────────────────────────────────────────────────

class SubscribeRequest(BaseModel):
    email: str

@app.post("/proposals/{number}/subscribe", status_code=201, tags=["subscriptions"], summary="Follow a proposal",
          description="Subscribe any email address to receive notifications when comments are posted or the lifecycle stage changes. No authentication required — anyone can follow. An unsubscribe link is included in every notification email.")
def subscribe(number: int, req: SubscribeRequest, db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.number == number).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email required")

    existing = db.query(ProposalSubscriber).filter(
        ProposalSubscriber.proposal_number == number,
        ProposalSubscriber.email == email
    ).first()
    if existing:
        return {"message": "Already subscribed"}

    token = str(uuid.uuid4())
    db.add(ProposalSubscriber(proposal_number=number, email=email, unsubscribe_token=token))
    db.commit()

    from emails import APP_URL, _send, _base
    _send(email, f"You're following: {p.title}", _base(f"""
    <h2 style="margin:0 0 8px;font-size:20px">You're now following a proposal</h2>
    <p style="color:#64748b;margin:0 0 20px">
        You'll receive updates when there are new comments or status changes on
        <strong>{p.title}</strong>.
    </p>
    <a href="{APP_URL}#proposal/{number}"
       style="background:#1e40af;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
        View Proposal
    </a>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
    <p style="font-size:12px;color:#94a3b8">
        <a href="{APP_URL}/unsubscribe?token={token}" style="color:#94a3b8">Unsubscribe</a>
    </p>"""))

    return {"message": "Subscribed successfully"}


@app.get("/proposals/{number}/subscribe", tags=["subscriptions"], summary="Check subscription status",
         description="Returns `{subscribed: true/false}` for the given email address.")
def check_subscription(number: int, email: str, db: Session = Depends(get_db)):
    email = email.strip().lower()
    sub = db.query(ProposalSubscriber).filter(
        ProposalSubscriber.proposal_number == number,
        ProposalSubscriber.email == email
    ).first()
    return {"subscribed": sub is not None}


@app.delete("/proposals/{number}/subscribe", status_code=200, tags=["subscriptions"], summary="Unfollow a proposal",
            description="Removes the subscription for the given email address.")
def unsubscribe_by_email(number: int, req: SubscribeRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    sub = db.query(ProposalSubscriber).filter(
        ProposalSubscriber.proposal_number == number,
        ProposalSubscriber.email == email
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    db.delete(sub)
    db.commit()
    return {"message": "Unsubscribed successfully"}


@app.get("/unsubscribe", tags=["subscriptions"], summary="One-click unsubscribe via token",
         description="Used by the unsubscribe link in notification emails. Accepts the token from the email and removes the subscription.")
def unsubscribe(token: str, db: Session = Depends(get_db)):
    sub = db.query(ProposalSubscriber).filter(ProposalSubscriber.unsubscribe_token == token).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    db.delete(sub)
    db.commit()
    return {"message": "Unsubscribed successfully"}


# ── Seed endpoint (dev only) ───────────────────────────────────────────────────

@app.post("/dev/seed-editor")
def seed_editor(body: dict, db: Session = Depends(get_db)):
    """Dev-only: add an editor by stake address without auth. Remove before production."""
    if os.environ.get("ENVIRONMENT") == "production":
        raise HTTPException(status_code=404)
    sa = body.get("stake_address")
    dn = body.get("display_name")
    if not sa:
        raise HTTPException(status_code=400, detail="stake_address required")
    existing = db.query(Editor).filter(Editor.stake_address == sa).first()
    if not existing:
        db.add(Editor(stake_address=sa, display_name=dn))
        db.commit()
    return {"ok": True}


# ── Guides ────────────────────────────────────────────────────────────────────

class GuideUpdate(BaseModel):
    title: str
    content: str  # markdown
    section: str = 'general'
    section_label: Optional[str] = None
    sort_order: int = 0

@app.get("/guides", tags=["guides"], summary="List all guides")
def list_guides(db: Session = Depends(get_db)):
    guides = db.query(Guide).order_by(Guide.section, Guide.sort_order, Guide.slug).all()
    return [{"slug": g.slug, "title": g.title, "section": g.section,
             "section_label": g.section_label or g.section.replace('-', ' ').title(),
             "sort_order": g.sort_order} for g in guides]

@app.get("/guides/{slug}", tags=["guides"], summary="Get a guide by slug")
def get_guide(slug: str, db: Session = Depends(get_db)):
    guide = db.query(Guide).filter(Guide.slug == slug).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    return {
        "slug": guide.slug,
        "title": guide.title,
        "content": guide.content,
        "updated_at": guide.updated_at.isoformat(),
        "updated_by_name": guide.updated_by_name,
    }

@app.put("/guides/{slug}", tags=["guides"], summary="Create or update a guide (editor/admin only)")
def upsert_guide(slug: str, body: GuideUpdate,
                 user: dict = Depends(require_editor_or_admin),
                 db: Session = Depends(get_db)):
    guide = db.query(Guide).filter(Guide.slug == slug).first()
    if guide:
        guide.title = body.title.strip()
        guide.content = body.content
        guide.updated_by = user["sub"]
        guide.updated_by_name = user.get("display_name")
        guide.updated_at = datetime.now(timezone.utc)
        guide.section = body.section
        guide.section_label = body.section_label
        guide.sort_order = body.sort_order
    else:
        guide = Guide(
            slug=slug,
            title=body.title.strip(),
            content=body.content,
            updated_by=user["sub"],
            updated_by_name=user.get("display_name"),
            section=body.section,
            section_label=body.section_label,
            sort_order=body.sort_order,
        )
        db.add(guide)
    db.commit()
    db.refresh(guide)
    return {"slug": guide.slug, "title": guide.title, "updated_at": guide.updated_at.isoformat()}

@app.delete("/guides/{slug}", tags=["guides"], summary="Delete a guide (editor/admin only)", status_code=204)
def delete_guide(slug: str, user: dict = Depends(require_editor_or_admin), db: Session = Depends(get_db)):
    guide = db.query(Guide).filter(Guide.slug == slug).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    db.delete(guide)
    db.commit()
    return None


# ── Bug Reports ───────────────────────────────────────────────────────────────

class BugReportCreate(BaseModel):
    title: str
    description: str
    screenshot: Optional[str] = None  # base64 data URL
    environment: Optional[dict] = None  # auto-captured env info

class BugReportStatusUpdate(BaseModel):
    status: str  # open | in_progress | resolved

@app.post("/bug-reports", tags=["bug-reports"], status_code=201,
          summary="Submit a bug report")
def submit_bug_report(body: BugReportCreate,
                      user: dict = Depends(require_user),
                      db: Session = Depends(get_db)):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    report = BugReport(
        title=body.title.strip(),
        description=body.description.strip(),
        screenshot=body.screenshot,
        environment=json.dumps(body.environment) if body.environment else None,
        reporter_stake_address=user["sub"],
        reporter_display_name=user.get("display_name"),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {"id": report.id, "title": report.title, "status": report.status,
            "created_at": report.created_at.isoformat()}

@app.get("/bug-reports", tags=["bug-reports"], summary="List all bug reports (admin only)")
def list_bug_reports(user: dict = Depends(require_admin),
                     db: Session = Depends(get_db)):
    reports = db.query(BugReport).order_by(BugReport.created_at.desc()).all()
    return [{"id": r.id, "title": r.title, "description": r.description,
             "screenshot": r.screenshot,
             "environment": json.loads(r.environment) if r.environment else None,
             "reporter_stake_address": r.reporter_stake_address,
             "reporter_display_name": r.reporter_display_name,
             "status": r.status,
             "created_at": r.created_at.isoformat(),
             "updated_at": r.updated_at.isoformat()} for r in reports]

@app.patch("/bug-reports/{report_id}/status", tags=["bug-reports"],
           summary="Update bug report status (admin only)")
def update_bug_report_status(report_id: int, body: BugReportStatusUpdate,
                              user: dict = Depends(require_admin),
                              db: Session = Depends(get_db)):
    if body.status not in ("open", "in_progress", "resolved"):
        raise HTTPException(status_code=400, detail="Invalid status")
    report = db.query(BugReport).filter(BugReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Bug report not found")
    report.status = body.status
    db.commit()
    return {"id": report.id, "status": report.status}


if __name__ == '__main__':
    import uvicorn
    uvicorn.run('main:app', host='0.0.0.0', port=8000, reload=True)  # dev only
