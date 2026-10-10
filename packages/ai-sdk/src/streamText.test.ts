import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SchemaRegistry,
  WorkbenchRuntime,
  type TraceEvent,
  type WorkbenchSession,
} from "@llm-workbench/runtime";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { z } from "zod";

const { streamTextMock } = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: () => {
    throw new Error("unused in streamText tests");
  },
  streamText: (...args: unknown[]) => streamTextMock(...args),
  generateObject: () => {
    throw new Error("unused in streamText tests");
  },
  streamObject: () => {
    throw new Error("unused in streamText tests");
  },
}));

const { tracedStreamText } = await import("./streamText.js");

function startSession(): { session: WorkbenchSession } {
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
  return { session };
}

beforeEach(() => {
  streamTextMock.mockReset();
});

describe("tracedStreamText structured output with the real SDK", () => {
  const schema = z.object({ name: z.string(), count: z.number() });
  const object = { name: "Ada", count: 2 };

  function structuredModel() {
    return new MockLanguageModelV4({
      provider: "mock-provider",
      modelId: "mock-model",
      doStream: {
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start", warnings: [] },
            { type: "text-start", id: "text-1" },
            { type: "text-delta", id: "text-1", delta: '{"name":' },
            { type: "text-delta", id: "text-1", delta: '"Ada",' },
            { type: "text-delta", id: "text-1", delta: '"count":2}' },
            { type: "text-end", id: "text-1" },
            {
              type: "finish", finishReason: { unified: "stop", raw: undefined },
              usage: {
                inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 2, text: 2, reasoning: undefined },
              },
            },
          ],
        }),
      },
    });
  }

  function artifactRegistry() {
    const registry = new SchemaRegistry();
    registry.registerArtifactType({
      id: "profile",
      schema: {
        type: "object", properties: { name: { type: "string" }, count: { type: "number" } },
        required: ["name", "count"], additionalProperties: false,
      },
    });
    return registry;
  }

  async function realSdk() {
    vi.doUnmock("ai");
    vi.resetModules();
    const [{ Output }, { tracedStreamText }] = await Promise.all([
      import("ai"), import("./streamText.js"),
    ]);
    return { Output, tracedStreamText };
  }

  it("streams partial objects and projects the finish event's output into an artifact", async () => {
    const { Output, tracedStreamText } = await realSdk();
    const { session } = startSession();
    const model = structuredModel();
    const toData = vi.fn(({ text, result }: { text: string; result: unknown }) => {
      expect(text).toBe(JSON.stringify(object));
      expect(result).toMatchObject({ text, output: object });
      // The wrapper exposes the finish event as unknown, not the stream handle.
      return schema.parse((result as { output: unknown }).output);
    });
    const onFinish = vi.fn();
    const stream = tracedStreamText(session, {
      model, prompt: "Generate a profile", output: Output.object({ schema }), onFinish,
      writeArtifact: { artifactKey: "profile", typeId: "profile", registry: artifactRegistry(), toData },
    });
    const partials: unknown[] = [];
    for await (const partial of stream.partialOutputStream) partials.push(partial);

    expect(partials.length).toBeGreaterThan(1);
    expect(partials).toContainEqual({ name: "Ada" });
    expect(partials.at(-1)).toEqual(object);
    await expect(stream.output).resolves.toEqual(object);
    expect(model.doStreamCalls).toHaveLength(1);
    expect(model.doStreamCalls[0].responseFormat).toMatchObject({ type: "json" });
    expect(toData).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledOnce();
    const traces = session.snapshot().trace.filter((e) => e.type === "model_io");
    expect(traces[0]).toMatchObject({ direction: "request" });
    expect(traces[0].correlationId).toBeDefined();
    expect(traces.at(-1)).toMatchObject({
      direction: "response", correlationId: traces[0].correlationId,
      usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
    });
    expect(session.snapshot().trace.find((e) => e.type === "artifact_written"))
      .toMatchObject({ artifact: { artifactKey: "profile", typeId: "profile", data: object } });
  });

  it("persists JSON text by default after consuming partialOutputStream", async () => {
    const { Output, tracedStreamText } = await realSdk();
    const { session } = startSession();
    const stream = tracedStreamText(session, {
      model: structuredModel(), prompt: "Generate a profile", output: Output.object({ schema }),
      writeArtifact: { artifactKey: "profile", typeId: "profile" },
    });
    const partials: unknown[] = [];
    for await (const partial of stream.partialOutputStream) partials.push(partial);
    expect(partials.at(-1)).toEqual(object);
    expect(session.snapshot().trace.find((e) => e.type === "artifact_written"))
      .toMatchObject({ artifact: { data: JSON.stringify(object) } });
  });

  it("traces artifact validation failure without losing the final structured output", async () => {
    const { Output, tracedStreamText } = await realSdk();
    const { session } = startSession();
    const stream = tracedStreamText(session, {
      model: structuredModel(), prompt: "Generate a profile", output: Output.object({ schema }),
      writeArtifact: {
        artifactKey: "profile", typeId: "profile", registry: artifactRegistry(),
        toData: () => ({ name: "Ada", count: "invalid" }),
      },
    });
    const partials: unknown[] = [];
    for await (const partial of stream.partialOutputStream) partials.push(partial);
    expect(partials.at(-1)).toEqual(object);
    expect(session.snapshot().trace.some((e) => e.type === "artifact_written")).toBe(false);
    expect(session.snapshot().trace).toContainEqual(expect.objectContaining({
      type: "model_io", direction: "stream_chunk",
      summary: expect.stringContaining("artifact_write_failed: Artifact"),
    }));
    expect(session.snapshot().trace).toContainEqual(expect.objectContaining({
      type: "model_io", direction: "response", usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
    }));
  });
});

