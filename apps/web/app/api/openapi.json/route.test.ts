import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/site", () => ({ siteOrigin: vi.fn().mockResolvedValue("https://example.test") }));
vi.mock("@/lib/auth/tenant", () => {
  class TenantAuthError extends Error {
    constructor(message = "Authentication required") {
      super(message);
      this.name = "TenantAuthError";
    }
  }
  return { TenantAuthError, requireTenant: vi.fn() };
});
vi.mock("@/lib/supabase/runs-store", () => ({
  RunIdConflictError: class RunIdConflictError extends Error {
    name = "RunIdConflictError";
  },
  listRunsForTenant: vi.fn(),
  loadRunForTenant: vi.fn(),
  saveRunForTenant: vi.fn(),
  deleteRunForTenant: vi.fn(),
  serializedToState: vi.fn(),
  stateToSerialized: vi.fn(),
}));
vi.mock("@upstash/redis", () => ({ Redis: class FakeRedis {} }));
const { limit } = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class FakeRatelimit {
    static slidingWindow() { return {}; }
    limit = limit;
  },
}));

import { WorkbenchError, WorkbenchRuntime } from "@llm-workbench/runtime";
import { TenantAuthError, requireTenant } from "@/lib/auth/tenant";
import * as store from "@/lib/supabase/runs-store";
import { initialRuleSet, jobSearchWorkflow } from "@/lib/workflow/job-search";
import { GET as listRuns } from "../runs/route";
import { DELETE, GET as getRun, PUT } from "../runs/[runId]/route";
import { GET } from "./route";

type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  expect(value).toBeTypeOf("object");
  expect(value).not.toBeNull();
  expect(Array.isArray(value)).toBe(false);
  return value as JsonObject;
}

const operations = [
  { path: "/api/runs", method: "get", handler: listRuns, store: store.listRunsForTenant, success: 200 },
  { path: "/api/runs/{runId}", method: "get", handler: getRun, store: store.loadRunForTenant, success: 200 },
  { path: "/api/runs/{runId}", method: "put", handler: PUT, store: store.saveRunForTenant, success: 204 },
  { path: "/api/runs/{runId}", method: "delete", handler: DELETE, store: store.deleteRunForTenant, success: 204 },
] as const;
type Operation = (typeof operations)[number];
let doc: JsonObject;
let seed: ReturnType<typeof seedRun>;

