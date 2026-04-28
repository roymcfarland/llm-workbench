/**
 * Run IDs match runtime `newId("run")` (`run_` + UUID or dev fallback).
 * Reject odd path segments before persistence or logging.
 */
const RUN_ID_RE = /^run_[-a-zA-Z0-9_]+$/;
export const MAX_RUN_ID_LEN = 128;

export function isValidRunIdParam(runId: string): boolean {
  return (
    runId.length > 0 &&
    runId.length <= MAX_RUN_ID_LEN &&
    RUN_ID_RE.test(runId) &&
    !runId.includes("..")
  );
}
