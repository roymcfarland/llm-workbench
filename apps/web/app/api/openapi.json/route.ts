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
      "Wire format produced by the JSON body `HttpRunRepository.save()` sends. Maps are serialized as `Array<[key, value]>` entries.",
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
        "Tenant-scoped REST surface for LLM Workbench runs. The wire format is the literal output of the JSON body `HttpRunRepository.save()` sends.",
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
            "401": { $ref: "#/components/responses/Unauthorized" },
            "429": { $ref: "#/components/responses/RateLimited" },
            "500": { $ref: "#/components/responses/InternalError" },
            "503": { $ref: "#/components/responses/ServiceUnavailable" },
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
            "400": { $ref: "#/components/responses/InvalidRunId" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "429": { $ref: "#/components/responses/RateLimited" },
            "500": { $ref: "#/components/responses/InternalError" },
            "503": { $ref: "#/components/responses/ServiceUnavailable" },
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
              description: "Invalid run id, invalid JSON, body that fails run-state validation, state.run.id not matching the URL, or structural-invariant failures reported with a code",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorBody" } } },
            },
            "409": {
              description: "Run id is unavailable to this tenant",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorBody" } } },
            },
            "413": {
              description: "Body too large (>25MB)",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorBody" } } },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "429": { $ref: "#/components/responses/RateLimited" },
            "500": { $ref: "#/components/responses/InternalError" },
            "503": { $ref: "#/components/responses/ServiceUnavailable" },
          },
        },
        delete: {
          summary: "Delete a run",
          operationId: "deleteRun",
          responses: {
            "204": { description: "Deleted; deleting a run that does not exist also returns 204" },
            "400": { $ref: "#/components/responses/InvalidRunId" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "429": { $ref: "#/components/responses/RateLimited" },
            "500": { $ref: "#/components/responses/InternalError" },
            "503": { $ref: "#/components/responses/ServiceUnavailable" },
          },
        },
      },
    },
    components: {
      responses: {
        Unauthorized: {
          description: "Unauthenticated",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorBody" } } },
        },
        RateLimited: {
          description: "Too many requests",
          headers: {
            "Retry-After": {
              description: "Seconds until retry, rounded up with a minimum of 1",
              schema: { type: "string" },
            },
          },
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorBody" } } },
        },
        ServiceUnavailable: {
          description: "Rate limiter not configured. Retry after the interval given in Retry-After.",
          headers: {
            "Retry-After": {
              description: "Seconds until retry (60)",
              schema: { type: "string" },
            },
          },
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorBody" } } },
        },
        InternalError: {
          description: "Internal server error",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorBody" } } },
        },
        InvalidRunId: {
          description: "Invalid run id; WorkbenchError responses include a code",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorBody" } } },
        },
      },
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
            "Clerk session cookie. For agent / server-to-server use, send a signed-in user's Clerk session token via Authorization: Bearer <token>. Session tokens are short-lived and must be refreshed. Clerk machine tokens (M2M, API keys, OAuth access tokens) and custom JWT-template tokens are not accepted; use a session token.",
        },
      },
    },
    security: [{ clerkSession: [] }],
  };
}
