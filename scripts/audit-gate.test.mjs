// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  VALID_MODES,
  main,
  parseMode,
  runAudit as runAuditProcess,
  runCli,
} from "./audit-gate.mjs";
import {
  TRANSIENT_AUDIT_MARKERS,
  classifyAuditResult,
  runGateWithRetry,
} from "./lib/audit-gate-core.mjs";

const originalGitHubOutput = process.env.GITHUB_OUTPUT;

function auditResult(exitCode, output) {
  return { exitCode, output };
}

function createChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

beforeEach(() => {
  delete process.env.GITHUB_OUTPUT;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalGitHubOutput === undefined) delete process.env.GITHUB_OUTPUT;
  else process.env.GITHUB_OUTPUT = originalGitHubOutput;
});

describe("audit gate", () => {
  it("returns green after one successful attempt", async () => {
    const runAudit = vi.fn().mockResolvedValue(auditResult(0, "Passed."));
    const sleepImpl = vi.fn();

    await expect(
      runGateWithRetry({ runAudit, sleepImpl }),
    ).resolves.toEqual({ status: "green", output: "Passed.", attempts: 1 });
    expect(runAudit).toHaveBeenCalledOnce();
    expect(sleepImpl).not.toHaveBeenCalled();
  });

  it("returns advisories without retrying a real audit report", async () => {
    const output = 'NPM audit report results:\n{"advisories":{}}';
    const runAudit = vi.fn().mockResolvedValue(auditResult(1, output));
    const sleepImpl = vi.fn();

    await expect(
      runGateWithRetry({ runAudit, sleepImpl }),
    ).resolves.toEqual({ status: "advisories", output, attempts: 1 });
    expect(runAudit).toHaveBeenCalledOnce();
    expect(sleepImpl).not.toHaveBeenCalled();
  });

  it.each(TRANSIENT_AUDIT_MARKERS)(
    "classifies the transient marker %s as infrastructure",
    async (marker) => {
      const runAudit = vi.fn().mockResolvedValue(auditResult(1, marker));

      await expect(
        runGateWithRetry({ runAudit, attempts: 1, sleepImpl: vi.fn() }),
      ).resolves.toEqual({
        status: "infrastructure",
        output: marker,
        attempts: 1,
      });
    },
  );

  it("returns green when an infrastructure retry succeeds", async () => {
    const runAudit = vi
      .fn()
      .mockResolvedValueOnce(auditResult(1, "ETIMEDOUT"))
      .mockResolvedValueOnce(auditResult(0, "Passed."));
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const onAttempt = vi.fn();

    await expect(
      runGateWithRetry({ runAudit, sleepImpl, onAttempt }),
    ).resolves.toEqual({ status: "green", output: "Passed.", attempts: 2 });
    expect(sleepImpl).toHaveBeenCalledOnce();
    expect(sleepImpl).toHaveBeenCalledWith(30_000);
    expect(onAttempt).toHaveBeenNthCalledWith(1, 1, "infrastructure");
    expect(onAttempt).toHaveBeenNthCalledWith(2, 2, "green");
  });

  it("returns infrastructure after two infrastructure failures", async () => {
    const runAudit = vi
      .fn()
      .mockResolvedValueOnce(auditResult(1, "EAI_AGAIN"))
      .mockResolvedValueOnce(auditResult(1, "network timeout"));

    await expect(
      runGateWithRetry({ runAudit, sleepImpl: vi.fn() }),
    ).resolves.toEqual({
      status: "infrastructure",
      output: "network timeout",
      attempts: 2,
    });
    expect(runAudit).toHaveBeenCalledTimes(2);
  });

  it("keeps an unrecognised failure loud and does not retry it", async () => {
    const output = "some brand new failure";
    const runAudit = vi.fn().mockResolvedValue(auditResult(1, output));
    const sleepImpl = vi.fn();
    const result = await runGateWithRetry({ runAudit, sleepImpl });

    expect(result).toEqual({ status: "unknown", output, attempts: 1 });
    expect(result.status).not.toBe("infrastructure");
    expect(runAudit).toHaveBeenCalledOnce();
    expect(sleepImpl).not.toHaveBeenCalled();
  });

  it("lets a real audit report win over a transient marker", async () => {
    const output = "NPM audit report results:\nETIMEDOUT";
    const runAudit = vi.fn().mockResolvedValue(auditResult(1, output));

    await expect(
      runGateWithRetry({ runAudit, sleepImpl: vi.fn() }),
    ).resolves.toMatchObject({ status: "advisories", attempts: 1 });
    expect(classifyAuditResult({ exitCode: 1, output })).toBe("advisories");
    expect(runAudit).toHaveBeenCalledOnce();
  });
});

