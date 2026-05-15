# The Deliberation Process

Every CAP and CIS goes through a mandatory deliberation period after submission. This is the window during which the community discusses, critiques, and refines the proposal before it can advance.

---

## When Does It Start?

The deliberation period begins the moment a GitHub Issue is submitted — whether through the CAP Portal or directly via the GitHub issue form.

There is no separate step to "open" a proposal for discussion. Submission and the start of deliberation are the same event. All proposals enter the **Consultation** stage immediately on submission.

---

## How Long Does It Last?

The recommended minimum deliberation period depends on the proposal's category:

| Category | Recommended Minimum |
| :--- | :---: |
| Procedural | 60 days |
| Substantive | 60 days |
| Technical | Variable |
| Interpretive | 30 days |
| Other | 30 days |
| Editorial | 14 days |

These are **minimums**. A proposal may remain in consultation longer if community discussion is ongoing or if the author is incorporating feedback.

The deliberation end date is calculated automatically when the issue is opened and recorded in the Institutional Metadata footer of the issue body.

---

## What Happens During Deliberation?

The issue comment thread is the official deliberation space. During this period:

- **Community members** read the proposal and post questions, concerns, support, or suggested changes
- **The author** responds to feedback, clarifies intent, and updates the proposal if warranted
- **CAP Editors** conduct an initial review within two weeks of submission, checking constitutionality, cross-constitutional impact, transitional provisions, and editorial quality

There is no vote during deliberation. The goal is to produce a well-reasoned, community-reviewed proposal — not to reach a binary yes/no outcome at this stage.

---

## Editor Initial Review

Within two weeks of submission, a CAP Editor will conduct an initial review. They may:

- Apply the `review` status tag to signal they are actively assessing the proposal
- Ask clarifying questions in the issue comments
- Suggest edits for clarity or structure (the author decides whether to accept them)
- Flag constitutionality concerns or cross-constitutional impacts that need addressing
- Apply an editor signal (`editor-ok`, `editor-concern`, or `editor-suggested`) to communicate their assessment

Editors do not approve or reject proposals during the initial review. They facilitate and improve. The author retains full ownership of the proposal's substance.

---

## What Happens When Deliberation Ends?

Once the recommended minimum deliberation period has elapsed, the proposal does not advance automatically. The following steps apply:

1. **The author signals readiness** by clicking "Signal Ready for Review Board" in their Author Controls panel on the CAP Portal. This applies the `author-ready` label to the proposal.

2. **A CAP Editor reviews** the proposal for completeness, constitutionality, and readiness. The editor applies the `review` status tag while actively working on it.

3. **When the Editor is satisfied**, they move the proposal to the **Ready** lifecycle stage via the CAP Portal. This can only be done once the `author-ready` signal is active.

4. **The `author-ready` signal is automatically cleared** when the stage advances, and will be required again before the next step.

A proposal is never moved forward without both the author's signal and the editor's confirmation.

---

## Can a Proposal Be Changed During Deliberation?

Yes. Authors can edit the issue body at any time to incorporate feedback or correct errors. Significant changes should be noted in a comment so the community is aware of what changed and why. The deliberation clock does not restart when edits are made.

---

## What If the Author Withdraws?

Authors retain full ownership of their proposals at all times. An author may:

- **Update** the proposal in response to feedback
- **Withdraw** the proposal via the Author Controls panel on the CAP Portal — this applies the `withdrawn` lifecycle label and closes the issue
- **Bypass the CAP process entirely** and submit a governance action on-chain directly — the CAP process is not a gatekeeping mechanism

If a proposal is withdrawn, it remains in the repository as a closed issue for the historical record.
