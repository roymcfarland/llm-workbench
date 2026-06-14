---
title: "Hunting unsafe-eval: removing the last eval from a strict CSP"
description: "Ajv compiled JSON-Schema validators in the browser with new Function, which forced 'unsafe-eval' into our production policy. Here's how we precompiled it away—and pinned it shut."
date: "2026-06-02"
tags:
  - security
  - csp
  - ajv
author: LLM Workbench
---

## One carve-out in an otherwise strict policy

A Content-Security-Policy is only as strong as its weakest directive. Ours was nearly airtight — a `script-src` built on a per-request **nonce** and `strict-dynamic`, with nothing a modern browser would execute by accident — except for one stubborn token: **`'unsafe-eval'`**. We knew exactly why it was there, and exactly what it cost.

## Why a JSON-Schema validator wants eval

LLM Workbench validates every artifact and rule payload against a registered schema, and it uses **Ajv** to do it. Ajv is fast for one specific reason: rather than interpret a schema at runtime, it **compiles** it — generating a bespoke validation function as a string and turning it into code with `new Function`. Brilliant on a server. In a browser, `new Function` is *precisely* what `'unsafe-eval'` guards: the ability to turn a string into executable JavaScript.

Our client-side `SchemaRegistry` compiled the demo and scenario schemas on load, so the page genuinely could not run without the directive. We learned this the hard way: removing it once killed `/runs/demo` with an `EvalError`. The carve-out was load-bearing.

## Why we wanted it gone anyway

`'unsafe-eval'` is not a subtle weakening. Nonce + `strict-dynamic` exist so that only scripts you vouched for — and the scripts those load — ever execute; an attacker who finds an injection point still can't run anything. `'unsafe-eval'` punches a hole in that guarantee: any path that reaches `eval` or `new Function` with attacker-influenced input becomes a code-execution primitive. For an app whose entire premise is **tamper-evident, auditable runs**, shipping an eval escape hatch felt like leaving the back door propped for convenience.

## Precompile, don't compile

The unlock: our schemas aren't dynamic. The demo and scenario artifact types are **fixed and known at build time**. Ajv ships a *standalone* mode for exactly this — it emits each compiled validator as a self-contained module, generated once during the build. You import it like any other code; there is no `new Function` at runtime, because the codegen already happened on a build machine where eval is nobody's threat model.

We added a generator that walks every registered schema, emits standalone validators, and writes them to a committed module. A **freshness test** re-runs generation and fails if the committed output drifts — so a schema change that forgets to regenerate is a red build, not a silent mismatch.

## Wiring it without re-breaking the demo

The registry now accepts a precompiled validator alongside a schema and prefers it over compiling. We also made its Ajv instance **lazy**: if every registration supplies a precompiled validator, the compiler is never even constructed — there's no eval left to reach.

The piece we cared about most is the **coverage guard**. Building the client registry *throws* — loudly, at construction — if any schema id is missing its generated validator. There is no quiet fallback to runtime compilation: you either have a precompiled validator for every client schema, or the app refuses to start. That property is what lets us trust the removal months from now, when someone adds a schema and has never read this post.

## Dropping the directive — and pinning it shut

With no reachable eval path, we removed `'unsafe-eval'` from the production nonce policy. Development keeps it, because Turbopack's HMR legitimately needs it and dev isn't the threat surface. Then we did the thing we should have done the first time: an end-to-end test that loads `/runs/demo` under the production CSP and fails on any eval or script violation. **The exact page that broke the last attempt is now the regression pin for this one.**

## Where it landed

Production `script-src` is now nonce + `strict-dynamic`, no eval. Validators run as ordinary functions. A missing validator surfaces in the build, not in production. It's a small directive to delete — and three slices of careful work to delete it *safely* — but it closes the one hole in a policy that's otherwise as strict as we know how to make it. The most satisfying security work isn't adding a control; it's earning the right to remove a weakening.
