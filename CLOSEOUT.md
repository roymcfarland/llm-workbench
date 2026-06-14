# Closeout: Landing hero starfield ignores cursor input

This slice removes cursor-driven motion from the landing-page hero atmosphere while
preserving the existing autonomous animation in both render paths.

## Outcome

- The Three.js hero no longer installs a pointer listener or lerps the camera toward pointer
  coordinates; the existing Canvas camera position stays fixed at `[0, 0, 4.55]`.
- The canvas fallback no longer tracks pointer position or applies mouse-attraction forces.
- Ambient motion is preserved: galaxy particles continue drifting/rotating, wire rings rotate,
  sparkles twinkle, and the canvas nebula blobs and particles keep animating on their own.
- No tests were added or changed; this is a visual/UI-only behavior change in two components.

## Files Changed

- `apps/web/components/landing/hero-atmosphere.tsx`
- `apps/web/components/landing/cosmos-field.tsx`
- `CHANGELOG.md`
- `CLOSEOUT.md`

## Verification

- `npm run build`
- `npm run typecheck -w @llm-workbench/web`
- `npm run lint -w @llm-workbench/web`
- `npm test -w @llm-workbench/web`
- `npm run build:web`
- `npm run ci`
- Manual dev check: moving the cursor over the landing hero no longer moves the stars, while
  ambient drift, sparkles, ring rotation, and nebula glow continue animating.
