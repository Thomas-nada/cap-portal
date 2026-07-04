import hashlib
import json
import logging
import os
import uuid

logger = logging.getLogger(__name__)
from dotenv import load_dotenv
import config as _config
load_dotenv()

# Refuse to start misconfigured. A real database (anything other than local
# SQLite) means this is not a throwaway dev instance, so a proper JWT_SECRET is
# mandatory — otherwise tokens would be signed with a random per-process key
# (see auth.py) and every restart would silently invalidate all sessions, or
# worse, a forgotten ENVIRONMENT var would have left a guessable secret in place.
_db_url = _config.get("DATABASE_URL", "")
_is_production = os.environ.get("ENVIRONMENT") == "production"
_uses_real_db = bool(_db_url) and not _db_url.startswith("sqlite")
if _is_production and not _db_url:
    raise RuntimeError("Required config value 'DATABASE_URL' is not set")
if (_is_production or _uses_real_db) and not _config.get("JWT_SECRET"):
    raise RuntimeError(
        "JWT_SECRET is not set. Refusing to start against a real database without "
        "a configured signing secret (set JWT_SECRET, e.g. `openssl rand -hex 32`)."
    )
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import text
from sqlalchemy.orm import Session

from auth import verify_cip8_signature, derive_stake_addresses, create_token, decode_token
from database import engine, get_db, Base
from models import (Proposal, Label, Comment, AuditEvent, Editor, Admin, AuthChallenge,
                    User, Suggestion, ProposalVersion, BugReport, Guide, ConstitutionDoc,
                    ModerationCase, Notification, AlphaAgreement)

Base.metadata.create_all(bind=engine)

# Lightweight migrations for columns added after initial schema creation
with engine.connect() as _conn:
    for _stmt in [
        "ALTER TABLE proposal_versions ADD COLUMN previous_hash TEXT",
        "ALTER TABLE proposal_versions ADD COLUMN content_hash TEXT",
        "ALTER TABLE bug_reports ADD COLUMN screenshot TEXT",
        "ALTER TABLE bug_reports ADD COLUMN environment TEXT",
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
        "ALTER TABLE proposals ADD COLUMN withdrawal_requested_by TEXT",
        "ALTER TABLE proposals ADD COLUMN withdrawal_requested_by_name TEXT",
        "ALTER TABLE proposals ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'visible'",
        "ALTER TABLE comments ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'visible'",
        # Drop the superseded per-comment flag columns (replaced by the
        # moderation_status + moderation_cases workflow). Their leftover NOT NULL
        # constraint would otherwise break new comment inserts on existing DBs.
        "ALTER TABLE comments DROP COLUMN flagged",
        "ALTER TABLE comments DROP COLUMN flagged_by",
        "ALTER TABLE comments DROP COLUMN flagged_by_name",
    ]:
        try:
            _conn.execute(text(_stmt))
            _conn.commit()
        except Exception:
            _conn.rollback()  # Reset aborted transaction so next migration can run

# ── Seed default guides (metadata only — content served from static files) ────
_DEFAULT_GUIDES = [
    # section, section_label, sort_order, slug, title
    ("editor-guides",    "Editor Guides",       0, "editor-guide",                       "Complete Editor Guide"),
    ("editor-guides",    "Editor Guides",       1, "editor-role",                        "Editor Role & Scope"),
    ("getting-started",  "Getting Started",     0, "about-the-cap-process",              "How the CAP Process Was Built"),
    ("getting-started",  "Getting Started",     1, "intro-to-caps-and-cis",              "Introduction to CAPs & CIS"),
    ("getting-started",  "Getting Started",     2, "how-to-participate",                 "How to Participate"),
    ("getting-started",  "Getting Started",     3, "deliberation-process",               "The Deliberation Process"),
    ("writing-caps",     "Writing CAPs",        0, "creating-a-cap",                     "Creating a CAP or CIS: Quick Checklist"),
    ("writing-caps",     "Writing CAPs",        1, "cap-template-guide",                 "CAP Template Guide"),
    ("writing-caps",     "Writing CAPs",        3, "common-mistakes",                    "Common Mistakes to Avoid"),
    ("using-the-portal", "Using the Portal",    0, "connecting-your-wallet",             "Connecting Your Cardano Wallet"),
    ("using-the-portal", "Using the Portal",    1, "submitting-with-the-wizard",         "Submitting a CAP with the Wizard"),
    ("using-the-portal", "Using the Portal",    2, "browsing-the-constitution",          "Browsing & Comparing the Constitution"),
    ("using-the-portal", "Using the Portal",    3, "commenting-and-discussing",          "Commenting & Discussion"),
    ("using-the-portal", "Using the Portal",    4, "labels-and-workflow",                "Labels & Workflow"),
    ("constitution",     "Constitution",        0, "article-by-article-breakdown",       "Article-by-Article Breakdown"),
    ("faq",              "FAQ",                 0, "faq-what-is-a-cap",                  "What is a CAP?"),
    ("faq",              "FAQ",                 1, "faq-what-is-a-cis",                  "What is a CIS?"),
    ("faq",              "FAQ",                 2, "faq-who-can-create-a-cap",           "Who can create a CAP?"),
    ("faq",              "FAQ",                 3, "faq-how-long-is-deliberation",       "How long is deliberation?"),
    ("faq",              "FAQ",                 4, "faq-what-are-the-categories",        "What CAP categories exist?"),
    ("faq",              "FAQ",                 5, "faq-can-i-edit-my-cap",              "Can I edit my CAP?"),
    ("faq",              "FAQ",                 6, "faq-can-a-cis-become-a-cap",         "Can a CIS become a CAP?"),
    ("faq",              "FAQ",                 7, "faq-what-happens-after-30-days",     "What happens after deliberation?"),
    ("faq",              "FAQ",                 8, "faq-how-are-caps-approved",          "How are CAPs approved?"),
    ("faq",              "FAQ",                 9, "faq-what-is-a-governance-action",    "What is a governance action?"),
    ("faq",              "FAQ",                10, "faq-what-is-the-constitutional-committee", "What is the Constitutional Committee?"),
    ("faq",              "FAQ",                11, "faq-what-is-a-drep",                 "What is a DRep?"),
    ("faq",              "FAQ",                12, "faq-what-are-guardrails",            "What are the Guardrails?"),
    ("faq",              "FAQ",                13, "faq-what-is-a-cap-editor",           "What is a CAP Editor?"),
    ("faq",              "FAQ",                14, "faq-do-i-need-a-wallet",             "Do I need a Cardano wallet?"),
    ("faq",              "FAQ",                15, "faq-what-is-the-amendment-wizard",   "What is the Amendment Wizard?"),
]

