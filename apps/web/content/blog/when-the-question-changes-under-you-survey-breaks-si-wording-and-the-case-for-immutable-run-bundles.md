---
title: >-
  When the question changes under you: survey breaks, SI wording, and the case
  for immutable run bundles
description: >-
  A Census Bureau wording swap - from AI to "Super Intelligence" - breaks a key
  data series. The lesson for AI teams: capture the exact prompt, model, and
  context in audit-ready run bundles before they change.
date: '2026-11-02T14:11:23.828Z'
tags:
  - run-bundles
  - ai-governance
  - model-agnostic-tracing
  - observability
  - human-in-the-loop
author: LLM Workbench
---
## A survey question that stopped meaning the same thing

Simon Willison went back to re-run an analysis he had done a year earlier, charting U.S. corporate AI adoption from the Census Bureau's Business Trends and Outlook Survey. What he found was less a data update than a cautionary tale about provenance. Twice in the span of a year, the Bureau changed the exact wording of the question it asks businesses. First, in November 2025, "did this business use Artificial Intelligence (AI) in **producing goods or services**?" became "in **any of its business functions**" - a broadening that makes the before and after numbers non-comparable. Then, beginning with the October 19, 2026 collection, the question was rewritten again to ask about "**Super Intelligence or SI** (formerly referred to as Artificial Intelligence or AI)" under Executive Order 14434 ([The U.S. Census Bureau and "Super Intelligence"](https://simonwillison.net/2026/Nov/2/census-bureau-super-intelligence/)).

Willison handled this the only way you responsibly can: he refused to bridge the break. His chart shows a shaded gap labeled "Series not comparable," computes trailing averages separately for each question wording, and links to snapshot copies of the exact XLSX and the exact survey PDF he used. In other words, he preserved the artifacts that make his analysis reproducible even after the underlying instrument changed out from under him.

That discipline is exactly what we mean by an audit-ready run bundle. And the Census story is a near-perfect analogy for what goes wrong in production LLM stacks when nobody captures it.

## The question is your prompt; the wording change is a silent drift

Swap "survey question" for "prompt template" and the parallel is uncomfortable. A survey that quietly rewrites its question produces numbers that look continuous but mean something different. An LLM pipeline whose prompt, system message, retrieved context, or model version changes between runs produces outputs that look comparable but are not. If you only store the final answer - the equivalent of the aggregate percentage - you lose the ability to say *what was actually asked*.

An immutable run bundle captures the full question-and-conditions at the moment of execution: the resolved prompt, the model and version, the tool calls, the retrieved documents, the sampling parameters, and the output. When the Census Bureau broadened its wording, the only reason we can reason about the break at all is that the old and new wording were both documented. Your LLM runs deserve the same treatment. When a vendor silently upgrades a model, or someone edits a system prompt, the bundle is the difference between "we changed the question on November 17th" and "the numbers just moved and we don't know why."

