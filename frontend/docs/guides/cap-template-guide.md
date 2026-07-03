# CAP Template Guide

Every CAP submitted through the Amendment Wizard is assembled into the same structure automatically. This guide explains what belongs in each section and how to write it well. For the click-by-click submission flow, see [Submitting a CAP with the Wizard](submitting-with-the-wizard).

---

## Summary

A short summary of the proposed change — aim for around 200 words.

The summary should answer three questions:
1. What is being changed?
2. Why is this change being proposed?
3. What is the expected outcome?

Readers should understand the full scope of your proposal after reading the summary alone. The rest of the document provides the detail.

---

## Why Is This Change Needed?

Explain the problem your proposal is solving and why it matters.

A strong "Why" section:
- Identifies the specific constitutional provision, gap, or ambiguity being addressed.
- Explains the real-world impact of the current state.
- Makes clear why the status quo is insufficient.

Avoid describing your solution here — that belongs in your revisions and the Analysis section. This section should stand on its own as a compelling description of the problem.

---

## Analysis & Test

The supporting detail for your proposal. This is where you explain *how* the change works, what it affects, and how it can be verified.

A strong Analysis & Test section:
- Describes the mechanism of the change and what it touches (protocol behavior, tooling, process, etc.).
- Identifies any trade-offs or limitations.
- Gives a concrete way to test or verify the change works as intended.

---

## Revisions

For each passage you select from the Constitution in Step 2 of the wizard, the portal automatically generates a revision block showing:
- **Original Text** — the exact passage you selected, quoted.
- **Proposed Revision** — your replacement (or inserted) text.

Keep each revision self-contained and tied to a single passage. If you're proposing multiple unrelated changes across different parts of the Constitution, consider whether they should be separate CAPs.

**Tip:** The wizard's text-selection step builds this section for you directly from what you highlight — there's no need to transcribe the original wording by hand, which avoids mismatches between your quoted "original" text and the actual constitutional text.

---

## Links and Files

Optional supporting references — related CIPs, external specs, prior discussions, or anything that helps a reviewer understand the context. Leave blank if there's nothing to add.

---

## Proposal Details

Generated automatically — you don't fill this in yourself:
- **License** — CC-BY-4.0 on every proposal.
- **Category** — whichever you selected in Step 1.
- **Recommended Review Date** (CAPs only) — calculated from your category's minimum deliberation period (see [Labels & Workflow](labels-and-workflow) for the exact day counts per category).
