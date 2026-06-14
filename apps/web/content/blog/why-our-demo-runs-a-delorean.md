---
title: "Why our demo runs the One Ring and a DeLorean"
description: "A demo should show the shape of a real agent run, not a toy. So ours runs beloved-story logistics—Gandalf's routing, a flux-capacitor power calc—on top of the actual engine."
date: "2026-05-21"
tags:
  - demo
  - product
  - run bundles
author: LLM Workbench
---

## The trouble with product demos

Most are either too abstract — a "hello world" that demonstrates nothing — or too real, a domain run you have to understand before it means anything. We wanted ours to show the **shape** of a genuine agent run — steps, a human gate, `model_io` with token and cost, typed artifacts — at a glance, and to be memorable enough that you'd actually look twice.

## Real mechanics, delightful content

So the public demo at `/runs/demo` rotates through five seeded runs, each a recognizable scenario: a Fellowship logistics agent planning the route to Mount Doom (and rejecting the Great Eagles — "not a taxi service"); a DeLorean flight computer working out 1.21 gigawatts; an Owl Post admissions bot sorting a Hogwarts house; Deep Thought returning 42 after a suspiciously long compute; a Golden Ticket auditor.

The **content** is whimsical. The **mechanics** are the real engine — every one is an actual traced run, with a real human-approval gate (with an in-character note), real `model_io` receipts, and real typed artifacts validated against real schemas.

## What you actually learn

In about ten seconds you see a workflow DAG, steps executing, a gate where a human approved, `model_io` with cost, and artifacts written and versioned. That's the entire product surface — just wearing a costume. A curious engineer (or a hiring manager) gets the gestalt without a tutorial.

## Whimsy as a forcing function

Building five different scenarios on one engine was also a quiet test: if the same primitives can render Gandalf's logistics, a time-circuit calc, and a Hogwarts admission, the primitives are general enough. The demo isn't a mock — it's a stress test you can laugh at.

## Try it

Hit **View a demo run** — no sign-up, and refresh for a different story. Then picture your own agent's run wearing the same envelope.
