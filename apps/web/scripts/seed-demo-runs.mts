// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT

import { pathToFileURL } from "node:url";

import { WorkbenchRuntime, type RunStoreState } from "@llm-workbench/runtime";
import { createClient } from "@supabase/supabase-js";

import { demoScenarios } from "../lib/landing/scenarios/index";

const TABLE = "runs";
const TENANT_ID = "seed-demo";
const DEFAULT_COUNT = 60;
const MIN_COUNT = 1;
const MAX_COUNT = 200;
const RUN_SPACING_MS = 30 * 60 * 60 * 1000;
const RUN_DURATION_MS = 4 * 60 * 1000;

type SerializedRun = {
  revision: number;
  run: RunStoreState["run"];
  trace: RunStoreState["trace"];
  artifactsByKey: Array<[string, unknown]>;
  ruleSetsById: Array<[string, unknown]>;
  stepStatus: Array<[string, string]>;
  gateState: Array<[string, unknown]>;
  idempotency: Array<[string, { artifactKey: string; version: number }]>;
};

export type RunsRow = {
  id: string;
  tenant_id: string;
  workflow_id: string | null;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
  tags: string[] | null;
  state: SerializedRun;
  created_at?: string;
  updated_at?: string;
};

type CliOptions = {
  apply: boolean;
  clean: boolean;
  count: number;
};

export function buildSeedRows({
  count,
  now,
}: {
  count: number;
  now: number;
}): RunsRow[] {
  const safeCount = normalizeCount(count);

  return Array.from({ length: safeCount }, (_, i) => {
    const scenario = demoScenarios[i % demoScenarios.length]!;
    const runtime = new WorkbenchRuntime();
    const runId = scenario.build(runtime);
    const state: RunStoreState | undefined = runtime.getState(runId);
    if (!state) {
      throw new Error(`Scenario "${scenario.id}" did not produce run state.`);
    }

    const serialized = stateToSerialized(state);
    const startedAtMs = now - RUN_DURATION_MS - i * RUN_SPACING_MS;
    const endedAtMs = startedAtMs + RUN_DURATION_MS;

    return {
      id: `seed-demo-${scenario.id}-${i}`,
      tenant_id: TENANT_ID,
      workflow_id: serialized.run?.workflowId ?? scenario.id,
      status: "completed",
      started_at: new Date(startedAtMs).toISOString(),
      ended_at: new Date(endedAtMs).toISOString(),
      tags: ["demo", scenario.id],
      state: serialized,
    };
  });
}

function stateToSerialized(state: RunStoreState): SerializedRun {
  return {
    revision: state.revision,
    run: state.run,
    trace: state.trace,
    artifactsByKey: [...state.artifactsByKey.entries()],
    ruleSetsById: [...state.ruleSetsById.entries()],
    stepStatus: [...state.stepStatus.entries()],
    gateState: [...state.gateState.entries()],
    idempotency: [...state.idempotency.entries()],
  };
}

function parseCliOptions(argv: string[]): CliOptions {
  let count = DEFAULT_COUNT;
  const options: CliOptions = {
    apply: false,
    clean: false,
    count,
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--clean") {
      options.clean = true;
    } else if (arg.startsWith("--count=")) {
      count = Number(arg.slice("--count=".length));
      if (!Number.isFinite(count)) {
        throw new Error(`Invalid --count value: ${arg}`);
      }
      options.count = normalizeCount(count);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function normalizeCount(count: number): number {
  if (!Number.isFinite(count)) {
    throw new Error("Seed row count must be a finite number.");
  }

  return Math.max(MIN_COUNT, Math.min(MAX_COUNT, Math.floor(count)));
}

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [
    ["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0 || !supabaseUrl || !serviceRoleKey) {
    throw new Error(`Missing required Supabase env for --apply: ${missing.join(", ")}`);
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function scenarioIdFor(row: RunsRow): string {
  return row.tags?.[1] ?? "unknown";
}

function printSeedSummary(rows: RunsRow[]): void {
  const distribution = new Map<string, number>();
  for (const row of rows) {
    const scenarioId = scenarioIdFor(row);
    distribution.set(scenarioId, (distribution.get(scenarioId) ?? 0) + 1);
  }

  const newest = rows[0]?.started_at ?? "n/a";
  const oldest = rows[rows.length - 1]?.started_at ?? "n/a";

  console.log(`tenant: ${TENANT_ID}`);
  console.log(`rows: ${rows.length}`);
  console.log(`date range: ${oldest} to ${newest}`);
  console.log(
    `scenario distribution: ${[...distribution.entries()]
      .map(([scenarioId, total]) => `${scenarioId}=${total}`)
      .join(", ")}`,
  );
  console.log("sample rows:");
  for (const row of rows.slice(0, 3)) {
    console.log(`- ${row.id} (${scenarioIdFor(row)})`);
  }
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  console.log(options.apply ? "APPLY" : "DRY-RUN");

  if (options.clean) {
    if (!options.apply) {
      const rows = buildSeedRows({ count: options.count, now: Date.now() });
      console.log(`would delete rows from ${TABLE} where tenant_id = "${TENANT_ID}"`);
      console.log(`planned seed ids in this invocation: ${rows.length}`);
      console.log("database is not queried during dry-run");
      return;
    }

    const { count, error } = await getSupabaseClient()
      .from(TABLE)
      .delete({ count: "exact" })
      .eq("tenant_id", TENANT_ID);
    if (error) throw new Error(`Supabase clean error: ${error.message}`);
    console.log(`deleted ${count ?? 0} seed rows from ${TABLE}`);
    return;
  }

  const rows = buildSeedRows({ count: options.count, now: Date.now() });
  printSeedSummary(rows);

  if (!options.apply) return;

  const { error } = await getSupabaseClient().from(TABLE).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Supabase seed error: ${error.message}`);
  console.log(`wrote ${rows.length} seed rows to ${TABLE}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
