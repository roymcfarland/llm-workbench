---
title: >-
  PR descriptions that read like slop: the editorial gate for agent-written
  evidence
description: >-
  When coding agents write accurate-but-overwhelming PR descriptions, human
  editorial judgement becomes the governance gate. Here's how that connects to
  run bundles, HITL, and model-agnostic traces.
date: '2026-11-09T14:09:26.202Z'
tags:
  - human-in-the-loop
  - run-bundles
  - agent-observability
  - ai-governance
  - coding-agents
author: LLM Workbench
---
Simon Willison opened a small window into how professional work is changing this week, and it says more about AI governance than its modest framing suggests. His post ["Hide your slop PR descriptions behind `<details><summary>`"](https://simonwillison.net/2026/Nov/9/details-summary/) describes a workflow where "most of the changes I make to my projects these days come in the form of PRs opened for me by Claude Code or Codex." The agent is the author; the human is the reviewer, curator, and the person ultimately accountable for the merge. That is the human-in-the-loop gate, hiding in plain sight inside a GitHub UI trick.

## The accountability signal buried in a formatting trick

Willison's observation is sharp: coding agents are "too good" at describing their work. The descriptions are "accurate and comprehensive" but read like slop, triggering an instant "I'm not reading all of that" reaction. His fix is to put a short, human-written opener at the top and tuck the full agent-written essay inside a collapsible `<details><summary>`, labelling the summary with the model and effort level — "Claude Opus 5.5 Medium," for example.

Look past the ergonomics and you see three governance primitives at once. First, **provenance**: the model name and effort level are recorded directly in the artifact. Second, **human editorial judgement**: "My promise to the reader is that the short opener will represent my human judgement as to what is definitely worth their time." Third, **retention of the full record**: "The information is all still there," just collapsed, not deleted.

That is almost exactly the shape of an audit-ready run bundle. A run bundle keeps the complete, immutable record of what an agent did — the prompts, the reasoning, the outputs — while surfacing a human-approved summary for the people who need to act on it. Willison is manually reconstructing this pattern inside a PR because the underlying tooling doesn't hand it to him. The lesson for anyone building agent infrastructure: the collapsed-details pattern is a demand signal for structured provenance and a first-class human sign-off step.

## Model-agnostic tracing means the label matters

Why does Willison bother stamping the model name into every summary? Because he is not running a single-vendor pipeline. His other posts this week make that obvious. In ["parse_number() as a SQLite extension: C vs Rust"](https://simonwillison.net/2026/Nov/8/sqlite-parse-number-c-vs-rust/) he drives Claude Opus 5.5 through an entire C-versus-Rust benchmarking investigation, iterating from a 67ns-per-row first C implementation down to a 19ns version using "Clinger's fast path," then has the agent package the whole thing into a research report. In ["The Web Is More Than Enough"](https://simonwillison.net/2026/Nov/9/hn-50421091/) he ports a Three.js scene to vanilla WebGL in the same Claude thread, noting the outputs "aren't identical" and that he doesn't fully understand why they differed.

That last admission is the governance crux. When a human can't fully explain why two agent outputs diverged, the trace *is* the explanation. A model-agnostic tracing layer that captures which model, which effort level, which prompt, and which thread produced an artifact is the only way to answer "why is this different?" after the fact. Willison's manual model labels are a lightweight substitute for that layer — and they only work because he remembers to add them. Observability you have to remember is observability you will eventually forget.

The variety of models in play reinforces the point. This same week brought [Gemini Omni 1.2 Flash](https://blog.google/innovation-and-ai/technology/developers-tools/introducing-gemini-omni-1-2-flash/) with native 15-second video generation and "30% lower pricing" ([DeepMind's announcement here](https://deepmind.google/blog/gemini-omni-12-flash-fast-and-cost-effective-with-longer-clips/)), while Hugging Face published [Higher-Order Pruning of Experts (HOPE)](https://huggingface.co/blog/amazon/higher-order-pruning-experts) for keeping mixture-of-experts partners together, and [a controlled robot-learning world called ToyBlocks](https://huggingface.co/blog/allenai/toyblocks). The model landscape is heterogeneous and getting cheaper per unit of work. A trace that is tied to one vendor's console cannot survive in that world; the evidence layer has to be model-agnostic by construction.

## Cost telemetry when tokens get cheaper

Cheaper models change behavior, and behavior change is a governance event. The parse_number benchmark ran over "2 million rows" to establish per-row costs — Willison is already measuring work in units that matter. The industry is pushing the same direction: Gemini Omni's "30% lower pricing" and the efficiency framing of HOPE's expert pruning both lower the marginal cost of invoking an agent. [Cult.fit building operational muscle with Codex](https://openai.com/index/cultfit-builds-with-codex) shows the organizational version — teams across functions building tools and "changing how work gets done."

When tokens get cheap, agents get invoked more often, and the total bill shifts from per-call sticker shock to a long tail of invisible spend. Cost telemetry attached to each run bundle — this PR cost X, this benchmark run cost Y — is what keeps that tail visible. The `<details><summary>` effort-level label is, again, a crude proxy: "Medium" versus "xhigh" is a cost signal written into the artifact by hand.

## The security case for immutable records

None of this is academic. [OpenAI's partnership with Hacktron](https://openai.com/index/partnering-with-hacktron) to find vulnerabilities and "strengthen defenses with frontier AI" is a reminder that agent-driven systems are attack surfaces. When an agent opens a PR, modifies a build, or loads a SQLite extension, you want an immutable record of exactly what it proposed and who approved it. The collapsed-details pattern preserves the full agent output; a proper run bundle makes that record tamper-evident and queryable alongside the human approval.

And evaluation discipline is spreading into high-stakes domains: OpenAI's [BioBasicsBench](https://openai.com/index/measuring-how-ai-agents-handle-wet-lab-science) measures how agents interpret raw experimental data, Google DeepMind applied agents to [UK planning decisions](https://deepmind.google/blog/speeding-up-planning-decisions-with-ai/) and [agentic cheminformatics](https://deepmind.google/blog/agentic-cheminformatics-with-google-antigravity/), Hugging Face expanded the [Open ASR Leaderboard](https://huggingface.co/blog/open-asr-leaderboard-liva), Google's [October AI roundup](https://blog.google/innovation-and-ai/technology/ai/google-ai-updates-october-2026/) cataloged the breadth, and even [AI literacy quests](https://blog.google/products-and-platforms/products/education/ai-quests-polar-peaks/) are teaching the next cohort. In each case the question is the same: can you prove what the agent did and that a human judged it fit to ship?

## The takeaway

Willison's `<details><summary>` trick is a brilliant, low-effort hack precisely because the ecosystem hasn't built the real thing yet. The real thing is a run bundle: immutable agent output, model-and-effort provenance, cost telemetry, and a mandatory human editorial gate, all captured automatically so you never have to remember to add a label. When your coding agent writes the PR, your job becomes the sign-off — and the sign-off is only auditable if the evidence underneath it is structured, complete, and model-agnostic. Hide the slop if you must. But don't lose it.
## Sources

- [Your Experts Have Partners. There's HOPE for Keeping Them Together](https://huggingface.co/blog/amazon/higher-order-pruning-experts) — Hugging Face
- [The Web Is More Than Enough, by Paul Ford](https://simonwillison.net/2026/Nov/9/hn-50421091/) — Simon Willison
- [Hide your slop PR descriptions behind <details><summary>](https://simonwillison.net/2026/Nov/9/details-summary/) — Simon Willison
- [parse_number() as a SQLite extension: C vs Rust](https://simonwillison.net/2026/Nov/8/sqlite-parse-number-c-vs-rust/) — Simon Willison
- [ToyBlocks: A controlled world for robot learning and evaluation](https://huggingface.co/blog/allenai/toyblocks) — Hugging Face
- [Partnering with Hacktron to find vulnerabilities in OpenAI’s systems](https://openai.com/index/partnering-with-hacktron) — OpenAI
- [Egyptian and Nigerian English join the Open ASR Leaderboard](https://huggingface.co/blog/open-asr-leaderboard-liva) — Hugging Face
- [Measuring how AI agents handle everyday wet-lab science](https://openai.com/index/measuring-how-ai-agents-handle-wet-lab-science) — OpenAI
- [Cult.fit builds operational muscle with Codex](https://openai.com/index/cultfit-builds-with-codex) — OpenAI
- [Gemini Omni 1.2 Flash: Fast and cost-effective with longer clips](https://deepmind.google/blog/gemini-omni-12-flash-fast-and-cost-effective-with-longer-clips/) — Google DeepMind
- [Gemini Omni 1.2 Flash: Fast and cost-effective with longer clips](https://blog.google/innovation-and-ai/technology/developers-tools/introducing-gemini-omni-1-2-flash/) — Google AI
- [Agentic cheminformatics with Google Antigravity](https://deepmind.google/blog/agentic-cheminformatics-with-google-antigravity/) — Google DeepMind
- [The latest AI news we announced in October 2026](https://blog.google/innovation-and-ai/technology/ai/google-ai-updates-october-2026/) — Google AI
- [Speeding up planning decisions with AI](https://deepmind.google/blog/speeding-up-planning-decisions-with-ai/) — Google DeepMind
- [Our newest AI Quest: Mapping the human brain](https://blog.google/products-and-platforms/products/education/ai-quests-polar-peaks/) — Google AI
