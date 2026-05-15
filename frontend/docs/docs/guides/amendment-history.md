# Amendment History

This guide documents the versions of the Cardano Blockchain Ecosystem Constitution available in this repository, what changed between them, and why those changes matter.

You can compare any two versions side by side in the [Constitution viewer](/#/constitution).

---

## Version History

| Version | Date | Status |
| :--- | :--- | :--- |
| constitution-2026-01-19 | 19 January 2026 | **Current** |
| constitution-2025-02-08 | 8 February 2025 | Superseded |

---

## Summary of Changes: 2025 → 2026

The January 2026 revision is a substantive rewrite — not a light touch. The article count dropped from eight to four, the entire Budget article was absorbed, DReps and SPOs were folded into a consolidated Community and Governance article, and a new Defined Terms section was introduced. The changes span structure, substance, omission, and new additions.

---

## 1. Structure: Eight Articles Became Four

The 2025 Constitution had eight articles:

| 2025 | Title |
| :---: | :--- |
| Article I | Cardano Blockchain Tenets and Guardrails |
| Article II | The Cardano Blockchain Community |
| Article III | Participatory and Decentralized Governance |
| Article IV | The Cardano Blockchain Ecosystem Budget |
| Article V | Delegated Representatives |
| Article VI | Stake Pool Operators |
| Article VII | Constitutional Committee |
| Article VIII | Amendment Process |

The 2026 Constitution has four:

| 2026 | Title |
| :---: | :--- |
| Article I | Cardano Blockchain Tenets and Guardrails |
| Article II | Community and Governance |
| Article III | Constitutional Committee |
| Article IV | Amendment Process |

Articles II through VI of the 2025 version — Community, Governance, Budget, DReps, and SPOs — were collapsed into the single new Article II. The CC moved from Article VII to Article III. Amendment moved from Article VIII to Article IV.

This consolidation eliminated redundancy and repetition that had spread related content across multiple articles, while also removing a significant amount of material entirely (see below).

---

## 2. Preamble: Two Changes

**Ada owner rights added:**
The 2025 text read: *"guard the rights of those who utilize it."*
The 2026 text reads: *"guard the rights of those who utilize it and the rights of ada owners."*

This is not a minor clarification. It explicitly elevated ada owners as a distinct class of rights-holder in the foundational statement of constitutional purpose.

**Closing invitation revised:**
The 2025 text read: *"We invite all who share our values to join us but stand not in the way of any who wish to take another path."*
The 2026 text reads: *"We invite all who share our values to join us for as long as they wish, while honoring the freedom to take another path."*

The new phrasing affirms that participation is voluntary and ongoing rather than framing departure as something the community merely tolerates.

---

## 3. New: Defined Terms Section

The 2026 Constitution introduced a formal **Defined Terms** section between the Preamble and Article I — entirely absent from the 2025 version. Ten terms are now constitutionally defined:

| Term | What it defines |
| :--- | :--- |
| Active Voting Stake | Total lovelace delegated to active DReps or SPOs; the basis for threshold calculations. Excludes inactive DReps, the abstain option, unregistered stake, and registered undelegated stake. |
| Cardano Community | All individuals and organisations that own ada, develop, support, or use the Cardano Blockchain in alignment with the Constitution's principles. |
| Cardano Community Member | Any participant in the Cardano Community, including CC members. |
| Constitutional Committee (CC) | The governing body ensuring governance actions enacted on-chain are consistent with the Constitution. |
| Constitutional Committee member (CC member) | A person or organisation serving on the CC. |
| Delegated Representative (DRep) | An individual or entity registered to vote on on-chain governance actions on its own behalf or on behalf of ada owners. |
| Net Change Limit | The maximum amount or percentage of lovelace that may be removed from the Cardano Treasury in a given period. |
| Stake Pool Operator (SPO) | An individual or entity controlling the cold key(s) of a block-producing node. |
| Stake Pool | A block-producing node identified by a unique ID, which aggregates delegator stake and participates in consensus and governance. |
| Treasury Withdrawal Recipient | A person or entity designated to receive ada from the Cardano Treasury in a Treasury Withdrawals action. |

The 2025 Constitution used all of these concepts without formally defining them in the main text. Informal definitions existed in the Guardrails Appendix terminology section, but these were not binding constitutional definitions.

---

## 4. Article I — Tenets and Guardrails: One Substantive Change

Eight of the ten Tenets are substantively unchanged. Two are notable:

**Tenet 9 — minor wording:** The 2025 version referred to "the collective desires of the Cardano Blockchain Community." The 2026 version uses the now-defined term "Cardano Community."

**Tenet 10 — substantially expanded:** The 2025 version read:
> *"Financial stability shall be maintained and the total supply of ada shall not exceed 45,000,000,000."*

The 2026 version reads:
> *"The Cardano Blockchain's monetary system shall promote financial stability. This shall include seeking to preserve the value and utility of ada as a medium of exchange, store of value, and unit of account. The total supply of ada shall not exceed 45,000,000,000."*

The hard cap on ada supply is unchanged. What was added is an explicit monetary policy objective — ada should function as a medium of exchange, store of value, and unit of account, not merely exist within a supply limit.

The Guardrails implementation provision (Section 2) is substantively unchanged, converted to numbered list format.

---

## 5. Article II — Community and Governance

### What was removed

**The entire Budget article (old Article IV) was dissolved.** The 2025 Constitution had a five-section article dedicated to the ecosystem budget:

- **Section 1:** Any community member may propose a budget; periodic approval via Info action required; 73-epoch minimum coverage expectation
- **Section 2:** Budget administration must use smart contracts where possible; administrators to be designated
- **Section 3:** Treasury withdrawals prohibited unless authorised under an approved budget; Net Change Limit applies
- **Section 4:** Audit and oversight allocation required for any treasury request
- **Section 5:** Administrator-held funds must be in separate auditable accounts, abstain-delegated, not SPO-delegated

The **budget approval framework** — requiring ada owners to approve budgets via Info actions before treasury withdrawals could proceed — is no longer in the constitutional text. The practical oversight requirements that survived (audits, administrators, separate accounts) were absorbed into the new Treasury Withdrawals Action Standards (Section 7).

**DRep codes of conduct were removed.** The 2025 Article V explicitly encouraged DReps to "periodically adopt, and update as they deem appropriate, codes of conduct" including ethical guidelines, and to make them publicly available. This is entirely absent from the 2026 version.

**SPO codes of conduct were removed.** The same expectation applied to SPOs under 2025 Article VI Section 3. Also removed.

**"Liquid democracy" language was removed.** The 2025 Article V contained: *"This voting system shall enshrine a liquid democracy model where owners of ada can seamlessly select among DReps, register as a DRep, and withdraw or change their delegation at any time."* This framing is gone; the practical rights it described are instead enumerated directly in the new Section 2.

**Community tooling obligation for DRep discovery removed.** The 2025 version stated the community was expected to support creation and maintenance of tools "to enable owners of ada to explore and evaluate DRep candidates, access and evaluate DRep codes of conduct and select DReps." Not carried forward.

**Community off-chain governance support obligation removed.** The 2025 Article III Section 6 required the community to support off-chain governance processes "to ensure that there is awareness of and an opportunity to debate and shape all future governance actions." Not in the 2026 version.

**Info action dedicated section removed.** The 2025 Article III Section 4 gave Info actions their own governance section, explaining their on-chain effect, their use for gauging community sentiment, and their connection to budget proposals. This is not a standalone section in the 2026 Constitution.

**SPO "check on the CC" framing removed.** The 2025 Article VI Section 1-2 described SPOs as acting as "a check on the power of the Constitutional Committee under exceptional circumstances" and named the specific security-critical parameters section where SPOs hold a vote. The 2026 version lists the governance actions SPOs vote on without that framing.

**SPO-specific dual-role disclosure generalised.** The 2025 Article VI Section 4 required SPOs who also act as DReps to disclose this before voting in both capacities. The 2026 version replaced this with a general rule in Article II Section 3: anyone holding multiple roles must publicly disclose such overlaps before engaging in any governance actions.

### What was added

**Section 2 — Participation Rights of Ada Owners** is the most significant new addition in the entire revision. The 2025 version addressed ada owner participation in two brief sentences. The 2026 version creates a dedicated section with seven enumerated rights:

1. Ada owners are entitled to access and participate in on-chain decision-making, including voting and proposing governance actions
2. Ada owners can participate directly (by registering as a DRep) or indirectly (by delegating to a registered DRep)
3. Any ada owner may register as a DRep
4. Any ada owner may delegate their voting stake to one or more DReps, including themselves
5. Ada owners may change their delegation at any time
6. Ada owners using custodians may authorise or withhold authorisation for those custodians to vote or delegate on their behalf
7. Ada owners have the right to a process that is **open, transparent, and protected from undue influence and manipulation**

Right 7 is entirely new — it did not appear in any comparable form in the 2025 text.

**Section 4 — DReps: explicit voting scope added.** The 2025 version did not explicitly state which governance actions DReps may vote on. The 2026 version adds: *"DReps may vote on all types of governance actions."*

**Section 7 — Treasury Withdrawals Action Standards** is an entirely new section as a standalone set of constitutional requirements. Six specific requirements now apply to every Treasury Withdrawals action:

| Requirement | In 2025? | In 2026? |
| :--- | :---: | :---: |
| Specify terms of withdrawal (purpose, period, costs, refund circumstances) | No | **Yes (new)** |
| Disclose prior Treasury funding within last 24 months | No | **Yes (new)** |
| Must not exceed Net Change Limit | Yes (Art IV Sec 3) | Yes |
| Allocate ada for independent audits and oversight metrics | Yes (Art IV Sec 4) | Yes |
| Designate administrators responsible for monitoring and deliverables | Yes (Art IV Sec 2) | Yes |
| Administrator-held funds in separate auditable accounts, abstain-delegated, not SPO-delegated | Yes (Art IV Sec 5) | Yes |

The disclosure of terms and the 24-month prior funding disclosure are the most significant new obligations — neither appeared in the 2025 text.

---

## 6. Article III — Constitutional Committee: Substantially Streamlined

The 2025 CC article had nine sections. The 2026 version has four. The retained content is the core governance machinery; most of what was removed was procedural guidance, obligations, and internal conduct rules.

### What was retained

- CC's role as the body ensuring constitutionality of on-chain actions
- Each CC member has one vote
- No governance action proceeds without CC affirmation (except No Confidence and Update Committee)
- Staggered terms for continuity
- Confidence / no-confidence state framework, and the requirement to replace the CC before governance resumes
- Transparency and publication of decisions
- Compensation permitted and must be disclosed

### What was removed

**Info action and budget vote guidance (old Section 4):** The 2025 Constitution contained detailed instructions for how the CC should handle Info actions: they may not prevent Info actions from being recorded on-chain; they may record a vote to express a view; for budget-related Info actions they *shall* record a vote on constitutionality; same for treasury withdrawal Info actions. This entire framework is absent from the 2026 version.

**Code of conduct requirement removed:** The 2025 Article VII Section 6 required the CC to "operate pursuant to a code of conduct periodically adopted and published" with ethical guidelines, and to periodically adopt and publish policies and procedures. Not in the 2026 version.

**CC community tools obligation removed:** The 2025 Article VII Section 7 stated the community was expected to support creation of tools for the CC to perform its functions. Not carried forward.

**Detailed compensation provisions removed:** The 2025 Article VII Section 8 specified that ecosystem budgets may include CC compensation allocations and shall provide for "periodic administrative costs of the Constitutional Committee in such amounts as requested." The 2026 version states only that members may be compensated and must disclose it.

**Internal deliberations carve-out removed:** The 2025 version explicitly stated: *"Internal deliberations among members of the Constitutional Committee, prior to casting votes, are not required to be publicly disclosed."* This carve-out is not in the 2026 text.

**CC member expertise requirement removed:** The 2025 version stated CC members "are expected to have appropriate expertise to carry out their required responsibilities, considering their past contributions and involvement in the Cardano Blockchain ecosystem." Not retained.

### What was changed

**Unconstitutionality voting accountability strengthened.** The 2025 version stated the CC "collectively, or each member casting such a vote separately, shall set forth the basis for its decision." The 2026 version requires that **each CC member casting such a vote** shall set forth the specific basis. The collective-only option was removed — individual accountability is now mandatory.

---

## 7. Article IV — Amendment Process: Consolidated

The 2025 Constitution had three sections on amendment:

- **Section 1:** Framing the Constitution as a living document; encouraging periodic community review and debate; inviting community forums to propose amendments
- **Section 2:** The 65% voting threshold
- **Section 3:** The Guardrails-specific threshold override

The 2026 version consolidates this into a single section, retaining only the operative rule: 65% of active voting stake required, with Guardrails-specific thresholds applying where stated.

The "living document" framing and the encouragement to convene community forums were removed. The amendment threshold itself is unchanged.

---

## 8. Appendix I — Guardrails: No Substantive Changes at the Top Level

The Guardrails Appendix content was carried over largely intact. The main differences are formatting — consistent bold headings and numbered list formatting throughout — and minor wording alignment with the new defined terms. Individual Guardrail labels and parameter values are unchanged.

The Terminology and Guidance section within the Appendix retains technical definitions (Block, Protocol, Epoch, lovelace, ada, Governance Action, etc.) that are distinct from the constitutional Defined Terms — these remain as Appendix context rather than constitutional definitions.

---

## 9. Appendix II — Supporting Guidance: New Addition

The 2025 Constitution had one appendix. The 2026 version adds **Appendix II — Supporting Guidance**, providing non-binding supplementary material for interpreting and applying the Constitution. It is informational, not prescriptive.

---

## How to Compare Versions

The [Constitution viewer](/#/constitution) allows you to select and read any version from the dropdown. For a line-by-line comparison, both versions are stored under `constitution/` in the repository and can be compared using standard diff tools.

---

## Future Amendments

Any future amendment to the Constitution must be:

1. Proposed via the CAP process (or submitted directly as a governance action)
2. Deliberated during the appropriate recommended minimum period
3. Ratified via an on-chain governance action supported by at least 65% of the active voting stake (unless a different threshold applies under the Guardrails)

When ratified, the new version will be added to the `constitution/` folder in this repository and this history updated accordingly.
