import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  WorkbenchRuntime,
  type TraceEvent,
  type WorkbenchSession,
} from "@llm-workbench/runtime";

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
});
