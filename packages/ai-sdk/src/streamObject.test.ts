import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  WorkbenchRuntime,
  type WorkbenchSession,
} from "@llm-workbench/runtime";

const { streamObjectMock } = vi.hoisted(() => ({
  streamObjectMock: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: () => {
    throw new Error("unused");
  },
  streamText: () => {
    throw new Error("unused");
  },
  generateObject: () => {
    throw new Error("unused");
  },
  streamObject: (...args: unknown[]) => streamObjectMock(...args),
}));

const { tracedStreamObject } = await import("./streamObject.js");

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
  streamObjectMock.mockReset();
});

describe("tracedStreamObject", () => {
  it("emits a final response trace on onFinish and writes an artifact", async () => {
    let captured: { onFinish?: (e: unknown) => void } = {};
    streamObjectMock.mockImplementation((opts: Record<string, unknown>) => {
      captured = { onFinish: opts.onFinish as never };
      return {};
    });
    const { session } = startSession();
    tracedStreamObject(session, {
      model: { provider: "openai", modelId: "gpt-foo" },
      prompt: "hi",
      schema: { _def: {} } as never,
      writeArtifact: {
        artifactKey: "obj",
        typeId: "anyType",
      },
    } as never);

    captured.onFinish?.({
      object: { ok: true },
      usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
    });

    const trace = session.snapshot().trace;
    const responses = trace.filter(
      (e) => e.type === "model_io" && (e as { direction?: string }).direction === "response",
    ) as Array<{ usage?: { totalTokens?: number } }>;
    expect(responses).toHaveLength(1);
    expect(responses[0].usage?.totalTokens).toBe(5);

    const artifactWritten = trace.find((e) => e.type === "artifact_written") as
      | { artifact: { data: unknown } }
      | undefined;
    expect(artifactWritten?.artifact.data).toEqual({ ok: true });
  });

  it("reports stream errors as response traces", async () => {
    let captured: { onError?: (e: unknown) => void } = {};
    streamObjectMock.mockImplementation((opts: Record<string, unknown>) => {
      captured = { onError: opts.onError as never };
      return {};
    });
    const { session } = startSession();
    tracedStreamObject(session, {
      model: "gpt-foo",
      prompt: "hi",
      schema: { _def: {} } as never,
    } as never);

    captured.onError?.({ error: new Error("oops") });

    const final = session
      .snapshot()
      .trace.findLast?.((e) => e.type === "model_io") as
      | { direction: string; summary?: string }
      | undefined;
    expect(final?.direction).toBe("response");
    expect(final?.summary).toContain("error: oops");
  });
});