with engine.connect() as _conn:
    existing = _conn.execute(text("SELECT COUNT(*) FROM guides")).scalar()
    if existing == 0:
        for _sec, _sec_label, _order, _slug, _title in _DEFAULT_GUIDES:
            try:
                _conn.execute(text(
                    "INSERT INTO guides (slug, title, content, section, section_label, sort_order) "
                    "VALUES (:slug, :title, '', :section, :section_label, :order)"
                ), {"slug": _slug, "title": _title, "section": _sec,
                    "section_label": _sec_label, "order": _order})
            except Exception:
                pass
        _conn.commit()

def client_ip(request: Request) -> str:
    """Real client IP for rate limiting. Behind Render's proxy the socket peer
    (request.client.host) is always the proxy, so every user would otherwise
    share one rate-limit bucket. Render's load balancer appends the true client
    IP as the LAST entry of X-Forwarded-For; taking the rightmost value is
    spoof-resistant (a client-forged header is followed by the real IP)."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[-1].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip)

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
        {"name": "audit",         "description": "Append-only event log for every proposal"},
        {"name": "constitution",  "description": "Published constitution document versions"},
        {"name": "moderation",    "description": "Flag content for removal and admin review of cases"},
        {"name": "notifications", "description": "In-app notifications"},
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

# ── Input size limits ─────────────────────────────────────────────────────────
# Deliberations can run long, so text limits are generous — they exist to stop a
# single request bloating the database, not to constrain legitimate writing.
MAX_TITLE = 300
MAX_LONG_TEXT = 100_000       # ~16,000 words per proposal section / comment
MAX_STRUCTURED_TOTAL = 500_000  # whole proposal body (all fields combined)
MAX_REASON = 10_000
MAX_GUIDE_CONTENT = 300_000
MAX_SCREENSHOT = 5_000_000    # base64 data URL (~3.7 MB image)
MAX_NAME = 200

_PROPOSAL_TEXT_FIELDS = ("abstract", "motivation", "analysis", "impact", "exhibits")


def _validate_structured(v):
    if not isinstance(v, dict):
        raise ValueError("Proposal content must be an object")
    if len(json.dumps(v)) > MAX_STRUCTURED_TOTAL:
        raise ValueError(f"Proposal content is too large (max {MAX_STRUCTURED_TOTAL:,} characters total)")
    for key in _PROPOSAL_TEXT_FIELDS:
        val = v.get(key)
        if isinstance(val, str) and len(val) > MAX_LONG_TEXT:
            raise ValueError(f"The '{key}' field is too long (max {MAX_LONG_TEXT:,} characters)")
    return v


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> _JSONResponse:
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return _JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.exception_handler(RequestValidationError)
async def _validation_error_handler(request: Request, exc: RequestValidationError) -> _JSONResponse:
    # Surface a single clean message (e.g. our size-limit text) instead of the
    # default nested 422 structure, which the frontend can't display readably.
    errs = exc.errors()
    msg = (errs[0].get("msg") if errs else None) or "Invalid input"
    msg = msg.replace("Value error, ", "")
    return _JSONResponse(status_code=400, content={"detail": msg})

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONSTITUTION_DIR = Path(__file__).parent / "data" / "constitution"


def _migrate_constitution_files_to_db():
    """One-time import of any generated cap-*-proposed.md files from disk into
    the database. Safe to run repeatedly; existing DB entries are not touched."""
    if not CONSTITUTION_DIR.exists():
        return
    from database import SessionLocal
    db = SessionLocal()
    try:
        for f in CONSTITUTION_DIR.iterdir():
            if f.suffix == ".md" and f.name.startswith("cap-"):
                exists = db.query(ConstitutionDoc).filter(
                    ConstitutionDoc.filename == f.name).first()
                if not exists:
                    db.add(ConstitutionDoc(filename=f.name,
                                           content=f.read_text(encoding="utf-8")))
        db.commit()
    finally:
        db.close()


_migrate_constitution_files_to_db()


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


# Bump this string whenever the User Agreement text changes so users re-accept.
ALPHA_AGREEMENT_VERSION = "alpha-2026-07"


def has_accepted_alpha(stake_address: str, db: Session) -> bool:
    return db.query(AlphaAgreement).filter(
        AlphaAgreement.stake_address == stake_address,
        AlphaAgreement.version == ALPHA_AGREEMENT_VERSION,
    ).first() is not None


# ── Serialisers ───────────────────────────────────────────────────────────────

def to_iso(dt):
    """Serialise a datetime as UTC ISO-8601 with an explicit offset. Timestamps
    are always stored in UTC, but SQLite strips tzinfo on read-back, so a naive
    value would serialise without a zone and be parsed as local time by the
    browser. Treat naive values as UTC so clients always get an unambiguous time."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

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
        "comments": sum(1 for c in p.comments if c.moderation_status == "visible"),
        "moderation_status": p.moderation_status,
        "withdrawal_requested_by": p.withdrawal_requested_by,
        "withdrawal_requested_by_name": p.withdrawal_requested_by_name,
        "created_at": to_iso(p.created_at),
        "updated_at": to_iso(p.updated_at),
    }


