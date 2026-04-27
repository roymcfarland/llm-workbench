import { WORKBENCH_PROTOCOL_VERSION } from "@llm-workbench/runtime";

import { GITHUB_URL, LICENSE_NAME, siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const origin = await siteOrigin();
  const body = `# LLM Workbench

LLM Workbench is a model-agnostic control plane for LLM-powered products.
Every run becomes a tamper-evident, human-gated, replayable bundle of trace
events, artifacts, gates, and cost telemetry. The runtime is headless and
provider-agnostic; the host application owns prompts, models, and tools, and
calls explicit APIs to record what happened. Protocol v${WORKBENCH_PROTOCOL_VERSION}.

## Key concepts

- run bundle — signed JSON of run, trace, artifacts, ruleSets, optional engine snapshot.
- trace event — typed, time-ordered fact (step_started, model_io, artifact_written, human_gate_resolved, span_started, etc.).
- artifact — versioned, schema-validated structured output keyed by artifactKey + typeId.
- gate — PAUSE_BEFORE, PAUSE_AFTER, CHECKPOINT human-review hold points on workflow steps.
- telemetry — derived ledger summarizing token usage and cost per provider, model, step, user, tenant, and plan.

## Important links

- Protocol overview: ${origin}/docs/protocol
- OpenAPI spec:      ${origin}/api/openapi.json
- MCP descriptor:    ${origin}/.well-known/mcp.json
- Agent contract:    ${origin}/agents.md
- Public demo run:   ${origin}/runs/demo
- Long-form (full):  ${origin}/llms-full.txt
- Source repository: ${GITHUB_URL}

## License

${LICENSE_NAME}. Source-available, not OSI open source. Free to read, fork,
modify, redistribute (noncommercial), and use for personal projects, research,
education, and public-benefit work. Commercial use requires a separate paid
license.

## Contact

Open issues at ${GITHUB_URL}/issues. For commercial inquiries, see
${GITHUB_URL}/blob/main/COMMERCIAL.md.
`;
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
