---
title: "Agent contracts: the missing layer between AI agents and the humans accountable for them"
description: "A recovering lawyer's case for a machine-readable contractual layer between AI agents and their human controllers—scope, consent, revocation, restitution—encoded as gates and run bundles."
date: "2026-05-05T08:45:00-06:00"
tags:
  - AI governance
  - agent contracts
  - principal-agent
  - human-in-the-loop
  - run bundles
author: LLM Workbench
---

## From the desk of a recovering lawyer

The founder of this tool will tell you, plainly, that he is a **recovering lawyer**. He is loathe to talk about contracts. Most engineering blog posts about “contracts” turn out to be about TypeScript interfaces, which is, in his view, a mercy.

And yet: as we have watched teams ship AI agents into production, the rest of the team has come around to a position the recovering lawyer was determined not to take. **Agents need contracts.** Not in the “let’s draft a 40-page master services agreement” sense. In the **engineering** sense: a small, machine-readable layer that records what an agent is allowed to do, who said so, what happens when it deviates, and how a human can reach in and stop it.

Calling this layer a “contract” is not legal cosplay. It is the most accurate noun for what is missing. Software has always had **principals** and **agents**: a user delegates capability to a process, a process delegates to another process, and the chain is governed by trust assumptions encoded in code, configs, and—usually—nowhere visible.

LLMs blew this open. We are now wiring **probabilistic** agents into systems that move money, hire people, and write to medical records. The trust assumptions are still in nobody’s code, in nobody’s database, and in nobody’s YAML. They are in **prompts**, which drift. That is the gap a contractual layer fills.

## The principal-agent problem, but for software that thinks

