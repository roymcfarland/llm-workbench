# Closeout: Landing DeLorean trace and console rings

This slice updates the landing hero's live demo story and moves the floating
wire rings away from the text column.

## Outcome

- The hero console now loops a DeLorean time-jump workflow:
  `setCircuits → power → launch`.
- The trace choreography writes `timeCircuits`, logs the
  `claude-sonnet-4-5` power-planning model call, writes the `1.21` gigawatt
  power plan and `88 mph` launch card, then resolves the launch `PAUSE_AFTER`
  gate.
- The static fallback rows and SVG now mirror the DeLorean workflow labels.
- The Three.js wire rings keep their existing look and animation, but are
  positioned around the console side so the hero subheading remains readable.
- No tests were added or changed; this is a visual/UI-only landing update.

## Files Changed

- `apps/web/components/landing/hero-live-run.tsx`
- `apps/web/components/landing/hero-atmosphere.tsx`
- `apps/web/components/landing/static-workflow-svg.tsx`
- `apps/web/app/page.tsx`
- `CHANGELOG.md`
- `CLOSEOUT.md`

## Verification

- `npm run build`
- `npm run typecheck -w @llm-workbench/web`
- `npm run lint -w @llm-workbench/web`
- `npm test -w @llm-workbench/web`
- `npm run build:web`
- `npm run ci`
- Manual dev check: the landing hero console loops the DeLorean run, the trace
  includes the model/artifact/gate events, the rings sit by the console, and
  cursor movement still does not affect the starfield.
