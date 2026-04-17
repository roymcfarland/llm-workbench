import type { ArtifactVersion } from "../protocol/artifacts.js";
import type { RunContextRef } from "../protocol/run.js";
import type { StartRunInput } from "../runtime/types.js";
import type { RunStoreState } from "../runtime/types.js";

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
    forkedFromStepId: opts?.forkedFromStepId,
  };

  return {
    workflow,
    initialArtifacts,
    ruleSets: [...parent.ruleSetsById.values()],
    context,
    tags: opts?.tags ?? [...(parent.run.tags ?? []), "fork"],
  };
}
