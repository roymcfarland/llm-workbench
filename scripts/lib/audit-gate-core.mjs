// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT

const AUDIT_REPORT_MARKER = "NPM audit report results:";
const DEFAULT_ATTEMPTS = 2;

export const TRANSIENT_AUDIT_MARKERS = Object.freeze([
  "code undefined:",
  "audit endpoint returned an error",
  "network timeout",
  "ENOAUDIT",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
]);

export function classifyAuditResult({ exitCode, output }) {
  if (exitCode === 0) return "green";

  const text = String(output ?? "");
  if (text.includes(AUDIT_REPORT_MARKER)) return "advisories";
  if (TRANSIENT_AUDIT_MARKERS.some((marker) => text.includes(marker))) {
    return "infrastructure";
  }
  return "unknown";
}

export async function runGateWithRetry({
  runAudit,
  attempts = DEFAULT_ATTEMPTS,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  retryDelayMs = 30_000,
  onAttempt,
}) {
  const attemptCount =
    Number.isInteger(attempts) && attempts > 0 ? attempts : DEFAULT_ATTEMPTS;

  for (let attempt = 1; attempt <= attemptCount; attempt += 1) {
    const { exitCode, output } = await runAudit();
    const status = classifyAuditResult({ exitCode, output });
    if (typeof onAttempt === "function") onAttempt(attempt, status);

    if (status !== "infrastructure" || attempt === attemptCount) {
      return { status, output, attempts: attempt };
    }
    await sleepImpl(retryDelayMs);
  }
}
