import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { OG_IMAGE_ALT } from "@/lib/site";

const faqs: { q: string; a: string }[] = [
  {
    q: "What is LLM Workbench?",
    a: "It turns every run of your LLM agent into a tamper-evident, model-agnostic, human-gated bundle: trace events, artifacts, gates, and cost — signed, exportable, and replayable. Instead of opaque API calls scattered across logs, each run becomes a self-contained record you own.",
  },
  {
    q: "How is this different from LangSmith, Langfuse, or Helicone?",
    a: "Those are hosted observability dashboards — your telemetry lives in their database. LLM Workbench is protocol-first: each run is a self-contained, cryptographically signed bundle (with a sha256 integrity hash) you can export, verify, and replay anywhere. Human approval gates and run replay/fork are first-class, not add-ons.",
  },
  {
    q: 'What\'s a "run bundle"?',
    a: "One portable artifact capturing a whole run — the workflow, every trace event (model I/O, tool calls, gate decisions), the artifacts produced, the rule set, token usage and cost — plus an integrity hash so you can prove it wasn't altered.",
  },
  {
    q: "How do I add it to my code?",
    a: "One import. Swap `generateText` for `tracedGenerateText` from `@llm-workbench/ai-sdk`, pass a session handle, and every call emits trace events, spans, artifacts, and cost automatically — your returned result is unchanged.",
  },
  {
    q: "Which models and providers does it support?",
    a: "Model-agnostic — anything you call through the Vercel AI SDK (OpenAI, Anthropic, others). The bundle records provider/model per step, so one run can span multiple models with a single unified trace.",
  },
  {
    q: 'What are "human gates"?',
    a: "Policy-defined pause points (PAUSE_BEFORE, PAUSE_AFTER, CHECKPOINT) where a run halts for a human to approve, reject, or edit before continuing — and the decision is recorded in the bundle.",
  },
  {
    q: "Can I replay or fork a run?",
    a: "Yes — the signed bundle lets you replay a run deterministically, or fork from any step to explore a different path, with full lineage tracked.",
  },
  {
    q: "Where does my data go? Is it private?",
    a: "The public demo runs entirely in your browser — no account, no persistence. Authenticated runs persist to your own database, and because every run is an exportable bundle, you're never locked in.",
  },
  {
    q: "Is it open source? Is it a product?",
    a: "LLM Workbench is a proprietary platform (the source isn't public). You can use the full thing via the live demo and playground; commercial licensing details are in COMMERCIAL.md.",
  },
  {
    q: "How do I try it?",
    a: 'Hit "View a demo run" at /runs/demo — no sign-up, it rotates through seeded agent runs. Sign in to open the playground and build your own.',
  },
];

type Faq = (typeof faqs)[number];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export const metadata: Metadata = {
  title: "FAQ · LLM Workbench",
  description:
    "Answers about LLM Workbench run bundles, human gates, replay, model support, privacy, licensing, and how to try it.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "FAQ · LLM Workbench",
    description:
      "Answers about tamper-evident run bundles, human approval gates, replay, privacy, and trying LLM Workbench.",
    url: "/faq",
    type: "website",
    siteName: "LLM Workbench",
    locale: "en_US",
    images: [
      { url: "/opengraph-image", width: 1200, height: 630, alt: OG_IMAGE_ALT },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FAQ · LLM Workbench",
    description:
      "Answers about LLM Workbench run bundles, human gates, replay, privacy, and how to try it.",
    images: [
      { url: "/twitter-image", width: 1200, height: 630, alt: OG_IMAGE_ALT },
    ],
  },
};

export default function FAQPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="relative isolate">
        <div
          aria-hidden="true"
          className="landing-mesh pointer-events-none absolute inset-x-0 top-0 -z-10 h-[22rem] opacity-40 mix-blend-screen"
        />
        <section className="mx-auto w-full max-w-3xl px-6 py-14 md:pb-24 md:pt-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-foreground)]">
            LLM Workbench
          </p>
          <h1 className="mt-2 font-serif text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Frequently asked questions
          </h1>
          <span
            aria-hidden="true"
            className="mt-5 block h-px w-24 bg-gradient-to-r from-cyan-400/70 via-violet-400/40 to-transparent"
          />

          <ol className="mt-10 divide-y divide-[var(--color-border)]">
            {faqs.map((faq) => (
              <li key={faq.q} className="py-6 first:pt-0">
                <h2 className="text-lg font-semibold tracking-tight">{faq.q}</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--color-muted-foreground)]">
                  {renderAnswer(faq)}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}

function renderAnswer(faq: Faq): ReactNode {
  if (faq.q !== "How do I try it?") return faq.a;

  const demoHref = "/runs/demo";
  const playgroundText = "playground";
  const demoIndex = faq.a.indexOf(demoHref);
  const playgroundIndex = faq.a.lastIndexOf(playgroundText);

  if (demoIndex === -1 || playgroundIndex === -1) return faq.a;

  return (
    <>
      {faq.a.slice(0, demoIndex)}
      <Link
        href={demoHref}
        className="text-[var(--color-foreground)] underline-offset-4 hover:underline"
      >
        {demoHref}
      </Link>
      {faq.a.slice(demoIndex + demoHref.length, playgroundIndex)}
      <Link
        href="/playground"
        prefetch={false}
        className="text-[var(--color-foreground)] underline-offset-4 hover:underline"
      >
        {playgroundText}
      </Link>
      {faq.a.slice(playgroundIndex + playgroundText.length)}
    </>
  );
}
