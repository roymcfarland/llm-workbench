---
title: "Who benefits from LLM Workbench—and how to start using it"
description: "Roles that get leverage from bundles and gates today, plus a practical entry path through docs, traced calls, playgrounds, and machine-readable surfaces."
date: "2026-04-28"
updated: "2026-04-28"
tags:
  - adoption
  - MCP
  - AI SDK
author: LLM Workbench
---

## Who tends to reach for this first

Teams **shipping agents past demos** tend to converge on overlapping needs:

- **Platform or backend engineers wiring orchestration** need trace facts alongside steps—not only stdout—so failures map to workflows.
- **Security and governance** stakeholders need approvals and receipts that export cleanly—not tribal knowledge in chat.
- **Reliability-focused leads** replay incidents alongside tests; bundles **document what happened**, not guesses.
- **Integration-minded engineers** expose the same envelopes to MCP clients, REST consumers, or internal tools without bespoke glue per surface.

If your organization argues about “what the agent did” instead of iterating on workflows, shared **bundle semantics** help.

## Practical ways to explore

Reading beats guessing—start where your role overlaps:

- **[Protocol overview](/docs/protocol)** establishes nouns consistently: bundles, traces, gates, migrations.
- **Drop-in wrappers** (`@llm-workbench/ai-sdk`) retrofit existing [Vercel AI SDK](https://ai-sdk.dev/) calls so `generateText`-style workloads emit structured **model_io** without rewriting cognition from scratch—the **import-swap narrative** mirrors how teams onboard incrementally.
- **`/playground`** in this app sketches how runs feel when wired end-to-end; **`/runs/demo`** shows a concrete public-facing shape.
- **Machine lanes** converge on the **same truths**: **`/agents.md`**, **`/llms.txt`**, **`/.well-known/mcp.json`**, **`/api/openapi.json`**—agents and integrators shouldn’t scrape HTML to learn semantics.

RSS readers can follow **`/feed.xml`** for blog additions without polling marketing pages.

## What “good adoption” tends to resemble

Nobody flips continents overnight—teams usually:

- Identify one **risky DAG step** deserving a documented gate—not every step on day zero.
- Land **tracing** wrappers on the hottest **generateText-style** surfaces first—prove durable receipts before widening.
- Decide how **bundles export** upstream (object storage vs tickets vs compliance)—so humans know where canon lives.

## Concrete integration checklist

Use this as an acceptance checklist rather than inspiration fodder:

1. **Freeze schemas before UI.** Register JSON Schemas for artifact `typeId`s your workflows emit — validation failures become trace-visible mistakes early.
2. **Wrap hot AI SDK calls.** Swap `generateText` / streaming helpers for `@llm-workbench/ai-sdk` wrappers tied to an active run session so **`model_io`** events inherit step ids without bespoke logging.
3. **Pick one risky gate.** Identify the single step whose mistaken automation hurts most — attach `PAUSE_AFTER` or `CHECKPOINT`, wire reviewers to `/runs/[runId]` or MCP `resolve_gate`.
4. **Define export destiny.** Decide whether bundles land in object storage, ticketing attachments, or SIEM pipelines — **`export_bundle`** (MCP) produces tamper-evident JSON with integrity suitable for auditors.
5. **Verify programmatically.** Exercise **`verify_run_integrity`** / **`validate_run_bundle`** on exported bundles inside CI before you promise downstream consumers cryptographic assurance.

## REST versus MCP for automation

Both surfaces enforce the same tenancy rules (`/agents.md`); choose by ergonomics:

- **REST (`/api/runs`)** fits cron jobs, backend workers, and anything already issuing cookies or bearer tokens over vanilla HTTP — payloads mirror **`RunStoreState`** for persistence rounds.
- **MCP (`/api/mcp`)** fits assistants that enumerate tools — combine **`export_bundle`** with **`verify_run_integrity`** when automation must fetch integrity-ready archives without bespoke glue.

Neither replaces your gateway billing APIs — correlate **`model_io`** cost lines against invoices separately — but both preserve **workflow-relative semantics** cheaper than scraping unstructured logs.

## Reading order for engineers

Skim **[`/docs/protocol`](/docs/protocol)** top-down once for vocabulary, then drill **`TraceEvent`** shapes while holding one exported bundle beside **`GET /api/openapi.json`**. When those three agree in your head, the playground stops feeling magical and starts feeling inspectable — **reach for LLM Workbench** when you’d rather replay a tape than persuade a room from memory.
