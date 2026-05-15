# Examples of CAPs

This guide will be updated as proposals move through the process and are ratified. It will highlight well-structured submissions and what made them effective.

---

## CAP-0001 — The CAP Process (Meta)

[CAP-0001](https://github.com/Thomas-nada/CAP/issues/1) defines the CAP process itself — what a CAP is, how proposals are submitted and deliberated, the lifecycle stages, and the role of CAP Editors. It is the reference document for how all future CAPs should be structured and the benchmark for tone, completeness, and clarity.

---

### What it proposes

CAP-0001 is a **Procedural** proposal. Rather than amending constitutional text, it establishes the process by which all constitutional amendments are made. It defines:

- The two submission paths (CAP Portal wizard and direct GitHub issue)
- The six categories and their recommended minimum deliberation periods (14 days for Editorial up to 60 days for Procedural and Substantive)
- The four lifecycle stages: Consultation → Ready → Done, with Withdrawn available at any point
- The two-step confirmation pattern: the author must signal readiness before an editor can advance a stage
- Status tags, editor signals, and special handling labels — and who applies each
- The role and responsibilities of CAP Editors

---

### What it does well

**Abstract** — The abstract is short (~150 words), written in plain language, and tells you exactly what the document does without repeating the title. It does not begin describing the solution before establishing why the proposal exists.

**Motivation** — The motivation names two concrete problems without proposing a fix. It explicitly states what the process does *not* do ("does not itself enact governance changes"), which prevents a common misreading.

**Specification** — The specification uses tables throughout. Each table has a clear purpose: one for document structure, one for categories and periods, one for lifecycle stages, one for status tags, one for editor signals. Structured tables are preferable to prose for anything that has defined states, labels, or enumerable options — readers can scan them; they cannot efficiently scan paragraphs.

**Rationale** — The rationale connects design choices back to the problems stated in the motivation. It explains *why* the deliberation periods vary rather than just stating that they do, and it justifies the two-step confirmation pattern in terms of mutual agreement rather than process mechanics.

**Path to Ratification** — Each acceptance criterion is a checkable item. Items that are already complete are ticked. This makes it immediately clear what remains and what has already been done.

---

### When in doubt

CAP-0001 is the benchmark. If you are unsure whether your abstract is too long, whether your motivation is focusing on the problem or drifting into the solution, or whether your specification is clear enough — compare it against CAP-0001 section by section.

---

## More Examples Coming

As proposals are submitted, deliberated, and ratified, this guide will be updated with annotated examples showing:

- What made the abstract clear and accessible
- How the specification handled ambiguous or complex constitutional text
- How authors responded to editor feedback during deliberation
- What the final ratified text looked like compared to the original submission

Check back as the process matures.
