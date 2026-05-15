# CAP Template Guide

Every CAP must contain the following sections to be considered complete. This guide explains what belongs in each one and how to write it well.

---

## Preamble (YAML Frontmatter)

The preamble is a structured metadata block at the top of the issue. It is generated automatically by the bot when you submit — you do not need to write it yourself.

It records:
- **CAP number** — assigned when the proposal is accepted and published
- **Title** — a short, clear description of the proposed change
- **Category** — determines the recommended minimum deliberation period
- **Status** — tracks the proposal's lifecycle (Draft → Proposed → Active)
- **Authors** — who submitted the proposal
- **Discussions** — link to the GitHub issue
- **Created** — submission date
- **License** — CC-BY-4.0

---

## Abstract

A short summary of the proposed change — aim for around 200 words.

The abstract should answer three questions:
1. What is being changed?
2. Why is this change being proposed?
3. What is the expected outcome?

Readers should understand the full scope of your proposal after reading the abstract alone. The rest of the document provides the detail.

---

## Motivation

Explain the problem your proposal is solving and why it matters.

A strong motivation section:
- Identifies the specific constitutional provision, gap, or ambiguity being addressed
- Explains the real-world impact of the current state
- Makes clear why the status quo is insufficient

Avoid describing your solution here — that belongs in the Specification. The Motivation section should stand on its own as a compelling description of the problem.

---

## Specification

The detailed proposal. This is the core of your CAP.

For each change you are proposing, provide:
- **Section reference** — which article, clause, or section of the Constitution is affected
- **Original text** — quote the exact current wording
- **Proposed text** — the exact replacement wording
- **Rationale for the phrasing** — why this specific wording was chosen

Keep each revision self-contained. If you are proposing multiple unrelated changes, consider whether they should be separate CAPs.

**Tip:** Use the CAP Portal's Amendment Wizard to select constitutional text directly and build your revisions interactively. This reduces transcription errors and ensures the original text matches exactly.

---

## Rationale

Explain why you chose this specific approach over alternatives.

This section should address:
- What other approaches were considered and why they were rejected
- Any trade-offs or limitations in your proposed solution
- Why this solution best balances the competing interests at stake

The Rationale helps editors and the community understand your reasoning, and helps future readers understand why the Constitution was changed in this particular way.

---

## Path to Ratification

Describe the criteria required for your CAP to be considered complete and ready for ratification.

This typically includes:
- **Acceptance criteria** — what conditions must be met (e.g., community review, stakeholder consultation)
- **Implementation plan** — what steps are needed to apply the change on-chain

For straightforward editorial or interpretive changes, this section may be brief. For substantive or procedural changes, it should be thorough.

---

## Copyright

All CAPs are licensed under CC-BY-4.0. This line is included automatically. Do not remove it.
