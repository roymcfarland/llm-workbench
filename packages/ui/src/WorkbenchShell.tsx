import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useWorkbenchRunRevision } from "@llm-workbench/adapters-react";
import {
  formatAjvErrors,
  type RuleRecord,
  type RuleSet,
  type RunRepository,
  type SchemaRegistry,
  type TraceEvent,
  WorkbenchError,
  type WorkbenchRuntime,
  type WorkbenchSession,
} from "@llm-workbench/runtime";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

const LazyMonacoArtifactEditor = lazy(() => import("./MonacoArtifactEditor.js"));

export type WorkbenchShellProps = {
  runtime: WorkbenchRuntime;
  runId: string;
  registry: SchemaRegistry;
  /** Optional persistence hook for "Save run" */
  repo?: RunRepository;
  /** Which artifacts appear in the editor dropdown */
  artifactKeys?: string[];
  /** Which rule set id to edit */
  ruleSetId?: string;
  /** Called after a successful bundle import selects a new active run id */
  onActiveRunChange?: (runId: string) => void;
  /**
   * Opt-in: render the artifact JSON editor with Monaco instead of a plain
   * textarea. Defaults to `false` so that consumers who don't need Monaco
   * don't pay the bundle / runtime cost.
   */
  useMonacoEditor?: boolean;
};

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

type RuleModalMode = { type: "create" } | { type: "edit"; rule: RuleRecord };

/**
 * Pure helper used by the rule reorder handler. Exported so unit tests can
 * verify the new ordering produced from a drag interaction without driving
 * @dnd-kit's keyboard sensor end-to-end (which is flaky in jsdom).
 */
export function computeReorderedRuleIds(
  currentIds: readonly string[],
  activeId: string,
  overId: string,
): string[] | null {
  if (activeId === overId) return null;
  const fromIdx = currentIds.indexOf(activeId);
  const toIdx = currentIds.indexOf(overId);
  if (fromIdx < 0 || toIdx < 0) return null;
  return arrayMove([...currentIds], fromIdx, toIdx);
}

/**
 * Build the callback wired into `<DndContext onDragEnd>` for the rule list.
 * Exposed so tests can pass a mock session and confirm `reorderRules` is
 * called with the expected `orderedRuleIds`.
 */
export function buildRuleReorderHandler(opts: {
  ruleSet: Pick<RuleSet, "id" | "rules"> | undefined;
  session: Pick<WorkbenchSession, "reorderRules"> | null;
}): (event: DragEndEvent) => void {
  return (event) => {
    const { active, over } = event;
    if (!over || !opts.ruleSet || !opts.session) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const currentIds = [...opts.ruleSet.rules]
      .sort((a, b) => a.priority - b.priority)
      .map((r) => r.id);
    const next = computeReorderedRuleIds(currentIds, activeId, overId);
    if (!next) return;
    opts.session.reorderRules({
      ruleSetId: opts.ruleSet.id,
      orderedRuleIds: next,
    });
  };
}

type SortableRuleRowProps = {
  rule: RuleRecord;
  onToggle: (rule: RuleRecord) => void;
  onEdit: (rule: RuleRecord) => void;
  onDelete: (ruleId: string) => void;
};

function SortableRuleRow(props: SortableRuleRowProps) {
  const { rule, onToggle, onEdit, onDelete } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const label = rule.label ?? rule.id;
  const summary = JSON.stringify(rule.payload);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`lwb-rule-row${isDragging ? " lwb-rule-row--dragging" : ""}`}
      aria-label={`Rule ${label}`}
      data-rule-id={rule.id}
    >
      <button
        type="button"
        className="lwb-rule-row__grip"
        aria-label={`Drag to reorder rule ${label}. Press space or enter to lift, arrow keys to move, space or enter to drop, escape to cancel.`}
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <div className="lwb-rule-row__main">
        <div className="lwb-rule-row__title">{label}</div>
        <div className="lwb-rule-row__sub">{summary}</div>
      </div>
      <div className="lwb-rule-row__actions">
        <button
          type="button"
          className="lwb-icon-btn"
          onClick={() => onToggle(rule)}
          title={rule.enabled ? "Disable rule" : "Enable rule"}
          aria-pressed={rule.enabled}
        >
          {rule.enabled ? "✓" : "○"}
        </button>
        <button
          type="button"
          className="lwb-icon-btn"
          onClick={() => onEdit(rule)}
          title="Edit rule"
          aria-label={`Edit rule ${label}`}
        >
          ✎
        </button>
        <button
          type="button"
          className="lwb-icon-btn"
          onClick={() => onDelete(rule.id)}
          title="Delete rule"
          aria-label={`Delete rule ${label}`}
        >
          ×
        </button>
      </div>
    </div>
  );
}

