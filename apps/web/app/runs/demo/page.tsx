import type { Metadata } from "next";
import Link from "next/link";

import { RunDetailClient } from "@/components/run-detail-client";
import { Button } from "@/components/ui/button";
import { buildDemoRunSerialized } from "@/lib/landing/demo-run";

export const metadata: Metadata = {
  title: "Demo run",
  description:
    "A public, read-only LLM Workbench run rendered the same way auth-gated runs are. No persistence.",
  alternates: { canonical: "/runs/demo" },
};

export const dynamic = "force-dynamic";

export default function DemoRunPage() {
  const { runId, serialized } = buildDemoRunSerialized();
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
          <Link href="/sign-in?redirect_url=/playground">Sign in to run your own</Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-baseline gap-3">
        <h1 className="font-mono text-2xl font-semibold tracking-tight">
          {runId}
        </h1>
        <span className="text-sm text-[var(--color-muted-foreground)]">
          jobSearchWorkflow · seeded sample
        </span>
      </div>

      <RunDetailClient runId={runId} serialized={serialized} readOnly />
    </div>
  );
}
