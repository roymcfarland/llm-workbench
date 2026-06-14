---
title: "Anatomy of a run bundle"
description: "The run bundle is the unit LLM Workbench is built around. Here's what's inside one—and why each part earns its place."
date: "2026-05-12"
tags:
  - run bundles
  - protocol
  - architecture
author: LLM Workbench
---

## The unit that makes the rest possible

A **run bundle** is the single artifact that captures one execution of your agent. Everything else — replay, audit, human gates, cost attribution — is downstream of getting this one object right. Get the bundle wrong and the rest is dashboards; get it right and production cognition becomes something you can hand to another engineer without folklore.

## A frozen workflow

The bundle opens with a **DAG snapshot**: the workflow exactly as it existed when the run started — steps, gate policies, edges — not as it looks now. Freezing it is the whole point. A replay three months later reconstructs the *same* structure even after you've reshaped the live workflow, so "what the agent thought was running" is never in question.

## Typed trace events, not logs

Every meaningful moment is recorded as a **typed fact**: `step_started`/`step_completed`, `model_io` (provider, model, tokens, cost, duration), `tool_call`, `human_gate_resolved`, `artifact_written`. These aren't free-text lines you regex later — they're structured events you can query, diff, and correlate to DAG structure.

## Artifacts with schemas

The outputs each step produced are **validated against a registered schema and versioned**. That's what lets you diff artifact v1 against v2 and prove exactly which revision crossed an approval boundary.

## Gates: humans on purpose

`PAUSE_BEFORE`, `PAUSE_AFTER`, `CHECKPOINT`. When a human approves, rejects, or edits, the decision is recorded **inside the bundle**, attached to the structured output it gated — not stranded in a Slack thread that no one can cryptographically tie to what the customer received.

## Cost, attributed

Because `model_io` carries tokens and cost per step, invoice lines stop being a mystery: spend ties to the specific call that justified it, against the specific artifact revision it produced.

## The integrity hash

Finally, a **sha256 over the whole bundle**. Forward it to a reviewer, a customer, or a regulator and they can verify it wasn't altered in transit. That single property is the difference between *a dashboard scrape* and *evidence that survives forwarding*.

## Why bundle it at all

Because the alternative is forensic improvisation — pasting logs into spreadsheets, correlating timestamps across vendors, debating whether two "similar" traces meant the same user-visible outcome. A bundle turns each of those into an ordinary engineering problem: diff the JSON, verify the hash, correlate the trace ids.
