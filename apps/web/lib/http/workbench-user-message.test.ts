import { WorkbenchError } from "@llm-workbench/runtime";
import { describe, expect, it } from "vitest";

import { userFacingWorkbenchMessage } from "./workbench-user-message";

describe("userFacingWorkbenchMessage", () => {
  it("maps HttpRunRepository HTTP 429 errors to concise copy", () => {
    const err = new WorkbenchError(
      "HTTP_ERROR",
      `HttpRunRepository.save failed: 429 {"error":"Too many requests"}`,
    );
    expect(userFacingWorkbenchMessage(err)).toBe(
      "Too many requests — please wait a moment and try again.",
    );
  });

  it("passthrough unrelated Workbench HTTP_ERROR messages", () => {
    const err = new WorkbenchError("HTTP_ERROR", "HttpRunRepository.save failed: 500 oops");
    expect(userFacingWorkbenchMessage(err)).toBe(err.message);
  });

  it("maps plain Error with rate-limit wording", () => {
    expect(
      userFacingWorkbenchMessage(new Error("Too many requests from gateway")),
    ).toBe("Too many requests — please wait a moment and try again.");
  });
});
