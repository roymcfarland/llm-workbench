import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

import { WORKBENCH_PROTOCOL_VERSION } from "@llm-workbench/runtime";

import { Button } from "@/components/ui/button";
import { CodeDiff } from "@/components/landing/code-diff";
import { HeroAtmosphereSlot } from "@/components/landing/hero-atmosphere-slot";
import { HeroLiveRun } from "@/components/landing/hero-live-run";
import { LandingFinalCta } from "@/components/landing/landing-final-cta";
import { LandingHorizon } from "@/components/landing/landing-horizon";
import { OrbitFeatures } from "@/components/landing/orbit-features";
import { SectionReveal } from "@/components/landing/section-reveal";
import { StaticWorkflowSvg } from "@/components/landing/static-workflow-svg";
import { TelemetryRain } from "@/components/landing/telemetry-rain";
import { getTotalRunsCount } from "@/lib/landing/runs-count";
import { PlaygroundMarketingLink } from "@/components/playground-marketing-link";
import {
  GITHUB_URL,
  LICENSE_NAME,
  LICENSE_URL,
  OG_IMAGE_ALT,
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
    siteName: "LLM Workbench",
    locale: "en_US",
    title: "LLM Workbench",
    description:
      "Tamper-evident, human-gated, replayable run bundles for the LLM agents you actually deploy.",
    images: [
      { url: "/opengraph-image", width: 1200, height: 630, alt: OG_IMAGE_ALT },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LLM Workbench",
    description:
      "Tamper-evident, human-gated, replayable run bundles for the LLM agents you actually deploy.",
    images: [
      { url: "/twitter-image", width: 1200, height: 630, alt: OG_IMAGE_ALT },
    ],
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
        <div className="relative flex min-h-[min(100dvh,56rem)] items-center">
          <div className="absolute inset-0 -z-30 pointer-events-none">
            <HeroAtmosphereSlot className="h-full min-h-[min(100dvh,56rem)] w-full" />
          </div>
          <div
            aria-hidden="true"
            className="landing-mesh pointer-events-none absolute inset-0 -z-20 opacity-[0.55] mix-blend-screen dark:opacity-40 dark:mix-blend-normal"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[var(--color-background)]/45 via-[var(--color-background)]/10 to-[var(--color-background)]"
          />
          <div
            aria-hidden="true"
            className="noise-grain pointer-events-none absolute inset-0 -z-10 opacity-[0.035] dark:opacity-[0.06]"
          />

          <section
            aria-labelledby="hero-heading"
            className="relative z-10 mx-auto grid w-full max-w-6xl gap-6 px-6 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch lg:gap-x-14 lg:gap-y-6 lg:py-20"
          >
            <p
              className="landing-reveal order-1 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/55 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-foreground)] shadow-sm backdrop-blur-md lg:col-start-1 lg:row-start-1 lg:self-start"
              style={{ animationDelay: "0s" }}
            >
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]"
              />
              LLM Workbench · Protocol v{WORKBENCH_PROTOCOL_VERSION}
            </p>

            <div className="order-2 flex flex-col gap-6 lg:col-start-1 lg:row-start-2">
              <h1
                id="hero-heading"
                className="landing-reveal font-serif text-4xl font-semibold tracking-tight text-balance drop-shadow-sm sm:text-5xl lg:text-[4.1rem] lg:leading-[1.02]"
                style={{ animationDelay: "0.09s" }}
              >
                Ship LLM agents you can debug,{" "}
                <span className="aurora-shift bg-gradient-to-br from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                  fork, and replay.
                </span>
              </h1>

              <p
                className="landing-reveal max-w-xl text-balance text-base leading-relaxed text-[var(--color-muted-foreground)] sm:text-lg"
                style={{ animationDelay: "0.16s" }}
              >
                LLM Workbench turns each run of your agent into a tamper-evident,
                model-agnostic, human-gated bundle: trace events, artifacts, gates,
                and cost — signed, exportable, and replayable.
              </p>

              <div
                className="landing-reveal flex flex-wrap items-center gap-3"
                style={{ animationDelay: "0.22s" }}
              >
                <Button asChild size="lg" className="shadow-lg shadow-cyan-500/10">
                  <PlaygroundMarketingLink>
                    Open the playground
                    <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                  </PlaygroundMarketingLink>
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
            </div>

            <p
              className="landing-reveal order-3 font-mono text-[11px] text-[var(--color-muted-foreground)] lg:col-start-1 lg:row-start-3"
              style={{ animationDelay: "0.28s" }}
            >
              <span className="text-[var(--color-foreground)]">
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
              {" · "}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-4 hover:underline"
              >
                Source
              </a>
            </p>

            <div
              className="landing-reveal order-4 relative mt-4 lg:col-start-2 lg:row-start-2 lg:mt-0 lg:flex lg:h-full lg:min-h-0 lg:self-stretch"
              style={{ animationDelay: "0.14s" }}
            >
              <div
                data-static-fallback
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]/45 p-3 shadow-2xl backdrop-blur-md data-[hidden=true]:hidden"
              >
                <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/40">
                  <StaticWorkflowSvg />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 font-mono text-[10px] text-[var(--color-muted-foreground)]">
                  <span>step_started · setCircuits</span>
                  <span>model_io · 300ms</span>
                  <span>step_completed · launch</span>
                </div>
              </div>
              <noscript>
                <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
                  JavaScript is disabled — showing a static workflow snapshot.
                </p>
              </noscript>
              <div className="mt-0 lg:absolute lg:inset-0 lg:flex lg:h-full lg:w-full lg:self-stretch">
                <HeroLiveRun className="lg:h-full lg:self-stretch" />
              </div>
            </div>
          </section>
        </div>

        <SectionReveal>
          <OrbitFeatures />
        </SectionReveal>
        <SectionReveal>
          <TelemetryRain />
        </SectionReveal>
        <SectionReveal>
          <LandingHorizon />
        </SectionReveal>

        <SectionReveal>
          <section
            aria-labelledby="diff-heading"
            className="mx-auto w-full max-w-6xl px-6 pb-8 pt-4 md:pt-8"
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
              Drop in{" "}
              <code className="rounded bg-[var(--color-muted)]/40 px-1 py-0.5 font-mono text-xs">
                tracedGenerateText
              </code>{" "}
              from{" "}
              <code className="rounded bg-[var(--color-muted)]/40 px-1 py-0.5 font-mono text-xs">
                @llm-workbench/ai-sdk
              </code>{" "}
              and every call becomes a structured trace event, persisted into
              the run bundle, gated by your workflow policy. Click any line on
              the right to preview the events.
            </p>
          </div>
          <CodeDiff />
          </section>
        </SectionReveal>

        <SectionReveal>
          <LandingFinalCta runsCount={runsCount} />
        </SectionReveal>
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
            text: "MIT. LLM Workbench is open source — free to use, modify, and distribute, including commercially. The five core libraries are published to npm under the @llm-workbench scope, and the source is on GitHub.",
          },
        },
      ],
    },
  ];
}
