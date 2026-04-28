import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { WORKBENCH_PROTOCOL_VERSION } from "@llm-workbench/runtime";

import { Button } from "@/components/ui/button";
import { GITHUB_URL } from "@/lib/site";

type LandingFinalCtaProps = {
  runsCount: number | null;
};

export function LandingFinalCta({ runsCount }: LandingFinalCtaProps) {
  return (
    <section
      aria-labelledby="cta-heading"
      className="relative mx-auto max-w-6xl px-6 pb-28 pt-10 md:pt-4"
    >
      <div className="pointer-events-none absolute -inset-x-12 top-1/3 bottom-0 rounded-[40%] bg-[radial-gradient(ellipse_at_center,_oklch(0.5_0.2_290/0.12),_transparent_65%)] blur-2xl" />

      <div className="relative overflow-hidden rounded-3xl p-[1px] shadow-[0_0_100px_-36px_oklch(0.55_0.22_260/0.65)] dark:shadow-[0_0_120px_-40px_oklch(0.58_0.22_270/0.7)]">
        <div
          className="absolute inset-0 opacity-80"
          style={{
            background:
              "conic-gradient(from 180deg at 50% 50%, #22d3ee14, #a78bfa33, #f472b614, #22d3ee14)",
          }}
        />
        <div className="relative rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)]/85 px-8 py-12 backdrop-blur-xl md:px-14 md:py-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-background)]/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-foreground)]">
            <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" aria-hidden />
            reference plane · v{WORKBENCH_PROTOCOL_VERSION}
          </div>
          <h2
            id="cta-heading"
            className="mt-6 max-w-2xl font-serif text-3xl font-semibold tracking-tight text-balance md:text-4xl"
          >
            Step into the playground, or drive the same contract from your agent.
          </h2>
          <p className="mt-4 max-w-xl text-[var(--color-muted-foreground)] md:text-lg">
            Every surface — UI, HTTP, MCP — agrees on the same run bundle. Pick yours
            and start persisting reality.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="shadow-lg shadow-cyan-500/10">
              <Link href="/playground">
                Open the playground
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/runs/demo">Watch a demo run</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                View on GitHub
              </a>
            </Button>
          </div>
          <p className="mt-8 font-mono text-[11px] text-[var(--color-muted-foreground)]">
            <span className="text-[var(--color-foreground)]">
              {runsCount === null ? "—" : runsCount.toLocaleString()}
            </span>{" "}
            runs on this plane · PolyForm Noncommercial · Apache-2.0 core
          </p>
        </div>
      </div>
    </section>
  );
}
