import type { Metadata } from "next";
import Link from "next/link";

import { RunDetailClient } from "@/components/run-detail-client";
import { Button } from "@/components/ui/button";
import { buildDemoRunSerialized } from "@/lib/landing/demo-run";
import { OG_IMAGE_ALT } from "@/lib/site";

export const metadata: Metadata = {
  title: "Demo run · LLM Workbench",
  description:
    "A public, read-only LLM Workbench run rendered the same way auth-gated runs are. No persistence.",
  alternates: { canonical: "/runs/demo" },
  openGraph: {
    title: "Public demo run · LLM Workbench",
    description:
      "A seeded sample agent run — read-only preview of the sandbox with no Clerk session required.",
    url: "/runs/demo",
    type: "website",
    siteName: "LLM Workbench",
    locale: "en_US",
    images: [
      { url: "/opengraph-image", width: 1200, height: 630, alt: OG_IMAGE_ALT },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Public demo run · LLM Workbench",
    description:
      "Seeded sample run — tamper-evident bundle preview without signing in.",
    images: [
      { url: "/twitter-image", width: 1200, height: 630, alt: OG_IMAGE_ALT },
    ],
  },
};

export const dynamic = "force-dynamic";

type DemoRunPageProps = {
  searchParams: Promise<{ s?: string | string[] }>;
};

export default async function DemoRunPage({ searchParams }: DemoRunPageProps) {
  const params = await searchParams;
  const scenarioId = Array.isArray(params.s) ? params.s[0] : params.s;
  const { runId, serialized, title, blurb } = buildDemoRunSerialized(scenarioId);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
        <div>
          <strong className="font-semibold text-amber-200">Public demo</strong>
          <span className="ml-2 text-amber-100/90">
            no auth, no persistence — refresh to regenerate.
          </span>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/sign-in?redirect_url=/playground" prefetch={false}>
            Sign in to run your own
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-baseline gap-3">
        <h1 className="font-mono text-2xl font-semibold tracking-tight">
          {runId}
        </h1>
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {title} · {blurb}
        </span>
      </div>

      <RunDetailClient key={runId} runId={runId} serialized={serialized} readOnly />
    </div>
  );
}
