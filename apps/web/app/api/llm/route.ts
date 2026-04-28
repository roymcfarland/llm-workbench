import { NextResponse } from "next/server";
import { streamText } from "ai";

import { WorkbenchRuntime } from "@llm-workbench/runtime";
import { tracedStreamText } from "@llm-workbench/ai-sdk";

import { TenantAuthError, requireTenant } from "@/lib/auth/tenant";
import { publicInternalErrorMessage } from "@/lib/server/internal-error";
import {
  loadRunForTenant,
  saveRunForTenant,
  serializedToState,
} from "@/lib/supabase/runs-store";
import { isValidRunIdParam } from "@/lib/validation/run-id";

const DEMO_MODEL = "anthropic/claude-haiku-4-5";
/** Cap JSON body (prompt + optional runId/stepId); avoids huge ArrayBuffer.parse. */
const MAX_BODY_BYTES = 48 * 1024;

type LlmRequestBody = {
  prompt?: unknown;
  /** Optional: when provided, the call is traced into this run via `tracedStreamText`. */
  runId?: unknown;
  /** Step id the call belongs to. Required when `runId` is set. */
  stepId?: unknown;
};

/**
 * Minimal AI Gateway streaming proxy.
 *
 * If the request body includes `runId` + `stepId`, the call is wrapped in
 * `@llm-workbench/ai-sdk`'s `tracedStreamText`, which emits structured
 * `model_io` request/response/stream_chunk events into the workbench trace
 * and persists the updated state back to Supabase when the stream finishes.
 *
 * Without those fields the route degrades to plain `streamText` for callers
 * that just want a model surface (the common chat-style case).
 */
function withinBodyBudget(req: Request): boolean {
  const len = req.headers.get("content-length");
  if (!len) return true;
  const n = Number(len);
  if (!Number.isFinite(n)) return true;
  return n <= MAX_BODY_BYTES;
}

export async function POST(req: Request): Promise<Response> {
  try {
    if (!withinBodyBudget(req)) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }

    const buf = await req.arrayBuffer();
    if (buf.byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }

    const { tenantId } = await requireTenant();

    let body: LlmRequestBody;
    try {
      const text = new TextDecoder().decode(buf);
      body = text.length > 0 ? (JSON.parse(text) as LlmRequestBody) : {};
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }
    if (prompt.length > 4_000) {
      return NextResponse.json({ error: "prompt is too long" }, { status: 400 });
    }

    const runId = typeof body.runId === "string" ? body.runId : undefined;
    const stepId = typeof body.stepId === "string" ? body.stepId : undefined;

    if (runId && !isValidRunIdParam(runId)) {
      return NextResponse.json({ error: "Invalid runId" }, { status: 400 });
    }

    if (runId && stepId) {
      const row = await loadRunForTenant(tenantId, runId);
      if (!row) {
        return NextResponse.json({ error: "run not found" }, { status: 404 });
      }
      const state = serializedToState(row.state);
      const rt = new WorkbenchRuntime();
      rt.importState(state);
      const session = rt.session(runId);

      const result = tracedStreamText(session, {
        model: DEMO_MODEL,
        prompt,
        stepId,
        // Persist back once the stream finishes so traces survive the request.
        onFinish: async () => {
          const final = rt.getState(runId);
          if (final) await saveRunForTenant(tenantId, final);
        },
      });
      return result.toTextStreamResponse();
    }

    const result = streamText({
      model: DEMO_MODEL,
      prompt,
    });
    return result.toTextStreamResponse();
  } catch (e) {
    if (e instanceof TenantAuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    const message = publicInternalErrorMessage("api/llm POST", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
