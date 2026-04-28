import {
  RunCompletionEmail,
  type RunCompletionEmailProps,
} from "@/emails/run-completion";

const SAMPLE_RUN_ID = "8f4a3c2e-1b9d-4d77-8b2e-7c6e0f4a1de2";

const baseProps: Omit<RunCompletionEmailProps, "status"> = {
  runId: SAMPLE_RUN_ID,
  workflowId: "job-search-v3",
  startedAt: "2026-04-27T19:55:12.000Z",
  endedAt: "2026-04-27T19:57:48.000Z",
  durationMs: 156_000,
  runUrl: `https://workbench.example.com/runs/${SAMPLE_RUN_ID}`,
  preferencesUrl: "https://workbench.example.com/playground",
};

/**
 * Realistic mock for the React Email preview server. Drop additional
 * components here when other transactional templates land so the preview
 * UI gets a one-stop fixture entry.
 */
export const RunCompletionExamples = {
  Completed: () => <RunCompletionEmail {...baseProps} status="completed" />,
  Failed: () => <RunCompletionEmail {...baseProps} status="failed" />,
  Cancelled: () => <RunCompletionEmail {...baseProps} status="cancelled" />,
};

export default RunCompletionExamples;
