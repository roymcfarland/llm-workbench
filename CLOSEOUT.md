# Closeout: Landing drifting craft

This slice adds a subtle, self-contained drifting craft overlay to the landing
hero background without changing the existing atmosphere, starfield, hero copy,
or content layers.

## Outcome

- Added a `"use client"` `DriftingCraft` overlay that schedules one distant
  craft at a time, with a small chance of a second overlapping pass.
- The six inline SVG silhouettes are primitive-only: satellite, ringed orbital
  station, flying saucer, winged star-fighter, Death-Star-ish sphere, and
  X-wing-ish fighter.
- Drift paths randomize craft type, top-biased vertical placement, direction,
  scale, vertical drift, duration, opacity, and tiny rotation.
- The overlay is `aria-hidden`, `pointer-events: none`, and renders nothing
  when `prefers-reduced-motion: reduce` is active.
- Existing atmosphere, mesh, gradient, noise, and hero content layers are
  unchanged apart from inserting the new background sibling.

## Files Changed

- `apps/web/components/landing/drifting-craft.tsx`
- `apps/web/app/page.tsx`
- `CHANGELOG.md`
- `CLOSEOUT.md`

## Verification

- `npm run build`
- `npm run typecheck -w @llm-workbench/web`
- `npm run lint -w @llm-workbench/web`
- `npm test -w @llm-workbench/web`
  - First cold run timed out in four existing `lib/rate-limit/edge.test.ts`
    cases after slow transform/import; an immediate rerun passed 11 files /
    79 tests.
- `npm run ci`
- Manual browser check of `/` after `npm run dev:web`:
  - Normal motion: after ~14s, one craft was active at opacity `0.194`,
    `pointer-events: none`, `aria-hidden="true"`, and `z-index: -20`.
  - Reduced motion: with `reducedMotion: "reduce"`, the drifting-craft styles
    and items did not mount.
  - The craft appeared as a subtle upper-right background silhouette behind the
    hero content.
  - Existing local-dev noise remains from Clerk's test/dummy script host. A
    separate existing reduced-motion error also surfaced in `CosmosField`
    (`Cannot access 'paintStatic' before initialization`); this slice leaves the
    atmosphere untouched per scope.
