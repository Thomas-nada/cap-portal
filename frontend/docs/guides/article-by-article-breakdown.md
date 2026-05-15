# Article-by-Article Breakdown

This guide walks through each section of the Cardano Blockchain Ecosystem Constitution — the January 2026 ratified version. It explains what each part means in plain language and why it matters for governance.

You can read the full text in the [Constitution viewer](/#/constitution).

---

## Preamble

The Preamble establishes the purpose and spirit of the Constitution. It does not create enforceable rules — it frames the values and intent behind those that follow.

Key statements:
- Cardano is described as a **decentralised ecosystem** committed to improving economic, political, and social systems globally
- Governance is explicitly founded on **self-governance by the Cardano Community**, without reliance on nation-state systems
- The Constitution exists to **govern the Cardano Blockchain ecosystem**, ensure its continuity, and **guard the rights of ada owners**
- Participation is voluntary: the community invites those who share its values to join, "while honoring the freedom to take another path"

The Preamble was meaningfully strengthened in the January 2026 revision — the phrase "guard the rights of those who utilize it" was expanded to explicitly include "and the rights of ada owners", and the original vague invitation to leave was replaced with a clearer statement of freedom.

---

## Defined Terms

The January 2026 revision introduced a formal **Defined Terms** section — something absent from the February 2025 version. This section provides precise definitions for key concepts used throughout the Constitution.

**Active Voting Stake** — The total lovelace delegated to active DReps or SPOs, used to calculate voting thresholds. Excludes stake delegated to inactive DReps, the abstain option, unregistered stake, and registered undelegated stake.

**Cardano Community** — All individuals and organisations that own ada, develop on, support, or use the Cardano Blockchain in alignment with the Constitution's principles.

**Cardano Community Member** — Any participant, individual or organisation, in the Cardano Community, including CC members.

**Constitutional Committee (CC)** — The governing body charged with ensuring governance actions enacted on-chain are consistent with the Constitution.

**Constitutional Committee member (CC member)** — A person or organisation serving on the CC.

**Delegated Representative (DRep)** — An individual or entity registered to vote on on-chain governance actions, either on their own behalf or on behalf of other ada owners.

**Net Change Limit** — The maximum amount or percentage of lovelace that may be removed from the Cardano Treasury in a given period.

**Stake Pool Operator (SPO)** — An individual or entity controlling the cold key(s) of a block-producing node.

**Stake Pool** — A block-producing node identified by a unique ID, which aggregates delegator stake and participates in consensus and governance.

**Treasury Withdrawal Recipient** — A person or entity designated to receive ada from the Cardano Treasury in a Treasury Withdrawals action.

---

## Article I — Cardano Blockchain Tenets and Guardrails

### Section 1: Guiding Tenets

Ten Tenets govern how all Cardano Community members should act and how governance proposals should be evaluated. They are explicitly **not ranked** — no Tenet takes priority over another.

| Tenet | Core Principle |
| :---: | :--- |
| 1 | Transactions shall not be slowed down, censored, or unreasonably delayed |
| 2 | Transaction costs shall be predictable and not unreasonable |
| 3 | Developers shall not be unreasonably prevented from building and deploying applications |
| 4 | Contributions shall be recognised and fairly rewarded through tokenomics and compensation structures |
| 5 | Ada owners' value and data shall not be locked in without their consent |
| 6 | Interoperability shall not be unreasonably impeded |
| 7 | Value and information stored on-chain shall be preserved safely |
| 8 | Resources shall not be unreasonably spent |
| 9 | All users shall be treated fairly and impartially, consistent with long-term sustainability |
| 10 | The monetary system shall promote financial stability; total ada supply shall not exceed 45,000,000,000 (45 billion) |

Any governance action can be evaluated against these Tenets. A proposal that violates one or more Tenets would be considered unconstitutional by the CC.

### Section 2: Implementation of Guardrails

The Constitution operates alongside a **Guardrails Appendix** (Appendix I) that provides specific technical constraints on governance actions. Key principles:

- The Blockchain shall operate in accordance with the Guardrails Appendix
- Where Guardrails are programmed directly on-chain, the on-chain version prevails in the event of any conflict with the written Appendix — until replaced by a governance action
- This means the on-chain script is the authoritative source for any Guardrail that has been digitally codified

---

## Article II — Community and Governance

### Section 1: The Cardano Community

- No formal membership is required to use, participate in, or benefit from the Cardano Blockchain
- Community members are entitled to the rights and protections of the Constitution, and are expected to uphold it, maintain ecosystem integrity, participate in governance, and resolve disputes transparently
- Members are encouraged to collaborate and form organisations in support of the Blockchain and Community

### Section 2: Participation Rights of Ada Owners

This section is the cornerstone of ada owner rights in governance. Key rights:

1. Ada owners are entitled to access and participate in on-chain decision-making, including voting and proposing governance actions
2. Ada owners may participate directly by registering as a DRep, or indirectly by delegating voting rights to a registered DRep
3. **Any ada owner** may register as a DRep
4. **Any ada owner** may delegate to one or more DReps, including themselves
5. Ada owners may **change their delegation at any time**
6. Ada owners using custodians may authorise or withhold authorisation for those custodians to vote or delegate on their behalf
7. Ada owners have the right to a process that is **open, transparent, and protected from undue influence and manipulation**

### Section 3: Decentralised Governance Framework

- The Cardano Blockchain is governed by a decentralised on-chain model that uses smart contracts and blockchain tools where beneficial
- Three independent voting bodies participate in on-chain governance: **DReps, SPOs, and the CC**
- Anyone holding multiple roles must **publicly disclose** such overlaps before engaging in any governance actions

### Section 4: Delegated Representatives

- DReps have **voting power proportional to the lovelace delegated to them**
- DReps may vote on **all types** of governance actions
- DReps must **publicly disclose any compensation** received in connection with their DRep activities
- DReps are **prohibited** from offering or providing compensation to ada owners in exchange for being appointed as their DRep or for voting on their behalf

### Section 5: Stake Pool Operators

SPOs participate in a more limited set of governance actions than DReps. SPOs shall vote on:
- No Confidence actions
- Update Committee actions
- Hard Fork Initiation actions
- Parameter Update actions that affect security-relevant parameters
- Info actions

### Section 6: Governance Action Standards

All proposed governance actions must meet these standards before being enacted on-chain:

1. Actions must follow a **standardised and legible format**, including a URL hosting a context document and the hash of that document. The document must be **immutable** after submission, and the on-chain content must be **identical to the final off-chain version**
2. Each proposal must provide sufficient rationale: at minimum a **title, abstract, justification, and relevant supporting materials**
3. Hard Fork Initiation and Parameter Update actions must undergo **sufficient technical review** as mandated by the Guardrails

### Section 7: Treasury Withdrawals Action Standards

Treasury Withdrawal actions carry additional requirements beyond Section 6:

1. Must specify the **terms of withdrawal**: purpose, delivery period, costs and expenses, and circumstances under which funds might be refunded
2. Must **disclose whether the recipient has received ada from the Treasury in the last 24 months**
3. Must not exceed the **Net Change Limit** for that period
4. Must allocate ada for **periodic independent audits and oversight metrics**
5. Must designate **one or more administrators** responsible for monitoring fund use and ensuring deliverables are achieved
6. Any ada held by an administrator prior to disbursement must be kept in **separate auditable accounts**, not delegated to an SPO, and must be delegated to the predefined abstain voting option

---

## Article III — Constitutional Committee

### Section 1: Role and Scope

- The CC exists to ensure governance actions enacted on-chain are **consistent with the Constitution**
- Each CC member has **one vote**
- No governance action — except "No Confidence" or "Update Committee" actions — may be implemented on-chain **without affirmation by a requisite percentage of CC members**
- The CC is **strictly limited** to voting on constitutionality. It may not evaluate policy merits or community desirability — only whether a proposal is consistent with the Constitution

### Section 2: Composition and Terms

- The CC shall be composed of a number of members and serve term lengths sufficient to assure ongoing integrity of the Blockchain, as determined by ada owners
- Terms shall be **staggered** to ensure continuity

### Section 3: Election Process, No Confidence and Removal

- The CC is always in one of two states: **confidence** or **no confidence**
- In a state of no confidence, the CC must be reinstated or replaced via an "Update Committee" action before any governance action other than "Info" actions can proceed
- The Cardano Community shall establish and publish a process for CC elections consistent with the Guardrails
- If a no confidence vote or removal occurs, an election shall be held as soon as practical

### Section 4: Transparency and Conduct

- CC processes shall be **transparent** and each decision shall be published
- When voting that a governance action is unconstitutional, each CC member casting such a vote shall **set forth the specific basis** for their decision, referencing the relevant Articles or Guardrails provisions
- CC members may be compensated and must **publicly disclose** any such compensation

---

## Article IV — Amendment Process

### Section 1: Amendment Rules

Amendments to the Constitution — including the Guardrails Appendix — require:

- Approval via an **on-chain governance action**
- Supported by at least **65% of the active voting stake** at the time of the vote
- Unless a different threshold is expressly provided in the Guardrails Appendix for a specific Guardrail, in which case that threshold applies

This is a high bar by design. Constitutional amendments must reflect broad community consensus, not a simple majority.

The CAP process exists as the **off-chain layer** that precedes this on-chain step — proposals are drafted, deliberated, and refined through the CAP process before a governance action is submitted to the chain.

---

## Appendix I — Cardano Blockchain Guardrails

Appendix I is the most technically detailed part of the Constitution. It provides specific, binding constraints on the values that governance parameters may take, and the conditions under which certain governance actions may proceed.

The Guardrails cover:
- **Protocol parameter bounds** — minimum and maximum values for critical network parameters (block size, transaction fees, memory limits, epoch lengths, etc.)
- **Treasury and funding constraints** — limits on withdrawals, Net Change Limit rules, and oversight requirements
- **Hard fork conditions** — what must be true before a hard fork can proceed
- **DRep and SPO voting thresholds** — the minimum thresholds required for various action types
- **Bootstrapping provisions** — special rules that apply during the early governance phase

Some Guardrails are implemented directly on-chain as a script. Where this is the case, the on-chain version is authoritative (per Article I, Section 2).

---

## Appendix II — Supporting Guidance

Appendix II provides non-binding supplementary guidance to assist the community in interpreting and applying the Constitution. It is informational rather than prescriptive.
