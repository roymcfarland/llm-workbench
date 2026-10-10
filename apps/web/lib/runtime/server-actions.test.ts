import { beforeEach, describe, expect, it, vi } from "vitest";

const aiMocks = vi.hoisted(() => ({ generateText: vi.fn() }));

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
  listRunsForTenant: vi.fn().mockResolvedValue([]),
  loadRunForTenant: vi.fn().mockResolvedValue(null),
  saveRunForTenant: vi.fn().mockResolvedValue(undefined),
  deleteRunForTenant: vi.fn().mockResolvedValue(undefined),
  serializedToState: vi.fn(),
  stateToSerialized: vi.fn(),
}));
vi.mock("ai", async (importActual) => {
  const { NoObjectGeneratedError, NoOutputGeneratedError } = await importActual<typeof import("ai")>();
  return {
    streamText: vi.fn(),
    generateText: aiMocks.generateText,
    Output: {
      object: vi.fn(({ schema }) => ({ kind: "compiled-profile-output", schema })),
    },
    NoObjectGeneratedError,
    NoOutputGeneratedError,
  };
});

import { TenantAuthError, requireTenant } from "@/lib/auth/tenant";
import * as store from "@/lib/supabase/runs-store";
import { generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output, streamText } from "ai";
import { compiledProfileSchema, type CompiledProfile } from "@/lib/workflow/job-search";
import { compileProfileAction } from "./server-actions";

const profile: CompiledProfile = {
  headline: "Senior TypeScript engineer",
  skills: ["TypeScript", "React"],
  summary: "Eight years of experience building reliable web applications.",
  yearsExperience: 8,
};

beforeEach(() => {
  vi.clearAllMocks();
  aiMocks.generateText.mockReset();
  aiMocks.generateText.mockResolvedValue({
    output: profile,
    usage: { inputTokens: 123, outputTokens: 45 },
  });
  vi.mocked(requireTenant).mockResolvedValue({ userId: "user_a", tenantId: "tenant-a" });
});

function expectNoStoreCalls() {
  for (const mock of Object.values(store)) expect(mock).not.toHaveBeenCalled();
}

describe("compileProfileAction tenant boundary", () => {
  it("rejects a signed-out caller before resume validation or downstream access", async () => {
    vi.mocked(requireTenant).mockRejectedValue(new TenantAuthError());
    const result = compileProfileAction({ resumeText: "short" });
    await expect(result).rejects.toBeInstanceOf(TenantAuthError);
    await expect(result).rejects.toThrow("Authentication required");
    expect(generateText).not.toHaveBeenCalled();
    expect(streamText).not.toHaveBeenCalled();
    expectNoStoreCalls();
  });

  it("rejects a signed-out caller with valid resume text before model access", async () => {
    vi.mocked(requireTenant).mockRejectedValue(new TenantAuthError());
    await expect(compileProfileAction({ resumeText: "Senior TypeScript engineer" }))
      .rejects.toBeInstanceOf(TenantAuthError);
    expect(generateText).not.toHaveBeenCalled();
    expect(Output.object).not.toHaveBeenCalled();
    expectNoStoreCalls();
  });
});

describe("compileProfileAction structured output", () => {
  it("uses the profile schema and returns the parsed output and token usage", async () => {
    const result = await compileProfileAction({ resumeText: "  Senior TypeScript engineer  " });
    expect(requireTenant).toHaveBeenCalledOnce();
    expect(Output.object).toHaveBeenCalledExactlyOnceWith({ schema: compiledProfileSchema });
    const output = vi.mocked(Output.object).mock.results[0].value;
    expect(output).toEqual({ kind: "compiled-profile-output", schema: compiledProfileSchema });
    expect(generateText).toHaveBeenCalledExactlyOnceWith({
      model: "anthropic/claude-haiku-4-5",
      output,
      system: "You are an assistant that turns raw resume text into a compact structured profile. Always return valid JSON matching the provided schema. Be precise and avoid embellishment.",
      prompt: "Resume text:\n\nSenior TypeScript engineer",
    });
    expect(result.profile).toBe(profile);
    expect(result.modelIo).toEqual({
      provider: "anthropic",
      model: "anthropic/claude-haiku-4-5",
      durationMs: expect.any(Number),
      usage: { inputTokens: 123, outputTokens: 45 },
    });
  });

  it("rejects undefined output with a clear error", async () => {
    aiMocks.generateText.mockResolvedValue({ output: undefined });
    await expect(compileProfileAction({ resumeText: "Senior TypeScript engineer" }))
      .rejects.toThrow("No compiled profile generated: output is undefined");
    expect(generateText).toHaveBeenCalledOnce();
  });

  it("rethrows a NoObjectGeneratedError unchanged", async () => {
    const error = new NoObjectGeneratedError({
      message: "No object generated: response did not match schema.",
      response: { id: "response-1", timestamp: new Date(), modelId: "mock-model" },
      usage: {
        inputTokens: 123,
        outputTokens: 45,
        totalTokens: 168,
        inputTokenDetails: { noCacheTokens: 123, cacheReadTokens: 0, cacheWriteTokens: 0 },
        outputTokenDetails: { textTokens: 45, reasoningTokens: 0 },
      },
      finishReason: "stop",
    });
    aiMocks.generateText.mockRejectedValue(error);
    await expect(compileProfileAction({ resumeText: "Senior TypeScript engineer" }))
      .rejects.toBe(error);
  });

  it("rejects with the NoOutputGeneratedError thrown by the output getter", async () => {
    const error = new NoOutputGeneratedError();
    aiMocks.generateText.mockResolvedValue({
      get output() {
        throw error;
      },
    });
    await expect(compileProfileAction({ resumeText: "Senior TypeScript engineer" }))
      .rejects.toBe(error);
  });
});
