// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const branch = "chore/audit-autofix";
const script = fileURLToPath(new URL("./push-autofix-branch.sh", import.meta.url));
const directories = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

async function createRepos(configuration, existing = false) {
  const directory = await mkdtemp(path.join(tmpdir(), "push-autofix-branch-"));
  directories.push(directory);
  const home = path.join(directory, "home");
  const remote = path.join(directory, "remote.git");
  const seed = path.join(directory, "seed");
  const runner = path.join(directory, "runner");
  const concurrent = path.join(directory, "concurrent");
  await mkdir(home);
  // Discard inherited Git overrides as well as system/global configuration.
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))),
    HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "Autofix test",
    GIT_AUTHOR_EMAIL: "autofix@example.test",
    GIT_COMMITTER_NAME: "Autofix test",
    GIT_COMMITTER_EMAIL: "autofix@example.test",
    AUTOFIX_CONCURRENT_REPO: concurrent,
  };
  const run = (cwd, command, args) => {
    const result = spawnSync(command, args, { cwd, env, encoding: "utf8" });
    if (result.error) throw result.error;
    return result;
  };
  const git = (cwd, ...args) => {
    const result = run(cwd, "git", args);
    expect(result.status, result.stderr).toBe(0);
    return result.stdout.trim();
  };
  const commit = (cwd, message) => git(cwd, "commit", "--allow-empty", "-m", message);
  const url = pathToFileURL(remote).href;
  git(directory, "init", "--bare", "-b", "main", remote);
  git(directory, "init", "-b", "main", seed);
  commit(seed, "main");
  git(seed, "remote", "add", "origin", url);
  git(seed, "push", "origin", "main");

  if (existing) {
    git(directory, "clone", url, concurrent);
    git(concurrent, "checkout", "-b", branch);
    commit(concurrent, "earlier bot commit");
    git(concurrent, "push", "origin", branch);
  }

  if (configuration === "checkout-style") {
    git(directory, "init", "-b", "main", runner);
    git(runner, "remote", "add", "origin", url);
    git(runner, "fetch", "--depth", "1", "origin", "main");
    git(runner, "checkout", "-B", "main", "FETCH_HEAD");
  } else {
    git(directory, "clone", "--depth", "1", "--single-branch", "--branch", "main", url, runner);
  }
  git(runner, "checkout", "-B", branch);
  commit(runner, "runner commit");

  return {
    push: () => run(runner, "bash", [script, branch]),
    oldPush: () => run(runner, "git", ["push", "-u", "origin", branch, "--force-with-lease"]),
    tip: () => git(directory, `--git-dir=${remote}`, "log", "-1", "--format=%s", `refs/heads/${branch}`),
    async pushWithConcurrentPush() {
      commit(concurrent, "concurrent commit");
      const resolved = run(runner, "bash", ["-c", "command -v git"]);
      expect(resolved.status, resolved.stderr).toBe(0);
      const realGit = resolved.stdout.trim();
      expect(path.isAbsolute(realGit)).toBe(true);
      const bin = path.join(directory, "bin");
      await mkdir(bin);
      const standIn = path.join(bin, "git");
      // Move the remote after reading its SHA, before push reads the remote.
      // A pre-push hook runs too late: even --force rejects that race.
      await writeFile(standIn, `#!/usr/bin/env bash
set -uo pipefail
if [[ "$1" == "ls-remote" ]]; then
  "$AUTOFIX_REAL_GIT" "$@"
  status=$?
  "$AUTOFIX_REAL_GIT" -C "$AUTOFIX_CONCURRENT_REPO" push origin "${branch}" >&2
  exit "$status"
fi
exec "$AUTOFIX_REAL_GIT" "$@"
`);
      await chmod(standIn, 0o755);
      const result = spawnSync("bash", [script, branch], {
        cwd: runner,
        env: { ...env, AUTOFIX_REAL_GIT: realGit, PATH: `${bin}${path.delimiter}${env.PATH}` },
        encoding: "utf8",
      });
      if (result.error) throw result.error;
      return result;
    },
  };
}

describe("push-autofix-branch", () => {
  for (const configuration of ["checkout-style", "single-branch"]) {
    for (const existing of [false, true]) {
      it(`${configuration}: ${existing ? "updates an existing branch" : "creates an absent branch"}`, async () => {
        const repos = await createRepos(configuration, existing);
        const result = repos.push();
        expect(result.status, result.stderr).toBe(0);
        expect(repos.tip()).toBe("runner commit");
      });
    }
  }

  it("rejects a concurrent push and preserves its commit", async () => {
    const repos = await createRepos("checkout-style", true);
    const result = await repos.pushWithConcurrentPush();
    expect(result.status, result.stderr).not.toBe(0);
    expect(repos.tip()).toBe("concurrent commit");
  });

  it("reproduces the original bare-lease failure on an existing branch", async () => {
    const repos = await createRepos("checkout-style", true);
    const result = repos.oldPush();
    expect(result.status, result.stderr).not.toBe(0);
    expect(repos.tip()).toBe("earlier bot commit");
  });
});
