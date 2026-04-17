import { WorkbenchError, formatZodError } from "../errors.js";
import type { RunBundle } from "./run.js";
import { RunBundleSchema } from "./run.js";

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const stringify = (v: unknown): string => {
    if (v === undefined) return "null";
    if (v === null) return "null";
    if (typeof v !== "object") {
      return JSON.stringify(v);
    }
    if (Array.isArray(v)) {
      return `[${v.map(stringify).join(",")}]`;
    }
    const obj = v as Record<string, unknown>;
    if (seen.has(obj)) {
      throw new Error("stableStringify: cyclic structure");
    }
    seen.add(obj);
    const keys = Object.keys(obj)
      .sort()
      .filter((k) => (obj as Record<string, unknown>)[k] !== undefined);
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stringify((obj as Record<string, unknown>)[k])}`).join(",")}}`;
  };
  return stringify(value);
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

/**
 * Parse and validate a run bundle JSON string. Throws {@link WorkbenchError} on invalid JSON or schema.
 */
export function parseRunBundleJson(jsonText: string): RunBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new WorkbenchError("INVALID_JSON", `Run bundle is not valid JSON: ${msg}`, e);
  }
  const r = RunBundleSchema.safeParse(parsed);
  if (!r.success) {
    throw new WorkbenchError("INVALID_RUN_BUNDLE", formatZodError(r.error), r.error);
  }
  return r.data;
}

export function deserializeRunBundle(json: string): RunBundle {
  return parseRunBundleJson(json);
}
