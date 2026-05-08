import { applyPatch, type Operation } from "fast-json-patch";
import { WorkbenchError } from "../errors.js";
import {
  encodeArtifactPayloadBytes,
  sha256Hex,
} from "../persistence/artifactStore.js";
import type { ArtifactPointer, ArtifactVersion } from "../protocol/artifacts.js";
import { getArtifactPayloadHash } from "../protocol/artifacts.js";
import type { JsonPatchOp } from "../protocol/trace.js";
import type { RunLifecycleController } from "./runLifecycleController.js";
import type { SessionContext } from "./sessionContext.js";

export class ArtifactController {
  constructor(
    private readonly ctx: SessionContext,
    private readonly lifecycle: RunLifecycleController,
  ) {}

  private get runId() {
    return this.ctx.state.run.id;
  }

  writeArtifact(input: {
    artifactKey: string;
    typeId: string;
    data: unknown;
    idempotencyKey?: string;
    pointer?: ArtifactVersion["pointer"];
  }): ArtifactVersion {
    this.lifecycle.assertRunActive("write artifact");
    if (!input.artifactKey.trim()) {
      throw new WorkbenchError("INVALID_INPUT", "artifactKey must be a non-empty string");
    }
    if (!input.typeId.trim()) {
      throw new WorkbenchError("INVALID_INPUT", "typeId must be a non-empty string");
    }

    if (input.idempotencyKey) {
      const prev = this.ctx.state.idempotency.get(input.idempotencyKey);
      if (prev) {
        if (prev.artifactKey !== input.artifactKey) {
          throw new WorkbenchError(
            "IDEMPOTENCY_CONFLICT",
            `Idempotency key "${input.idempotencyKey}" was already used for artifact "${prev.artifactKey}"`,
          );
        }
        const art = this.ctx.state.artifactsByKey.get(input.artifactKey);
        if (art && art.version === prev.version) return art;
        throw new WorkbenchError(
          "IDEMPOTENCY_CONFLICT",
          `Idempotency key "${input.idempotencyKey}" is stale (artifact "${input.artifactKey}" is now version ${art?.version ?? "missing"})`,
        );
      }
    }

    const prev = this.ctx.state.artifactsByKey.get(input.artifactKey);
    const version = (prev?.version ?? 0) + 1;
    const artifact: ArtifactVersion = {
      artifactKey: input.artifactKey,
      typeId: input.typeId,
      version,
      createdAt: this.ctx.nowIso(),
      data: input.data,
      pointer: input.pointer,
    };
    this.ctx.state.artifactsByKey.set(input.artifactKey, artifact);
    if (input.idempotencyKey) {
      this.ctx.state.idempotency.set(input.idempotencyKey, {
        artifactKey: input.artifactKey,
        version,
      });
    }
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "artifact_written",
      runId: this.runId,
      ts: artifact.createdAt,
      artifact,
      idempotencyKey: input.idempotencyKey,
    });
    return artifact;
  }

  async writeArtifactAsync(input: {
    artifactKey: string;
    typeId: string;
    data: unknown;
    idempotencyKey?: string;
    contentType?: string;
    routing?: "auto" | "inline" | "external";
  }): Promise<ArtifactVersion> {
    this.lifecycle.assertRunActive("write artifact");
    if (!input.artifactKey.trim()) {
      throw new WorkbenchError("INVALID_INPUT", "artifactKey must be a non-empty string");
    }
    if (!input.typeId.trim()) {
      throw new WorkbenchError("INVALID_INPUT", "typeId must be a non-empty string");
    }

    if (input.idempotencyKey) {
      const prev = this.ctx.state.idempotency.get(input.idempotencyKey);
      if (prev) {
        if (prev.artifactKey !== input.artifactKey) {
          throw new WorkbenchError(
            "IDEMPOTENCY_CONFLICT",
            `Idempotency key "${input.idempotencyKey}" was already used for artifact "${prev.artifactKey}"`,
          );
        }
        const art = this.ctx.state.artifactsByKey.get(input.artifactKey);
        if (art && art.version === prev.version) return art;
        throw new WorkbenchError(
          "IDEMPOTENCY_CONFLICT",
          `Idempotency key "${input.idempotencyKey}" is stale (artifact "${input.artifactKey}" is now version ${art?.version ?? "missing"})`,
        );
      }
    }

    const payload = encodeArtifactPayloadBytes(input.data);
    const payloadHash = await sha256Hex(payload);
    const byteLength = payload.byteLength;
    const threshold = this.ctx.artifactExternalizationThresholdBytes ?? Infinity;
    const routing = input.routing ?? "auto";

    let pointer: ArtifactPointer;
    let storedData: unknown;
    if (
      routing === "external" ||
      (routing === "auto" && this.ctx.artifactStore && byteLength >= threshold)
    ) {
      if (!this.ctx.artifactStore) {
        throw new WorkbenchError(
          "INVALID_INPUT",
          'writeArtifactAsync({ routing: "external" }) requires an artifactStore on the runtime',
        );
      }
      const prevVersion =
        this.ctx.state.artifactsByKey.get(input.artifactKey)?.version ?? 0;
      const result = await this.ctx.artifactStore.put({
        runId: this.runId,
        artifactKey: input.artifactKey,
        version: prevVersion + 1,
        payload,
        payloadHash,
        contentType: input.contentType,
      });
      if (result.payloadHash !== payloadHash) {
        throw new WorkbenchError(
          "INTEGRITY_MISMATCH",
          `ArtifactStore.put returned mismatched payloadHash (expected ${payloadHash}, got ${result.payloadHash})`,
        );
      }
      pointer = {
        kind: "external",
        ref: result.ref,
        payloadHash,
        byteLength,
      };
      storedData = undefined;
    } else {
      pointer = { kind: "inline", payloadHash, byteLength };
      storedData = input.data;
    }

    const prev = this.ctx.state.artifactsByKey.get(input.artifactKey);
    const version = (prev?.version ?? 0) + 1;
    const artifact: ArtifactVersion = {
      artifactKey: input.artifactKey,
      typeId: input.typeId,
      version,
      createdAt: this.ctx.nowIso(),
      data: storedData,
      pointer,
    };
    this.ctx.state.artifactsByKey.set(input.artifactKey, artifact);
    if (input.idempotencyKey) {
      this.ctx.state.idempotency.set(input.idempotencyKey, {
        artifactKey: input.artifactKey,
        version,
      });
    }
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "artifact_written",
      runId: this.runId,
      ts: artifact.createdAt,
      artifact,
      idempotencyKey: input.idempotencyKey,
    });
    return artifact;
  }

  async materializeArtifact(
    artifactKey: string,
    opts?: { signal?: AbortSignal },
  ): Promise<unknown> {
    const art = this.ctx.state.artifactsByKey.get(artifactKey);
    if (!art) throw new WorkbenchError("UNKNOWN_ARTIFACT", `Unknown artifactKey: ${artifactKey}`);
    if (!art.pointer || art.pointer.kind === "inline") return art.data;
    if (!this.ctx.artifactStore) {
      throw new WorkbenchError(
        "INVALID_STATE_TRANSITION",
        `Artifact "${artifactKey}" is external but no artifactStore is configured on this runtime`,
      );
    }
    if (!art.pointer.ref) {
      throw new WorkbenchError(
        "INVALID_RUN_STATE",
        `External artifact "${artifactKey}" has no pointer.ref`,
      );
    }
    const fetched = await this.ctx.artifactStore.get(
      { runId: this.runId, ref: art.pointer.ref },
      opts,
    );
    const expected = getArtifactPayloadHash(art.pointer);
    if (expected && fetched.payloadHash !== expected) {
      throw new WorkbenchError(
        "INTEGRITY_MISMATCH",
        `External artifact "${artifactKey}" payloadHash mismatch (expected ${expected}, got ${fetched.payloadHash})`,
      );
    }
    const text = new TextDecoder().decode(fetched.payload);
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new WorkbenchError(
        "INVALID_JSON",
        `External artifact "${artifactKey}" is not valid JSON`,
        e,
      );
    }
  }

  patchArtifact(input: {
    artifactKey: string;
    patch: Operation[];
    idempotencyKey?: string;
  }): ArtifactVersion {
    this.lifecycle.assertRunActive("patch artifact");
    if (!input.artifactKey.trim()) {
      throw new WorkbenchError("INVALID_INPUT", "artifactKey must be a non-empty string");
    }

    if (input.idempotencyKey) {
      const prevKey = this.ctx.state.idempotency.get(input.idempotencyKey);
      if (prevKey) {
        if (prevKey.artifactKey !== input.artifactKey) {
          throw new WorkbenchError(
            "IDEMPOTENCY_CONFLICT",
            `Idempotency key "${input.idempotencyKey}" was already used for artifact "${prevKey.artifactKey}"`,
          );
        }
        const art = this.ctx.state.artifactsByKey.get(input.artifactKey);
        if (art && art.version === prevKey.version) return art;
        throw new WorkbenchError(
          "IDEMPOTENCY_CONFLICT",
          `Idempotency key "${input.idempotencyKey}" is stale (artifact "${input.artifactKey}" is now version ${art?.version ?? "missing"})`,
        );
      }
    }

    const prev = this.ctx.state.artifactsByKey.get(input.artifactKey);
    if (!prev) {
      throw new WorkbenchError("UNKNOWN_ARTIFACT", `Unknown artifactKey: ${input.artifactKey}`);
    }
    const clone = structuredClone(prev.data ?? {});
    let nextData: unknown;
    try {
      nextData = applyPatch(clone, input.patch, true, false).newDocument;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new WorkbenchError(
        "PATCH_FAILED",
        `JSON Patch failed for "${input.artifactKey}": ${msg}`,
        e,
      );
    }
    const version = prev.version + 1;
    const artifact: ArtifactVersion = {
      artifactKey: input.artifactKey,
      typeId: prev.typeId,
      version,
      createdAt: this.ctx.nowIso(),
      data: nextData,
      pointer: prev.pointer,
    };
    this.ctx.state.artifactsByKey.set(input.artifactKey, artifact);
    if (input.idempotencyKey) {
      this.ctx.state.idempotency.set(input.idempotencyKey, {
        artifactKey: input.artifactKey,
        version,
      });
    }
    this.ctx.appendTrace({
      id: this.ctx.newEventId(),
      type: "artifact_patch",
      runId: this.runId,
      ts: artifact.createdAt,
      artifactKey: input.artifactKey,
      fromVersion: prev.version,
      toVersion: version,
      patch: input.patch as unknown as JsonPatchOp[],
      idempotencyKey: input.idempotencyKey,
    });
    return artifact;
  }
}
