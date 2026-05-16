import json
import logging
import os
import threading
import urllib.request
from typing import Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "")
APP_URL = os.environ.get("APP_URL", "http://localhost:5173")

# Keep SMTP_HOST readable so existing callers of the config value still work
SMTP_HOST = os.environ.get("SMTP_HOST", "")


def _send(to: str, subject: str, html: str):
    """Send email via Resend HTTP API in a background thread."""
    def _worker():
        api_key = RESEND_API_KEY or (SMTP_HOST == "smtp.resend.com" and os.environ.get("SMTP_PASSWORD", ""))
        sender = SMTP_FROM or "onboarding@resend.dev"
        if not api_key:
            logger.warning("[email] RESEND_API_KEY not configured — skipping send to %s", to)
            return
        if not to:
            return
        try:
            payload = json.dumps({
                "from": f"CAP Portal <{sender}>",
                "to": [to],
                "subject": subject,
                "html": html,
            }).encode()
            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                body = resp.read().decode()
            logger.info("[email] Sent '%s' to %s — %s", subject, to, body)
        except Exception as e:
            logger.error("[email] Failed to send '%s' to %s: %s", subject, to, e)

    threading.Thread(target=_worker, daemon=True).start()


def _base(content: str, unsubscribe_url: str = None) -> str:
    unsub = f' · <a href="{unsubscribe_url}" style="color:#94a3b8">Unsubscribe</a>' if unsubscribe_url else ''
    return f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
      <div style="background:#1e40af;padding:24px 32px;border-radius:12px 12px 0 0">
        <h1 style="color:white;margin:0;font-size:18px;font-weight:900;letter-spacing:-0.5px">CAP Portal</h1>
      </div>
      <div style="background:#f8fafc;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
        {content}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="font-size:12px;color:#94a3b8;margin:0">
          <a href="{APP_URL}" style="color:#3b82f6">Visit the portal</a>{unsub}
        </p>
      </div>
    </div>"""


def get_user_email(stake_address: str, db: Session) -> Optional[str]:
    from models import User
    user = db.query(User).filter(User.stake_address == stake_address).first()
    return user.email if user and user.email else None


def pref_enabled(stake_address: str, key: str, db: Session) -> bool:
    """Returns True if the notification pref is enabled (default: True when unset)."""
    import json
    from models import User
    user = db.query(User).filter(User.stake_address == stake_address).first()
    if not user or not user.notification_prefs:
        return True
    prefs = json.loads(user.notification_prefs)
    return prefs.get(key, True)


def get_all_editor_emails(db: Session) -> list[str]:
    from models import Editor
    editors = db.query(Editor).all()
    return [e for e in [get_user_email(ed.stake_address, db) for ed in editors] if e]


def get_all_admin_emails(db: Session) -> list[str]:
    from models import Admin
    admins = db.query(Admin).all()
    return [e for e in [get_user_email(a.stake_address, db) for a in admins] if e]


def get_subscriber_emails(proposal_number: int, db: Session) -> list[tuple[str, str]]:
    """Returns list of (email, unsubscribe_token) for all subscribers of a proposal."""
    from models import ProposalSubscriber
    subs = db.query(ProposalSubscriber).filter(
        ProposalSubscriber.proposal_number == proposal_number
    ).all()
    return [(s.email, s.unsubscribe_token) for s in subs]


def get_commenter_emails(proposal_number: int, exclude_stake: str, db: Session) -> list[str]:
    """Returns emails of all users who commented on a proposal (excluding one actor)."""
    from models import Comment, User
    commenters = db.query(Comment.author_stake_address).filter(
        Comment.proposal_number == proposal_number,
        Comment.author_stake_address != exclude_stake
    ).distinct().all()
    emails = []
    for (stake,) in commenters:
        email = get_user_email(stake, db)
        if email:
            emails.append(email)
    return emails


# ── Notification functions ────────────────────────────────────────────────────

def notify_new_proposal(proposal_number: int, proposal_title: str,
                        author_name: str, db: Session):
    from models import Editor, Admin
    editor_stakes = [e.stake_address for e in db.query(Editor).all()]
    admin_stakes = [a.stake_address for a in db.query(Admin).all()]
    all_stakes = list(set(editor_stakes + admin_stakes))
    recipients = [e for s in all_stakes
                  if pref_enabled(s, 'new_proposal', db)
                  for e in [get_user_email(s, db)] if e]
    for email in recipients:
        _send(email, f"New proposal: {proposal_title}", _base(f"""
        <h2 style="margin:0 0 8px;font-size:20px">New Proposal Submitted</h2>
        <p style="color:#64748b;margin:0 0 20px">A new proposal has been submitted and requires attention.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:120px">Number</td>
              <td style="padding:8px 0;font-weight:700">#{proposal_number}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Title</td>
              <td style="padding:8px 0;font-weight:700">{proposal_title}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Author</td>
              <td style="padding:8px 0">{author_name}</td></tr>
        </table>
        <a href="{APP_URL}#proposal/{proposal_number}"
           style="background:#1e40af;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
          View Proposal
        </a>"""))


def notify_new_comment(proposal_number: int, proposal_title: str,
                       author_stake: str, commenter_stake: str, commenter_name: str,
                       comment_preview: str, db: Session):
    preview = comment_preview[:200] + "…" if len(comment_preview) > 200 else comment_preview

    def _comment_body(heading: str) -> str:
        return f"""
        <h2 style="margin:0 0 8px;font-size:20px">{heading}</h2>
        <p style="color:#64748b;margin:0 0 20px"><strong>{commenter_name}</strong> commented on <strong>{proposal_title}</strong></p>
        <blockquote style="border-left:3px solid #3b82f6;margin:0 0 24px;padding:12px 16px;background:white;border-radius:0 8px 8px 0;font-style:italic;color:#475569">
          {preview}
        </blockquote>
        <a href="{APP_URL}#proposal/{proposal_number}"
           style="background:#1e40af;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
          View Discussion
        </a>"""

    # Notify proposal author
    author_email = get_user_email(author_stake, db)
    if author_email and author_stake != commenter_stake and pref_enabled(author_stake, 'comment_on_my_proposal', db):
        _send(author_email, f"New comment on: {proposal_title}",
              _base(_comment_body("New Comment on Your Proposal")))

    # Notify other commenters in the thread
    from models import Comment, User as UserModel
    commenter_stakes = [row[0] for row in db.query(Comment.author_stake_address).filter(
        Comment.proposal_number == proposal_number,
        Comment.author_stake_address != commenter_stake
    ).distinct().all()]
    for stake in commenter_stakes:
        if not pref_enabled(stake, 'comment_in_thread', db):
            continue
        email = get_user_email(stake, db)
        if email and email != author_email:
            _send(email, f"New comment on: {proposal_title}",
                  _base(_comment_body("New Reply in a Discussion You're Following")))

    # Notify subscribers
    for email, token in get_subscriber_emails(proposal_number, db):
        unsub = f"{APP_URL}/unsubscribe?token={token}"
        _send(email, f"New comment on: {proposal_title}",
              _base(_comment_body("New Comment on a Proposal You're Following"), unsub))


def notify_new_suggestion(proposal_number: int, proposal_title: str,
                          author_stake: str, editor_name: str,
                          field: str, db: Session):
    if not pref_enabled(author_stake, 'suggestion_received', db):
        return
    email = get_user_email(author_stake, db)
    if not email:
        return
    _send(email, f"Edit suggestion on: {proposal_title}", _base(f"""
    <h2 style="margin:0 0 8px;font-size:20px">An Editor Has Suggested a Change</h2>
    <p style="color:#64748b;margin:0 0 20px">
      <strong>{editor_name}</strong> suggested a change to the <strong>{field}</strong> field
      of your proposal <strong>{proposal_title}</strong>.
    </p>
    <p style="color:#64748b;margin:0 0 24px">Review and approve or reject it from the proposal page.</p>
    <a href="{APP_URL}#proposal/{proposal_number}"
       style="background:#1e40af;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
      Review Suggestion
    </a>"""))


def notify_suggestion_resolved(proposal_number: int, proposal_title: str,
                                editor_stake: str, field: str,
                                status: str, db: Session):
    if not pref_enabled(editor_stake, 'suggestion_resolved', db):
        return
    email = get_user_email(editor_stake, db)
    if not email:
        return
    colour = "#16a34a" if status == "approved" else "#dc2626"
    label = "Approved" if status == "approved" else "Rejected"
    _send(email, f"Suggestion {label.lower()}: {proposal_title}", _base(f"""
    <h2 style="margin:0 0 8px;font-size:20px">Your Suggestion Was {label}</h2>
    <p style="color:#64748b;margin:0 0 20px">
      Your suggested change to the <strong>{field}</strong> field on
      <strong>{proposal_title}</strong> was
      <span style="color:{colour};font-weight:700">{label.lower()}</span> by the author.
    </p>
    <a href="{APP_URL}#proposal/{proposal_number}"
       style="background:#1e40af;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
      View Proposal
    </a>"""))


def notify_lifecycle_change(proposal_number: int, proposal_title: str,
                             author_stake: str, new_stage: str, db: Session):
    stage_desc = {
        "consultation": "entered the consultation stage and is open for community discussion",
        "ready": "been marked ready for final review",
        "done": "been finalised and closed",
        "withdrawn": "been withdrawn",
    }.get(new_stage, f"moved to {new_stage}")

    def _stage_body(intro: str) -> str:
        return f"""
        <h2 style="margin:0 0 8px;font-size:20px">Proposal Status Updated</h2>
        <p style="color:#64748b;margin:0 0 24px">{intro} <strong>{proposal_title}</strong> has {stage_desc}.</p>
        <a href="{APP_URL}#proposal/{proposal_number}"
           style="background:#1e40af;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
          View Proposal
        </a>"""

    # Notify author
    author_email = get_user_email(author_stake, db)
    if author_email:
        _send(author_email, f"Proposal status update: {proposal_title}",
              _base(_stage_body("Your proposal")))

    # Notify subscribers
    for email, token in get_subscriber_emails(proposal_number, db):
        if email != author_email:
            unsub = f"{APP_URL}/unsubscribe?token={token}"
            _send(email, f"Proposal status update: {proposal_title}",
                  _base(_stage_body("A proposal you're following,"), unsub))
