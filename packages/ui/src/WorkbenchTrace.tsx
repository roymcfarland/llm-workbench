import type { TraceEvent } from "@llm-workbench/runtime";
import { useLayoutEffect, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

const VIRTUALIZE_TRACE_THRESHOLD = 100;

function summarizeEvent(e: TraceEvent): string {
  switch (e.type) {
    case "step_started":
      return `step_started: ${e.stepId}`;
    case "step_completed":
      return `step_completed: ${e.stepId} ok=${String(e.ok)}`;
    case "artifact_written":
      return `artifact_written: ${e.artifact.artifactKey}`;
    case "artifact_patch":
      return `artifact_patch: ${e.artifactKey}`;
    case "model_io":
      return `model_io: ${e.direction} ${e.model ?? ""}`.trim();
    case "human_gate_requested":
      return `gate_requested: ${e.stepId} ${e.gate}`;
    case "human_gate_resolved":
      return `gate_resolved: ${e.stepId} ${e.decision}`;
    case "rule_changed":
      return `rule_changed: ${e.ruleSetId}`;
    case "run_status_changed":
      return `run_status_changed: ${e.status}`;
    default:
      return e.type;
  }
}

type TraceListProps = {
  trace: TraceEvent[];
  workflowTitle: string;
};

export function TraceList({ trace, workflowTitle }: TraceListProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const simpleRef = useRef<HTMLDivElement | null>(null);

  const useVirtuoso = trace.length > VIRTUALIZE_TRACE_THRESHOLD;

  // Keep the latest event pinned when auto-scroll is on and new events arrive.
  useLayoutEffect(() => {
    if (!autoScroll || trace.length === 0) return;
    if (useVirtuoso) {
      virtuosoRef.current?.scrollToIndex({
        index: trace.length - 1,
        align: "end",
      });
    } else if (simpleRef.current) {
      simpleRef.current.scrollTop = simpleRef.current.scrollHeight;
    }
  }, [autoScroll, trace.length, useVirtuoso]);

  return (
    <>
      <div className="lwb-timeline__toolbar">
        <span aria-hidden="true">{workflowTitle}</span>
        <label
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          title="When enabled, the trace stays pinned to the most recent event."
        >
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            aria-label="Auto-scroll to latest trace event"
          />
          Auto-scroll to latest
        </label>
      </div>
      {useVirtuoso ? (
        <Virtuoso
          ref={virtuosoRef}
          className="lwb-timeline__virtual"
          totalCount={trace.length}
          followOutput={autoScroll ? "smooth" : false}
          atBottomStateChange={(atBottom) => {
            if (!atBottom && autoScroll) setAutoScroll(false);
          }}
          itemContent={(index) => {
            const event = trace[index];
            if (!event) return null;
            return <TraceRow event={event} />;
          }}
        />
      ) : (
        <div
          ref={simpleRef}
          className="lwb-timeline"
          onScroll={(e) => {
            const el = e.currentTarget;
            const atBottom =
              el.scrollHeight - el.scrollTop - el.clientHeight < 16;
            if (!atBottom && autoScroll) setAutoScroll(false);
          }}
        >
          {trace.map((e) => (
            <TraceRow key={e.id} event={e} />
          ))}
        </div>
      )}
    </>
  );
}

function TraceRow({ event }: { event: TraceEvent }) {
  return (
    <div className="lwb-trace-row" data-event-id={event.id}>
      <div className="lwb-trace-row__top">
        <span>{event.ts}</span>
        <span className="lwb-pill">{event.type}</span>
      </div>
      <div className="lwb-trace-row__body">{summarizeEvent(event)}</div>
    </div>
  );
}
