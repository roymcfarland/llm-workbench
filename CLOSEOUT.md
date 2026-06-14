# Closeout: CosmosField reduced-motion ReferenceError fix

Fixes a temporal-dead-zone crash in the landing's canvas atmosphere fallback
(`CosmosField`) that only triggered under `prefers-reduced-motion: reduce`.

## Problem

Inside the main `useEffect`, the initial `resize()` was invoked before the
`paintStatic` `const` arrow function was defined. Under reduced motion, `resize()`
runs `if (reduced) paintStatic();`, so it hit `paintStatic` while it was still in
the temporal dead zone → `ReferenceError: Cannot access 'paintStatic' before
initialization`. Result: users with reduced motion got a console error and a blank
atmosphere (the static fallback never painted). Pre-existing; surfaced during QA of
the drifting-craft PR (#30), not introduced by #30 or #27.

## Fix

- Moved the `const ro = new ResizeObserver(resize); ro.observe(canvas); resize();`
  block to **after** the `trailClear`/`paintStatic` definitions, so the initial
  `resize()` no longer runs in their TDZ. Behavior is otherwise identical — no change
  to the animation loop or the #27 cursor-removal.

## Files Changed

- `apps/web/components/landing/cosmos-field.tsx`
- `CHANGELOG.md`
- `CLOSEOUT.md`

## Evidence

- `npm run ci` exits 0 (build, 299 vitest, typecheck, lint, web build).
- `paintStatic` defined before the immediate `resize()` call (verified by line order).
- Manual: with DevTools "Emulate prefers-reduced-motion: reduce", `/` loads with a
  clean console (no `ReferenceError`) and the static atmosphere paints.
