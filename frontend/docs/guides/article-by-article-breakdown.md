# Article-by-Article Breakdown

This guide walks through the Cardano Blockchain Ecosystem Constitution as currently published in this portal. It explains what each part means in plain language and why it matters for governance. You can read the full text in the [Constitution viewer](/#/constitution).

The Constitution has **four Articles** and **two Appendices** — Article II is the largest, since it covers community participation, all three voting bodies (DReps, SPOs, the CC), and the standards every governance action must meet.

---

## Preamble

The Preamble establishes the purpose and spirit of the Constitution. It does not create enforceable rules — it frames the values and intent behind those that follow.

Key statements:
- Cardano is described as a **decentralized ecosystem** committed to improving economic, political, and social systems globally.
- Governance is founded on **self-governance by the Cardano Community**, without relying on nation-state systems.
- The Constitution exists to **govern the Cardano Blockchain ecosystem**, ensure its continuity, and **guard the rights of those who utilize it and the rights of ada owners**.
- Participation is voluntary: the community invites those who share its values to join "for as long as they wish, while honoring the freedom to take another path."

---

## Defined Terms

A formal **Defined Terms** section gives precise definitions for key concepts used throughout the Constitution:

- **Active Voting Stake** — The total lovelace delegated to active DReps or SPOs, used to calculate voting thresholds. Excludes stake delegated to inactive DReps, the abstain option, unregistered stake, and registered undelegated stake.
- **Cardano Community** — All individuals and organizations that own, develop on, support, maintain, contribute to, or use the Cardano Blockchain in line with this Constitution's principles.
- **Cardano Community Member** — Any participant in the Cardano Community, including CC members.
- **Constitutional Committee (CC)** — The governing body charged with ensuring governance actions enacted on-chain are consistent with the Constitution.
- **Delegated Representative (DRep)** — An individual or entity registered to vote on on-chain governance actions, either on their own behalf or on behalf of other ada owners.
- **Net Change Limit** — The maximum amount or percentage of lovelace that may be removed from the Cardano Treasury in a given period.
- **Stake Pool Operator (SPO)** — An individual or entity controlling the cold key(s) of a block-producing node.
- **Stake Pool** — A block-producing node, identified by a unique ID, that aggregates delegator stake and participates in consensus and governance.
- **Treasury Withdrawal Recipient** — A person or entity designated to receive ada from the Cardano Treasury in a "Treasury Withdrawals" action.

---

## Article I — Cardano Blockchain Tenets and Guardrails

### Section 1: Guiding Tenets

Ten Tenets guide how all Cardano Community members should act and how governance proposals should be evaluated. They are explicitly **not ranked** — no Tenet takes priority over another.

| Tenet | Core Principle |
| :---: | :--- |
| 1 | Transactions shall not be slowed down or censored, and shall be served expediently |
| 2 | Transaction costs shall be predictable and not unreasonable |
| 3 | Developers shall not be unreasonably prevented from building and deploying applications |
| 4 | Contributions shall be recognized and fairly rewarded through tokenomics and compensation structures |
| 5 | Ada owners' value and data shall not be locked in without their consent |
| 6 | Interoperability shall not be unreasonably impeded |
| 7 | Value and information stored on-chain shall be preserved safely |
| 8 | Resources shall not be unreasonably spent |
| 9 | All users shall be treated fairly and impartially, consistent with long-term sustainability |
| 10 | The monetary system shall promote financial stability; total ada supply shall not exceed 45,000,000,000 (45 billion) |

Any governance action can be evaluated against these Tenets. A proposal that conflicts with one or more Tenets would be considered unconstitutional by the CC.

### Section 2: Implementation of Guardrails

The Constitution operates alongside a **Guardrails Appendix** (Appendix I) that provides specific technical constraints on governance actions:

- The Blockchain shall operate in accordance with the Guardrails Appendix.
- Where a Guardrail is programmed directly on-chain, the on-chain version prevails over the written Appendix in the event of any conflict — until replaced by a governance action.

---

## Article II — Community and Governance

This is the longest Article — it covers the community itself, ada owner participation rights, the three voting bodies, and the standards every governance action must meet.

### Section 1: The Cardano Community
No formal membership is required to use, participate in, or benefit from the Cardano Blockchain. Members are entitled to the Constitution's rights and protections, and are expected to uphold it, maintain ecosystem integrity, participate in governance, and resolve disputes transparently.

### Section 2: Participation Rights of Ada Owners
The cornerstone of ada owner rights in governance:
- Ada owners may participate directly by registering as a DRep, or indirectly by delegating to a registered DRep.
- **Any** ada owner may register as a DRep, and may delegate to one or more DReps (including themselves).
- Ada owners may change their delegation **at any time**.
- Ada owners using custodians may authorize or withhold authorization for those custodians to vote or delegate on their behalf.
- Ada owners have the right to a governance process that is **open, transparent, and protected from undue influence and manipulation**.

### Section 3: Decentralized Governance Framework
- The Cardano Blockchain is governed by a decentralized, on-chain model using smart contracts and blockchain tools where beneficial.
- Three independent voting bodies participate in on-chain governance: **DReps, SPOs, and the CC**. Anyone holding multiple roles must publicly disclose the overlap before acting.

### Section 4: Delegated Representatives
- DReps have voting power equal to the lovelace delegated to them, and may vote on **all** types of governance actions.
- DReps must publicly disclose any compensation received in connection with their DRep activities.
- DReps may **not** offer or provide compensation to an ada owner in exchange for being appointed as their DRep or for voting on their behalf.

### Section 5: Stake Pool Operators
SPOs vote on a more limited set of actions: **No Confidence**, **Update Committee**, **Hard Fork Initiation**, **Parameter Update** actions affecting security-relevant parameters, and **Info** actions.

### Section 6: Governance Action Standards
Every governance action must:
1. Follow a **standardized and legible format**, including a URL hosting a context document and the hash of that document. The document must be **immutable** after submission, and the on-chain content must be **identical to the final off-chain version**.
2. Provide sufficient rationale: at minimum a **title, abstract, justification, and relevant supporting materials**.
3. For "Hard Fork Initiation" and "Parameter Update" actions: undergo **sufficient technical review** as mandated by the Guardrails.

*This is the section your demo CAP amends — it currently doesn't specify how the document hash should be computed, which is exactly the ambiguity that proposal closes.*

### Section 7: "Treasury Withdrawals" Action Standards
In addition to Section 6, every Treasury Withdrawal must:
1. Specify the **terms of withdrawal** — purpose, delivery period, costs, and refund circumstances.
2. Disclose whether the recipient received ada from the Treasury in the **last 24 months**.
3. Not exceed the **Net Change Limit** for that period.
4. Allocate ada for **periodic independent audits and oversight metrics**.
5. Designate one or more **administrators** responsible for monitoring fund use.
6. Keep any ada held prior to disbursement in **separate auditable accounts**, delegated to the abstain voting option (not to an SPO).

---

## Article III — Constitutional Committee

### Section 1: Role and Scope
- The CC ensures governance actions enacted on-chain are **consistent with the Constitution**.
- Each CC member has **one vote**.
- No governance action — except "No Confidence" or "Update Committee" — may be enacted without affirmation by a requisite percentage of CC members.
- The CC is **strictly limited** to voting on constitutionality — it may not evaluate policy merits or community desirability.

### Section 2: Composition and Terms
The CC's size and term lengths are determined by ada owners, with **staggered** terms to ensure continuity.

### Section 3: Election Process, No Confidence and Removal
- The CC is always in one of two states: **confidence** or **no confidence**.
- In a state of no confidence, the CC must be reinstated or replaced via an "Update Committee" action before any other action (other than "Info") can proceed.
- The Community establishes and publishes a CC election process consistent with the Guardrails.

### Section 4: Transparency and Conduct
- CC processes are **transparent**; every decision is published.
- A CC member voting that an action is unconstitutional must **cite the specific basis** — referencing the relevant Articles or Guardrails provisions.
- CC members may be compensated, and must **publicly disclose** any such compensation.

---

## Article IV — Amendment Process

### Section 1: Amendment Rules

Amendments to the Constitution — including the Guardrails Appendix — require:
- Approval via an **on-chain governance action**.
- Support from at least **65% of the active voting stake** at the time of the vote, unless the Guardrails Appendix specifies a different threshold for that particular Guardrail.

This is a deliberately high bar — constitutional amendments must reflect broad community consensus, not a simple majority. The **CAP process** (this portal) is the off-chain layer that precedes this on-chain step: proposals are drafted, deliberated, and refined here before a governance action is ever submitted to the chain.

---

## Appendix I — Cardano Blockchain Guardrails

The most technically detailed part of the Constitution — binding constraints on governance parameter values and the conditions under which certain actions may proceed. Covers:
- **Protocol parameter bounds** (block size, fees, memory limits, etc.)
- **Treasury and funding constraints** (withdrawal limits, Net Change Limit rules)
- **Hard fork conditions**
- **DRep and SPO voting thresholds**

Where a Guardrail is implemented directly on-chain as a script, the on-chain version is authoritative (per Article I, Section 2).

---

## Appendix II — Supporting Guidance

Non-binding supplementary guidance to help the community interpret and apply the Constitution. It's informational, not prescriptive — the CC may consider it as it deems relevant, but it carries no independent enforceability.