def comment_to_dict(c: Comment) -> dict:
    return {
        "id": c.id,
        "proposal_number": c.proposal_number,
        "body": c.body,
        "author_stake_address": c.author_stake_address,
        "author_display_name": c.author_display_name,
        "created_at": to_iso(c.created_at),
        "updated_at": to_iso(c.updated_at),
        "moderation_status": c.moderation_status,
    }


def notify(db: Session, recipient: str, ntype: str, title: str,
           body: str = None, proposal_number: int = None):
    """Queue an in-app notification (no-op for an empty recipient)."""
    if not recipient:
        return
    db.add(Notification(recipient_stake_address=recipient, type=ntype,
                        title=title, body=body, proposal_number=proposal_number))


def admin_stakes(db: Session) -> list[str]:
    return [a.stake_address for a in db.query(Admin).all()]


def cap_ref(db: Session, number: int) -> str:
    """A human reference to a proposal for notification text, e.g.
    'CAP #12 "Clarify Quorum Threshold"'."""
    p = db.query(Proposal).filter(Proposal.number == number).first()
    return f'CAP #{number} "{p.title}"' if p and p.title else f'CAP #{number}'


def audit_to_dict(e: AuditEvent) -> dict:
    return {
        "id": e.id,
        "proposal_number": e.proposal_number,
        "event_type": e.event_type,
        "actor_stake_address": e.actor_stake_address,
        "actor_display_name": e.actor_display_name,
        "data": json.loads(e.data) if e.data else None,
        "created_at": to_iso(e.created_at),
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
    stake_address: str = Field(max_length=200)
    challenge: str = Field(max_length=200)
    signature: str = Field(max_length=20_000)
    key: str = Field(max_length=20_000)
    display_name: Optional[str] = Field(default=None, max_length=MAX_NAME)


@app.post("/auth/verify", tags=["auth"], summary="Verify wallet signature and receive JWT",
          description="Submit the CIP-30 `signData` result to obtain a Bearer token. Tokens expire after 24 hours.")
@limiter.limit("10/minute")
def verify_auth(request: Request, req: VerifyRequest, db: Session = Depends(get_db)):
    # Check challenge exists and is fresh
    record = db.query(AuthChallenge).filter(AuthChallenge.challenge == req.challenge).first()
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired challenge")

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    created_at = record.created_at
    # SQLite drops tzinfo on read-back even for DateTime(timezone=True) columns
    # (Postgres preserves it); the column is always written in UTC, so treat a
    # naive value as UTC rather than raising on this naive/aware comparison.
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if created_at < cutoff:
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=400, detail="Challenge expired")

    # Verify CIP-8 signature and get the public key that actually signed
    pub_key = verify_cip8_signature(req.signature, req.key, req.challenge)
    if not pub_key:
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Bind the key to the claimed identity: the stake address is derived from
    # the staking key (blake2b-224), so the signer can only ever authenticate
    # as the one address their key hashes to. Without this check anyone could
    # sign with their own key and claim an arbitrary stake address.
    if req.stake_address not in derive_stake_addresses(pub_key):
        raise HTTPException(status_code=401, detail="Signature key does not match the stake address")

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
        "alpha_agreed": has_accepted_alpha(req.stake_address, db),
    }


@app.get("/auth/me", tags=["auth"], summary="Get current user profile",
         description="Returns the authenticated user's stake address, display name, and roles.")
def get_me(user: dict = Depends(require_user), db: Session = Depends(get_db)):
    return {
        "stake_address": user["sub"],
        "display_name": user.get("display_name"),
        "is_editor": is_editor(user["sub"], db),
        "is_admin": is_admin(user["sub"], db),
        "alpha_agreed": has_accepted_alpha(user["sub"], db),
    }


class SetNameRequest(BaseModel):
    display_name: str = Field(max_length=MAX_NAME)


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
        "alpha_agreed": has_accepted_alpha(user["sub"], db),
    }


class UpdateProfileRequest(BaseModel):
    display_name: str = Field(max_length=MAX_NAME)


@app.patch("/auth/profile", tags=["auth"], summary="Update display name")
def update_profile(req: UpdateProfileRequest, user: dict = Depends(require_user), db: Session = Depends(get_db)):
    name = req.display_name.strip()[:40] or None
    stake = user["sub"]

    if name:
        clash = db.query(User).filter(User.display_name == name, User.stake_address != stake).first()
        if clash:
            raise HTTPException(status_code=409, detail="That username is already taken")

    user_record = db.query(User).filter(User.stake_address == stake).first()
    if user_record:
        user_record.display_name = name
    else:
        db.add(User(stake_address=stake, display_name=name))

    # Propagate name to all authored content
    db.query(Proposal).filter(Proposal.author_stake_address == stake).update({"author_display_name": name})
    db.query(Comment).filter(Comment.author_stake_address == stake).update({"author_display_name": name})
    db.query(AuditEvent).filter(AuditEvent.actor_stake_address == stake).update({"actor_display_name": name})

    db.commit()
    token = create_token(stake, name)
    return {
        "token": token,
        "stake_address": stake,
        "display_name": name,
        "is_editor": is_editor(stake, db),
        "is_admin": is_admin(stake, db),
        "alpha_agreed": has_accepted_alpha(stake, db),
    }


