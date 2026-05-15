# How are CAPs approved?

There are two distinct stages: advancement through the CAP process (off-chain), and ratification via a governance action (on-chain). A proposal must pass both to become a constitutional amendment.

---

## Stage 1: The CAP Process (Off-chain)

A CAP advances through the following steps:

1. The proposal enters **Consultation** — open for community deliberation
2. The community discusses, critiques, and refines the proposal during the recommended minimum deliberation period
3. A CAP Editor conducts a review — checking completeness, constitutionality, and quality
4. When both the **author signals readiness** (via the `author-ready` label) and the **editor is satisfied**, the editor moves the proposal to **Ready**
5. This two-step confirmation — author signal + editor confirmation — is required at every stage advance

This is a qualitative editorial process — not a vote. Editors assess whether the proposal is ready and constitutional, not whether they agree with the substance of the change. The community signals its views through deliberation comments and reactions; the editor reads this sentiment as part of the review.

---

## Stage 2: Ratification (On-chain, via governance action)

Reaching Ready does not change the Constitution. To make the amendment official, someone must submit a **governance action** on-chain.

The on-chain vote requires support from at least **65% of the active voting stake** (or a different threshold if the Guardrails Appendix specifies one for a particular provision).

The three governance bodies — **DReps, SPOs, and the Constitutional Committee (CC)** — each play a role depending on the action type. For a constitutional amendment action:

- **DReps** vote with weight proportional to delegated stake
- **SPOs** vote on certain action types (Hard Fork, No Confidence, etc.)
- **The CC** votes on constitutionality — whether the proposal is consistent with the existing Constitution

The CC does not assess whether a change is desirable. It assesses only whether it is constitutional. If the CC is in a state of no confidence, governance actions cannot proceed until the CC is reinstated.

Once the on-chain step is complete, the editor moves the proposal to **Done** (again requiring the author's signal first), and the repository is updated to reflect the new version of the Constitution.

---

## Is the CAP process required?

No. Any ada owner may submit a governance action on-chain directly without going through the CAP process. The CAP process is not a gatekeeping mechanism — it is a community-endorsed preparation layer that helps ensure proposals are well-reasoned and supported before reaching the chain.

---

## What threshold is required?

The Constitution requires **65% of the active voting stake** to ratify a constitutional amendment, unless the Guardrails Appendix specifies a different threshold for a specific provision. This is a deliberately high bar to ensure amendments reflect broad consensus rather than a narrow majority.
