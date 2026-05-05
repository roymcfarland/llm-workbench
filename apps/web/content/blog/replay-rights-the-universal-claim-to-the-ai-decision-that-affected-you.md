---
title: "Replay rights: a moonshot for universal, contestable AI decisions"
description: "What if every person had a universal right to replay the AI decision that affected them—loan, hire, claim, refund? Here is the moonshot: tamper-evident run bundles as the substrate for adjudicable cognition."
date: "2026-05-05T09:30:00-06:00"
tags:
  - moonshot
  - AI governance
  - algorithmic accountability
  - right to explanation
  - run bundles
author: LLM Workbench
---

## A modest, slightly outrageous proposal

The previous two posts in this batch were grounded. **[The hyperscaler token-pricing playbook](/blog/hyperscaler-token-pricing-playbook)** is about money. **[Agent contracts](/blog/agent-contracts-the-missing-layer-between-agents-and-humans)** is about delegation. This one is the **moonshot**.

The proposal: every person has a **right to replay** any AI-driven decision that materially affected them.

Not a *right to explanation*—we tried that with [GDPR Article 22](https://gdpr-info.eu/art-22-gdpr/) and the [EU AI Act](https://artificialintelligenceact.eu/), and both have produced thoughtful intent and thin enforcement. Explanations alone collapse into post-hoc narrative. What we should aim for is the **operational** version of that right: when an AI system declines your loan, rejects your claim, screens out your résumé, throttles your access, or routes a customer-service request, you can demand the **run bundle** that produced the decision—and a third party can replay it.

It sounds like a regulatory fantasy. It is also, technically, **two engineering quarters away** for any team already operating modern observability. The plumbing exists. What is missing is the *commitment* to instrument decisions as if they would have to be reproduced in front of a skeptical reviewer who is not on your payroll.

## Why “explainable AI” isn’t enough

Most explainability work tries to answer the question, *“why did the model output this?”* That is a worthy question for ML researchers. It is the wrong question for the person on the receiving end of an automated decision.

The person on the receiving end actually wants three things:

1. **Receipt.** *“What system made the decision, when, and on what inputs?”*
2. **Reproduction.** *“If you ran this again with the same inputs, would you get the same answer?”*
3. **Recourse.** *“Where do I challenge it, and what would change the result?”*

Explanations live in question one and a half. They tend to be plausible, vendor-supplied stories about feature importance. They almost never satisfy two and three—because they are produced *after* the decision, by a different model, often without access to the actual run state.

Run bundles—the same construct **[Why LLM Workbench exists](/blog/why-llm-workbench-exists)** and **[What LLM Workbench solves](/blog/what-llm-workbench-solves)** describe—are the natural answer. They are designed for receipt, reproduction, and adjudication, not for marketing.

## What “replay rights” would actually grant

Concretely, a replay right would entitle a person—or their counsel, or a regulator acting on their behalf—to four artifacts:

| Right | Artifact | What it lets you do |
| --- | --- | --- |
| **Right to the bundle** | Tamper-evident JSON: workflow snapshot, trace, model_io, gates, artifacts | Verify the decision wasn’t fabricated after the fact |
| **Right to integrity proof** | Canonical hash + signature over the bundle | Catch quiet edits to the record between decision and dispute |
| **Right to deterministic-enough replay** | A reproducible runner that, given the bundle and pinned model versions, produces the same outputs | Distinguish bugs from policy from probabilistic noise |
| **Right to lineage** | DAG snapshot + artifact versions + gate decisions | Trace which step actually decided, and which human (if any) approved it |

None of those four require new science. They require **discipline at the moment of execution**: capture `model_io`, snapshot the workflow, record the gates, hash the export. **[Tokenization and model routing](/blog/tokenization-model-routing-frontier-vs-efficient-llms)** and **[Context rot and enterprise cost](/blog/context-rot-visibility-enterprise-llm-cost-control)** describe the operational hooks; the moonshot is to make those hooks *non-optional* for any decision that touches a real human.

## The substrate already exists

Three quiet shifts in the last two years make the moonshot less moony than it sounds.

**Determinism is improving.** Pinned model versions, deterministic decoding, and reproducible toolchains are not universal—but they are common enough that “replay this run” is no longer a research project for a wide class of agent workloads. Where strict determinism isn’t achievable, **bracketing replay** (rerun the same prompt N times and bound the answer distribution) is.

**Tamper-evidence is cheap.** Canonical-JSON hashing and signature schemes (Sigstore, [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/), and friends) are now table stakes for any system that wants to prove provenance. A run bundle hashed at export time is bytes-cheap and audit-rich.

**Machine-readable lanes.** First-party surfaces like `/agents.md`, `/llms.txt`, `/.well-known/mcp.json`, and `/api/openapi.json` mean that **assistants and tools** can already enumerate runs, fetch bundles, and verify integrity without scraping HTML. **[Who benefits—and how to start](/blog/who-benefits-and-how-to-start)** sketches how a team adopts these surfaces incrementally.

The substrate is built. The remaining work is **institutional**: agreeing that the bundle is the unit of accountability, and that the right to it is portable across vendors and stacks.

## What it would take to ship this in five years

This is the moonshot section. We are deliberately bold here.

**Year one — instrument by default.** Treat run bundles the way the web treats access logs. Every regulated workload (credit, healthcare, employment, insurance, government services) ships with bundle export configured before launch. Vendors that can’t produce one don’t win the procurement.

**Year two — independent verifiers.** A small ecosystem of *replay services* emerges: third parties who, given a bundle and pinned model identifiers, attempt the replay and publish a verifier report. Think of them as the **financial auditors** of cognition. The bar is unglamorous: no novel ML, careful determinism, signed reports.

**Year three — adjudication primitives.** Tickets, complaints, and dispute flows speak in **bundle URIs**, not screenshots. When a customer disputes a decision, the operator returns `bundle://run/abc123` rather than “let me check with the data team.” Standards bodies converge on a small profile—what fields are mandatory, how integrity is computed, how PII is redacted on export.

**Year four — universal claim.** Statutory or contractual replay rights become normal in major markets. Not for every output a chat assistant produces—nobody wants to litigate every recipe suggestion—but for any decision that **materially affects** someone’s life: money, access, employment, healthcare, housing.

**Year five — the right is invisible.** When the right is normal, the operational layer fades into the background. Every run leaves a tape. Every important tape can be replayed. Every replay narrows disagreement. The world is calmer because the disputed facts are smaller.

## Objections, addressed

Anyone who has worked in regulated tech is now drafting a list of reasons this is hard. Good. Here are the four objections that come up most, and the short answer to each.

**“Models aren’t deterministic.”** True at the token level, mostly false at the *decision* level once you pin versions, decoding parameters, and tool order. For the rest, bracketing replay (sample N times, summarize the distribution) is honest. The point is not byte equality. The point is bounded uncertainty.

**“PII can’t leave the company.”** Bundles support **redaction at export** and **selective disclosure**. The replay verifier doesn’t need raw inputs to validate structure; the customer’s counsel may need them; the regulator may need a subset. Today’s bundle schema can encode all three views from one signed source.

**“Vendors will refuse.”** Some will. The lesson of every prior interoperability fight is that the buyers who insist on portable artifacts win. **[The hyperscaler token-pricing playbook](/blog/hyperscaler-token-pricing-playbook)** describes the leverage. A “bundle clause” in procurement is the cheapest insurance you can buy against a future vendor pivot.

**“This is just GDPR with extra steps.”** GDPR named the right. Replay would *implement* it. The difference is between a statute and a working API.

## The first step is small

You don’t have to wait for any of this. The first move toward replay rights is the same first move toward operational maturity:

1. Pick one workflow whose decisions actually matter to a person.
2. Wrap its model calls so every one emits a structured `model_io` event.
3. Annotate one step with a human gate.
4. Export a bundle on completion. Verify integrity in CI.
5. Send a sample bundle to your legal and policy partners. Ask them: *“If a customer asked us to reproduce this decision, could we?”*

If the answer is yes, you have already shipped the prototype. The moonshot is just doing this for every decision that matters, in every system that makes them.

The recovering lawyer in **[Agent contracts](/blog/agent-contracts-the-missing-layer-between-agents-and-humans)** would point out, drily, that contracts only matter if they can be enforced. Replay rights are the enforcement mechanism we have been missing. The substrate is here. The hard part is choosing to use it.

## Read next

- Foundation: **[Why LLM Workbench exists](/blog/why-llm-workbench-exists)**
- The contractual prerequisite: **[Agent contracts](/blog/agent-contracts-the-missing-layer-between-agents-and-humans)**
- The economic prerequisite: **[The hyperscaler token-pricing playbook](/blog/hyperscaler-token-pricing-playbook)**
- The operational layer: **[What LLM Workbench solves](/blog/what-llm-workbench-solves)**

Subscribe via **`/feed.xml`** for ongoing writing on **moonshots, AI governance, and replayable agents**.
