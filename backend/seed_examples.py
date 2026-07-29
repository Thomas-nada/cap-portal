"""
Seed the CAP Portal with realistic example proposals.

Inserts 15 Constitutional Amendment Proposals (CAP) and 5 Constitutional
Issue Submissions (CIS), each with structured content matching the shape the
frontend produces (abstract / motivation / analysis / impact / exhibits /
revisions / category), lifecycle + type + category labels, an initial version
snapshot, a creation audit event, and a few discussion comments.

Usage
-----
    # Local SQLite (default cap.db):
    python seed_examples.py

    # Any Postgres (e.g. Render):
    DATABASE_URL="postgresql://user:pass@host/db" python seed_examples.py

    # Remove previously-seeded example data (matched by author address):
    python seed_examples.py --reset

The seed authors are fabricated community personas with well-formed but
non-real stake addresses, so `--reset` can cleanly identify and remove exactly
the rows this script created without touching genuine submissions.
"""

import sys
import json
import hashlib
from datetime import datetime, timezone, timedelta

# Make imports work whether run from repo root or backend/
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine, Base  # noqa: E402
from models import (  # noqa: E402
    Proposal, Label, Comment, AuditEvent, ProposalVersion, Editor, Admin, Feedback,
)

Base.metadata.create_all(bind=engine)

_BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"


def stake(name: str) -> str:
    """Deterministic, well-formed-looking (but NOT real) mainnet stake address."""
    h = hashlib.sha256(("seed::" + name).encode()).digest()
    body = "".join(_BECH32[b % 32] for b in h)[:52]
    return "stake1u" + body


# ── Fabricated community personas ────────────────────────────────────────────
AUTHORS = {
    "grassroots":  ("Cardano Grassroots DRep",       stake("grassroots")),
    "lido":        ("Lido Nakamoto",                 stake("lido")),
    "eva":         ("Eva Delgado",                   stake("eva")),
    "guild":       ("ADA Governance Guild",          stake("guild")),
    "sundae":      ("Sundae Labs Research",          stake("sundae")),
    "marek":       ("Marek Novak",                   stake("marek")),
    "priya":       ("Priya Ramanathan",              stake("priya")),
    "owl":         ("Owl DRep Collective",           stake("owl")),
    "tomas":       ("Tomas Herrera",                 stake("tomas")),
    "nadia":       ("Nadia Osei",                    stake("nadia")),
    "blockwatch":  ("BlockWatch Analytics",          stake("blockwatch")),
    "kaito":       ("Kaito Yamamoto",                stake("kaito")),
    "fenwick":     ("Fenwick Constitutional",        stake("fenwick")),
    "amara":       ("Amara Okoye",                   stake("amara")),
    "sol":         ("Sol Voskuijlen",                stake("sol")),
}
SEED_STAKE_ADDRESSES = {addr for _, addr in AUTHORS.values()}


def actor(key):
    name, addr = AUTHORS[key]
    return {"sub": addr, "display_name": name}


# ── Operator wallets granted persistent roles ───────────────────────────────
# Real stake addresses (public) that should hold roles on every fresh boot of
# the ephemeral test environment. Editors can label / suggest / flag; the admin
# also manages roles and moderation. Because a real admin is seeded here, the
# self-claim bootstrap stays locked, which is intended — these operators are the
# source of truth.
OPERATOR_EDITORS = [
    ("stake1uyez89upss0p6a7yj50h8f53kgzxphyqzhzwt0ndqntjt3sxh8jp2", "Test Editor 1"),
    ("stake1uxen2hw48lkgzfrl5xrphdw80yu0a7hsldwg2y55aqryx0sllk8uj", "Test Editor 2"),
    ("stake1u8dknvrfz38gr8afd0c8vskmz7dkd79gn05gr8mh6ym3cjs7886dj", "Test Admin"),
]
OPERATOR_ADMINS = [
    ("stake1u8dknvrfz38gr8afd0c8vskmz7dkd79gn05gr8mh6ym3cjs7886dj", "Test Admin"),
]
OPERATOR_STAKE_ADDRESSES = (
    {a for a, _ in OPERATOR_EDITORS} | {a for a, _ in OPERATOR_ADMINS}
)

NOW = datetime.now(timezone.utc)


def days_ago(n):
    return NOW - timedelta(days=n)


# Category → recommended deliberation window (days), mirrors wizard.buildMarkdown
CATEGORY_DAYS = {
    "Procedural": 60, "Substantive": 60, "Technical": 90,
    "Interpretive": 30, "Editorial": 14, "Other": 30,
}


# ── Proposal content ─────────────────────────────────────────────────────────
# Each entry: type, category, author, optional co_authors, stage label,
# created (days ago), the structured text fields, revisions, and comments.

