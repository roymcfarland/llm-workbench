// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: LicenseRef-Proprietary
//
// Vercel token-path provisioner. Drives the public Vercel REST API
// (https://api.vercel.com) using $VERCEL_TOKEN. Idempotent when
// --vercel-project <name> is supplied: existing projects skip the
// create call, and env-var upserts dedupe on `key+target`.
//
// Endpoints used:
//   POST /v11/projects                        create project
//   GET  /v9/projects/:idOrName               look up project
//   POST /v10/projects/:id/env                add env var
//   GET  /v9/projects/:id/env                 list env vars
//   POST /v13/deployments                     trigger production deploy
//   GET  /v13/deployments/:id                 poll deploy status

import { request, pollUntil, HttpError } from "./http.mjs";

const API = "https://api.vercel.com";

export async function provisionVercel(ctx) {
  const { token, options, envVars, log, fetchImpl, sleepImpl } = ctx;
  const teamSuffix = ctx.teamId ? `?teamId=${encodeURIComponent(ctx.teamId)}` : "";
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  let project = null;
  if (options.vercelProject) {
    log.info(`looking up existing Vercel project ${options.vercelProject}`);
    project = await getProject(options.vercelProject, headers, fetchImpl, teamSuffix);
    if (project) log.ok(`found project ${project.id}`);
  }

  if (!project) {
    if (!options.repo) {
      throw new Error("--repo <owner/name> is required when creating a new Vercel project via the token path");
    }
    const [owner, name] = options.repo.split("/");
    if (!owner || !name) throw new Error(`--repo expects owner/name, got "${options.repo}"`);
    log.info(`creating Vercel project ${options.vercelProject ?? "llm-workbench-web"} from ${options.repo}`);
    const created = await request(`${API}/v11/projects${teamSuffix}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: options.vercelProject ?? "llm-workbench-web",
        framework: "nextjs",
        rootDirectory: "apps/web",
        gitRepository: { type: "github", repo: options.repo },
      }),
    }, { fetchImpl });
    project = created.body;
    log.ok(`created project ${project.id}`);
  }

  log.info("upserting environment variables");
  const existingEnvRes = await request(
    `${API}/v9/projects/${project.id}/env${teamSuffix}`,
    { method: "GET", headers },
    { fetchImpl },
  );
  const existing = new Set(
    (existingEnvRes.body?.envs ?? []).map((e) => `${e.key}::${(e.target ?? []).join(",")}`),
  );

  let added = 0;
  let skipped = 0;
  for (const v of envVars) {
    if (v.value === null || v.value === undefined) {
      log.warn(`skipping ${v.key}: no value resolved`);
      continue;
    }
    const targetKey = `${v.key}::${(v.target ?? ["production", "preview", "development"]).join(",")}`;
    if (existing.has(targetKey)) {
      skipped += 1;
      continue;
    }
    try {
      await request(`${API}/v10/projects/${project.id}/env${teamSuffix}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          key: v.key,
          value: v.value,
          type: v.sensitive ? "encrypted" : "plain",
          target: v.target ?? ["production", "preview", "development"],
        }),
      }, { fetchImpl });
      added += 1;
    } catch (e) {
      if (e instanceof HttpError && e.status === 400 && /already exists/i.test(JSON.stringify(e.body))) {
        skipped += 1;
        continue;
      }
      throw e;
    }
  }
  log.ok(`env vars: +${added} added, ${skipped} already present`);

  log.info("triggering production deployment");
  const deployRes = await request(`${API}/v13/deployments${teamSuffix}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: project.name,
      project: project.id,
      target: "production",
      gitSource: { type: "github", repo: options.repo, ref: "main" },
    }),
  }, { fetchImpl });
  const deploymentId = deployRes.body?.id;
  log.ok(`deployment ${deploymentId} queued`);

  const finalState = await pollUntil(
    async () => {
      const { body } = await request(
        `${API}/v13/deployments/${deploymentId}${teamSuffix}`,
        { method: "GET", headers },
        { fetchImpl },
      );
      const state = body?.readyState ?? body?.state;
      switch (state) {
        case "READY":
          return { done: true, value: { state, body } };
        case "ERROR":
        case "CANCELED":
          throw new Error(`Vercel deployment ended in state ${state}: ${body?.errorMessage ?? "unknown"}`);
        case "BUILDING":
        case "QUEUED":
        case "INITIALIZING":
        case undefined:
        default:
          log.note(`deployment state=${state ?? "?"}, waiting…`);
          return { done: false, label: "Vercel deployment to be READY" };
      }
    },
    { intervalMs: 8_000, timeoutMs: 12 * 60_000, sleepImpl },
  );

  return {
    projectId: project.id,
    projectName: project.name,
    deploymentId,
    deploymentUrl: `https://${finalState.body.url}`,
    productionUrl: deriveProductionUrl(project, finalState.body),
  };
}

function deriveProductionUrl(project, deployment) {
  const alias = (deployment.alias ?? []).find((a) => typeof a === "string");
  if (alias) return `https://${alias}`;
  if (project.targets?.production?.url) return `https://${project.targets.production.url}`;
  if (deployment.url) return `https://${deployment.url}`;
  return null;
}

async function getProject(idOrName, headers, fetchImpl, teamSuffix) {
  try {
    const { body } = await request(
      `${API}/v9/projects/${encodeURIComponent(idOrName)}${teamSuffix}`,
      { method: "GET", headers },
      { fetchImpl },
    );
    return body;
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  }
}
