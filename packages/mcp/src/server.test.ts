import { describe, expect, it } from "vitest";

import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import {
  MemoryRunRepository,
  WorkbenchRuntime,
  type WorkflowSpec,
} from "@llm-workbench/runtime";

import { createWorkbenchMcpServer } from "./server.js";

const wf: WorkflowSpec = {
  id: "wf",
  version: 1,
  steps: [{ id: "a", gatePolicy: "AUTO" }],
  edges: [],
};

async function seed(repo: MemoryRunRepository): Promise<{ runId: string }> {
  const rt = new WorkbenchRuntime();
  const { runId } = rt.startRun({ workflow: wf });
  rt.session(runId).annotate({ text: "hello" });
  await repo.save(rt.getState(runId)!);
  return { runId };
}

async function connect(repo: MemoryRunRepository) {
  const server = createWorkbenchMcpServer({ runRepository: repo });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientTransport);
  return { server, client };
}

function asJson<T>(result: { content: ReadonlyArray<{ type: string; text?: string }> }): T {
  const first = result.content[0];
  if (!first || first.type !== "text" || typeof first.text !== "string") {
    throw new Error("expected text content");
  }
  return JSON.parse(first.text) as T;
}

describe("createWorkbenchMcpServer", () => {
  it("advertises the four LLM Workbench tools", async () => {
    const repo = new MemoryRunRepository();
    const { client } = await connect(repo);
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "get_run",
      "list_runs",
      "validate_run_bundle",
      "verify_run_integrity",
    ]);
  });

  it("list_runs proxies RunRepository.list and respects limit", async () => {
    const repo = new MemoryRunRepository();
    await seed(repo);
    await seed(repo);
    const { client } = await connect(repo);

    const all = asJson<Array<{ id: string }>>(
      await client.callTool({ name: "list_runs", arguments: {} }),
    );
    expect(all).toHaveLength(2);

    const one = asJson<Array<{ id: string }>>(
      await client.callTool({ name: "list_runs", arguments: { limit: 1 } }),
    );
    expect(one).toHaveLength(1);
  });

  it("get_run returns the serialized RunStoreState for a saved run", async () => {
    const repo = new MemoryRunRepository();
    const { runId } = await seed(repo);
    const { client } = await connect(repo);

    const state = asJson<{ run: { id: string }; trace: unknown[] }>(
      await client.callTool({ name: "get_run", arguments: { runId } }),
    );
    expect(state.run.id).toBe(runId);
    expect(state.trace.length).toBeGreaterThan(0);
  });

  it("get_run returns isError when the runId is unknown", async () => {
    const repo = new MemoryRunRepository();
    const { client } = await connect(repo);
    const result = (await client.callTool({
      name: "get_run",
      arguments: { runId: "missing" },
    })) as { isError?: boolean; content: Array<{ text?: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("missing");
  });

  it("verify_run_integrity returns ok=true for a freshly exported bundle", async () => {
    const repo = new MemoryRunRepository();
    const { runId } = await seed(repo);
    const rt = new WorkbenchRuntime();
    rt.importState((await repo.load(runId))!);
    const bundle = await rt.session(runId).exportRunBundle({ profile: "full" });

    const { client } = await connect(repo);
    const result = asJson<{ ok: boolean; sha256?: string }>(
      await client.callTool({
        name: "verify_run_integrity",
        arguments: { bundle },
      }),
    );
    expect(result.ok).toBe(true);
    expect(typeof result.sha256).toBe("string");
  });

  it("verify_run_integrity returns ok=false when the bundle has been tampered with", async () => {
    const repo = new MemoryRunRepository();
    const { runId } = await seed(repo);
    const rt = new WorkbenchRuntime();
    rt.importState((await repo.load(runId))!);
    const bundle = await rt.session(runId).exportRunBundle({ profile: "full" });
    const tampered = structuredClone(bundle);
    tampered.run.tags = ["evil"];

    const { client } = await connect(repo);
    const result = asJson<{ ok: boolean }>(
      await client.callTool({
        name: "verify_run_integrity",
        arguments: { bundle: tampered },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("validate_run_bundle accepts a valid bundle and rejects malformed input", async () => {
    const repo = new MemoryRunRepository();
    const { runId } = await seed(repo);
    const rt = new WorkbenchRuntime();
    rt.importState((await repo.load(runId))!);
    const bundle = await rt.session(runId).exportRunBundle({ profile: "full" });

    const { client } = await connect(repo);
    const ok = asJson<{ ok: boolean }>(
      await client.callTool({
        name: "validate_run_bundle",
        arguments: { bundle },
      }),
    );
    expect(ok.ok).toBe(true);

    const bad = asJson<{ ok: boolean; error?: string }>(
      await client.callTool({
        name: "validate_run_bundle",
        arguments: { bundle: { not: "a bundle" } },
      }),
    );
    expect(bad.ok).toBe(false);
    expect(typeof bad.error).toBe("string");
  });

  it("lists runs:// resources and reads back a RunBundle for runId", async () => {
    const repo = new MemoryRunRepository();
    const { runId } = await seed(repo);
    const { client } = await connect(repo);

    const list = await client.listResources();
    const uris = list.resources.map((r) => r.uri);
    expect(uris).toContain(`runs://${runId}`);

    const read = await client.readResource({ uri: `runs://${runId}` });
    const first = read.contents[0];
    if (!first || typeof first.text !== "string") {
      throw new Error("expected text resource contents");
    }
    const bundle = JSON.parse(first.text) as { run: { id: string }; integrity?: { sha256?: string } };
    expect(bundle.run.id).toBe(runId);
    expect(bundle.integrity?.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("listRunIds override is preferred over runRepository.list", async () => {
    const repo = new MemoryRunRepository();
    await seed(repo);
    const server = createWorkbenchMcpServer({
      runRepository: repo,
      listRunIds: async () => ["explicit-id"],
    });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(clientTransport);

    const list = await client.listResources();
    const uris = list.resources.map((r) => r.uri);
    expect(uris).toEqual(["runs://explicit-id"]);
  });

  it("respects custom name/version in initialize", async () => {
    const repo = new MemoryRunRepository();
    const server = createWorkbenchMcpServer({
      runRepository: repo,
      name: "custom",
      version: "9.9.9",
    });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(clientTransport);

    const info = client.getServerVersion();
    expect(info?.name).toBe("custom");
    expect(info?.version).toBe("9.9.9");
  });
});
