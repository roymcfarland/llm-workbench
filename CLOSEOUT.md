# Closeout: PROJECT.md — authorize automated blog generation (clear non-goal #55)

## Summary

Spec-only governance amendment that unblocks the automated weekly blog
publisher. The "not a model provider" non-goal was broad enough that a
context-free Verifier could reject the publisher PR for adding a Vercel AI
Gateway call. This amendment scopes that non-goal to the
`@llm-workbench/runtime` control plane and explicitly permits `apps/web` and
repository site-ops tooling to call the Gateway (which `apps/web` already does),
then adds a resolved Q5 authorizing the publisher with its own Verifier
behavior. Per the builder/verifier loop's Lesson 98, the rule is cleared in this
PR before the feature PR is drafted.

## Changes

- **`PROJECT.md`**
  - Non-goal "Not a model provider": narrowed to the runtime/control-plane;
    added a carve-out for `apps/web` + site-ops tooling using the AI Gateway.
  - Added **Q5. Automated blog / content generation** under "Open questions
    (resolved)": in scope as site-ops tooling, source-grounded + schema-validated
    + dormant-by-default, with Verifier behavior (don't reject the publisher on
    the model-provider non-goal; require it stay gated and schema/CI-valid).

## Verification

- No code or config changed — `PROJECT.md` only (plus this ledger).
- The amendment does not touch any other non-goal (eval, routing, marketplace,
  realtime, etc.); Q5 explicitly states the publisher performs none of those.

## Not in scope

- The publisher implementation (workflow, generator script, source config,
  tests) — the next slice, built via the builder/verifier loop.
