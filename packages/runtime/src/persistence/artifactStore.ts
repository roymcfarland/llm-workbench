import { WorkbenchError } from "../errors.js";

/**
 * Default threshold above which the runtime will externalize artifact
 * payloads to an {@link ArtifactStore}. Chosen to keep ordinary form-shaped
 * artifacts (≤ 64 KB JSON) inline, large structured outputs (paragraphs,
 * resumes, search results) inline, and to externalize bigger payloads
 * (long documents, transcripts, dumps) so the run state stays cheap to
 * round-trip through `RunRepository`.
 *
 * Override per host via `WorkbenchRuntimeOptions.artifactExternalizationThresholdBytes`.
 */
export const DEFAULT_ARTIFACT_EXTERNALIZATION_THRESHOLD_BYTES = 256 * 1024;

export type ArtifactStorePutInput = {
  runId: string;
  artifactKey: string;
  version: number;
  /** Canonical-JSON encoded payload bytes. */
  payload: Uint8Array;
  /** Lowercase-hex SHA-256 of `payload` precomputed by the runtime. */
  payloadHash: string;
  contentType?: string;
};

export type ArtifactStorePutResult = {
  /** Opaque storage key the store returns; persisted on `ArtifactPointer.ref`. */
  ref: string;
  /** Mirror of input `payloadHash` so the host can verify the store accepted what it claimed. */
  payloadHash: string;
  byteLength: number;
};

export type ArtifactStoreGetResult = {
  payload: Uint8Array;
  payloadHash: string;
  contentType?: string;
};

/**
 * External byte store for artifact payloads. Optional dependency of
 * `WorkbenchRuntime` and `RunRepository`. Implementations are expected to:
 *
 * - return a `ref` from `put` that the runtime can later pass to `get`
 * - persist payload bytes verbatim so the precomputed `payloadHash` still
 *   matches when the bytes are read back
 * - tolerate concurrent writes for the same `(runId, artifactKey, version)`
 *   either by being idempotent or by serializing through the host
 *
 * The runtime itself never calls `delete` automatically; that is left to
 * the host's retention / GC policy. A reference `MemoryArtifactStore` is
 * provided for tests and local development; production hosts should plug
 * in S3 / Vercel Blob / Supabase Storage / R2 / etc.
 */
export interface ArtifactStore {
  put(input: ArtifactStorePutInput, opts?: { signal?: AbortSignal }): Promise<ArtifactStorePutResult>;
  get(input: { runId: string; ref: string }, opts?: { signal?: AbortSignal }): Promise<ArtifactStoreGetResult>;
  delete(input: { runId: string; ref: string }, opts?: { signal?: AbortSignal }): Promise<void>;
}

/**
 * In-memory `ArtifactStore` reference implementation. Intended for tests,
 * local development, and as a copy-paste starting point for production
 * adapters. Not safe across processes.
 */
export class MemoryArtifactStore implements ArtifactStore {
  private blobs = new Map<string, { payload: Uint8Array; payloadHash: string; contentType?: string }>();

  private key(runId: string, ref: string): string {
    return `${runId}::${ref}`;
  }

  async put(input: ArtifactStorePutInput): Promise<ArtifactStorePutResult> {
    const ref = `art_${input.runId}_${input.artifactKey}_${input.version}`;
    this.blobs.set(this.key(input.runId, ref), {
      payload: input.payload.slice(),
      payloadHash: input.payloadHash,
      contentType: input.contentType,
    });
    return { ref, payloadHash: input.payloadHash, byteLength: input.payload.byteLength };
  }

  async get(input: { runId: string; ref: string }): Promise<ArtifactStoreGetResult> {
    const blob = this.blobs.get(this.key(input.runId, input.ref));
    if (!blob) {
      throw new WorkbenchError(
        "UNKNOWN_ARTIFACT",
        `MemoryArtifactStore: no blob for ref "${input.ref}" in run "${input.runId}"`,
      );
    }
    return { payload: blob.payload.slice(), payloadHash: blob.payloadHash, contentType: blob.contentType };
  }

  async delete(input: { runId: string; ref: string }): Promise<void> {
    this.blobs.delete(this.key(input.runId, input.ref));
  }

  /** Test/inspection helper. Not part of the `ArtifactStore` contract. */
  size(): number {
    return this.blobs.size;
  }
}

/**
 * Encode a JSON-serializable value to canonical UTF-8 bytes for hashing
 * and external storage. Uses key-sorted stringification so the resulting
 * byte stream is stable across runtimes and equal payloads always hash to
 * the same value.
 *
 * Throws `WorkbenchError("INVALID_INPUT")` if the value cannot be encoded
 * (functions, symbols, cycles, `undefined` in arrays).
 */
export function encodeArtifactPayloadBytes(value: unknown): Uint8Array {
  const json = canonicalJson(value);
  return new TextEncoder().encode(json);
}

/**
 * Compute a lowercase-hex SHA-256 hash of arbitrary bytes using the
 * platform's WebCrypto implementation (Node 20+, browsers, edge runtimes,
 * Bun). Avoids pulling in a Node-only dependency so the runtime stays
 * environment-agnostic.
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new WorkbenchError(
      "MISSING_WEBCRYPTO",
      "globalThis.crypto.subtle is required for ArtifactStore hashing (Node 20+ / browsers / edge)",
    );
  }
  const digest = await subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function canonicalJson(value: unknown): string {
  const seen = new WeakSet<object>();
  const walk = (v: unknown): unknown => {
    if (v === undefined) {
      throw new WorkbenchError(
        "INVALID_INPUT",
        "Cannot encode artifact payload containing `undefined` (use `null` to express absence)",
      );
    }
    if (typeof v === "function" || typeof v === "symbol") {
      throw new WorkbenchError(
        "INVALID_INPUT",
        `Cannot encode artifact payload containing ${typeof v}`,
      );
    }
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v as object)) {
      throw new WorkbenchError(
        "INVALID_INPUT",
        "Cannot encode artifact payload containing a cyclic structure",
      );
    }
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(walk);
    const keys = Object.keys(v as Record<string, unknown>).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = walk((v as Record<string, unknown>)[k]);
    return out;
  };
  return JSON.stringify(walk(value));
}
