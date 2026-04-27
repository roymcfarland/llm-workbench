import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SchemaRegistry,
  WorkbenchRuntime,
  type TraceEvent,
  type WorkbenchSession,
} from "@llm-workbench/runtime";

const { generateTextMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => generateTextMock(...args),
  // streamText/generateObject/streamObject are not exercised here but must exist
  // so any incidental imports don't fail in the wrapped module.
  streamText: () => {
    throw new Error("streamText should not be called from generateText tests");
  },
  generateObject: () => {
    throw new Error(
      "generateObject should not be called from generateText tests",
    );
  },
  streamObject: () => {
    throw new Error(
      "streamObject should not be called from generateText tests",
    );
  },
}));

const { tracedGenerateText } = await import("./generateText.js");

function startSession(): { session: WorkbenchSession; runtime: WorkbenchRuntime } {
  const runtime = new WorkbenchRuntime();
  const { runId } = runtime.startRun({
    workflow: {
      id: "wf",
      version: 1,
      steps: [{ id: "step", gatePolicy: "AUTO" }],
      edges: [],
    },
  });
  const session = runtime.session(runId);
  session.beginStep("step");
  return { session, runtime };
}

function modelTraces(session: WorkbenchSession): TraceEvent[] {
  return session
    .snapshot()
    .trace.filter((e) => e.type === "model_io" || e.type === "tool_call" || e.type === "error");
}

beforeEach(() => {
  generateTextMock.mockReset();
});

describe("tracedGenerateText", () => {
  it("emits correlated request and response model_io traces with durationMs", async () => {
    generateTextMock.mockResolvedValue({
      text: "hi there",
      toolCalls: [],
      toolResults: [],
      usage: { inputTokens: 5, outputTokens: 7, totalTokens: 12 },
      response: { modelId: "gpt-real" },
    });
    const { session } = startSession();

    await tracedGenerateText(session, {
      stepId: "step",
      model: { provider: "openai", modelId: "gpt-foo" },
      prompt: "Say hi",
    } as never);

    const traces = modelTraces(session);
    expect(traces).toHaveLength(2);
    const [req, res] = traces;
    expect(req.type).toBe("model_io");
    expect(res.type).toBe("model_io");
    expect((req as { direction: string }).direction).toBe("request");
    expect((res as { direction: string }).direction).toBe("response");
    expect((req as { correlationId?: string }).correlationId).toBeDefined();
    expect((req as { correlationId?: string }).correlationId).toBe(
      (res as { correlationId?: string }).correlationId,
    );
    expect((res as { provider?: string }).provider).toBe("openai");
    expect((res as { model?: string }).model).toBe("gpt-real");
    expect((res as { usage?: { inputTokens?: number } }).usage?.inputTokens).toBe(5);
    expect(typeof (res as { durationMs?: number }).durationMs).toBe("number");
    expect((res as { durationMs?: number }).durationMs ?? -1).toBeGreaterThanOrEqual(0);
    expect((req as { summary?: string }).summary).toBe("Say hi");
  });

  it("captures cost from Vercel AI Gateway providerMetadata", async () => {
    generateTextMock.mockResolvedValue({
      text: "ok",
      toolCalls: [],
      toolResults: [],
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      providerMetadata: {
        gateway: { cost: { amount: 0.0042, currency: "USD" } },
      },
    });
    const { session } = startSession();
    await tracedGenerateText(session, {
      model: "gpt-foo",
      prompt: "hi",
    } as never);
    const response = modelTraces(session).find(
      (e) => (e as { direction?: string }).direction === "response",
    ) as { cost?: { amount: number; currency: string } } | undefined;
    expect(response?.cost).toEqual({ amount: 0.0042, currency: "USD" });
  });

  it("emits tool_call events for each result.toolCalls + matching toolResults", async () => {
    generateTextMock.mockResolvedValue({
      text: "",
      toolCalls: [
        { toolCallId: "c1", toolName: "lookup", input: { id: 1 } },
        { toolCallId: "c2", toolName: "lookup", input: { id: 2 } },
      ],
      toolResults: [
        { toolCallId: "c1", toolName: "lookup", output: { value: "one" } },
        { toolCallId: "c2", toolName: "lookup", output: { value: "two" } },
      ],
      usage: {},
    });
    const { session } = startSession();
    await tracedGenerateText(session, {
      model: "gpt-foo",
      prompt: "do work",
    } as never);
    const calls = session
      .snapshot()
      .trace.filter((e) => e.type === "tool_call");
    expect(calls).toHaveLength(2);
    expect((calls[0] as { name: string; result?: unknown }).name).toBe("lookup");
    expect((calls[0] as { args?: { id: number } }).args).toEqual({ id: 1 });
    expect((calls[1] as { result?: unknown }).result).toEqual({ value: "two" });
    const correlationIds = new Set(
      calls.map((c) => (c as { correlationId?: string }).correlationId),
    );
    expect(correlationIds.size).toBe(1);
  });

  it("validates and writes an artifact when writeArtifact is provided", async () => {
    generateTextMock.mockResolvedValue({
      text: "synthesized output",
      toolCalls: [],
      toolResults: [],
      usage: {},
    });
    const registry = new SchemaRegistry();
    registry.registerArtifactType({
      id: "summaryDoc",
      schema: { type: "string", minLength: 1 },
    });
    const { session } = startSession();
    await tracedGenerateText(session, {
      model: "gpt-foo",
      prompt: "hi",
      writeArtifact: {
        artifactKey: "summary",
        typeId: "summaryDoc",
        registry,
      },
    } as never);
    const artifactTrace = session
      .snapshot()
      .trace.find((e) => e.type === "artifact_written");
    expect(artifactTrace).toBeDefined();
    expect(
      (artifactTrace as { artifact: { artifactKey: string; data: unknown } })
        .artifact.artifactKey,
    ).toBe("summary");
    expect(
      (artifactTrace as { artifact: { data: unknown } }).artifact.data,
    ).toBe("synthesized output");
  });

  it("emits an error trace and rethrows when generateText rejects", async () => {
    generateTextMock.mockRejectedValue(new Error("boom"));
    const { session } = startSession();
    await expect(
      tracedGenerateText(session, {
        model: "gpt-foo",
        prompt: "hi",
      } as never),
    ).rejects.toThrow("boom");
    const traces = modelTraces(session);
    // request + error response
    expect(traces).toHaveLength(2);
    const last = traces[1] as { direction?: string; summary?: string };
    expect(last.direction).toBe("response");
    expect(last.summary).toContain("error: boom");
  });
});
