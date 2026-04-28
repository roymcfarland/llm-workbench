#!/usr/bin/env node
/**
 * Removes `apps/web/.next` so the next `next build` is not layered on a partial tree.
 */
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appsWeb = dirname(scriptDir);
const nextDir = join(appsWeb, ".next");

if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true });
  console.log("[clean-next] removed", nextDir);
} else {
  console.log("[clean-next] nothing to remove:", nextDir);
}
