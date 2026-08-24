---
title: >-
  When cost decides the model: routing, telemetry, and the run bundle that
  proves it
description: >-
  Fable's premium pricing is pushing teams to route work across models by cost.
  Here's why model-agnostic tracing, cost telemetry, and audit-ready run bundles
  matter more than ever.
date: '2026-08-24T14:18:20.538Z'
tags:
  - cost-telemetry
  - model-routing
  - run-bundles
  - ai-governance
  - observability
author: LLM Workbench
---
This week's most useful signal wasn't a benchmark or a new frontier model. It was a shift in how teams *choose* models, driven almost entirely by cost. That shift lands squarely on the concerns we care about at LLM Workbench: model-agnostic tracing, cost telemetry, human-in-the-loop gates, and audit-ready run bundles.

## The free lunch is over

Drew Breunig captured the mood precisely. Before Anthropic's Fable model, he writes, "it felt silly to waste *too* much time improving your coding harness or context strategies. A new model would arrive at the same price (or cheaper!) and paper over most of your problems." Then Fable landed, and it was "*incredible*" — but expensive enough that Opus was "*good enough* (as was 5.6, K3, and even GLM) for *most* of the code we needed." So, as he puts it, "we started to think about what work went where" ([Drew Breunig, Fable & The End of the Free Lunch](https://simonwillison.net/2026/Aug/23/drew-breunig/)).

That last sentence is the whole ballgame. When a single frontier model no longer papers over every problem at a flat price, teams start *routing*: cheap models for the bulk, premium models for the hard cases. Routing is a governance event. Every decision about which model handled which task becomes something you need to observe, cost, and later justify.

## The market data backs the story