This is also why model-agnostic tracing matters. The Census data doesn't care which analyst ran it; it cares that the instrument is recorded. A tracing layer that records runs the same way regardless of whether you're calling a frontier API, an open-weight model you host, or something in between gives you a single audit trail across a heterogeneous stack. That portability is increasingly the norm: IBM is shipping [Granite Switch 4.1.1](https://huggingface.co/blog/ibm-granite/granite-switch-4-1-1) with the explicit pitch that you update models like you update software, and NVIDIA keeps pushing new open variants like [nemotron-halloween](https://huggingface.co/blog/nvidia/nemotron-halloween). Models will churn. Your evidence format shouldn't.

## Trust is getting easier to counterfeit

Kyle Kingsbury, writing up Jepsen's analysis of ParticleDB, put the governance stakes bluntly: "the use of LLMs erodes trust in documentation, in software, and in the organizations which produce them... the signals we used to rely on as markers of a mature system are now easier to counterfeit" ([Quoting Kyle Kingsbury](https://simonwillison.net/2026/Nov/1/kyle-kingsbury/)). He ends with the right question: having done the work to ensure correct software and accurate documentation, how do you *demonstrate* that quality to users?

Run bundles are one concrete answer. If maintainers and operators can hand over a reproducible record of what the system did - the exact inputs, the exact model, the exact outputs, the human approvals along the way - then quality stops being a claim and becomes something you can replay and inspect. In a world where confident-looking output is cheap to generate, the scarce and valuable thing is verifiable provenance.

## Human-in-the-loop gates and the policy that reaches into your pipeline

The Census change didn't come from a data scientist's judgment. It came from an executive order that reached down and rewrote the instrument. That is the shape of AI governance now: external policy and platform decisions mutate your inputs whether or not you asked. OpenAI alone has published a cluster of changes in a single week - honoring a shared [robots.txt training-preference signal](https://openai.com/index/helping-websites-express-ai-training-preferences), rolling out [new teen safety protections and community safety reporting](https://openai.com/index/community-safety-report-and-new-protections-for-teens), and arguing the [fair use case](https://openai.com/index/fair-use-benefits-everyone) that underpins training data. Each of these can alter what data flows in, what a model will or won't say, and what you're permitted to do with outputs.

When policy can rewrite the question, you need two things. First, human-in-the-loop gates so that material changes - a new system prompt, a model swap, a broadened scope - get reviewed and approved rather than slipping in silently the way "producing goods or services" quietly became "any business function." Second, a bundle that records *who* approved *what* and *when*, so the approval is part of the permanent evidence trail, not a Slack message lost to history.

## Cost telemetry belongs in the same record

Adoption is climbing fast - the broadened BTOS wording shows large firms reporting AI use jumping from roughly 30% in February 2026 to around 40% by October 2026, and Google projects AI-driven growth pushing [Southeast Asia's digital economy toward $1 trillion by 2035](https://blog.google/company-news/inside-google/around-the-globe/google-asia/e-conomy-sea-report-2026/). More usage means more spend, and spend is another dimension that drifts silently when models change. The same bundle that records the prompt and the model should record the token counts and cost, so that a routing change or a vendor price shift shows up in your audit trail rather than in a surprise invoice.

## The practical takeaway

Willison's instinct - snapshot the XLSX, snapshot the PDF, refuse to bridge the break - is the instinct every AI team needs. The failure modes are mundane: a lost `uv.lock` pinning the wrong dependency can quietly break a build ([If in doubt, delete the uv.lock file](https://simonwillison.net/2026/Nov/1/delete-uv-lock-first/)), and a lost prompt version can quietly break your ability to explain a result. Even public-science efforts like [Project ProtoStar](https://huggingface.co/blog/announcing-project-protostar) and education pushes like Google's [AI Quests "Polar Peaks"](https://blog.google/products-and-platforms/products/education/ai-quests-polar-peaks/) depend on the same foundation: if you can't reproduce what was asked, you can't trust what was answered. Capture the question, the model, the context, the approvals, and the cost - immutably, per run - and you'll be the one who can point to exactly when, and why, the numbers moved.
## Sources

- [The U.S. Census Bureau and “Super Intelligence”](https://simonwillison.net/2026/Nov/2/census-bureau-super-intelligence/) — Simon Willison
- [If in doubt, delete the uv.lock file](https://simonwillison.net/2026/Nov/1/delete-uv-lock-first/) — Simon Willison
- [Quoting Kyle Kingsbury](https://simonwillison.net/2026/Nov/1/kyle-kingsbury/) — Simon Willison
- [nemotron-halloween](https://huggingface.co/blog/nvidia/nemotron-halloween) — Hugging Face
- [Making it easier for websites to express AI training preferences](https://openai.com/index/helping-websites-express-ai-training-preferences) — OpenAI
- [Community safety report and new protections for teens](https://openai.com/index/community-safety-report-and-new-protections-for-teens) — OpenAI
- [Fair use benefits everyone](https://openai.com/index/fair-use-benefits-everyone) — OpenAI
- [Granite Switch 4.1.1 — Update models like you update software](https://huggingface.co/blog/ibm-granite/granite-switch-4-1-1) — Hugging Face
- [Announcing Project ProtoStar: Making Publicly Funded Science AI-Ready](https://huggingface.co/blog/announcing-project-protostar) — Hugging Face
- [Our newest AI Quest: Mapping the human brain](https://blog.google/products-and-platforms/products/education/ai-quests-polar-peaks/) — Google AI
- [Southeast Asia’s digital economy to hit $368 billion](https://blog.google/company-news/inside-google/around-the-globe/google-asia/e-conomy-sea-report-2026/) — Google AI
