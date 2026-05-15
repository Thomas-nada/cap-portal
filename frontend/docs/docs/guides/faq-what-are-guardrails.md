# What are the Guardrails?

The **Guardrails** are the technical constraints section of the Cardano Constitution, contained in Appendix I. They set specific, binding limits on what governance actions may do — most importantly, the minimum and maximum values that protocol parameters may be set to, and the conditions under which certain governance actions may proceed.

---

## The Guardrails vs. the Constitution

The main body of the Constitution establishes principles, rights, and governance structures in plain language. The Guardrails Appendix translates those principles into specific, checkable rules.

For example:
- The Constitution (Tenet 2) says transaction costs shall be "predictable and not unreasonable"
- The Guardrails specify the exact minimum and maximum values that fee parameters may take

Both are part of the same document and carry the same constitutional authority. Amending the Guardrails requires the same 65% active voting stake threshold as amending the main Constitution.

---

## What the Guardrails cover

- **Protocol parameter bounds** — minimum and maximum values for all critical network parameters (block size, transaction fees, execution limits, epoch length, etc.)
- **Treasury and funding constraints** — Net Change Limit rules, withdrawal prerequisites, oversight requirements
- **Hard fork conditions** — what must be verified before a hard fork can proceed
- **DRep and SPO voting thresholds** — the minimum approval levels required for different action types
- **Bootstrapping provisions** — special rules that apply during early governance phases

---

## On-chain enforcement

Some Guardrails are implemented directly on the Cardano Blockchain as a **Guardrails Script**. When a Parameter Update or Treasury Withdrawal governance action is submitted on-chain, this script runs automatically to check compliance.

Where a Guardrail has been implemented on-chain, the on-chain version is authoritative. If there is a conflict between the written Appendix and the on-chain script, the on-chain script prevails — until replaced by a governance action.

---

## Can the Guardrails be changed?

Yes. The Guardrails may be amended through the same process as the rest of the Constitution — an on-chain governance action supported by the applicable voting threshold. Some individual Guardrails specify their own amendment threshold, which takes precedence over the general 65% rule for that specific Guardrail.

See [Can I propose changes to the Guardrails?](faq-can-i-propose-guardrail-changes) for more.
