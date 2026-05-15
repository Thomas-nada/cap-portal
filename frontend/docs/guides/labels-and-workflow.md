# Labels and Workflow

Every CAP and CIS issue on GitHub carries a set of labels that indicate its type, category, and current status in the governance process. This guide explains what each label means and how a proposal moves through the workflow.

---

## Type Labels

These labels identify what kind of proposal an issue is.

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
| **withdrawn** | The author has withdrawn the proposal. |

---

## Status Tags

Status tags give additional context about a proposal's current situation. They are set by editors and are optional. Multiple tags may be active at once. Some are only available at specific lifecycle stages.

| Label | Available when | Meaning |
| :--- | :--- | :--- |
| **author-ready** | Consultation or Ready | The author has signalled that they are ready for the proposal to advance to the next stage. This is required before an editor can move the proposal forward. |
| **review** | Any stage | The proposal is currently under active editorial review. |
| **revision** | Consultation only | The author is revising the proposal based on feedback. |
| **finalizing** | Consultation only | The editor is preparing the final version of the proposal. |
| **onchain** | Ready only | The proposal has been submitted to the Cardano blockchain as a governance action. |

---

## Editor Signal Labels

Editors apply one of these labels to communicate their assessment of a proposal. Only one can be active at a time.

| Label | Meaning |
| :--- | :--- |
| **editor-ok** | The editor has reviewed the proposal and it meets the required standards. |
| **editor-concern** | The editor has identified issues that need to be addressed. |
| **editor-suggested** | The editor has left suggestions for the author — non-blocking, but recommended. |

---

## Category Labels

The category label determines the recommended minimum deliberation period. It is applied when an issue is opened, based on the category selected in the submission form.

| Label | Deliberation Period | Typical Use |
| :--- | :---: | :--- |
| **Procedural** | 60 days | Changes to governance processes or voting rules |
| **Substantive** | 60 days | Changes to core constitutional rights or obligations |
| **Technical** | Variable | Changes to technical parameters or on-chain mechanisms |
| **Interpretive** | 30 days | Clarifications or reinterpretations of existing text |
| **Other** | 30 days | Does not clearly fit another category |
| **Editorial** | 14 days | Corrections, formatting, or non-substantive text changes |

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
        │  Author signals author-ready                       │ (withdrawn by author at any time)
        │  Editor confirms → moves to ready                  │
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

- **Authors:** Can apply and remove the `author-ready` label via the CAP Portal Author Controls panel. This is the only label authors control directly.
- **CAP Editors:** Apply and remove all lifecycle labels, status tags, editor signals, and special handling labels via the CAP Portal Editor Controls panel.
- **Bot (GitHub Action):** Applies the type label, category label, and calculates the deliberation end date automatically on submission.

---

## Checking a Proposal's Status

The label(s) on any issue are visible at the top of the issue page on GitHub. You can also filter all issues by label using the **Labels** dropdown in the [Issues tab](https://github.com/Thomas-nada/CAP/issues).

In the CAP Portal, the **Registry** list shows the lifecycle stage badge on every card. The **Progress Tracker** groups proposals into columns by lifecycle stage.
