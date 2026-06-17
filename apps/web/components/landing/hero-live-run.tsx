"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  WorkbenchRuntime,
  type RuleSet,
  type RunStoreState,
  type TraceEvent,
  type WorkflowSpec,
} from "@llm-workbench/runtime";
import { WorkflowGraph } from "@llm-workbench/ui";

import { cn } from "@/lib/utils";

const timeJumpWorkflow = {
  id: "timeJump",
  version: 1,
  title: "DeLorean Flight Computer",
  steps: [
    {
      id: "setCircuits",
      gatePolicy: "AUTO",
      inputs: [],
      outputs: ["timeCircuits"],
    },
    {
      id: "power",
      gatePolicy: "PAUSE_BEFORE",
      inputs: ["timeCircuits"],
      outputs: ["powerPlan"],
    },
    {
      id: "launch",
      gatePolicy: "PAUSE_AFTER",
      inputs: ["powerPlan"],
      outputs: ["flightCard"],
    },
  ],
  edges: [
    { id: "e1", from: "setCircuits", to: "power" },
    { id: "e2", from: "power", to: "launch" },
  ],
} satisfies WorkflowSpec;

const temporalSafetyRuleSet = {
  id: "temporal-safety",
  ruleSchemaId: "demoRule",
  rules: [
    {
      id: "r1",
      priority: 0,
      enabled: true,
      label: "Avoid your past self",
      payload: { kind: "forbid", value: "self-encounter" },
    },
    {
      id: "r2",
      priority: 1,
      enabled: true,
      label: "Preserve the continuum",
      payload: { kind: "policy", value: "no-paradox" },
    },
  ],
} satisfies RuleSet;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  return reduced;
}

type TraceRow = { id: string; label: string; meta?: string };

const TRACE_VISIBLE_ROWS = 6;

type TraceAsideSlot =
  | { kind: "empty"; key: string }
  | { kind: "waiting" }
  | { kind: "row"; row: TraceRow };

function buildTraceAsideSlots(trace: TraceRow[]): TraceAsideSlot[] {
  if (trace.length === 0) {
    return [
      ...Array.from({ length: TRACE_VISIBLE_ROWS - 1 }, (_, i) => ({
        kind: "empty" as const,
        key: `pad-${i}`,
      })),
      { kind: "waiting" },
    ];
  }
  const trimmed = trace.slice(-TRACE_VISIBLE_ROWS);
  const pad = TRACE_VISIBLE_ROWS - trimmed.length;
  return [
    ...Array.from({ length: pad }, (_, i) => ({
      kind: "empty" as const,
      key: `pad-${i}`,
    })),
    ...trimmed.map((row) => ({ kind: "row" as const, row })),
  ];
}

function summarize(e: TraceEvent): TraceRow {
  switch (e.type) {
    case "step_started":
      return { id: e.id, label: `step_started · ${e.stepId}` };
    case "step_completed":
      return {
        id: e.id,
        label: `step_completed · ${e.stepId}`,
        meta: e.ok ? "ok" : "failed",
      };
    case "model_io": {
      const cost = e.cost ? `$${e.cost.amount.toFixed(4)}` : undefined;
      const tokens = e.usage?.totalTokens
        ? `${e.usage.totalTokens} tok`
        : undefined;
      const dur = e.durationMs ? `${e.durationMs}ms` : undefined;
      const meta = [dur, tokens, cost].filter(Boolean).join(" · ");
      return {
        id: e.id,
        label: `model_io · ${e.model ?? "?"}`,
        meta: meta || undefined,
      };
    }
    case "artifact_written":
      return {
        id: e.id,
        label: `artifact_written · ${e.artifact.artifactKey}`,
        meta: `v${e.artifact.version}`,
      };
    case "human_gate_resolved":
      return {
        id: e.id,
        label: `gate_resolved · ${e.stepId}`,
        meta: e.decision,
      };
    case "human_gate_requested":
      return {
        id: e.id,
        label: `gate_requested · ${e.stepId}`,
        meta: e.gate,
      };
    case "rule_changed":
      return { id: e.id, label: `rule_changed · ${e.ruleSetId}` };
    case "run_status_changed":
      return { id: e.id, label: `run_status_changed`, meta: e.status };
    default:
      return { id: e.id, label: e.type };
  }
}

type HeroLiveRunProps = {
  className?: string;
};