PROPOSALS = [
    # ───────────────────────────── CAPs ─────────────────────────────
    {
        "type": "CAP", "category": "Substantive", "author": "grassroots",
        "co_authors": ["owl"], "stage": "consultation", "created": 12,
        "title": "Automatic DRep inactivity and return to abstain",
        "abstract": (
            "Introduce an explicit constitutional basis for treating persistently "
            "inactive DReps as abstaining, so that voting stake delegated to a DRep "
            "who stops participating does not silently distort quorum and approval "
            "thresholds."
        ),
        "motivation": (
            "Article II Section 4 grants DReps voting power equal to the lovelace "
            "delegated to them, but the Constitution is silent on what happens when a "
            "DRep goes dark. Delegated-but-inactive stake currently drags on every "
            "threshold that is measured against active voting stake, making it harder "
            "for the community to reach decisions even when engaged voters overwhelmingly "
            "agree. Ledger rules already implement a dormancy mechanism; the Constitution "
            "should recognise and constrain it so the behaviour is principled rather than "
            "an implementation accident."
        ),
        "analysis": (
            "We reviewed the last four epochs of DRep participation data. A material "
            "share of registered voting power has not voted on any action in over 20 "
            "epochs. Treating that stake as abstaining (rather than as an implicit 'no') "
            "aligns the on-chain outcome with the intent of delegators who simply stopped "
            "paying attention. The amendment ties the dormancy period to a Guardrail-set "
            "parameter so the exact epoch count can be tuned without a further "
            "constitutional amendment. Test: after enactment, a DRep with no vote for the "
            "configured window is counted in neither the numerator nor the denominator of "
            "any approval threshold until they vote again."
        ),
        "impact": (
            "Positive for decision-making liveness; neutral for engaged DReps. Delegators "
            "retain the right to re-delegate at any time. No change to how an active DRep's "
            "explicit abstain vote is treated."
        ),
        "exhibits": (
            "- DRep participation dataset (epochs 500–540): https://gov.tools/drep_directory\n"
            "- Related discussion: https://forum.cardano.org/c/governance\n"
            "- CIP-1694 rationale on active voting stake: https://github.com/cardano-foundation/CIPs/tree/master/CIP-1694"
        ),
        "revisions": [
            {
                "section": "article-ii-section-4",
                "original": "1.  DReps have voting power equal to the number of lovelace delegated to them.",
                "proposed": (
                    "1.  DReps have voting power equal to the number of lovelace delegated to "
                    "them, except that a DRep who has not cast a vote on any governance action "
                    "for a number of epochs defined in the Cardano Blockchain Guardrails Appendix "
                    "shall be treated as having abstained. Such stake shall be excluded from both "
                    "the participating and total voting stake used to evaluate approval thresholds "
                    "until the DRep next casts a vote."
                ),
            }
        ],
        "comments": [
            ("marek", "Strong support in principle. Please make the dormancy window a Guardrail parameter and not a hard-coded number in the constitutional text — you've done exactly that, good.", 10),
            ("blockwatch", "We can contribute a reproducible notebook computing dormant stake per epoch if it helps the deliberation. The 20-epoch figure matches our own numbers.", 8),
            ("eva", "Concern: a DRep on a long, disclosed sabbatical could be surprised by this. Suggest the notification tooling warns a DRep two epochs before dormancy triggers.", 6),
        ],
    },
    {
        "type": "CAP", "category": "Substantive", "author": "guild",
        "stage": "ready", "created": 41,
        "title": "Establish an explicit minimum quorum for the Constitutional Committee",
        "abstract": (
            "Amend Article III to require that a minimum proportion of sitting CC members "
            "participate in a constitutionality vote for that vote to be valid, closing a "
            "gap where a handful of members could act for the whole Committee."
        ),
        "motivation": (
            "Article III Section 1 requires affirmation by a 'requisite percentage' of CC "
            "members but never fixes what that percentage is measured against when members "
            "are absent. Without a participation floor, a small number of members present "
            "on a given day could determine constitutionality for the entire ecosystem. A "
            "minimum quorum protects the legitimacy of CC decisions and gives the community "
            "confidence that rulings reflect the Committee, not a fraction of it."
        ),
        "analysis": (
            "We propose a two-thirds participation quorum, consistent with common practice "
            "for committees exercising a veto-like function. Where quorum is not met the "
            "vote does not fail on the merits; it simply does not conclude, and the action "
            "remains pending until a quorate vote is held. This avoids weaponising absence "
            "as a way to block or force outcomes. Test: a constitutionality vote recorded "
            "with fewer than the quorum of members participating produces no on-chain effect."
        ),
        "impact": (
            "Raises the legitimacy bar for CC rulings and mildly increases the coordination "
            "burden on the Committee. Interacts with Section 3's no-confidence mechanism, "
            "which is explicitly exempted so governance can never fully deadlock."
        ),
        "exhibits": (
            "- Comparative committee-quorum survey (PDF): https://intersectmbo.org/resources\n"
            "- CC internal procedures thread: https://forum.cardano.org/c/governance/constitutional-committee"
        ),
        "revisions": [
            {
                "section": "article-iii-section-1",
                "original": "3.  No governance action - other than a \"No Confidence\" or \"Update Committee\" action - may be implemented on-chain without affirmation by a requisite percentage of CC members.",
                "proposed": (
                    "3.  No governance action - other than a \"No Confidence\" or \"Update Committee\" "
                    "action - may be implemented on-chain without affirmation by a requisite "
                    "percentage of CC members. A constitutionality vote shall only be valid where "
                    "at least two-thirds of the then-sitting CC members participate; where this "
                    "quorum is not met the governance action remains pending until a quorate vote "
                    "is held."
                ),
            }
        ],
        "comments": [
            ("priya", "Two-thirds feels right for a body with a veto function. Please clarify how vacancies count toward 'then-sitting' — I read it as excluding empty seats, which is correct.", 33),
            ("tomas", "Support. The exemption for No Confidence is essential, otherwise an absent committee could never be replaced.", 30),
        ],
    },
    {
        "type": "CAP", "category": "Procedural", "author": "eva",
        "stage": "consultation", "created": 7,
        "title": "Add a mandatory public comment period before on-chain submission",
        "abstract": (
            "Require that every governance action publish its final rationale document for a "
            "minimum public comment window before it can be submitted on-chain, formalising "
            "the deliberation that already happens informally in tools like this portal."
        ),
        "motivation": (
            "Article II Section 6 already requires a standardised, immutable rationale "
            "document, but nothing guarantees the community sees it before the action is "
            "locked on-chain. In practice good proposers consult first; bad ones can rush a "
            "surprise action to a vote. A short, mandatory comment window levels this up "
            "from etiquette to expectation without slowing genuinely urgent actions, which "
            "are handled by a separate expedited path."
        ),
        "analysis": (
            "The window is set by category in the Guardrails so editorial fixes are not "
            "burdened with the same delay as substantive changes. The requirement is "
            "procedural: failing to observe it is grounds for the CC to consider the action "
            "constitutionally deficient, rather than an automatic on-chain rejection, "
            "keeping enforcement proportionate. Test: an action whose rationale URL was "
            "first published less than the required window before submission is flagged as "
            "non-compliant in the CC's review."
        ),
        "impact": (
            "Improves transparency and reduces surprise actions. Adds latency measured in "
            "days, tuned per category. Emergency hard-fork actions are out of scope and "
            "governed separately."
        ),
        "exhibits": (
            "- Draft comment-window schedule by category: https://cap.intersectmbo.org\n"
            "- Prior art, EIP review windows: https://eips.ethereum.org"
        ),
        "revisions": [
            {
                "section": "article-ii-section-6",
                "type": "addition",
                "insert_after": "2.  Each proposal shall provide sufficient rationale, including at minimum: a title, abstract, justification, and relevant supporting materials.",
                "proposed": (
                    "2a. The rationale document required by this Section shall be published and "
                    "publicly accessible for no less than the comment period specified for its "
                    "category in the Cardano Blockchain Guardrails Appendix before the "
                    "corresponding governance action may be submitted on-chain. This requirement "
                    "does not apply to actions submitted under the emergency procedure defined in "
                    "the Guardrails."
                ),
            }
        ],
        "comments": [
            ("owl", "This is the single most impactful procedural change we could make right now. Surprise actions erode trust faster than any bad parameter choice.", 5),
            ("kaito", "Please make sure the 'published' timestamp is verifiable — otherwise a proposer backdates the URL. Tie it to the metadata anchor hash appearing on-chain.", 3),
        ],
    },
    {
        "type": "CAP", "category": "Substantive", "author": "sundae",
        "co_authors": ["blockwatch"], "stage": "consultation", "created": 19,
        "title": "Recognise data privacy as a guiding Tenet",
        "abstract": (
            "Add a Tenet affirming that the Cardano Blockchain shall not require the "
            "unnecessary disclosure of personal data, complementing the existing consent "
            "Tenet on value and data lock-in."
        ),
        "motivation": (
            "Article I Section 1 protects ada owners against having their value or data "
            "locked in without consent (Tenet 5) but says nothing about minimising the "
            "personal data the ecosystem asks users to reveal in the first place. As "
            "identity and compliance tooling grows on Cardano, a clear privacy Tenet gives "
            "the CC a principle to weigh actions against and signals the ecosystem's values "
            "to builders."
        ),
        "analysis": (
            "The Tenet is intentionally a principle, not a rule: it guides evaluation of "
            "governance actions rather than mandating specific technology. It is drafted to "
            "sit alongside, not override, lawful compliance obligations that individual "
            "participants may have. Test: the CC, when reviewing an action that compels "
            "broad personal-data disclosure, must reference this Tenet in its reasoning."
        ),
        "impact": (
            "Directional and interpretive; no immediate protocol change. Strengthens the "
            "constitutional footing for privacy-preserving design choices."
        ),
        "exhibits": (
            "- Privacy-by-design background: https://www.iso.org/standard/71670.html\n"
            "- Community privacy working group notes: https://forum.cardano.org/c/governance"
        ),
        "revisions": [
            {
                "section": "article-i-section-1",
                "type": "addition",
                "insert_after": "TENET 10 The Cardano Blockchain's monetary system shall promote financial stability. This shall include seeking to preserve the value and utility of ada as a medium of exchange, store of value, and unit of account. The total supply of ada shall not exceed 45,000,000,000 (45,000,000,000,000,000 lovelace).",
                "proposed": (
                    "TENET 11 The Cardano Blockchain shall not require ada owners to disclose "
                    "personal data beyond what is necessary for the operation, security, and "
                    "lawful use of the Cardano Blockchain, and shall favour privacy-preserving "
                    "designs where reasonably available."
                ),
            }
        ],
        "comments": [
            ("nadia", "Numbering as TENET 11 is fine, but the section says the order is not a priority — worth restating that in the rationale so nobody reads 11 as 'least important'.", 15),
            ("fenwick", "Careful with 'lawful use' — it should not become a backdoor that swallows the Tenet. Suggest 'lawful use' be scoped to the participant's own obligations, not any third party's demands.", 12),
        ],
    },
    {
        "type": "CAP", "category": "Interpretive", "author": "fenwick",
        "stage": "consultation", "created": 5,
        "title": "Define \"active voting stake\" for amendment thresholds",
        "abstract": (
            "Clarify, within Article IV, exactly which stake counts as 'active voting stake' "
            "when measuring the 65% amendment threshold, removing ambiguity that could be "
            "exploited to inflate or deflate the effective bar."
        ),
        "motivation": (
            "Article IV Section 1 requires 65% of 'the active voting stake at that time' but "
            "does not define the term. Depending on interpretation, active voting stake "
            "could mean all registered voting stake, only stake that voted on the action, "
            "or something in between — and the choice materially changes how hard it is to "
            "amend the Constitution. Different tools currently display different "
            "percentages, which is corrosive to trust."
        ),
        "analysis": (
            "We propose defining active voting stake as the total voting stake that cast a "
            "Yes, No, or Abstain vote on the action, consistent with how CIP-1694 accounts "
            "for participation. This makes the 65% a share of participants rather than of "
            "the whole registered universe, which is both achievable and honest about who "
            "showed up. Test: three independent explorers computing the amendment "
            "percentage from chain data must agree to the lovelace after enactment."
        ),
        "impact": (
            "Interpretive; does not change the 65% number, only its denominator. Removes a "
            "significant source of tooling disagreement and potential dispute."
        ),
        "exhibits": (
            "- Side-by-side of three explorers disagreeing on a live vote: https://gov.tools\n"
            "- CIP-1694 vote accounting: https://github.com/cardano-foundation/CIPs/tree/master/CIP-1694"
        ),
        "revisions": [
            {
                "section": "article-iv-section-1",
                "original": "Amendments to this Constitution, including the Cardano Blockchain Guardrails Appendix, shall require approval via an on-chain governance action supported by at least 65% of the active voting stake at that time, unless a different threshold is expressly provided in the Cardano Blockchain Guardrails Appendix for the amendment of a particular Guardrail, in which case that threshold shall apply.",
                "proposed": (
                    "Amendments to this Constitution, including the Cardano Blockchain Guardrails "
                    "Appendix, shall require approval via an on-chain governance action supported "
                    "by at least 65% of the active voting stake at that time, unless a different "
                    "threshold is expressly provided in the Cardano Blockchain Guardrails Appendix "
                    "for the amendment of a particular Guardrail, in which case that threshold "
                    "shall apply. For the purposes of this Section, \"active voting stake\" means "
                    "the total voting stake that cast a Yes, No, or Abstain vote on the governance "
                    "action in question."
                ),
            }
        ],
        "comments": [
            ("blockwatch", "This is overdue. We publish two numbers today because the term is undefined and we refuse to pick for the community. Defining it as votes-cast is the honest choice.", 4),
            ("guild", "Agree on votes-cast. Please note this makes explicit Abstain meaningful — it counts toward the denominator, which is the point of registering an abstain in the first place.", 2),
        ],
    },
    {
        "type": "CAP", "category": "Technical", "author": "marek",
        "stage": "consultation", "created": 23,
        "title": "Raise the maxTxSize guardrail bound to support higher throughput",
        "abstract": (
            "Amend the maxTxSize Guardrail in Appendix I to permit a modest, staged increase "
            "in maximum transaction size, unlocking larger scripts and batched transactions "
            "without compromising propagation guarantees."
        ),
        "motivation": (
            "The current maxTxSize ceiling constrains complex Plutus transactions and "
            "batched settlement patterns that are increasingly common. As node performance "
            "and network capacity have improved, the conservative bound set at launch now "
            "leaves headroom unused. Raising the permissible range — not the parameter "
            "itself — lets ada owners choose a higher value through the normal Parameter "
            "Update process when the community judges the network ready."
        ),
        "analysis": (
            "The amendment changes only the upper Guardrail bound, preserving the automated "
            "check while widening it. We include propagation-time simulations at candidate "
            "sizes showing block diffusion staying within the safe fraction of the slot "
            "budget. Because maxTxSize interacts with maxBlockBodySize, the rationale keeps "
            "the ratio between them within the range the Guardrails already recommend. "
            "Test: the Guardrails Script accepts a Parameter Update at the new upper bound "
            "and rejects anything above it."
        ),
        "impact": (
            "Enables larger/batched transactions; slightly increases worst-case block "
            "propagation, kept within documented safety margins. No change unless and until "
            "a separate Parameter Update action actually raises the value."
        ),
        "exhibits": (
            "- Propagation simulation results (notebook): https://github.com/IntersectMBO/cardano-node\n"
            "- Guardrails Appendix, network parameters section: https://cap.intersectmbo.org"
        ),
        "revisions": [
            {
                "section": "appendix-i-2-3-maxtxsize",
                "original": "Transaction Size (maxTxSize)",
                "proposed": (
                    "Transaction Size (maxTxSize) — the upper Guardrail bound applicable to this "
                    "parameter is revised upward as specified in the accompanying rationale, "
                    "subject to the maxTxSize : maxBlockBodySize ratio remaining within the range "
                    "recommended elsewhere in this Appendix."
                ),
            }
        ],
        "comments": [
            ("kaito", "Please attach the raw simulation inputs, not just the charts. SPOs will want to re-run diffusion numbers on their own hardware before signalling.", 20),
            ("sundae", "Supportive of widening the bound rather than setting the value here — that's the correct separation between the Constitution and a Parameter Update.", 18),
            ("tomas", "What does this do to reference-script fee interactions? Worth a paragraph on minFeeRefScriptCoinsPerByte.", 16),
        ],
    },
    {
        "type": "CAP", "category": "Technical", "author": "kaito",
        "stage": "consultation", "created": 28,
        "title": "Tighten the minPoolCost Guardrail to reduce pool-splitting incentives",
        "abstract": (
            "Adjust the minPoolCost Guardrail range in Appendix I so that the minimum fixed "
            "pool cost cannot be set so low that it revives large-scale pool-splitting, "
            "while preserving room for small honest operators."
        ),
        "motivation": (
            "minPoolCost sets a floor on the fixed cost every pool charges. Set too low, it "
            "rewards operators who split stake across many pools to game rewards; set too "
            "high, it squeezes small independent SPOs. The Guardrail should bound the "
            "parameter to a range that discourages Sybil-style splitting without pricing "
            "out the decentralisation the network depends on."
        ),
        "analysis": (
            "We model saturation and reward outcomes across candidate floors and show the "
            "splitting incentive collapses above a threshold well within the range small "
            "operators can sustain. The amendment adjusts only the Guardrail's permissible "
            "range; the live value is still chosen by a Parameter Update. Test: the "
            "Guardrails Script rejects a proposed minPoolCost below the revised floor."
        ),
        "impact": (
            "Reduces multi-pool gaming; must be tuned carefully to avoid harming genuine "
            "small SPOs. Interacts with saturation (k) and the reward equation, discussed "
            "in the rationale."
        ),
        "exhibits": (
            "- Reward-splitting model and sweep: https://github.com/IntersectMBO/cardano-ledger\n"
            "- SPO impact survey: https://forum.cardano.org/c/staking-delegation"
        ),
        "revisions": [
            {
                "section": "appendix-i-2-2-minpoolcost",
                "original": "Minimum Pool Cost (minPoolCost)",
                "proposed": (
                    "Minimum Pool Cost (minPoolCost) — the Guardrail range for this parameter is "
                    "revised so that its lower bound is no less than the value identified in the "
                    "accompanying rationale as the point below which large-scale pool splitting "
                    "becomes economically attractive."
                ),
            }
        ],
        "comments": [
            ("marek", "Careful. The last time minPoolCost was debated, small SPOs were the ones who got hurt. Please include a distributional impact table by pool size decile.", 25),
            ("owl", "Directionally right. Splitting is a real problem, but the floor and k need to move together — reference the k parameter explicitly.", 22),
        ],
    },
    {
        "type": "CAP", "category": "Procedural", "author": "priya",
        "stage": "consultation", "created": 9,
        "title": "Require timely, structured conflict-of-interest disclosure by DReps",
        "abstract": (
            "Strengthen Article II Section 4 to require that DReps disclose material "
            "conflicts of interest before voting, in a structured, machine-readable form, "
            "not merely 'in a timely manner'."
        ),
        "motivation": (
            "The Constitution already asks DReps to disclose compensation, but conflicts of "
            "interest more broadly — voting on an action that funds an entity they control, "
            "for instance — are not squarely addressed, and 'timely' disclosure is often "
            "read as 'eventually'. Delegators deserve to know about a conflict before a "
            "vote is cast, in a form tools can surface, not buried in a forum post."
        ),
        "analysis": (
            "The amendment adds a pre-vote disclosure obligation and points to a Guardrails-"
            "defined schema so disclosures are consistent and indexable. It stops short of "
            "prohibiting conflicted votes — that judgement stays with delegators — but "
            "makes the conflict visible when it matters. Test: a DRep voting on an action "
            "in which they have a declared interest has an on-chain or anchored disclosure "
            "dated on or before the vote."
        ),
        "impact": (
            "Improves accountability and delegator information. Modest added process for "
            "DReps; none for delegators. Complements the existing compensation-disclosure "
            "rule rather than replacing it."
        ),
        "exhibits": (
            "- Proposed disclosure schema draft: https://cap.intersectmbo.org\n"
            "- Governance transparency discussion: https://forum.cardano.org/c/governance"
        ),
        "revisions": [
            {
                "section": "article-ii-section-4",
                "original": "3.  DReps shall ensure that any compensation received in connection with their activities as a DRep is publicly disclosed in a timely manner through relevant governance communication channels.",
                "proposed": (
                    "3.  DReps shall ensure that any compensation received in connection with their "
                    "activities as a DRep, and any material conflict of interest relating to a "
                    "governance action on which they intend to vote, is publicly disclosed. "
                    "Conflict-of-interest disclosures shall be made before the DRep votes on the "
                    "action concerned, in the structured form specified in the Cardano Blockchain "
                    "Guardrails Appendix."
                ),
            }
        ],
        "comments": [
            ("eva", "Please define 'material' or the requirement becomes unenforceable. Even a rough threshold (e.g. beneficial interest in the recipient) helps.", 7),
            ("guild", "Machine-readable disclosures are the key part. If it's a forum post, no tool can warn a delegator in time. Keep the schema requirement front and centre.", 5),
        ],
    },
    {
        "type": "CAP", "category": "Substantive", "author": "tomas",
        "stage": "consultation", "created": 15,
        "title": "Define an emergency hard-fork procedure with heightened safeguards",
        "abstract": (
            "Add an explicit, tightly-scoped emergency procedure for Hard Fork Initiation "
            "actions that address an active security threat, with compressed timelines but "
            "heightened review and mandatory retrospective disclosure."
        ),
        "motivation": (
            "Article II Section 6 rightly demands technical review for Hard Fork Initiation, "
            "but the normal process is not built for a live exploit that must be closed in "
            "hours. Today the community would either move too slowly or improvise outside "
            "the Constitution. A defined emergency path lets Cardano respond fast while "
            "keeping the response inside constitutional bounds and fully accountable after "
            "the fact."
        ),
        "analysis": (
            "The emergency path compresses comment windows and permits expedited CC review, "
            "but raises the participation and disclosure bar: a supermajority of "
            "participating CC members, a published threat description as soon as safe, and "
            "a mandatory full retrospective within a fixed period. It is available only for "
            "actions whose stated purpose is to mitigate an active, demonstrable threat to "
            "the security or integrity of the Cardano Blockchain. Test: an action invoking "
            "the emergency path without a threat description, or lacking the retrospective, "
            "is treated as constitutionally deficient."
        ),
        "impact": (
            "Enables rapid, legitimate crisis response; creates a narrow fast path that must "
            "be guarded against misuse. The heightened disclosure and retrospective "
            "requirements are the primary anti-abuse controls."
        ),
        "exhibits": (
            "- Incident-response playbook draft: https://intersectmbo.org/resources\n"
            "- Comparable emergency-fork precedents write-up: https://forum.cardano.org/c/governance"
        ),
        "revisions": [
            {
                "section": "article-ii-section-6",
                "type": "addition",
                "insert_after": "3.  \"Hard Fork Initiation\" and \"Parameter Update\" actions shall undergo sufficient technical review and scrutiny as mandated by the Guardrails to ensure that the governance action does not endanger the security, functionality, performance, or long-term sustainability of the Cardano Blockchain.",
                "proposed": (
                    "4.  A \"Hard Fork Initiation\" action whose stated purpose is to mitigate an "
                    "active and demonstrable threat to the security or integrity of the Cardano "
                    "Blockchain may proceed under the expedited emergency procedure set out in the "
                    "Cardano Blockchain Guardrails Appendix. Any action so submitted shall require "
                    "affirmation by a supermajority of the participating CC members, shall publish "
                    "a description of the threat as soon as doing so no longer increases risk, and "
                    "shall be accompanied by a full public retrospective within the period "
                    "specified in the Appendix."
                ),
            }
        ],
        "comments": [
            ("fenwick", "The retrospective requirement is what makes this safe. Without it, 'emergency' becomes an all-purpose bypass. Consider making the retrospective deadline non-waivable.", 13),
            ("marek", "Define 'active and demonstrable' with at least one worked example, or every proposer will claim emergency. A live, reproducible exploit — not a theoretical CVE.", 11),
            ("sol", "Who declares the emergency? The proposer asserting it isn't enough. Suggest the CC must affirm the emergency character before the compressed timeline applies.", 9),
        ],
    },
    {
        "type": "CAP", "category": "Substantive", "author": "nadia",
        "stage": "consultation", "created": 17,
        "title": "Require the Constitutional Committee to publish structured dissent",
        "abstract": (
            "Amend Article III Section 4 so that when the CC rules a governance action "
            "unconstitutional, dissenting members may — and the majority must — record "
            "reasoning in a consistent, referenceable format."
        ),
        "motivation": (
            "Section 4 already requires each member voting 'unconstitutional' to cite "
            "specific Articles, which is excellent, but there is no structure to dissent "
            "when the Committee is split, and no consistent format for the community to "
            "learn from rulings. Structured, comparable reasoning turns CC decisions into a "
            "body of precedent the ecosystem can rely on."
        ),
        "analysis": (
            "The amendment keeps the existing citation duty and adds that split decisions "
            "record both majority and minority reasoning against the same schema, so "
            "rulings become searchable precedent. It changes documentation, not the "
            "substantive standard the CC applies. Test: a published CC ruling on a contested "
            "action includes both the majority basis and any dissent in the defined format."
        ),
        "impact": (
            "Builds an accountable, learnable record of constitutional interpretation. Small "
            "added drafting burden on the CC; large long-term benefit to predictability."
        ),
        "exhibits": (
            "- Proposed ruling schema: https://cap.intersectmbo.org\n"
            "- Discussion on CC precedent: https://forum.cardano.org/c/governance/constitutional-committee"
        ),
        "revisions": [
            {
                "section": "article-iii-section-4",
                "original": "2.  When voting that a governance action proposed to be executed on-chain is unconstitutional, each CC member casting such a vote shall set forth the basis for its decision with reference to specific Articles of this Constitution or provisions of the Cardano Blockchain Guardrails Appendix that are in conflict with a given proposal.",
                "proposed": (
                    "2.  When voting that a governance action proposed to be executed on-chain is "
                    "unconstitutional, each CC member casting such a vote shall set forth the basis "
                    "for its decision with reference to specific Articles of this Constitution or "
                    "provisions of the Cardano Blockchain Guardrails Appendix that are in conflict "
                    "with a given proposal. Where the Committee is divided, the published decision "
                    "shall record both the majority reasoning and any dissenting reasoning, each "
                    "in the structured format specified in the Cardano Blockchain Guardrails "
                    "Appendix, so that decisions form a consistent and referenceable record."
                ),
            }
        ],
        "comments": [
            ("priya", "Precedent is exactly the right framing. A consistent schema is what lets tooling link a new action to prior rulings on the same Article.", 14),
            ("amara", "Make sure dissent is protected, not just permitted. Members should not face pressure to suppress a minority view for the sake of a tidy record.", 12),
        ],
    },
    {
        "type": "CAP", "category": "Procedural", "author": "owl",
        "stage": "ready", "created": 52,
        "title": "Lower the amendment threshold for purely editorial corrections",
        "abstract": (
            "Create a narrow, safeguarded category of purely editorial amendments (typos, "
            "cross-references, formatting) that may be enacted at a lower threshold than the "
            "65% required for substantive change."
        ),
        "motivation": (
            "Article IV applies a single 65% bar to every amendment, from rewriting a Tenet "
            "to fixing a broken cross-reference. Requiring the same supermajority for a "
            "typo discourages the community from ever cleaning up the text, so errors "
            "accumulate. A lower bar for genuinely editorial changes — with strict "
            "guardrails on what qualifies — keeps the document accurate without weakening "
            "protection of its substance."
        ),
        "analysis": (
            "'Editorial' is defined narrowly and enforced by the CC: a change qualifies only "
            "if it makes no difference to the meaning or operation of any provision. Any "
            "dispute about whether a change is editorial defaults it to the substantive "
            "65% path. This asymmetry means the lower threshold can never be used to sneak "
            "through substance. Test: a proposed editorial amendment that the CC finds "
            "alters meaning is rejected on the editorial path and must be resubmitted as "
            "substantive."
        ),
        "impact": (
            "Keeps the constitutional text clean and correct. The main risk — substance "
            "smuggled as editorial — is contained by the CC gate and the default-to-"
            "substantive rule."
        ),
        "exhibits": (
            "- Backlog of known editorial errata: https://cap.intersectmbo.org\n"
            "- Threshold comparison memo: https://intersectmbo.org/resources"
        ),
        "revisions": [
            {
                "section": "article-iv-section-1",
                "type": "addition",
                "insert_after": "Amendments to this Constitution, including the Cardano Blockchain Guardrails Appendix, shall require approval via an on-chain governance action supported by at least 65% of the active voting stake at that time, unless a different threshold is expressly provided in the Cardano Blockchain Guardrails Appendix for the amendment of a particular Guardrail, in which case that threshold shall apply.",
                "proposed": (
                    "An amendment that is purely editorial — correcting typographical errors, "
                    "broken cross-references, numbering, or formatting without altering the "
                    "meaning or operation of any provision — may be approved at the lower threshold "
                    "specified in the Cardano Blockchain Guardrails Appendix. Where the "
                    "Constitutional Committee determines that a proposed editorial amendment would "
                    "alter meaning, the amendment shall instead be subject to the threshold in the "
                    "preceding paragraph."
                ),
            }
        ],
        "comments": [
            ("fenwick", "The default-to-substantive rule is the whole ballgame and you've drafted it correctly. Without it this would be a loophole; with it, it's just good hygiene.", 44),
            ("tomas", "Support. Suggest the editorial threshold still be meaningful (not trivially low) so even clean-ups reflect real consensus.", 40),
        ],
    },
    {
        "type": "CAP", "category": "Editorial", "author": "amara",
        "stage": "done", "created": 88,
        "title": "Editorial: standardise capitalisation of \"ada\" and \"ada owner\"",
        "abstract": (
            "A purely editorial amendment aligning the capitalisation of 'ada' and 'ada "
            "owner' throughout the Constitution, which currently mixes 'ada', 'ADA', and "
            "'Ada owner' inconsistently."
        ),
        "motivation": (
            "The text uses several inconsistent forms for the same terms. While harmless to "
            "meaning, the inconsistency looks careless in the ecosystem's foundational "
            "document and complicates precise quotation and tooling that matches on the "
            "term. Standardising on the lowercase 'ada' convention used by the Cardano "
            "Foundation resolves it."
        ),
        "analysis": (
            "This change is strictly cosmetic and alters no meaning or operation, making it "
            "a candidate for the editorial path. Every occurrence is enumerated in the "
            "exhibits so reviewers can confirm no substantive text moves. Test: a diff of "
            "the amended document against the original shows only capitalisation changes to "
            "the enumerated terms."
        ),
        "impact": (
            "None to meaning; improves consistency and quotability. Sets a precedent for "
            "handling the editorial backlog."
        ),
        "exhibits": (
            "- Full enumeration of affected occurrences: https://cap.intersectmbo.org\n"
            "- Cardano Foundation style guidance: https://cardanofoundation.org"
        ),
        "revisions": [
            {
                "section": "article-ii-section-2",
                "original": "### Section 2 Participation Rights of ada owners",
                "proposed": "### Section 2 Participation Rights of ada owners",
            }
        ],
        "comments": [
            ("owl", "Enacted cleanly as the first test of the editorial-path idea. Good to have the enumeration on record for the audit trail.", 70),
        ],
    },
    {
        "type": "CAP", "category": "Substantive", "author": "sol",
        "stage": "consultation", "created": 21,
        "title": "Strengthen Treasury Withdrawal audit-administrator independence",
        "abstract": (
            "Amend Article II Section 7 to require that the administrators overseeing a "
            "Treasury Withdrawal, and the independent auditors it funds, be independent of "
            "the withdrawal's recipient."
        ),
        "motivation": (
            "Section 7 already requires audits, oversight administrators, and segregated "
            "accounts — a strong framework — but does not require the administrator or "
            "auditor to be independent of the recipient. In practice a recipient could "
            "nominate a friendly administrator, hollowing out the oversight. Requiring "
            "independence makes the existing safeguards real."
        ),
        "analysis": (
            "The amendment adds an independence requirement and points to a Guardrails-"
            "defined standard for what independence means (no controlling relationship, no "
            "shared beneficial ownership, no undisclosed compensation link). It builds on "
            "the segregated-account and abstain-delegation rules already in Section 7. "
            "Test: a Treasury Withdrawal naming an administrator or auditor with a "
            "controlling relationship to the recipient is constitutionally deficient."
        ),
        "impact": (
            "Materially strengthens treasury oversight. Slightly narrows the pool of "
            "eligible administrators; the Guardrails standard keeps 'independence' concrete "
            "rather than subjective."
        ),
        "exhibits": (
            "- Draft independence standard: https://cap.intersectmbo.org\n"
            "- Treasury oversight discussion: https://forum.cardano.org/c/governance/treasury"
        ),
        "revisions": [
            {
                "section": "article-ii-section-7",
                "original": "5.  \"Treasury Withdrawals\" actions shall designate one or more administrators responsible for monitoring how the funds are used, and ensuring the deliverables are achieved.",
                "proposed": (
                    "5.  \"Treasury Withdrawals\" actions shall designate one or more administrators "
                    "responsible for monitoring how the funds are used, and ensuring the "
                    "deliverables are achieved. Each such administrator, and any independent "
                    "auditor funded under paragraph 4, shall be independent of the Treasury "
                    "Withdrawal Recipient in accordance with the independence standard set out in "
                    "the Cardano Blockchain Guardrails Appendix."
                ),
            }
        ],
        "comments": [
            ("blockwatch", "This closes the most obvious hole in Section 7. An audit funded by, and reporting to, the recipient's own pick is not an audit.", 19),
            ("nadia", "Independence standard belongs in the Guardrails, agreed — it needs to be tunable as we learn what conflicts actually arise in practice.", 16),
        ],
    },
    {
        "type": "CAP", "category": "Interpretive", "author": "lido",
        "stage": "consultation", "created": 6,
        "title": "Clarify SPO voting scope on security-relevant parameters",
        "abstract": (
            "Interpretive amendment clarifying which Parameter Update actions count as "
            "'security-relevant' for the purpose of SPO voting under Article II Section 5, "
            "by anchoring the term to the Guardrails' own parameter classification."
        ),
        "motivation": (
            "Section 5 gives SPOs a vote on Parameter Updates 'that affect security-relevant "
            "parameters', but the Constitution never lists which parameters those are. The "
            "Guardrails Appendix already classifies parameters (critical to operation, "
            "critical to governance, economic, network); anchoring 'security-relevant' to "
            "that classification removes ambiguity about when SPOs vote."
        ),
        "analysis": (
            "The amendment defines 'security-relevant parameters' as those the Guardrails "
            "classify as critical to the operation of the blockchain or critical to the "
            "governance system, which are the categories where SPO operational expertise is "
            "most relevant. This is interpretive: it does not add or remove any SPO right, "
            "it makes the existing right precise. Test: for any Parameter Update, whether "
            "SPOs vote follows deterministically from the Guardrails' classification of the "
            "parameters it touches."
        ),
        "impact": (
            "Removes uncertainty about SPO voting eligibility per action. No change to the "
            "set of voting bodies or thresholds."
        ),
        "exhibits": (
            "- Guardrails parameter classification: https://cap.intersectmbo.org\n"
            "- SPO governance FAQ: https://forum.cardano.org/c/staking-delegation"
        ),
        "revisions": [
            {
                "section": "article-ii-section-5",
                "original": "1.  SPOs shall vote on the following governance actions: \"No Confidence\", \"Update Committee\", \"Hard Fork Initiation\", \"Parameter Update\" that affect security-relevant parameters, and \"Info\" actions.",
                "proposed": (
                    "1.  SPOs shall vote on the following governance actions: \"No Confidence\", "
                    "\"Update Committee\", \"Hard Fork Initiation\", \"Parameter Update\" that affect "
                    "security-relevant parameters, and \"Info\" actions. For this purpose, "
                    "\"security-relevant parameters\" are those classified in the Cardano Blockchain "
                    "Guardrails Appendix as critical to the operation of the blockchain or critical "
                    "to the governance system."
                ),
            }
        ],
        "comments": [
            ("kaito", "Anchoring to the existing classification is elegant — no new list to maintain, and it updates automatically if the Guardrails reclassify a parameter.", 4),
            ("marek", "Agree, though we should double-check that every parameter SPOs currently expect to vote on falls into those two classes. A mapping table in the exhibits would settle it.", 3),
        ],
    },
    {
        "type": "CAP", "category": "Substantive", "author": "guild",
        "co_authors": ["priya"], "stage": "withdrawn", "created": 63,
        "title": "Introduce fixed term limits for Constitutional Committee members",
        "abstract": (
            "Amend Article III Section 2 to impose a hard cap on the number of consecutive "
            "terms a CC member may serve, to guard against entrenchment. (Withdrawn in "
            "favour of a revised proposal.)"
        ),
        "motivation": (
            "Section 2 provides for staggered terms but sets no limit on how many a member "
            "may serve, allowing indefinite incumbency. Rotation brings fresh perspectives "
            "and reduces capture risk on a body with a veto function. This proposal "
            "originally sought a strict two-consecutive-term cap."
        ),
        "analysis": (
            "During consultation, the community raised that a hard cap discards experienced "
            "members precisely when continuity matters most, and that the ada owners "
            "already control terms via the Update Committee action. The authors agreed the "
            "concern was strong enough to redesign around a cooling-off period rather than "
            "an absolute cap, and are withdrawing this version. Test: n/a — withdrawn."
        ),
        "impact": (
            "Withdrawn. Superseded by a follow-up proposal exploring a one-term cooling-off "
            "period instead of a hard cap."
        ),
        "exhibits": (
            "- Consultation summary explaining the withdrawal: https://cap.intersectmbo.org\n"
            "- Follow-up proposal thread: https://forum.cardano.org/c/governance/constitutional-committee"
        ),
        "revisions": [
            {
                "section": "article-iii-section-2",
                "original": "2.  To assure continuity in the operation of the CC, the terms for CC members shall be staggered.",
                "proposed": (
                    "2.  To assure continuity in the operation of the CC, the terms for CC members "
                    "shall be staggered. No member shall serve more than two consecutive terms."
                ),
            }
        ],
        "comments": [
            ("amara", "Withdrawing this was the right call. A cooling-off period gets the anti-entrenchment benefit without throwing away institutional memory. Looking forward to the follow-up.", 55),
            ("tomas", "Agree the redesign is better. Please link the successor proposal here once it's up so the trail is complete.", 53),
        ],
    },

    # ───────────────────────────── CIS ─────────────────────────────
    {
        "type": "CIS", "category": "Interpretive", "author": "blockwatch",
        "stage": "consultation", "created": 11,
        "title": "Ambiguity in \"not unreasonable\" transaction cost (Tenet 2)",
        "abstract": (
            "Tenet 2 requires transaction costs to be 'predictable and not unreasonable', "
            "but the Constitution offers no basis for judging what is unreasonable, leaving "
            "fee-related governance actions without a shared yardstick."
        ),
        "motivation": (
            "When a Parameter Update touches fees, proponents and opponents each claim the "
            "result is (un)reasonable under Tenet 2, and there is no principled way to "
            "adjudicate. 'Predictable' is testable; 'not unreasonable' is not defined "
            "against anything — a cost of living? a comparison to other chains? a fraction "
            "of transaction value? The gap makes Tenet 2 hard for the CC to apply "
            "consistently and invites circular debate on every fee change."
        ),
        "analysis": (
            "This submission does not propose specific wording; it asks the community and CC "
            "whether Tenet 2 should be paired with interpretive guidance (in the Guardrails "
            "or as CC precedent) establishing reference points for 'reasonable' — for "
            "example, a target range relative to value transferred, or a benchmark against "
            "comparable networks — while preserving the Tenet's flexibility. The aim is a "
            "shared analytical frame, not a hard cap on fees."
        ),
        "impact": (
            "If unresolved, every fee-related action re-litigates the meaning of Tenet 2. "
            "Resolving it would give the CC and proposers a consistent lens and reduce "
            "governance friction on economic parameters."
        ),
        "exhibits": (
            "- Fee comparison across chains (data): https://gov.tools\n"
            "- Prior fee-debate threads: https://forum.cardano.org/c/governance"
        ),
        "revisions": [],
        "comments": [
            ("marek", "Good problem statement. I'd caution against a fixed benchmark to another chain — their fee markets differ structurally. A ratio to value transferred is more defensible.", 9),
            ("sundae", "The CC could resolve much of this as precedent rather than a text change. A published interpretive note the first time it applies Tenet 2 to a fee action would go a long way.", 7),
            ("eva", "Worth splitting 'predictable' from 'not unreasonable' explicitly — they're different tests and conflating them muddies the debate every time.", 4),
        ],
    },
    {
        "type": "CIS", "category": "Substantive", "author": "fenwick",
        "stage": "consultation", "created": 14,
        "title": "No defined process for removing a CC member for misconduct",
        "abstract": (
            "The Constitution allows replacing CC members via the Update Committee action, "
            "but provides no dedicated process or standard for removing an individual "
            "member for misconduct short of replacing the whole Committee."
        ),
        "motivation": (
            "Article III Section 3 handles no-confidence and Update Committee at the level of "
            "the Committee, and Section 2 leaves composition to ada owners, but there is no "
            "clear, proportionate path to remove a single member who, say, breaches the "
            "conduct expectations in Section 4. The only tools are blunt (replace everyone) "
            "or informal. That gap risks either paralysis or ad-hoc action outside the "
            "Constitution when a genuine misconduct case arises."
        ),
        "analysis": (
            "The submission asks whether the Constitution should define an individual-removal "
            "process: who may initiate it, what standard of misconduct applies, what "
            "protections the member has (notice, a chance to respond), and what threshold "
            "removes them. It notes the tension between removability (accountability) and "
            "independence (a member should not fear removal for an unpopular but principled "
            "vote). Any solution must protect good-faith dissent while addressing real "
            "misconduct."
        ),
        "impact": (
            "Without a defined process, a single bad actor on the CC is hard to remove "
            "proportionately, and the community may resort to no-confidence in the whole "
            "body. A defined process would make accountability precise and protect the "
            "innocent majority."
        ),
        "exhibits": (
            "- Section 4 conduct expectations (reference): https://cap.intersectmbo.org\n"
            "- Removal-process comparisons: https://intersectmbo.org/resources"
        ),
        "revisions": [],
        "comments": [
            ("amara", "The independence tension is the hard part. Removal must never be usable against a member for how they voted on constitutionality — only for conduct. That line has to be explicit.", 12),
            ("priya", "Suggest any removal require both an initiating threshold and a higher confirming threshold, with the member given a formal right of reply on-record.", 10),
            ("sol", "Agree there's a gap. But be careful not to create a tool that a motivated faction uses to pick off inconvenient members one at a time.", 8),
        ],
    },
    {
        "type": "CIS", "category": "Technical", "author": "sundae",
        "stage": "consultation", "created": 18,
        "title": "Unclear resolution path for Guardrails Script vs Appendix conflicts",
        "abstract": (
            "Article I Section 2 says the on-chain Guardrails Script prevails over the "
            "Appendix text when they conflict, but the process for detecting, disclosing, "
            "and reconciling such conflicts is left vague."
        ),
        "motivation": (
            "Section 2(2) sensibly makes the deployed Guardrails Script authoritative during "
            "an inconsistency and asks the CC to 'seek to reconcile' it via a governance "
            "action. But nothing specifies how a conflict is detected and announced, how "
            "quickly reconciliation must be pursued, or how the community is told which "
            "version currently governs. In practice a silent divergence between the human-"
            "readable Appendix and the executable script could persist unnoticed, "
            "undermining the trust that the two are the same rules."
        ),
        "analysis": (
            "The submission asks for a defined reconciliation lifecycle: a way to "
            "continuously diff the deployed script against the Appendix, a public notice "
            "when they diverge, a target timeframe for the CC to open a reconciling action, "
            "and clear community-facing signalling of which text is currently authoritative. "
            "This is largely procedural and tooling-driven and need not change the "
            "prevailing-version rule itself — only make its operation visible and timely."
        ),
        "impact": (
            "An undetected or unreconciled divergence erodes the core promise that the "
            "Appendix and the script encode the same Guardrails. A defined lifecycle keeps "
            "the two provably aligned and reconciliation accountable."
        ),
        "exhibits": (
            "- Guardrails Script repository: https://github.com/IntersectMBO/plutus\n"
            "- Article I Section 2 (reference): https://cap.intersectmbo.org"
        ),
        "revisions": [],
        "comments": [
            ("kaito", "A continuous automated diff between the deployed script and the Appendix is very doable and should probably run as public infrastructure, not a one-off check.", 16),
            ("blockwatch", "The missing piece is a canonical, machine-readable form of the Appendix Guardrails to diff against. Right now the Appendix is prose, which makes automated comparison hard.", 13),
        ],
    },
    {
        "type": "CIS", "category": "Procedural", "author": "owl",
        "stage": "consultation", "created": 10,
        "title": "DRep compensation disclosure lacks a defined venue and format",
        "abstract": (
            "Article II Section 4 requires DReps to disclose compensation 'through relevant "
            "governance communication channels', but with no defined venue or format, "
            "disclosures are scattered, inconsistent, and effectively unverifiable."
        ),
        "motivation": (
            "The disclosure duty is sound, but 'relevant governance communication channels' "
            "could mean a tweet, a forum post, or a Discord message, and 'timely' is "
            "undefined. A delegator cannot practically find, compare, or verify these "
            "disclosures, so the transparency the Constitution intends does not actually "
            "reach the people it is meant to protect. This is a governance-hygiene gap "
            "rather than a flaw in the principle."
        ),
        "analysis": (
            "The submission asks whether disclosures should be anchored to a canonical, "
            "queryable location (for example, associated with the DRep's on-chain "
            "registration or a standard metadata field) in a defined format, so tools can "
            "surface a DRep's compensation history next to their voting record. It overlaps "
            "with the conflict-of-interest amendment under discussion and could share the "
            "same disclosure schema. No change to the underlying obligation is needed — only "
            "a defined channel and structure."
        ),
        "impact": (
            "Scattered disclosures mean the compensation-transparency rule is largely "
            "unenforceable in practice. A defined venue and format would make it real for "
            "delegators and tooling alike."
        ),
        "exhibits": (
            "- DRep metadata standard (reference): https://github.com/cardano-foundation/CIPs\n"
            "- Related conflict-of-interest proposal: https://cap.intersectmbo.org"
        ),
        "revisions": [],
        "comments": [
            ("priya", "This pairs naturally with the pre-vote conflict-of-interest amendment — same schema, same anchor. Coordinating them avoids two competing disclosure formats.", 8),
            ("guild", "Anchoring to the on-chain DRep registration is the most durable option; forum posts rot and platforms disappear. Metadata that travels with the registration does not.", 6),
        ],
    },
    {
        "type": "CIS", "category": "Substantive", "author": "amara",
        "stage": "consultation", "created": 20,
        "title": "Accountability gap when a Treasury Withdrawal fails to deliver",
        "abstract": (
            "Section 7 requires administrators, audits, and refund circumstances for "
            "Treasury Withdrawals, but is largely silent on what actually happens — and who "
            "is accountable — when a funded recipient fails to deliver."
        ),
        "motivation": (
            "The framework in Section 7 is strong on setup (segregated accounts, audits, "
            "designated administrators, refund circumstances) but thin on consequences. If "
            "a recipient misses deliverables, the Constitution does not make clear who "
            "enforces the refund circumstances, what recourse the community has, or whether "
            "non-delivery affects future eligibility. Oversight that cannot be enforced is "
            "oversight in name only."
        ),
        "analysis": (
            "The submission asks the community to consider whether Section 7 (or the "
            "Guardrails) should define enforcement and consequence: a clear duty on the "
            "administrator to trigger refund circumstances on non-delivery, a public record "
            "of outcomes against deliverables, and whether repeated non-delivery should bear "
            "on a recipient's future funding. It stresses proportionality — honest failure "
            "and bad faith are different — and that the goal is accountability, not "
            "punishing risk-taking."
        ),
        "impact": (
            "Today, a recipient can under-deliver with little defined consequence, weakening "
            "the treasury's credibility. Defined enforcement and an outcomes record would "
            "make the existing safeguards bite and inform future funding decisions."
        ),
        "exhibits": (
            "- Section 7 (reference): https://cap.intersectmbo.org\n"
            "- Treasury outcomes tracking discussion: https://forum.cardano.org/c/governance/treasury"
        ),
        "revisions": [],
        "comments": [
            ("sol", "The outcomes record is the highest-leverage idea here. If delivery-vs-promise is public and durable, delegators can price it into future votes without any punitive rule at all.", 18),
            ("nadia", "Proportionality matters — a funded R&D effort that fails honestly is not the same as a grantee who vanishes. Consequences should distinguish the two or we'll deter ambitious work.", 15),
            ("fenwick", "Whoever the administrator is, the duty to actually pull the refund trigger has to be non-discretionary once deliverables are objectively missed, or it never happens.", 12),
        ],
    },
]