function seedRun() {
  const runtime = new WorkbenchRuntime();
  const { runId } = runtime.startRun({ workflow: jobSearchWorkflow, ruleSets: [initialRuleSet] });
  return { runId, state: runtime.getState(runId)! };
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(requireTenant).mockResolvedValue({ userId: "user_a", tenantId: "tenant-a" });
  seed = seedRun();
  vi.mocked(store.listRunsForTenant).mockResolvedValue([]);
  vi.mocked(store.loadRunForTenant).mockResolvedValue(null);
  vi.mocked(store.saveRunForTenant).mockResolvedValue(undefined);
  vi.mocked(store.deleteRunForTenant).mockResolvedValue(undefined);
  vi.mocked(store.serializedToState).mockReturnValue(seed.state);
  const response = await GET();
  expect(response.status).toBe(200);
  doc = object(await response.json());
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function responses(operation: Operation): JsonObject {
  return object(object(object(doc.paths)[operation.path])[operation.method]).responses as JsonObject;
}
function resolve(ref: string): JsonObject {
  expect(ref, `Non-component reference: ${ref}`).toMatch(/^#\/components\//);
  let value: unknown = doc;
  for (const segment of ref.slice(2).split("/")) {
    value = object(value)[segment.replace(/~1/g, "/").replace(/~0/g, "~")];
    expect(value, `Unresolved $ref: ${ref}`).toBeDefined();
  }
  return object(value);
}
function responseDefinition(operation: Operation, status: number): JsonObject {
  const response = object(responses(operation)[String(status)]);
  return typeof response.$ref === "string" ? resolve(response.$ref) : response;
}
async function invoke(
  operation: Operation,
  { runId = seed.runId, body = "{}", headers = {} }: { runId?: string; body?: string; headers?: Record<string, string> } = {},
): Promise<Response> {
  const url = `https://example.test${operation.path.replace("{runId}", runId)}`;
  const request = new Request(url, {
    method: operation.method.toUpperCase(), headers,
    ...(operation.method === "put" ? { body } : {}),
  });
  return operation.handler(request, { params: Promise.resolve({ runId }) });
}
async function documented(operation: Operation, response: Response, expected: number) {
  const name = `${operation.method.toUpperCase()} ${operation.path}`;
  // Check the observed response first: a handler mutation must fail on the
  // undocumented status, even when it also differs from the scenario's status.
  expect(Object.keys(responses(operation)), `${name}: undocumented status ${response.status}`).toContain(String(response.status));
  expect(response.status, `${name}: scenario status`).toBe(expected);
  const definition = responseDefinition(operation, response.status);
  if ([204, 404].includes(response.status)) {
    expect(definition).not.toHaveProperty("content");
    expect(await response.text()).toBe("");
    return undefined;
  }
  expect(definition).toHaveProperty("content.application/json.schema");
  const body: unknown = await response.json();
  if (response.status >= 400) {
    expect(object(body).error).toBeTypeOf("string");
    if (object(body).code !== undefined) expect(object(body).code).toBeTypeOf("string");
  }
  return body;
}

describe("OpenAPI structure", () => {
  it("resolves every component reference and has no unused shared responses", () => {
    expect(doc.openapi).toBe("3.1.0");
    const refs = new Set<string>();
    function walk(value: unknown) {
      if (Array.isArray(value)) { value.forEach(walk); return; }
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (key === "$ref") {
          expect(child).toBeTypeOf("string");
          resolve(child as string);
          refs.add(child as string);
        } else walk(child);
      }
    }
    walk(doc);
    for (const name of Object.keys(object(object(doc.components).responses))) {
      expect(refs, `Unused shared response: ${name}`).toContain(`#/components/responses/${name}`);
    }
  });

  it("declares unique operation ids, response descriptions, path parameters and required statuses", () => {
    const ids = new Set<string>();
    const methods = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);
    for (const [path, itemValue] of Object.entries(object(doc.paths))) {
      const item = object(itemValue);
      for (const [method, operationValue] of Object.entries(item)) {
        if (!methods.has(method)) continue;
        const operation = object(operationValue);
        expect(operation.operationId).toBeTypeOf("string");
        const id = operation.operationId as string;
        expect(ids, `Duplicate operationId: ${id}`).not.toContain(id);
        ids.add(id);
        const statuses = object(operation.responses);
        expect(Object.keys(statuses).some((status) => /^2\d\d$/.test(status))).toBe(true);
        for (const status of ["401", "429", "500"]) {
          expect(statuses, `${method.toUpperCase()} ${path}: missing ${status}`).toHaveProperty(status);
        }
        for (const responseValue of Object.values(statuses)) {
          const response = object(responseValue);
          const resolved = typeof response.$ref === "string" ? resolve(response.$ref) : response;
          expect(resolved.description).toBeTypeOf("string");
          expect(resolved.description).not.toBe("");
        }
        const params = [...(item.parameters as unknown[] ?? []), ...(operation.parameters as unknown[] ?? [])]
          .map((value) => {
            const param = object(value);
            return typeof param.$ref === "string" ? resolve(param.$ref) : param;
          });
        for (const match of path.matchAll(/\{([^}]+)\}/g)) {
          expect(params.some((param) => param.in === "path" && param.name === match[1] && param.required === true), `${method} ${path}: undeclared ${match[1]}`).toBe(true);
        }
      }
    }
    for (const response of Object.values(object(object(doc.components).responses))) {
      expect(object(response).description).toBeTypeOf("string");
    }
  });
});

