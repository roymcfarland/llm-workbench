---
title: "Shipping log: a stricter CSP, a calmer landing, and a demo with a sense of humor"
description: "A few weeks of work, recapped—removing the last unsafe-eval from production, a fail-closed audit gate, and a landing page that finally feels like the product."
date: "2026-06-13"
tags:
  - changelog
  - security
  - product
author: LLM Workbench
---

## Security

- **Removed `'unsafe-eval'` from the production CSP.** Schema validators are now precompiled at build time — no runtime codegen — and a coverage guard fails the build if any is missing. (The full story is in [Hunting unsafe-eval](/blog/hunting-unsafe-eval).)
- **A fail-closed audit gate.** CI now blocks on any new advisory by GHSA id; the handful of no-fix transitive findings are allowlisted with revisit triggers, not muted.
- **Rate limiting fails closed in production** instead of silently running unlimited.

## The demo grew up

`/runs/demo` now rotates through five beloved-story agent runs — real traced runs wearing fun costumes — each showing the full shape of a run (steps, a human gate, `model_io` with cost, typed artifacts) in ten seconds.

## A landing that feels like the product

A starfield hero that drifts calmly — and ignores your cursor, on purpose — a live DeLorean trace previewing the workbench, and the occasional sci-fi craft drifting past. Plus a real mobile nav and an FAQ, so you can find your way around on a phone.

## Under the hood

A pile of less-visible hardening: nonce-based CSP, the tamper-evident bundle path, and error-path resilience across the runtime and MCP surfaces — the kind of work nobody notices until it's missing.

## What's next

Earning the right to remove the next weakening. That's usually where the good security work hides.
