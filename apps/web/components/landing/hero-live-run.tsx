"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  WorkbenchRuntime,
  type RunStoreState,
  type TraceEvent,
} from "@llm-workbench/runtime";
import { WorkflowGraph } from "@llm-workbench/ui";

import { initialRuleSet, jobSearchWorkflow } from "@/lib/workflow/job-search";

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

export function HeroLiveRun() {
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
      workflow: jobSearchWorkflow,
      ruleSets: [initialRuleSet],
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

    const stepIds = ["parser1", "jobSearcher", "output"] as const;
    const stepDelay = reducedMotion ? 0 : 600;

    const schedule = (fn: () => void, ms: number) => {
      if (reducedMotion) {
        fn();
      } else {
        timers.push(setTimeout(fn, ms));
      }
    };

    let t = 0;
    // Resolve PAUSE_BEFORE on parser1, then begin/complete each step.
    schedule(() => {
      try {
        session.resolveGate({
          stepId: "parser1",
          gate: "PAUSE_BEFORE",
          decision: "approved",
        });
      } catch {
        /* gate already resolved */
      }
    }, t);
    t += stepDelay;

    stepIds.forEach((stepId, idx) => {
      schedule(() => {
        try {
          session.beginStep(stepId);
        } catch {
          /* not ready yet */
        }
      }, t);
      t += stepDelay;

      // Middle step gets a fake model_io trace.
      if (idx === 1) {
        schedule(() => {
          try {
            session.logModelIO({
              stepId,
              direction: "response",
              provider: "anthropic",
              model: "claude-haiku-4-5",
              usage: { inputTokens: 110, outputTokens: 40, totalTokens: 150 },
              cost: { amount: 0.003, currency: "USD" },
              durationMs: 220,
            });
          } catch {
            /* ignore */
          }
        }, t);
        t += stepDelay / 2;
      }

      schedule(() => {
        try {
          session.completeStep(stepId);
        } catch {
          /* ignore */
        }
      }, t);
      t += stepDelay;

      // PAUSE_AFTER on jobSearcher.
      if (stepId === "jobSearcher") {
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

  return (
    <div
      className="relative isolate grid w-full grid-cols-1 gap-3 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]/40 p-3 shadow-[0_30px_80px_-40px_oklch(0.65_0.18_260/0.6)] backdrop-blur [overflow-anchor:none] md:grid-cols-[1fr_220px]"
    >
      <div className="relative isolate aspect-[4/3] min-h-[220px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/40">
        {runId && state ? (
          <WorkflowGraph
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
      <aside className="relative z-10 flex min-h-[11.5rem] flex-col gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/95 p-3 font-mono text-[10.5px] leading-snug backdrop-blur-sm">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
          <span>trace</span>
          <span className="rounded bg-emerald-500/15 px-1 text-emerald-300">
            live
          </span>
        </div>
        {trace.length === 0 ? (
          <div className="text-[var(--color-muted-foreground)]">
            waiting for events…
          </div>
        ) : (
          trace.map((row) => (
            <div
              key={row.id}
              className="flex items-baseline justify-between gap-2 border-b border-dashed border-[var(--color-border)]/60 py-0.5 last:border-b-0"
            >
              <span className="truncate text-zinc-100">{row.label}</span>
              {row.meta ? (
                <span className="shrink-0 text-[var(--color-muted-foreground)]">
                  {row.meta}
                </span>
              ) : null}
            </div>
          ))
        )}
      </aside>
    </div>
  );
}

export default HeroLiveRun;
