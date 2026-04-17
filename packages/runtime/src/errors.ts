import type { ZodError } from "zod";

export type WorkbenchErrorCode =
  | "INVALID_JSON"
  | "INVALID_RUN_BUNDLE"
  | "INTEGRITY_MISMATCH"
  | "MISSING_INTEGRITY"
  | "UNKNOWN_RUN"
  | "UNKNOWN_STEP"
  | "UNKNOWN_ARTIFACT"
  | "UNKNOWN_RULESET"
  | "INVALID_WORKFLOW"
  | "INVALID_INPUT"
  | "INVALID_STATE_TRANSITION"
  | "IDEMPOTENCY_CONFLICT"
  | "PATCH_FAILED"
  | "MISSING_WEBCRYPTO"
  | "HTTP_ERROR"
  | "HTTP_INVALID_JSON";

export class WorkbenchError extends Error {
  override readonly name = "WorkbenchError";
  readonly code: WorkbenchErrorCode;
  override readonly cause?: unknown;

  constructor(code: WorkbenchErrorCode, message: string, cause?: unknown) {
    super(message);
    this.code = code;
    this.cause = cause;
  }

  static is(e: unknown): e is WorkbenchError {
    return e instanceof WorkbenchError;
  }
}

export function formatZodError(err: ZodError): string {
  return err.issues.map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`).join("; ");
}
