import {
  formatAjvErrors,
  type RuleRecord,
  type RuleSet,
  type RunRepository,
  type SchemaRegistry,
  type TraceEvent,
  WorkbenchError,
  type WorkbenchRuntime,
} from "@llm-workbench/runtime";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

export type WorkbenchShellProps = {
  runtime: WorkbenchRuntime;
  runId: string;
  registry: SchemaRegistry;
  /** Optional persistence hook for “Save run” */
  repo?: RunRepository;
  /** Which artifacts appear in the editor dropdown */
  artifactKeys?: string[];
  /** Which rule set id to edit */
  ruleSetId?: string;
  /** Called after a successful bundle import selects a new active run id */
  onActiveRunChange?: (runId: string) => void;
};

function useRunRevision(runtime: WorkbenchRuntime, runId: string | null) {
  return useSyncExternalStore(
    (cb) => {
      if (!runId) return () => {};
      return runtime.subscribe(runId, cb);
    },
    () => (runId ? (runtime.getState(runId)?.revision ?? -1) : -1),
    () => -1,
  );
}

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

export function WorkbenchShell(props: WorkbenchShellProps) {
  const { runtime, runId, registry, repo, ruleSetId = "default", onActiveRunChange } = props;
  const revision = useRunRevision(runtime, runId);
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
  const selectedArtifact = state && selectedArtifactKey ? state.artifactsByKey.get(selectedArtifactKey) : undefined;

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
        const { runId: imported } = await runtime.importRunBundle({ json: text, verifyIntegrity: true });
        onActiveRunChange?.(imported);
      } catch (e) {
        const msg = WorkbenchError.is(e) ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : String(e);
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

  const [dragId, setDragId] = useState<string | null>(null);

  const moveRule = useCallback(
    (ruleId: string, dir: -1 | 1) => {
      if (!session || !ruleSet) return;
      const ids = [...ruleSet.rules].sort((a, b) => a.priority - b.priority).map((r) => r.id);
      const idx = ids.indexOf(ruleId);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= ids.length) return;
      const swapped = [...ids];
      const t = swapped[idx]!;
      swapped[idx] = swapped[j]!;
      swapped[j] = t;
      session.reorderRules({ ruleSetId: ruleSet.id, orderedRuleIds: swapped });
    },
    [ruleSet, session],
  );

  const toggleRule = useCallback(
    (rule: RuleRecord) => {
      if (!session || !ruleSet) return;
      const nextRules = ruleSet.rules.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
      session.replaceRuleSet({ ...ruleSet, rules: nextRules });
    },
    [ruleSet, session],
  );

  const deleteRule = useCallback(
    (ruleId: string) => {
      if (!session || !ruleSet) return;
      const nextRules = ruleSet.rules.filter((r) => r.id !== ruleId).map((r, idx) => ({ ...r, priority: idx }));
      session.replaceRuleSet({ ...ruleSet, rules: nextRules });
    },
    [ruleSet, session],
  );

  const onDropReorder = useCallback(
    (targetRuleId: string) => {
      if (!session || !ruleSet || !dragId || dragId === targetRuleId) return;
      const ids = [...ruleSet.rules].sort((a, b) => a.priority - b.priority).map((r) => r.id);
      const from = ids.indexOf(dragId);
      const to = ids.indexOf(targetRuleId);
      if (from < 0 || to < 0) return;
      const next = [...ids];
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      session.reorderRules({ ruleSetId: ruleSet.id, orderedRuleIds: next });
      setDragId(null);
    },
    [dragId, ruleSet, session],
  );

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
      const priority = ruleSet.rules.length ? Math.max(...ruleSet.rules.map((r) => r.priority)) + 1 : 0;
      const nextRules = [...ruleSet.rules, { id, priority, enabled: true, label: ruleLabel || id, payload }];
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
    return <div className="wb wb__muted">No active run.</div>;
  }

  const trace = [...state.trace].slice(-80).reverse();

  return (
    <div className="wb">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(e) => void onPickImportFile(e.target.files?.[0] ?? null)}
      />

      <div className="wb__header">
        <div className="wb__title">LLM workbench</div>
        <div className="wb__btnRow" style={{ justifyContent: "flex-end" }}>
          <label className="wb__muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            Export
            <select className="wb__select" value={exportProfile} onChange={(e) => setExportProfile(e.target.value as "full" | "user")}>
              <option value="full">full (engineering)</option>
              <option value="user">user (redacted)</option>
            </select>
          </label>
          <button type="button" className="wb__btn wb__btn--primary" onClick={() => void downloadBundle()}>
            Download run bundle
          </button>
          <button type="button" className="wb__btn" onClick={() => fileInputRef.current?.click()}>
            Import run bundle
          </button>
          <button type="button" className="wb__btn" disabled={!repo} onClick={() => void saveRun()}>
            Save run
          </button>
        </div>
      </div>

      <div className="wb__grid">
        <div className="wb__panel">
          <div className="wb__panelHeader">
            <span>Inputs & artifacts</span>
            <span className="wb__pill">rev {state.revision}</span>
          </div>
          <div className="wb__panelBody">
            <div className="wb__muted" style={{ marginBottom: 8 }}>
              Select an artifact, edit JSON, validate against the registered schema, then write.
            </div>
            <select className="wb__select" value={selectedArtifactKey} onChange={(e) => setSelectedArtifactKey(e.target.value)}>
              <option value="">Select artifact…</option>
              {artifactKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <div style={{ height: 10 }} />
            <textarea className="wb__textarea" value={draftJson} onChange={(e) => setDraftJson(e.target.value)} spellCheck={false} />
            <div style={{ height: 10 }} />
            <div className="wb__btnRow">
              <button type="button" className="wb__btn wb__btn--primary" disabled={!selectedArtifactKey} onClick={() => void applyArtifact()}>
                Write artifact
              </button>
            </div>
            {error ? (
              <div style={{ marginTop: 10, color: "var(--wb-danger)", fontSize: 12 }}>
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <div className="wb__panel">
          <div className="wb__panelHeader">
            <span>Rules</span>
            <span className="wb__btnRow">
              <span className="wb__pill">{ruleSet ? `${ruleSet.rules.length} rules` : "no ruleset"}</span>
              <button type="button" className="wb__btn wb__btn--primary" disabled={!ruleSet} onClick={() => setRuleModal({ type: "create" })}>
                Add rule
              </button>
            </span>
          </div>
          <div className="wb__panelBody">
            {!ruleSet ? (
              <div className="wb__muted">No rule set loaded for id `{ruleSetId}`.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...ruleSet.rules]
                  .sort((a, b) => a.priority - b.priority)
                  .map((r) => (
                    <div
                      key={r.id}
                      className="wb__ruleRow"
                      draggable
                      onDragStart={() => setDragId(r.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDropReorder(r.id)}
                    >
                      <div className="wb__ruleGrip" title="Drag to reorder">
                        ::
                      </div>
                      <div className="wb__ruleMain">
                        <div className="wb__ruleTitle">{r.label ?? r.id}</div>
                        <div className="wb__ruleSub">{JSON.stringify(r.payload)}</div>
                      </div>
                      <div className="wb__ruleActions">
                        <button type="button" className="wb__iconBtn" onClick={() => moveRule(r.id, -1)} title="Move up">
                          ↑
                        </button>
                        <button type="button" className="wb__iconBtn" onClick={() => moveRule(r.id, 1)} title="Move down">
                          ↓
                        </button>
                        <button type="button" className="wb__iconBtn" onClick={() => toggleRule(r)} title="Toggle enabled">
                          {r.enabled ? "✓" : "○"}
                        </button>
                        <button type="button" className="wb__iconBtn" onClick={() => setRuleModal({ type: "edit", rule: r })} title="Edit">
                          ✎
                        </button>
                        <button type="button" className="wb__iconBtn" onClick={() => deleteRule(r.id)} title="Delete">
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="wb__panel" style={{ gridColumn: "1 / -1" }}>
          <div className="wb__panelHeader">
            <span>Live trace</span>
            <span className="wb__muted">{state.run.workflowSnapshot.title ?? state.run.workflowSnapshot.id}</span>
          </div>
          <div className="wb__panelBody">
            <div className="wb__timeline">
              {trace.map((e) => (
                <div key={e.id} className="wb__event">
                  <div className="wb__eventTop">
                    <span>{e.ts}</span>
                    <span className="wb__pill">{e.type}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12 }}>{summarizeEvent(e)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {ruleModal && ruleSet ? (
        <div className="wbModal" role="dialog" aria-modal="true">
          <div className="wbModal__backdrop" onClick={() => setRuleModal(null)} />
          <div className="wbModal__card">
            <div className="wbModal__title">{ruleModal.type === "create" ? "Add rule" : "Edit rule"}</div>
            <div className="wb__muted" style={{ marginBottom: 10 }}>
              Payload must validate against schema <code>{ruleSet.ruleSchemaId}</code>.
            </div>
            <label className="wb__muted" style={{ display: "block", marginBottom: 6 }}>
              Label
            </label>
            <input className="wb__select" value={ruleLabel} onChange={(e) => setRuleLabel(e.target.value)} />
            <div style={{ height: 10 }} />
            <label className="wb__muted" style={{ display: "block", marginBottom: 6 }}>
              Payload JSON
            </label>
            <textarea className="wb__textarea" style={{ minHeight: 160 }} value={rulePayloadJson} onChange={(e) => setRulePayloadJson(e.target.value)} spellCheck={false} />
            {ruleError ? (
              <div style={{ marginTop: 10, color: "var(--wb-danger)", fontSize: 12 }}>
                {ruleError}
              </div>
            ) : null}
            <div className="wb__btnRow" style={{ marginTop: 12 }}>
              <button type="button" className="wb__btn wb__btn--primary" onClick={() => void commitRuleModal()}>
                Save rule
              </button>
              <button type="button" className="wb__btn" onClick={() => setRuleModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
