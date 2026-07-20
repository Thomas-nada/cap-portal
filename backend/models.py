from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


def now():
    return datetime.now(timezone.utc)


class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(Integer, unique=True, nullable=False, index=True)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    type = Column(String, nullable=False, default="CAP")  # CAP | CIS
    state = Column(String, nullable=False, default="open")  # open | closed
    author_stake_address = Column(String, nullable=False)
    author_display_name = Column(String, nullable=True)
    # Moderation lifecycle: visible | under_review (editor flagged, hidden pending
    # admin decision) | removed (admin confirmed, stays hidden, admin-only).
    moderation_status = Column(String, nullable=False, default="visible")
    # Two-person rule for editor-initiated withdrawal: set when one editor requests
    # withdrawal of someone else's proposal; a second, different editor must confirm.
    withdrawal_requested_by = Column(String, nullable=True)
    withdrawal_requested_by_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)

    labels = relationship("Label", back_populates="proposal", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="proposal", cascade="all, delete-orphan")
    audit_events = relationship("AuditEvent", back_populates="proposal", cascade="all, delete-orphan")
    suggestions = relationship("Suggestion", back_populates="proposal", cascade="all, delete-orphan")
    versions = relationship("ProposalVersion", back_populates="proposal", cascade="all, delete-orphan")


class Label(Base):
    __tablename__ = "labels"

    id = Column(Integer, primary_key=True, index=True)
    proposal_number = Column(Integer, ForeignKey("proposals.number"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)

    proposal = relationship("Proposal", back_populates="labels")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    proposal_number = Column(Integer, ForeignKey("proposals.number"), nullable=False)
    body = Column(Text, nullable=False)
    author_stake_address = Column(String, nullable=False)
    author_display_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)
    # Moderation lifecycle: visible | under_review | removed (see Proposal).
    moderation_status = Column(String, nullable=False, default="visible")

    proposal = relationship("Proposal", back_populates="comments")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True)
    proposal_number = Column(Integer, ForeignKey("proposals.number"), nullable=False)
    event_type = Column(String, nullable=False)
    actor_stake_address = Column(String, nullable=False)
    actor_display_name = Column(String, nullable=True)
    data = Column(Text, nullable=True)  # JSON string
    created_at = Column(DateTime(timezone=True), default=now)

    proposal = relationship("Proposal", back_populates="audit_events")


class Editor(Base):
    __tablename__ = "editors"

    stake_address = Column(String, primary_key=True)
    display_name = Column(String, nullable=True)
    added_at = Column(DateTime(timezone=True), default=now)


class Admin(Base):
    __tablename__ = "admins"

    stake_address = Column(String, primary_key=True)
    display_name = Column(String, nullable=True)
    added_at = Column(DateTime(timezone=True), default=now)


class ProposalVersion(Base):
    __tablename__ = "proposal_versions"

    id = Column(Integer, primary_key=True, index=True)
    proposal_number = Column(Integer, ForeignKey("proposals.number"), nullable=False)
    version = Column(Integer, nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)          # full JSON snapshot
    change_summary = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now)
    created_by = Column(String, nullable=False)
    created_by_name = Column(String, nullable=True)
    previous_hash = Column(String, nullable=True)   # hash of prior version ("genesis" for V1)
    content_hash = Column(String, nullable=True)    # SHA-256(title|body|previous_hash)

    proposal = relationship("Proposal", back_populates="versions")


class Suggestion(Base):
    __tablename__ = "suggestions"

    id = Column(Integer, primary_key=True, index=True)
    proposal_number = Column(Integer, ForeignKey("proposals.number"), nullable=False)
    field = Column(String, nullable=False)          # title | abstract | motivation | analysis | impact | exhibits
    current_value = Column(Text, nullable=True)     # snapshot at suggestion time
    suggested_value = Column(Text, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="pending")  # pending | approved | rejected
    editor_stake_address = Column(String, nullable=False)
    editor_display_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String, nullable=True)

    proposal = relationship("Proposal", back_populates="suggestions")


