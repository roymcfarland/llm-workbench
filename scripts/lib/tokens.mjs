// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: LicenseRef-Proprietary
//
// Pure helpers for the token path. `extractTokens` reads the standard
// env vars; `requiredTokenError` returns a structured `{message,hint}`
// payload when *all* tokens are missing (the only fatal case — the
// script otherwise downgrades a missing token to a per-step warning).

export const TOKEN_ENV_VARS = Object.freeze({
  vercel: "VERCEL_TOKEN",
  supabase: "SUPABASE_ACCESS_TOKEN",
  clerk: "CLERK_API_KEY",
});

export function extractTokens(env) {
  return {
    vercel: env[TOKEN_ENV_VARS.vercel] ?? null,
    supabase: env[TOKEN_ENV_VARS.supabase] ?? null,
    clerk: env[TOKEN_ENV_VARS.clerk] ?? null,
  };
}

export function listMissingTokens(tokens) {
  const missing = [];
  if (!tokens.vercel) missing.push(TOKEN_ENV_VARS.vercel);
  if (!tokens.supabase) missing.push(TOKEN_ENV_VARS.supabase);
  if (!tokens.clerk) missing.push(TOKEN_ENV_VARS.clerk);
  return missing;
}

/**
 * Return a structured error payload when the token path cannot run at
 * all (i.e. every token is missing), otherwise null. The script
 * downgrades individual missing tokens to warnings further downstream;
 * this helper only fires when there is *no* useful work to do.
 */
export function requiredTokenError(tokens) {
  const missing = listMissingTokens(tokens);
  if (missing.length < 3) return null;
  return {
    message: `token path requires at least one of ${missing.join(", ")}`,
    hint: "set MCP=1 (or pass --mcp) to use the recommended agent-driven path instead",
  };
}

export function perTokenStatus(tokens) {
  const labels = {
    vercel: { name: TOKEN_ENV_VARS.vercel, manualHint: "import the project at https://vercel.com/new and re-run with VERCEL_TOKEN=…" },
    supabase: { name: TOKEN_ENV_VARS.supabase, manualHint: "follow apps/web/DEPLOY.md §1 to provision Supabase manually" },
    clerk: { name: TOKEN_ENV_VARS.clerk, manualHint: "open https://dashboard.clerk.com to create the application manually" },
  };
  return Object.entries(tokens).map(([key, value]) => {
    const meta = labels[key];
    return {
      key,
      env: meta.name,
      present: Boolean(value),
      manualHint: meta.manualHint,
    };
  });
}