The adoption numbers make the pressure concrete. Anthropic's annualized July revenue reportedly climbed to $65bn (up from $47bn in May), with 6,000 customers spending $100,000 or more annually, while OpenAI's annualized revenue passed $40bn after the GPT-5.6 launch ([Anthropic's best AI model struggles to attract users as cheaper tools thrive](https://simonwillison.net/2026/Aug/23/anthropics-best-ai-model-struggles-to-attract-users-as-cheaper-t/)).

But look at the Ramp AI index breakdown of Anthropic model spend for July 2026: Opus 4.8 dominates at 28.0%, while Fable 5 sits at just 8.0% and the newest Opus 5 at 3.5%. The newest, most capable model is *not* the most-used. Cost is steering behavior. When your spend distribution looks like that, you cannot manage it without per-run cost telemetry that ties dollars to specific tasks, models, and outcomes.

## Routing without observability is guessing

Here's the trap. Once you split work across Opus, Sonnet, Fable, GPT-5.6, and open-weight options like GLM, your quality and your bill both become emergent properties of a routing policy nobody wrote down. A task silently routed to a cheaper model that produced worse output is invisible unless you captured which model ran, what it received, what it returned, and what it cost.

That's the case for **model-agnostic tracing**. If your tracing layer only understands one vendor's SDK, every routing decision that crosses a vendor boundary becomes a blind spot. A run bundle should record the model identifier, version, prompt, response, token counts, and cost regardless of whether the underlying call went to Anthropic, OpenAI, or a self-hosted open-weight model. The market is heterogeneous now; your evidence layer has to be too.

## Cost telemetry is a governance primitive, not a dashboard nicety

It's tempting to treat cost as a finance concern — a monthly bill someone reconciles. But when routing decisions are made per-request, cost becomes part of the decision record. "We used the cheaper model here because the task was low-risk" is a claim you may need to defend. If Fable is reserved for the hard cases and Opus 4.8 handles the bulk, an audit-ready run bundle should show *which policy fired for this run*, *why*, and *what it cost* — not just an aggregate at the end of the month.

This is where cost telemetry and human-in-the-loop gates converge. A gate that says "escalate to the premium model only after human approval" is only trustworthy if the bundle records who approved, when, and what the incremental cost of escalation was. Otherwise you have a policy on paper and no evidence it was followed.

## Data retention and the shape of the record

Routing across vendors also multiplies your data-handling surface. OpenAI's reaffirmation of Zero Data Retention for eligible API customers, alongside a preview of Private Safety Processing, is a reminder that different providers offer different retention guarantees ([Offering Zero Data Retention for frontier models](https://openai.com/index/offering-zero-data-retention-for-frontier-models)). If your run bundle is the durable record and the provider retains nothing, then *your* bundle is the only evidence that a given interaction happened at all. That raises the stakes for capturing complete, self-contained traces at your own boundary rather than relying on a vendor to reconstruct history later.

## Cheap generation, expensive accountability

The efficiency story is real on the production side too. Stampli reportedly compressed weeks of launch production into days using Codex and ChatGPT Work, cutting launch hours by 68% ([Stampli cuts launch hours by 68% using ChatGPT Work](https://openai.com/index/stampli)). When generation gets that cheap and fast, the bottleneck moves downstream: *can you account for what was produced?* Faster inference paths like Liquid AI's LFM2.5-DSpark, reporting up to 3.2x faster inference ([Up to 3.2x Faster Inference with LFM2.5-DSpark](https://huggingface.co/blog/LiquidAI/lfm25-dspark)), only accelerate this. More output per dollar means more decisions per audit window.

## Governance is now a first-class topic

OpenAI's launch of AI Futures, a blog "exploring how transformative AI could reshape power, governance, the economy, and individual freedom" ([Introducing AI Futures](https://openai.com/index/introducing-ai-futures)), signals that governance framing is going mainstream. The practical work, though, happens at the run level. Broad governance narratives matter, but they're only enforceable if each individual agent run leaves behind a contestable, replayable record.

## A useful reframe

Simon Willison's coverage of a pattern where an executable *is* a SQLite database — arranging ELF components into database tables so the file is both queryable and runnable ([Your executable is a SQLite database](https://simonwillison.net/2026/Aug/24/your-executable-is-a-sqlite-database/)) — is a nice analogy for where run bundles should go. The artifact and its inspectable structure are the same object. A good run bundle is like that: not a log you grep after the fact, but a structured, queryable record where the trace, the cost, the model choice, and the human approvals all live in one addressable place.

## The takeaway

The end of the free lunch means model choice is now a per-task economic decision. That makes three things non-negotiable: model-agnostic tracing so routing across vendors doesn't create blind spots, cost telemetry attached to each run so policy claims are defensible, and human-in-the-loop gates recorded inside the bundle. When cost decides the model, the run bundle is what proves the decision was the right one.
## Sources

- [Your executable is a SQLite database](https://simonwillison.net/2026/Aug/24/your-executable-is-a-sqlite-database/) — Simon Willison
- [Anthropic’s best AI model struggles to attract users as cheaper tools thrive](https://simonwillison.net/2026/Aug/23/anthropics-best-ai-model-struggles-to-attract-users-as-cheaper-t/) — Simon Willison
- [Quoting Drew Breunig](https://simonwillison.net/2026/Aug/23/drew-breunig/) — Simon Willison
- [From Atari to EVE Online: Building on 15 Years of AI Research in Games](https://deepmind.google/blog/from-atari-to-eve-online-building-on-15-years-of-ai-research-in-games/) — Google DeepMind
- [Measuring benchmark optimization in speech recognition](https://huggingface.co/blog/asr-benchmark-optimization) — Hugging Face
- [Up to 3.2x Faster Inference with LFM2.5-DSpark](https://huggingface.co/blog/LiquidAI/lfm25-dspark) — Hugging Face
- [Introducing AI Futures](https://openai.com/index/introducing-ai-futures) — OpenAI
- [Stampli cuts launch hours by 68% using ChatGPT Work](https://openai.com/index/stampli) — OpenAI
- [Offering Zero Data Retention for frontier models](https://openai.com/index/offering-zero-data-retention-for-frontier-models) — OpenAI
- [5 new ways to level up your learning with Search](https://blog.google/products-and-platforms/products/search/back-to-school-study-tools/) — Google AI
- [How Much Memory Does Your Agent Actually Need?](https://huggingface.co/blog/ibm-research/altk-evolve-hmm) — Hugging Face
- [Get closer to the game with Gemini and Pixel](https://blog.google/products-and-platforms/products/gemini/google-gemini-pixel-football-club-partnerships/) — Google AI
- [Introducing Gemini 3.7 Flash](https://deepmind.google/blog/introducing-gemini-3-7-flash/) — Google DeepMind
- [Bring your spreadsheet data to life with Sheets canvas](https://blog.google/products-and-platforms/products/workspace/sheets-canvas-for-google-sheets-spreadsheets/) — Google AI
- [Putting sign language AI into users’ hands](https://deepmind.google/blog/putting-sign-language-ai-into-users-hands/) — Google DeepMind
