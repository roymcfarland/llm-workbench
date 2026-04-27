import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireTenant } from "@/lib/auth/tenant";
import { getServiceSupabase } from "@/lib/supabase/server";

export const metadata = { title: "Runs · LLM Workbench" };

type RunListRow = {
  id: string;
  workflow_id: string | null;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
  tags: string[] | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusVariant(status: string | null) {
  switch (status) {
    case "completed":
      return "success" as const;
    case "failed":
    case "cancelled":
      return "destructive" as const;
    case "paused":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

export default function RunsListPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Snapshots saved through <code className="font-mono text-xs">HttpRunRepository</code>.
          Scoped to your Clerk org (or user, if no org is selected).
        </p>
      </header>

      <Separator />

      <Suspense fallback={<RunsListSkeleton />}>
        <RunsList />
      </Suspense>
    </div>
  );
}

async function RunsList() {
  const { tenantId } = await requireTenant();
  const { data, error } = await getServiceSupabase()
    .from("runs")
    .select("id, workflow_id, status, started_at, ended_at, tags")
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-[var(--color-muted-foreground)]">
          Could not load runs: {error.message}. Check your Supabase env vars
          and that the migration in <code>apps/web/supabase/migrations</code>{" "}
          has been applied.
        </CardContent>
      </Card>
    );
  }

  const rows = (data ?? []) as RunListRow[];

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No runs yet</CardTitle>
          <CardDescription>
            Head to the{" "}
            <Link href="/playground" className="underline underline-offset-4">
              playground
            </Link>{" "}
            and click <em>Save snapshot</em> to persist your first run.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <Link
          key={row.id}
          href={`/runs/${row.id}`}
          className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/60 px-5 py-4 transition-colors hover:bg-[var(--color-accent)]/40"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="font-mono">{row.id}</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
                <span>{row.workflow_id ?? "unknown workflow"}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatDate(row.started_at)}
                </span>
                {row.ended_at ? (
                  <>
                    <span>·</span>
                    <span>ended {formatDate(row.ended_at)}</span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {row.tags?.length
                ? row.tags.map((t) => (
                    <Badge key={t} variant="outline" className="font-mono">
                      {t}
                    </Badge>
                  ))
                : null}
              <Badge variant={statusVariant(row.status)}>{row.status ?? "running"}</Badge>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function RunsListSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[72px] animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/40"
        />
      ))}
    </div>
  );
}
