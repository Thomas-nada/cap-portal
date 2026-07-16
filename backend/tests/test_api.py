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


def seed_user(db, stake, name):
    from models import User
    db.add(User(stake_address=stake, display_name=name))
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


def test_launch_guides_hide_unreviewed_content(client, db):
    from models import Guide

    db.add_all([
        Guide(slug="getting-started", title="Getting Started", content="Reviewed",
              section="getting-started", section_label="Getting Started", sort_order=0),
        Guide(slug="common-mistakes", title="Common Mistakes", content="Draft",
              section="writing-caps", section_label="Writing CAPs", sort_order=0),
    ])
    db.commit()

    listed = client.get("/guides")
    assert listed.status_code == 200
    assert [guide["slug"] for guide in listed.json()] == ["getting-started"]
    assert client.get("/guides/getting-started").status_code == 200
    assert client.get("/guides/common-mistakes").status_code == 404


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


def test_admin_can_reset_all_proposals(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_admin(db)
    client.post("/proposals", json=proposal_body("P1"), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals", json=proposal_body("P2"), headers=auth(AUTHOR_ADDR, "Alice"))

    r = client.post("/admin/reset-proposals", json={"confirm": "RESET"},
                    headers=auth(ADMIN_ADDR, "Admin"))

    assert r.status_code == 200
    assert r.json() == {"ok": True, "deleted_proposals": 2}
    assert client.get("/proposals").json() == []

    created = client.post("/proposals", json=proposal_body("Fresh start"),
                          headers=auth(AUTHOR_ADDR, "Alice"))
    assert created.status_code == 201
    assert created.json()["number"] == 1


def test_reset_proposals_requires_admin(client, db):
    seed_editor(db)
    r = client.post("/admin/reset-proposals", json={"confirm": "RESET"},
                    headers=auth(EDITOR_ADDR, "Editor"))
    assert r.status_code == 403


def test_reset_proposals_requires_exact_confirmation(client, db):
    seed_admin(db)
    r = client.post("/admin/reset-proposals", json={"confirm": "reset"},
                    headers=auth(ADMIN_ADDR, "Admin"))
    assert r.status_code == 400


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


def test_withdrawn_label_cannot_be_removed(client, db):
    """Removing the withdrawn label via the generic route is rejected — a
    withdrawn proposal can't be silently reopened (finding #11)."""
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals/1/withdraw", headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.delete("/proposals/1/labels/withdrawn", headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 400
    assert "withdrawn" in [l["name"] for l in client.get("/proposals/1").json()["labels"]]


def test_editor_cannot_directly_edit_proposal(client, db):
    """Editors influence proposals via suggestions, not direct edits (finding #12)."""
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.patch("/proposals/1",
                     json={"title": "Editor rewrite", "structured": {}},
                     headers=auth(EDITOR_ADDR))
    assert r.status_code == 403


def test_noop_update_creates_no_version(client, db):
    """A PATCH with no fields must not create a spurious version (finding #10)."""
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    client.patch("/proposals/1", json={}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert len(client.get("/proposals/1/versions").json()) == 1


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


# ── Rate limiting: per-client-IP keying behind a proxy (finding #4) ───────────

def test_client_ip_uses_last_forwarded_for():
    """The rate-limit key must be the real client IP (rightmost X-Forwarded-For
    entry appended by Render's proxy), not the proxy socket address."""
    from main import client_ip

    class _Req:
        def __init__(self, xff, peer):
            self.headers = {"x-forwarded-for": xff} if xff else {}
            self.client = type("C", (), {"host": peer})()

    # Client-forged header ("1.1.1.1") followed by the real IP appended by Render.
    assert client_ip(_Req("1.1.1.1, 203.0.113.9", "10.0.0.1")) == "203.0.113.9"
    # No proxy header → fall back to the socket peer.
    assert client_ip(_Req(None, "198.51.100.5")) == "198.51.100.5"


# ── Input size limits ─────────────────────────────────────────────────────────

def test_long_deliberation_is_allowed(client, db):
    """Limits are roomy — a ~2,800-word section must be accepted."""
    seed_user(db, AUTHOR_ADDR, "Alice")
    long_text = "This is a thorough deliberation. " * 550  # ~18k chars
    r = client.post("/proposals", json=proposal_body(motivation=long_text),
                    headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 201


def test_oversized_input_rejected_with_clean_message(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    # Oversized title
    r = client.post("/proposals", json={"title": "x" * 500, "type": "CAP", "structured": {"abstract": "a"}},
                    headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 400
    assert isinstance(r.json()["detail"], str)  # single readable string, not a nested list
    # Oversized section (over the 20k per-field cap, under the total cap)
    r = client.post("/proposals", json={"title": "ok", "type": "CAP", "structured": {"motivation": "z" * 50_000}},
                    headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 400
    assert "too long" in r.json()["detail"]
    # Oversized proposal overall (each field under 20k, combined over 100k)
    big = {f"extra_{i}": "z" * 19_000 for i in range(6)}
    r = client.post("/proposals", json={"title": "ok", "type": "CAP", "structured": {"abstract": "a", **big}},
                    headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 400
    assert "too large" in r.json()["detail"]


def test_oversized_comment_rejected(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/comments", json={"body": "q" * 120_000}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 400


# ── Alpha User Agreement ──────────────────────────────────────────────────────

def test_alpha_agreement_recorded_server_side(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    h = auth(AUTHOR_ADDR, "Alice")
    assert client.get("/alpha-agreement/status", headers=h).json()["accepted"] is False
    assert client.get("/auth/me", headers=h).json()["alpha_agreed"] is False

    assert client.post("/alpha-agreement/accept", headers=h).status_code == 201
    assert client.get("/alpha-agreement/status", headers=h).json()["accepted"] is True
    assert client.get("/auth/me", headers=h).json()["alpha_agreed"] is True

    # Idempotent — a second accept doesn't create a duplicate record.
    client.post("/alpha-agreement/accept", headers=h)
    from models import AlphaAgreement
    assert db.query(AlphaAgreement).filter(AlphaAgreement.stake_address == AUTHOR_ADDR).count() == 1


def test_alpha_agreement_requires_auth(client):
    assert client.post("/alpha-agreement/accept").status_code == 401


# ── Moderation workflow ───────────────────────────────────────────────────────

def test_flag_requires_reason(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/flag", json={"reason": "   "}, headers=auth(EDITOR_ADDR))
    assert r.status_code == 400


def test_flagged_comment_hidden_from_public_visible_to_admin(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    seed_admin(db)
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    cid = client.post("/proposals/1/comments", json={"body": "flag me"}, headers=auth(AUTHOR_ADDR, "Alice")).json()["id"]
    client.post(f"/comments/{cid}/flag", json={"reason": "spam"}, headers=auth(EDITOR_ADDR))

    assert all(c["id"] != cid for c in client.get("/proposals/1/comments").json())          # public
    assert any(c["id"] == cid for c in client.get("/proposals/1/comments",
               headers=auth(ADMIN_ADDR, "Admin")).json())                                     # admin


def test_flag_notifies_admin_and_author(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    seed_admin(db)
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals/1/flag", json={"reason": "off topic"}, headers=auth(EDITOR_ADDR))

    admin_notifs = client.get("/notifications", headers=auth(ADMIN_ADDR, "Admin")).json()
    author_notifs = client.get("/notifications", headers=auth(AUTHOR_ADDR, "Alice")).json()
    assert any(n["type"] == "flag_pending" for n in admin_notifs)
    assert any(n["type"] == "under_review" for n in author_notifs)


def test_admin_reject_restores_and_notifies(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    seed_admin(db)
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals/1/flag", json={"reason": "maybe bad"}, headers=auth(EDITOR_ADDR))
    case = client.get("/moderation/cases", headers=auth(ADMIN_ADDR, "Admin")).json()[0]

    r = client.post(f"/moderation/cases/{case['id']}/reject", json={"reason": "actually fine"},
                    headers=auth(ADMIN_ADDR, "Admin"))
    assert r.status_code == 200
    assert client.get("/proposals/1").status_code == 200  # visible again to public
    author_notifs = client.get("/notifications", headers=auth(AUTHOR_ADDR, "Alice")).json()
    assert any(n["type"] == "reinstated" for n in author_notifs)


def test_cannot_comment_on_hidden_proposal(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    seed_admin(db)
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals/1/flag", json={"reason": "spam"}, headers=auth(EDITOR_ADDR))
    # Under review → author can no longer comment, but an admin still can.
    assert client.post("/proposals/1/comments", json={"body": "still here?"},
                       headers=auth(AUTHOR_ADDR, "Alice")).status_code == 404
    assert client.post("/proposals/1/comments", json={"body": "admin note"},
                       headers=auth(ADMIN_ADDR, "Admin")).status_code == 201


def test_admin_remove_keeps_hidden_admin_only(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    seed_admin(db)
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals/1/flag", json={"reason": "spam"}, headers=auth(EDITOR_ADDR))
    case = client.get("/moderation/cases", headers=auth(ADMIN_ADDR, "Admin")).json()[0]
    client.post(f"/moderation/cases/{case['id']}/remove", json={"reason": "confirmed"},
                headers=auth(ADMIN_ADDR, "Admin"))

    assert client.get("/proposals/1").status_code == 404                                   # public
    assert client.get("/proposals/1", headers=auth(ADMIN_ADDR, "Admin")).status_code == 200  # admin


def test_resolve_reason_required_and_case_closes(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    seed_admin(db)
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals/1/flag", json={"reason": "x"}, headers=auth(EDITOR_ADDR))
    case = client.get("/moderation/cases", headers=auth(ADMIN_ADDR, "Admin")).json()[0]
    assert client.post(f"/moderation/cases/{case['id']}/remove", json={"reason": " "},
                       headers=auth(ADMIN_ADDR, "Admin")).status_code == 400
    client.post(f"/moderation/cases/{case['id']}/remove", json={"reason": "ok"}, headers=auth(ADMIN_ADDR, "Admin"))
    # second resolution on the same case is a conflict
    assert client.post(f"/moderation/cases/{case['id']}/reject", json={"reason": "no"},
                       headers=auth(ADMIN_ADDR, "Admin")).status_code == 409


def test_non_editor_cannot_flag(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_user(db, EDITOR_ADDR, "Bob")  # plain user, not an editor
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    assert client.post("/proposals/1/flag", json={"reason": "x"}, headers=auth(EDITOR_ADDR, "Bob")).status_code == 403


# ── Auth: stake-address binding (security) ────────────────────────────────────

def _make_signed_login(challenge, claimed_addr):
    """Build a real CIP-8 COSE_Sign1 + COSE_Key for a fresh keypair, returning
    the /auth/verify payload claiming `claimed_addr`."""
    import cbor2
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives import serialization
    priv = Ed25519PrivateKey.generate()
    protected = cbor2.dumps({1: -8})
    payload = challenge.encode()
    signature = priv.sign(cbor2.dumps(["Signature1", protected, b"", payload]))
    cose_sign1 = cbor2.dumps([protected, {}, payload, signature])
    pub = priv.public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    cose_key = cbor2.dumps({1: 1, 3: -8, -1: 6, -2: pub})
    return {
        "stake_address": claimed_addr,
        "challenge": challenge,
        "signature": cose_sign1.hex(),
        "key": cose_key.hex(),
    }, pub


def test_login_rejects_address_not_matching_key(client):
    """A valid signature must not authenticate as an arbitrary stake address —
    the address is bound to the signing key (finding #1)."""
    challenge = client.get("/auth/challenge").json()["challenge"]
    payload, _pub = _make_signed_login(challenge, "stake1uforged00000000000000000000000000000000000000000000")
    r = client.post("/auth/verify", json=payload)
    assert r.status_code == 401


def test_login_accepts_matching_derived_address(client):
    """Signing and claiming the address actually derived from the key succeeds."""
    from auth import derive_stake_addresses
    challenge = client.get("/auth/challenge").json()["challenge"]
    payload, pub = _make_signed_login(challenge, "placeholder")
    real_addr = next(a for a in derive_stake_addresses(pub) if a.startswith("stake1"))
    payload["stake_address"] = real_addr
    r = client.post("/auth/verify", json=payload)
    assert r.status_code == 200
    assert r.json()["stake_address"] == real_addr


# ── Audit trail ───────────────────────────────────────────────────────────────

def test_audit_trail_populated(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.get("/proposals/1/audit")
    assert r.status_code == 200
    events = r.json()
    assert len(events) >= 1
    assert events[0]["event_type"] == "proposal_created"
