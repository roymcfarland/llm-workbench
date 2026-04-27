import { useCallback, useEffect, useMemo, useState } from "react";
import type { SavedRunMeta } from "@llm-workbench/runtime";
import {
  MemoryRunRepository,
  SchemaRegistry,
  WorkbenchRuntime,
  buildForkStartInput,
  registerDemoSchemas,
} from "@llm-workbench/runtime";
import { WorkbenchShell } from "@llm-workbench/ui";
import { diffSummary } from "./diffJson.js";

const workflow = {
  id: "jobSearchWorkflow",
  version: 1,
  title: "Job search (pseudo)",
  steps: [
    { id: "parser1", gatePolicy: "PAUSE_BEFORE" as const, inputs: ["parserInputs"], outputs: ["compiledProfile"] },
    { id: "jobSearcher", gatePolicy: "PAUSE_AFTER" as const, inputs: ["compiledProfile"], outputs: ["potentialJobs"] },
    { id: "output", gatePolicy: "AUTO" as const, inputs: ["potentialJobs"], outputs: ["scoredResults"] },
  ],
  edges: [
    { id: "e1", from: "parser1", to: "jobSearcher" },
    { id: "e2", from: "jobSearcher", to: "output" },
  ],
};

const initialRuleSet = {
  id: "default",
  ruleSchemaId: "demoJobRule",
  rules: [
    { id: "r1", priority: 0, enabled: true, label: "Remote only", payload: { kind: "remote", value: "true" } },
    { id: "r2", priority: 1, enabled: true, label: "Ban keyword: unpaid", payload: { kind: "keyword", value: "unpaid" } },
  ],
};

