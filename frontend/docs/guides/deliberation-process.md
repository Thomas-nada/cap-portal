# The Deliberation Process

Every CAP and CIS goes through a mandatory deliberation period after submission. This is the window during which the community discusses, critiques, and refines the proposal before it can advance.

---

## When Does It Start?

The deliberation period begins the moment a proposal is submitted through the portal's Amendment Wizard. There is no separate step to "open" a proposal for discussion — submission and the start of deliberation are the same event. Every proposal enters the **consultation** lifecycle stage immediately on submission.

---

## How Long Does It Last?

The recommended minimum deliberation period depends on the proposal's category:

| Category | Recommended Minimum |
| :--- | :---: |
| Procedural | 60 days |
| Substantive | 60 days |
| Technical | 90 days |
| Interpretive | 30 days |
| Other | 30 days |
| Editorial | 14 days |

These are **recommended minimums**. A proposal may remain in consultation longer if community discussion is ongoing or if the author is incorporating feedback.

The recommended review date is calculated automatically at submission, based on the category you chose in the wizard.

---

## What Happens During Deliberation?

The proposal's **Discussion** thread is the official deliberation space. During this period:

- **Community members** read the proposal and post questions, concerns, support, or suggested changes.
- **The author** responds to feedback, clarifies intent, and updates the proposal if warranted.
- **CAP Editors** conduct an initial review, checking constitutionality, cross-constitutional impact, and editorial quality.

There is no vote during deliberation. The goal is to produce a well-reasoned, community-reviewed proposal — not to reach a binary yes/no outcome at this stage.

---

## Editor Initial Review

During consultation, a CAP Editor may:

- Apply the `review` status tag to signal they're actively assessing the proposal.
- Ask clarifying questions in the discussion thread.
- Leave a structured **suggested edit** on a specific field (the author decides whether to approve or reject it).
- Apply an editor signal (`editor-ok`, `editor-concern`, or `editor-suggested`) to communicate their assessment.

Editors do not approve or reject proposals during the initial review. They facilitate and improve. The author retains full ownership of the proposal's substance.

---

## What Happens When Deliberation Ends?

Once the recommended minimum deliberation period has elapsed, the proposal does not advance automatically. The following steps apply:

1. **The author signals readiness** by clicking "Signal Ready for Review" in their **Author Controls** panel on the proposal page. This applies the `author-ready` label.
2. **A CAP Editor reviews** the proposal for completeness, constitutionality, and readiness — optionally applying the `review` status tag while actively working on it.
3. **When the editor is satisfied**, they move the proposal to the **Ready** lifecycle stage via their **Editor Controls** panel. This requires the `author-ready` signal to be active first.
4. **The `author-ready` signal is automatically cleared** when the stage advances, and will be required again before the next step (Ready → Done).

A proposal is never moved forward without both the author's signal and the editor's confirmation.

---

## Can a Proposal Be Changed During Deliberation?

Yes. Authors can edit their proposal at any time to incorporate feedback or correct errors — every edit creates a new entry in the proposal's version history, so nothing is silently overwritten. Significant changes should be noted in a comment so the community is aware of what changed and why. The deliberation clock does not restart when edits are made. Editing is blocked once a proposal reaches `ready`, `done`, or `withdrawn`.

---

## What If the Author Withdraws?

Authors retain full ownership of their proposals at all times. An author may:

- **Update** the proposal in response to feedback.
- **Withdraw** the proposal directly via their **Author Controls** panel — this applies the `withdrawn` lifecycle label and permanently closes it.
- **Bypass the CAP process entirely** and submit a governance action on-chain directly — the CAP process is not a gatekeeping mechanism.

See [Labels & Workflow](labels-and-workflow) for the editor-initiated withdrawal rules (a two-person confirmation is required if someone other than the author withdraws a proposal).
