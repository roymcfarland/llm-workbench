// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT

import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

import { classifyPublishFailure, main } from "./release-publish.mjs";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

const alreadyPublished = (packageName) => (
  `🦋  error an error occurred while publishing ${packageName}: undefined You cannot publish over the previously published versions: 0.3.1.`
);

const packageNames = [
  "@llm-workbench/adapters-react",
  "@llm-workbench/ai-sdk",
  "@llm-workbench/mcp",
  "@llm-workbench/runtime",
  "@llm-workbench/ui",
];
const noOpMessage = "release-publish: 5 package(s) already published at current version — treating as no-op\n";

function alreadyPublishedChunks() {
  return [
    `${packageNames.map(alreadyPublished).join("\n")}\n`,
    [
      "🦋  error packages failed to publish:",
      ...packageNames.map((packageName) => `🦋  ${packageName}@0.3.1`),
    ].join("\n"),
  ];
}

function createFakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

function mockChildProcess() {
  const child = createFakeChild();
  vi.mocked(spawn).mockReturnValueOnce(child);
  return child;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe("classifyPublishFailure", () => {
  it("treats an all-package already-published race as benign", () => {
    const packages = [
      "@llm-workbench/adapters-react",
      "@llm-workbench/ai-sdk",
      "@llm-workbench/mcp",
      "@llm-workbench/runtime",
      "@llm-workbench/ui",
    ];
    const output = [
      ...packages.map(alreadyPublished),
      "🦋  error packages failed to publish:",
      ...packages.map((packageName) => `🦋  ${packageName}@0.3.1`),
    ].join("\n");

    expect(classifyPublishFailure(output, 1)).toEqual({ benign: true });
  });

  it("does not swallow a mixed publish failure", () => {
    const output = [
      alreadyPublished("@llm-workbench/adapters-react"),
      "🦋  error an error occurred while publishing @llm-workbench/mcp: undefined 402 Payment Required",
      "🦋  error packages failed to publish:",
      "🦋  @llm-workbench/adapters-react@0.3.1",
      "🦋  @llm-workbench/mcp@0.3.1",
    ].join("\n");

    expect(classifyPublishFailure(output, 1)).toEqual({ benign: false });
  });

  it("does not swallow an unrelated failure", () => {
    expect(classifyPublishFailure("npm error build failed", 1)).toEqual({ benign: false });
  });
});

describe("main", () => {
  it("returns success without printing the no-op message", async () => {
    const child = mockChildProcess();
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const result = main();
    child.emit("close", 0);

    await expect(result).resolves.toBe(0);
    expect(spawn).toHaveBeenCalledWith("npx", ["changeset", "publish"]);
    expect(stdoutWrite).not.toHaveBeenCalledWith(noOpMessage);
  });

  it("treats a single-chunk already-published failure as success", async () => {
    const child = mockChildProcess();
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const output = alreadyPublishedChunks().join("");

    const result = main();
    child.stdout.emit("data", output);
    child.emit("close", 1);

    await expect(result).resolves.toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith(noOpMessage);
  });

  it("accumulates an already-published failure across chunks and streams", async () => {
    const child = mockChildProcess();
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const [publishedErrors, failedPackages] = alreadyPublishedChunks();

    const result = main();
    child.stdout.emit("data", publishedErrors);
    child.stderr.emit("data", failedPackages);
    child.emit("close", 1);

    await expect(result).resolves.toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith(noOpMessage);
    expect(stderrWrite).toHaveBeenCalledWith(failedPackages);
  });

  it("preserves a mixed publish failure exit code", async () => {
    const child = mockChildProcess();
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const output = [
      alreadyPublished("@llm-workbench/adapters-react"),
      "🦋  error an error occurred while publishing @llm-workbench/mcp: undefined 402 Payment Required",
      "🦋  error packages failed to publish:",
      "🦋  @llm-workbench/adapters-react@0.3.1",
      "🦋  @llm-workbench/mcp@0.3.1",
    ].join("\n");

    const result = main();
    child.stdout.emit("data", output);
    child.emit("close", 1);

    await expect(result).resolves.toBe(1);
    expect(stdoutWrite).not.toHaveBeenCalledWith(noOpMessage);
  });

  it("preserves an unrelated failure exit code", async () => {
    const child = mockChildProcess();
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const result = main();
    child.stdout.emit("data", "npm error build failed");
    child.emit("close", 1);

    await expect(result).resolves.toBe(1);
    expect(stdoutWrite).not.toHaveBeenCalledWith(noOpMessage);
  });

  it("passes subprocess output through to stdout and stderr", async () => {
    const child = mockChildProcess();
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const result = main();
    child.stdout.emit("data", "publishing packages\n");
    child.stderr.emit("data", "registry warning\n");
    child.emit("close", 0);

    await expect(result).resolves.toBe(0);
    expect(stdoutWrite).toHaveBeenCalledWith("publishing packages\n");
    expect(stderrWrite).toHaveBeenCalledWith("registry warning\n");
  });

  it("reports a spawn error and returns failure", async () => {
    const child = mockChildProcess();
    const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const message = "release-publish: failed to start changeset publish: spawn npx ENOENT\n";

    const result = main();
    child.emit("error", new Error("spawn npx ENOENT"));

    await expect(result).resolves.toBe(1);
    expect(stderrWrite).toHaveBeenCalledWith(message);
  });

  it("treats a null close code as failure", async () => {
    const child = mockChildProcess();
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const result = main();
    child.emit("close", null);

    await expect(result).resolves.toBe(1);
    expect(stdoutWrite).not.toHaveBeenCalledWith(noOpMessage);
  });
});