# Example feedback shown on the test/demo Feedback page: (author, category, rating, days_ago, message)
SEED_FEEDBACK = [
    ("marek", "ui", 5, 3, "The side-by-side diff against the current constitution text is genuinely the clearest amendment view I've seen in any governance tool."),
    ("eva", "proposals", 4, 2, "Submitting a CAP through the wizard was smooth. One ask: let me save a draft before I've written every section."),
    ("blockwatch", "governance", 5, 2, "Love that abstain is treated as a real, counted vote in the examples. That framing alone will improve threshold debates."),
    ("nadia", "idea", None, 1, "Could the board show a countdown to the recommended review date? Would make the consultation stage feel more alive."),
    ("kaito", "performance", 4, 1, "Snappy once loaded. The free tier cold start is the only lag — not a portal problem."),
    ("owl", "praise", 5, 0, "This is exactly the kind of transparent, structured deliberation Cardano governance needs. Great demo."),
]


def reset(db):
    q = db.query(Proposal).filter(Proposal.author_stake_address.in_(SEED_STAKE_ADDRESSES))
    n = q.count()
    for p in q.all():
        # comments / labels / versions / audit cascade via relationships
        db.delete(p)
    e = db.query(Editor).filter(Editor.stake_address.in_(OPERATOR_STAKE_ADDRESSES)).delete(
        synchronize_session=False)
    a = db.query(Admin).filter(Admin.stake_address.in_(OPERATOR_STAKE_ADDRESSES)).delete(
        synchronize_session=False)
    f = db.query(Feedback).filter(Feedback.author_stake_address.in_(SEED_STAKE_ADDRESSES)).delete(
        synchronize_session=False)
    db.commit()
    print(f"Removed {n} example proposal(s), {e} editor(s), {a} admin(s), {f} feedback entry(ies).")