# ── Alpha User Agreement ───────────────────────────────────────────────────────

@app.get("/alpha-agreement/status", tags=["auth"], summary="Whether the user has accepted the current agreement",
         description="**Requires authentication.**")
def alpha_agreement_status(user: dict = Depends(require_user), db: Session = Depends(get_db)):
    return {"accepted": has_accepted_alpha(user["sub"], db), "version": ALPHA_AGREEMENT_VERSION}


@app.post("/alpha-agreement/accept", status_code=201, tags=["auth"],
          summary="Record acceptance of the alpha User Agreement",
          description="Stores a server-side record (stake address, version, timestamp) that the user accepted "
                      "the current alpha User Agreement. Idempotent. **Requires authentication.**")
def accept_alpha_agreement(user: dict = Depends(require_user), db: Session = Depends(get_db)):
    if not has_accepted_alpha(user["sub"], db):
        db.add(AlphaAgreement(stake_address=user["sub"], display_name=user.get("display_name"),
                              version=ALPHA_AGREEMENT_VERSION))
        db.commit()
    return {"accepted": True, "version": ALPHA_AGREEMENT_VERSION}


# ── Proposals ─────────────────────────────────────────────────────────────────

@app.get("/health", tags=["meta"], summary="Health check / keep-alive ping")
def health_check():
    return {"status": "ok"}


def _viewer_is_admin(authorization: Optional[str], db: Session) -> bool:
    """True when the request carries a valid admin token. Used to decide whether
    hidden (under-review / removed) content is visible to the caller."""
    user = get_current_user(authorization)
    return bool(user and is_admin(user["sub"], db))


@app.get("/proposals", tags=["proposals"], summary="List all proposals",
         description="Returns all proposals ordered by number descending. Content that is under review or "
                     "removed is hidden from everyone except admins. **Public.**")
def list_proposals(state: Optional[str] = None, authorization: Optional[str] = Header(None),
                   db: Session = Depends(get_db)):
    q = db.query(Proposal)
    if state:
        q = q.filter(Proposal.state == state)
    if not _viewer_is_admin(authorization, db):
        q = q.filter(Proposal.moderation_status == "visible")
    proposals = q.order_by(Proposal.number.desc()).all()
    return [proposal_to_dict(p) for p in proposals]


@app.get("/proposals/{number}", tags=["proposals"], summary="Get a single proposal",
         description="Returns the full proposal. A proposal that is under review or removed is only visible "
                     "to admins. **Public.**")
def get_proposal(number: int, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.number == number).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if p.moderation_status != "visible" and not _viewer_is_admin(authorization, db):
        raise HTTPException(status_code=404, detail="Proposal not found")
    return proposal_to_dict(p)


class ProposalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=MAX_TITLE)
    type: str = "CAP"
    structured: dict  # required — all content lives here

    @field_validator("structured")
    @classmethod
    def _v_structured(cls, v):
        return _validate_structured(v)


@app.post("/proposals", status_code=201, tags=["proposals"], summary="Submit a new proposal",
          description="Creates a new proposal. The `consultation` lifecycle label is automatically applied. **Requires authentication.**")
@limiter.limit("10/minute")
def create_proposal(request: Request, req: ProposalCreate, user: dict = Depends(require_user),
                    db: Session = Depends(get_db)):
    # The proposal number is max+1 computed here, so two concurrent submissions
    # can pick the same number and collide on the unique constraint. Retry on
    # that specific failure instead of returning a 500.
    from sqlalchemy.exc import IntegrityError
    for _attempt in range(5):
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
        try:
            db.commit()
            break
        except IntegrityError:
            db.rollback()  # someone else took this number — recompute and retry
    else:
        raise HTTPException(status_code=503, detail="Could not allocate a proposal number, please retry")

    db.refresh(p)
    db.add(Label(proposal_number=p.number, name="consultation"))
    record_audit(db, p.number, "proposal_created", user, {"title": req.title, "type": req.type})
    create_version(db, p, user, "Initial submission")
    db.commit()
    return proposal_to_dict(p)


class ProposalUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=MAX_TITLE)
    structured: Optional[dict] = None

    @field_validator("structured")
    @classmethod
    def _v_structured(cls, v):
        return _validate_structured(v) if v is not None else v


@app.patch("/proposals/{number}", tags=["proposals"], summary="Update a proposal",
           description="Update title and/or structured content. Only the proposal author can edit. Edits are blocked once the proposal reaches `ready`, `done`, or `withdrawn`. A new version is created on every save. **Requires authentication.**")
def update_proposal(number: int, req: ProposalUpdate, user: dict = Depends(require_user),
                    db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.number == number).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    # Author-only by design: editors influence a proposal through the suggestion
    # workflow (suggest → author approves), never by silently rewriting it. The
    # UI reflects this — only the author sees the edit control.
    if p.author_stake_address != user["sub"]:
        raise HTTPException(status_code=403, detail="Only the proposal author can edit this proposal")

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

    # Nothing supplied to change — don't touch updated_at, don't log an edit,
    # don't create a spurious version.
    if not parts:
        return proposal_to_dict(p)

    p.updated_at = datetime.now(timezone.utc)
    record_audit(db, number, "proposal_edited", user, changes)
    create_version(db, p, user, ", ".join(parts))
    db.commit()
    db.refresh(p)
    return proposal_to_dict(p)


