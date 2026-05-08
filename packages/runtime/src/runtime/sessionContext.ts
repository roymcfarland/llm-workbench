import type { ArtifactStore } from "../persistence/artifactStore.js";
import type { TraceEvent } from "../protocol/trace.js";
import type { RunStoreState } from "./types.js";

export type SessionContext = {
  protocolVersion: string;
  state: RunStoreState;
  appendTrace: (e: TraceEvent) => void;
  newEventId: () => string;
  nowIso: () => string;
  canStartStep: (
    stepId: string,
  ) => ReturnType<typeof import("./readiness.js").canStartStep>;
  /** Optional external byte store for large artifact payloads. */
  artifactStore?: ArtifactStore;
  /** Threshold above which `writeArtifactAsync` externalizes payloads. */
  artifactExternalizationThresholdBytes?: number;
};