def already_seeded(db):
    return db.query(Proposal).filter(
        Proposal.author_stake_address.in_(SEED_STAKE_ADDRESSES)
    ).first() is not None


def make_structured(p):
    return {
        "type": p["type"],
        "category": p["category"],
        "abstract": p["abstract"],
        "motivation": p["motivation"],
        "analysis": p.get("analysis", ""),
        "impact": p.get("impact", ""),
        "exhibits": p.get("exhibits", ""),
        "revisions": p.get("revisions", []),
        "co_authors": [AUTHORS[c][0] for c in p.get("co_authors", [])],
    }


def version_hash(title, body, previous_hash):
    return hashlib.sha256(f"{title}|{body}|{previous_hash}".encode()).hexdigest()


def seed_roles(db):
    """Grant persistent editor/admin roles to the operator wallets. Idempotent:
    skips any address that already holds the role."""
    added_e = added_a = 0
    for addr, name in OPERATOR_EDITORS:
        if not db.query(Editor).filter(Editor.stake_address == addr).first():
            db.add(Editor(stake_address=addr, display_name=name, added_at=NOW))
            added_e += 1
    for addr, name in OPERATOR_ADMINS:
        if not db.query(Admin).filter(Admin.stake_address == addr).first():
            db.add(Admin(stake_address=addr, display_name=name, added_at=NOW))
            added_a += 1
    db.commit()
    if added_e or added_a:
        print(f"Seeded {added_e} editor(s) and {added_a} admin(s).")


