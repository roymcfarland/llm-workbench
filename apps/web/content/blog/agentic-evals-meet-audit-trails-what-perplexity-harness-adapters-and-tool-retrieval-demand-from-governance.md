---
title: >-
  Agentic evals meet audit trails: what perplexity, harness adapters, and tool
  retrieval demand from governance
description: >-
  This week's AI news—from agentic evaluations to tool retrieval and new
  frontier models—shows why every agent run needs an audit-ready bundle, cost
  telemetry, and human gates to stay accountable.
date: '2026-11-23T14:09:35.264Z'
tags:
  - agentic-evals
  - run-bundles
  - observability
  - cost-telemetry
  - ai-governance
  - human-in-the-loop
author: LLM Workbench
---
The news cycle this week was dense with agent-building machinery: new ways to evaluate agents, new ways to feed them tools, and new models to run them on. What ties these threads together, from an LLM Workbench perspective, is a single question: when an agent does work on your behalf, can you prove what happened, why, and what it cost? That is the job of an audit-ready run bundle, and the week's releases make the case louder.

## Evaluation is the new deployment checklist

Hugging Face published a practical guide on [how to build and maintain an agentic evaluation](https://huggingface.co/blog/agentic-evals), reframing evals as something you own and keep running rather than a one-off benchmark. That framing matters. An agentic eval is only trustworthy if the runs behind it are reproducible—same inputs, same tool calls, same model version, same traces. If you cannot reconstruct the run, you cannot defend the score. This is exactly why we treat the run bundle as the atomic unit: inputs, intermediate steps, tool invocations, and outputs captured together so an evaluation result points back to evidence rather than a number in a spreadsheet.

OpenAI's piece on [perplexity and intelligence](https://openai.com/index/perplexity-and-intelligence) reinforces the same instinct from a different angle. Perplexity is offered as a shared, low-level signal for measuring progress and establishing a common approach to evaluating emerging capabilities. Shared metrics are valuable, but they are also abstract—a model-level statistic that says little about whether a specific agent run in your stack behaved acceptably. Governance needs both layers: the model-wide signal and the per-run record. The run bundle is where those two meet, letting you attach a capability claim to the concrete trace that demonstrates it.

## More tools, more surface area to trace

Google's [Tool Retrieval in the Gemini API](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-tool-retrieval/) lets agents reach hundreds of tools while spending fewer tokens by retrieving only the relevant ones per step. This is a genuine efficiency win, and it is also a governance complication. When the set of tools available to an agent is dynamic—selected at runtime from a large catalog—you lose the comforting assumption that an agent's action space is fixed and reviewable in advance. The only way to know which tools an agent actually had access to, and which it chose to call, is to capture that decision in the trace. Model-agnostic tracing that records retrieved-tool sets and invocations turns a dynamic, hard-to-audit system back into something you can replay and reason about.

Hugging Face's [harness adapters](https://huggingface.co/blog/harness-adapters-at-scale) push in the same direction: adapt your favorite model to your harness to improve performance and cost. The promise is that you can swap models underneath a fixed evaluation harness. That portability is powerful precisely because it is dangerous to governance when unobserved—if the model behind an agent can change to chase cost or performance, your evidence layer has to record which model answered each run. Model-agnostic bundles that stamp the exact model, adapter, and harness configuration are what make a swap safe to audit after the fact.

## A flood of frontier models makes provenance non-negotiable

The sheer volume of model launches underscores the point. Google DeepMind shipped [Gemini 4 Neon](https://deepmind.google/blog/introducing-gemini-4-neon/), [Gemini 4 Hydrogen](https://deepmind.google/blog/introducing-gemini-4-hydrogen/), and made [Genie 4 available](https://deepmind.google/blog/genie-4-is-now-available/), while the Gemini app expanded to [lower-memory Android devices](https://blog.google/innovation-and-ai/products/gemini-app/gemini-lower-memory-devices/). Hugging Face introduced [Inkling 2 Mini](https://huggingface.co/blog/inkling2mini) for strong local performance. In a world where the same agentic workflow might run against a frontier cloud model, a local small model, or a device-constrained variant depending on context, "which model produced this output" becomes a first-class audit question. Capturing it per run is the difference between a defensible decision and a guess.

## Human judgment stays in the loop

Two sources this week are quiet reminders that automation does not remove accountability—it relocates it. The customer story on [Hebbia and GPT-6 Astra](https://openai.com/business/customer-stories/hebbia) describes prerelease evaluations that found gains in source coverage, citation relevance, and presentation quality for financial research. Those are human-in-the-loop checks dressed as metrics: someone decided what "relevant citation" means and gated the rollout on it. Capturing those gate decisions in the bundle—who approved, against which eval, on which version—is how a financial-research claim survives a later audit.

Graham Dumpleton's open development log for [Muru](https://simonwillison.net/2026/Nov/21/muru/), an AI-assisted Rust server, makes the human role explicit. In his post on AI as a lifestyle choice he writes that the AI does a lot of the surface work, but "deciding what isn't good enough yet is still down to me." That is the human gate in one sentence. Notably, his Muru series includes entries on [tracing in the toolbar](https://grahamdumpleton.me/posts/2026/11/muru-tracing-in-the-toolbar/) and [scaling from what the workers report](https://grahamdumpleton.me/posts/2026/11/muru-scaling-from-what-the-workers-report/)—observability and telemetry treated as core infrastructure, not an afterthought. The same discipline applies to agents: you scale and release based on what the run actually reported, not on what it claimed to do.

Ravi Vakil's [announcement about a GRH proof](https://simonwillison.net/2026/Nov/20/ravi-vakil/) is the inverse control: a result described as "all human, with no AI," vetted over months of extensive feedback before release. Whether the work is human or machine, the pattern is identical—provenance and review before you publish a claim.

## Cost telemetry closes the loop

Tool retrieval and harness adapters are both justified largely on cost: fewer tokens, better price-performance. But cost savings you cannot measure are just vibes. If an adapter swap or a tool-retrieval change is supposed to cut spend, the run bundle should carry the token and dollar telemetry to prove it, per run and per model. That turns "we optimized cost" into a line item you can defend.

Even Simon Willison's small [select styling specimens](https://simonwillison.net/2026/Nov/22/select-styling/) experiment fits the theme: he had an AI build a comparison page and then exercised judgment to pick the final CSS. The AI generated options; a human made the call and can point to the artifact. Scale that up to enterprise agents and you get the LLM Workbench thesis: cheap, abundant model work only becomes trustworthy when every run leaves behind an immutable, model-agnostic, cost-aware record and a visible human gate. This week's launches made the agents faster and cheaper. The evidence layer is what keeps them accountable.
## Sources

- [How to build and maintain an agentic evaluation](https://huggingface.co/blog/agentic-evals) — Hugging Face
- [Select Styling Specimens](https://simonwillison.net/2026/Nov/22/select-styling/) — Simon Willison
- [Perplexity and Intelligence](https://openai.com/index/perplexity-and-intelligence) — OpenAI
- [Muru](https://simonwillison.net/2026/Nov/21/muru/) — Simon Willison
- [Quoting Ravi Vakil](https://simonwillison.net/2026/Nov/20/ravi-vakil/) — Simon Willison
- [Combatting adversarial distillation](https://openai.com/index/combatting-adversarial-distillation) — OpenAI
- [Welcome Inkling 2 Mini, Cutting-edge Performance for your Local Setup](https://huggingface.co/blog/inkling2mini) — Hugging Face
- [Introducing harness adapters: adapt your favorite model to your harness to improve performance and cost](https://huggingface.co/blog/harness-adapters-at-scale) — Hugging Face
- [Hebbia sees improvements in financial research with GPT-6 Astra](https://openai.com/business/customer-stories/hebbia) — OpenAI
- [Introducing Tool Retrieval in the Gemini API](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-tool-retrieval/) — Google AI
- [Walter Isaacson on curiosity and creativity in the AI age.](https://blog.google/innovation-and-ai/technology/ai/dialogues-walter-isaacson/) — Google AI
- [Introducing Gemini 4 Neon](https://deepmind.google/blog/introducing-gemini-4-neon/) — Google DeepMind
- [Genie 4 is now available](https://deepmind.google/blog/genie-4-is-now-available/) — Google DeepMind
- [The Gemini app is now available on lower-memory Android devices.](https://blog.google/innovation-and-ai/products/gemini-app/gemini-lower-memory-devices/) — Google AI
- [Introducing Gemini 4 Hydrogen](https://deepmind.google/blog/introducing-gemini-4-hydrogen/) — Google DeepMind