describe("audit gate runner", () => {
  it("captures and echoes merged audit-ci output", async () => {
    const child = createChild();
    const spawnImpl = vi.fn(() => {
      queueMicrotask(() => {
        child.stdout.emit("data", "stdout\n");
        child.stderr.emit("data", "stderr\n");
        child.emit("close", 0);
      });
      return child;
    });
    const stdout = { write: vi.fn() };

    await expect(runAuditProcess({ spawnImpl, stdout })).resolves.toEqual({
      exitCode: 0,
      output: "stdout\nstderr\n",
    });
    expect(spawnImpl).toHaveBeenCalledWith("npx", [
      "audit-ci",
      "--config",
      "audit-ci.jsonc",
    ]);
    expect(stdout.write).toHaveBeenNthCalledWith(1, "stdout\n");
    expect(stdout.write).toHaveBeenNthCalledWith(2, "stderr\n");
  });

  it("turns a spawn error into a captured unknown failure", async () => {
    const child = createChild();
    const spawnImpl = vi.fn(() => {
      queueMicrotask(() => {
        child.emit("error", new Error("npx missing"));
        child.emit("close", null);
      });
      return child;
    });
    const stdout = { write: vi.fn() };

    await expect(runAuditProcess({ spawnImpl, stdout })).resolves.toEqual({
      exitCode: 1,
      output: "audit-gate: failed to start audit-ci: npx missing\n",
    });
  });

  it("writes the stable workflow outputs in both modes", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "audit-gate-"));
    const outputPath = path.join(directory, "github-output");
    process.env.GITHUB_OUTPUT = outputPath;
    vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await expect(
        main({
          runAuditImpl: vi.fn().mockResolvedValue(auditResult(0, "Passed.")),
        }),
      ).resolves.toBe(0);
      await expect(
        main({
          runAuditImpl: vi
            .fn()
            .mockResolvedValue(auditResult(1, "NPM audit report results:")),
        }),
      ).resolves.toBe(0);
      await expect(
        main({
          runAuditImpl: vi
            .fn()
            .mockResolvedValue(auditResult(1, "NPM audit report results:")),
          mode: "gate",
        }),
      ).resolves.toBe(1);

      await expect(readFile(outputPath, "utf8")).resolves.toBe(
        "status=green\nred=false\nstatus=advisories\nred=true\nstatus=advisories\nred=true\n",
      );
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it("warns after retrying an infrastructure failure", async () => {
    const runAuditImpl = vi
      .fn()
      .mockResolvedValue(auditResult(1, "ETIMEDOUT"));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(
      main({ runAuditImpl, sleepImpl: vi.fn() }),
    ).resolves.toBe(0);
    expect(runAuditImpl).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith(
      "::warning title=Audit gate not evaluated::audit-ci could not reach the npm advisory registry after 2 attempts. The gate was NOT evaluated — this is not an advisory finding. The next scheduled run will retry.",
    );
  });

  it("fails an unknown result with the captured output", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      main({
        runAuditImpl: vi
          .fn()
          .mockResolvedValue(auditResult(1, "some brand new failure")),
      }),
    ).resolves.toBe(1);
    expect(error).toHaveBeenCalledWith(
      "::error title=Audit gate failed unexpectedly::some brand new failure",
    );
  });

  it("fails real advisories in gate mode without autofix wording", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const runAuditImpl = vi
      .fn()
      .mockResolvedValue(auditResult(1, "NPM audit report results:"));

    await expect(
      main({ runAuditImpl, sleepImpl: vi.fn(), mode: "gate" }),
    ).resolves.toBe(1);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("real high/critical advisory findings"),
    );
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("npm run audit:check locally"),
    );
    expect(error.mock.calls.flat().join(" ")).not.toContain("npm audit fix");
  });

  it("keeps autofix advisories non-failing and distinct from gate mode", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const runAuditImpl = vi
      .fn()
      .mockResolvedValue(auditResult(1, "NPM audit report results:"));

    const autofixExit = await main({
      runAuditImpl,
      sleepImpl: vi.fn(),
      mode: "autofix",
    });
    const gateExit = await main({
      runAuditImpl,
      sleepImpl: vi.fn(),
      mode: "gate",
    });

    expect(autofixExit).toBe(0);
    expect(gateExit).toBe(1);
    expect(autofixExit).not.toBe(gateExit);
  });

  it("passes a green result in gate mode", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(
      main({
        runAuditImpl: vi.fn().mockResolvedValue(auditResult(0, "Passed.")),
        sleepImpl: vi.fn(),
        mode: "gate",
      }),
    ).resolves.toBe(0);
  });

  it("warns and passes when gate mode cannot evaluate the registry", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(
      main({
        runAuditImpl: vi.fn().mockResolvedValue(auditResult(1, "ETIMEDOUT")),
        sleepImpl: vi.fn(),
        mode: "gate",
      }),
    ).resolves.toBe(0);
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^::warning .*The gate was NOT evaluated/),
    );
  });

  it("fails an unknown result in gate mode", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      main({
        runAuditImpl: vi
          .fn()
          .mockResolvedValue(auditResult(1, "some brand new failure")),
        sleepImpl: vi.fn(),
        mode: "gate",
      }),
    ).resolves.toBe(1);
  });

  it("defaults to the same advisory behavior as autofix mode", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const runAuditImpl = vi
      .fn()
      .mockResolvedValue(auditResult(1, "NPM audit report results:"));

    const defaultExit = await main({ runAuditImpl, sleepImpl: vi.fn() });
    const autofixExit = await main({
      runAuditImpl,
      sleepImpl: vi.fn(),
      mode: "autofix",
    });

    expect(defaultExit).toBe(autofixExit);
    expect(defaultExit).toBe(0);
  });

  it("fails an unrecognised status through the default arm", async () => {
    vi.resetModules();
    vi.doMock("./lib/audit-gate-core.mjs", async (importOriginal) => ({
      ...(await importOriginal()),
      runGateWithRetry: vi.fn().mockResolvedValue({
        status: "future-status",
        output: "unexpected future status",
        attempts: 1,
      }),
    }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const runAuditImpl = vi.fn().mockResolvedValue(auditResult(0, "unused"));

    try {
      const { main: mainWithUnexpectedStatus } = await import(
        "./audit-gate.mjs"
      );
      await expect(
        mainWithUnexpectedStatus({ runAuditImpl, sleepImpl: vi.fn() }),
      ).resolves.toBe(1);
      expect(error).toHaveBeenCalledWith(
        "::error title=Audit gate failed unexpectedly::unexpected future status",
      );
    } finally {
      vi.doUnmock("./lib/audit-gate-core.mjs");
      vi.resetModules();
    }
  });

  it.each([
    ["equals syntax", ["--mode=gate"], "gate", 1],
    ["spaced syntax", ["--mode", "gate"], "gate", 1],
    ["no mode", [], "autofix", 0],
    ["unknown flag", ["--other"], "autofix", 0],
    ["bare gate value", ["gate"], "autofix", 0],
  ])(
    "parses CLI mode with %s",
    async (_label, args, expectedMode, exitCode) => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
      const mode = parseMode(args);

      expect(mode).toBe(expectedMode);
      await expect(
        main({
          runAuditImpl: vi
            .fn()
            .mockResolvedValue(auditResult(1, "NPM audit report results:")),
          sleepImpl: vi.fn(),
          mode,
        }),
      ).resolves.toBe(exitCode);
    },
  );

  it("defines the valid modes once as a frozen list", () => {
    expect(VALID_MODES).toEqual(["autofix", "gate"]);
    expect(Object.isFrozen(VALID_MODES)).toBe(true);
  });

  it.each([
    [["--mode=GATE"], "GATE"],
    [["--mode=Gate"], "Gate"],
    [["--mode=other"], "other"],
    [["--mode", "banana"], "banana"],
    [["--mode", "--other"], "--other"],
    [["--mode"], "<missing>"],
  ])("rejects invalid CLI mode %j", (args, offendingValue) => {
    expect(() => parseMode(args)).toThrowError(
      expect.objectContaining({
        message: expect.stringMatching(
          new RegExp(`${offendingValue}.*autofix, gate`),
        ),
      }),
    );
  });

  it.each([[["--mode=autofix"]], [["--mode", "autofix"]]])(
    "accepts explicit autofix mode with %j",
    (args) => {
      expect(parseMode(args)).toBe("autofix");
    },
  );

  it("rejects an invalid mode passed directly to main", async () => {
    const runAuditImpl = vi.fn();

    await expect(main({ mode: "GATE", runAuditImpl })).rejects.toThrowError(
      /GATE.*autofix, gate/,
    );
    expect(runAuditImpl).not.toHaveBeenCalled();
  });

  it("returns 1 and emits a workflow error for an invalid CLI mode", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const mainImpl = vi.fn();

    await expect(runCli(["--mode=GATE"], { mainImpl })).resolves.toBe(1);
    expect(mainImpl).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(
        /^::error title=Audit gate invalid mode::.*GATE.*autofix, gate/,
      ),
    );
  });

  it("returns the injected main result for a valid CLI mode", async () => {
    const mainImpl = vi.fn().mockResolvedValue(7);

    await expect(runCli(["--mode=gate"], { mainImpl })).resolves.toBe(7);
    expect(mainImpl).toHaveBeenCalledWith({ mode: "gate" });
  });

  it("does not misreport unrelated CLI failures as invalid modes", async () => {
    const failure = new Error("audit runner failed");
    const mainImpl = vi.fn().mockRejectedValue(failure);

    await expect(runCli([], { mainImpl })).rejects.toBe(failure);
  });
});
