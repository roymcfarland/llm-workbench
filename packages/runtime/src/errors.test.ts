import { describe, expect, it } from "vitest";
import { WorkbenchError } from "./errors.js";

describe("WorkbenchError", () => {
  it("preserves cause via the standard Error options bag", () => {
    const root = new Error("root cause");
    const e = new WorkbenchError("INVALID_INPUT", "wrapped", root);
    expect(e.cause).toBe(root);
  });

  it("toJSON() exposes a stable shape suitable for logs", () => {
    const e = new WorkbenchError("HTTP_ERROR", "boom");
    expect(e.toJSON()).toEqual({ name: "WorkbenchError", code: "HTTP_ERROR", message: "boom" });
    expect(JSON.parse(JSON.stringify(e))).toEqual({
      name: "WorkbenchError",
      code: "HTTP_ERROR",
      message: "boom",
    });
  });

  it("WorkbenchError.is is a runtime-safe type guard", () => {
    expect(WorkbenchError.is(new WorkbenchError("INVALID_INPUT", "x"))).toBe(true);
    expect(WorkbenchError.is(new Error("x"))).toBe(false);
    expect(WorkbenchError.is("x")).toBe(false);
    expect(WorkbenchError.is(null)).toBe(false);
  });
});
