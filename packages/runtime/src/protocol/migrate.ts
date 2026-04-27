import { WorkbenchError } from "../errors.js";
import type { RunBundle } from "./run.js";
import { RunBundleSchema } from "./run.js";
import { WORKBENCH_PROTOCOL_VERSION } from "./version.js";

/**
 * A migration upgrades a run bundle from one protocol version to the next.
 *
 * Migrations operate on raw `unknown` JSON because the previous-version Zod
 * schema may differ from the current one. They must:
 * 1. Verify they are looking at the version they claim to handle.
 * 2. Return a value that parses cleanly under the *next* version's schema.
 * 3. Be pure: no I/O, no `Date.now`, no global state.
 */
export type RunBundleMigration = {
  from: string;
  to: string;
  migrate(input: unknown): unknown;
};

const REGISTERED: RunBundleMigration[] = [];

/**
 * Register a migration. Call once at module load time. The runtime applies
 * registered migrations in dependency order until the bundle reaches
 * {@link WORKBENCH_PROTOCOL_VERSION}.
 */
export function registerRunBundleMigration(migration: RunBundleMigration): void {
  for (const m of REGISTERED) {
    if (m.from === migration.from && m.to === migration.to) {
      throw new WorkbenchError(
        "INVALID_INPUT",
        `Duplicate migration registered: ${migration.from} -> ${migration.to}`,
      );
    }
  }
  REGISTERED.push(migration);
}

function readVersion(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const v = (input as { protocolVersion?: unknown }).protocolVersion;
  return typeof v === "string" ? v : undefined;
}

/**
 * Apply registered migrations until the bundle reaches the current protocol
 * version, then validate it against {@link RunBundleSchema}.
 *
 * Throws {@link WorkbenchError} with code `UNSUPPORTED_PROTOCOL_VERSION` when
 * no migration path exists from the input version, or `INVALID_RUN_BUNDLE`
 * when the migrated value still fails schema validation.
 */
export function migrateRunBundle(input: unknown): RunBundle {
  let current = input;
  let currentVersion = readVersion(current);
  if (!currentVersion) {
    throw new WorkbenchError(
      "UNSUPPORTED_PROTOCOL_VERSION",
      "Run bundle is missing `protocolVersion` and cannot be migrated",
    );
  }

  const visited = new Set<string>([currentVersion]);
  while (currentVersion !== WORKBENCH_PROTOCOL_VERSION) {
    const next = REGISTERED.find((m) => m.from === currentVersion);
    if (!next) {
      throw new WorkbenchError(
        "UNSUPPORTED_PROTOCOL_VERSION",
        `No migration path from protocolVersion "${currentVersion}" to "${WORKBENCH_PROTOCOL_VERSION}"`,
      );
    }
    if (visited.has(next.to)) {
      throw new WorkbenchError(
        "UNSUPPORTED_PROTOCOL_VERSION",
        `Migration cycle detected at version "${next.to}"`,
      );
    }
    current = next.migrate(current);
    currentVersion = readVersion(current);
    if (!currentVersion || currentVersion !== next.to) {
      throw new WorkbenchError(
        "UNSUPPORTED_PROTOCOL_VERSION",
        `Migration from "${next.from}" did not produce expected version "${next.to}"`,
      );
    }
    visited.add(currentVersion);
  }

  const parsed = RunBundleSchema.safeParse(current);
  if (!parsed.success) {
    throw new WorkbenchError(
      "INVALID_RUN_BUNDLE",
      `Migrated bundle failed validation: ${parsed.error.issues
        .map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`)
        .join("; ")}`,
      parsed.error,
    );
  }
  return parsed.data;
}

/** Test/inspection helper. */
export function listRunBundleMigrations(): readonly RunBundleMigration[] {
  return [...REGISTERED];
}
