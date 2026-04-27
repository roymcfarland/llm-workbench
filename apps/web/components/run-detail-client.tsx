"use client";

import { useEffect, useMemo, useState } from "react";

import {
  HttpRunRepository,
  SchemaRegistry,
  WorkbenchRuntime,
  registerDemoSchemas,
  summarizeModelTelemetry,
  type RunStoreState,
  type TraceEvent,
} from "@llm-workbench/runtime";
import { WorkbenchShell } from "@llm-workbench/ui";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type Props = {
  runId: string;
  // Wire format produced by stateToSerialized — exactly what GET /api/runs/:id returns.
  serialized: unknown;
  /** When true, hide tabs/controls that issue mutating API calls (used by /runs/demo). */
  readOnly?: boolean;
};

function summarizeEvent(e: TraceEvent): string {
  switch (e.type) {
    case "step_started":
      return `step_started · ${e.stepId}`;
    case "step_completed":
      return `step_completed · ${e.stepId} · ok=${String(e.ok)}`;
    case "artifact_written":
      return `artifact_written · ${e.artifact.artifactKey} v${e.artifact.version}`;
    case "artifact_patch":
      return `artifact_patch · ${e.artifactKey} v${e.fromVersion}→v${e.toVersion}`;
    case "model_io":
      return `model_io · ${e.direction} · ${e.model ?? "?"}${
        e.durationMs ? ` (${e.durationMs}ms)` : ""
      }`;
    case "tool_call":
      return `tool_call · ${e.name}`;
    case "human_gate_requested":
      return `gate_requested · ${e.stepId} ${e.gate}`;
    case "human_gate_resolved":
      return `gate_resolved · ${e.stepId} ${e.decision}`;
    case "rule_changed":
      return `rule_changed · ${e.ruleSetId}`;
    case "policy_changed":
      return `policy_changed · ${e.stepId} → ${e.policy}`;
    case "error":
      return `error · ${e.message}`;
    case "run_forked":
      return `run_forked · from ${e.parentRunId}`;
    case "annotation":
      return `annotation · ${e.text}`;
    case "run_status_changed":
      return `run_status_changed · ${e.status}`;
    case "span_started":
      return `span_started · ${e.name}`;
    case "span_ended":
      return `span_ended · ${e.spanId}${e.durationMs ? ` (${e.durationMs}ms)` : ""}`;
    default: {
      const _exhaustive: never = e;
      return _exhaustive;
    }
  }
}

