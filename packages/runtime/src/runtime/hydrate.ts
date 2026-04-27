import { WorkbenchError } from "../errors.js";
import type { RunBundleEngine } from "../protocol/engine.js";
import type { RunBundle } from "../protocol/run.js";
import type { TraceEvent } from "../protocol/trace.js";
import type { WorkflowSpec } from "../protocol/workflow.js";
import type { ArtifactVersion } from "../protocol/artifacts.js";
import type { RuleSet } from "../protocol/rules.js";
import type { RunInstance } from "../protocol/run.js";
import { assertRunBundleStructuralInvariants } from "../protocol/runValidate.js";
import { initialGateState } from "./gates.js";
import type { RunStoreState, StepRuntimeStatus } from "./types.js";
import type { StepGateState } from "./gates.js";

export function serializeEngineFromState(state: RunStoreState): RunBundleEngine {
  return {
    revision: state.revision,
    stepStatus: [...state.stepStatus.entries()],
    gateState: [...state.gateState.entries()].map(([stepId, gs]) => [
      stepId,
      { before: gs.before, after: gs.after, checkpoints: { ...gs.checkpoints } },
    ]),
    idempotency: [...state.idempotency.entries()],
  };
}

export function deserializeEngineToMaps(engine: RunBundleEngine): {
  revision: number;
  stepStatus: Map<string, StepRuntimeStatus>;
  gateState: Map<string, StepGateState>;
  idempotency: Map<string, { artifactKey: string; version: number }>;
} {
  return {
    revision: engine.revision,
    stepStatus: new Map(engine.stepStatus),
    gateState: new Map(
      engine.gateState.map((entry: RunBundleEngine["gateState"][number]) => {
        const [stepId, gs] = entry;
        return [stepId, { before: gs.before, after: gs.after, checkpoints: { ...gs.checkpoints } }] as const;
      }),
    ),
    idempotency: new Map(engine.idempotency),
  };
}

export function inferEngineFromTrace(workflow: WorkflowSpec, trace: TraceEvent[]): RunBundleEngine {
  const stepStatus = new Map<string, StepRuntimeStatus>();
  const gateState = new Map<string, StepGateState>();
  for (const s of workflow.steps) {
    stepStatus.set(s.id, "pending");
    gateState.set(s.id, initialGateState(s.gatePolicy));
  }

  const knownStepIds = new Set(workflow.steps.map((s) => s.id));
  const requireKnownStep = (eventId: string, stepId: string) => {
    if (!knownStepIds.has(stepId)) {
      throw new WorkbenchError(
        "INVALID_RUN_BUNDLE",
        `Trace event "${eventId}" references unknown workflow step "${stepId}"`,
      );
    }
  };

  for (const ev of trace) {
    if (ev.type === "step_started") {
      requireKnownStep(ev.id, ev.stepId);
      stepStatus.set(ev.stepId, "running");
    }
    if (ev.type === "step_completed") {
      requireKnownStep(ev.id, ev.stepId);
      stepStatus.set(ev.stepId, ev.ok ? "completed" : "failed");
      if (ev.ok) {
        const step = workflow.steps.find((x) => x.id === ev.stepId);
        const gs = gateState.get(ev.stepId);
        if (step && gs && (step.gatePolicy === "PAUSE_AFTER" || step.gatePolicy === "CHECKPOINT")) {
          gs.after = "pending";
        }
      }
    }
    if (ev.type === "human_gate_resolved") {
      requireKnownStep(ev.id, ev.stepId);
      const gs = gateState.get(ev.stepId);
      if (!gs) continue;
      if (ev.gate === "PAUSE_BEFORE" && ev.decision !== "rejected") gs.before = "approved";
      if (ev.gate === "PAUSE_AFTER" && ev.decision !== "rejected") gs.after = "approved";
      if (ev.gate === "CHECKPOINT") {
        if (ev.note) gs.checkpoints[ev.note] = ev.decision === "rejected" ? "pending" : "approved";
        else if (ev.decision !== "rejected") gs.before = "approved";
      }
    }
  }

  return {
    revision: trace.length,
    stepStatus: [...stepStatus.entries()],
    gateState: [...gateState.entries()].map(([stepId, gs]) => [
      stepId,
      { before: gs.before, after: gs.after, checkpoints: { ...gs.checkpoints } },
    ]),
    idempotency: [],
  };
}

function latestArtifacts(artifacts: ArtifactVersion[]): Map<string, ArtifactVersion> {
  const m = new Map<string, ArtifactVersion>();
  for (const a of artifacts) {
    const prev = m.get(a.artifactKey);
    if (!prev || a.version > prev.version) m.set(a.artifactKey, a);
  }
  return m;
}

function latestRuleSets(ruleSets: RuleSet[]): Map<string, RuleSet> {
  const m = new Map<string, RuleSet>();
  for (const rs of ruleSets) m.set(rs.id, rs);
  return m;
}

export function runStoreStateFromBundle(bundle: RunBundle): RunStoreState {
  assertRunBundleStructuralInvariants(bundle);
  const run: RunInstance = bundle.run;
  const workflow = run.workflowSnapshot;
  const engine = bundle.engine ?? inferEngineFromTrace(workflow, bundle.trace);
  const maps = deserializeEngineToMaps(engine);
  for (const s of workflow.steps) {
    if (!maps.stepStatus.has(s.id)) maps.stepStatus.set(s.id, "pending");
    if (!maps.gateState.has(s.id)) maps.gateState.set(s.id, initialGateState(s.gatePolicy));
  }

  return {
    revision: maps.revision,
    run,
    trace: [...bundle.trace],
    artifactsByKey: latestArtifacts(bundle.artifacts),
    ruleSetsById: latestRuleSets(bundle.ruleSets),
    stepStatus: maps.stepStatus,
    gateState: maps.gateState,
    idempotency: maps.idempotency,
  };
}
