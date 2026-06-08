"""
CAP Portal API tests.
Run with: pytest tests/ -v
Uses an in-memory SQLite database — no running server required.
"""
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from auth import create_token
import main  # noqa


# ── Shared in-memory engine (StaticPool = one connection for all tests) ───────

_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Base.metadata.create_all(bind=_engine)
_Session = sessionmaker(bind=_engine, autocommit=False, autoflush=False)


@pytest.fixture(autouse=True)
def clean_tables():
    """Drop and recreate all tables between tests for isolation."""
    Base.metadata.drop_all(bind=_engine)
    Base.metadata.create_all(bind=_engine)
    yield


@pytest.fixture()
def db():
    session = _Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    main.app.dependency_overrides[get_db] = override_get_db
    with TestClient(main.app, raise_server_exceptions=False) as c:
        yield c
    main.app.dependency_overrides.clear()


# ── Stake addresses ───────────────────────────────────────────────────────────

AUTHOR_ADDR = "stake1author000000000000000000000000000000000000000000000"
EDITOR_ADDR = "stake1editor000000000000000000000000000000000000000000000"
ADMIN_ADDR  = "stake1admin0000000000000000000000000000000000000000000000"


def auth(stake, name="Test User"):
    return {"Authorization": f"Bearer {create_token(stake, name)}"}


def seed_user(db, stake, name, email=None):
    from models import User
    db.add(User(stake_address=stake, display_name=name, email=email))
    db.commit()


def seed_editor(db, stake=EDITOR_ADDR, name="Editor"):
    from models import Editor, User
    db.add(User(stake_address=stake, display_name=name))
    db.add(Editor(stake_address=stake, display_name=name))
    db.commit()


def seed_admin(db, stake=ADMIN_ADDR, name="Admin"):
    from models import Admin, User
    db.add(User(stake_address=stake, display_name=name))
    db.add(Admin(stake_address=stake, display_name=name))
    db.commit()


def proposal_body(title="Test Proposal", **kwargs):
    return {
        "title": title,
        "type": "CAP",
        "structured": {
            "abstract": "Test abstract",
            "motivation": "Test motivation",
            "analysis": "Test analysis",
            "impact": "Test impact",
            **kwargs,
        },
    }


# ── Basic ─────────────────────────────────────────────────────────────────────

def test_proposals_empty(client):
    r = client.get("/proposals")
    assert r.status_code == 200
    assert r.json() == []


def test_challenge_issued(client):
    r = client.get("/auth/challenge")
    assert r.status_code == 200
    assert "challenge" in r.json()


# ── Auth ──────────────────────────────────────────────────────────────────────

def test_get_me_unauthenticated(client):
    r = client.get("/auth/me")
    assert r.status_code == 401


