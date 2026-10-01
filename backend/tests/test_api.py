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

def test_claim_first_editor(client, db, monkeypatch):
    monkeypatch.setenv("BOOTSTRAP_ADMIN_STAKE", AUTHOR_ADDR)
    seed_user(db, AUTHOR_ADDR, "Alice")
    r = client.post("/editors/bootstrap", headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code in (200, 201)


def test_claim_second_editor_blocked(client, db, monkeypatch):
    monkeypatch.setenv("BOOTSTRAP_ADMIN_STAKE", AUTHOR_ADDR)
    seed_editor(db)
    seed_user(db, AUTHOR_ADDR, "Alice")
    r = client.post("/editors/bootstrap", headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 403


# ── WC-08: deployment-controlled bootstrap ────────────────────────────────────

def test_bootstrap_disabled_when_operator_unset(client, db, monkeypatch):
    """Fail-closed: with no configured operator, no one can self-claim admin —
    even against an empty admins table."""
    monkeypatch.delenv("BOOTSTRAP_ADMIN_STAKE", raising=False)
    seed_user(db, AUTHOR_ADDR, "Alice")
    r = client.post("/admins/bootstrap", headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 403
    assert client.get("/auth/me", headers=auth(AUTHOR_ADDR, "Alice")).json()["is_admin"] is False


def test_bootstrap_refused_for_non_operator(client, db, monkeypatch):
    """A wallet that isn't the pre-configured operator can't claim admin."""
    monkeypatch.setenv("BOOTSTRAP_ADMIN_STAKE", ADMIN_ADDR)   # someone else
    seed_user(db, AUTHOR_ADDR, "Attacker")
    r = client.post("/admins/bootstrap", headers=auth(AUTHOR_ADDR, "Attacker"))
    assert r.status_code == 403


def test_bootstrap_allows_configured_operator(client, db, monkeypatch):
    """The pre-configured operator can claim admin while the table is empty."""
    monkeypatch.setenv("BOOTSTRAP_ADMIN_STAKE", f"stake1other,{AUTHOR_ADDR}")
    seed_user(db, AUTHOR_ADDR, "Operator")
    r = client.post("/admins/bootstrap", headers=auth(AUTHOR_ADDR, "Operator"))
    assert r.status_code in (200, 201)
    assert client.get("/auth/me", headers=auth(AUTHOR_ADDR, "Operator")).json()["is_admin"] is True


def test_dev_seed_editor_route_is_gone(client):
    """WC-09: the unauthenticated dev role-seeding endpoint must not exist."""
    r = client.post("/dev/seed-editor", json={"stake_address": ADMIN_ADDR})
    assert r.status_code in (404, 405)


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


def test_comment_defaults_to_top_level(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/comments", json={"body": "Top-level"}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 201
    assert r.json()["parent_id"] is None


def test_reply_records_parent(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    parent = client.post("/proposals/1/comments", json={"body": "Parent"},
                         headers=auth(AUTHOR_ADDR, "Alice")).json()
    reply = client.post("/proposals/1/comments",
                        json={"body": "Reply", "parent_id": parent["id"]},
                        headers=auth(AUTHOR_ADDR, "Alice"))
    assert reply.status_code == 201
    assert reply.json()["parent_id"] == parent["id"]
    # Both appear in the flat list; the frontend nests them by parent_id.
    listed = client.get("/proposals/1/comments").json()
    assert {c["id"]: c["parent_id"] for c in listed} == {parent["id"]: None, reply.json()["id"]: parent["id"]}


def test_reply_to_nonexistent_parent_rejected(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/comments", json={"body": "Reply", "parent_id": 99999},
                    headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 400


def test_reply_to_parent_on_other_proposal_rejected(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(title="One"), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals", json=proposal_body(title="Two"), headers=auth(AUTHOR_ADDR, "Alice"))
    parent = client.post("/proposals/1/comments", json={"body": "On one"},
                         headers=auth(AUTHOR_ADDR, "Alice")).json()
    # Try to reply on proposal 2 pointing at a comment that lives on proposal 1.
    r = client.post("/proposals/2/comments", json={"body": "Wrong thread", "parent_id": parent["id"]},
                    headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 400


def test_editing_comment_keeps_parent(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    parent = client.post("/proposals/1/comments", json={"body": "Parent"},
                         headers=auth(AUTHOR_ADDR, "Alice")).json()
    reply = client.post("/proposals/1/comments", json={"body": "Reply", "parent_id": parent["id"]},
                        headers=auth(AUTHOR_ADDR, "Alice")).json()
    # Edit endpoint shares the schema but must not re-parent the comment.
    edited = client.patch(f"/comments/{reply['id']}",
                          json={"body": "Reply edited", "parent_id": None},
                          headers=auth(AUTHOR_ADDR, "Alice"))
    assert edited.status_code == 200
    assert edited.json()["parent_id"] == parent["id"]


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
    # Oversized proposal overall (each field under 20k, combined over 1M)
    big = {f"extra_{i}": "z" * 19_000 for i in range(53)}
    r = client.post("/proposals", json={"title": "ok", "type": "CAP", "structured": {"abstract": "a", **big}},
                    headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 400
    assert "too large" in r.json()["detail"]


def test_revision_text_allows_100k_characters(client, db):
    """Constitution changes (Step 3 of the wizard) get a roomier cap than other
    sections: a whole article can be rewritten or inserted in one revision."""
    seed_user(db, AUTHOR_ADDR, "Alice")
    revs = [
        {"original": "Article I", "proposed": "p" * 100_000, "section": "I"},
        {"type": "addition", "insert_after": "Article II", "proposed": "a" * 100_000, "section": "II"},
    ]
    r = client.post("/proposals", json=proposal_body(revisions=revs), headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 201
    got = client.get("/proposals/1").json()["structured"]["revisions"]
    assert len(got[0]["proposed"]) == 100_000
    assert len(got[1]["proposed"]) == 100_000


def test_revision_text_over_100k_rejected(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    revs = [{"original": "Article I", "proposed": "p" * 100_001, "section": "I"}]
    r = client.post("/proposals", json=proposal_body(revisions=revs), headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 400
    assert "Revision #1" in r.json()["detail"] and "too long" in r.json()["detail"]


def test_oversized_comment_rejected(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/comments", json={"body": "q" * 120_000}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 400


# ── Admin: reset proposals ────────────────────────────────────────────────────

def test_admin_reset_proposals_wipes_only_proposal_data(client, db):
    seed_admin(db)
    seed_user(db, AUTHOR_ADDR, "Alice")
    ah = auth(ADMIN_ADDR, "Admin")

    # Two proposals with a comment each.
    for _ in range(2):
        n = client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice")).json()["number"]
        client.post(f"/proposals/{n}/comments", json={"body": "a comment"}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert len(client.get("/proposals").json()) == 2

    r = client.post("/admin/reset-proposals", json={"confirm": "RESET"}, headers=ah)
    assert r.status_code == 200
    assert r.json()["deleted_proposals"] == 2

    # Proposals + their data gone…
    assert client.get("/proposals").json() == []
    # …but editors/admins/users and guides are untouched.
    assert client.get("/admins", headers=ah).json()          # admin still there
    from models import User, Guide
    assert db.query(User).filter(User.stake_address == AUTHOR_ADDR).first() is not None


def test_reset_restarts_numbering_at_one(client, db):
    seed_admin(db)
    ah = auth(ADMIN_ADDR, "Admin")
    ph = auth(AUTHOR_ADDR, "Alice")
    assert client.post("/proposals", json=proposal_body(), headers=ph).json()["number"] == 1
    assert client.post("/proposals", json=proposal_body(), headers=ph).json()["number"] == 2

    client.post("/admin/reset-proposals", json={"confirm": "RESET"}, headers=ah)

    # First proposal after a reset is #1 again.
    assert client.post("/proposals", json=proposal_body(), headers=ph).json()["number"] == 1


def test_reset_requires_admin_and_confirmation(client, db):
    seed_admin(db)
    seed_editor(db)
    # Non-admin (editor) is refused.
    assert client.post("/admin/reset-proposals", json={"confirm": "RESET"}, headers=auth(EDITOR_ADDR)).status_code == 403
    # Anonymous is refused.
    assert client.post("/admin/reset-proposals", json={"confirm": "RESET"}).status_code == 401
    # Admin without the exact phrase is refused (nothing deleted).
    assert client.post("/admin/reset-proposals", json={"confirm": "nope"}, headers=auth(ADMIN_ADDR)).status_code == 400


# ── Security audit regressions ────────────────────────────────────────────────

def test_logout_revokes_token(client, db):
    """WC-03: a JWT must stop working the moment the user logs out, rather than
    staying valid until it expires."""
    seed_user(db, AUTHOR_ADDR, "Alice")
    h = auth(AUTHOR_ADDR, "Alice")

    assert client.get("/auth/me", headers=h).status_code == 200      # works before
    assert client.post("/auth/logout", headers=h).status_code == 200
    assert client.get("/auth/me", headers=h).status_code == 401      # dead after

    # A revoked token must not authenticate anywhere else either.
    r = client.post("/proposals", json=proposal_body(), headers=h)
    assert r.status_code == 401


def test_legacy_token_without_jti_is_rejected(client, db):
    """WC-03 legacy cutover: a token minted before revocation support has no jti
    and can never be revoked, so it must be rejected outright rather than trusted
    until it expires."""
    from jose import jwt
    from datetime import datetime, timezone, timedelta
    from auth import _jwt_secret, ALGORITHM
    seed_user(db, AUTHOR_ADDR, "Alice")
    legacy = jwt.encode(
        {"sub": AUTHOR_ADDR, "display_name": "Alice",
         "exp": datetime.now(timezone.utc) + timedelta(hours=1)},  # no jti
        _jwt_secret(), algorithm=ALGORITHM)
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {legacy}"}).status_code == 401


def test_logout_only_revokes_that_token(client, db):
    """Revoking one session must not sign the user out of their other ones."""
    seed_user(db, AUTHOR_ADDR, "Alice")
    h1 = auth(AUTHOR_ADDR, "Alice")
    h2 = auth(AUTHOR_ADDR, "Alice")   # a second, independent session

    assert client.post("/auth/logout", headers=h1).status_code == 200
    assert client.get("/auth/me", headers=h1).status_code == 401
    assert client.get("/auth/me", headers=h2).status_code == 200


def test_tokens_carry_a_unique_id(db):
    """Revocation relies on each token having its own jti."""
    from auth import decode_token
    a = decode_token(create_token(AUTHOR_ADDR, "Alice"))
    b = decode_token(create_token(AUTHOR_ADDR, "Alice"))
    assert a["jti"] and b["jti"] and a["jti"] != b["jti"]


def _sign_cose(payload: bytes, priv=None):
    """Build a genuine CIP-8 COSE_Sign1 over `payload`, exactly as a wallet would.
    Returns (signature_hex, key_hex, public_key_bytes)."""
    import cbor2
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

    priv = priv or Ed25519PrivateKey.generate()
    pub = priv.public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    protected = cbor2.dumps({1: -8})                                  # alg: EdDSA
    sig = priv.sign(cbor2.dumps(["Signature1", protected, b"", payload]))
    cose = cbor2.dumps([protected, {}, payload, sig])
    cose_key = cbor2.dumps({-2: pub})                                 # COSE_Key: x
    return cose.hex(), cose_key.hex(), pub


def test_challenge_must_match_exactly_not_substring():
    """WC-02: the signed payload must equal the challenge. A correctly-signed
    payload that merely *contains* the challenge must still be rejected."""
    from auth import verify_cip8_signature

    # Sanity: an exact payload verifies (proves the harness builds valid COSE).
    sig, key, pub = _sign_cose(b"chal-123")
    assert verify_cip8_signature(sig, key, "chal-123") == pub

    # The real check: a validly-signed superset payload must NOT verify.
    sig2, key2, _ = _sign_cose(b"attacker-prefix:chal-123:suffix")
    assert verify_cip8_signature(sig2, key2, "chal-123") is None


def test_verify_binds_token_to_the_signing_key(client, db):
    """WC-01 (critical): the JWT subject is bound to the key that actually
    signed. A perfectly valid signature must not mint a token for someone
    else's stake address."""
    from models import AuthChallenge
    from auth import derive_stake_addresses

    from auth import decode_token

    # Same valid signature, but claiming an address the key does not hash to.
    sig, key, _ = _sign_cose(b"chal-wc01")
    db.add(AuthChallenge(challenge="chal-wc01")); db.commit()
    r = client.post("/auth/verify", json={
        "stake_address": "stake1victim000000000000000000000000000000000000000000000",
        "challenge": "chal-wc01", "signature": sig, "key": key,
    })
    assert r.status_code == 401
    assert "token" not in r.json()

    # The address the key really derives to is accepted, and the token's subject
    # is that address — never a client-supplied string.
    sig2, key2, pub2 = _sign_cose(b"chal-wc01b")
    mine = next(a for a in derive_stake_addresses(pub2) if a.startswith("stake1"))
    db.add(AuthChallenge(challenge="chal-wc01b")); db.commit()
    r2 = client.post("/auth/verify", json={
        "stake_address": mine, "challenge": "chal-wc01b", "signature": sig2, "key": key2,
    })
    assert r2.status_code == 200, r2.text
    assert decode_token(r2.json()["token"])["sub"] == mine


def test_verify_rejects_testnet_wallet(client, db):
    """WC-10: the app is mainnet-only. A validly-signed testnet identity must be
    rejected even though the key legitimately derives one."""
    from models import AuthChallenge
    from auth import derive_stake_addresses

    sig, key, pub = _sign_cose(b"chal-wc10")
    testnet = next(a for a in derive_stake_addresses(pub) if a.startswith("stake_test1"))
    db.add(AuthChallenge(challenge="chal-wc10")); db.commit()
    r = client.post("/auth/verify", json={
        "stake_address": testnet, "challenge": "chal-wc10", "signature": sig, "key": key,
    })
    assert r.status_code == 401
    assert "token" not in r.json()


def test_challenge_is_single_use(client, db):
    """WC-12: a challenge is consumed on use — the same challenge/signature can't
    be verified twice."""
    from models import AuthChallenge
    from auth import derive_stake_addresses

    sig, key, pub = _sign_cose(b"chal-wc12")
    mine = next(a for a in derive_stake_addresses(pub) if a.startswith("stake1"))
    db.add(AuthChallenge(challenge="chal-wc12")); db.commit()
    body = {"stake_address": mine, "challenge": "chal-wc12", "signature": sig, "key": key}

    assert client.post("/auth/verify", json=body).status_code == 200   # first use works
    assert client.post("/auth/verify", json=body).status_code == 400   # replay rejected
    # And the challenge row is gone.
    assert db.query(AuthChallenge).filter(AuthChallenge.challenge == "chal-wc12").first() is None


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


# ── Draft-constitution matcher (whitespace / list-marker tolerance) ────────────

def test_match_span_exact():
    """An exactly-present passage is located unchanged (fast path)."""
    doc = "Alpha.\n\n5.  Bravo clause here.\n\n6.  Charlie."
    s, e = main._match_span(doc, "Bravo clause here.")
    assert doc[s:e] == "Bravo clause here."


def test_match_span_tolerates_missing_list_markers():
    """A passage copied from the rendered page (ordered-list numbers stripped)
    still matches the markdown source that contains '5.  ' / '6.  ' markers.
    This is the CAP-2 regression: an exact substring search returned nothing,
    so the generated draft was identical to the base and the diff looked empty.
    """
    doc = ("4.  Withdrawals shall require an audit.\n\n"
           "5.  Withdrawals shall designate an administrator.\n\n"
           "6.  Any ada received must be kept separate.")
    # Rendered copy: same words, list numbers dropped, paragraphs joined.
    pasted = ("Withdrawals shall require an audit.\n\n"
              "Withdrawals shall designate an administrator.\n\n"
              "Any ada received must be kept separate.")
    assert pasted not in doc  # exact match genuinely fails
    span = main._match_span(doc, pasted)
    assert span is not None
    s, e = span
    # The matched span covers the whole block including the intervening markers.
    assert doc[s:e].startswith("Withdrawals shall require an audit.")
    assert doc[s:e].endswith("must be kept separate.")


def test_match_span_refuses_ambiguous_match():
    """When a passage could match more than one place, we refuse rather than
    guess which clause the author meant to change."""
    doc = "The council shall vote.\n\nThe council shall vote.\n\nDone."
    # Force the tolerant path with a whitespace difference; two candidates exist
    # and nothing narrows them: the first is used and the call is flagged.
    amb = []
    assert main._match_span(doc, "The  council  shall  vote.", ambiguous=amb) == (0, 23)
    assert amb == [True]


def test_match_span_empty_needle():
    assert main._match_span("anything", "") is None
    assert main._match_span("anything", "   ") is None


# ── Security: display-name and screenshot validation (XSS hardening) ───────────

import pytest as _pytest
from pydantic import ValidationError as _ValidationError


def test_display_name_rejects_html_chars():
    for bad in ["<img src=x onerror=alert(1)>", "a<b", "a>b", 'a"b', "a\x00b"]:
        with _pytest.raises(ValueError):
            main._validate_display_name(bad)


def test_display_name_allows_normal_and_apostrophe():
    for ok in ["Thomas", "O'Brien", "wakuda", "Styg 123", None]:
        assert main._validate_display_name(ok) == ok


def test_setname_model_rejects_injection():
    with _pytest.raises(_ValidationError):
        main.SetNameRequest(display_name="<script>alert(1)</script>")
    # A legitimate name still passes.
    assert main.SetNameRequest(display_name="Jo Allum").display_name == "Jo Allum"


def test_screenshot_must_be_image_data_url():
    # Quote-bearing value that would break out of <img src="…"> is rejected.
    with _pytest.raises(_ValidationError):
        main.BugReportCreate(title="t", description="d",
                             screenshots=['x" onerror=alert(document.domain)'])
    # A well-formed image data URL is accepted.
    ok = main.BugReportCreate(title="t", description="d",
                              screenshots=["data:image/png;base64,iVBORw0KGgo="])
    assert ok.screenshots == ["data:image/png;base64,iVBORw0KGgo="]


# ── Editor suggestions on revision text (amendment text) ──────────────────────

REVS = [
    {"original": "OLD original text", "proposed": "OLD proposed text", "section": "Article II"},
    {"type": "addition", "insert_after": "OLD anchor", "proposed": "OLD add text", "section": "Article III"},
]


def test_editor_can_suggest_revision_proposed(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    client.post("/proposals", json=proposal_body(revisions=REVS), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/suggestions",
                    json={"field": "revisions[0].proposed", "suggested_value": "NEW proposed text", "reason": "clearer"},
                    headers=auth(EDITOR_ADDR))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "pending"
    assert body["current_value"] == "OLD proposed text"  # snapshot of the live value


def test_author_approves_revision_suggestion_applies_to_right_revision(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    client.post("/proposals", json=proposal_body(revisions=REVS), headers=auth(AUTHOR_ADDR, "Alice"))
    s = client.post("/proposals/1/suggestions",
                    json={"field": "revisions[0].proposed", "suggested_value": "NEW proposed text"},
                    headers=auth(EDITOR_ADDR)).json()
    r = client.post(f"/proposals/1/suggestions/{s['id']}/approve", headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200
    got = client.get("/proposals/1").json()["structured"]["revisions"]
    assert got[0]["proposed"] == "NEW proposed text"      # applied
    assert got[0]["original"] == "OLD original text"      # siblings untouched
    assert got[0]["section"] == "Article II"
    assert got[1]["proposed"] == "OLD add text"           # other revision untouched
    assert got[1]["type"] == "addition"


def test_suggest_insert_after_only_on_addition(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    client.post("/proposals", json=proposal_body(revisions=REVS), headers=auth(AUTHOR_ADDR, "Alice"))
    # insert_after on a replacement revision (index 0) is rejected
    bad = client.post("/proposals/1/suggestions",
                      json={"field": "revisions[0].insert_after", "suggested_value": "x"},
                      headers=auth(EDITOR_ADDR))
    assert bad.status_code == 400
    # original on an addition revision (index 1) is rejected
    bad2 = client.post("/proposals/1/suggestions",
                       json={"field": "revisions[1].original", "suggested_value": "x"},
                       headers=auth(EDITOR_ADDR))
    assert bad2.status_code == 400
    # insert_after on the addition revision is accepted
    ok = client.post("/proposals/1/suggestions",
                     json={"field": "revisions[1].insert_after", "suggested_value": "NEW anchor"},
                     headers=auth(EDITOR_ADDR))
    assert ok.status_code == 201


def test_suggestion_size_caps_per_field(client, db):
    """Revision text suggestions get the 100k revision cap; ordinary sections keep 20k."""
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    client.post("/proposals", json=proposal_body(revisions=REVS), headers=auth(AUTHOR_ADDR, "Alice"))
    ok = client.post("/proposals/1/suggestions",
                     json={"field": "revisions[0].proposed", "suggested_value": "p" * 100_000},
                     headers=auth(EDITOR_ADDR))
    assert ok.status_code == 201, ok.text
    too_big = client.post("/proposals/1/suggestions",
                          json={"field": "revisions[0].proposed", "suggested_value": "p" * 100_001},
                          headers=auth(EDITOR_ADDR))
    assert too_big.status_code == 400
    section = client.post("/proposals/1/suggestions",
                          json={"field": "motivation", "suggested_value": "m" * 20_001},
                          headers=auth(EDITOR_ADDR))
    assert section.status_code == 400
    assert "too long" in section.json()["detail"]


def test_suggest_revision_out_of_range_rejected(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    client.post("/proposals", json=proposal_body(revisions=REVS), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.post("/proposals/1/suggestions",
                    json={"field": "revisions[5].proposed", "suggested_value": "x"},
                    headers=auth(EDITOR_ADDR))
    assert r.status_code == 400


# ── Whole-proposal suggested edits (editor wizard suggestions) ────────────────

NEW_STRUCTURED = {
    "category": "Substantive", "abstract": "NEW abstract", "motivation": "m",
    "analysis": "a", "impact": "i", "exhibits": "",
    "revisions": [{"original": "OLD original text", "proposed": "EDITOR proposed", "section": "Article II"}],
}


def _make_suggested_edit(client):
    return client.post("/proposals/1/suggested-edits",
                       json={"title": "Editor Title", "structured": NEW_STRUCTURED, "note": "cleaner"},
                       headers=auth(EDITOR_ADDR))


def test_editor_creates_suggested_edit_pending_no_change(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice"); seed_editor(db)
    client.post("/proposals", json=proposal_body(revisions=REVS), headers=auth(AUTHOR_ADDR, "Alice"))
    r = _make_suggested_edit(client)
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "pending"
    # The live proposal is untouched until approval.
    p = client.get("/proposals/1").json()
    assert p["title"] == "Test Proposal"
    assert p["structured"]["abstract"] == "Test abstract"


def test_author_approves_suggested_edit_applies_whole_version(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice"); seed_editor(db)
    client.post("/proposals", json=proposal_body(revisions=REVS), headers=auth(AUTHOR_ADDR, "Alice"))
    se = _make_suggested_edit(client).json()
    r = client.post(f"/proposals/1/suggested-edits/{se['id']}/approve", headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200
    p = client.get("/proposals/1").json()
    assert p["title"] == "Editor Title"
    assert p["structured"]["abstract"] == "NEW abstract"
    assert p["structured"]["revisions"][0]["proposed"] == "EDITOR proposed"
    assert len(p["structured"]["revisions"]) == 1  # editor removed the addition revision
    assert "Substantive" in [l["name"] for l in p["labels"]]  # category label synced


def test_author_rejects_suggested_edit_no_change(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice"); seed_editor(db)
    client.post("/proposals", json=proposal_body(revisions=REVS), headers=auth(AUTHOR_ADDR, "Alice"))
    se = _make_suggested_edit(client).json()
    r = client.post(f"/proposals/1/suggested-edits/{se['id']}/reject", headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200 and r.json()["status"] == "rejected"
    assert client.get("/proposals/1").json()["title"] == "Test Proposal"


def test_non_editor_cannot_suggest_edit(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice"); seed_user(db, EDITOR_ADDR, "Bob")
    client.post("/proposals", json=proposal_body(revisions=REVS), headers=auth(AUTHOR_ADDR, "Alice"))
    assert _make_suggested_edit(client).status_code == 403


def test_non_author_cannot_approve_suggested_edit(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice"); seed_editor(db)
    client.post("/proposals", json=proposal_body(revisions=REVS), headers=auth(AUTHOR_ADDR, "Alice"))
    se = _make_suggested_edit(client).json()
    r = client.post(f"/proposals/1/suggested-edits/{se['id']}/approve", headers=auth(EDITOR_ADDR))
    assert r.status_code == 403


# ── Co-authors (identified by stake address) ─────────────────────────────────

CO_AUTHOR_A = "stake1u" + "q" * 52   # valid stake-address format
CO_AUTHOR_B = "stake1u" + "p" * 52


def test_author_can_save_co_authors(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    body = proposal_body()["structured"]
    body["co_authors"] = [CO_AUTHOR_A, CO_AUTHOR_B]
    r = client.patch("/proposals/1", json={"structured": body}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200, r.text
    got = client.get("/proposals/1").json()
    assert got["structured"]["co_authors"] == [CO_AUTHOR_A, CO_AUTHOR_B]


def test_invalid_co_author_rejected(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    body = proposal_body()["structured"]
    body["co_authors"] = ["not-a-stake-address"]
    r = client.patch("/proposals/1", json={"structured": body}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code in (400, 422)   # rejected as invalid
    # the proposal keeps its (empty) co-authors — nothing was saved
    assert client.get("/proposals/1").json()["structured"].get("co_authors", []) == []


def test_co_author_names_resolved(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_user(db, CO_AUTHOR_A, "Bob")   # Bob has a registered profile; B does not
    client.post("/proposals", json=proposal_body(co_authors=[CO_AUTHOR_A, CO_AUTHOR_B]),
                headers=auth(AUTHOR_ADDR, "Alice"))
    ca = client.get("/proposals/1").json()["co_authors"]
    assert {"stake_address": CO_AUTHOR_A, "display_name": "Bob"} in ca
    assert any(x["stake_address"] == CO_AUTHOR_B and x["display_name"] is None for x in ca)


def test_existing_proposal_empty_co_authors_unaffected(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    got = client.get("/proposals/1").json()
    assert got["co_authors"] == []


# ── Drafts ─────────────────────────────────────────────────────────────────────

DRAFT_OTHER = "stake1other000000000000000000000000000000000000000000000"


def test_create_and_list_draft(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    r = client.post("/drafts", json={"title": "WIP", "type": "CAP", "data": {"title": "WIP", "step": 2}},
                    headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 201
    body = r.json()
    assert body["id"] and body["title"] == "WIP" and body["type"] == "CAP"
    assert body["data"] == {"title": "WIP", "step": 2}
    lst = client.get("/drafts", headers=auth(AUTHOR_ADDR, "Alice")).json()
    assert len(lst) == 1 and lst[0]["title"] == "WIP"
    assert "data" not in lst[0]          # list is a summary, no heavy blob


def test_draft_requires_auth(client, db):
    assert client.get("/drafts").status_code == 401
    assert client.post("/drafts", json={"data": {}}).status_code == 401


def test_get_draft_returns_full_data(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    did = client.post("/drafts", json={"title": "T", "type": "CIS", "data": {"a": 1, "revisions": {"0": {}}}},
                      headers=auth(AUTHOR_ADDR, "Alice")).json()["id"]
    got = client.get(f"/drafts/{did}", headers=auth(AUTHOR_ADDR, "Alice"))
    assert got.status_code == 200
    assert got.json()["data"] == {"a": 1, "revisions": {"0": {}}}


def test_update_draft_persists(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    did = client.post("/drafts", json={"title": "Old", "type": "CAP", "data": {"v": 1}},
                      headers=auth(AUTHOR_ADDR, "Alice")).json()["id"]
    r = client.patch(f"/drafts/{did}", json={"title": "New", "type": "CAP", "data": {"v": 2}},
                     headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200 and r.json()["title"] == "New" and r.json()["data"] == {"v": 2}


def test_partial_update_does_not_wipe_title(client, db):
    # An autosave that sends only `data` must not clear the previously saved title.
    seed_user(db, AUTHOR_ADDR, "Alice")
    did = client.post("/drafts", json={"title": "Keep me", "type": "CAP", "data": {"v": 1}},
                      headers=auth(AUTHOR_ADDR, "Alice")).json()["id"]
    r = client.patch(f"/drafts/{did}", json={"data": {"v": 2}}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200 and r.json()["title"] == "Keep me"


def test_delete_draft(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    did = client.post("/drafts", json={"data": {"v": 1}}, headers=auth(AUTHOR_ADDR, "Alice")).json()["id"]
    assert client.delete(f"/drafts/{did}", headers=auth(AUTHOR_ADDR, "Alice")).status_code == 204
    assert client.get(f"/drafts/{did}", headers=auth(AUTHOR_ADDR, "Alice")).status_code == 404
    assert client.get("/drafts", headers=auth(AUTHOR_ADDR, "Alice")).json() == []


def test_drafts_are_private_to_owner(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_user(db, DRAFT_OTHER, "Mallory")
    did = client.post("/drafts", json={"title": "secret", "data": {"x": 1}},
                      headers=auth(AUTHOR_ADDR, "Alice")).json()["id"]
    # Another wallet can neither see it in their list nor read/patch/delete it.
    assert client.get("/drafts", headers=auth(DRAFT_OTHER, "Mallory")).json() == []
    assert client.get(f"/drafts/{did}", headers=auth(DRAFT_OTHER, "Mallory")).status_code == 404
    assert client.patch(f"/drafts/{did}", json={"data": {"x": 2}},
                        headers=auth(DRAFT_OTHER, "Mallory")).status_code == 404
    assert client.delete(f"/drafts/{did}", headers=auth(DRAFT_OTHER, "Mallory")).status_code == 404
    # ...and the owner's draft is untouched.
    assert client.get(f"/drafts/{did}", headers=auth(AUTHOR_ADDR, "Alice")).json()["data"] == {"x": 1}


def test_oversized_draft_rejected(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    big = {"blob": "q" * 2_500_000}
    r = client.post("/drafts", json={"data": big}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code in (400, 422)


def test_draft_count_capped(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    for _ in range(25):
        assert client.post("/drafts", json={"data": {"v": 1}},
                           headers=auth(AUTHOR_ADDR, "Alice")).status_code == 201
    over = client.post("/drafts", json={"data": {"v": 1}}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert over.status_code == 400


def test_drafts_do_not_appear_as_proposals(client, db):
    # A draft must never leak into the public proposal list.
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/drafts", json={"title": "hidden", "data": {"v": 1}}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert client.get("/proposals").json() == []


# ── Version change summaries only report fields that actually changed ───────────

def test_content_only_edit_not_flagged_as_title_change(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(title="Keep This Title"), headers=auth(AUTHOR_ADDR, "Alice"))
    # Edit the content but resubmit the SAME title, exactly as the edit wizard does.
    edited = proposal_body(title="Keep This Title", motivation="A genuinely different motivation")
    r = client.patch("/proposals/1", json={"title": edited["title"], "structured": edited["structured"]},
                     headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200
    latest = client.get("/proposals/1/versions").json()[0]
    assert "Content updated" in latest["change_summary"]
    assert "Title updated" not in latest["change_summary"]


def test_title_only_edit_not_flagged_as_content_change(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(title="Old Title"), headers=auth(AUTHOR_ADDR, "Alice"))
    current = client.get("/proposals/1").json()["structured"]   # resubmit identical content
    r = client.patch("/proposals/1", json={"title": "New Title", "structured": current},
                     headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200
    latest = client.get("/proposals/1/versions").json()[0]
    assert "Title updated" in latest["change_summary"]
    assert "Content updated" not in latest["change_summary"]


def test_noop_edit_creates_no_new_version(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(title="Same"), headers=auth(AUTHOR_ADDR, "Alice"))
    current = client.get("/proposals/1").json()["structured"]
    before = len(client.get("/proposals/1/versions").json())
    client.patch("/proposals/1", json={"title": "Same", "structured": current},
                 headers=auth(AUTHOR_ADDR, "Alice"))
    after = len(client.get("/proposals/1/versions").json())
    assert after == before   # a no-op save must not create a spurious version


# ── "Add After" must not split inline Markdown emphasis ─────────────────────────

def test_add_after_does_not_split_inline_emphasis():
    from main import _apply_revisions
    base = "Intro.\n\n- *pvtPPSecurityGroup*\n- *pvtPPNetworkGroup*\n\nMore text."
    # Author selected the *rendered* text, so the anchor has no asterisks.
    revisions = [{"type": "addition", "insert_after": "pvtPPSecurityGroup",
                  "proposed": "- *pvtPPStakePoolEconomicGroup*"}]
    modified, applied = _apply_revisions(base, revisions)
    assert applied == 1
    # The original emphasised item stays intact, and the new item is whole.
    assert "- *pvtPPSecurityGroup*" in modified
    assert "- *pvtPPStakePoolEconomicGroup*" in modified
    # The emphasis was NOT split across the inserted line.
    assert "*pvtPPSecurityGroup\n" not in modified
    # The new item lands after the anchor's line, before the following item.
    assert (modified.index("pvtPPSecurityGroup*")
            < modified.index("pvtPPStakePoolEconomicGroup")
            < modified.index("pvtPPNetworkGroup"))


def test_add_after_paragraph_still_separated_by_blank_line():
    from main import _apply_revisions
    base = "First paragraph anchor here.\n\nSecond paragraph."
    revisions = [{"type": "addition", "insert_after": "First paragraph anchor here.",
                  "proposed": "An entirely new paragraph."}]
    modified, applied = _apply_revisions(base, revisions)
    assert applied == 1
    assert "First paragraph anchor here.\n\nAn entirely new paragraph." in modified


# ── CIP-100 governance metadata endpoints ───────────────────────────────────────

def test_cip100_document_shape(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(title="NCL plan"), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals/1/comments", json={"body": "First thought"}, headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.get("/proposals/1/cip100")
    assert r.status_code == 200
    assert "ld+json" in r.headers["content-type"]
    d = r.json()
    assert "@context" in d and d["hashAlgorithm"] == "blake2b-256"
    assert d["body"]["title"] == "NCL plan"
    cap = d["body"]["cap"]
    assert cap["number"] == 1 and cap["documentType"] == "CAP"
    assert len(cap["versionHistory"]) >= 1                       # includes the submission
    assert any(c["body"] == "First thought" for c in cap["discussion"])


def test_cip100_discussion_preserves_threading(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    parent = client.post("/proposals/1/comments", json={"body": "Parent"},
                         headers=auth(AUTHOR_ADDR, "Alice")).json()
    client.post("/proposals/1/comments", json={"body": "Reply", "parent_id": parent["id"]},
                headers=auth(AUTHOR_ADDR, "Alice"))
    disc = client.get("/proposals/1/cip100").json()["body"]["cap"]["discussion"]
    reply = next(c for c in disc if c["body"] == "Reply")
    assert reply["inReplyTo"] == parent["id"]


def test_cip100_feed_lists_documents(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(title="One"), headers=auth(AUTHOR_ADDR, "Alice"))
    r = client.get("/cip100")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 1
    assert body["documents"][0]["number"] == 1
    assert body["documents"][0]["cip100"].endswith("/proposals/1/cip100")


def test_cip100_missing_proposal_404(client, db):
    assert client.get("/proposals/999/cip100").status_code == 404


def test_cip100_allows_any_origin(client, db):
    # Public read-only endpoints must be fetchable by browser tools on any origin.
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    assert client.get("/proposals/1/cip100").headers.get("access-control-allow-origin") == "*"
    assert client.get("/cip100").headers.get("access-control-allow-origin") == "*"


def test_cip100_exposes_stable_author_id_and_signature_state(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(title="NCL plan"), headers=auth(AUTHOR_ADDR, "Alice"))
    client.post("/proposals/1/comments", json={"body": "First thought"}, headers=auth(AUTHOR_ADDR, "Alice"))
    d = client.get("/proposals/1/cip100").json()
    # Stable identifier (stake address) alongside the display name.
    assert d["authors"][0]["id"] == AUTHOR_ADDR
    cap = d["body"]["cap"]
    assert cap["profileVersion"]
    # Signature state is explicit, not inferred: wallet-verified at submission,
    # document not (yet) signed.
    assert cap["authorship"]["identifierType"] == "stakeAddress"
    assert cap["authorship"]["walletVerifiedAtSubmission"] is True
    assert cap["authorship"]["documentSigned"] is False
    assert cap["versionHistory"][0]["authorId"] == AUTHOR_ADDR
    comment = next(c for c in cap["discussion"] if c.get("body") == "First thought")
    assert comment["authorId"] == AUTHOR_ADDR
    assert comment["status"] == "visible"
    assert comment["updatedAt"]  # present, so edits are detectable


def test_cip100_removed_comment_becomes_a_tombstone(client, db):
    from models import Comment
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    parent = client.post("/proposals/1/comments", json={"body": "Parent"},
                         headers=auth(AUTHOR_ADDR, "Alice")).json()
    client.post("/proposals/1/comments", json={"body": "Reply", "parent_id": parent["id"]},
                headers=auth(AUTHOR_ADDR, "Alice"))
    # Moderate the parent out of view.
    c = db.query(Comment).filter(Comment.id == parent["id"]).first()
    c.moderation_status = "removed"
    db.commit()

    disc = client.get("/proposals/1/cip100").json()["body"]["cap"]["discussion"]
    tomb = next(c for c in disc if c["id"] == parent["id"])
    assert tomb["status"] == "removed"
    assert "body" not in tomb and "author" not in tomb   # content and author withheld
    # The reply is still there and still points at its parent: the thread shape
    # survives a removal instead of orphaning the reply.
    reply = next(c for c in disc if c.get("body") == "Reply")
    assert reply["inReplyTo"] == parent["id"]


def test_cip100_content_hash_is_blake2b256_and_chained(client, db):
    import main
    from models import ProposalVersion
    seed_user(db, AUTHOR_ADDR, "Alice")
    client.post("/proposals", json=proposal_body(), headers=auth(AUTHOR_ADDR, "Alice"))
    v = (db.query(ProposalVersion)
           .filter(ProposalVersion.proposal_number == 1, ProposalVersion.version == 1)
           .first())
    assert v.previous_hash == "genesis"
    assert len(v.content_hash) == 64 and int(v.content_hash, 16) >= 0   # 32-byte hex digest
    # Stored hash is exactly the documented blake2b-256 rule.
    assert v.content_hash == main._version_content_hash(v.title, v.body, v.previous_hash)


# ── Upload an edited constitution → derived revisions ─────────────────────────

def _base_text():
    return main._base_constitution_content()


def test_derive_revisions_requires_auth(client, db):
    r = client.post("/constitution/derive-revisions", json={"content": "x"})
    assert r.status_code in (401, 403)


def test_derive_revisions_from_edited_copy(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    base = _base_text()
    lines = base.split("\n")
    edited = lines[:]
    i_para = next(i for i, l in enumerate(lines) if l.startswith("Cardano is a decentralized"))
    edited[i_para] = edited[i_para].replace("decentralized ecosystem", "decentralised ecosystem")
    # A paragraph well away from the edited one (adjacent changes merge into one
    # replacement, which is correct but would not count as a separate deletion).
    i_sec = next(i for i, l in enumerate(lines) if l.startswith("### Section 1 The Cardano Community"))
    i_del = i_sec + 2
    assert lines[i_del].strip() and not lines[i_del].startswith("#")
    del edited[i_del]
    edited.append("A brand new closing paragraph.")
    r = client.post("/constitution/derive-revisions", json={"content": "\r\n".join(edited)},
                    headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["counts"] == {"replacements": 1, "additions": 1, "deletions": 1}
    assert body["warnings"] == []
    kinds = [rv.get("type", "replace") for rv in body["revisions"]]
    assert kinds == ["replace", "deletion", "addition"]
    rep, dele, add = body["revisions"]
    assert rep["original"].startswith("Cardano is a decentralized") and "decentralised" in rep["proposed"]
    assert rep["section"] == "PREAMBLE"
    assert dele["original"] == lines[i_del].strip() and dele["proposed"] == ""
    assert dele["section"].startswith("ARTICLE II") and "Section 1" in dele["section"]
    assert add["proposed"] == "A brand new closing paragraph." and add["insert_after"]
    # Submitting the derived revisions reproduces the edited text in the draft.
    p = client.post("/proposals", json=proposal_body(revisions=body["revisions"]), headers=auth(AUTHOR_ADDR, "Alice"))
    assert p.status_code == 201, p.text
    g = client.post("/proposals/1/generate-draft-constitution", headers=auth(AUTHOR_ADDR, "Alice"))
    assert g.status_code == 200 and g.json()["applied"] == 3
    draft = client.get("/constitution/cap-1-proposed.md").json()["content"]
    norm = lambda t: [l.strip() for l in t.split("\n") if l.strip()]
    assert norm(draft) == norm("\n".join(edited))
    assert "\n\n\n" not in draft  # the deletion left no empty line behind


def test_derive_revisions_disambiguates_repeated_lines(client, db):
    """A changed line that occurs several times in the base (e.g. '##### GUARDRAILS')
    is widened with preceding context so the draft applies it in the right place."""
    seed_user(db, AUTHOR_ADDR, "Alice")
    base = _base_text()
    lines = base.split("\n")
    dups = [i for i, l in enumerate(lines) if l == "##### GUARDRAILS"]
    assert len(dups) > 2
    edited = lines[:]
    edited[dups[3]] = "##### GUARDRAILS (revised)"
    r = client.post("/constitution/derive-revisions", json={"content": "\n".join(edited)},
                    headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200, r.text
    (rev,) = r.json()["revisions"]
    assert base.count(rev["original"]) == 1
    modified, applied = main._apply_revisions(base, [rev])
    assert applied == 1
    assert modified.split("\n") == edited


def test_derive_revisions_rejects_unrelated_file(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    r = client.post("/constitution/derive-revisions", json={"content": "# Something else\n\nNot the constitution.\n"},
                    headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 400
    assert "does not look like" in r.json()["detail"]
    r = client.post("/constitution/derive-revisions", json={"content": "   \n"}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 400
    r = client.post("/constitution/derive-revisions", json={"content": _base_text()}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200 and r.json()["revisions"] == []


def test_derive_revisions_warns_on_oversized_change(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    edited = _base_text() + "\n\n" + ("x" * 100_001) + "\n"
    r = client.post("/constitution/derive-revisions", json={"content": edited}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200
    assert len(r.json()["warnings"]) == 1


def test_derive_revisions_upload_too_large(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    r = client.post("/constitution/derive-revisions", json={"content": "x" * 1_000_001}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 400


def test_deletion_revision_must_name_a_passage(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    r = client.post("/proposals", json=proposal_body(revisions=[{"type": "deletion", "original": "", "proposed": ""}]),
                    headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 400
    assert "deletion" in r.json()["detail"]


def test_remove_span_keeps_surrounding_spacing():
    text = "a\n\nb\n\nc\n"
    s = text.find("b")
    assert main._remove_span(text, s, s + 1) == "a\n\nc\n"
    tight = "- a\n- b\n- c\n"
    s = tight.find("- b")
    assert main._remove_span(tight, s, s + 3) == "- a\n- c\n"
    last = "a\n\nb\n"
    s = last.find("b")
    assert main._remove_span(last, s, s + 1) == "a\n"
    first = "a\n\nb\n"
    assert main._remove_span(first, 0, 1) == "b\n"


def test_suggest_proposed_on_deletion_rejected(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    seed_editor(db)
    revs = [{"type": "deletion", "original": "OLD original text", "proposed": "", "section": "Article II"}]
    client.post("/proposals", json=proposal_body(revisions=revs), headers=auth(AUTHOR_ADDR, "Alice"))
    bad = client.post("/proposals/1/suggestions", json={"field": "revisions[0].proposed", "suggested_value": "x"},
                      headers=auth(EDITOR_ADDR))
    assert bad.status_code == 400
    ok = client.post("/proposals/1/suggestions", json={"field": "revisions[0].original", "suggested_value": "x"},
                     headers=auth(EDITOR_ADDR))
    assert ok.status_code == 201


def test_derive_revisions_ignores_markdown_editor_noise(client, db):
    """An editor that re-serialises markdown on save ("-" -> "*" bullets,
    backslash escapes, curly quotes) must not produce spurious changes, and the
    proposed text must come back in the constitution's own style."""
    import re
    seed_user(db, AUTHOR_ADDR, "Alice")
    base = _base_text()
    lines = base.split("\n")
    noisy = [re.sub(r"^- ", "* ", l) for l in lines]                       # bullet style
    noisy = [re.sub(r"^(#+ \d+)\. ", r"\1\\. ", l) for l in noisy]          # "### 1\. Intro"
    noisy = [l.replace("[", "\\[").replace("~", "\\~") for l in noisy]      # escapes
    i_para = next(i for i, l in enumerate(lines) if l.startswith("With these purposes in mind"))
    noisy[i_para] = noisy[i_para] + " Hello"
    i_del = next(i for i, l in enumerate(lines) if l.startswith("TENET 10"))
    del noisy[i_del]
    i_li = next(i for i, l in enumerate(noisy) if l.startswith("* External economic factors"))
    noisy[i_li] = "* External economic factors — “quoted” [note]"   # real edit, curly quotes
    r = client.post("/constitution/derive-revisions", json={"content": "\n".join(noisy)}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200, r.text
    revs = r.json()["revisions"]
    assert r.json()["counts"] == {"replacements": 2, "additions": 0, "deletions": 1}
    kinds = [rv.get("type", "replace") for rv in revs]
    assert kinds == ["replace", "deletion", "replace"]
    assert revs[0]["proposed"].endswith("in order to participate in the governance of the Cardano Blockchain ecosystem. We invite all who share our values to join us for as long as they wish, while honoring the freedom to take another path. Hello")
    # That bullet occurs several times in the base, so the revision is widened
    # with the preceding (unchanged) line to make it unambiguous.
    assert revs[2]["original"].endswith("\n\n- External economic factors") and base.count(revs[2]["original"]) == 1
    assert revs[2]["proposed"].endswith('\n\n- External economic factors \u2014 "quoted" [note]')   # "-" bullet, straight quotes, no escapes
    modified, applied = main._apply_revisions(base, revs)
    assert applied == 3 and "\\" not in modified and "\n* " not in modified


def test_derived_list_item_edit_matches_highlight_style(client, db):
    """Editing one numbered/bulleted line yields original/proposed without the
    list marker (as a highlight of the rendered text would), yet the draft keeps
    the marker. A deleted list item keeps its marker so the whole line goes."""
    seed_user(db, AUTHOR_ADDR, "Alice")
    base = _base_text()
    lines = base.split("\n")
    i7 = next(i for i, l in enumerate(lines) if l.startswith("7. Net Change Limit."))
    i_del = next(i for i, l in enumerate(lines) if l.startswith("TENET 10"))
    edited = lines[:]
    edited[i7] = lines[i7] + " Extra words."
    i_b = next(i for i, l in enumerate(lines) if l == "- Network security concerns")
    edited[i_b] = "- Network security concerns and threats"
    del edited[i_del]
    r = client.post("/constitution/derive-revisions", json={"content": "\n".join(edited)}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == 200, r.text
    revs = r.json()["revisions"]
    seven = next(rv for rv in revs if "Net Change Limit" in rv.get("original", ""))
    assert seven["original"].startswith("Net Change Limit. The maximum")      # no "7. "
    assert seven["proposed"].startswith("Net Change Limit.") and seven["proposed"].endswith(" Extra words.")
    bullet = next(rv for rv in revs if "Network security" in rv.get("original", ""))
    assert bullet["original"] == "Network security concerns"                # no "- "
    assert bullet["proposed"] == "Network security concerns and threats"
    dele = next(rv for rv in revs if rv.get("type") == "deletion")
    assert dele["original"] == lines[i_del].strip()
    modified, applied = main._apply_revisions(base, revs)
    assert applied == 3
    assert "7. Net Change Limit. The maximum" in modified and " Extra words." in modified
    assert "- Network security concerns and threats" in modified
    assert "TENET 10" not in modified


# ── docs/upload-test-files: every fixture behaves as its README says ──────────

def _fixture_cases():
    import importlib.util
    from pathlib import Path
    path = Path(__file__).resolve().parents[2] / "docs" / "upload-test-files" / "make_fixtures.py"
    spec = importlib.util.spec_from_file_location("make_fixtures", path)
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod.build(_base_text())


@pytest.mark.parametrize("case", _fixture_cases(), ids=lambda c: c["file"])
def test_upload_fixture(client, db, case):
    seed_user(db, AUTHOR_ADDR, "Alice")
    exp = case["expect"]
    r = client.post("/constitution/derive-revisions", json={"content": case["text"]}, headers=auth(AUTHOR_ADDR, "Alice"))
    assert r.status_code == exp["status"], r.text[:300]
    if exp["status"] != 200:
        assert exp["detail"] in r.json()["detail"]
        return
    body = r.json()
    if "counts" in exp:
        assert body["counts"] == exp["counts"], body["counts"]
    assert len(body["warnings"]) == exp.get("warnings", 0)
    base = _base_text()
    if exp.get("unique_originals"):
        for rv in body["revisions"]:
            assert base.count(rv["original"]) == 1
    if exp.get("no_markers"):
        for rv in body["revisions"]:
            assert not main._LIST_MARKER_RE.match(rv["original"]) and not main._LIST_MARKER_RE.match(rv["proposed"])
    # Whatever the shape of the revisions, applying them must reproduce the upload.
    modified, applied = main._apply_revisions(base, body["revisions"])
    assert applied == len(body["revisions"])
    canon = lambda t: [main._canon_line(l) for l in main._unwrap_paragraphs(main._norm_upload_text(t)).split("\n") if l.strip()]
    assert canon(modified) == canon(case["text"]), case["file"]


# ── Highlighted (rendered) passages: emphasis dropped, repeated lines ──────────

def test_rendered_anchor_with_emphasis_and_repeats_is_located_by_section(client, db):
    """A highlight of the rendered page yields "governance action deposit (govDeposit)"
    for the source line "- *governance action deposit* (*govDeposit*)", which
    occurs in both Appendix I and Appendix II. The emphasis must be ignored and
    the revision's section label must pick the right occurrence."""
    base = _base_text()
    lines = base.split("\n")
    occ = [i for i, l in enumerate(lines) if l == "- *governance action deposit* (*govDeposit*)"]
    assert len(occ) == 2
    anchor = "governance action deposit (govDeposit)"
    # Both occurrences sit under Appendix I, so the h2 section cannot decide:
    # the first is used and the call is flagged as ambiguous.
    amb = []
    assert main._match_span(base, anchor, "Appendix I Guardrails", None, amb) is not None and amb
    # The reader records the heading chain above a highlight; that decides.
    chains = (("APPENDIX I. CARDANO BLOCKCHAIN GUARDRAILS › 2.1. Critical Protocol Parameters › Parameters that are Critical to the Operation of the Blockchain", occ[0]),
              ("APPENDIX I. CARDANO BLOCKCHAIN GUARDRAILS › 9. List of Protocol Parameter Groups", occ[1]))
    for context, want in chains:
        revs = [{"type": "addition", "insert_after": anchor, "proposed": "- *new parameter* (*newParam*)", "section": "Appendix I Guardrails", "context": context}]
        unmatched, ambiguous = [], []
        modified, applied = main._apply_revisions(base, revs, unmatched, ambiguous)
        assert applied == 1 and unmatched == [] and ambiguous == [], context
        out = modified.split("\n")
        assert out[want + 1] == "- *new parameter* (*newParam*)", context
    # The six anchors from the live draft (all rendered list items), each in Appendix I.
    anchors = ["governance action deposit (govDeposit)",
               "maximum number of collateral inputs (maxCollateralInputs)",
               "minimum fixed rewards cut for pools (minPoolCost)",
               "pool pledge influence (poolPledgeInfluence)"]
    revs = [{"type": "addition", "insert_after": a, "proposed": f"- *added after {i}*", "section": "Appendix I Guardrails"} for i, a in enumerate(anchors)]
    unmatched, ambiguous = [], []
    modified, applied = main._apply_revisions(base, revs, unmatched, ambiguous)
    assert applied == len(anchors) and unmatched == []
    assert ambiguous, "repeated lines without a heading chain are applied at the first and flagged"
    # A replacement whose rendered original lost the emphasis around a term.
    revs = [{"original": "MPC-01 (y) minPoolCost must not be negative", "proposed": "MPC-01 (y) *minPoolCost* must be positive", "section": "Appendix I Guardrails"}]
    modified, applied = main._apply_revisions(base, revs)
    assert applied == 1 and "MPC-01 (y) *minPoolCost* must be positive" in modified and "MPC-01 (y) *minPoolCost* must not be negative" not in modified


def test_exact_match_of_repeated_line_prefers_heading_context(client, db):
    base = _base_text()
    lines = base.split("\n")
    occ = [i for i, l in enumerate(lines) if l == "- *maximum transaction size* (*maxTxSize*)"]
    assert len(occ) == 2
    revs = [{"original": "- *maximum transaction size* (*maxTxSize*)", "proposed": "- *maximum transaction size* (*maxTxSize*) in bytes",
             "section": "Appendix I Guardrails", "context": "APPENDIX I. CARDANO BLOCKCHAIN GUARDRAILS › 9. List of Protocol Parameter Groups"}]
    ambiguous = []
    modified, _ = main._apply_revisions(base, revs, None, ambiguous)
    out = modified.split("\n")
    assert out[occ[1]].endswith("in bytes") and out[occ[0]] == lines[occ[0]] and ambiguous == []
    # Without a usable context the first occurrence is used, as before, and flagged.
    revs[0]["context"] = ""
    ambiguous = []
    modified, _ = main._apply_revisions(base, revs, None, ambiguous)
    out = modified.split("\n")
    assert out[occ[0]].endswith("in bytes") and ambiguous == [1]


def test_generate_draft_reports_unmatched_revisions(client, db):
    seed_user(db, AUTHOR_ADDR, "Alice")
    revs = [{"original": "This passage does not exist anywhere", "proposed": "x", "section": "Preamble"},
            {"original": "Cardano is a decentralized ecosystem", "proposed": "Cardano is a decentralised ecosystem", "section": "Preamble"},
            {"type": "addition", "insert_after": "nor this one", "proposed": "y", "section": ""}]
    client.post("/proposals", json=proposal_body(revisions=revs), headers=auth(AUTHOR_ADDR, "Alice"))
    g = client.post("/proposals/1/generate-draft-constitution", headers=auth(AUTHOR_ADDR, "Alice"))
    assert g.status_code == 200
    assert g.json()["applied"] == 1 and g.json()["total"] == 3 and g.json()["unmatched"] == [1, 3] and g.json()["ambiguous"] == []


def test_legacy_ambiguous_anchors_follow_reading_order(client, db):
    """Revisions saved before heading chains existed: when a rendered anchor
    occurs twice, the occurrence after the previous revision's position wins.
    This is the live draft that reported "1 of 7 applied", in its order."""
    base = _base_text()
    anchors = ["governance action deposit (govDeposit)",                         # lines 339 / 1245
               'MBHS-05 (x - "should") maxBlockHeaderSize should be within TCP\'s initial congestion window (3 or 10 MTUs)',   # 751
               'PPI-04 (x - "should") poolPledgeInfluence should not vary by more than +/- 10% in any 18-epoch period (approximately 3 months)',  # 823
               "maximum number of collateral inputs (maxCollateralInputs)",      # 1203
               "minimum fixed rewards cut for pools (minPoolCost)",              # 353 / 1221
               "pool pledge influence (poolPledgeInfluence)"]                    # 1229
    revs = [{"type": "addition", "insert_after": a, "proposed": f"INSERTED-{i} [PENDING]", "section": "Appendix I Guardrails"} for i, a in enumerate(anchors)]
    unmatched, ambiguous = [], []
    modified, applied = main._apply_revisions(base, revs, unmatched, ambiguous)
    assert applied == 6 and unmatched == []
    assert ambiguous == [1, 5]            # the two repeated lines are flagged, the rest are unique
    out = modified.split("\n")
    pos = [next(i for i, l in enumerate(out) if l.startswith(f"INSERTED-{k}")) for k in range(6)]
    assert pos == sorted(pos), "inserts land in reading order"
    groups = out.index("### 9. List of Protocol Parameter Groups")
    assert pos[0] < groups and pos[4] > groups   # govDeposit in 2.1, minPoolCost in the groups list
    assert out[pos[0] - 2] == "- *governance action deposit* (*govDeposit*)"   # prose insert: blank line between
    assert out[pos[4] - 2] == "- *minimum fixed rewards cut for pools* (*minPoolCost*)"


def test_live_cap12_dijkstra_draft_applies_as_intended(client, db):
    """CAP-12 as submitted on the live portal (before heading chains existed)
    reported "1 of 7 revisions were applied". Its revisions, verbatim in the
    author's order: the new parameter bullets go into BOTH parameter lists
    (revision 2 in 2.1, revision 5 in the group list), minPoolMargin next to
    minPoolCost in the group list."""
    base = _base_text()
    new_bullets = "-   *maximum Endorser Block size* (*maxEndorserBlockReferencesSize*)\n\n-   *maximum total transaction size per Endorser Block* (*maxTxSizePerEndorserBlock*)"
    revs = [
        {"type": "addition", "section": "Appendix I Guardrails", "insert_after": "interchangeably.",
         "proposed": "Under Ouroboros Leios, a Block is also referred to as a Ranking Block (RB)."},
        {"type": "addition", "section": "Appendix I Guardrails", "insert_after": "governance action deposit (govDeposit)", "proposed": new_bullets},
        {"type": "addition", "section": "Appendix I Guardrails",
         "insert_after": 'MBHS-05 (x - "should") maxBlockHeaderSize should be within TCP\'s initial congestion window (3 or 10 MTUs)',
         "proposed": "#### **Maximum Endorser Block Size (maxEndorserBlockReferencesSize)**\n\nThe maximum size, in bytes."},
        {"type": "addition", "section": "Appendix I Guardrails",
         "insert_after": 'PPI-04 (x - "should") poolPledgeInfluence should not vary by more than +/- 10% in any 18-epoch period (approximately 3 months)',
         "proposed": "#### **Maximum Pledge Leverage (maxPledgeLeverage)**\n\nPart of the rewards mechanism."},
        {"type": "addition", "section": "Appendix I Guardrails", "insert_after": "maximum number of collateral inputs (maxCollateralInputs)", "proposed": new_bullets},
        {"type": "addition", "section": "Appendix I Guardrails", "insert_after": "minimum fixed rewards cut for pools (minPoolCost)", "proposed": "-   *minimum pool margin* (*minPoolMargin*)"},
        {"type": "addition", "section": "Appendix I Guardrails", "insert_after": "pool pledge influence (poolPledgeInfluence)", "proposed": "-   *maximum pledge leverage* (*maxPledgeLeverage*)"},
    ]
    unmatched, ambiguous = [], []
    modified, applied = main._apply_revisions(base, revs, unmatched, ambiguous)
    assert applied == 7 and unmatched == [] and ambiguous == [2, 6]
    out = modified.split("\n")
    heading_above = lambda k: next(out[j] for j in range(k, -1, -1) if out[j].startswith("#"))
    hits = [i for i, l in enumerate(out) if l.strip() == new_bullets.split("\n")[0].strip()]
    assert len(hits) == 2
    assert heading_above(hits[0]) == "#### Parameters that are Critical to the Operation of the Blockchain"
    assert heading_above(hits[1]) == "### 9. List of Protocol Parameter Groups"
    k = next(i for i, l in enumerate(out) if "*minPoolMargin*" in l)
    assert heading_above(k) == "### 9. List of Protocol Parameter Groups"
    assert out[k - 1] == "- *minimum fixed rewards cut for pools* (*minPoolCost*)"