# ── Labels ─────────────────────────────────────────────────────────────────────

LIFECYCLE_LABELS = {"consultation", "ready", "done", "withdrawn"}
CATEGORY_LABELS = {"Procedural", "Substantive", "Technical", "Interpretive", "Editorial", "Other"}
AUTHOR_LABELS = {"author-ready", "CAP", "CIS"} | CATEGORY_LABELS


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

    # Withdrawal is guarded by a two-person rule and must go through the dedicated
    # endpoint, never the generic label route.
    if name == "withdrawn":
        raise HTTPException(status_code=400, detail="Use POST /proposals/{number}/withdraw to withdraw a proposal")

    # Editors can set any label; the proposal's own author can set author-only labels on it.
    editor = is_editor(user["sub"], db)
    is_author = p.author_stake_address == user["sub"]
    if not editor and not (is_author and name in AUTHOR_LABELS):
        raise HTTPException(status_code=403, detail="Editors only")

    # Remove conflicting lifecycle labels if adding a new lifecycle label.
    # ("withdrawn" never reaches here — it's rejected above and set only via the
    # dedicated withdraw endpoint.)
    if name in LIFECYCLE_LABELS:
        db.query(Label).filter(
            Label.proposal_number == number,
            Label.name.in_(LIFECYCLE_LABELS | {"author-ready"})
        ).delete(synchronize_session=False)
        p.state = "closed" if name == "done" else "open"

    existing = db.query(Label).filter(Label.proposal_number == number, Label.name == name).first()
    if not existing:
        db.add(Label(proposal_number=number, name=name))
        record_audit(db, number, "label_added", user, {"label": name})

    db.commit()
    db.refresh(p)
    return proposal_to_dict(p)


@app.delete("/proposals/{number}/labels/{name}", tags=["labels"], summary="Remove a label",
            description="**Requires editor role.**")
def remove_label(number: int, name: str, user: dict = Depends(require_user),
                 db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.number == number).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    # "withdrawn" is a terminal state, not a free-standing label: removing it here
    # would leave the proposal state="closed" with no lifecycle label (inconsistent).
    # Reopening a withdrawal isn't a supported operation.
    if name == "withdrawn":
        raise HTTPException(status_code=400, detail="A withdrawn proposal cannot be reopened by removing the label")

    editor = is_editor(user["sub"], db)
    is_author = p.author_stake_address == user["sub"]
    if not editor and not (is_author and name in AUTHOR_LABELS):
        raise HTTPException(status_code=403, detail="Editors only")

    removed = db.query(Label).filter(Label.proposal_number == number, Label.name == name).delete()
    if removed:
        record_audit(db, number, "label_removed", user, {"label": name})
    db.commit()
    db.refresh(p)
    return proposal_to_dict(p)


# ── Withdrawal ──────────────────────────────────────────────────────────────────

def _apply_withdrawn(db: Session, p: Proposal):
    """Finalise a withdrawal: clear lifecycle/author-ready labels, mark withdrawn,
    close the proposal, and clear any pending withdrawal request."""
    to_remove = LIFECYCLE_LABELS | {"author-ready"}
    for lbl in list(p.labels):  # p.labels is already loaded; delete via ORM to keep session in sync
        if lbl.name in to_remove:
            db.delete(lbl)
    db.add(Label(proposal_number=p.number, name="withdrawn"))
    p.state = "closed"
    p.withdrawal_requested_by = None
    p.withdrawal_requested_by_name = None


@app.post("/proposals/{number}/withdraw", tags=["proposals"], summary="Withdraw a proposal",
          description="Withdraw (permanently close) a proposal. The author may withdraw their own "
                      "proposal directly. An editor withdrawing someone else's proposal is subject to a "
                      "two-person rule: the first editor's call records a pending withdrawal request, and a "
                      "second, different editor must call this endpoint again to finalise it. The same editor "
                      "cannot confirm their own request. **Requires authentication.**")
def withdraw_proposal(number: int, user: dict = Depends(require_user),
                      db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.number == number).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if any(l.name == "withdrawn" for l in p.labels):
        raise HTTPException(status_code=409, detail="Proposal is already withdrawn")

    is_author = p.author_stake_address == user["sub"]
    editor = is_editor(user["sub"], db)
    if not is_author and not editor:
        raise HTTPException(status_code=403, detail="Only the author or an editor can withdraw this proposal")

    # The author can withdraw their own proposal directly.
    if is_author:
        _apply_withdrawn(db, p)
        record_audit(db, number, "withdrawn", user, {"by": "author"})
        db.commit()
        db.refresh(p)
        return proposal_to_dict(p)

    # Editor withdrawing someone else's proposal — two-person rule.
    requester = p.withdrawal_requested_by
    if not requester:
        # First editor records a pending request.
        p.withdrawal_requested_by = user["sub"]
        p.withdrawal_requested_by_name = user.get("display_name")
        record_audit(db, number, "withdrawal_requested", user)
        db.commit()
        db.refresh(p)
        return proposal_to_dict(p)

    if requester == user["sub"]:
        # An editor cannot confirm their own request.
        raise HTTPException(status_code=409,
                            detail="A second, different editor must confirm this withdrawal")

    # A different editor confirms — finalise.
    record_audit(db, number, "withdrawn", user, {
        "by": "editor",
        "requested_by": requester,
        "requested_by_name": p.withdrawal_requested_by_name,
    })
    _apply_withdrawn(db, p)
    db.commit()
    db.refresh(p)
    return proposal_to_dict(p)


