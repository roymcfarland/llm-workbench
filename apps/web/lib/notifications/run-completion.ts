import "server-only";

import {
  notifyRunCompletion,
  type NotifyResult,
  type RunNotificationStatus,
} from "./email";

const TERMINAL_STATUSES = new Set<RunNotificationStatus>([
  "completed",
  "failed",
  "cancelled",
]);

export function isTerminalRunStatus(
  status: string | null | undefined,
): status is RunNotificationStatus {
  return typeof status === "string"
    && TERMINAL_STATUSES.has(status as RunNotificationStatus);
}

export type RunCompletionNotifier = (args: {
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
}) => Promise<NotifyResult>;

export type MaybeFireArgs = {
  tenantId: string;
  runId: string;
  newStatus: string;
  priorStatus: string | null;
  workflowId?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  /** Override for tests. Defaults to the live Resend-backed notifier. */
  notifier?: RunCompletionNotifier;
  /** Override for tests. Defaults to Clerk's server SDK. */
  resolveRecipient?: (userId: string) => Promise<string | null>;
  /** Override for tests. Defaults to NEXT_PUBLIC_SITE_ORIGIN-derived value. */
  resolveSiteOrigin?: () => Promise<string>;
};

/**
 * Decide whether a run write is a transition into a terminal state and, if
 * so, fan out an email notification. Always returns a structured result so
 * the runs-store hot path can `void` it without losing observability.
 *
 * Decision matrix:
 *   - newStatus is non-terminal      → "skipped-non-terminal"
 *   - priorStatus equals newStatus   → "skipped-already-terminal" (idempotent)
 *   - tenant is an organisation      → "skipped-org-tenant" (v0 limitation)
 *   - recipient lookup fails / empty → "skipped-no-recipient"
 *   - otherwise                      → forwards to the notifier
 *
 * Errors from the notifier are caught and surfaced as `{ ok: false }`; the
 * function never throws.
 */
export async function maybeFireRunCompletionNotification(
  args: MaybeFireArgs,
): Promise<RunCompletionDispatchResult> {
  if (!isTerminalRunStatus(args.newStatus)) {
    return { ok: false, reason: "skipped-non-terminal" };
  }
  if (args.priorStatus === args.newStatus) {
    return { ok: false, reason: "skipped-already-terminal" };
  }

  const userId = extractUserId(args.tenantId);
  if (!userId) {
    console.info(
      "[run-completion] tenant is not user-scoped; skipping email (org tenants pending)",
      { tenantId: args.tenantId, runId: args.runId },
    );
    return { ok: false, reason: "skipped-org-tenant" };
  }

  let recipientEmail: string | null;
  try {
    const resolveRecipient = args.resolveRecipient ?? defaultResolveRecipient;
    recipientEmail = await resolveRecipient(userId);
  } catch (err) {
    console.error("[run-completion] recipient lookup threw", {
      runId: args.runId,
      userId,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: "skipped-no-recipient" };
  }
  if (!recipientEmail) {
    console.info("[run-completion] no email on file; skipping", {
      runId: args.runId,
      userId,
    });
    return { ok: false, reason: "skipped-no-recipient" };
  }

  let siteOrigin: string;
  try {
    const resolveSiteOrigin = args.resolveSiteOrigin ?? defaultResolveSiteOrigin;
    siteOrigin = await resolveSiteOrigin();
  } catch (err) {
    console.error("[run-completion] site origin resolution threw", {
      runId: args.runId,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: "skipped-no-origin" };
  }

  const notifier = args.notifier ?? notifyRunCompletion;
  const result = await notifier({
    run: {
      id: args.runId,
      status: args.newStatus,
      workflowId: args.workflowId ?? undefined,
      startedAt: args.startedAt ?? undefined,
      endedAt: args.endedAt ?? undefined,
      tenantId: args.tenantId,
    },
    recipientEmail,
    siteOrigin,
  });
  if (!result.ok) {
    return { ok: false, reason: "send-failed", detail: result.reason };
  }
  return { ok: true, emailId: result.emailId };
}

export type RunCompletionDispatchResult =
  | { ok: true; emailId: string }
  | {
      ok: false;
      reason:
        | "skipped-non-terminal"
        | "skipped-already-terminal"
        | "skipped-org-tenant"
        | "skipped-no-recipient"
        | "skipped-no-origin"
        | "send-failed";
      detail?: string;
    };

/**
 * Tenants are stored as either `user:<clerkUserId>` (single-user accounts) or
 * a Clerk organisation id (`org_*`). For now we only notify user-scoped
 * tenants — see SKILL note in the issue, org admin fan-out is future work.
 */
function extractUserId(tenantId: string): string | null {
  if (tenantId.startsWith("user:")) {
    const id = tenantId.slice("user:".length).trim();
    return id.length > 0 ? id : null;
  }
  return null;
}

async function defaultResolveRecipient(userId: string): Promise<string | null> {
  // Lazy-import Clerk to keep test runs fast and to avoid pulling Clerk into
  // the bundle when the feature is disabled (downstream tree-shaking).
  const { clerkClient } = await import("@clerk/nextjs/server");
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return user.primaryEmailAddress?.emailAddress ?? null;
}

async function defaultResolveSiteOrigin(): Promise<string> {
  const { siteOrigin } = await import("../site");
  return siteOrigin();
}
