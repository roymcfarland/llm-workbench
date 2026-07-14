#!/usr/bin/env node
// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve as resolvePath } from "node:path";
import process from "node:process";

const FAILED_PACKAGES_MARKER = "packages failed to publish:";
const ALREADY_PUBLISHED_MESSAGE = "undefined You cannot publish over the previously published versions:";

/**
 * Identify the one benign changesets registry-race failure. Any incomplete or
 * unexpected output remains a real failure.
 */
export function classifyPublishFailure(output, exitCode) {
  if (exitCode === 0) return { benign: false };

  const failedPackages = failedPackageNames(output);
  const benign = failedPackages.length > 0 && failedPackages.every((packageName) => (
    output.includes(`an error occurred while publishing ${packageName}: ${ALREADY_PUBLISHED_MESSAGE}`)
  ));

  return { benign };
}

function failedPackageNames(output) {
  const blockStart = output.lastIndexOf(FAILED_PACKAGES_MARKER);
  if (blockStart < 0) return [];

  const packages = [];
  for (const line of output.slice(blockStart + FAILED_PACKAGES_MARKER.length).split(/\r?\n/u)) {
    const match = line.match(/^\s*(?:🦋\s+)?(@llm-workbench\/[\w.-]+)@\S+\s*$/u);
    if (!match) {
      if (line.trim()) break;
      continue;
    }
    packages.push(match[1]);
  }
  return packages;
}

function runPublish() {
  return new Promise((resolve) => {
    let output = "";
    let settled = false;
    const finish = (exitCode) => {
      if (!settled) {
        settled = true;
        resolve({ exitCode: exitCode ?? 1, output });
      }
    };

    const child = spawn("npx", ["changeset", "publish"]);
    for (const [stream, destination] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      stream.on("data", (chunk) => {
        output += chunk;
        destination.write(chunk);
      });
    }
    child.once("error", (error) => {
      const message = `release-publish: failed to start changeset publish: ${error.message}\n`;
      output += message;
      process.stderr.write(message);
      finish(1);
    });
    child.once("close", finish);
  });
}

export async function main() {
  const { exitCode, output } = await runPublish();
  if (exitCode === 0) return 0;

  const { benign } = classifyPublishFailure(output, exitCode);
  if (!benign) return exitCode;

  const packageCount = failedPackageNames(output).length;
  process.stdout.write(`release-publish: ${packageCount} package(s) already published at current version — treating as no-op\n`);
  return 0;
}

const isMain = process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().then((exitCode) => process.exit(exitCode));
}
