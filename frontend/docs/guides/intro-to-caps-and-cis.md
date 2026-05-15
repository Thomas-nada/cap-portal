# Introduction to CAPs and CISs

Cardano's Constitution can evolve. Two document types exist to support that evolution in a structured, transparent, and community-driven way: **Constitutional Amendment Proposals (CAPs)** and **Constitutional Issue Statements (CISs)**.

---

## What is a CAP?

A **Constitutional Amendment Proposal (CAP)** is a formal governance document that proposes a specific change, clarification, or addition to the Cardano Constitution or its governance processes.

A CAP is:
- **Specific** — it proposes exact changes to exact constitutional text
- **Structured** — it follows a defined format with abstract, motivation, specification, and rationale
- **Process-bound** — it must go through a mandatory deliberation period before it can be ratified
- **Community-owned** — the author retains full ownership; editors facilitate but do not control

A CAP does **not** itself enact a constitutional change. It is the formal community input layer. Once ratified through the CAP process, a governance action must still be submitted on-chain to make the change official.

---

## What is a CIS?

A **Constitutional Issue Statement (CIS)** is a formal document that defines a constitutional problem — an ambiguity, procedural gap, or governance risk — without proposing a specific solution.

A CIS is:
- **Problem-focused** — it articulates what is wrong or unclear, not how to fix it
- **Complementary to CAPs** — a CIS defines the problem; a CAP proposes the fix
- **Valuable on its own** — even without a corresponding CAP, a CIS creates a shared, documented understanding of a governance challenge

A single CIS may inspire multiple CAPs, and a single CAP may resolve multiple CISs.

---

## When to Use Each

| Situation | Use |
| :--- | :--- |
| You want to change specific constitutional text | CAP |
| You want to propose a new governance rule or process | CAP |
| You have spotted an ambiguity but aren't sure how to fix it | CIS |
| You want to document a governance gap for community discussion | CIS |
| You have a fix for a known constitutional problem | CAP |

If you are unsure which to use, start with a CIS. It is lower friction and helps the community align on the problem before debating solutions.

---

## How They Fit Into Cardano Governance

The CAP process is the **off-chain layer** of Cardano's constitutional governance. It is where proposals are drafted, deliberated, and refined before entering the on-chain pipeline.

```
Community identifies problem
         │
         ▼
    CIS submitted          ← formal problem definition
         │
         ▼
    CAP submitted          ← proposed solution
         │
         ▼
  Deliberation period      ← community discussion and editor review
         │
         ▼
  CAP ratified             ← accepted through the CAP process
         │
         ▼
  On-chain governance      ← governance action submitted to enact the change
  action submitted
```

At any stage, an author may choose to bypass the CAP process and submit a governance action on-chain directly. The CAP process exists to ensure proposals are well-formed and community-endorsed before reaching the chain — but it is not a gatekeeping mechanism.