type TraceListProps = {
  trace: TraceEvent[];
  workflowTitle: string;
};

function TraceList({ trace, workflowTitle }: TraceListProps) {
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

export function WorkbenchShell(props: WorkbenchShellProps) {
  const {
    runtime,
    runId,
    registry,
    repo,
    ruleSetId = "default",
    onActiveRunChange,
    useMonacoEditor = false,
  } = props;
  const revision = useWorkbenchRunRevision(runtime, runId);
  const state = runId ? runtime.getState(runId) : undefined;
  void revision;

  const session = useMemo(() => {
    if (!runId) return null;
    return runtime.session(runId);
  }, [runtime, runId]);

  const artifactKeys = useMemo(() => {
    if (props.artifactKeys?.length) return props.artifactKeys;
    return state ? [...state.artifactsByKey.keys()].sort() : [];
  }, [props.artifactKeys, state]);

  const [selectedArtifactKey, setSelectedArtifactKey] = useState<string>("");
  const selectedArtifact =
    state && selectedArtifactKey ? state.artifactsByKey.get(selectedArtifactKey) : undefined;

  const [draftJson, setDraftJson] = useState<string>("{}");
  const [error, setError] = useState<string | null>(null);

  const [exportProfile, setExportProfile] = useState<"full" | "user">("full");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [ruleModal, setRuleModal] = useState<RuleModalMode | null>(null);
  const [ruleLabel, setRuleLabel] = useState("");
  const [rulePayloadJson, setRulePayloadJson] = useState<string>("{}");
  const [ruleError, setRuleError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedArtifact) return;
    setDraftJson(JSON.stringify(selectedArtifact.data ?? {}, null, 2));
  }, [selectedArtifact, selectedArtifactKey]);

  const ruleSet: RuleSet | undefined = state?.ruleSetsById.get(ruleSetId);

  useEffect(() => {
    if (!ruleModal) return;
    if (ruleModal.type === "create") {
      setRuleLabel("");
      setRulePayloadJson(JSON.stringify({ kind: "keyword", value: "" }, null, 2));
    } else {
      setRuleLabel(ruleModal.rule.label ?? "");
      setRulePayloadJson(JSON.stringify(ruleModal.rule.payload ?? {}, null, 2));
    }
    setRuleError(null);
  }, [ruleModal]);

  const applyArtifact = useCallback(() => {
    if (!session || !selectedArtifactKey) return;
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(draftJson);
    } catch {
      setError("Artifact JSON is invalid.");
      return;
    }
    const typeId = selectedArtifact?.typeId ?? "unknown";
    const v = registry.validateArtifact(typeId, parsed);
    if (!v.ok) {
      setError(formatAjvErrors(v.errors));
      return;
    }
    session.writeArtifact({ artifactKey: selectedArtifactKey, typeId, data: parsed });
  }, [draftJson, registry, selectedArtifact?.typeId, selectedArtifactKey, session]);

  const downloadBundle = useCallback(async () => {
    if (!session) return;
    const bundle = await session.exportRunBundle(
      exportProfile === "user"
        ? { profile: "user", registry, includeEngine: false }
        : { profile: "full", includeEngine: true },
    );
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `run-${session.runId}.${exportProfile}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportProfile, registry, session]);

  const onPickImportFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const text = await file.text();
      try {
        const { runId: imported } = await runtime.importRunBundle({
          json: text,
          verifyIntegrity: true,
        });
        onActiveRunChange?.(imported);
      } catch (e) {
        const msg = WorkbenchError.is(e)
          ? `${e.code}: ${e.message}`
          : e instanceof Error
          ? e.message
          : String(e);
        setError(`Import failed: ${msg}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [onActiveRunChange, runtime],
  );

  const saveRun = useCallback(async () => {
    if (!repo || !state) return;
    await repo.save(state);
  }, [repo, state]);

  const sortedRules = useMemo(() => {
    if (!ruleSet) return [];
    return [...ruleSet.rules].sort((a, b) => a.priority - b.priority);
  }, [ruleSet]);

  const sortableIds = useMemo(() => sortedRules.map((r) => r.id), [sortedRules]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = useMemo(
    () => buildRuleReorderHandler({ ruleSet, session }),
    [ruleSet, session],
  );

  const toggleRule = useCallback(
    (rule: RuleRecord) => {
      if (!session || !ruleSet) return;
      const nextRules = ruleSet.rules.map((r) =>
        r.id === rule.id ? { ...r, enabled: !r.enabled } : r,
      );
      session.replaceRuleSet({ ...ruleSet, rules: nextRules });
    },
    [ruleSet, session],
  );

  const deleteRule = useCallback(
    (ruleId: string) => {
      if (!session || !ruleSet) return;
      const nextRules = ruleSet.rules
        .filter((r) => r.id !== ruleId)
        .map((r, idx) => ({ ...r, priority: idx }));
      session.replaceRuleSet({ ...ruleSet, rules: nextRules });
    },
    [ruleSet, session],
  );

  const editRule = useCallback((rule: RuleRecord) => {
    setRuleModal({ type: "edit", rule });
  }, []);

  const commitRuleModal = useCallback(() => {
    if (!session || !ruleSet || !ruleModal) return;
    setRuleError(null);
    let payload: unknown;
    try {
      payload = JSON.parse(rulePayloadJson);
    } catch {
      setRuleError("Rule payload JSON is invalid.");
      return;
    }
    const v = registry.validateRulePayload(ruleSet.ruleSchemaId, payload);
    if (!v.ok) {
      setRuleError(formatAjvErrors(v.errors));
      return;
    }

    if (ruleModal.type === "create") {
      const id =
        typeof globalThis.crypto?.randomUUID === "function"
          ? globalThis.crypto.randomUUID()
          : `rule_${Date.now().toString(36)}`;
      const priority = ruleSet.rules.length
        ? Math.max(...ruleSet.rules.map((r) => r.priority)) + 1
        : 0;
      const nextRules = [
        ...ruleSet.rules,
        { id, priority, enabled: true, label: ruleLabel || id, payload },
      ];
      session.replaceRuleSet({ ...ruleSet, rules: nextRules });
    } else {
      const nextRules = ruleSet.rules.map((r) =>
        r.id === ruleModal.rule.id ? { ...r, label: ruleLabel || r.label, payload } : r,
      );
      session.replaceRuleSet({ ...ruleSet, rules: nextRules });
    }
    setRuleModal(null);
  }, [registry, ruleLabel, ruleModal, rulePayloadJson, ruleSet, session]);

  if (!session || !state) {
    return (
      <div className="lwb-root">
        <div className="lwb-workbench lwb-muted" style={{ padding: 12 }}>
          No active run.
        </div>
      </div>
    );
  }

  const trace = state.trace;
  const workflowTitle = state.run.workflowSnapshot.title ?? state.run.workflowSnapshot.id;

  return (
    <div className="lwb-root lwb-workbench">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(e) => void onPickImportFile(e.target.files?.[0] ?? null)}
      />

      <div className="lwb-workbench__header">
        <div className="lwb-workbench__title">LLM workbench</div>
        <div className="lwb-btn-row lwb-btn-row--end">
          <label className="lwb-muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            Export
            <select
              className="lwb-select"
              value={exportProfile}
              onChange={(e) => setExportProfile(e.target.value as "full" | "user")}
            >
              <option value="full">full (engineering)</option>
              <option value="user">user (redacted)</option>
            </select>
          </label>
          <button type="button" className="lwb-btn lwb-btn--primary" onClick={() => void downloadBundle()}>
            Download run bundle
          </button>
          <button type="button" className="lwb-btn" onClick={() => fileInputRef.current?.click()}>
            Import run bundle
          </button>
          <button type="button" className="lwb-btn" disabled={!repo} onClick={() => void saveRun()}>
            Save run
          </button>
        </div>
      </div>

      <div className="lwb-workbench__grid">
        <div className="lwb-workbench__panel">
          <div className="lwb-workbench__panel-header">
            <span>Inputs &amp; artifacts</span>
            <span className="lwb-pill">rev {state.revision}</span>
          </div>
          <div className="lwb-workbench__panel-body">
            <div className="lwb-muted" style={{ marginBottom: 8 }}>
              Select an artifact, edit JSON, validate against the registered schema, then write.
            </div>
            <select
              className="lwb-select"
              value={selectedArtifactKey}
              onChange={(e) => setSelectedArtifactKey(e.target.value)}
              aria-label="Select artifact to edit"
            >
              <option value="">Select artifact…</option>
              {artifactKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <div className="lwb-stack-sm" />
            {useMonacoEditor ? (
              <Suspense
                fallback={
                  <div className="lwb-monaco-fallback" role="status" aria-live="polite">
                    Loading editor…
                  </div>
                }
              >
                <LazyMonacoArtifactEditor
                  value={draftJson}
                  onChange={setDraftJson}
                  ariaLabel="Artifact JSON editor"
                />
              </Suspense>
            ) : (
              <textarea
                className="lwb-textarea"
                value={draftJson}
                onChange={(e) => setDraftJson(e.target.value)}
                spellCheck={false}
                aria-label="Artifact JSON"
              />
            )}
            <div className="lwb-stack-sm" />
            <div className="lwb-btn-row">
              <button
                type="button"
                className="lwb-btn lwb-btn--primary"
                disabled={!selectedArtifactKey}
                onClick={() => void applyArtifact()}
              >
                Write artifact
              </button>
            </div>
            {error ? <div className="lwb-error">{error}</div> : null}
          </div>
        </div>

        <div className="lwb-workbench__panel">
          <div className="lwb-workbench__panel-header">
            <span>Rules</span>
            <span className="lwb-btn-row">
              <span className="lwb-pill">{ruleSet ? `${ruleSet.rules.length} rules` : "no ruleset"}</span>
              <button
                type="button"
                className="lwb-btn lwb-btn--primary"
                disabled={!ruleSet}
                onClick={() => setRuleModal({ type: "create" })}
              >
                Add rule
              </button>
            </span>
          </div>
          <div className="lwb-workbench__panel-body">
            {!ruleSet ? (
              <div className="lwb-muted">No rule set loaded for id `{ruleSetId}`.</div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  <div className="lwb-rule-list" role="list" aria-label="Rule list">
                    {sortedRules.map((r) => (
                      <SortableRuleRow
                        key={r.id}
                        rule={r}
                        onToggle={toggleRule}
                        onEdit={editRule}
                        onDelete={deleteRule}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        <div className="lwb-workbench__panel" style={{ gridColumn: "1 / -1" }}>
          <div className="lwb-workbench__panel-header">
            <span>Live trace</span>
            <span className="lwb-muted">
              {trace.length} event{trace.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="lwb-workbench__panel-body">
            <TraceList trace={trace} workflowTitle={workflowTitle} />
          </div>
        </div>
      </div>

      {ruleModal && ruleSet ? (
        <div className="lwb-modal" role="dialog" aria-modal="true" aria-label="Edit rule">
          <div className="lwb-modal__backdrop" onClick={() => setRuleModal(null)} />
          <div className="lwb-modal__card">
            <div className="lwb-modal__title">
              {ruleModal.type === "create" ? "Add rule" : "Edit rule"}
            </div>
            <div className="lwb-muted" style={{ marginBottom: 10 }}>
              Payload must validate against schema <code>{ruleSet.ruleSchemaId}</code>.
            </div>
            <label className="lwb-muted" style={{ display: "block", marginBottom: 6 }}>
              Label
            </label>
            <input
              className="lwb-input"
              value={ruleLabel}
              onChange={(e) => setRuleLabel(e.target.value)}
            />
            <div className="lwb-stack-sm" />
            <label className="lwb-muted" style={{ display: "block", marginBottom: 6 }}>
              Payload JSON
            </label>
            <textarea
              className="lwb-textarea"
              style={{ minHeight: 160 }}
              value={rulePayloadJson}
              onChange={(e) => setRulePayloadJson(e.target.value)}
              spellCheck={false}
            />
            {ruleError ? <div className="lwb-error">{ruleError}</div> : null}
            <div className="lwb-btn-row" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="lwb-btn lwb-btn--primary"
                onClick={() => void commitRuleModal()}
              >
                Save rule
              </button>
              <button type="button" className="lwb-btn" onClick={() => setRuleModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
