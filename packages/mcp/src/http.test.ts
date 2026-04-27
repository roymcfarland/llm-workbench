import { describe, expect, it } from "vitest";

import { MemoryRunRepository, WorkbenchRuntime } from "@llm-workbench/runtime";

import { createWorkbenchMcpHttpHandler } from "./http.js";
import { createWorkbenchMcpServer } from "./server.js";

const initializeRequest = (id: number) =>
  JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "http-test", version: "0.0.0" },
    },
  });

const callToolRequest = (id: number, name: string, args: Record<string, unknown>) =>
  JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  });

function postRequest(body: string): Request {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body,
  });
}

describe("createWorkbenchMcpHttpHandler", () => {
  it("returns a Web-standard handler that speaks MCP over HTTP", async () => {
    const repo = new MemoryRunRepository();
    const rt = new WorkbenchRuntime();
    const { runId } = rt.startRun({
      workflow: { id: "wf", version: 1, steps: [{ id: "a", gatePolicy: "AUTO" }], edges: [] },
    });
    rt.session(runId).annotate({ text: "x" });
    await repo.save(rt.getState(runId)!);

    const server = createWorkbenchMcpServer({ runRepository: repo });
    const handle = createWorkbenchMcpHttpHandler({ server });

    const initRes = await handle(postRequest(initializeRequest(1)));
    expect(initRes.status).toBe(200);
    const initBody = (await initRes.json()) as { result: { serverInfo: { name: string } } };
    expect(initBody.result.serverInfo.name).toBe("llm-workbench");

    const callRes = await handle(postRequest(callToolRequest(2, "list_runs", {})));
    expect(callRes.status).toBe(200);
    const callBody = (await callRes.json()) as {
      result: { content: Array<{ type: string; text: string }> };
    };
    const text = callBody.result.content[0]?.text ?? "";
    const metas = JSON.parse(text) as Array<{ id: string }>;
    expect(metas.map((m) => m.id)).toContain(runId);
  });
});
