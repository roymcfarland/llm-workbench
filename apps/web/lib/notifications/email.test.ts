import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock, ResendCtorMock } = vi.hoisted(() => {
  const send = vi.fn();
  // vi.fn arrow factories cannot be invoked with `new`; use a real function
  // declaration so the SDK's `new Resend(apiKey)` call site works in tests.
  const ctor = vi.fn(function MockResend() {
    return { emails: { send } };
  });
  return { sendMock: send, ResendCtorMock: ctor };
});

vi.mock("resend", () => ({
  Resend: ResendCtorMock,
}));

import {
  idempotencyKeyFor,
  notifyRunCompletion,
  subjectForStatus,
} from "./email";

const RUN = {
  id: "8f4a3c2e-1b9d-4d77-8b2e-7c6e0f4a1de2",
  status: "completed" as const,
  workflowId: "job-search-v3",
  startedAt: "2026-04-27T19:55:12.000Z",
  endedAt: "2026-04-27T19:57:48.000Z",
  tenantId: "user:user_abc",
};
const SITE_ORIGIN = "https://workbench.example.com";
const RECIPIENT = "delivered@resend.dev";

describe("subjectForStatus", () => {
  const id = "abcdef0123456789";

  it("uses 'completed' subject", () => {
    expect(subjectForStatus({ runId: id, status: "completed" })).toBe(
      "Run completed · abcdef01",
    );
  });

  it("uses 'failed' subject", () => {
    expect(subjectForStatus({ runId: id, status: "failed" })).toBe(
      "Run failed · abcdef01",
    );
  });

  it("uses 'cancelled' subject", () => {
    expect(subjectForStatus({ runId: id, status: "cancelled" })).toBe(
      "Run cancelled · abcdef01",
    );
  });

  it("truncates the run id to 8 chars regardless of length", () => {
    expect(subjectForStatus({ runId: "x", status: "completed" })).toBe(
      "Run completed · x",
    );
    expect(
      subjectForStatus({
        runId: "0123456789abcdef0123456789abcdef",
        status: "failed",
      }),
    ).toBe("Run failed · 01234567");
  });
});

describe("idempotencyKeyFor", () => {
  it("produces a stable key for the same (runId, status)", () => {
    const k1 = idempotencyKeyFor({ runId: RUN.id, status: "completed" });
    const k2 = idempotencyKeyFor({ runId: RUN.id, status: "completed" });
    expect(k1).toBe(k2);
  });

  it("differs when status differs", () => {
    const k1 = idempotencyKeyFor({ runId: RUN.id, status: "completed" });
    const k2 = idempotencyKeyFor({ runId: RUN.id, status: "failed" });
    const k3 = idempotencyKeyFor({ runId: RUN.id, status: "cancelled" });
    expect(new Set([k1, k2, k3]).size).toBe(3);
  });

  it("differs when run id differs", () => {
    const k1 = idempotencyKeyFor({ runId: "a", status: "completed" });
    const k2 = idempotencyKeyFor({ runId: "b", status: "completed" });
    expect(k1).not.toBe(k2);
  });

  it("includes the run id and status in the key", () => {
    const key = idempotencyKeyFor({ runId: "run-xyz", status: "failed" });
    expect(key).toContain("run-xyz");
    expect(key).toContain("failed");
  });

  it("stays under Resend's 256-character limit", () => {
    const longId = "x".repeat(220);
    const key = idempotencyKeyFor({ runId: longId, status: "completed" });
    expect(key.length).toBeLessThanOrEqual(256);
  });
});

describe("notifyRunCompletion", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    sendMock.mockReset();
    ResendCtorMock.mockClear();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns resend-not-configured when RESEND_API_KEY is missing", async () => {
    process.env.RESEND_FROM = "agent@example.com";
    const result = await notifyRunCompletion({
      run: RUN,
      recipientEmail: RECIPIENT,
      siteOrigin: SITE_ORIGIN,
    });
    expect(result).toEqual({ ok: false, reason: "resend-not-configured" });
    expect(ResendCtorMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns resend-not-configured when RESEND_FROM is missing", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const result = await notifyRunCompletion({
      run: RUN,
      recipientEmail: RECIPIENT,
      siteOrigin: SITE_ORIGIN,
    });
    expect(result).toEqual({ ok: false, reason: "resend-not-configured" });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("flags an obviously-malformed recipient address before sending", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM = "agent@example.com";
    const result = await notifyRunCompletion({
      run: RUN,
      recipientEmail: "not-an-email",
      siteOrigin: SITE_ORIGIN,
    });
    expect(result).toEqual({ ok: false, reason: "invalid-recipient" });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends with subject, idempotency key, and React body", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM = "agent@example.com";
    sendMock.mockResolvedValueOnce({ data: { id: "email_123" }, error: null });

    const result = await notifyRunCompletion({
      run: RUN,
      recipientEmail: RECIPIENT,
      siteOrigin: SITE_ORIGIN,
    });

    expect(result).toEqual({ ok: true, emailId: "email_123" });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const [payload, opts] = sendMock.mock.calls[0]!;
    expect(payload.from).toBe("agent@example.com");
    expect(payload.to).toEqual([RECIPIENT]);
    expect(payload.subject).toBe(subjectForStatus({
      runId: RUN.id,
      status: RUN.status,
    }));
    expect(payload.react).toBeDefined();
    expect(opts.idempotencyKey).toBe(idempotencyKeyFor({
      runId: RUN.id,
      status: RUN.status,
    }));
  });

  it("classifies SDK { error } shape as send-failed without throwing", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM = "agent@example.com";
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { name: "validation_error", message: "rate limited" },
    });
    const result = await notifyRunCompletion({
      run: RUN,
      recipientEmail: RECIPIENT,
      siteOrigin: SITE_ORIGIN,
    });
    expect(result).toEqual({ ok: false, reason: "send-failed" });
  });

  it("classifies a thrown SDK error as send-threw", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM = "agent@example.com";
    sendMock.mockRejectedValueOnce(new Error("network down"));
    const result = await notifyRunCompletion({
      run: RUN,
      recipientEmail: RECIPIENT,
      siteOrigin: SITE_ORIGIN,
    });
    expect(result).toEqual({ ok: false, reason: "send-threw" });
  });

  it("treats an empty data.id as send-failed", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM = "agent@example.com";
    sendMock.mockResolvedValueOnce({ data: { id: "" }, error: null });
    const result = await notifyRunCompletion({
      run: RUN,
      recipientEmail: RECIPIENT,
      siteOrigin: SITE_ORIGIN,
    });
    expect(result).toEqual({ ok: false, reason: "send-failed" });
  });
});