export function HeroLiveRun({ className }: HeroLiveRunProps) {
  const reducedMotion = useReducedMotion();
  const runtime = useMemo(() => new WorkbenchRuntime(), []);
  const startedRef = useRef(false);
  const [runId, setRunId] = useState<string>("");
  const [tick, setTick] = useState(0);
  const [trace, setTrace] = useState<TraceRow[]>([]);

  useEffect(() => {
    // Hide the static fallback once the live hero mounts.
    const el = document.querySelector<HTMLElement>("[data-static-fallback]");
    if (el) el.setAttribute("data-hidden", "true");
  }, []);

  // Start a single run. We re-run the choreography on `tick` to loop forever.
  useEffect(() => {
    if (startedRef.current && tick === 0) return;
    startedRef.current = true;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Reset by deleting the previous run before starting a new one.
    if (runId) runtime.deleteRun(runId);

    const { runId: newId } = runtime.startRun({
      workflow: timeJumpWorkflow,
      ruleSets: [temporalSafetyRuleSet],
    });
    setRunId(newId);
    setTrace([]);

    const session = runtime.session(newId);
    const unsubscribe = runtime.subscribe(newId, (event) => {
      if (cancelled) return;
      setTrace((prev) => {
        const next = [...prev, summarize(event)];
        return next.slice(-6);
      });
    });

    const stepIds = ["setCircuits", "power", "launch"] as const;
    const stepDelay = reducedMotion ? 0 : 600;

    const schedule = (fn: () => void, ms: number) => {
      if (reducedMotion) {
        fn();
      } else {
        timers.push(setTimeout(fn, ms));
      }
    };

    let t = 0;
    stepIds.forEach((stepId) => {
      if (stepId === "power") {
        schedule(() => {
          try {
            session.resolveGate({
              stepId,
              gate: "PAUSE_BEFORE",
              decision: "approved",
            });
          } catch {
            /* gate already resolved */
          }
        }, t);
        t += stepDelay;
      }

      schedule(() => {
        try {
          session.beginStep(stepId);
        } catch {
          /* not ready yet */
        }
      }, t);
      t += stepDelay;

      if (stepId === "power") {
        schedule(() => {
          try {
            session.logModelIO({
              stepId,
              direction: "response",
              provider: "anthropic",
              model: "claude-sonnet-4-5",
              usage: { inputTokens: 180, outputTokens: 90, totalTokens: 270 },
              cost: { amount: 0.0072, currency: "USD" },
              durationMs: 300,
            });
          } catch {
            /* ignore */
          }
        }, t);
        t += stepDelay / 2;
      }

      schedule(() => {
        try {
          if (stepId === "setCircuits") {
            session.writeArtifact({
              artifactKey: "timeCircuits",
              typeId: "dlrn.circuits",
              data: {
                destinationTime: "1955-11-05 06:00",
                presentTime: "1985-10-26 01:35",
              },
            });
          } else if (stepId === "power") {
            session.writeArtifact({
              artifactKey: "powerPlan",
              typeId: "dlrn.power",
              data: { gigawatts: 1.21, source: "lightning strike" },
            });
          } else {
            session.writeArtifact({
              artifactKey: "flightCard",
              typeId: "dlrn.flight",
              data: { approachSpeed: "88 mph", route: "Courthouse Square" },
            });
          }
        } catch {
          /* ignore */
        }
      }, t);
      t += stepDelay;

      schedule(() => {
        try {
          session.completeStep(stepId);
        } catch {
          /* ignore */
        }
      }, t);
      t += stepDelay;

      if (stepId === "launch") {
        schedule(() => {
          try {
            session.resolveGate({
              stepId,
              gate: "PAUSE_AFTER",
              decision: "approved",
            });
          } catch {
            /* ignore */
          }
        }, t);
        t += stepDelay;
      }
    });

    schedule(() => {
      try {
        session.completeRun();
      } catch {
        /* ignore */
      }
    }, t);
    t += stepDelay;

    if (!reducedMotion) {
      // Loop after a 2s hold.
      timers.push(
        setTimeout(() => {
          if (!cancelled) setTick((x) => x + 1);
        }, t + 2000),
      );
    }

    return () => {
      cancelled = true;
      unsubscribe();
      for (const id of timers) clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, reducedMotion, runtime]);

  // Use a small revision counter so the WorkflowGraph re-renders.
  const state: RunStoreState | undefined = runId
    ? runtime.getState(runId)
    : undefined;
  const graphKey = state ? `${runId}-${state.revision}` : runId;

  const traceSlots = useMemo(() => buildTraceAsideSlots(trace), [trace]);

  return (
    <div
      className={cn(
        "relative isolate grid w-full grid-cols-1 gap-3 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]/40 p-3 shadow-[0_30px_80px_-40px_oklch(0.65_0.18_260/0.6)] backdrop-blur [contain:layout] [overflow-anchor:none] md:grid-cols-[1fr_220px]",
        className,
      )}
    >
      <div className="relative isolate aspect-[4/3] min-h-[220px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/40 lg:aspect-auto lg:min-h-0 lg:self-stretch">
        {runId && state ? (
          <WorkflowGraph
            key={graphKey}
            runtime={runtime}
            runId={runId}
            embed
            className="!h-full min-h-0 rounded-none border-0"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[var(--color-muted-foreground)]">
            Booting runtime…
          </div>
        )}
      </div>
      <aside className="relative z-10 flex h-[220px] min-h-[220px] flex-col gap-1 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/95 p-3 font-mono text-[10.5px] leading-snug backdrop-blur-sm md:w-[220px] md:flex-shrink-0 lg:h-auto lg:min-h-0 lg:self-stretch">
        <div className="mb-1 shrink-0 flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
          <span>trace</span>
          <span className="rounded bg-emerald-500/15 px-1 text-emerald-300">
            live
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-0">
          {traceSlots.map((slot) =>
            slot.kind === "empty" ? (
              <div
                key={slot.key}
                aria-hidden
                className="flex min-h-[1.625rem] shrink-0 items-baseline justify-between gap-2 border-b border-dashed border-[var(--color-border)]/45 py-0.5 opacity-35 last:border-b-0"
              >
                <span className="truncate text-zinc-100">&nbsp;</span>
              </div>
            ) : slot.kind === "waiting" ? (
              <div
                key="waiting"
                className="flex min-h-[1.625rem] shrink-0 items-center border-b border-dashed border-transparent py-0.5 text-[var(--color-muted-foreground)] last:border-b-0"
              >
                waiting for events…
              </div>
            ) : (
              <div
                key={slot.row.id}
                className="flex min-h-[1.625rem] shrink-0 items-baseline justify-between gap-2 border-b border-dashed border-[var(--color-border)]/60 py-0.5 last:border-b-0"
              >
                <span className="truncate text-zinc-100">{slot.row.label}</span>
                {slot.row.meta ? (
                  <span className="shrink-0 text-[var(--color-muted-foreground)]">
                    {slot.row.meta}
                  </span>
                ) : null}
              </div>
            ),
          )}
        </div>
      </aside>
    </div>
  );
}

export default HeroLiveRun;
