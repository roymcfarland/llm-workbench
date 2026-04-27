import { z } from "zod";

/**
 * The same demo workflow shape used by `examples/job-search-demo`, kept
 * here so the playground page and the server action agree.
 */
export const jobSearchWorkflow = {
  id: "jobSearchWorkflow",
  version: 1,
  title: "Job search (reference)",
  steps: [
    {
      id: "parser1",
      gatePolicy: "PAUSE_BEFORE" as const,
      inputs: ["parserInputs"],
      outputs: ["compiledProfile"],
    },
    {
      id: "jobSearcher",
      gatePolicy: "PAUSE_AFTER" as const,
      inputs: ["compiledProfile"],
      outputs: ["potentialJobs"],
    },
    {
      id: "output",
      gatePolicy: "AUTO" as const,
      inputs: ["potentialJobs"],
      outputs: ["scoredResults"],
    },
  ],
  edges: [
    { id: "e1", from: "parser1", to: "jobSearcher" },
    { id: "e2", from: "jobSearcher", to: "output" },
  ],
};

export const initialRuleSet = {
  id: "default",
  ruleSchemaId: "demoJobRule",
  rules: [
    {
      id: "r1",
      priority: 0,
      enabled: true,
      label: "Remote only",
      payload: { kind: "remote", value: "true" },
    },
    {
      id: "r2",
      priority: 1,
      enabled: true,
      label: "Ban keyword: unpaid",
      payload: { kind: "keyword", value: "unpaid" },
    },
  ],
};

export const compiledProfileSchema = z.object({
  headline: z
    .string()
    .min(4)
    .max(200)
    .describe("One-line professional summary, e.g. 'Senior TypeScript engineer'."),
  skills: z
    .array(z.string().min(1).max(40))
    .min(1)
    .max(20)
    .describe("Concrete technical or domain skills."),
  summary: z
    .string()
    .min(20)
    .max(800)
    .describe("Two to three sentence narrative summary of fit."),
  yearsExperience: z
    .number()
    .int()
    .min(0)
    .max(60)
    .optional()
    .describe("Estimated years of relevant experience."),
});

export type CompiledProfile = z.infer<typeof compiledProfileSchema>;

export const SAMPLE_RESUME = `Senior TypeScript engineer with 8 years of experience shipping
production web applications. Built LLM-powered onboarding flows at a fintech
startup, contributed to internal design systems, and led migrations from REST
to GraphQL. Comfortable with React, Node, Postgres, and Vercel infra.`;
