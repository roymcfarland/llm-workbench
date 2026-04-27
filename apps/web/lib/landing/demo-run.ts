import { WorkbenchRuntime, type RunStoreState } from "@llm-workbench/runtime";

import { stateToSerialized, type SerializedRun } from "@/lib/supabase/runs-store";
import { initialRuleSet, jobSearchWorkflow } from "@/lib/workflow/job-search";

/**
 * Build a deterministic, seeded sample run from the same workflow the
 * playground uses, so the public `/runs/demo` page renders the exact same
 * surface the auth-gated `/runs/[runId]` page would show — minus auth and
 * persistence.
 *
 * NOTE: ids and timestamps inside the run are non-deterministic because the
 * runtime mints them from `Date.now()` and a counter. That is acceptable for
 * a demo; the bundle still validates and renders identically.
 */
export function buildDemoRunSerialized(): { runId: string; serialized: SerializedRun } {
  const runtime = new WorkbenchRuntime();
  const { runId } = runtime.startRun({
    workflow: jobSearchWorkflow,
    ruleSets: [initialRuleSet],
    initialArtifacts: [
      {
        artifact: {
          artifactKey: "parserInputs",
          typeId: "parserInputs",
          data: {
            resumeText:
              "Senior TypeScript engineer · 8 years · React, Node, Postgres, Vercel.",
            profiles: [{ label: "GitHub", url: "https://example.com/u" }],
            portfolioUrls: ["https://example.com/p"],
          },
        },
      },
    ],
  });

  const session = runtime.session(runId);
  session.resolveGate({
    stepId: "parser1",
    gate: "PAUSE_BEFORE",
    decision: "approved",
    note: "demo: pre-approved",
  });

  session.beginStep("parser1");
  session.logModelIO({
    stepId: "parser1",
    direction: "response",
    provider: "anthropic",
    model: "claude-haiku-4-5",
    usage: { inputTokens: 110, outputTokens: 38, totalTokens: 148 },
    cost: { amount: 0.0024, currency: "USD" },
    durationMs: 192,
  });
  session.writeArtifact({
    artifactKey: "compiledProfile",
    typeId: "compiledProfile",
    data: {
      headline: "Senior TypeScript engineer",
      skills: ["typescript", "react", "node", "postgres", "vercel"],
      summary:
        "Senior TypeScript engineer with 8 years building production web apps. Strong infra and design-system experience; comfortable shipping LLM-powered features.",
      yearsExperience: 8,
    },
  });
  session.completeStep("parser1");

  session.beginStep("jobSearcher");
  session.logModelIO({
    stepId: "jobSearcher",
    direction: "response",
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    usage: { inputTokens: 280, outputTokens: 95, totalTokens: 375 },
    cost: { amount: 0.0091, currency: "USD" },
    durationMs: 412,
  });
  session.writeArtifact({
    artifactKey: "potentialJobs",
    typeId: "potentialJobs",
    data: [
      { id: "job_a", title: "Staff Frontend Engineer", remote: true, score: 0.86 },
      { id: "job_b", title: "Lead, Platform UI", remote: true, score: 0.82 },
      { id: "job_c", title: "Senior FE @ infra startup", remote: true, score: 0.78 },
    ],
  });
  session.completeStep("jobSearcher");
  session.resolveGate({
    stepId: "jobSearcher",
    gate: "PAUSE_AFTER",
    decision: "approved",
    note: "demo: looks good",
  });

  session.beginStep("output");
  session.writeArtifact({
    artifactKey: "scoredResults",
    typeId: "scoredResults",
    data: [
      { jobId: "job_a", reasoning: "Best skills overlap; remote OK." },
      { jobId: "job_b", reasoning: "Adjacent — platform team familiarity." },
    ],
  });
  session.completeStep("output");
  session.completeRun({ reason: "demo run finished" });

  const state: RunStoreState = runtime.getState(runId)!;
  return { runId, serialized: stateToSerialized(state) };
}
