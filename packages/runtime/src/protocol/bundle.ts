import { WorkbenchError, formatZodError } from "../errors.js";
import { migrateRunBundle } from "./migrate.js";
import type { RunBundle } from "./run.js";
import { RunBundleSchema } from "./run.js";
import { WORKBENCH_PROTOCOL_VERSION } from "./version.js";

/**
 * Canonical JSON serializer used as the input to integrity hashing.
 *
 * Rules (kept narrow on purpose so two semantically equal payloads always hash equal):
 * - Object keys are emitted in lexicographic order.
 * - Object entries whose value is `undefined` are dropped (matching `JSON.stringify`).
 * - `undefined` is **rejected anywhere it would change the hash silently** —
 *   namely as an array element, a Map value, or as the root value. This avoids the
 *   asymmetry where `[undefined]` and `[]` would otherwise hash to different strings
 *   while `{a: undefined}` and `{}` hash the same.
 * - Functions and symbols are rejected (they cannot survive a JSON round-trip).
 * - Cyclic structures are rejected.
 */
function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const stringify = (v: unknown, path: string): string => {
    if (v === undefined) {
      throw new WorkbenchError(
        "INVALID_RUN_BUNDLE",
        `Canonical JSON cannot encode \`undefined\` at ${path || "(root)"}; use null or omit the property`,
      );
    }
    if (v === null) return "null";
    const t = typeof v;
    if (t === "function" || t === "symbol" || t === "bigint") {
      throw new WorkbenchError(
        "INVALID_RUN_BUNDLE",
        `Canonical JSON cannot encode value of type \`${t}\` at ${path || "(root)"}`,
      );
    }
    if (t !== "object") {
      return JSON.stringify(v);
    }
    if (Array.isArray(v)) {
      return `[${v.map((item, idx) => stringify(item, `${path}[${idx}]`)).join(",")}]`;
    }
    const obj = v as Record<string, unknown>;
    if (seen.has(obj)) {
      throw new WorkbenchError("INVALID_RUN_BUNDLE", `Canonical JSON encountered a cyclic structure at ${path || "(root)"}`);
    }
    seen.add(obj);
    const keys = Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined);
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stringify(obj[k], `${path}.${k}`)}`)
      .join(",")}}`;
  };
  return stringify(value, "");
}

function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeRunBundleIntegrity(payload: {
  run: RunBundle["run"];
  trace: RunBundle["trace"];
  artifacts: RunBundle["artifacts"];
  ruleSets: RunBundle["ruleSets"];
  engine?: RunBundle["engine"];
}): Promise<string> {
  const body = stableStringify({
    run: payload.run,
    trace: payload.trace,
    artifacts: payload.artifacts,
    ruleSets: payload.ruleSets,
    ...(payload.engine !== undefined ? { engine: payload.engine } : {}),
  });
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new WorkbenchError("MISSING_WEBCRYPTO", "Web Crypto (crypto.subtle) is required for integrity hashing");
  }
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(body));
  return bufferToHex(digest);
}

export async function attachRunBundleIntegrity(bundle: RunBundle): Promise<RunBundle> {
  const sha256 = await computeRunBundleIntegrity({
    run: bundle.run,
    trace: bundle.trace,
    artifacts: bundle.artifacts,
    ruleSets: bundle.ruleSets,
    engine: bundle.engine,
  });
  return { ...bundle, integrity: { sha256 } };
}

export async function verifyRunBundleIntegrity(bundle: RunBundle): Promise<boolean> {
  if (!bundle.integrity?.sha256) return false;
  const expected = await computeRunBundleIntegrity({
    run: bundle.run,
    trace: bundle.trace,
    artifacts: bundle.artifacts,
    ruleSets: bundle.ruleSets,
    engine: bundle.engine,
  });
  return expected === bundle.integrity.sha256;
}

export function serializeRunBundle(bundle: RunBundle): string {
  return stableStringify(bundle);
}

export type ParseRunBundleOptions = {
  /**
   * When `true` (the default), bundles whose `protocolVersion` differs from the
   * current one are passed through registered {@link RunBundleMigration}s
   * before validation. Set to `false` for strict imports that must already be
   * on the current version.
   */
  migrate?: boolean;
};

/**
 * Parse and validate a run bundle JSON string. Throws {@link WorkbenchError} on invalid JSON or schema.
 *
 * By default, older protocol versions are migrated forward via the registered
 * migrations (see {@link registerRunBundleMigration}). Disable with
 * `{ migrate: false }` for strict imports.
 */
export function parseRunBundleJson(jsonText: string, options?: ParseRunBundleOptions): RunBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new WorkbenchError("INVALID_JSON", `Run bundle is not valid JSON: ${msg}`, e);
  }
  const migrate = options?.migrate ?? true;
  if (
    migrate
    && parsed
    && typeof parsed === "object"
    && (parsed as { protocolVersion?: unknown }).protocolVersion !== WORKBENCH_PROTOCOL_VERSION
  ) {
    return migrateRunBundle(parsed);
  }
  const r = RunBundleSchema.safeParse(parsed);
  if (!r.success) {
    throw new WorkbenchError("INVALID_RUN_BUNDLE", formatZodError(r.error), r.error);
  }
  return r.data;
}

export function deserializeRunBundle(json: string, options?: ParseRunBundleOptions): RunBundle {
  return parseRunBundleJson(json, options);
}
