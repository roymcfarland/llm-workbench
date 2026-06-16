import { WORKBENCH_PROTOCOL_VERSION } from "@llm-workbench/runtime";

import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

type OpenApiDoc = Record<string, unknown>;

export async function GET(): Promise<Response> {
  const origin = await siteOrigin();
  const doc = buildOpenApi(origin) as OpenApiDoc;
  return new Response(JSON.stringify(doc, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}

function buildOpenApi(origin: string) {
  const SerializedRunStoreState = {
    type: "object",
    description:
      "Wire format produced by `HttpRunRepository.serializeState`. Maps are serialized as `Array<[key, value]>` entries.",
    required: [
      "revision",
      "run",
      "trace",
      "artifactsByKey",
      "ruleSetsById",
      "stepStatus",
      "gateState",
      "idempotency",
    ],
    properties: {
      revision: { type: "integer", minimum: 0 },
      run: {
        type: "object",
        description: "RunInstance from @llm-workbench/runtime",
        additionalProperties: true,
      },
      trace: {
        type: "array",
        items: { $ref: "#/components/schemas/TraceEvent" },
      },
      artifactsByKey: {
        type: "array",
        items: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          prefixItems: [{ type: "string" }, {}],
        },
      },
      ruleSetsById: {
        type: "array",
        items: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          prefixItems: [{ type: "string" }, {}],
        },
      },
      stepStatus: {
        type: "array",
        items: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          prefixItems: [
            { type: "string" },
            { enum: ["pending", "running", "completed", "failed"] },
          ],
        },
      },
      gateState: {
        type: "array",
        items: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          prefixItems: [{ type: "string" }, { type: "object" }],
        },
      },
      idempotency: {
        type: "array",
        items: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          prefixItems: [
            { type: "string" },
            {
              type: "object",
              required: ["artifactKey", "version"],
              properties: {
                artifactKey: { type: "string" },
                version: { type: "integer", minimum: 1 },
              },
            },
          ],
        },
      },
    },
  };

  const SavedRunMeta = {
    type: "object",
    required: ["id", "workflowId", "startedAt", "status"],
    properties: {
      id: { type: "string" },
      workflowId: { type: "string" },
      startedAt: { type: "string", format: "date-time" },
      endedAt: { type: "string", format: "date-time" },
      status: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
    },
  };

  const TraceEvent = {
    type: "object",
    required: ["id", "type", "runId", "ts"],
    properties: {
      id: { type: "string" },
      runId: { type: "string" },
      ts: { type: "string", format: "date-time" },
      type: {
        type: "string",
        enum: [
          "step_started",
          "step_completed",
          "artifact_written",
          "artifact_patch",
          "model_io",
          "tool_call",
          "human_gate_requested",
          "human_gate_resolved",
          "rule_changed",
          "policy_changed",
          "error",
          "run_forked",
          "annotation",
          "run_status_changed",
          "span_started",
          "span_ended",
        ],
      },
    },
    additionalProperties: true,
  };

  const ErrorBody = {
    type: "object",
    required: ["error"],
    properties: {
      error: { type: "string" },
      code: { type: "string" },
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "LLM Workbench REST API",
      version: WORKBENCH_PROTOCOL_VERSION,
      description:
        "Tenant-scoped REST surface for LLM Workbench runs. The wire format is the literal output of `HttpRunRepository.serializeState`.",
      contact: {
        name: "LLM Workbench agents contract",
        url: `${origin}/agents.md`,
      },
      license: {
        name: "MIT",
        url: "https://github.com/roymcfarland/llm-workbench/blob/main/LICENSE",
      },
    },
    servers: [{ url: origin, description: "Reference deployment" }],
    paths: {
      "/api/runs": {
        get: {
          summary: "List runs for the caller's tenant",
          operationId: "listRuns",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 500, default: 100 },
            },
          ],
          responses: {
            "200": {
              description: "Array of run metadata",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/SavedRunMeta" },
                  },
                },
              },
            },
            "401": {
              description: "Unauthenticated",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorBody" } } },
            },
          },
        },
      },
      "/api/runs/{runId}": {
        parameters: [
          {
            name: "runId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          summary: "Fetch a serialized run state",
          operationId: "getRun",
          responses: {
            "200": {
              description: "Serialized RunStoreState",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SerializedRunStoreState" },
                },
              },
            },
            "404": { description: "Run not found" },
          },
        },
        put: {
          summary: "Persist a new revision of a run state",
          operationId: "putRun",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SerializedRunStoreState" },
              },
            },
          },
          responses: {
            "204": { description: "Saved" },
            "400": {
              description: "Invalid body or runId mismatch",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorBody" } } },
            },
            "413": {
              description: "Body too large (>25MB)",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorBody" } } },
            },
          },
        },
        delete: {
          summary: "Delete a run",
          operationId: "deleteRun",
          responses: {
            "204": { description: "Deleted" },
          },
        },
      },
    },
    components: {
      schemas: {
        SerializedRunStoreState,
        SavedRunMeta,
        TraceEvent,
        ErrorBody,
      },
      securitySchemes: {
        clerkSession: {
          type: "apiKey",
          in: "cookie",
          name: "__session",
          description:
            "Clerk session cookie. For agent / server-to-server use, a Clerk-issued bearer token may be passed in the Authorization header.",
        },
      },
    },
    security: [{ clerkSession: [] }],
  };
}
