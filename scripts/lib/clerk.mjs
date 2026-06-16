// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT
//
// Clerk token-path provisioner. The Clerk Backend API at
// https://api.clerk.com is scoped to a single instance, which means
// "create application" is actually a Marketplace/Dashboard concern
// rather than something the Backend API exposes. When the user supplies
// `--clerk-app <id>` we surface the deep link to the api-keys page;
// when they don't, we surface the same deep link and ask them to
// create the app manually. We deliberately don't pretend to do more
// than the Backend API supports — see ROADMAP.md week-1 risk register.

import { request, HttpError } from "./http.mjs";

const API = "https://api.clerk.com";

export async function provisionClerk(ctx) {
  const { token, options, log, fetchImpl } = ctx;
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  if (!options.clerkApp) {
    log.warn("Clerk Backend API does not expose application creation; do this once in the dashboard");
    log.note("open https://dashboard.clerk.com/last-active?path=api-keys, copy the keys, re-run with --clerk-app=<id>");
    return {
      applicationId: null,
      publishableKey: null,
      secretKey: null,
      manualFollowUp: "https://dashboard.clerk.com/last-active?path=api-keys",
    };
  }

  log.info(`verifying Clerk instance ${options.clerkApp} is reachable with the supplied key`);
  try {
    await request(`${API}/v1/instance`, { method: "GET", headers }, { fetchImpl });
    log.ok("Clerk Backend API responded");
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      throw new Error("CLERK_API_KEY rejected by Clerk Backend API (401). Re-issue a Backend API key in the dashboard.");
    }
    throw e;
  }

  return {
    applicationId: options.clerkApp,
    publishableKey: null,
    secretKey: null,
    manualFollowUp: `https://dashboard.clerk.com/apps/${options.clerkApp}/api-keys`,
  };
}
