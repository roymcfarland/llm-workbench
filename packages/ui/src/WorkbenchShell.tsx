import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useWorkbenchRunRevision } from "@llm-workbench/adapters-react";
import {
  formatAjvErrors,
  type RuleRecord,
  type RuleSet,
  type RunRepository,
  type SchemaRegistry,
  WorkbenchError,
  type WorkbenchRuntime,
} from "@llm-workbench/runtime";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildRuleReorderHandler, SortableRuleRow, type RuleModalMode } from "./WorkbenchRules.js";
import { TraceList } from "./WorkbenchTrace.js";

const LazyMonacoArtifactEditor = lazy(() => import("./MonacoArtifactEditor.js"));

export type WorkbenchShellProps = {
  /** Runtime used to read the selected run's state and session. */
  runtime: WorkbenchRuntime;
  /** Run to display; a falsy id leaves state undefined and session null. */
  runId: string;
  /** Schemas used to validate edited artifact and rule payload JSON. */
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

/**
 * Render the full run control surface: artifact editing, rule management, and
 * the live trace timeline. Set {@link WorkbenchShellProps.useMonacoEditor} to
 * opt into the Monaco-based artifact editor.
 */
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