@app.post("/proposals/{number}/withdraw/cancel", tags=["proposals"],
          summary="Cancel a pending withdrawal request",
          description="Cancel a pending editor-initiated withdrawal request (two-person rule). "
                      "Any editor or the proposal author may cancel. **Requires authentication.**")
def cancel_withdrawal(number: int, user: dict = Depends(require_user),
                      db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.number == number).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if not p.withdrawal_requested_by:
        raise HTTPException(status_code=409, detail="No pending withdrawal request")

    is_author = p.author_stake_address == user["sub"]
    if not is_author and not is_editor(user["sub"], db):
        raise HTTPException(status_code=403, detail="Only the author or an editor can cancel a withdrawal request")

    record_audit(db, number, "withdrawal_cancelled", user, {"requested_by": p.withdrawal_requested_by})
    p.withdrawal_requested_by = None
    p.withdrawal_requested_by_name = None
    db.commit()
    db.refresh(p)
    return proposal_to_dict(p)


# ── Comments ───────────────────────────────────────────────────────────────────

@app.get("/proposals/{number}/comments", tags=["comments"], summary="List comments on a proposal",
         description="Returns comments ordered by creation time. Comments under review or removed are hidden "
                     "from everyone except admins. **Public.**")
def list_comments(number: int, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    q = db.query(Comment).filter(Comment.proposal_number == number)
    if not _viewer_is_admin(authorization, db):
        q = q.filter(Comment.moderation_status == "visible")
    comments = q.order_by(Comment.created_at.asc()).all()
    return [comment_to_dict(c) for c in comments]


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=MAX_LONG_TEXT)


@app.post("/proposals/{number}/comments", status_code=201, tags=["comments"], summary="Post a comment",
          description="**Requires authentication.** Comments are attributed to the authenticated wallet address.")
@limiter.limit("20/minute")
def create_comment(request: Request, number: int, req: CommentCreate, user: dict = Depends(require_user),
                   db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.number == number).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    # A hidden (under-review / removed) proposal is invisible to everyone but
    # admins, so no one else may keep commenting on it either.
    if p.moderation_status != "visible" and not is_admin(user["sub"], db):
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
    record_audit(db, c.proposal_number, "comment_edited", user, {"comment_id": comment_id})
    db.commit()
    db.refresh(c)
    return comment_to_dict(c)


# ── Moderation: flag for removal → admin decides ───────────────────────────────
#
# An editor or admin flags a proposal/comment for removal with a required reason.
# The item is hidden (not deleted) and a moderation case opens. Admins are
# notified; the author is told their content is under review. An admin then
# removes it (stays hidden, admin-only) or rejects the request (item restored),
# each with a required reason. The author and the flagging editor are notified.

class FlagRequest(BaseModel):
    reason: str = Field(max_length=MAX_REASON)


class ResolveRequest(BaseModel):
    reason: str = Field(max_length=MAX_REASON)


def _require_reason(reason: str) -> str:
    r = (reason or "").strip()
    if not r:
        raise HTTPException(status_code=400, detail="A written reason is required")
    return r


def _actor_name(user: dict) -> str:
    return user.get("display_name") or "an editor"


@app.post("/proposals/{number}/flag", tags=["moderation"], summary="Flag a proposal for removal",
          description="Hides the proposal and opens a moderation case for an admin to review. A written "
                      "reason is required. **Requires editor or admin role.**")
def flag_proposal(number: int, req: FlagRequest, user: dict = Depends(require_editor_or_admin),
                  db: Session = Depends(get_db)):
    reason = _require_reason(req.reason)
    p = db.query(Proposal).filter(Proposal.number == number).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if p.moderation_status != "visible":
        raise HTTPException(status_code=409, detail="This proposal is already under review or removed")

    p.moderation_status = "under_review"
    case = ModerationCase(target_type="proposal", proposal_number=number,
                          flagged_by=user["sub"], flagged_by_name=user.get("display_name"),
                          flag_reason=reason)
    db.add(case)
    record_audit(db, number, "flagged_for_removal", user, {"target": "proposal", "reason": reason})
    for a in admin_stakes(db):
        notify(db, a, "flag_pending", "A proposal was flagged for removal",
               f"CAP #{number} “{p.title}” was flagged by {_actor_name(user)}.\n\nReason: {reason}", number)
    notify(db, p.author_stake_address, "under_review", "Your proposal is under review",
           f"Your proposal “{p.title}” may be in violation of the Terms of Use and is being reviewed by an admin.",
           number)
    db.commit()
    db.refresh(p)
    return proposal_to_dict(p)


@app.post("/comments/{comment_id}/flag", tags=["moderation"], summary="Flag a comment for removal",
          description="Hides the comment and opens a moderation case for an admin to review. A written "
                      "reason is required. **Requires editor or admin role.**")