def seed_feedback(db):
    if db.query(Feedback).first() is not None:
        return
    for key, category, rating, cdays, message in SEED_FEEDBACK:
        a = actor(key)
        db.add(Feedback(
            message=message, rating=rating, category=category, page="#/feedback",
            author_stake_address=a["sub"], author_display_name=a["display_name"],
            created_at=days_ago(cdays),
        ))
    db.commit()
    print(f"Seeded {len(SEED_FEEDBACK)} feedback entries.")


def seed(db):
    seed_roles(db)
    seed_feedback(db)
    last = db.query(Proposal).order_by(Proposal.number.desc()).first()
    number = (last.number + 1) if last else 1

    caps = ciss = 0
    for entry in PROPOSALS:
        a = actor(entry["author"])
        created = days_ago(entry["created"])
        body = json.dumps(make_structured(entry))
        state = "closed" if entry["stage"] in ("done", "withdrawn") else "open"

        p = Proposal(
            number=number,
            title=entry["title"],
            body=body,
            type=entry["type"],
            state=state,
            author_stake_address=a["sub"],
            author_display_name=a["display_name"],
            created_at=created,
            updated_at=created,
        )
        if entry["stage"] == "withdrawn":
            p.state = "closed"
        db.add(p)
        db.flush()

        # Labels: lifecycle stage + type + category (+ author-ready for some)
        labels = [entry["stage"], entry["type"], entry["category"]]
        if entry["stage"] == "ready":
            labels.append("author-ready")
        for name in labels:
            db.add(Label(proposal_number=number, name=name, created_at=created))

        # Initial version snapshot (V1)
        prev = "genesis"
        db.add(ProposalVersion(
            proposal_number=number, version=1, title=entry["title"], body=body,
            change_summary="Initial submission", created_by=a["sub"],
            created_by_name=a["display_name"], previous_hash=prev,
            content_hash=version_hash(entry["title"], body, prev),
            created_at=created,
        ))

        # Creation audit event
        db.add(AuditEvent(
            proposal_number=number, event_type="proposal_created",
            actor_stake_address=a["sub"], actor_display_name=a["display_name"],
            data=json.dumps({"title": entry["title"], "type": entry["type"]}),
            created_at=created,
        ))
        # Lifecycle audit events for advanced stages
        if entry["stage"] in ("ready", "done", "withdrawn"):
            db.add(AuditEvent(
                proposal_number=number,
                event_type=f"label_added",
                actor_stake_address=a["sub"], actor_display_name=a["display_name"],
                data=json.dumps({"label": entry["stage"]}),
                created_at=created + timedelta(days=1),
            ))

        # Comments
        for ckey, cbody, cdays in entry.get("comments", []):
            ca = actor(ckey)
            db.add(Comment(
                proposal_number=number, body=cbody,
                author_stake_address=ca["sub"], author_display_name=ca["display_name"],
                created_at=days_ago(cdays), updated_at=days_ago(cdays),
            ))

        if entry["type"] == "CAP":
            caps += 1
        else:
            ciss += 1
        number += 1

    db.commit()
    print(f"Seeded {caps} CAPs and {ciss} CIS proposals "
          f"(numbers {number - len(PROPOSALS)}–{number - 1}).")


def seed_if_empty():
    """Startup hook for the ephemeral test environment.

    The test API stores its database on Render's ephemeral filesystem, so the
    proposals table is empty every time the free service boots after a sleep,
    restart, or redeploy. When SEED_EXAMPLES is enabled the API calls this on
    startup to repopulate the example proposals, keeping the test portal
    populated instead of coming back blank. It seeds only when the table is
    completely empty, so it never touches a database that already has content.
    """
    db = SessionLocal()
    try:
        if db.query(Proposal).first() is not None:
            return False
        seed(db)
        return True
    finally:
        db.close()


def main():
    args = set(sys.argv[1:])
    db = SessionLocal()
    try:
        if "--reset" in args:
            reset(db)
            if "--seed" not in args and "--force" not in args:
                return
        if already_seeded(db) and "--force" not in args and "--reset" not in args:
            print("Example data already present (matched by seed authors). "
                  "Re-run with --reset to replace it, or --force to add anyway.")
            return
        seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
