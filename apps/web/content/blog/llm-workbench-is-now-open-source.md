---
title: "LLM Workbench is now open source (MIT) on npm"
description: "The runtime, the React shell, the AI SDK wrappers, and the MCP server are now published under @llm-workbench on npm, MIT-licensed. Here's what shipped, why, and the engineering it took to make it genuinely installable."
date: "2026-06-16"
tags:
  - announcement
  - open-source
  - npm
  - mit
author: LLM Workbench
---

## tl;dr

LLM Workbench is now **open source under the MIT License** and published to npm under the [`@llm-workbench`](https://www.npmjs.com/org/llm-workbench) scope. Five packages, free to use, modify, and distribute — including commercially:

```bash
npm install @llm-workbench/runtime
```

The source lives at [github.com/roymcfarland/llm-workbench](https://github.com/roymcfarland/llm-workbench), and you can drive a live run right now, no signup, at [/runs/demo](/runs/demo).

## What it is

LLM Workbench is a model-agnostic control plane for LLM-powered products. It turns each run of your agent into a tamper-evident, human-gated, replayable bundle — trace events, artifacts, rules, review gates, model I/O, and cost — signed over canonical JSON and exportable end to end. It is **not** another chat UI, and it is **not** a model provider: your host app owns prompts, providers, and tools, and the runtime records what happened so humans can inspect, edit, approve, fork, and audit it.

## What shipped

| Package | What it gives you |
| --- | --- |
| `@llm-workbench/runtime` | the headless runtime — state, gates, artifacts, traces, telemetry, signed bundles. No framework dependency. |
| `@llm-workbench/ui` | `WorkbenchShell`, a React control surface for runs |
| `@llm-workbench/adapters-react` | a hook for subscribing components to live run state |
| `@llm-workbench/ai-sdk` | Vercel AI SDK wrappers that auto-record correlated model-I/O, tool-call, and cost trace events |
| `@llm-workbench/mcp` | an MCP server factory + HTTP handler to expose a runtime over the Model Context Protocol |

## Why open source, why now

The most useful infrastructure earns trust by being inspectable. A control plane whose entire pitch is *auditability and replay* should not be a black box itself. Opening the source — and shipping it where people actually install things — lets you read exactly how a run bundle is hashed, how a gate transition is recorded, and how cost telemetry is summarized, then build on it without asking anyone's permission.

## The part that's easy to underestimate: making it *actually* installable

"Publish to npm" sounds like one command. Getting to a package a stranger can install and trust took real work, shipped as small, independently verified slices:

- **It had to import under plain Node, not just bundlers.** The runtime used a named import from a CommonJS dependency that every bundler quietly tolerated — and that threw `SyntaxError` the moment someone imported the published package under Node's ESM loader. Fixed, and pinned shut with a CI smoke test that imports the built packages under plain `node` so the regression can't return.
- **The CSP got its last `'unsafe-eval'` removed.** Browser schema validation compiled with `new Function`; we precompiled the validators at build time so the production policy is strict — [the full story is here](/blog/hunting-unsafe-eval).
- **Security and supply chain.** Dependency advisories cleared, a production-scoped audit gate in CI, secret scanning wired into the pipeline, and packages published with build **provenance**.

If you want the meta-story, the repo is also a worked example of an AI-agent **builder/verifier** delivery loop — every change scoped, implemented, and independently reviewed against a written spec before merge.

## Try it, then build on it

- **Drive a run in your browser:** [/runs/demo](/runs/demo) — no signup.
- **Read the protocol:** [/docs/protocol](/docs/protocol).
- **Install it:** `npm install @llm-workbench/runtime` and the [60-second integration](https://github.com/roymcfarland/llm-workbench#60-second-integration) in the README.

Issues and pull requests are welcome. Go break it, fork it, and tell us what's missing.