export function RunDetailClient({ runId, serialized, readOnly }: Props) {
  const registry = useMemo(() => {
    const r = new SchemaRegistry();
    registerDemoSchemas(r);
    return r;
  }, []);
  const runtime = useMemo(() => new WorkbenchRuntime(), []);
  const repo = useMemo(
    () =>
      new HttpRunRepository({
        baseUrl: "/api",
        fetchImpl: (input, init) =>
          fetch(input as RequestInfo, { ...init, credentials: "include" }),
      }),
    [],
  );

  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const state = deserializeWire(serialized);
      runtime.importState(state);
      setHydrated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to hydrate run");
    }
  }, [runtime, serialized]);

  const state = hydrated ? runtime.getState(runId) : null;
  const telemetry = useMemo(
    () => (state ? summarizeModelTelemetry(state) : null),
    [state],
  );

  const totalCost = useMemo(() => {
    if (!telemetry) return null;
    const entries = Object.entries(telemetry.totals.costByCurrency);
    if (entries.length === 0) return null;
    return entries
      .map(([currency, amount]) => `${amount.toFixed(4)} ${currency}`)
      .join(" · ");
  }, [telemetry]);

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-[var(--color-destructive-foreground)]">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (!state) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-[var(--color-muted-foreground)]">
          Hydrating run…
        </CardContent>
      </Card>
    );
  }

  const headerStats = [
    { label: "Status", value: state.run.status },
    { label: "Workflow", value: state.run.workflowId },
    { label: "Started", value: formatDate(state.run.startedAt) },
    {
      label: "Ended",
      value: state.run.endedAt ? formatDate(state.run.endedAt) : "—",
    },
    { label: "Trace events", value: String(state.trace.length) },
    {
      label: "Total cost",
      value: totalCost ?? "—",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {headerStats.map((stat) => (
          <Card key={stat.label} className="bg-[var(--color-card)]/60">
            <CardHeader className="px-4 pb-1 pt-3">
              <CardDescription className="text-xs uppercase tracking-wide">
                {stat.label}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0 font-mono text-sm">
              {stat.value || "—"}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="trace" className="w-full">
        <TabsList>
          <TabsTrigger value="trace">Trace</TabsTrigger>
          <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
          <TabsTrigger value="gates">Gates</TabsTrigger>
          {readOnly ? null : <TabsTrigger value="workbench">Workbench</TabsTrigger>}
        </TabsList>

        <TabsContent value="trace">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trace timeline</CardTitle>
              <CardDescription>
                Newest events at the bottom. Each row is a structured trace
                event captured by the runtime.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-1 font-mono text-xs">
                {state.trace.map((event) => (
                  <li
                    key={event.id}
                    className="grid grid-cols-[140px_1fr] gap-3 border-b border-[var(--color-border)] py-1.5 last:border-b-0"
                  >
                    <span className="text-[var(--color-muted-foreground)]">
                      {new Date(event.ts).toLocaleTimeString()}
                    </span>
                    <span>{summarizeEvent(event)}</span>
                  </li>
                ))}
                {state.trace.length === 0 ? (
                  <li className="text-[var(--color-muted-foreground)]">
                    No trace events recorded.
                  </li>
                ) : null}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="artifacts">
          <ArtifactList state={state} />
        </TabsContent>

        <TabsContent value="gates">
          <GatePanel state={state} />
        </TabsContent>

        {readOnly ? null : (
          <TabsContent value="workbench">
            <WorkbenchShell
              runtime={runtime}
              runId={runId}
              registry={registry}
              repo={repo}
              artifactKeys={[...state.artifactsByKey.keys()].sort()}
              ruleSetId={[...state.ruleSetsById.keys()][0] ?? "default"}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ArtifactList({ state }: { state: RunStoreState }) {
  const entries = [...state.artifactsByKey.entries()];
  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-[var(--color-muted-foreground)]">
          No artifacts written.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-3">
      {entries.map(([key, artifact]) => (
        <Card key={key}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-mono">{key}</CardTitle>
              <CardDescription>
                type {artifact.typeId} · v{artifact.version}
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-mono">
              {formatDate(artifact.createdAt)}
            </Badge>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[420px] overflow-auto rounded-md bg-[var(--color-muted)]/60 p-3 font-mono text-xs leading-relaxed">
              {JSON.stringify(artifact.data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GatePanel({ state }: { state: RunStoreState }) {
  const entries = [...state.gateState.entries()];
  const policyById = new Map(
    state.run.workflowSnapshot.steps.map((s) => [s.id, s.gatePolicy ?? "AUTO"]),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gate state</CardTitle>
        <CardDescription>
          Per-step gate policy and the current before/after approval status.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 text-sm">
          {entries.map(([stepId, gate]) => {
            const checkpointEntries = Object.entries(gate.checkpoints ?? {});
            return (
              <li
                key={stepId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-border)] px-3 py-2"
              >
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="font-semibold">{stepId}</span>
                  <Badge variant="secondary">{policyById.get(stepId) ?? "AUTO"}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
                  <span>before: {gate.before}</span>
                  <span>·</span>
                  <span>after: {gate.after}</span>
                  {checkpointEntries.length > 0 ? (
                    <>
                      <span>·</span>
                      <span>
                        checkpoints:{" "}
                        {checkpointEntries
                          .map(([k, v]) => `${k}=${v}`)
                          .join(", ")}
                      </span>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function deserializeWire(json: unknown): RunStoreState {
  if (!json || typeof json !== "object") {
    throw new Error("Run state payload is empty");
  }
  const row = json as {
    revision?: number;
    run: RunStoreState["run"];
    trace?: TraceEvent[];
    artifactsByKey?: Array<[string, unknown]>;
    ruleSetsById?: Array<[string, unknown]>;
    stepStatus?: Array<[string, string]>;
    gateState?: Array<[string, unknown]>;
    idempotency?: Array<[string, { artifactKey: string; version: number }]>;
  };
  return {
    revision: row.revision ?? 0,
    run: row.run,
    trace: Array.isArray(row.trace) ? row.trace : [],
    artifactsByKey: new Map(asEntries(row.artifactsByKey)) as RunStoreState["artifactsByKey"],
    ruleSetsById: new Map(asEntries(row.ruleSetsById)) as RunStoreState["ruleSetsById"],
    stepStatus: new Map(asEntries(row.stepStatus)) as RunStoreState["stepStatus"],
    gateState: new Map(asEntries(row.gateState)) as RunStoreState["gateState"],
    idempotency: new Map(asEntries(row.idempotency)) as RunStoreState["idempotency"],
  };
}

function asEntries<T>(v: unknown): Array<[string, T]> {
  return Array.isArray(v) ? (v as Array<[string, T]>) : [];
}
