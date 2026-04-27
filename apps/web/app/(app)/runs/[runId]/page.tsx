import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RunDetailClient } from "@/components/run-detail-client";
import { requireTenant } from "@/lib/auth/tenant";
import { loadRunForTenant } from "@/lib/supabase/runs-store";

type PageProps = { params: Promise<{ runId: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { runId } = await params;
  return { title: `Run ${runId} · LLM Workbench` };
}

// With Cache Components enabled, awaiting `params` is treated as request-time
// data. Render a static shell and stream the run details inside <Suspense>.
export default function RunDetailPage({ params }: PageProps) {
  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/runs">
          <ArrowLeft className="h-4 w-4" /> All runs
        </Link>
      </Button>
      <Suspense fallback={<RunDetailSkeleton />}>
        <RunDetailLoader paramsPromise={params} />
      </Suspense>
    </div>
  );
}

async function RunDetailLoader({
  paramsPromise,
}: {
  paramsPromise: Promise<{ runId: string }>;
}) {
  const { runId } = await paramsPromise;
  const { tenantId } = await requireTenant();
  const row = await loadRunForTenant(tenantId, runId);
  if (!row) notFound();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-mono text-2xl font-semibold tracking-tight">{runId}</h1>
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.workflow_id ?? "unknown workflow"}
        </span>
      </div>
      <RunDetailClient runId={runId} serialized={row.state} />
    </div>
  );
}

function RunDetailSkeleton() {
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">
        Loading run…
      </CardContent>
    </Card>
  );
}