class AuthChallenge(Base):
    __tablename__ = "auth_challenges"

    challenge = Column(String, primary_key=True)
    created_at = Column(DateTime(timezone=True), default=now)


class RevokedToken(Base):
    """Tokens invalidated by an explicit logout. JWTs are stateless, so without
    this a stolen token would stay usable until it expired even after the user
    disconnected. Rows are purged once past `expires_at` — after that the JWT's
    own `exp` rejects it anyway."""
    __tablename__ = "revoked_tokens"

    jti = Column(String, primary_key=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at = Column(DateTime(timezone=True), default=now)


class User(Base):
    __tablename__ = "users"

    stake_address = Column(String, primary_key=True)
    display_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)


class BugReport(Base):
    __tablename__ = "bug_reports"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    reporter_stake_address = Column(String, nullable=False)
    reporter_display_name = Column(String, nullable=True)
    screenshot = Column(Text, nullable=True)  # base64 data URL
    status = Column(String, nullable=False, default="open")  # open | in_progress | resolved
    environment = Column(Text, nullable=True)  # JSON: page, viewport, user_agent, etc.
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)


class ConstitutionDoc(Base):
    """Runtime-generated constitution documents (e.g. cap-N proposed drafts).

    Stored in the database rather than on disk so they survive redeploys on
    hosts with ephemeral filesystems and are included in database backups.
    The base constitution text ships with the repo and stays on disk.
    """
    __tablename__ = "constitution_docs"

    filename = Column(String, primary_key=True)  # e.g. "cap-12-proposed.md"
    content = Column(Text, nullable=False)       # markdown
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)


class Guide(Base):
    __tablename__ = "guides"

    slug = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)  # markdown
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)
    updated_by = Column(String, nullable=True)
    updated_by_name = Column(String, nullable=True)
    section = Column(String, nullable=False, default='general')
    section_label = Column(String, nullable=True)   # display name, e.g. "Getting Started"
    sort_order = Column(Integer, nullable=False, default=0)


class ModerationCase(Base):
    """A removal request against a proposal or comment.

    Lifecycle: an editor (or admin) flags an item for removal with a reason,
    which hides it and opens a case (status=open). An admin then either
    'removed' it (stays hidden) or 'rejected' the request (item restored),
    each with a required reason.
    """
    __tablename__ = "moderation_cases"

    id = Column(Integer, primary_key=True, index=True)
    target_type = Column(String, nullable=False)          # "proposal" | "comment"
    proposal_number = Column(Integer, nullable=False)     # the proposal, or the comment's proposal
    comment_id = Column(Integer, nullable=True)           # set when target_type == "comment"
    status = Column(String, nullable=False, default="open")  # open | removed | rejected

    flagged_by = Column(String, nullable=False)
    flagged_by_name = Column(String, nullable=True)
    flag_reason = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)

    resolved_by = Column(String, nullable=True)
    resolved_by_name = Column(String, nullable=True)
    resolution_reason = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class AlphaAgreement(Base):
    """Append-only record that a user accepted a specific version of the alpha
    User Agreement — the server-side legal record of acceptance."""
    __tablename__ = "alpha_agreements"

    id = Column(Integer, primary_key=True, index=True)
    stake_address = Column(String, nullable=False, index=True)
    display_name = Column(String, nullable=True)   # name at time of acceptance
    version = Column(String, nullable=False)        # which agreement text
    accepted_at = Column(DateTime(timezone=True), default=now)


class Notification(Base):
    """In-app notification shown in a user's profile/notifications panel."""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    recipient_stake_address = Column(String, nullable=False, index=True)
    type = Column(String, nullable=False)   # flag_pending | under_review | removed | reinstated
    title = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    proposal_number = Column(Integer, nullable=True)   # deep-link target
    read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=now)
