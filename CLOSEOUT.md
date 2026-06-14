# Closeout: Landing code diff DeLorean theme

This slice re-themes the landing "one import" code-diff and telemetry rain
examples so they match the DeLorean landing story.

## Outcome

- The raw and traced code samples now read as the DeLorean flight computer
  computing the power needed to hit `88 mph`.
- The traced sample keeps the same `@llm-workbench/ai-sdk` and
  `@ai-sdk/openai` imports, but uses `computePower` for the step id and trace
  events.
- The line-click hints keep their existing line numbers and now emit
  `powerPlan v1`.
- The telemetry rain swaps the remaining job-search sample values for
  `setCircuits`, `flightCard`, and `launch`.
- No tests were added or changed; this is a content/theme-only landing update.

## Files Changed

- `apps/web/components/landing/code-diff.tsx`
- `apps/web/components/landing/telemetry-rain.tsx`
- `CHANGELOG.md`
- `CLOSEOUT.md`

## Verification

- `npm run build`
- `npm run typecheck -w @llm-workbench/web`
- `npm run lint -w @llm-workbench/web`
- `npm test -w @llm-workbench/web`
- `npm run ci`
- Static landing scan: no `scoreListing`, `scoredListing`,
  `You score job listings`, `Rate this listing`, `parser1`, `resume.md`, or
  `"output"` remnants remain in the landing components/page.
- Manual browser check: attempted against the already-running local web server
  at `http://localhost:3000`, but the in-app Browser blocked the local URL under
  its URL policy, so rendered click verification could not be completed in this
  environment.
