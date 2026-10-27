#!/usr/bin/env node
// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT

import { execFile } from "node:child_process";
import { resolve as resolvePath } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MS_PER_HOUR = 60 * 60 * 1000;

function annotation(title, message) {
  const escaped = String(message)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
  console.error(`::error title=${title}::${escaped}`);
}

export function parseArgs(argv) {
  const options = { branch: "chore/audit-autofix", maxAgeHours: 48 };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const separator = argument.indexOf("=");
    const flag = separator === -1 ? argument : argument.slice(0, separator);
    if (flag !== "--branch" && flag !== "--max-age-hours") {
      throw new Error(`Unrecognised argument: ${argument}`);
    }
    const value =
      separator === -1 ? argv[++index] : argument.slice(separator + 1);
    if (!value?.trim() || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}.`);
    }
    if (flag === "--branch") {
      options.branch = value;
    } else {
      const hours = Number(value);
      if (!Number.isFinite(hours) || hours < 0) {
        throw new Error(
          `${flag} must be a finite number greater than or equal to 0.`,
        );
      }
      options.maxAgeHours = hours;
    }
  }
  return options;
}

export async function main({
  branch = "chore/audit-autofix",
  maxAgeHours = 48,
  execFileImpl = execFileAsync,
  ghImpl = execFileImpl,
  now = Date.now,
} = {}) {
  try {
    const { stdout } = await ghImpl("gh", [
      "pr",
      "list",
      "--head",
      branch,
      "--state",
      "open",
      "--json",
      "number,url,createdAt",
    ]);
    const prs = JSON.parse(stdout);
    if (!Array.isArray(prs)) throw new Error("gh returned a non-array result.");
    if (prs.length === 0) {
      console.log(`No open autofix PR for ${branch}.`);
      return 0;
    }

    let oldest;
    let oldestCreatedAt = Infinity;
    for (const pr of prs) {
      const createdAt =
        typeof pr?.createdAt === "string" ? Date.parse(pr.createdAt) : NaN;
      if (!Number.isFinite(createdAt)) {
        throw new Error(`Invalid createdAt for PR #${pr?.number ?? "unknown"}.`);
      }
      if (createdAt < oldestCreatedAt) {
        oldest = pr;
        oldestCreatedAt = createdAt;
      }
    }
    const ageMs = now() - oldestCreatedAt;
    if (!Number.isFinite(ageMs)) {
      throw new Error("The clock returned an invalid date.");
    }
    const ageHours = (ageMs / MS_PER_HOUR).toFixed(2);
    const message = `PR #${oldest.number} ${oldest.url} has been open ${ageHours}h (limit ${maxAgeHours}h).`;
    if (ageMs > maxAgeHours * MS_PER_HOUR) {
      annotation(
        "Autofix PR waiting for review",
        `${message} Merge it or close it; while the audit gate is red it blocks every PR.`,
      );
      return 1;
    }
    console.log(message);
    return 0;
  } catch (error) {
    annotation("Autofix staleness check failed", error.message);
    return 1;
  }
}

export async function runCli(argv, dependencies = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    annotation("Autofix staleness check invalid argument", error.message);
    return 1;
  }
  return main({ ...dependencies, ...options });
}

const isMain =
  process.argv[1] &&
  resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exitCode = await runCli(process.argv.slice(2));
