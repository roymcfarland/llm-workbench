---
title: >-
  Inviting agents into our loop: building the evidence layer for
  self-scaffolding coders
description: >-
  This week's open-weight agentic coder and a sharp critique of unreviewable PRs
  both point to the same need: audit-ready run bundles, human-controlled gates,
  and model-agnostic tracing.
date: '2026-06-29T16:53:43.424Z'
tags:
  - agent-observability
  - run-bundles
  - human-in-the-loop
  - ai-governance
  - model-agnostic-tracing
author: LLM Workbench
---
A pair of stories this week sit unusually close together. On one side, a new open-weights model built explicitly to drive itself through long agentic coding sessions. On the other, a pointed reminder that agents which spray out work humans can't review are a liability, not an asset. Put them together and you get the case for the evidence layer we keep building toward at LLM Workbench: audit-ready run bundles, human-controlled gates, model-agnostic tracing, and cost telemetry that survives a real audit.

## The capability is racing ahead of the accountability

[Ornith-1.0: Self-Scaffolding LLMs for Agentic Coding](https://simonwillison.net/2026/Jun/29/ornith/#atom-everything) is the kind of release that reframes what "an agent run" even means. It ships as open weights under an MIT license, in variants from 9B Dense up to a 397B MoE, built on top of pretrained Gemma 4 and Qwen 3.5 — both Apache 2.0 licensed. Simon Willison reports running the 35B GGUF locally under LM Studio hooked up to a coding harness, and notes it "seems to be able to run the agent harness over many tool calls in a proficient way," even generating his pelican-on-a-bicycle test at 103 tokens/second.

The phrase that matters here is *many tool calls*. A self-scaffolding model that proficiently chains tool invocations is, by design, producing a long trail of intermediate actions that no human watched in real time. That is exactly where observability stops being a nice-to-have. If your trace only captures the prompt in and the diff out, you have no way to reconstruct what the agent actually did across those calls — which file it read, which command it ran, where it changed course.

And the trend is not slowing. OpenAI is [previewing GPT-5.6 Sol](https://openai.com/index/previewing-gpt-5-6-sol), "a next-generation model with stronger capabilities in coding, science, and cybersecurity, paired with its most advanced safety stack." Stronger coding plus stronger autonomy means more agent actions per unit of human attention. The capability curve and the accountability gap are widening together.

## "It's our loop" — the gate is the point

The sharpest framing this week came via [Jon Udell, quoted by Simon Willison](https://simonwillison.net/2026/Jun/28/jon-udell/#atom-everything). Udell pushes back on the passive language we've all adopted:

> I dislike the phrase "human in the loop" because it cedes authority to the machines. Let's flip the narrative. It's our loop, we work the same way we always have, now we recruit agents to join the team. An agent-assisted process need not be a black box that takes in prompts and emits features.

His post title says the rest: "Doctor, it hurts when agents create unreviewable PRs." "Don't do that." That is a design constraint, not a complaint. If a self-scaffolding model like Ornith-1.0 can chew through dozens of tool calls and emit a sprawling change set, the unit of human review has to shrink back down to something a person can actually inspect. The human-in-the-loop gate is not a checkbox at the end; it's the structure that keeps the loop *ours*.

In practice that means run bundles that decompose an agent session into reviewable stages — the reads, the edits, the test runs, the decision points — each one a place where a human can approve, reject, or roll back. An unreviewable PR is a symptom of a missing gate, and a missing gate is a governance failure waiting to be discovered after it ships.

## Model-agnostic tracing is now a hard requirement

Look at the substrate Ornith-1.0 is built on: Gemma 4 and Qwen 3.5 underneath, MIT weights on top, running locally via LM Studio. Compare that to the frontier path of [GPT-5.6 Sol](https://openai.com/index/previewing-gpt-5-6-sol), or the new agentic surface in [computer use in Gemini 3.5 Flash](https://deepmind.google/blog/introducing-computer-use-in-gemini-3-5-flash/), where the model now drives a UI directly. A serious engineering org will run several of these at once — a cheap local model for routine retrieval, a frontier model for the hard reasoning, an open MoE for bulk coding work.

That heterogeneity is precisely why tracing cannot be tied to one vendor's SDK. The whole point of an open-weights, self-hosted model like Ornith is that you can swap it in; the whole point of a Frontier partnership like [HP Inc. scaling its deployment with OpenAI](https://openai.com/index/hp-frontier-partnership) "across customer experiences, software development, and enterprise operations" is breadth across surfaces. If your evidence layer only understands one provider, every model swap blows a hole in your audit trail. Model-agnostic tracing — capturing tool calls, inputs, outputs, and timing in a uniform schema regardless of who produced the tokens — is the only way the run bundle stays coherent as the model roster churns.

This is also the natural reading of Google's [full-stack AI argument](https://blog.google/innovation-and-ai/technology/ai/full-stack-ai-explainer/): if you own and reason about the whole stack, you can instrument the whole stack. For the rest of us, who assemble a stack from open weights, frontier APIs, and local runtimes, instrumentation has to be the thing we own end to end.

## Cost telemetry and governance, where the stakes are highest

Self-scaffolding agents that make many tool calls also spend many tokens. At 103 tokens/second locally that feels free; on metered frontier endpoints, an agent that loops thirty times to land one PR is a line item. Cost telemetry attached to each run bundle turns "the agents got expensive this month" into "this agent, on this class of task, costs this much per merged change" — the granularity you need to route work to the right model rather than reflexively reaching for the most capable one.

Governance is the throughline. Google DeepMind's work on [securing the future of AI agents](https://deepmind.google/blog/securing-the-future-of-ai-agents/) pairs "traditional safeguards and real-time monitoring" under an AI Control Roadmap — and real-time monitoring only means something if it produces durable records. The same logic scales up to where agents touch the public: DeepMind's [AI-accelerated planning prototype for UK house-building](https://deepmind.google/blog/unlocking-uk-house-building-with-ai-accelerated-planning/) and Google's [AMIE medical AI matching primary care physicians](https://blog.google/innovation-and-ai/models-and-research/google-research/amie-for-disease-management-in-nature/) are decisions someone will eventually need to contest and replay.

The people learning to build with agents now will inherit this. OpenAI's [map of Europe's AI workforce transition](https://openai.com/index/mapping-ai-jobs-transition-eu) describes occupations facing automation, growth, and workflow changes, and initiatives like [Hack Your Summer](https://simonwillison.net/2026/Jun/28/hack-your-summer/#atom-everything) are training the next cohort to ship real, public-facing work. Whether they reach for a local model fine-tuned with tools like [NVIDIA NeMo AutoModel](https://huggingface.co/blog/nvidia/accelerating-fine-tuning-nvidia-nemo-automodel), a [one-command vLLM server on HF Jobs](https://huggingface.co/blog/vllm-jobs), or a [hybrid model tuned per-token](https://huggingface.co/blog/allenai/hybrid-token-prediction), and whatever they're tracking in the [new Google Finance app](https://blog.google/products-and-platforms/products/search/google-finance-updates-june-2026/) on the side — the discipline is the same. Invite the agents into your loop. Keep the gates. Keep the receipts.
## Sources

- [Ornith-1.0: Self-Scaffolding LLMs for Agentic Coding](https://simonwillison.net/2026/Jun/29/ornith/#atom-everything) — Simon Willison
- [Ask an AI expert: What exactly is the full stack?](https://blog.google/innovation-and-ai/technology/ai/full-stack-ai-explainer/) — Google AI
- [Mapping Europe’s AI Workforce Opportunity](https://openai.com/index/mapping-ai-jobs-transition-eu) — OpenAI
- [Quoting Jon Udell](https://simonwillison.net/2026/Jun/28/jon-udell/#atom-everything) — Simon Willison
- [Hack Your Summer](https://simonwillison.net/2026/Jun/28/hack-your-summer/#atom-everything) — Simon Willison
- [HP Inc. launches Frontier strategic partnership with OpenAI](https://openai.com/index/hp-frontier-partnership) — OpenAI
- [Previewing GPT-5.6 Sol: a next-generation model](https://openai.com/index/previewing-gpt-5-6-sol) — OpenAI
- [Run a vLLM Server on HF Jobs in One Command](https://huggingface.co/blog/vllm-jobs) — Hugging Face
- [Which tokens does a hybrid model predict better?](https://huggingface.co/blog/allenai/hybrid-token-prediction) — Hugging Face
- [Our latest Google Finance upgrades, including a new app](https://blog.google/products-and-platforms/products/search/google-finance-updates-june-2026/) — Google AI
- [Introducing computer use in Gemini 3.5 Flash](https://deepmind.google/blog/introducing-computer-use-in-gemini-3-5-flash/) — Google DeepMind
- [Accelerating Transformers Fine-Tuning with NVIDIA NeMo AutoModel](https://huggingface.co/blog/nvidia/accelerating-fine-tuning-nvidia-nemo-automodel) — Hugging Face
- [New research shows how AMIE, our medical AI, could help manage health conditions.](https://blog.google/innovation-and-ai/models-and-research/google-research/amie-for-disease-management-in-nature/) — Google AI
- [Unlocking UK house-building with AI-accelerated planning](https://deepmind.google/blog/unlocking-uk-house-building-with-ai-accelerated-planning/) — Google DeepMind
- [Securing the future of AI agents](https://deepmind.google/blog/securing-the-future-of-ai-agents/) — Google DeepMind
