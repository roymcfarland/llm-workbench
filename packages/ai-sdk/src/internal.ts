import type { ModelCost, ModelUsage } from "@llm-workbench/runtime";

/**
 * Cross-platform `crypto.randomUUID()`. Falls back to a Math.random-based UUIDv4
 * if `globalThis.crypto.randomUUID` is missing (very old runtimes / jsdom).
 *
 * @internal
 */
export function newCorrelationId(): string {
  const c =
    typeof globalThis !== "undefined"
      ? (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
      : undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  // Fallback (not crypto-strong, but stable enough for in-process correlation).
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  const bytes = new Array(16)
    .fill(0)
    .map(() => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const b = bytes.map(hex).join("");
  return `${b.slice(0, 8)}-${b.slice(8, 12)}-${b.slice(12, 16)}-${b.slice(16, 20)}-${b.slice(20)}`;
}

/**
 * Normalize the AI SDK `usage` shape into LLM Workbench `ModelUsage`. Drops
 * undefined fields and returns `undefined` if no usable token counts are present.
 *
 * @internal
 */
export function usageFromAi(input: unknown): ModelUsage | undefined {
  if (!input || typeof input !== "object") return undefined;
  const u = input as Record<string, unknown>;
  const out: ModelUsage = {};
  const copy = (key: keyof ModelUsage) => {
    const v = u[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[key] = Math.round(v);
    }
  };
  copy("inputTokens");
  copy("outputTokens");
  copy("totalTokens");
  copy("cachedInputTokens");
  copy("reasoningTokens");
  if (Object.keys(out).length === 0) return undefined;
  return out;
}

/**
 * Resolve `{ provider, model }` from an AI SDK model option (string or
 * `LanguageModelV2`-like object) and an optional result. Result `response.modelId`
 * wins when present so we report the model the provider actually used.
 *
 * @internal
 */
export function resolveProviderModel(
  modelOpt: unknown,
  result?: unknown,
): { provider?: string; model?: string } {
  let provider: string | undefined;
  let model: string | undefined;
  if (typeof modelOpt === "string") {
    model = modelOpt;
  } else if (modelOpt && typeof modelOpt === "object") {
    const m = modelOpt as { provider?: unknown; modelId?: unknown };
    if (typeof m.provider === "string") provider = m.provider;
    if (typeof m.modelId === "string") model = m.modelId;
  }
  if (result && typeof result === "object") {
    const r = result as { response?: { modelId?: unknown } };
    if (
      r.response &&
      typeof r.response === "object" &&
      typeof r.response.modelId === "string"
    ) {
      model = r.response.modelId;
    }
  }
  return { provider, model };
}

/**
 * Extract a short text summary from the inbound options' `prompt`, `messages`,
 * or `system`. Truncates to 200 characters so traces stay bounded.
 *
 * @internal
 */
export function summarizePromptInput(opts: unknown): string | undefined {
  if (!opts || typeof opts !== "object") return undefined;
  const o = opts as Record<string, unknown>;
  const truncate = (text: string) =>
    text.length > 200 ? text.slice(0, 200) : text;
  if (typeof o.prompt === "string" && o.prompt.length > 0) {
    return truncate(o.prompt);
  }
  if (Array.isArray(o.messages) && o.messages.length > 0) {
    const last = o.messages[o.messages.length - 1];
    const text = extractMessageText(last);
    if (text) return truncate(text);
  }
  if (typeof o.system === "string" && o.system.length > 0) {
    return truncate(o.system);
  }
  return undefined;
}

/**
 * Best-effort text extraction from an AI SDK message. Handles string content
 * and `[{ type: "text", text: string }, ...]` content arrays.
 *
 * @internal
 */
export function extractMessageText(message: unknown): string | undefined {
  if (!message || typeof message !== "object") return undefined;
  const m = message as { content?: unknown };
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) {
    const parts: string[] = [];
    for (const part of m.content) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        parts.push((part as { text: string }).text);
      }
    }
    if (parts.length > 0) return parts.join("\n");
  }
  return undefined;
}

/**
 * Extract a `ModelCost` from `result.providerMetadata`. Recognises the Vercel
 * AI Gateway shape (`providerMetadata.gateway.cost`) where `cost` may be either
 * `{ amount, currency }`, a number, or a numeric string.
 */
export function costFromGatewayMetadata(
  providerMetadata: unknown,
): ModelCost | undefined {
  if (!providerMetadata || typeof providerMetadata !== "object") return undefined;
  const gw = (providerMetadata as Record<string, unknown>).gateway;
  if (!gw || typeof gw !== "object") return undefined;
  const cost = (gw as Record<string, unknown>).cost;
  if (cost == null) return undefined;
  if (typeof cost === "object") {
    const c = cost as { amount?: unknown; currency?: unknown };
    const amount =
      typeof c.amount === "number"
        ? c.amount
        : typeof c.amount === "string"
          ? Number(c.amount)
          : NaN;
    const currency = typeof c.currency === "string" ? c.currency : "USD";
    if (Number.isFinite(amount) && amount >= 0) {
      return { amount, currency };
    }
    return undefined;
  }
  const amount =
    typeof cost === "number"
      ? cost
      : typeof cost === "string"
        ? Number(cost)
        : NaN;
  if (Number.isFinite(amount) && amount >= 0) {
    return { amount, currency: "USD" };
  }
  return undefined;
}

/**
 * Coerce arbitrary errors (rejected promises, thrown unknowns) into
 * `{ message, code? }` form for trace events.
 *
 * @internal
 */
export function errorToTrace(err: unknown): { message: string; code?: string } {
  if (err instanceof Error) {
    const code = (err as { code?: unknown }).code;
    return {
      message: err.message,
      code: typeof code === "string" ? code : undefined,
    };
  }
  if (typeof err === "string") return { message: err };
  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: String(err) };
  }
}
