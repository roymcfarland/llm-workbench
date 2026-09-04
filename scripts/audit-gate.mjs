#!/usr/bin/env node
// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT

import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve as resolvePath } from "node:path";
import process from "node:process";

import { runGateWithRetry } from "./lib/audit-gate-core.mjs";

export function runAudit({
  spawnImpl = spawn,
  stdout = process.stdout,
} = {}) {
  return new Promise((resolve) => {
    let output = "";
    let settled = false;
    const finish = (exitCode) => {
      if (settled) return;
      settled = true;
      resolve({ exitCode: exitCode ?? 1, output });
    };
    const capture = (chunk) => {
      output += chunk;
      stdout.write(chunk);
    };

    const child = spawnImpl("npx", [
      "audit-ci",
      "--config",
      "audit-ci.jsonc",
    ]);
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    child.once("error", (error) => {
      capture(`audit-gate: failed to start audit-ci: ${error.message}\n`);
      finish(1);
    });
    child.once("close", finish);
  });
}

async function writeOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  await writeFile(process.env.GITHUB_OUTPUT, `${key}=${value}\n`, { flag: "a" });
}

export async function main({
  runAuditImpl = runAudit,
  sleepImpl,
  mode = "autofix",
} = {}) {
  const result = await runGateWithRetry({
    runAudit: runAuditImpl,
    sleepImpl,
  });
  await writeOutput("status", result.status);
  await writeOutput("red", result.status === "advisories");

  switch (result.status) {
    case "green":
      console.log("Audit gate is green.");
      return 0;
    case "advisories":
      if (mode === "gate") {
        console.error(
          "::error title=Audit gate found high/critical advisories::The audit gate found real high/critical advisory findings. Run npm run audit:check locally to review and resolve them.",
        );
        return 1;
      }
      console.log("Audit gate is red — attempting npm audit fix.");
      return 0;
    case "infrastructure":
      console.log(
        `::warning title=Audit gate not evaluated::audit-ci could not reach the npm advisory registry after ${result.attempts} attempts. The gate was NOT evaluated — this is not an advisory finding. The next scheduled run will retry.`,
      );
      return 0;
    case "unknown":
    default:
      console.error(
        `::error title=Audit gate failed unexpectedly::${result.output}`,
      );
      return 1;
  }
}

export function parseMode(args) {
  const modeIndex = args.indexOf("--mode");
  return args.includes("--mode=gate") ||
    (modeIndex !== -1 && args[modeIndex + 1] === "gate")
    ? "gate"
    : "autofix";
}

const isMain =
  process.argv[1] &&
  resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  process.exitCode = await main({ mode: parseMode(process.argv.slice(2)) });
}