Economists and lawyers have a name for the gap between a person who delegates authority and the agent who acts on it: the **principal-agent problem**. The classic [Jensen and Meckling formulation](https://www.sciencedirect.com/science/article/abs/pii/0304405X7690026X) is about hidden information and misaligned incentives.

LLM agents inherit every part of that problem and add three more:

1. **Probabilistic execution.** The same prompt produces different answers. Compliance becomes statistical, not deterministic.
2. **Tool latitude.** The agent can call functions—HTTP, shell, code interpreter, MCP—whose effects are real and frequently irreversible.
3. **Context drift.** Long-running threads accumulate state that quietly changes what the agent “knows” it’s allowed to do. **[Context rot and enterprise cost](/blog/context-rot-visibility-enterprise-llm-cost-control)** documents this in finance terms; it is a governance problem too.

In a traditional company, you address this with **employment agreements**, **scope-of-work**, **delegated authority schedules**, **revocation procedures**, and **insurance**. Each is a contract. Each is enforceable. Each is **legible** to a third party.

For agents we have, in most production stacks, a system prompt. Maybe a cron job. A Slack thread.

That is not a control structure. That is a hope.

## What an agent contract actually contains

An **agent contract** is not a 40-page document. It is a small set of fields, attached to a run, that any reviewer or assistant can read. Think of it as the README for a delegation:

| Field | What it answers | Where it lives in LLM Workbench |
| --- | --- | --- |
| **Principal** | Whose authority is the agent acting under? | Tenant + user identity on the run, surfaced via Clerk org / `agents.md` |
| **Scope** | Which workflows, steps, and tools is the agent permitted to use? | DAG snapshot + workflow `typeId` registry |
| **Capability grants** | Which tools, with which arguments, in which artifact types? | `tool_call` events + JSON Schemas registered for artifact `typeId`s |
| **Consent boundaries** | Where must a human bless the next step? | `PAUSE_AFTER` / `CHECKPOINT` gates (`human_gate_requested`) |
| **Revocation** | How does the principal stop the agent immediately? | `policy_changed` mid-run, run cancellation, gate rejection |
| **Restitution** | How do we know what to undo if the agent overstepped? | `artifact_patch` history + tamper-evident bundle export |

None of these need a lawyer. They need an **engineer with discipline** and a runtime that records facts in the shape of the contract, not in the shape of yesterday’s log line.

If you want the canonical vocabulary—`TraceEvent`, gates, artifacts, integrity—the **[protocol overview](/docs/protocol)** is the source of truth. **[What LLM Workbench solves in production LLM stacks](/blog/what-llm-workbench-solves)** explains how those facts compose into bundles you can hand to an auditor without translation.

## Why prompts and EULAs aren’t enough

Two common substitutes show up in shipping stacks. Both are necessary. Neither is sufficient.

**Prompts.** Strong system prompts reduce accidental harm. They do not encode delegation. A prompt that says “only edit the customer record if the user has approved it” is a *suggestion to a language model*. It is not a runtime constraint, and it is invisible to the auditor who arrives six months later asking why the customer’s address changed at 02:47 UTC. Gates encode the same intent as **runtime facts** with timestamps and actors—the difference between an aspirational memo and an enforceable record.

**EULAs.** Vendor terms of service handle one slice: what the model provider may do with your data and outputs. They say nothing about the **internal** delegation between your operator, your agent, and your customer. The recovering lawyer’s instinct is correct here: external contracts are necessary; they are also far from enough.

The contractual layer that matters is internal, lightweight, and **lives where the agent runs**.

## The trace event as the binding instrument

Lawyers use the word **instrument** for a document that creates rights and obligations: a deed, a note, a charter. In the world of running agents, the binding instrument is the **trace event**.

A `human_gate_requested` event is a delegation hold. A `human_gate_resolved` with `decision: "approved"` and a reviewer identity is the executed authorization. An `artifact_written` with a schema-validated payload is the deliverable. An `integrity.sha256` over the canonical JSON is the **notarization**.

When all four exist together inside a **run bundle**, you have the equivalent of a signed, dated, witnessed instrument that any future reviewer—engineer, auditor, regulator, or counter-party—can verify offline. **[Why LLM Workbench exists](/blog/why-llm-workbench-exists)** describes why we made bundles tamper-evident on purpose: not because we wanted to dabble in cryptography, but because **disagreements about what the agent did** are the single most expensive failure mode in this category, and they are entirely avoidable with a few extra bytes per run.

## A minimal contract template

Don’t boil the ocean. The first contract you ship should fit on one page and answer five questions. We see teams adopt this almost universally on their second incident:

1. **Who is the principal for this run?** Capture tenant, user, and—if applicable—the customer the agent is acting *for*. Bind it to the run id.
2. **What scope is granted?** Name the workflow, the version, and the explicit list of tools the agent may call. Reject calls that fall outside.
3. **Where are the consent boundaries?** Annotate at least one step with a gate. We have never seen a production agent that didn’t deserve at least one. **[Who benefits—and how to start](/blog/who-benefits-and-how-to-start)** suggests starting with the single riskiest step.
4. **How is the contract revocable?** A reviewer must be able to *reject* a gate, kill a run, or override a policy mid-execution. Wire it through your existing on-call surface so revocation is muscle memory, not a runbook.
5. **How are deviations adjudicable?** Decide ahead of time where bundles export—object storage, ticket attachments, SIEM. If a customer or regulator asks “what did the agent do?” the answer is a URL to a verifiable bundle, not a Slack search.

You can implement all five in an afternoon on top of `@llm-workbench/ai-sdk`, `start_run`, `resolve_gate`, `write_artifact`, and `export_bundle` (MCP) or the equivalent REST routes. The discipline is not technical. It is **declarative**: write the contract down where the runtime can see it.

## What this is not

To pre-empt the recovering lawyer’s objections to anyone misreading him:

- This **does not replace** your customer agreements, vendor terms, or regulatory filings. Those still apply, and your counsel still earns their retainer.
- This **is not a moral framework**. It is plumbing. A contractual layer makes ethical questions *legible*; it does not answer them.
- This **does not assume bad actors**. Most agent incidents we see are honest accidents: a tool that returned more data than expected, a prompt that drifted three deploys ago. Contracts make accidents recoverable.

## The minimum viable agreement

If you take one thing from this post: **write down what your agent is allowed to do, where a human must intervene, and how to undo it—in code, today.** Then export the runs that follow as bundles your future self can read.

The recovering lawyer will deny he wrote any of this. But the engineering team has filed it under *things we wish we’d done sooner*. Most things in production fall into that drawer eventually. A contractual layer for your agents shouldn’t.

## Read next

- Mission framing: **[Why LLM Workbench exists](/blog/why-llm-workbench-exists)**
- Anatomy of a bundle: **[What LLM Workbench solves](/blog/what-llm-workbench-solves)**
- Adoption playbook: **[Who benefits—and how to start](/blog/who-benefits-and-how-to-start)**
- Cost angle: **[The hyperscaler token-pricing playbook](/blog/hyperscaler-token-pricing-playbook)**

Subscribe via **`/feed.xml`** for ongoing writing on **agent contracts, AI governance, and replayable runs**.
