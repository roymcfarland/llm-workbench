---
title: >-
  Cheap tokens, stolen keys, and hardened models: the governance case for run
  bundles
description: >-
  This week's news on token relay markets, prompt-injection-resistant models,
  and coding agents shows why audit-ready run bundles, cost telemetry, and
  human-in-the-loop gates matter more than ever.
date: '2026-07-27T15:03:35.765Z'
tags:
  - ai-governance
  - cost-telemetry
  - run-bundles
  - prompt-injection
  - agent-observability
author: LLM Workbench
---
A few stories from this week look unrelated on the surface: a shadow marketplace reselling LLM tokens, a model vendor bragging about prompt-injection resistance, and a linter upgrade that coding agents cleaned up automatically. Read them together and they trace the exact perimeter that audit-ready run bundles, cost telemetry, and human-in-the-loop gates are built to defend.

## When your token spend becomes someone else's business model

Simon Willison's write-up of an investigation into the [relay market powering token resellers and fraud](https://simonwillison.net/2026/Jul/26/relay-market/#atom-everything) is the most operationally important read of the week. The reporting describes an ecosystem—largely centered in China—where resellers pool API keys and sell discounted access through open-source proxies like `one-api` and its fork `new-api`. Those discounts come from abusing free trials, proxying through unprotected support bots, and in some cases stolen credit cards or chargeback attacks. Buyers want cheap tokens, geo-restriction bypass, and data for model distillation.

Willison draws the conclusion every operator should internalize: he's now even more cautious about exposing LLM-driven applications publicly, because "there's now an entire ecosystem that can profit from finding a new unprotected endpoint to exploit." His ask to vendors is blunt—strict per-key caps, so an app stops working the moment it crosses a dollar threshold.

That is a cost-telemetry problem before it is a security problem. If you cannot see spend accumulating in near real time, per key and per workload, you cannot cap it. A run bundle that records which model was called, how many tokens moved, and what it cost turns "we got a surprise bill" into "we have a timestamped ledger showing exactly where the anomaly started." The relay market exists because unprotected endpoints leak value silently. Cost telemetry is how you make the leak loud.

## Hardened models raise the floor, not the ceiling

