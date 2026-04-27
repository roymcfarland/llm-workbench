import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

import { WORKBENCH_PROTOCOL_VERSION } from "@llm-workbench/runtime";

import { Button } from "@/components/ui/button";
import { CodeDiff } from "@/components/landing/code-diff";
import { HeroLiveRun } from "@/components/landing/hero-live-run";
import { StaticWorkflowSvg } from "@/components/landing/static-workflow-svg";
import { getTotalRunsCount } from "@/lib/landing/runs-count";
import {
  GITHUB_URL,
  LICENSE_NAME,
  LICENSE_URL,
  SITE_TAGLINE,
  siteOrigin,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "LLM Workbench — model-agnostic LLM control plane",
  description:
    "Tamper-evident, human-gated, replayable run bundles for the LLM agents you actually deploy. Open the playground, read the protocol, drive it from MCP.",
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    type: "website",
    title: "LLM Workbench",
    description:
      "Tamper-evident, human-gated, replayable run bundles for the LLM agents you actually deploy.",
  },
};

export default async function LandingPage() {
  const [runsCount, origin] = await Promise.all([
    getTotalRunsCount(),
    siteOrigin(),
  ]);

  const jsonLd = buildJsonLd({ origin, runsCount });

  return (
    <>
      <script
        type="application/ld+json"
        // server-rendered, so dangerouslySet here is safe and intentional
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="landing-mesh pointer-events-none absolute inset-0 -z-10 opacity-90"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh] bg-gradient-to-b from-transparent via-transparent to-[var(--color-background)]"
        />

        <section
          aria-labelledby="hero-heading"
          className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 pb-20 pt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12 lg:pb-28 lg:pt-24"
        >
          <div className="flex flex-col gap-6">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-foreground)] backdrop-blur">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"
              />
              LLM Workbench · Protocol v{WORKBENCH_PROTOCOL_VERSION}
            </p>

            <h1
              id="hero-heading"
              className="font-serif text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.6rem] lg:leading-[1.05]"
            >
              Ship LLM agents you can debug,{" "}
              <span className="bg-gradient-to-br from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                fork, and replay.
              </span>
            </h1>

            <p className="max-w-xl text-balance text-base leading-relaxed text-[var(--color-muted-foreground)] sm:text-lg">
              LLM Workbench turns each run of your agent into a tamper-evident,
              model-agnostic, human-gated bundle: trace events, artifacts, gates,
              and cost — signed, exportable, and replayable.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/playground">
                  Open the playground
                  <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/docs/protocol">
                  <BookOpen className="mr-1 h-4 w-4" aria-hidden="true" />
                  Read the protocol
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/runs/demo">View a demo run</Link>
              </Button>
            </div>

            <p className="font-mono text-[11px] text-[var(--color-muted-foreground)]">
              <span className="text-zinc-200">
                {runsCount === null ? "—" : runsCount.toLocaleString()}
              </span>{" "}
              runs persisted · v{WORKBENCH_PROTOCOL_VERSION} ·{" "}
              <a
                href={LICENSE_URL}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-4 hover:underline"
              >
                {LICENSE_NAME}
              </a>
            </p>
          </div>

          <div className="relative">
            {/* Static fallback for no-JS / reduced-motion. The client hero hides
                this on mount via [data-static-fallback][data-hidden]. */}
            <div
              data-static-fallback
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]/40 p-3 data-[hidden=true]:hidden"
            >
              <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/40">
                <StaticWorkflowSvg />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 font-mono text-[10px] text-[var(--color-muted-foreground)]">
                <span>step_started · parser1</span>
                <span>model_io · 220ms</span>
                <span>step_completed · output</span>
              </div>
            </div>
            <noscript>
              <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
                JavaScript is disabled — showing a static workflow snapshot.
              </p>
            </noscript>
            <div className="mt-0">
              <HeroLiveRun />
            </div>
          </div>
        </section>

        <section
          aria-labelledby="diff-heading"
          className="mx-auto w-full max-w-6xl px-6 pb-24"
        >
          <div className="mb-8 flex flex-col gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-foreground)]">
              one import changes
            </p>
            <h2
              id="diff-heading"
              className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              What you write changes by one import.
            </h2>
            <p className="max-w-2xl text-sm text-[var(--color-muted-foreground)]">
              Drop in <code className="rounded bg-[var(--color-muted)]/40 px-1 py-0.5 font-mono text-xs">tracedGenerateText</code>{" "}
              from <code className="rounded bg-[var(--color-muted)]/40 px-1 py-0.5 font-mono text-xs">@llm-workbench/ai-sdk</code>{" "}
              and every call becomes a structured trace event, persisted into
              the run bundle, gated by your workflow policy. Click any line on
              the right to preview the events.
            </p>
          </div>
          <CodeDiff />
        </section>
      </div>
    </>
  );
}

function buildJsonLd({
  origin,
  runsCount,
}: {
  origin: string;
  runsCount: number | null;
}) {
  const url = origin;
  return [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "LLM Workbench",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      url,
      description: SITE_TAGLINE,
      softwareVersion: WORKBENCH_PROTOCOL_VERSION,
      license: LICENSE_URL,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      codeRepository: GITHUB_URL,
      ...(runsCount !== null
        ? {
            interactionStatistic: {
              "@type": "InteractionCounter",
              interactionType: "https://schema.org/UseAction",
              userInteractionCount: runsCount,
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "LLM Workbench",
      url,
      potentialAction: {
        "@type": "SearchAction",
        target: `${url}/runs?q={query}`,
        "query-input": "required name=query",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is a run bundle?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A run bundle is a structured JSON artifact containing the workflow snapshot, every trace event, every artifact version, every rule set, and an optional engine snapshot for faithful rehydration. Run bundles are tamper-evident: the integrity field carries a SHA-256 hash over canonical JSON of the rest of the bundle.",
          },
        },
        {
          "@type": "Question",
          name: "What is a human gate?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A human gate pauses a run before or after a step (PAUSE_BEFORE / PAUSE_AFTER) until a reviewer approves, rejects, or edits the proposed action. CHECKPOINT gates capture additional fine-grained approvals. Every gate transition is recorded as a structured trace event with timestamps, decision, and an optional note.",
          },
        },
        {
          "@type": "Question",
          name: "Is it model-agnostic?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. The runtime never calls a model directly. The host application owns prompts, providers, and tool registries. LLM Workbench records what happened — provider, model, tokens, cost, duration — through explicit tracedGenerateText / tracedStreamText / tracedGenerateObject wrappers, or via direct session.logModelIO calls.",
          },
        },
        {
          "@type": "Question",
          name: "What is the license?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "PolyForm Noncommercial 1.0.0. You can read the source, fork it, modify it, redistribute noncommercial forks, and use it for personal projects, research, education, and public-benefit work. Commercial use requires a separate paid license.",
          },
        },
      ],
    },
  ];
}
