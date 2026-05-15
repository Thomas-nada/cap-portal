# What is a governance action?

A governance action is an **on-chain proposal** submitted to the Cardano Blockchain that, if approved, makes an official change to the protocol, the Constitution, the Treasury, or governance itself. It is the mechanism by which anything actually changes on Cardano.

---

## How it differs from a CAP

A CAP is an **off-chain** document — a proposal developed and deliberated through the community process. It does not, by itself, change anything. A governance action is the **on-chain step** that makes a constitutional amendment, parameter change, or other decision official.

The relationship is:
1. Community identifies a need → CIS or CAP submitted
2. CAP deliberated and accepted → forms the basis of a governance action
3. Governance action submitted on-chain → voted on by DReps, SPOs, and the CC
4. If approved → change is enacted on the Cardano Blockchain

Skipping the CAP process is allowed — anyone may submit a governance action directly without going through the CAP process first.

---

## Types of governance actions

The Cardano Constitution and Guardrails recognise several types:

| Type | What it does |
| :--- | :--- |
| **Parameter Update** | Changes one or more protocol parameters |
| **Hard Fork Initiation** | Initiates a protocol version upgrade |
| **Treasury Withdrawals** | Requests ada from the Cardano Treasury |
| **New Constitution / Guardrails Script** | Ratifies a new version of the Constitution or replaces the Guardrails script |
| **Update Committee** | Changes the composition or threshold of the Constitutional Committee |
| **No Confidence** | Removes the Constitutional Committee entirely |
| **Info** | Records community sentiment on-chain without enacting any change |

---

## Who votes on governance actions?

- **DReps** vote on most types of governance actions, with voting power proportional to delegated stake
- **SPOs** vote on No Confidence, Update Committee, Hard Fork Initiation, security-relevant Parameter Updates, and Info actions
- **The Constitutional Committee** votes on constitutionality for all action types (except Info actions cannot be blocked by the CC)

A constitutional amendment requires at least **65% of the active voting stake** to pass.
