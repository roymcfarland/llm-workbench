import type { JsonSchema, SchemaRegistry } from "../schema/registry.js";

/**
 * Reference JSON Schemas for the job-search style demo. Real apps should register their own.
 */
export const demoArtifactTypes: Array<{ id: string; schema: JsonSchema; exportRedactPaths?: string[] }> = [
  {
    id: "parserInputs",
    exportRedactPaths: ["/resumeText", "/profiles/0/url"],
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        resumeText: { type: "string" },
        profiles: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              url: { type: "string" },
            },
            required: ["label", "url"],
          },
        },
        portfolioUrls: { type: "array", items: { type: "string" } },
      },
      required: ["resumeText"],
    },
  },

  {
    id: "compiledProfile",
    exportRedactPaths: ["/summary"],
    schema: {
      type: "object",
      additionalProperties: true,
      properties: {
        headline: { type: "string" },
        skills: { type: "array", items: { type: "string" } },
        summary: { type: "string" },
      },
      required: ["headline", "skills", "summary"],
    },
  },

  {
    id: "potentialJobs",
    exportRedactPaths: ["/0/url", "/1/url"],
    schema: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          company: { type: "string" },
          url: { type: "string" },
        },
        required: ["id", "title", "company", "url"],
      },
    },
  },

  {
    id: "scoredResults",
    schema: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          jobId: { type: "string" },
          score: { type: "number" },
          reasons: { type: "array", items: { type: "string" } },
        },
        required: ["jobId", "score", "reasons"],
      },
    },
  },
];

export const demoRuleSchemas: Array<{ id: string; schema: JsonSchema }> = [
  {
    id: "demoJobRule",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: { type: "string", enum: ["remote", "keyword", "salary"] },
        value: { type: "string" },
      },
      required: ["kind", "value"],
    },
  },
];

export function registerDemoSchemas(registry: SchemaRegistry) {
  for (const artifactType of demoArtifactTypes) {
    registry.registerArtifactType(artifactType);
  }
  for (const ruleSchema of demoRuleSchemas) {
    registry.registerRulePayloadSchema(ruleSchema);
  }
}