def flag_comment(comment_id: int, req: FlagRequest, user: dict = Depends(require_editor_or_admin),
                 db: Session = Depends(get_db)):
    reason = _require_reason(req.reason)
    c = db.query(Comment).filter(Comment.id == comment_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Comment not found")
    if c.moderation_status != "visible":
        raise HTTPException(status_code=409, detail="This comment is already under review or removed")

    c.moderation_status = "under_review"
    case = ModerationCase(target_type="comment", proposal_number=c.proposal_number, comment_id=comment_id,
                          flagged_by=user["sub"], flagged_by_name=user.get("display_name"),
                          flag_reason=reason)
    db.add(case)
    record_audit(db, c.proposal_number, "flagged_for_removal", user, {"target": "comment", "comment_id": comment_id, "reason": reason})
    ref = cap_ref(db, c.proposal_number)
    for a in admin_stakes(db):
        notify(db, a, "flag_pending", "A comment was flagged for removal",
               f"A comment on {ref} was flagged by {_actor_name(user)}.\n\nReason: {reason}",
               c.proposal_number)
    notify(db, c.author_stake_address, "under_review", "Your comment is under review",
           f"Your comment on {ref} may be in violation of the Terms of Use and is being reviewed by an admin.",
           c.proposal_number)
    db.commit()
    db.refresh(c)
    return comment_to_dict(c)


def _case_target(db: Session, case: ModerationCase):
    if case.target_type == "comment":
        return db.query(Comment).filter(Comment.id == case.comment_id).first()
    return db.query(Proposal).filter(Proposal.number == case.proposal_number).first()


def _case_to_dict(db: Session, case: ModerationCase) -> dict:
    target = _case_target(db, case)
    d = {
        "id": case.id,
        "target_type": case.target_type,
        "proposal_number": case.proposal_number,
        "comment_id": case.comment_id,
        "status": case.status,
        "flagged_by": case.flagged_by,
        "flagged_by_name": case.flagged_by_name,
        "flag_reason": case.flag_reason,
        "created_at": to_iso(case.created_at),
        "resolved_by_name": case.resolved_by_name,
        "resolution_reason": case.resolution_reason,
        "resolved_at": to_iso(case.resolved_at),
        "target_exists": target is not None,
    }
    if case.target_type == "comment":
        d["target_preview"] = (target.body[:400] if target else None)
        d["target_author"] = (target.author_display_name or target.author_stake_address) if target else None
    else:
        d["target_title"] = target.title if target else None
        d["target_author"] = (target.author_display_name or target.author_stake_address) if target else None
    return d


@app.get("/moderation/cases", tags=["moderation"], summary="List moderation cases",
         description="Returns removal requests. Filter by `status` (open, removed, rejected, all). **Requires admin role.**")
def list_moderation_cases(status: Optional[str] = "open", user: dict = Depends(require_admin),
                          db: Session = Depends(get_db)):
    q = db.query(ModerationCase)
    if status and status != "all":
        q = q.filter(ModerationCase.status == status)
    cases = q.order_by(ModerationCase.created_at.desc()).all()
    return [_case_to_dict(db, c) for c in cases]


def _resolve_case(db: Session, case_id: int, decision: str, reason: str, user: dict) -> dict:
    case = db.query(ModerationCase).filter(ModerationCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Moderation case not found")
    if case.status != "open":
        raise HTTPException(status_code=409, detail="This case has already been resolved")

    target = _case_target(db, case)
    if not target:
        raise HTTPException(status_code=404, detail="The flagged content no longer exists")

    new_status = "removed" if decision == "remove" else "visible"
    target.moderation_status = new_status
    case.status = "removed" if decision == "remove" else "rejected"
    case.resolved_by = user["sub"]
    case.resolved_by_name = user.get("display_name")
    case.resolution_reason = reason
    case.resolved_at = datetime.now(timezone.utc)

    kind = "comment" if case.target_type == "comment" else "proposal"
    author = target.author_stake_address
    pnum = case.proposal_number
    ref = cap_ref(db, pnum)
    record_audit(db, pnum, "moderation_" + case.status, user,
                 {"target": kind, "comment_id": case.comment_id, "reason": reason})

    if decision == "remove":
        notify(db, author, "removed", f"Your {kind} was removed",
               f"After review, an admin removed your {kind} on {ref} for violating the Terms of Use.\n\nReason: {reason}", pnum)
        notify(db, case.flagged_by, "removed", f"A flagged {kind} was removed",
               f"The {kind} you flagged on {ref} was reviewed and removed.\n\nAdmin reason: {reason}", pnum)
    else:
        notify(db, author, "reinstated", f"Your {kind} was restored",
               f"After review, an admin restored your {kind} on {ref}. It is visible again.\n\nReason: {reason}", pnum)
        notify(db, case.flagged_by, "reinstated", f"A flagged {kind} was restored",
               f"The {kind} you flagged on {ref} was reviewed and kept (removal rejected).\n\nAdmin reason: {reason}", pnum)

    db.commit()
    return _case_to_dict(db, case)


@app.post("/moderation/cases/{case_id}/remove", tags=["moderation"], summary="Remove flagged content",
          description="Confirms removal: the content stays hidden (admin-only) and is not deleted. A written "
                      "reason is required. Notifies the author and the flagging editor. **Requires admin role.**")
def moderation_remove(case_id: int, req: ResolveRequest, user: dict = Depends(require_admin),
                      db: Session = Depends(get_db)):
    return _resolve_case(db, case_id, "remove", _require_reason(req.reason), user)


@app.post("/moderation/cases/{case_id}/reject", tags=["moderation"], summary="Reject a removal request",
          description="Rejects removal: the content becomes visible again. A written reason is required. "
                      "Notifies the author and the flagging editor. **Requires admin role.**")
def moderation_reject(case_id: int, req: ResolveRequest, user: dict = Depends(require_admin),
                      db: Session = Depends(get_db)):
    return _resolve_case(db, case_id, "reject", _require_reason(req.reason), user)


# ── Notifications ──────────────────────────────────────────────────────────────

def notification_to_dict(n: Notification) -> dict:
    return {
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "body": n.body,
        "proposal_number": n.proposal_number,
        "read": n.read,
        "created_at": to_iso(n.created_at),
    }


@app.get("/notifications", tags=["notifications"], summary="List my notifications",
         description="Returns the authenticated user's notifications, newest first. **Requires authentication.**")
def list_notifications(user: dict = Depends(require_user), db: Session = Depends(get_db)):
    rows = db.query(Notification).filter(Notification.recipient_stake_address == user["sub"])\
        .order_by(Notification.created_at.desc()).limit(100).all()
    return [notification_to_dict(n) for n in rows]


@app.get("/notifications/unread-count", tags=["notifications"], summary="Count unread notifications",
         description="**Requires authentication.**")
def unread_notification_count(user: dict = Depends(require_user), db: Session = Depends(get_db)):
    n = db.query(Notification).filter(
        Notification.recipient_stake_address == user["sub"], Notification.read == False).count()  # noqa: E712
    return {"count": n}


@app.post("/notifications/{notif_id}/read", tags=["notifications"], summary="Mark a notification read",
          description="**Requires authentication.**")
def mark_notification_read(notif_id: int, user: dict = Depends(require_user), db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notif_id,
                                      Notification.recipient_stake_address == user["sub"]).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.read = True
    db.commit()
    return {"ok": True}


@app.post("/notifications/read-all", tags=["notifications"], summary="Mark all notifications read",
          description="**Requires authentication.**")
def mark_all_notifications_read(user: dict = Depends(require_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.recipient_stake_address == user["sub"],
                                  Notification.read == False).update({"read": True})  # noqa: E712
    db.commit()
    return {"ok": True}


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
def list_constitution(db: Session = Depends(get_db)):
    # Base constitution versions ship with the repo on disk; generated
    # proposed drafts live in the database (survives ephemeral filesystems).
    import re
    base = set()
    if CONSTITUTION_DIR.exists():
        base.update(f.name for f in CONSTITUTION_DIR.iterdir()
                    if f.suffix == ".md" and not f.name.startswith("cap-"))
    drafts = {d.filename for d in db.query(ConstitutionDoc.filename).all()}

    # Deterministic order independent of filename lexicography: the current base
    # constitution(s) first, then proposed drafts by CAP number descending. (A
    # plain reverse sort would place "cap-2" before "cap-10" and could rank a
    # future base filename below a draft.)
    def cap_num(f):
        m = re.match(r"cap-(\d+)-proposed", f)
        return int(m.group(1)) if m else -1

    ordered = sorted(base, reverse=True) + sorted(drafts, key=cap_num, reverse=True)

    def display_name(f):
        m = re.match(r"cap-(\d+)-proposed", f.replace(".md", ""))
        return f"CAP-{m.group(1)} Proposed Draft" if m else f.replace(".md", "")
    return [{"filename": f, "display_name": display_name(f)} for f in ordered]


@app.get("/constitution/{filename}", tags=["constitution"], summary="Get constitution document content",
         description="Returns the raw markdown content of a specific constitution version. **Public.**")
def get_constitution(filename: str, db: Session = Depends(get_db)):
    # Sanitise — only allow filenames, no path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    doc = db.query(ConstitutionDoc).filter(ConstitutionDoc.filename == filename).first()
    if doc:
        return {"filename": filename, "content": doc.content}
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
    doc = db.query(ConstitutionDoc).filter(ConstitutionDoc.filename == filename).first()
    if doc:
        doc.content = modified
    else:
        db.add(ConstitutionDoc(filename=filename, content=modified))
    db.commit()

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
        "created_at": to_iso(v.created_at),
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
        "created_at": to_iso(s.created_at),
        "resolved_at": to_iso(s.resolved_at),
        "resolved_by": s.resolved_by,
    }


@app.get("/proposals/{number}/suggestions", tags=["suggestions"], summary="List suggestions on a proposal",
         description="Returns all editor suggestions with their status (`pending`, `approved`, `rejected`). **Public.**")
def list_suggestions(number: int, db: Session = Depends(get_db)):
    return [suggestion_to_dict(s) for s in
            db.query(Suggestion).filter(Suggestion.proposal_number == number)
            .order_by(Suggestion.created_at.desc()).all()]


class SuggestionCreate(BaseModel):
    field: str = Field(max_length=100)
    suggested_value: str = Field(max_length=MAX_LONG_TEXT)
    reason: Optional[str] = Field(default=None, max_length=MAX_REASON)


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
    return suggestion_to_dict(s)


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
    title: str = Field(min_length=1, max_length=MAX_TITLE)
    content: str = Field(max_length=MAX_GUIDE_CONTENT)  # markdown
    section: str = Field(default='general', max_length=100)
    section_label: Optional[str] = Field(default=None, max_length=MAX_TITLE)
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
        "updated_at": to_iso(guide.updated_at),
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
    return {"slug": guide.slug, "title": guide.title, "updated_at": to_iso(guide.updated_at)}

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
    title: str = Field(min_length=1, max_length=MAX_TITLE)
    description: str = Field(max_length=MAX_LONG_TEXT)
    screenshot: Optional[str] = Field(default=None, max_length=MAX_SCREENSHOT)  # base64 data URL
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
            "created_at": to_iso(report.created_at)}

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
             "created_at": to_iso(r.created_at),
             "updated_at": to_iso(r.updated_at)} for r in reports]

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