The other half of the exposure story is prompt injection. Boris Cherny, [quoted by Willison](https://simonwillison.net/2026/Jul/25/boris-cherny/#atom-everything), highlighted that Anthropic's Opus 5 is "our least prompt injectable model yet," hard to inject across PI evals and red teaming per the system card. That is genuinely good news—model-level resistance raises the floor for everyone building on top.

But a more injection-resistant base model does not eliminate the need for governance; it changes where you spend your attention. "Very hard to prompt inject" is not "impossible," and your application still stitches together retrieval, tools, and untrusted inputs the model never saw in testing. Model-agnostic tracing matters precisely because your defenses cannot assume a single vendor's guarantees. When you can swap Opus 5 for Gemini or a local model and keep the same trace schema, you can compare injection-resistance in your own environment instead of trusting a marketing line. The run bundle is where a red-team finding becomes reproducible evidence rather than a screenshot in a Slack thread.

## Coding agents that need a paper trail

Willison's [Ruff v0.16.0 post](https://simonwillison.net/2026/Jul/25/ruff/#atom-everything) is a small, concrete window into agent-driven work. Astral's linter now enables 413 rules by default, up from 59, and Willison's CI started failing on an unpinned dependency. He ran `uvx ruff@latest check . --fix --unsafe-fixes` across his largest projects—sqlite-utils alone reported 1618 errors, 1538 fixed—and then handed the remaining fixes to coding agents: Codex (GPT-5.6) upgraded LLM and sqlite-utils, and Claude Code with Opus 5 upgraded Datasette.

He notes that Ruff's clear, structured output "provides everything a coding agent would need to fix the problems." That is the agent-observability lesson in miniature. The workflow worked because two things were true: comprehensive test suites gave a verifiable gate, and every change flowed through a pull request that a human could review and merge. Multiply that across an enterprise and the informal PR-plus-tests loop needs to become a durable run bundle—prompt, tool calls, diffs, test results, cost, and the human approval that gated the merge. When an agent fixes 1500 lint violations, "trust me, the tests passed" does not survive an audit; a bundle linking the run to its green CI and its reviewer does.

Human-in-the-loop gates are what kept this safe even with `--unsafe-fixes`. The agent proposed; the tests and the maintainer disposed. Governance is just making that gate mandatory, observable, and replayable instead of dependent on one careful engineer's habits.

## The expanding surface of what agents touch

The rest of the week widens the surface these controls have to cover. OpenAI's research on [how AI is expanding what people do at work](https://openai.com/index/how-ai-is-expanding-what-people-do-at-work) describes ChatGPT users taking on tasks across roles and reshaping job boundaries—more people invoking models against more kinds of data. OpenAI's [Health in ChatGPT](https://openai.com/index/health-in-chatgpt) launch, letting eligible U.S. users connect medical records and Apple Health, and Google's move to [connect more apps to Search](https://blog.google/products-and-platforms/products/search/connected-apps/) both push models toward increasingly sensitive, connected data. Every new connection is another endpoint to cap, another data flow to trace, another decision that may need to be contestable later.

The cadence of new models compounds this. Google DeepMind shipped [Gemini 3.6 Flash, 3.5 Flash-Lite, and 3.5 Flash Cyber](https://deepmind.google/blog/introducing-gemini-3-6-flash-3-5-flash-lite-and-3-5-flash-cyber/), with the dedicated [Gemini 3.5 Flash Cyber](https://deepmind.google/blog/introducing-gemini-3-5-flash-cyber/) model aimed at finding and patching vulnerabilities. Meanwhile Google committed [$40M in tokens and credits to the Genesis Mission](https://deepmind.google/blog/accelerating-the-frontiers-of-scientific-discovery-googles-40m-commitment-to-the-genesis-mission/), OpenAI announced [Project Camellia infrastructure in Effingham County](https://openai.com/index/building-ai-infrastructure-with-the-effingham-county-community), and Galaxy Unpacked brought [new Google device integrations](https://blog.google/products-and-platforms/platforms/android/galaxy-unpacked-2026/) plus [avatar generation in Google Vids](https://blog.google/products-and-platforms/products/workspace/gemini-omni-personal-avatars/). On the research edge, Hugging Face's [Nunchaku 4-bit diffusion](https://huggingface.co/blog/nunchaku-diffusers), [Grabette robot-manipulation recording](https://huggingface.co/blog/grabette), and NVIDIA's [Cosmos-H-Dreams surgical simulation](https://huggingface.co/blog/nvidia/cosmos-h-dreams) push models into robotics and clinical settings where a replayable decision record is not optional.

## The through-line

More models, cheaper tokens, more connected data, and more capable coding agents all point the same direction: the number of places an LLM makes a consequential decision is growing faster than most teams' ability to see those decisions. Model-agnostic tracing lets you compare vendors on your own turf. Cost telemetry turns the relay-market threat into an alarm you can act on. Human-in-the-loop gates keep `--unsafe-fixes` safe. And run bundles tie it all into evidence you can hand an auditor. Hardened models are welcome—but they raise the floor. Governance is still what builds the walls.
## Sources

- [NVIDIA Cosmos-H-Dreams: Bringing Real-Time Generative Simulation to Surgical Robotics](https://huggingface.co/blog/nvidia/cosmos-h-dreams) — Hugging Face
- [How AI is expanding what people do at work](https://openai.com/index/how-ai-is-expanding-what-people-do-at-work) — OpenAI
- [An Inside Look at the Relay Market Powering Token Resellers and Fraud](https://simonwillison.net/2026/Jul/26/relay-market/#atom-everything) — Simon Willison
- [Ruff v0.16.0](https://simonwillison.net/2026/Jul/25/ruff/#atom-everything) — Simon Willison
- [Quoting Boris Cherny](https://simonwillison.net/2026/Jul/25/boris-cherny/#atom-everything) — Simon Willison
- [Bringing Nunchaku 4-bit Diffusion Inference to Diffusers](https://huggingface.co/blog/nunchaku-diffusers) — Hugging Face
- [Launching Health in ChatGPT](https://openai.com/index/health-in-chatgpt) — OpenAI
- [Accelerating the frontiers of scientific discovery: Google’s $40M commitment to the Genesis Mission](https://deepmind.google/blog/accelerating-the-frontiers-of-scientific-discovery-googles-40m-commitment-to-the-genesis-mission/) — Google DeepMind
- [Building AI infrastructure with the Effingham County community](https://openai.com/index/building-ai-infrastructure-with-the-effingham-county-community) — OpenAI
- [3 Google updates from Galaxy Unpacked 2026](https://blog.google/products-and-platforms/platforms/android/galaxy-unpacked-2026/) — Google AI
- [Introducing Gemini 3.6 Flash, 3.5 Flash-Lite, and 3.5 Flash Cyber](https://deepmind.google/blog/introducing-gemini-3-6-flash-3-5-flash-lite-and-3-5-flash-cyber/) — Google DeepMind
- [Grabette: an open system to record robot-manipulation data](https://huggingface.co/blog/grabette) — Hugging Face
- [Introducing Gemini 3.5 Flash Cyber](https://deepmind.google/blog/introducing-gemini-3-5-flash-cyber/) — Google DeepMind
- [Connect more of your apps to Search](https://blog.google/products-and-platforms/products/search/connected-apps/) — Google AI
- [Create, edit and star in videos with two Google Vids updates](https://blog.google/products-and-platforms/products/workspace/gemini-omni-personal-avatars/) — Google AI
