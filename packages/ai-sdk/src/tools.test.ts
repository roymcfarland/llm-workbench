import { describe, expect, it, vi } from "vitest";
import {
  WorkbenchRuntime,
  type WorkbenchSession,
} from "@llm-workbench/runtime";

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
  streamObject: () => {
    throw new Error("unused");
  },
}));

const { traceTools } = await import("./tools.js");

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

describe("traceTools", () => {
  it("emits a tool_call trace when execute resolves", async () => {
    const { session } = startSession();
    const tools = traceTools(
      session,
      {
        echo: {
          description: "Return the input",
          execute: async (input: { msg: string }) => ({ echoed: input.msg }),
        },
      },
      { stepId: "step" },
    );

    const result = await (
      tools.echo as { execute: (input: unknown) => Promise<unknown> }
    ).execute({ msg: "hi" });
    expect(result).toEqual({ echoed: "hi" });

    const calls = session
      .snapshot()
      .trace.filter((e) => e.type === "tool_call") as Array<{
        name: string;
        args?: unknown;
        result?: unknown;
        correlationId?: string;
      }>;
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("echo");
    expect(calls[0].args).toEqual({ msg: "hi" });
    expect(calls[0].result).toEqual({ echoed: "hi" });
    expect(calls[0].correlationId).toBeDefined();
  });

  it("emits an error tool_call and rethrows when execute rejects", async () => {
    const { session } = startSession();
    const tools = traceTools(session, {
      bomb: {
        execute: async () => {
          throw new Error("boom");
        },
      },
    });
    await expect(
      (tools.bomb as { execute: (input: unknown) => Promise<unknown> }).execute(
        {},
      ),
    ).rejects.toThrow("boom");
    const calls = session
      .snapshot()
      .trace.filter((e) => e.type === "tool_call") as Array<{
        result?: { error?: string };
      }>;
    expect(calls).toHaveLength(1);
    expect(calls[0].result?.error).toBe("boom");
  });

  it("preserves tools that have no execute", () => {
    const { session } = startSession();
    const tools = traceTools(session, {
      pure: { description: "client-side tool", inputSchema: {} },
    } as Record<string, unknown>);
    expect(
      (tools as Record<string, { execute?: unknown }>).pure.execute,
    ).toBeUndefined();
  });
});
