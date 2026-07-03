# Labels and Workflow

Every CAP and CIS in the portal carries a set of labels that indicate its type, category, and current stage in the governance process. This guide explains what each label means and how a proposal moves through the workflow.

---

## Type Labels

These labels identify what kind of proposal it is.

| Label | Meaning |
| :--- | :--- |
| **CAP** | Constitutional Amendment Proposal — proposes a change to the Constitution |
| **CIS** | Constitutional Issue Statement — formally defines a constitutional problem |

---

## Lifecycle Labels

Exactly one lifecycle label is applied to every proposal at all times. It indicates the current stage in the process.

| Label | Meaning |
| :--- | :--- |
| **consultation** | The proposal is open for community deliberation. This is where discussion happens and editors conduct their review. |
| **ready** | Deliberation is complete and the proposal is ready for on-chain submission. |
| **done** | The process is complete. The proposal has been submitted on-chain or otherwise concluded. |
| **withdrawn** | The proposal has been withdrawn and is permanently closed. |

---

## Status Tags

Status tags give additional context about a proposal's current situation. They are set by editors and are optional. Multiple tags may be active at once.

| Label | Meaning |
| :--- | :--- |
| **author-ready** | The author has signalled that they are ready for the proposal to advance to the next stage. Authors apply and remove this one themselves. |
| **review** | The proposal is currently under active editorial review. |
| **revision** | The author is revising the proposal based on feedback. |
| **finalizing** | The editor is preparing the final version of the proposal. |
| **onchain** | The proposal has been submitted to the Cardano blockchain as a governance action. |

---

## Editor Signal Labels

Editors apply one of these labels to communicate their assessment of a proposal.

| Label | Meaning |
| :--- | :--- |
| **editor-ok** | The editor has reviewed the proposal and it meets the required standards. |
| **editor-concern** | The editor has identified issues that need to be addressed. |
| **editor-suggested** | The editor has left a structured suggestion for the author — non-blocking, but recommended. |

---

## Category Labels

The category determines the recommended minimum deliberation period. It is chosen by the author in the submission wizard.

| Label | Deliberation Period | Typical Use |
| :--- | :---: | :--- |
| **Procedural** | 60 days | Changes to governance processes or voting rules |
| **Substantive** | 60 days | Changes to core constitutional rights or obligations |
| **Technical** | 90 days | Updates to technical/economic validation scripts and guardrail parameters |
| **Interpretive** | 30 days | Clarifications or reinterpretations of existing text |
| **Other** | 30 days | Does not clearly fit another category |
| **Editorial** | 14 days | Cosmetic fixes: typos, formatting, grammar — no substantive change |

---

## Special Handling Labels

Applied by editors when a proposal requires non-standard treatment.

| Label | Meaning |
| :--- | :--- |
| **major** | Significant-impact change — requires extra scrutiny |
| **minor** | Small, contained change — lower scrutiny threshold |
| **bundle** | Being processed together with related proposals |
| **fast-track** | Expedited due to urgency |
| **pause** | Processing temporarily suspended |

---

## The Workflow at a Glance

```
Proposal submitted
        │
        ▼
 [consultation] ── community deliberation + editor review ──┐
        │                                                    │
        │  Author signals author-ready                       │ (withdrawn at any time —
        │  Editor confirms → moves to ready                  │  see Withdrawing below)
        ▼                                                    ▼
   [ready] ── ready for on-chain submission            [withdrawn]
        │
        │  Author signals author-ready
        │  Editor confirms → moves to done
        ▼
    [done]
```

---

## Who Applies Labels?

- **Authors:** Can apply and remove the `author-ready` label via the **Author Controls** panel on their own proposal. This is the only label authors control directly.
- **CAP Editors:** Apply and remove all lifecycle labels, status tags, editor signals, and special handling labels via the **Editor Controls** panel.
- **The Wizard:** Automatically applies the type label (CAP/CIS) and category label when a proposal is first submitted.

---

## Withdrawing a Proposal

- **Authors** can withdraw their own proposal at any time directly — this immediately closes it and applies the `withdrawn` label.
- **Editors** withdrawing someone *else's* proposal are subject to a **two-person rule**: the first editor's action records a pending withdrawal request, and a second, different editor must confirm it before it's finalized. The same editor cannot confirm their own request. A pending request can be cancelled by any editor or the author before it's confirmed.

Once `ready`, `done`, or `withdrawn`, a proposal can no longer be edited.

---

## Checking a Proposal's Status

The lifecycle label is shown as a badge on every proposal card in the **Registry**. The **Board** view groups proposals into columns by lifecycle stage, so you can see everything currently in consultation, ready, or done at a glance.
