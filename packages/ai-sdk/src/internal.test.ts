import { describe, expect, it } from "vitest";
import {
  costFromGatewayMetadata,
  newCorrelationId,
  resolveProviderModel,
  summarizePromptInput,
  usageFromAi,
} from "./internal.js";

describe("usageFromAi", () => {
  it("maps all known fields", () => {
    expect(
      usageFromAi({
        inputTokens: 12,
        outputTokens: 34,
        totalTokens: 46,
        cachedInputTokens: 2,
        reasoningTokens: 3,
        // unknown field should be dropped
        bogus: 99,
      }),
    ).toEqual({
      inputTokens: 12,
      outputTokens: 34,
      totalTokens: 46,
      cachedInputTokens: 2,
      reasoningTokens: 3,
    });
  });

  it("returns undefined when nothing usable", () => {
    expect(usageFromAi(undefined)).toBeUndefined();
    expect(usageFromAi({})).toBeUndefined();
    expect(usageFromAi({ inputTokens: -1 })).toBeUndefined();
  });
});

describe("costFromGatewayMetadata", () => {
  it("extracts cost amount/currency from gateway shape", () => {
    expect(
      costFromGatewayMetadata({
        gateway: { cost: { amount: 0.012, currency: "USD" } },
      }),
    ).toEqual({ amount: 0.012, currency: "USD" });
  });

  it("accepts numeric strings and bare numbers (defaults USD)", () => {
    expect(costFromGatewayMetadata({ gateway: { cost: "0.5" } })).toEqual({
      amount: 0.5,
      currency: "USD",
    });
    expect(costFromGatewayMetadata({ gateway: { cost: 0.25 } })).toEqual({
      amount: 0.25,
      currency: "USD",
    });
  });

  it("returns undefined when no gateway metadata", () => {
    expect(costFromGatewayMetadata(undefined)).toBeUndefined();
    expect(costFromGatewayMetadata({})).toBeUndefined();
    expect(costFromGatewayMetadata({ gateway: {} })).toBeUndefined();
  });
});

describe("resolveProviderModel", () => {
  it("uses string model fallback", () => {
    expect(resolveProviderModel("gpt-foo")).toEqual({ model: "gpt-foo" });
  });

  it("reads provider+modelId from object models", () => {
    expect(
      resolveProviderModel({ provider: "openai", modelId: "gpt-bar" }),
    ).toEqual({ provider: "openai", model: "gpt-bar" });
  });

  it("prefers result.response.modelId when present", () => {
    expect(
      resolveProviderModel(
        { provider: "openai", modelId: "gpt-foo" },
        { response: { modelId: "gpt-real" } },
      ),
    ).toEqual({ provider: "openai", model: "gpt-real" });
  });
});

describe("summarizePromptInput", () => {
  it("truncates long prompts to 200 chars", () => {
    const long = "x".repeat(500);
    expect(summarizePromptInput({ prompt: long })?.length).toBe(200);
  });

  it("falls back to last message text", () => {
    expect(
      summarizePromptInput({
        messages: [
          { role: "user", content: "ignored" },
          { role: "user", content: "final" },
        ],
      }),
    ).toBe("final");
  });

  it("flattens text-part arrays", () => {
    expect(
      summarizePromptInput({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "alpha" },
              { type: "text", text: "beta" },
            ],
          },
        ],
      }),
    ).toBe("alpha\nbeta");
  });
});

describe("newCorrelationId", () => {
  it("generates unique ids", () => {
    const a = newCorrelationId();
    const b = newCorrelationId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
  });
});