describe("tracedStreamText", () => {
  it("emits a request, debounced stream_chunk, and final response trace", async () => {
    let captured: {
      onChunk?: (e: unknown) => void;
      onFinish?: (e: unknown) => void;
      onError?: (e: unknown) => void;
    } = {};
    streamTextMock.mockImplementation((opts: Record<string, unknown>) => {
      captured = {
        onChunk: opts.onChunk as never,
        onFinish: opts.onFinish as never,
        onError: opts.onError as never,
      };
      return { _placeholder: true };
    });
    const { session } = startSession();

    const dateNow = vi
      .spyOn(Date, "now")
      // request emit, init lastEmit baseline, plus subsequent calls
      .mockReturnValueOnce(1_000) // startedAt
      .mockReturnValueOnce(1_005) // first onChunk now
      .mockReturnValueOnce(1_100) // second onChunk now (within debounce window)
      .mockReturnValueOnce(1_400) // third onChunk now (>250ms since lastEmit=1_005)
      .mockReturnValueOnce(2_000); // onFinish

    tracedStreamText(session, {
      model: { provider: "openai", modelId: "gpt-foo" },
      prompt: "stream please",
    } as never);

    // First chunk emits (lastEmit=0).
    captured.onChunk?.({ chunk: { type: "text-delta", text: "hello " } });
    // Within 250ms — should NOT emit a second stream_chunk.
    captured.onChunk?.({ chunk: { type: "text-delta", text: "wor" } });
    // After 250ms — should emit.
    captured.onChunk?.({ chunk: { type: "text-delta", text: "ld" } });

    captured.onFinish?.({
      text: "hello world",
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
      providerMetadata: {
        gateway: { cost: { amount: 0.001, currency: "USD" } },
      },
      response: { modelId: "gpt-real" },
    });

    dateNow.mockRestore();

    const traces = session.snapshot().trace as TraceEvent[];
    const modelTraces = traces.filter(
      (e) => e.type === "model_io",
    ) as Array<TraceEvent & { direction: string }>;

    expect(modelTraces.map((e) => e.direction)).toEqual([
      "request",
      "stream_chunk",
      "stream_chunk",
      "response",
    ]);
    const correlationIds = new Set(
      modelTraces.map((e) => (e as { correlationId?: string }).correlationId),
    );
    expect(correlationIds.size).toBe(1);

    const finalResponse = modelTraces[3];
    expect((finalResponse as { provider?: string }).provider).toBe("openai");
    expect((finalResponse as { model?: string }).model).toBe("gpt-real");
    expect(
      (finalResponse as { usage?: { totalTokens?: number } }).usage?.totalTokens,
    ).toBe(3);
    expect(
      (finalResponse as { cost?: { amount: number } }).cost?.amount,
    ).toBe(0.001);
    expect(
      typeof (finalResponse as { durationMs?: number }).durationMs,
    ).toBe("number");
  });

  it("forwards an emitted error to a model_io response trace and to user onError", async () => {
    let captured: { onError?: (e: unknown) => void } = {};
    streamTextMock.mockImplementation((opts: Record<string, unknown>) => {
      captured = { onError: opts.onError as never };
      return {};
    });
    const userOnError = vi.fn();
    const { session } = startSession();
    tracedStreamText(session, {
      model: "gpt-foo",
      prompt: "stream",
      onError: userOnError,
    } as never);

    captured.onError?.({ error: new Error("network down") });

    const traces = session
      .snapshot()
      .trace.filter((e) => e.type === "model_io") as Array<{
        direction: string;
        summary?: string;
      }>;
    expect(traces[0].direction).toBe("request");
    expect(traces[1].direction).toBe("response");
    expect(traces[1].summary).toContain("error: network down");
    expect(userOnError).toHaveBeenCalledOnce();
  });

  it("uses AI SDK 7 streaming chunks to emit text stream traces", async () => {
    vi.doUnmock("ai");
    vi.resetModules();
    const { tracedStreamText: tracedStreamTextWithRealAi } =
      await import("./streamText.js");
    const model = new MockLanguageModelV4({
      provider: "mock-provider",
      modelId: "mock-model",
      doStream: {
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start", warnings: [] },
            { type: "text-start", id: "text-1" },
            { type: "text-delta", id: "text-1", delta: "real " },
            { type: "reasoning-start", id: "reasoning-1" },
            {
              type: "reasoning-delta",
              id: "reasoning-1",
              delta: "ignored by trace text handling",
            },
            { type: "reasoning-end", id: "reasoning-1" },
            { type: "text-delta", id: "text-1", delta: "stream" },
            { type: "text-end", id: "text-1" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: undefined },
              usage: {
                inputTokens: {
                  total: 3,
                  noCache: 3,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: { total: 2, text: 2, reasoning: undefined },
              },
            },
          ],
        }),
      },
    });
    let now = 1_000;
    const dateNow = vi.spyOn(Date, "now").mockImplementation(() => {
      now += 300;
      return now;
    });
    const { session } = startSession();

    const result = tracedStreamTextWithRealAi(session, {
      model,
      prompt: "exercise real stream handling",
    });
    await expect(result.text).resolves.toBe("real stream");
    dateNow.mockRestore();

    expect(model.doStreamCalls).toHaveLength(1);
    const traces = session.snapshot().trace.filter(
      (event) => event.type === "model_io",
    ) as Array<{ direction?: string; summary?: string; usage?: { totalTokens?: number } }>;
    expect(traces.some((event) => event.direction === "stream_chunk" && event.summary === "real stream")).toBe(true);
    expect(traces.at(-1)?.usage?.totalTokens).toBe(5);
  });
});
