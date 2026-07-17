import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SchemaRegistry,
  WorkbenchRuntime,
  type WorkbenchSession,
} from "@llm-workbench/runtime";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

const { generateObjectMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: () => {
    throw new Error("unused");
  },
  streamText: () => {
    throw new Error("unused");
  },
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
  streamObject: () => {
    throw new Error("unused");
  },
}));

const { tracedGenerateObject } = await import("./generateObject.js");

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
  generateObjectMock.mockReset();
});

describe("tracedGenerateObject", () => {
  it("validates against the registry and writes the artifact", async () => {
    generateObjectMock.mockResolvedValue({
      object: { headline: "hi", skills: ["ts"] },
      usage: { inputTokens: 4, outputTokens: 4, totalTokens: 8 },
    });
    const registry = new SchemaRegistry();
    registry.registerArtifactType({
      id: "compiledProfile",
      schema: {
        type: "object",
        required: ["headline", "skills"],
        properties: {
          headline: { type: "string", minLength: 1 },
          skills: { type: "array", items: { type: "string" }, minItems: 1 },
        },
        additionalProperties: false,
      },
    });
    const { session } = startSession();
    await tracedGenerateObject(session, {
      model: "gpt-foo",
      prompt: "make a profile",
      schema: { _def: {} } as never,
      writeArtifact: {
        artifactKey: "profile",
        typeId: "compiledProfile",
        registry,
      },
    } as never);

    const traces = session.snapshot().trace;
    const artifactTrace = traces.find((e) => e.type === "artifact_written") as
      | { artifact: { artifactKey: string; data: unknown } }
      | undefined;
    expect(artifactTrace?.artifact.artifactKey).toBe("profile");
    expect(artifactTrace?.artifact.data).toEqual({
      headline: "hi",
      skills: ["ts"],
    });
  });

  it("rejects when the result fails validation", async () => {
    generateObjectMock.mockResolvedValue({
      object: { headline: "" }, // missing skills, fails minLength
      usage: {},
    });
    const registry = new SchemaRegistry();
    registry.registerArtifactType({
      id: "compiledProfile",
      schema: {
        type: "object",
        required: ["headline", "skills"],
        properties: {
          headline: { type: "string", minLength: 1 },
          skills: { type: "array", items: { type: "string" }, minItems: 1 },
        },
        additionalProperties: false,
      },
    });
    const { session } = startSession();
    await expect(
      tracedGenerateObject(session, {
        model: "gpt-foo",
        prompt: "x",
        schema: { _def: {} } as never,
        writeArtifact: {
          artifactKey: "profile",
          typeId: "compiledProfile",
          registry,
        },
      } as never),
    ).rejects.toThrow(/failed validation/);
  });

  it("emits matched correlationId on request and response", async () => {
    generateObjectMock.mockResolvedValue({
      object: { ok: true },
      usage: {},
    });
    const { session } = startSession();
    await tracedGenerateObject(session, {
      model: "gpt-foo",
      prompt: "x",
      schema: { _def: {} } as never,
    } as never);
    const modelEvents = session
      .snapshot()
      .trace.filter((e) => e.type === "model_io") as Array<{
        direction: string;
        correlationId?: string;
      }>;
    expect(modelEvents).toHaveLength(2);
    expect(modelEvents[0].direction).toBe("request");
    expect(modelEvents[1].direction).toBe("response");
    expect(modelEvents[0].correlationId).toBe(modelEvents[1].correlationId);
  });

  it("uses AI SDK 7's real generateObject implementation with a mock model", async () => {
    vi.doUnmock("ai");
    vi.resetModules();
    const { tracedGenerateObject: tracedGenerateObjectWithRealAi } =
      await import("./generateObject.js");
    const model = new MockLanguageModelV4({
      provider: "mock-provider",
      modelId: "mock-model",
      doGenerate: {
        content: [{ type: "text", text: '{"headline":"real object"}' }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 6,
            noCache: 6,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 4, text: 4, reasoning: undefined },
        },
        response: { modelId: "mock-model" },
        warnings: [],
      },
    });
    const { session } = startSession();

    const result = await tracedGenerateObjectWithRealAi(session, {
      model,
      prompt: "create an object",
      schema: z.object({ headline: z.string() }),
    });

    expect(model.doGenerateCalls).toHaveLength(1);
    expect(result.object).toEqual({ headline: "real object" });
    const response = session.snapshot().trace.find(
      (event) => event.type === "model_io" && (event as { direction?: string }).direction === "response",
    ) as { usage?: { totalTokens?: number } } | undefined;
    expect(response?.usage?.totalTokens).toBe(10);
  });
});