export function App() {
  const registry = useMemo(() => {
    const r = new SchemaRegistry();
    registerDemoSchemas(r);
    return r;
  }, []);

  const runtime = useMemo(() => new WorkbenchRuntime(), []);
  const repo = useMemo(() => new MemoryRunRepository(), []);

  const [runId, setRunId] = useState<string>(() => {
    const { runId } = runtime.startRun({
      workflow,
      ruleSets: [initialRuleSet],
      initialArtifacts: [
        {
          artifact: {
            artifactKey: "parserInputs",
            typeId: "parserInputs",
            data: {
              resumeText: "Demo engineer with TypeScript experience.",
              profiles: [{ label: "GitHub", url: "https://example.com/u" }],
              portfolioUrls: ["https://example.com/p"],
            },
          },
        },
      ],
    });
    return runId;
  });

  const [savedRuns, setSavedRuns] = useState<SavedRunMeta[]>([]);
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");
  const [compareResult, setCompareResult] = useState<string>("");

  const refreshSaved = useCallback(async () => {
    setSavedRuns(await repo.list({ limit: 50 }));
  }, [repo]);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved, runId]);

  useEffect(() => {
    runtime.session(runId).requestGate({
      stepId: "parser1",
      gate: "PAUSE_BEFORE",
      reason: "Review inputs before compiling the profile artifact.",
    });
  }, [runId, runtime]);

  const session = useMemo(() => runtime.session(runId), [runtime, runId]);

  const pseudoParser = () => {
    session.resolveGate({ stepId: "parser1", gate: "PAUSE_BEFORE", decision: "approved" });
    session.beginStep("parser1");
    session.logModelIO({
      stepId: "parser1",
      direction: "request",
      summary: "Compile profile from inputs",
      detail: "full",
      payload: { prompt: "…", apiKey: "demo-secret-key" },
    });
    session.writeArtifact({
      artifactKey: "compiledProfile",
      typeId: "compiledProfile",
      data: {
        headline: "TypeScript engineer",
        skills: ["TypeScript", "React", "Node"],
        summary: "Builds reliable LLM-adjacent tooling.",
      },
    });
    session.logModelIO({ stepId: "parser1", direction: "response", summary: "Wrote compiledProfile" });
    session.completeStep("parser1");
  };

  const pseudoSearch = () => {
    session.beginStep("jobSearcher");
    session.logToolCall({
      stepId: "jobSearcher",
      name: "job_board.search",
      args: { q: "typescript" },
      result: { count: 2 },
    });
    session.writeArtifact({
      artifactKey: "potentialJobs",
      typeId: "potentialJobs",
      data: [
        { id: "j1", title: "Remote TS engineer", company: "Acme", url: "https://example.com/j1" },
        { id: "j2", title: "Unpaid internship (bad)", company: "BadCo", url: "https://example.com/j2" },
      ],
    });
    session.completeStep("jobSearcher");
  };

  const pseudoScore = () => {
    session.resolveGate({ stepId: "jobSearcher", gate: "PAUSE_AFTER", decision: "approved" });
    session.beginStep("output");
    session.writeArtifact({
      artifactKey: "scoredResults",
      typeId: "scoredResults",
      data: [
        { jobId: "j1", score: 0.92, reasons: ["remote", "keyword clean"] },
        { jobId: "j2", score: 0.05, reasons: ["keyword violation: unpaid"] },
      ],
    });
    session.completeStep("output");
  };

  const forkFromCurrent = () => {
    const parent = runtime.getState(runId);
    if (!parent) return;
    const { runId: next } = runtime.startRun(buildForkStartInput(parent, { tags: ["fork", "learning"] }));
    runtime.session(next).forkNotice(parent.run.id, "output");
    setRunId(next);
  };

  const loadRun = async (id: string) => {
    const loaded = await repo.load(id);
    if (!loaded) return;
    runtime.importState(loaded);
    setRunId(id);
  };

  const runCompare = async () => {
    if (!compareA || !compareB || compareA === compareB) {
      setCompareResult("Pick two distinct saved run ids.");
      return;
    }
    const sa = await repo.load(compareA);
    const sb = await repo.load(compareB);
    if (!sa || !sb) {
      setCompareResult("Could not load one or both runs from the memory repository.");
      return;
    }
    const artifactKey = "compiledProfile";
    const left = sa.artifactsByKey.get(artifactKey)?.data ?? null;
    const right = sb.artifactsByKey.get(artifactKey)?.data ?? null;
    const { equal, left: ls, right: rs } = diffSummary(left, right);
    setCompareResult(
      equal
        ? `compiledProfile is identical between runs (${compareA} vs ${compareB}).`
        : `compiledProfile differs.\n\nA (${compareA}):\n${ls}\n\nB (${compareB}):\n${rs}`,
    );
  };

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ color: "rgba(255,255,255,0.85)", marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>LLM workbench demo</div>
        <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>
          Pseudo pipeline with gates, persistence, fork, bundle import/export (full vs redacted), rule CRUD in the shell, and a toy compare of saved runs.
        </div>
      </div>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Saved runs (memory repo)</div>
          <button className="lwb-btn" type="button" onClick={() => void refreshSaved()}>
            Refresh list
          </button>
        </div>
        <div className="lwb-muted" style={{ fontSize: 12, marginBottom: 10 }}>
          Save from the workbench shell, then load a snapshot here. Compare uses the latest <code>compiledProfile</code> artifact in each saved run.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <select className="lwb-select" style={{ maxWidth: 360 }} value="" onChange={(e) => void loadRun(e.target.value)}>
            <option value="">Load saved run…</option>
            {savedRuns.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id} · {m.workflowId} · {m.startedAt}
              </option>
            ))}
          </select>
          <select className="lwb-select" style={{ maxWidth: 360 }} value={compareA} onChange={(e) => setCompareA(e.target.value)}>
            <option value="">Compare A…</option>
            {savedRuns.map((m) => (
              <option key={`a-${m.id}`} value={m.id}>
                {m.id}
              </option>
            ))}
          </select>
          <select className="lwb-select" style={{ maxWidth: 360 }} value={compareB} onChange={(e) => setCompareB(e.target.value)}>
            <option value="">Compare B…</option>
            {savedRuns.map((m) => (
              <option key={`b-${m.id}`} value={m.id}>
                {m.id}
              </option>
            ))}
          </select>
          <button className="lwb-btn lwb-btn--primary" type="button" onClick={() => void runCompare()}>
            Compare A vs B
          </button>
        </div>
        {compareResult ? (
          <pre
            style={{
              marginTop: 10,
              whiteSpace: "pre-wrap",
              fontSize: 11,
              lineHeight: 1.45,
              color: "rgba(255,255,255,0.85)",
              maxHeight: 240,
              overflow: "auto",
            }}
          >
            {compareResult}
          </pre>
        ) : null}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <button className="lwb-btn lwb-btn--primary" type="button" onClick={() => pseudoParser()}>
          Run parser1 (pseudo)
        </button>
        <button className="lwb-btn lwb-btn--primary" type="button" onClick={() => pseudoSearch()}>
          Run jobSearcher (pseudo)
        </button>
        <button className="lwb-btn lwb-btn--primary" type="button" onClick={() => pseudoScore()}>
          Approve + score (pseudo)
        </button>
        <button className="lwb-btn" type="button" onClick={() => void repo.save(runtime.getState(runId)!)}>
          Persist run (memory repo)
        </button>
        <button className="lwb-btn" type="button" onClick={() => forkFromCurrent()}>
          Fork new run from current snapshot
        </button>
      </div>

      <WorkbenchShell
        runtime={runtime}
        runId={runId}
        registry={registry}
        repo={repo}
        artifactKeys={["parserInputs", "compiledProfile", "potentialJobs", "scoredResults"]}
        ruleSetId="default"
        onActiveRunChange={(id) => setRunId(id)}
      />
    </div>
  );
}
