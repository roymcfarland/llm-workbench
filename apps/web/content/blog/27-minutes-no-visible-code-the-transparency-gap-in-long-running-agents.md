---
title: '27 minutes, no visible code: the transparency gap in long-running agents'
description: >-
  When GPT-6 Astra runs for 27 minutes and can't show you its work, that's a
  governance failure. This week's news makes the case for run bundles,
  model-agnostic tracing, and human-in-the-loop gates.
date: '2026-09-14T14:14:53.631Z'
tags:
  - agent-observability
  - run-bundles
  - ai-governance
  - human-in-the-loop
  - model-agnostic-tracing
author: LLM Workbench
---
This week's AI news reads like a stress test for anyone responsible for agent governance. Frontier models are being handed longer leashes—end-to-end production systems, self-testing pipelines, 27-minute autonomous tasks—while the tooling that lets a human reconstruct *what actually happened* lags behind. That gap is exactly the problem an audit-ready run bundle exists to close.

## The transparency anti-feature, named out loud

The clearest signal came from Simon Willison, who asked GPT-6 Astra via ChatGPT Work to generate 5K and 10K running routes from his house using OpenStreetMap data. It worked for 27 minutes and delivered exactly what he asked for: an embedded visualization, a downloadable GPX file, and GeoJSON. Impressive. But when he asked how it did the work, the model summarized its approach—Nominatim for geocoding, Overpass for OSM roads—without showing the actual code it ran. Worse, by the time he asked for a copy of the Python, the thread had been compacted and the code was gone ([Generating running routes with GPT-6 Astra and ChatGPT Work](https://simonwillison.net/2026/Sep/12/astra-running-routes/)).

Willison calls the lack of transparency "an anti-feature," and argues that any LLM system using compaction "needs to both preserve the pre-compacted text and make that text available via agent tool calls." That is a run-bundle requirement stated in plain English. A 27-minute autonomous session that produces artifacts you cannot trace back to the code that generated them is not auditable. The output looks correct—but "looks correct" is not evidence, and correctness you can't reproduce is a liability the moment someone asks *why*.

## Longer leashes, thinner oversight

The same pattern shows up wherever agents are being trusted more. OpenAI reports that Perplexity uses Astra to write communications, change software, and monitor production systems, and "checks in much less frequently than with earlier models" ([Perplexity trusts GPT-6 Astra with end-to-end systems](https://openai.com/index/perplexity-improving-accuracy-with-astra)). Less frequent check-ins are the whole value proposition of a more capable model—and also the precise moment human-in-the-loop gates start to matter more, not less. If a human only inspects one action in fifty, that one inspection needs a complete, replayable record of the other forty-nine.

Cognition's work with Devin points the other direction, and it's instructive. GPT-6 Astra improves Devin's ability to test its own software and "show that it works," with the goal of helping engineers review less code and ship more ([Cognition helps Devin test its own work with GPT-6 Astra](https://openai.com/index/cognition-devin-testing-with-astra)). "Show that it works" is the healthy framing. Reviewing less code is only safe if the evidence that replaces the review is trustworthy—test artifacts, inputs, outputs, and the reasoning trail bundled together. Otherwise you've swapped human review for faith in a summary, which is the running-routes problem all over again.

## What a run bundle would have captured

Contrast the opaque agent session with a piece of tooling built the old-fashioned way. Willison's `commit-rewriter 0.1` exists because the initial commits for the Datasette security releases "were full of coding agent cruft and references to issue IDs from our private repository" and weren't fit for publication. His fix is telling: when you submit edits, the tool "creates a timestamped branch of your current repo state—to allow you to revert if you need to—and then rewrites every commit" ([commit-rewriter 0.1](https://simonwillison.net/2026/Sep/14/commit-rewriter/)). That timestamped branch is a run bundle in miniature: a preserved before-state you can return to, so a destructive rewrite is reversible and inspectable.

Even the humble `shot-scraper 1.12` release—adding WebP screenshot support so files are smaller than JPEG or PNG equivalents—was shipped specifically to generate the screenshot for the commit-rewriter tool ([shot-scraper 1.12](https://simonwillison.net/2026/Sep/13/shot-scraper/)). Small, composable, observable tools with clear inputs and outputs. The lesson for agent builders isn't to stop using agents; it's that the same discipline—preserve the prior state, capture the artifacts, make the trail retrievable—has to survive the jump from hand-written CLIs to 27-minute autonomous runs.

## Model-agnostic tracing is not optional

The visualize skill Astra used renders maps with D3 loaded from an allow-listed CDN, under a content security policy that permits only a handful of origins—`cdnjs.cloudflare.com`, `esm.sh`, `cdn.jsdelivr.net`, `unpkg.com`, and a few font hosts—while "other origins are blocked and fail silently" ([running routes post](https://simonwillison.net/2026/Sep/12/astra-running-routes/)). That CSP is good governance at the output layer. But governance at the *execution* layer—the code the agent actually ran—was missing. A run bundle should capture both, regardless of which model produced the work.

Model-agnostic tracing matters because this week's releases span vendors and workloads. Google is folding agentic help into Search for race training ([3 ways to prep for your next big race with Search](https://blog.google/products-and-platforms/products/search/running-race-training-tips/)) and football features ([Get ready for the game with new football features in Search](https://blog.google/products-and-platforms/products/search/football-features-google-search/)). Hugging Face published async GRPO with LoRA across HF Jobs, coordinated through "a bucket, a proxy, and no NCCL" ([Async GRPO with LoRA across HF Jobs](https://huggingface.co/blog/asyncgrpo-lora-hfjobs)), and a Gradio rebuild of AUTOMATIC1111 ([Rebuilding AUTOMATIC1111 with Gradio Workflow](https://huggingface.co/blog/gradio-workflow-1111)). IBM shipped a commercially licensed time-series foundation model ([Granite Time Series PatchTST-FM-r2](https://huggingface.co/blog/ibm-research/ibm-releases-sota-granite-time-series)). If your evidence layer is bolted to one provider's UI, none of this is uniformly auditable.

## The infrastructure and stakes keep rising

The scale numbers underline why cost telemetry belongs in the same bundle. OpenAI describes evolving Habitat from a Python library into a globally distributed storage platform serving 1 billion ChatGPT users at 22 million requests per second ([Rapidly scaling online storage](https://openai.com/index/scaling-storage-one-billion-users-part-one)). At that scale, a 27-minute run multiplied across a fleet of agents is a real line item—and if you can't attribute the work, you can't attribute the cost.

The stakes climb further in high-consequence domains. Google DeepMind's AlphaGenome Atlas maps the molecular effects of 9 billion single-letter DNA variants ([AlphaGenome Atlas](https://deepmind.google/blog/alphagenome-atlas-a-predictive-map-of-every-possible-dna-letter-change-in-the-human-genome/)), WeatherNext 3 advances global forecasting ([Introducing WeatherNext 3](https://deepmind.google/blog/introducing-weathernext-3-our-most-advanced-and-accurate-global-weather-ai-model/)), and DeepMind is pitching proactive cyber defense for governments and enterprises ([Proactive cyber defense](https://deepmind.google/blog/proactive-cyber-defense-for-governments-and-enterprises/)). Even creative work like the DeepMind-assisted film *Love, Rendered* ([Recreating a 70-year love story](https://blog.google/innovation-and-ai/technology/ai/love-rendered-film/)) raises provenance questions. In every one of these, the difference between an impressive demo and a defensible system is whether you can replay the decision.

## The takeaway

This week's news is a coherent argument, even if no vendor framed it that way: models are being trusted to run longer with less supervision, and the tooling to reconstruct their work is not keeping pace. The fixes are known and unglamorous—preserve pre-compaction context, expose executed code via tool calls, keep a timestamped revert point, trace across models, and attach cost telemetry to every run. Willison called opacity an anti-feature. The remedy is a run bundle: the boring, complete record that turns "it worked for 27 minutes" into something a human can actually stand behind.
## Sources

- [commit-rewriter 0.1](https://simonwillison.net/2026/Sep/14/commit-rewriter/) — Simon Willison
- [Perplexity trusts GPT-6 Astra with end-to-end systems](https://openai.com/index/perplexity-improving-accuracy-with-astra) — OpenAI
- [shot-scraper 1.12](https://simonwillison.net/2026/Sep/13/shot-scraper/) — Simon Willison
- [Generating running routes with GPT-6 Astra and ChatGPT Work](https://simonwillison.net/2026/Sep/12/astra-running-routes/) — Simon Willison
- [Cognition helps Devin test its own work with GPT‑6 Astra](https://openai.com/index/cognition-devin-testing-with-astra) — OpenAI
- [Rapidly scaling online storage to serve over 1 billion ChatGPT users](https://openai.com/index/scaling-storage-one-billion-users-part-one) — OpenAI
- [3 ways to prep for your next big race with Search](https://blog.google/products-and-platforms/products/search/running-race-training-tips/) — Google AI
- [Async GRPO with LoRA across HF Jobs: a bucket, a proxy, and no NCCL](https://huggingface.co/blog/asyncgrpo-lora-hfjobs) — Hugging Face
- [Rebuilding AUTOMATIC1111 with Gradio Workflow](https://huggingface.co/blog/gradio-workflow-1111) — Hugging Face
- [Get ready for the game with new football features in Search](https://blog.google/products-and-platforms/products/search/football-features-google-search/) — Google AI
- [Recreating a 70-year love story frame by frame](https://blog.google/innovation-and-ai/technology/ai/love-rendered-film/) — Google AI
- [IBM releases SOTA Granite Time Series PatchTST-FM-r2 model with commercial-friendly license](https://huggingface.co/blog/ibm-research/ibm-releases-sota-granite-time-series) — Hugging Face
- [AlphaGenome Atlas: A predictive map of every possible DNA letter change in the human genome](https://deepmind.google/blog/alphagenome-atlas-a-predictive-map-of-every-possible-dna-letter-change-in-the-human-genome/) — Google DeepMind
- [Introducing WeatherNext 3, our most advanced and accurate global weather AI model](https://deepmind.google/blog/introducing-weathernext-3-our-most-advanced-and-accurate-global-weather-ai-model/) — Google DeepMind
- [Proactive cyber defense for governments and enterprises](https://deepmind.google/blog/proactive-cyber-defense-for-governments-and-enterprises/) — Google DeepMind
