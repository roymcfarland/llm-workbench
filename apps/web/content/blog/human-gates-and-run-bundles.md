---
title: "Human gates and run bundles: pausing cognition safely"
description: "PAUSE_BEFORE, PAUSE_AFTER, and durable decisions — tying human review to structured trace events in your agent workflows."
date: "2026-04-02"
tags:
  - human-in-the-loop
  - governance
  - workflows
author: LLM Workbench
---

## Why pause points belong in the graph

“Human in the loop” often becomes informal: a Slack ping, or a reviewer eyeballing a dashboard. Formal **gates** tied to workflow steps encode:

- Exactly **when** a human may intervene relative to DAG execution.
- A **structured decision record** reviewers can revisit later.

LLM Workbench models **gates** as first-class events in the bundle, not commentary around the edges.

## PAUSE_BEFORE and PAUSE_AFTER

- **PAUSE_BEFORE** stops before a risky step executes — approvals before side effects compound.
- **PAUSE_AFTER** stops after artifacts exist — ideal when a human validates output shape before propagation.

Either way, approvals and rejects become trace events beside model I/O, not orphaned chat messages.

## Run bundles tie it together

A **bundle** carries the frozen workflow snapshot plus the trace — including gates — so QA, security, or future-you can reconstruct not only *tokens*, but policy as lived by the deployment.

Explore the broader protocol surfaces in LLM Workbench’s documentation and playgrounds when you wire your first gate.
