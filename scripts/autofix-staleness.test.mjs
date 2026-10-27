// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { main, runCli } from "./autofix-staleness.mjs";

const NOW = Date.parse("2026-10-27T18:00:00Z");
const HOUR = 3_600_000;
const pr = (ageMs, number = 1) => ({
  number,
  url: `https://github.com/example/repo/pull/${number}`,
  createdAt: new Date(NOW - ageMs).toISOString(),
});
const ghResult = (prs) => vi.fn().mockResolvedValue({ stdout: JSON.stringify(prs) });

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("autofix staleness", () => {
  it("passes with no open PR and uses the exact default gh argv", async () => {
    const ghImpl = ghResult([]);
    await expect(runCli([], { ghImpl, now: () => NOW })).resolves.toBe(0);
    expect(ghImpl).toHaveBeenCalledExactlyOnceWith("gh", [
      "pr", "list", "--head", "chore/audit-autofix", "--state", "open",
      "--json", "number,url,createdAt",
    ]);
    expect(console.log).toHaveBeenCalledWith(
      "No open autofix PR for chore/audit-autofix.",
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each([
    ["younger than the limit", 47 * HOUR],
    ["exactly the limit", 48 * HOUR],
  ])("passes when the PR is %s", async (_, ageMs) => {
    await expect(main({ ghImpl: ghResult([pr(ageMs)]), now: () => NOW }))
      .resolves.toBe(0);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(`has been open ${(ageMs / HOUR).toFixed(2)}h (limit 48h)`),
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("fails one millisecond over the limit", async () => {
    await expect(main({ ghImpl: ghResult([pr(48 * HOUR + 1)]), now: () => NOW }))
      .resolves.toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("::error title=Autofix PR waiting for review::"),
    );
  });

  it("includes the PR number, URL, age, limit and operator action in the annotation", async () => {
    await expect(main({ ghImpl: ghResult([pr(49 * HOUR, 42)]), now: () => NOW }))
      .resolves.toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      "::error title=Autofix PR waiting for review::PR #42 https://github.com/example/repo/pull/42 has been open 49.00h (limit 48h). Merge it or close it; while the audit gate is red it blocks every PR.",
    );
  });

  it.each([
    ["oldest first", [pr(49 * HOUR, 2), pr(HOUR, 3)]],
    ["oldest last", [pr(HOUR, 3), pr(49 * HOUR, 2)]],
  ])("evaluates the oldest PR with %s", async (_, prs) => {
    await expect(main({ ghImpl: ghResult(prs), now: () => NOW })).resolves.toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("PR #2 https://github.com/example/repo/pull/2"),
    );
  });

  it.each([
    ["equals", ["--branch=custom/branch", "--max-age-hours=2.5"]],
    ["spaced", ["--branch", "custom/branch", "--max-age-hours", "2.5"]],
  ])("accepts branch and hour overrides in %s form", async (_, argv) => {
    const ghImpl = ghResult([pr(3 * HOUR)]);
    await expect(runCli(argv, { ghImpl, now: () => NOW })).resolves.toBe(1);
    expect(ghImpl).toHaveBeenCalledWith("gh", [
      "pr", "list", "--head", "custom/branch", "--state", "open",
      "--json", "number,url,createdAt",
    ]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("limit 2.5h"));
  });

  it("treats a fresh PR as stale with --max-age-hours 0", async () => {
    await expect(runCli(["--max-age-hours", "0"], {
      ghImpl: ghResult([pr(1)]), now: () => NOW,
    })).resolves.toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("limit 0h"));
  });

  it("passes a PR at exactly age zero with a zero limit", async () => {
    await expect(runCli(["--max-age-hours=0"], {
      ghImpl: ghResult([pr(0)]), now: () => NOW,
    })).resolves.toBe(0);
  });

  it.each([
    ["non-zero gh exit", vi.fn().mockRejectedValue(Object.assign(
      new Error("GraphQL: Could not resolve repository"), { code: 1 },
    ))],
    ["gh failed to start", vi.fn().mockRejectedValue(Object.assign(
      new Error("spawn gh ENOENT"), { code: "ENOENT" },
    ))],
    ["non-JSON output", vi.fn().mockResolvedValue({ stdout: "not json" })],
    ["non-array result", ghResult({})],
    ["null result", ghResult(null)],
    ["unparseable date", ghResult([{ ...pr(HOUR), createdAt: "invalid" }])],
    ["missing date", ghResult([{ number: 4 }])],
    ["null PR", ghResult([null])],
    ["invalid date after a valid PR", ghResult([pr(HOUR), { createdAt: "invalid" }])],
  ])("fails loudly for %s", async (_, ghImpl) => {
    await expect(main({ ghImpl, now: () => NOW })).resolves.toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("::error title=Autofix staleness check failed::"),
    );
    expect(console.log).not.toHaveBeenCalled();
  });

  it("uses the default gh runner and fails loudly when injected execFile rejects", async () => {
    const execFileImpl = vi.fn().mockRejectedValue(new Error("spawn gh ENOENT"));
    await expect(runCli([], { execFileImpl, now: () => NOW })).resolves.toBe(1);
    expect(execFileImpl).toHaveBeenCalledExactlyOnceWith("gh", [
      "pr", "list", "--head", "chore/audit-autofix", "--state", "open",
      "--json", "number,url,createdAt",
    ]);
    expect(console.error).toHaveBeenCalledWith(
      "::error title=Autofix staleness check failed::spawn gh ENOENT",
    );
  });

  it.each([
    ["--max-age-hours=banana"], ["--max-age-hours=-1"],
    ["--max-age-hours=NaN"], ["--max-age-hours=Infinity"],
    ["--max-age-hours=1e309"], ["--max-age-hours"],
    ["--max-age-hours="], ["--max-age-hours", " "],
    ["--max-age-hours", "--branch=foo"], ["--branch"], ["--branch="],
    ["--branch", "--max-age-hours=1"], ["--max-age-hour=1"],
    ["--unknown", "1"], ["unexpected"],
  ])("rejects invalid arguments %j without querying gh", async (...argv) => {
    const ghImpl = ghResult([]);
    await expect(runCli(argv, { ghImpl, now: () => NOW })).resolves.toBe(1);
    expect(ghImpl).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("::error title=Autofix staleness check invalid argument::"),
    );
  });

  it("fails loudly if the injected clock cannot evaluate the age", async () => {
    await expect(main({ ghImpl: ghResult([pr(HOUR)]), now: () => NaN }))
      .resolves.toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      "::error title=Autofix staleness check failed::The clock returned an invalid date.",
    );
  });

  it("escapes annotation messages to keep gh failures on one line", async () => {
    await main({ ghImpl: vi.fn().mockRejectedValue(new Error("bad%\r\noutput")) });
    expect(console.error).toHaveBeenCalledWith(
      "::error title=Autofix staleness check failed::bad%25%0D%0Aoutput",
    );
  });
});
