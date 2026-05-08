// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: LicenseRef-Proprietary
//
// Supabase token-path provisioner. Hits the Management API at
// https://api.supabase.com using a personal access token from
// $SUPABASE_ACCESS_TOKEN. Idempotent when --supabase-project is
// supplied: we look up the project by ref and skip the create call.

import { request, pollUntil, HttpError } from "./http.mjs";

const API = "https://api.supabase.com";

export async function provisionSupabase(ctx) {
  const { token, options, log, fetchImpl, sleepImpl } = ctx;
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  let project = null;
  if (options.supabaseProject) {
    log.info(`reusing project ref ${options.supabaseProject}`);
    project = await getProject(options.supabaseProject, headers, fetchImpl);
    if (!project) {
      throw new Error(`Supabase project ${options.supabaseProject} not found under this access token`);
    }
    log.ok(`found existing project ${project.id}`);
  } else {
    if (!options.org) {
      throw new Error("--org <slug> is required when creating a new Supabase project via the token path");
    }
    log.info(`creating new Supabase project in org ${options.org} (region ${options.region})`);
    const created = await request(`${API}/v1/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "llm-workbench-web",
        organization_id: options.org,
        region: options.region,
        plan: "free",
      }),
    }, { fetchImpl });
    project = created.body;
    log.ok(`created project ${project.id}`);
  }

  await pollUntil(
    async () => {
      const fresh = await getProject(project.id, headers, fetchImpl);
      const status = fresh?.status ?? "UNKNOWN";
      if (status === "ACTIVE_HEALTHY") return { done: true, value: fresh };
      log.note(`status=${status}, waiting…`);
      return { done: false, label: "Supabase project to be ACTIVE_HEALTHY" };
    },
    { intervalMs: 5_000, timeoutMs: 6 * 60_000, sleepImpl },
  );

  log.info("applying 0001_init.sql via the SQL endpoint");
  const sql = ctx.migrationSql;
  await request(`${API}/v1/projects/${project.id}/database/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: sql }),
  }, { fetchImpl });
  log.ok("migration applied");

  log.info("running security advisors");
  let advisors = null;
  try {
    const advisorRes = await request(
      `${API}/v1/projects/${project.id}/advisors?type=security`,
      { method: "GET", headers },
      { fetchImpl },
    );
    advisors = advisorRes.body;
    const findings = Array.isArray(advisors?.lints) ? advisors.lints.length : 0;
    if (findings === 0) log.ok("no security advisors fired");
    else log.warn(`security advisors reported ${findings} finding(s) — review the dashboard`);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) {
      log.note("advisors endpoint not available on this project plan; skipping");
    } else {
      throw e;
    }
  }

  return {
    projectRef: project.id,
    projectUrl: `https://${project.id}.supabase.co`,
    serviceRoleKeyHint: `https://supabase.com/dashboard/project/${project.id}/settings/api`,
    advisors,
  };
}

async function getProject(ref, headers, fetchImpl) {
  try {
    const { body } = await request(
      `${API}/v1/projects/${ref}`,
      { method: "GET", headers },
      { fetchImpl },
    );
    return body;
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  }
}
