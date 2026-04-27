"use server";

import { generateObject } from "ai";

import { compiledProfileSchema, type CompiledProfile } from "@/lib/workflow/job-search";
import { requireTenant } from "@/lib/auth/tenant";

const DEMO_MODEL = "anthropic/claude-haiku-4-5";

export type CompileProfileResult = {
  profile: CompiledProfile;
  modelIo: {
    provider: string;
    model: string;
    durationMs: number;
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
    };
  };
};

/**
 * Compiles a structured profile from raw resume text via AI Gateway.
 *
 * The host page is responsible for replaying the result into the workbench
 * runtime (gate resolve, beginStep, writeArtifact, logModelIO,
 * completeStep). Keeping that bit on the client lets us reuse the live
 * `WorkbenchRuntime` instance without round-tripping its full state.
 */
export async function compileProfileAction(input: {
  resumeText: string;
}): Promise<CompileProfileResult> {
  // SECURITY: Even server actions must be tenant-scoped — Clerk gate first.
  await requireTenant();

  const trimmed = (input.resumeText ?? "").trim();
  if (trimmed.length < 10) {
    throw new Error("resumeText must be at least 10 characters");
  }
  if (trimmed.length > 8_000) {
    throw new Error("resumeText is too long (max 8000 characters)");
  }

  const start = Date.now();
  // AI SDK v5 routes plain "provider/model" strings through Vercel AI Gateway.
  // The `gateway()` wrapper is only needed when configuring providerOptions.
  const result = await generateObject({
    model: DEMO_MODEL,
    schema: compiledProfileSchema,
    system: [
      "You are an assistant that turns raw resume text into a compact",
      "structured profile. Always return valid JSON matching the provided",
      "schema. Be precise and avoid embellishment.",
    ].join(" "),
    prompt: `Resume text:\n\n${trimmed}`,
  });
  const durationMs = Date.now() - start;

  return {
    profile: result.object,
    modelIo: {
      provider: "anthropic",
      model: DEMO_MODEL,
      durationMs,
      usage: result.usage
        ? {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
          }
        : undefined,
    },
  };
}
