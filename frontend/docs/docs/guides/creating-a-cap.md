# Creating a CAP or CIS via GitHub

You can submit a Constitutional Amendment Proposal (CAP) or Constitutional Issue Statement (CIS) directly through GitHub Issues — no portal required. This guide walks you through the process step by step.

---

## Before You Begin

You will need a GitHub account. If you don't have one, create one at [github.com](https://github.com).

---

## Step 1 — Go to the Repository Issues Tab

Navigate to the [CAP repository](https://github.com/Thomas-nada/CAP) and click the **Issues** tab at the top.

---

## Step 2 — Click "New Issue"

You will see two templates available:

- **Amendment Proposal (CAP)** — use this to propose a change, clarification, or addition to the Constitution
- **Constitutional Issue Statement (CIS)** — use this to formally describe a constitutional problem without proposing a specific fix

Click **Get started** next to the appropriate template.

---

## Step 3 — Fill In the Form

The issue form has clearly labelled fields. Fill in all required sections:

**For a CAP:**
- **Title** — a short, clear description of the proposed change
- **Category** — select the category that best fits your proposal (this determines your deliberation period)
- **Summary** — a ~200 word abstract of what you are proposing
- **Why is this change needed** — the motivation and problem being solved
- **Revisions** — the specific text changes you are proposing, with original and proposed wording
- **Analysis & Test** — any evidence, testing, or analysis supporting the change

**For a CIS:**
- **Title** — a short description of the constitutional problem
- **Category** — the category that best fits the issue
- **Summary** — a brief description of the problem
- **Problem** — a detailed explanation of the issue
- **Context** — background and history
- **Impact** — who is affected and how

---

## Step 4 — Submit

Click **Submit new issue**.

Within seconds, a GitHub Action will automatically:

- Prepend a structured **YAML frontmatter block** to the top of your issue body
- Add a **category label** to the issue
- Calculate your **deliberation end date** and append it as an Institutional Metadata footer

You do not need to add frontmatter manually. The bot handles it.

---

## Step 5 — Your Deliberation Period Begins

The moment you submit, your mandatory deliberation period starts. The length depends on your category:

| Category | Deliberation Period |
| :--- | :---: |
| Procedural | 60 days |
| Substantive | 60 days |
| Technical | Variable |
| Interpretive | 30 days |
| Other | 30 days |
| Editorial | 14 days |

During this period the community discusses your proposal in the issue comments. You can respond, make clarifications, and update your proposal.

---

## After Submission

- Share the issue link with stakeholders to invite discussion
- Monitor the comments and respond to questions
- If you need to make substantive edits, you can edit the issue body directly
- Once the deliberation period ends, signal that you are ready to advance using the "Signal Ready for Review Board" button in your Author Controls panel on the CAP Portal. A CAP Editor will then review and, if satisfied, move the proposal to the **Ready** stage
