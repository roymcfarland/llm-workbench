# Closeout: site favicon, app icons, and web manifest

## Summary

Added the missing favicon, iOS app icon, and web app manifest for `apps/web`,
matched to the existing LLM Workbench gradient-orb brand mark.

## Changes

- **`apps/web/app/icon.svg`** — static SVG favicon with the dark rounded square
  and centered cyan-to-purple-to-pink orb.
- **`apps/web/app/apple-icon.tsx`** — `next/og`-generated 180x180 PNG app icon
  using the Node.js runtime and matching orb/glow treatment.
- **`apps/web/app/manifest.ts`** — web app manifest with app metadata, dark
  theme/background colors, and favicon/apple-icon entries.
- **`apps/web/app/layout.tsx`** — linked `/manifest.webmanifest` from the
  exported metadata object.
- **`apps/web/proxy.ts`** — added `/apple-icon(.*)` to the public-route matcher
  so the generated iOS icon is reachable without Clerk authentication.
- **`PROJECT.md`** — corrected stale Q2 middleware guidance to the Next.js 16
  `proxy.ts` convention after this PR surfaced the stale-spec conflict.
- **`CHANGELOG.md`** — documented the favicon/app-icon/manifest slice under
  Unreleased.
- **`CLOSEOUT.md`** — this slice closeout.

## Verification

- `npm run typecheck -w @llm-workbench/web`
- `npm run lint -w @llm-workbench/web`
- `npm run build:web`
- Local route spot checks for `/icon.svg`, `/manifest.webmanifest`, and
  `/apple-icon`.

## Not in scope

No changes to existing OG/Twitter image routes or `lib/og-image-markup.tsx`.
