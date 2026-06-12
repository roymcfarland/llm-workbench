import type { ZodError } from "zod";

export type WorkbenchErrorCode =
  | "INVALID_JSON"
  | "INVALID_RUN_BUNDLE"
  | "INVALID_RUN_STATE"
  | "INVALID_TRACE_EVENT"
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
  | "RUN_ID_COLLISION"
  | "HTTP_ERROR"
  | "HTTP_INVALID_JSON"
  | "HTTP_TIMEOUT"
  | "HTTP_ABORTED"
  | "STORAGE_UNAVAILABLE"
  | "UNSUPPORTED_PROTOCOL_VERSION";

export type WorkbenchErrorJson = {
  name: "WorkbenchError";
  code: WorkbenchErrorCode;
  message: string;
};

export class WorkbenchError extends Error {
  override readonly name = "WorkbenchError";
  readonly code: WorkbenchErrorCode;

  constructor(code: WorkbenchErrorCode, message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.code = code;
    if (typeof (Error as unknown as { captureStackTrace?: (target: object, ctor?: unknown ) => void })
      .captureStackTrace === "function") {
      (Error as unknown as { captureStackTrace: (target: object, ctor?: unknown ) => void })
        .captureStackTrace(this, WorkbenchError);
    }
  }

  toJSON(): WorkbenchErrorJson {
    return { name: this.name, code: this.code, message: this.message };
  }

  static is(e: unknown): e is WorkbenchError {
    return e instanceof WorkbenchError;
  }
}

export function formatZodError(err: ZodError): string {
  return err.issues.map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`).join("; ");
}
