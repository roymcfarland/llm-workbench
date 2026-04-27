import type { ArtifactVersion } from "../protocol/artifacts.js";
import type { RunContextRef } from "../protocol/run.js";
import type { StartRunInput } from "../runtime/types.js";
import type { RunStoreState } from "../runtime/types.js";

/**
 * Build a {@link StartRunInput} that forks from a single parent run, copying
 * the parent's workflow snapshot, artifacts, and rule sets, and stamping a
 * `RunContextRef` that records the parent linkage in both legacy singular
 * (`parentRunId`) and plural (`parentRunIds`) form so downstream tooling can
 * treat the result uniformly with multi-parent agent runs.
 */
export function buildForkStartInput(
  parent: RunStoreState,
  opts?: { tags?: string[]; forkedFromStepId?: string },
): StartRunInput {
  const workflow = parent.run.workflowSnapshot;
  const initialArtifacts = [...parent.artifactsByKey.values()].map((a) => ({
    artifact: {
      artifactKey: a.artifactKey,
      typeId: a.typeId,
      data: a.data,
      pointer: a.pointer,
    } satisfies Omit<ArtifactVersion, "version" | "createdAt">,
  }));

  const context: RunContextRef = {
    parentRunId: parent.run.id,
    parentRunIds: [parent.run.id],
    forkedFromStepId: opts?.forkedFromStepId,
  };

  return {
    workflow,
    initialArtifacts,
    ruleSets: [...parent.ruleSetsById.values()],
    context,
    subject: parent.run.subject,
    metadata: parent.run.metadata,
    tags: opts?.tags ?? [...(parent.run.tags ?? []), "fork"],
  };
}

/**
 * Build a {@link StartRunInput} for an agent-of-agents / supervisor child
 * run that has multiple supervising parents. Unlike {@link buildForkStartInput}
 * this does **not** copy parent artifacts or rules — supervisors usually want
 * to compose context explicitly. Pass `inheritArtifactsFrom` to optionally
 * pull initial artifacts from one chosen parent.
 *
 * Designed for the agent-of-agents pattern (planner + research worker
 * coordinating on shared state) where the child needs to record more than
 * one supervising parent for cancellation cascades and trace cross-linking.
 *
 * The resulting `RunContextRef.parentRunId` is set to `parents[0].run.id`
 * for legacy readers; `parentRunIds` carries the full ordered list.
 */
export function buildAgentChildStartInput(input: {
  parents: readonly RunStoreState[];
  workflow: StartRunInput["workflow"];
  inheritArtifactsFrom?: RunStoreState;
  inheritRulesFrom?: RunStoreState;
  tags?: string[];
  metadata?: StartRunInput["metadata"];
  subject?: StartRunInput["subject"];
}): StartRunInput {
  if (input.parents.length === 0) {
    throw new Error("buildAgentChildStartInput: parents must not be empty");
  }
  const parentIds = input.parents.map((p) => p.run.id);
  const initialArtifacts = input.inheritArtifactsFrom
    ? [...input.inheritArtifactsFrom.artifactsByKey.values()].map((a) => ({
        artifact: {
          artifactKey: a.artifactKey,
          typeId: a.typeId,
          data: a.data,
          pointer: a.pointer,
        } satisfies Omit<ArtifactVersion, "version" | "createdAt">,
      }))
    : [];
  const ruleSets = input.inheritRulesFrom
    ? [...input.inheritRulesFrom.ruleSetsById.values()]
    : [];

  const context: RunContextRef = {
    parentRunId: parentIds[0],
    parentRunIds: parentIds,
  };

  return {
    workflow: input.workflow,
    initialArtifacts,
    ruleSets,
    context,
    subject: input.subject ?? input.parents[0].run.subject,
    metadata: input.metadata,
    tags: input.tags,
  };
}
