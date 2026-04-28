import { WorkbenchError } from "@llm-workbench/runtime";

/**
 * Turns errors from HttpRunRepository and server actions into copy suitable for badges.
 * Covers edge **429** responses when Upstash rate limits `/api/runs*` traffic.
 */
export function userFacingWorkbenchMessage(error: unknown): string {
  if (WorkbenchError.is(error) && error.code === "HTTP_ERROR") {
    const message = error.message;
    if (/\b429\b/u.test(message) || /Too many requests/ui.test(message)) {
      return "Too many requests — please wait a moment and try again.";
    }
    return message;
  }
  if (error instanceof Error) {
    const message = error.message;
    if (/\b429\b/u.test(message) || /Too many requests/ui.test(message)) {
      return "Too many requests — please wait a moment and try again.";
    }
    return message;
  }
  return "Request failed.";
}
