---
title: >-
  Overthinking on the default: what Qwen 3.8's xhigh reasoning teaches us about
  cost telemetry
description: >-
  A local 27B model that burns 22,000 reasoning tokens to draw a circle is a
  governance story. Here's why reasoning-effort defaults, model-agnostic
  tracing, and run bundles matter for auditable AI.
date: '2026-08-17T14:09:43.447Z'
tags:
  - cost-telemetry
  - agent-observability
  - run-bundles
  - model-agnostic-tracing
  - ai-governance
author: LLM Workbench
---
This week's most instructive release for anyone building an auditable LLM stack wasn't a frontier launch — it was a small open-weights model that defaults to spectacular overthinking. Simon Willison's write-up of [Qwen 3.8 27B](https://simonwillison.net/2026/Aug/16/qwen-38-27b/) is a masterclass in why cost telemetry and model-agnostic tracing belong in every serious deployment, not just as nice-to-haves but as the difference between a defensible run and a mystery bill.

## A circle that cost 22,000 reasoning tokens

Qwen 3.8 27B ships with `reasoning_effort` defaulting to `xhigh`, described in the model docs as being "for complex tasks demanding thorough analysis." As [Simon documents](https://simonwillison.net/2026/Aug/16/qwen-38-27b/), this default is a trap. His first pelican-riding-a-bicycle SVG took **21 minutes**, consuming 22,276 reasoning tokens to produce 3,223 tokens of output. Turn reasoning off and the same prompt finished in just over two minutes. Ask it to "draw an svg of a circle" and it spends several minutes musing about Bauhaus palettes and compass studies before producing something you never asked for.

That gap — 21 minutes versus 137 seconds for comparable output — is the entire argument for cost telemetry as a first-class citizen of your run bundle. If your platform only records the final output, you have no way to explain why one invocation cost 100x more than another. The reasoning trace is where the money went, and it needs to be captured, attributed, and replayable.

## Reasoning tokens are a cost telemetry line item

The old mental model of "tokens in, tokens out" is obsolete. Qwen's three-tier `reasoning_effort` control (`xhigh`, `medium`, `low`) means the same prompt against the same model can produce radically different bills depending on a single configuration knob. An audit-ready run bundle has to record which effort level was active, how many reasoning tokens were burned versus output tokens, and wall-clock latency. Without that, a spike in your monthly spend is unattributable.

Simon's numbers make the point concrete: his bounding-box tool worked one-shot with reasoning on but shipped boxes in the wrong place with reasoning off. So the answer isn't "always minimize reasoning" — it's "measure it, attribute it, and make the trade-off visible." That's the job of model-agnostic tracing. Whether you're running Qwen locally in LM Studio, comparing against the [Qwen 3.8 2.4T-A95B](https://simonwillison.net/2026/Aug/16/qwen-38-27b/) via OpenRouter, or hitting a hosted frontier model, the trace schema should look the same so you can compare apples to apples.

## Local models change the governance surface, not the governance need

One of the most striking things in Simon's piece is that a 17GB file can now drive coding agents, annotate images with bounding boxes, and generate working tools offline on a laptop. Hugging Face's [State of Open Models: Summer 2026](https://huggingface.co/blog/state-of-open-models-summer-2026) tracks exactly this trajectory, and their work [reproducing 2,200 ICML papers](https://huggingface.co/blog/icml-2026-open-reproductions) underscores how much of the field now hinges on reproducibility. Meanwhile the ecosystem keeps widening — Amazon's [Strands Agents plus LeRobot and Hugging Face Storage Buckets](https://huggingface.co/blog/amazon/strands-lerobot-streaming-data-loop) promises record-train-deploy from one place, and Google keeps shipping across the stack with [Gemini 3.7 Flash](https://deepmind.google/blog/introducing-gemini-3-7-flash/) and [Sheets canvas](https://blog.google/products-and-platforms/products/workspace/sheets-canvas-for-google-sheets-spreadsheets/).

Running a model on your own hardware removes the per-token API invoice, but it does not remove the cost. It converts dollars into memory bandwidth, GPU-seconds, and — as Qwen's overthinking shows — human wait time. A run bundle for a local model still needs to capture reasoning token counts and latency, because those are your real costs now. The [Multi-Token Prediction optimization](https://simonwillison.net/2026/Aug/16/qwen-38-27b/) Simon tried, which gave a 72% speedup, is only measurable because he benchmarked before and after. Agent observability is the practice of never guessing.

## Human-in-the-loop gates for runaway reasoning

When a model can silently spend 22,000 tokens deliberating over a trivial prompt, you need gates. A human-in-the-loop checkpoint that flags "this invocation exceeded N reasoning tokens" or "this run has been thinking for over M seconds" turns an invisible cost into a decision. Simon hit LM Studio's default 8,192-token context ceiling because Qwen used it all up thinking about mundane problems; the fix was raising the limit, but a governance-minded platform would surface that behavior rather than silently truncate or silently overspend.

The same discipline applies to correctness. The reasoning-on version of the bounding-box tool worked; the reasoning-off version didn't. If you're going to route between effort levels to save money, a human gate on the outputs — or automated evals in the bundle — is what keeps cost optimization from quietly degrading quality.

## Trust is built on evidence, not messaging

The governance framing isn't abstract. [Dario Amodei argued this week](https://simonwillison.net/2026/Aug/16/dario-amodei/) that public distrust of AI is "fundamentally a crisis of trust" that won't be fixed by "a glitzy marketing campaign with a positive spin" — the thing that works is actually delivering. The same logic scales down to a single deployment: you don't earn stakeholder trust by asserting your agents are well-behaved. You earn it by producing a run bundle that shows exactly what the model did, how much it cost, which reasoning effort was active, and where a human signed off.

That evidence layer matters across every use case in this week's news — from OpenAI's defensive posture in [The Defender's Window](https://openai.com/index/the-defenders-window) and its [PORTS-Pike community investment](https://openai.com/index/openai-joins-ports-pike-project) to its [14 funded policy projects for the Intelligence Age](https://openai.com/index/new-policy-ideas-for-the-intelligence-age). It matters for high-stakes domains like Google's [AMIE clinical video consultations](https://blog.google/innovation-and-ai/models-and-research/google-research/amie-video-consultations/), the [WeatherNext cyclone forecasting breakthrough](https://deepmind.google/blog/weathernext-ai-model-achieves-breakthrough-in-forecasting-cyclones/), and DeepMind's [sign-language-to-text model](https://deepmind.google/blog/putting-sign-language-ai-into-users-hands/). Even consumer-facing work like Google's [Gemini and Pixel football partnerships](https://blog.google/products-and-platforms/products/gemini/google-gemini-pixel-football-club-partnerships/) benefits from knowing what the model actually did.

## The takeaway

Simon's tooling underscores the reproducibility angle: his [markdown-svg-renderer](https://simonwillison.net/2026/Aug/16/markdown-svg-upgrades/) now turns animated SVGs into shareable PNGs, JPEGs, and even MP4s in the browser, so a transcript can carry its own rendered evidence. That's the spirit we want in a run bundle — self-contained, replayable, and legible to a reviewer.

A reasoning knob that can 100x your cost with no change to the prompt is exactly the kind of hidden variable that governance exists to expose. Capture the reasoning tokens. Attribute the latency. Gate the runaway runs. Keep the trace model-agnostic so a local Qwen and a hosted frontier model land in the same audit trail. The best pelican SVG Simon ever generated locally wasn't worth 21 minutes — and the only reason we know that is because the numbers were on the table.
## Sources

- [Get closer to the game with Gemini and Pixel](https://blog.google/products-and-platforms/products/gemini/google-gemini-pixel-football-club-partnerships/) — Google AI
- [The Defender’s Window](https://openai.com/index/the-defenders-window) — OpenAI
- [OpenAI joins PORTS-Pike project](https://openai.com/index/openai-joins-ports-pike-project) — OpenAI
- [New policy ideas for the Intelligence Age](https://openai.com/index/new-policy-ideas-for-the-intelligence-age) — OpenAI
- [Markdown SVG upgrades](https://simonwillison.net/2026/Aug/16/markdown-svg-upgrades/) — Simon Willison
- [Qwen 3.8 27B is excellent, but it defaults to wildly overthinking things](https://simonwillison.net/2026/Aug/16/qwen-38-27b/) — Simon Willison
- [Quoting Dario Amodei](https://simonwillison.net/2026/Aug/16/dario-amodei/) — Simon Willison
- [State of Open Models: Summer 2026 Observations](https://huggingface.co/blog/state-of-open-models-summer-2026) — Hugging Face
- [Record, train, and deploy from one place with Strands Agents, LeRobot, and Hugging Face Storage Buckets](https://huggingface.co/blog/amazon/strands-lerobot-streaming-data-loop) — Hugging Face
- [Introducing Gemini 3.7 Flash](https://deepmind.google/blog/introducing-gemini-3-7-flash/) — Google DeepMind
- [Bring your spreadsheet data to life with Sheets canvas](https://blog.google/products-and-platforms/products/workspace/sheets-canvas-for-google-sheets-spreadsheets/) — Google AI
- [What We Learned by Reproducing 2,200 papers from ICML](https://huggingface.co/blog/icml-2026-open-reproductions) — Hugging Face
- [Putting sign language AI into users’ hands](https://deepmind.google/blog/putting-sign-language-ai-into-users-hands/) — Google DeepMind
- [AMIE, our research medical AI system, demonstrates real-time clinical video consultation capabilities in a first-of-its-kind study.](https://blog.google/innovation-and-ai/models-and-research/google-research/amie-video-consultations/) — Google AI
- [WeatherNext: AI model achieves breakthrough in forecasting cyclones](https://deepmind.google/blog/weathernext-ai-model-achieves-breakthrough-in-forecasting-cyclones/) — Google DeepMind
