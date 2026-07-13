---
title: >-
  Accountability doesn't scale like tokens: DRIs, managed agents, and the
  evidence gap
description: >-
  This week's AI news—DRI accountability, managed agents in Gemini, GPT-5.6 in
  Copilot, and shifting model pricing—maps directly onto run bundles, human
  gates, and governance.
date: '2026-07-13T15:03:17.226Z'
tags:
  - ai-governance
  - agent-observability
  - run-bundles
  - human-in-the-loop
  - cost-telemetry
author: LLM Workbench
---
This week gave us a rare gift: a single vocabulary word that clarifies most of what we build at LLM Workbench. Simon Willison went looking for a definition of the [Directly Responsible Individual (DRI)](https://simonwillison.net/2026/Jul/12/directly-responsible-individuals/#atom-everything) and landed on the idea, originated at Apple and documented in GitLab's handbook, that the DRI is the person "ultimately accountable for the success or failure of a specific project." His conclusion is blunt and correct: an agent should *never* be a DRI, because "humans can take accountability for their actions where machines cannot." It echoes IBM's legendary 1979 slide that "a computer can never be held accountable, therefore a computer must never make a management decision."

That principle is easy to nod along to and surprisingly hard to operationalize. If a human is accountable for what an agent did, that human needs to be able to see, reconstruct, and defend what happened. Accountability without evidence is just blame. And the rest of this week's news shows exactly how fast the surface area of "what happened" is expanding.

## Managed agents raise the observability bar

Google's announcement of [expanding Managed Agents in the Gemini API](https://blog.google/innovation-and-ai/technology/developers-tools/expanding-managed-agents-gemini-api/) is a good example. The pitch is background tasks, remote MCP, and other capabilities so developers can build "reliable, production-ready agents." Background execution is genuinely useful, but it moves work out of the interactive path where a human is watching. A background task that calls remote MCP tools is a chain of decisions happening without anyone in the loop in real time.

That is precisely where a run bundle earns its keep. If a DRI is accountable for an agent's output, the run bundle is how they discharge that accountability after the fact: the prompts, the tool calls, the MCP endpoints touched, the intermediate outputs, and the final result, captured in one reconstructable artifact. Managed infrastructure handles the *execution*; it does not, by itself, hand the accountable human a defensible record. The more work moves to background and remote tools, the more the evidence layer has to be model-agnostic and complete rather than tied to whatever tracing a single vendor exposes.

## When the model under you keeps moving

Two more items this week underline why tracing has to be model-agnostic. GPT-5.6 [is now the preferred model in Microsoft 365 Copilot](https://openai.com/index/gpt-5-6-preferred-model-microsoft-365-copilot), powering Word, Excel, PowerPoint, Chat, and Cowork. Meanwhile Simon Willison covered how [Anthropic bumped the date](https://simonwillison.net/2026/Jul/12/bump/#atom-everything) that Claude Fable 5 stops being available on paid plans, extending access through July 19 while OpenAI temporarily lifted usage limits and announced efficiency changes to GPT-5.6 Sol that will "reflect in less usage being used."

The takeaway for anyone maintaining an audit trail: the model backing your workflow can change out from under you—preferred models shift, access windows move, and per-request efficiency changes. If your evidence is entangled with one provider's console, a model swap can quietly break the continuity of your records. A run bundle that captures which model, which version, and which prompt produced a given output—regardless of provider—is what lets a DRI answer "why did the system do this in March versus July?" after the models have been reshuffled twice.

## Cost telemetry is now a moving target too

The Fable/GPT-5.6 news is also a cost-telemetry story. Anthropic's original rationale for restricting Fable was compute constraints—wanting a clearer picture of demand before "committing to keeping the new model cheap for subscribers." OpenAI, meanwhile, is publicly promising GPT-5.6 Sol will consume "less usage" per task, with "exact impact to be quantified and shared." When per-task cost is explicitly in flux and vendors are removing and reinstating usage limits, a static cost estimate is worthless.

Cost telemetry inside the run bundle solves this by recording actual consumption per run rather than trusting a headline price. When a provider changes efficiency mid-quarter, your telemetry shows the real before-and-after. When a background managed agent fans out into a dozen tool calls, your telemetry attributes the spend to the run that caused it. The accountable human can then answer the finance-team question—"why did this cost what it cost?"—with evidence rather than a shrug.

## Where the human gate goes

Put the pieces together and a pattern emerges. Deutsche Telekom's work [rewiring telecommunications with AI](https://openai.com/index/deutsche-telekom) touches customer service, employee workflows, and network operations—high-stakes surfaces where a wrong automated action has real customer and regulatory consequences. This is the enterprise reality that the DRI framing is built for. Someone signs off. Someone is accountable. The design question is *where* the human gate sits and *what evidence* they see when they approve or reject.

A human-in-the-loop gate is only as good as the context presented at the moment of decision. If the gate shows a bare output with no trace of the tool calls, the model version, or the cost incurred, the human is rubber-stamping, not deciding—and the DRI's accountability is fictional. If the gate surfaces the run bundle inline—inputs, reasoning steps, tools invoked, cost telemetry, and a diff against prior runs—the human can exercise real judgment. That is the difference between governance theater and governance that survives an audit.

None of this requires exotic tooling. Even Simon Willison's mundane [shot-scraper 1.11 release](https://simonwillison.net/2026/Jul/12/shot-scraper/#atom-everything)—adding `--js-file` support and replacing a fixed one-second delay with a 30-second connection poll—is a reminder that reliability is mostly boring plumbing: waiting for the right signal instead of guessing, loading behavior from a reproducible file instead of an ad-hoc string. Run bundles are the same idea applied to agent decisions: capture the real signal, make it reproducible, and hand it to the person whose name is on the outcome.

## The through-line

The industry is racing to make agents more autonomous, cheaper, and better integrated into daily work. Managed background agents, a preferred model across an entire Office suite, shifting price and access—all of it pushes decisions further from human sight. The DRI principle pulls in the opposite direction: a named human remains accountable. The only way to hold both truths at once is an evidence layer. Model-agnostic tracing, cost telemetry, and audit-ready run bundles are what let a human be genuinely responsible for work a machine performed. The agent does the work; the bundle proves what it did; the DRI answers for it. That order does not change no matter how fast the models do.
## Sources

- [Directly Responsible Individuals (DRI)](https://simonwillison.net/2026/Jul/12/directly-responsible-individuals/#atom-everything) — Simon Willison
- [shot-scraper 1.11](https://simonwillison.net/2026/Jul/12/shot-scraper/#atom-everything) — Simon Willison
- [Fable gets another bump](https://simonwillison.net/2026/Jul/12/bump/#atom-everything) — Simon Willison
- [How Deutsche Telekom is rewiring telecommunications with AI](https://openai.com/index/deutsche-telekom) — OpenAI
- [Getting started with ChatGPT](https://openai.com/academy/getting-started) — OpenAI
- [Profiling in PyTorch (Part 3): Attention is all you profile](https://huggingface.co/blog/torch-attention-profile) — Hugging Face
- [GPT-5.6 is now the preferred model in Microsoft 365 Copilot](https://openai.com/index/gpt-5-6-preferred-model-microsoft-365-copilot) — OpenAI
- [Data for Agents](https://huggingface.co/blog/nvidia/open-data-for-agents) — Hugging Face
- [Native-speed vLLM transformers modeling backend](https://huggingface.co/blog/native-speed-vllm-transformers-backend) — Hugging Face
- [Expanding Managed Agents in Gemini API: background tasks, remote MCP and more](https://blog.google/innovation-and-ai/technology/developers-tools/expanding-managed-agents-gemini-api/) — Google AI
- [Google DeepMind and A24 announce first-of-its-kind research partnership](https://deepmind.google/blog/google-deepmind-and-a24-announce-first-of-its-kind-research-partnership/) — Google DeepMind
- [The latest AI news we announced in June 2026](https://blog.google/innovation-and-ai/technology/ai/google-ai-updates-june-2026/) — Google AI
- [New York City educators and industry leaders gathered at Google’s offices to shape the future of AI in classrooms.](https://blog.google/products-and-platforms/products/education/nyc-ai-summit/) — Google AI
- [Start building with Nano Banana 2 Lite and Gemini Omni Flash](https://deepmind.google/blog/start-building-with-nano-banana-2-lite-and-gemini-omni-flash/) — Google DeepMind
