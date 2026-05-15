# What happens after deliberation ends?

Nothing happens automatically. The deliberation period expiring is not a trigger — it is a minimum threshold. Both the author and an editor must actively confirm readiness before a proposal can advance.

---

## The steps after deliberation

Once the recommended minimum deliberation period has elapsed:

1. **The author signals readiness** by clicking "Signal Ready for Review Board" in their Author Controls panel on the CAP Portal. This applies the `author-ready` label and notifies editors that the author considers the proposal ready to advance.

2. **A CAP Editor reviews** the proposal for completeness, constitutionality, and readiness — checking that the abstract, motivation, specification, and rationale are all present and sufficiently developed. The editor applies the `review` tag while working on it.

3. **When the Editor is satisfied**, they click "Move to Ready" in their Editor Controls panel. This can only be done while the `author-ready` signal is active — the portal will block the action otherwise.

4. **The proposal moves to the Ready lifecycle stage.** The `author-ready` signal is automatically cleared at this point.

---

## What if the proposal is not ready?

If a proposal has substantive issues — missing information, unresolved concerns, or constitutional problems — the Editor will note this in the issue comments and may apply `editor-concern` or `editor-suggested`. The proposal remains in Consultation and the author can continue refining it.

There is no deadline for this process. A proposal can remain in consultation indefinitely if discussion is still active.

---

## What if the proposal is withdrawn?

Authors may withdraw at any time using the Withdraw button in their Author Controls panel on the CAP Portal. This applies the `withdrawn` lifecycle label, clears all status tags, and closes the issue. The closed issue remains in the repository as a permanent historical record. It is not deleted.

---

## After Ready — what comes next?

Moving to Ready is not the final step. To make a constitutional change official, an **on-chain governance action** must be submitted to the Cardano Blockchain and approved by at least 65% of the active voting stake.

The author signals readiness again ("Signal Ready for Completion"), the editor confirms, and the proposal moves to **Done**. See [How are CAPs approved?](faq-how-are-caps-approved) for the full picture.
