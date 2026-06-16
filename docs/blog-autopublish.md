# Weekly Blog Auto-Publisher

The blog auto-publisher is site-ops tooling for `apps/web`. It fetches curated
AI-news RSS feeds, asks the Vercel AI Gateway for a source-grounded post, checks
the generated markdown against the existing blog front-matter contract, and
publishes only when the post passes validation and CI.

## Sources

The editable source list lives in `scripts/blog-sources.json`. It currently
uses:

- Simon Willison — `https://simonwillison.net/atom/everything/`
- Hugging Face — `https://huggingface.co/blog/feed.xml`
- OpenAI — `https://openai.com/blog/rss.xml`
- Google DeepMind — `https://deepmind.google/blog/rss.xml`
- Google AI — `https://blog.google/technology/ai/rss/`

The same file controls `lookbackDays`, `maxPerFeed`, `minItems`, `minWords`,
and `maxWords`.

## Grounding And Validation

`scripts/blog-autopublish.mjs` fetches each feed with `rss-parser`, skips dead
feeds, deduplicates items by link, caps each feed, and requires at least
`minItems` recent sources. The generation prompt instructs the model to cite
only the supplied sources as markdown links and to connect the week in AI news
to LLM Workbench themes: audit-ready run bundles, human-in-the-loop gates,
model-agnostic tracing, agent observability, cost telemetry, and governance.

Generated output is structured with `generateObject`, using a Zod schema for
`title`, `description`, `tags`, and `bodyMarkdown`. The script then writes
normal blog front matter and validates the result for required title,
description, date, `##` headings, a `## Sources` section, and the configured
word-count range. In publish mode the workflow also runs:

```bash
npm test -w @llm-workbench/web
npm run build:web
```

## Enabling

Scheduled runs are dormant by default. To turn them on:

- Add the `AI_GATEWAY_API_KEY` repository secret.
- Set the repository variable `BLOG_AUTOPUBLISH_ENABLED=true`.
- Optionally set `BLOG_MODEL` to override the default
  `anthropic/claude-opus-4-8` model.

The key is read only from the environment. It is never written to logs or source.

## Safe Testing

Use a manual dry run before enabling the weekly schedule:

1. Open GitHub Actions.
2. Select **Blog autopublish**.
3. Choose **Run workflow**.
4. Keep `mode` set to `dry-run`.
5. Download and review the `blog-preview` artifact.

`dry-run` writes `blog-autopublish-preview.md` as an artifact and never touches
`apps/web/content/blog`.

## Schedule

The workflow runs Mondays at 14:00 UTC:

```yaml
cron: "0 14 * * 1"
```

Edit `.github/workflows/blog-autopublish.yml` to change the cadence.

## Publishing Flow

In publish mode the workflow generates a post on the default checkout, validates
it, creates an `autopublish/blog-YYYY-MM-DD` branch, opens a PR, and enables
auto-merge. `.github/workflows/ci.yml` runs CI on `autopublish/**` branch pushes
so required checks attach to the bot commit even though `GITHUB_TOKEN`-created
PRs do not fire `pull_request`. Once checks pass, GitHub auto-merges the PR and
the normal Vercel deployment path takes over from `main`.

## Safety Guarantees

The publisher skips the week when fewer than `minItems` recent sources are
available or when generated markdown fails validation. It cannot merge broken
content without passing the web blog tests and production build because the PR
is still gated by CI.
