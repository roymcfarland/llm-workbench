import "server-only";

import { Resend } from "resend";

import {
  RunCompletionEmail,
  type RunCompletionEmailProps,
} from "@/emails/run-completion";

export type RunNotificationStatus = "completed" | "failed" | "cancelled";

export type NotifyRunCompletionArgs = {
  run: {
    id: string;
    status: RunNotificationStatus;
    workflowId?: string;
    startedAt?: string;
    endedAt?: string;
    tenantId: string;
  };
  recipientEmail: string;
  siteOrigin: string;
};

export type NotifyResult =
  | { ok: true; emailId: string }
  | { ok: false; reason: NotifyFailure };

export type NotifyFailure =
  | "resend-not-configured"
  | "invalid-recipient"
  | "send-failed"
  | "send-threw";

let cachedClient: Resend | null = null;
let cachedKey: string | null = null;

/**
 * Lazily build a singleton Resend client keyed on the active API key. We
 * intentionally do not throw on missing env — callers (the runs-store hot
 * path) treat un-configuration as opt-out. Returning a fresh client on key
 * change keeps the function compatible with vitest envs that swap process
 * env between cases.
 */
function getResend(apiKey: string): Resend {
  if (cachedClient && cachedKey === apiKey) return cachedClient;
  cachedClient = new Resend(apiKey);
  cachedKey = apiKey;
  return cachedClient;
}

export function subjectForStatus(args: {
  runId: string;
  status: RunNotificationStatus;
}): string {
  const short = args.runId.slice(0, 8);
  switch (args.status) {
    case "completed":
      return `Run completed · ${short}`;
    case "failed":
      return `Run failed · ${short}`;
    case "cancelled":
      return `Run cancelled · ${short}`;
  }
}

/**
 * Stable idempotency key per (runId, status). Resend dedupes on this for 24
 * hours, so even if the runs-store fires the email twice for the same
 * transition (e.g. retried request), only one email is delivered.
 */
export function idempotencyKeyFor(args: {
  runId: string;
  status: RunNotificationStatus;
}): string {
  return `run-completion/${args.runId}/${args.status}`;
}

function isLikelyEmail(value: string): boolean {
  // Cheap shape check; Resend does authoritative validation on its side.
  // We just want to fail loudly if Clerk hands us garbage / undefined.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildTemplateProps(args: NotifyRunCompletionArgs): RunCompletionEmailProps {
  const startedAt = args.run.startedAt ?? null;
  const endedAt = args.run.endedAt ?? null;
  let durationMs: number | null = null;
  if (startedAt && endedAt) {
    const delta = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    if (Number.isFinite(delta)) durationMs = Math.max(0, delta);
  }
  return {
    runId: args.run.id,
    status: args.run.status,
    workflowId: args.run.workflowId ?? null,
    startedAt,
    endedAt,
    durationMs,
    runUrl: `${args.siteOrigin}/runs/${encodeURIComponent(args.run.id)}`,
    preferencesUrl: `${args.siteOrigin}/playground`,
  };
}

/**
 * Send a run-completion notification via Resend.
 *
 * Returns a discriminated union — never throws — so the runs-store hot path
 * can call this with `void notifyRunCompletion(...)` without a try/catch.
 *
 * Configuration:
 *   - `RESEND_API_KEY`   : full-access (or sending-scoped) Resend key.
 *   - `RESEND_FROM`      : verified sender address, e.g. `agent@your-domain.com`.
 * If either is missing we treat the feature as disabled (info-level log,
 * not a warning) and return `{ ok: false, reason: "resend-not-configured" }`.
 */
export async function notifyRunCompletion(
  args: NotifyRunCompletionArgs,
): Promise<NotifyResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();
  if (!apiKey || !from) {
    console.info(
      "[notifyRunCompletion] RESEND_API_KEY/RESEND_FROM not set; skipping email send",
    );
    return { ok: false, reason: "resend-not-configured" };
  }

  if (!isLikelyEmail(args.recipientEmail)) {
    return { ok: false, reason: "invalid-recipient" };
  }

  const subject = subjectForStatus({
    runId: args.run.id,
    status: args.run.status,
  });
  const idempotencyKey = idempotencyKeyFor({
    runId: args.run.id,
    status: args.run.status,
  });
  const templateProps = buildTemplateProps(args);

  try {
    const client = getResend(apiKey);
    const { data, error } = await client.emails.send(
      {
        from,
        to: [args.recipientEmail],
        subject,
        react: RunCompletionEmail(templateProps),
      },
      { idempotencyKey },
    );
    if (error) {
      console.error("[notifyRunCompletion] resend send error", {
        runId: args.run.id,
        status: args.run.status,
        message: error.message,
        name: error.name,
      });
      return { ok: false, reason: "send-failed" };
    }
    if (!data?.id) {
      console.error("[notifyRunCompletion] resend returned no email id", {
        runId: args.run.id,
        status: args.run.status,
      });
      return { ok: false, reason: "send-failed" };
    }
    return { ok: true, emailId: data.id };
  } catch (err) {
    console.error("[notifyRunCompletion] threw", {
      runId: args.run.id,
      status: args.run.status,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: "send-threw" };
  }
}