def test_get_me_authenticated(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    r = client.get("/auth/me", headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200
    data = r.json()
    assert data["stake_address"] == AUTHOR_ADDR
    assert data["is_editor"] is False
    assert data["is_admin"] is False


def test_update_profile(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    r = client.patch("/auth/profile",
                     json={"display_name": "Alice Updated"},
                     headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200
    assert r.json()["display_name"] == "Alice Updated"


def test_update_profile_duplicate_name(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_user(db, EDITOR_ADDR, "Bob")
    r = client.patch("/auth/profile",
                     json={"display_name": "Bob"},
                     headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 409


# ── Bootstrap ─────────────────────────────────────────────────────────────────

def test_claim_first_editor(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    r = client.post("/editors/bootstrap", headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code in (200, 201)


def test_claim_second_editor_blocked(client, db):
    seed_editor(db)
    seed_user(db, AUTHOR_ADDR, "Alice")
    r = client.post("/editors/bootstrap", headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 403


# ── Proposals ─────────────────────────────────────────────────────────────────

def test_create_proposal(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    r = client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Test Proposal"
    assert data["number"] == 1
    assert any(l["name"] == "consultation" for l in data["labels"])


def test_create_proposal_requires_auth(client):
    r = client.post("/proposals", json=proposal_body())
    assert r.status_code == 401


def test_get_proposal(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body("My CAP"), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.get("/proposals/1")
    assert r.status_code == 200
    assert r.json()["title"] == "My CAP"


def test_get_proposal_not_found(client):
    r = client.get("/proposals/999")
    assert r.status_code == 404


def test_list_proposals(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body("P1"), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals", json=proposal_body("P2"), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.get("/proposals")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_update_proposal_by_author(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.patch("/proposals/1",
                     json={"title": "Updated Title", "structured": {"abstract": "new"}},
                     headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200
    assert r.json()["title"] == "Updated Title"


def test_update_proposal_blocked_for_non_author(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_user(db, EDITOR_ADDR, "Bob")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.patch("/proposals/1",
                     json={"title": "Hijacked", "structured": {}},
                     headers=auth(EDITOR_ADDR, "Bob"))
    assert r.status_code == 403


def test_proposal_locked_at_ready(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals/1/labels", json={"name": "ready"}, headers=auth(EDITOR_ADDR))
    r = client.patch("/proposals/1",
                     json={"title": "Too Late", "structured": {}},
                     headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 403


# ── Labels ────────────────────────────────────────────────────────────────────

def test_add_label_as_editor(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/labels", json={"name": "ready"}, headers=auth(EDITOR_ADDR))
    assert r.status_code == 200


def test_lifecycle_label_clears_author_ready(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals/1/labels", json={"name": "author-ready"}, headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals/1/labels", json={"name": "ready"}, headers=auth(EDITOR_ADDR))
    proposal = client.get("/proposals/1").json()
    label_names = [l["name"] for l in proposal["labels"]]
    assert "author-ready" not in label_names
    assert "ready" in label_names


def test_add_label_blocked_for_regular_user(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/labels", json={"name": "ready"},
                    headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 403


# ── Withdrawal ──────────────────────────────────────────────────────────────────

EDITOR2_ADDR = "stake1editor200000000000000000000000000000000000000000000"


def _labels(proposal):
    return [l["name"] for l in proposal["labels"]]


def test_withdrawn_label_rejected_on_generic_endpoint(client, db):
    """The withdrawn label must not be settable through the generic label route."""
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/labels", json={"name": "withdrawn"}, headers=auth(EDITOR_ADDR))
    assert r.status_code == 400
    assert "withdraw" in r.json()["detail"].lower()


def test_author_can_withdraw_own_proposal_directly(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/withdraw", headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200
    data = r.json()
    assert "withdrawn" in _labels(data)
    assert data["state"] == "closed"


def test_single_editor_cannot_withdraw_unilaterally(client, db):
    """First editor's call only records a pending request — proposal stays open."""
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/withdraw", headers=auth(EDITOR_ADDR))
    assert r.status_code == 200
    data = r.json()
    assert "withdrawn" not in _labels(data)
    assert data["state"] == "open"
    assert data["withdrawal_requested_by"] == EDITOR_ADDR


def test_editor_cannot_confirm_own_withdrawal_request(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals/1/withdraw", headers=auth(EDITOR_ADDR))
    r = client.post("/proposals/1/withdraw", headers=auth(EDITOR_ADDR))
    assert r.status_code == 409
    assert "withdrawn" not in _labels(client.get("/proposals/1").json())


def test_second_editor_confirms_withdrawal(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    seed_editor(db, EDITOR2_ADDR, "Bob")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals/1/withdraw", headers=auth(EDITOR_ADDR))
    r = client.post("/proposals/1/withdraw", headers=auth(EDITOR2_ADDR, "Bob"))
    assert r.status_code == 200
    data = r.json()
    assert "withdrawn" in _labels(data)
    assert data["state"] == "closed"
    assert data["withdrawal_requested_by"] is None


def test_non_editor_non_author_cannot_withdraw(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_user(db, EDITOR2_ADDR, "Stranger")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/withdraw", headers=auth(EDITOR2_ADDR, "Stranger"))
    assert r.status_code == 403


def test_cancel_pending_withdrawal(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    seed_editor(db, EDITOR2_ADDR, "Bob")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals/1/withdraw", headers=auth(EDITOR_ADDR))
    r = client.post("/proposals/1/withdraw/cancel", headers=auth(EDITOR2_ADDR, "Bob"))
    assert r.status_code == 200
    assert r.json()["withdrawal_requested_by"] is None
    # After cancelling, a single editor still cannot withdraw unilaterally.
    r2 = client.post("/proposals/1/withdraw", headers=auth(EDITOR_ADDR))
    assert "withdrawn" not in _labels(r2.json())


def test_withdraw_already_withdrawn_conflicts(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals/1/withdraw", headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/withdraw", headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 409


# ── Comments ──────────────────────────────────────────────────────────────────

def test_create_comment(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/comments",
                    json={"body": "Great proposal!"},
                    headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 201
    assert r.json()["body"] == "Great proposal!"


def test_list_comments(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals/1/comments", json={"body": "First"}, headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals/1/comments", json={"body": "Second"}, headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.get("/proposals/1/comments")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_comment_requires_auth(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/comments", json={"body": "Anonymous"})
    assert r.status_code == 401


# ── Suggestions ───────────────────────────────────────────────────────────────

def test_editor_can_suggest(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/suggestions",
                    json={"field": "title", "suggested_value": "Better Title", "reason": "Clarity"},
                    headers=auth(EDITOR_ADDR))
    assert r.status_code == 201
    assert r.json()["status"] == "pending"


def test_author_approves_suggestion(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    s = client.post("/proposals/1/suggestions",
                    json={"field": "title", "suggested_value": "Better Title", "reason": "Clarity"},
                    headers=auth(EDITOR_ADDR)).json()
    r = client.post(f"/proposals/1/suggestions/{s['id']}/approve",
                    headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200
    assert r.json()["status"] == "approved"


def test_author_rejects_suggestion(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    s = client.post("/proposals/1/suggestions",
                    json={"field": "title", "suggested_value": "Worse Title", "reason": "Nope"},
                    headers=auth(EDITOR_ADDR)).json()
    r = client.post(f"/proposals/1/suggestions/{s['id']}/reject",
                    headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"


def test_non_editor_cannot_suggest(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_user(db, EDITOR_ADDR, "Bob")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/suggestions",
                    json={"field": "title", "suggested_value": "X", "reason": "Y"},
                    headers=auth(EDITOR_ADDR, "Bob"))
    assert r.status_code == 403


# ── Version history & hash chain ──────────────────────────────────────────────

def test_version_created_on_proposal(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.get("/proposals/1/versions")
    assert r.status_code == 200
    versions = r.json()
    assert len(versions) == 1
    assert versions[0]["version"] == 1
    assert versions[0]["content_hash"] is not None


def test_version_increments_on_update(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    client.patch("/proposals/1",
                 json={"title": "Updated", "structured": {"abstract": "new"}},
                 headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.get("/proposals/1/versions")
    assert len(r.json()) == 2


def test_hash_chain_integrity(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    client.patch("/proposals/1",
                 json={"title": "V2", "structured": {"abstract": "v2"}},
                 headers=auth(AUTHOR_ADDR, "Alice"))
    versions = client.get("/proposals/1/versions").json()
    v1 = next(v for v in versions if v["version"] == 1)
    v2 = next(v for v in versions if v["version"] == 2)
    assert v1["previous_hash"] == "genesis"
    assert v2["previous_hash"] == v1["content_hash"]


# ── Editors / Admins ──────────────────────────────────────────────────────────

def test_admin_can_add_editor(client, db):
    seed_admin(db)
    r = client.post("/editors",
                    json={"stake_address": AUTHOR_ADDR, "display_name": "New Editor"},
                    headers=auth(ADMIN_ADDR, "Admin"))
    assert r.status_code in (200, 201)


def test_non_admin_cannot_add_editor(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    r = client.post("/editors",
                    json={"stake_address": EDITOR_ADDR, "display_name": "Sneaky"},
                    headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 403


# ── Audit trail ───────────────────────────────────────────────────────────────

def test_audit_trail_populated(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.get("/proposals/1/audit")
    assert r.status_code == 200
    events = r.json()
    assert len(events) >= 1
    assert events[0]["event_type"] == "proposal_created"