describe("real run handler response contracts", () => {
  for (const operation of operations) {
    describe(`${operation.method.toUpperCase()} ${operation.path}`, () => {
      it(`documents success ${operation.success}`, async () => {
        if (operation.handler === getRun) {
          vi.mocked(store.loadRunForTenant).mockResolvedValue({ state: { run: { id: seed.runId } } } as store.RunsTableRow);
        }
        await documented(operation, await invoke(operation), operation.success);
      });
      it("documents signed-out 401", async () => {
        vi.mocked(requireTenant).mockRejectedValueOnce(new TenantAuthError());
        expect(await documented(operation, await invoke(operation), 401)).toEqual({ error: "Authentication required" });
        expect(operation.store).not.toHaveBeenCalled();
      });
      it("documents unexpected store error 500", async () => {
        vi.mocked(operation.store).mockRejectedValueOnce(new Error("Unexpected persistence failure"));
        await documented(operation, await invoke(operation), 500);
      });
      if (operation.handler !== listRuns) {
        it("documents invalid run id 400", async () => {
          expect(await documented(operation, await invoke(operation, { runId: "invalid" }), 400)).toEqual({ error: "Invalid run id" });
          expect(operation.store).not.toHaveBeenCalled();
        });
        // GET/DELETE's current stores don't throw WorkbenchError themselves;
        // inject one to cover the real shared errorResponse mapping.
        it("documents WorkbenchError 400 with a code", async () => {
          vi.mocked(operation.store).mockRejectedValueOnce(new WorkbenchError("INVALID_RUN_STATE", "Invalid persisted state"));
          expect(await documented(operation, await invoke(operation), 400)).toEqual({ error: "Invalid persisted state", code: "INVALID_RUN_STATE" });
        });
      }
    });
  }

  it("GET documents empty-body 404 for a missing run", async () => {
    await documented(operations[1], await invoke(operations[1]), 404);
  });
  it("DELETE documents empty-body 204 for a missing run", async () => {
    // The real store returns void without inspecting the deleted row count.
    await documented(operations[3], await invoke(operations[3]), 204);
  });
  it("PUT documents invalid JSON 400", async () => {
    expect(await documented(operations[2], await invoke(operations[2], { body: "{" }), 400)).toEqual({ error: "Invalid JSON body" });
  });
  it("PUT documents run-state validation failure 400 without a code", async () => {
    vi.mocked(store.serializedToState).mockImplementationOnce(() => { throw new WorkbenchError("HTTP_INVALID_JSON", "Invalid run state"); });
    expect(await documented(operations[2], await invoke(operations[2]), 400)).toEqual({ error: "Invalid run state" });
  });
  it("PUT documents mismatched run.id 400", async () => {
    seed.state.run.id = "run_other";
    expect(await documented(operations[2], await invoke(operations[2]), 400)).toEqual({ error: "state.run.id must match URL param" });
  });
  it("PUT documents structural invariant failure 400 with a code", async () => {
    seed.state.run.workflowId = "different-workflow";
    expect(await documented(operations[2], await invoke(operations[2]), 400)).toMatchObject({ code: "INVALID_RUN_STATE" });
    expect(store.saveRunForTenant).not.toHaveBeenCalled();
  });
  it("PUT documents unavailable run id 409", async () => {
    vi.mocked(store.saveRunForTenant).mockRejectedValueOnce(new store.RunIdConflictError());
    expect(await documented(operations[2], await invoke(operations[2]), 409)).toEqual({ error: "Run id is not available" });
  });
  it("PUT documents oversized content-length 413", async () => {
    await documented(operations[2], await invoke(operations[2], { headers: { "content-length": String(25 * 1024 * 1024 + 1) } }), 413);
    expect(store.serializedToState).not.toHaveBeenCalled();
  });
  it("PUT documents oversized streamed text 413", async () => {
    await documented(operations[2], await invoke(operations[2], { body: " ".repeat(25 * 1024 * 1024 + 1) }), 413);
    expect(store.serializedToState).not.toHaveBeenCalled();
  });
});

describe("real rate-limit helper response contracts", () => {
  for (const operation of operations) {
    it.each([429, 503] as const)(`${operation.method.toUpperCase()} ${operation.path} documents %s and Retry-After`, async (status) => {
      vi.resetModules();
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("RATE_LIMIT_ALLOW_UNCONFIGURED", "");
      for (const key of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) vi.stubEnv(key, "");
      if (status === 429) {
        vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
        vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
        vi.spyOn(Date, "now").mockReturnValue(1_000_000);
        limit.mockResolvedValueOnce({ success: false, reset: 1_002_500 });
      }
      const { rateLimitApiIfConfigured } = await import("@/lib/rate-limit/edge");
      const response = await rateLimitApiIfConfigured(new NextRequest(`https://example.test${operation.path.replace("{runId}", seed.runId)}`, { method: operation.method.toUpperCase() }));
      expect(response).not.toBeNull();
      expect(await documented(operation, response!, status)).toEqual({ error: status === 429 ? "Too many requests" : "Rate limiter not configured" });
      expect(response!.headers.get("Retry-After")).toBe(status === 429 ? "3" : "60");
      const retryAfter = object(object(responseDefinition(operation, status).headers)["Retry-After"]);
      expect(retryAfter.description).toBeTypeOf("string");
      expect(retryAfter.schema).toEqual({ type: "string" });
    });
  }
});
