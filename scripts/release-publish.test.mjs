// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";

import { classifyPublishFailure } from "./release-publish.mjs";

const alreadyPublished = (packageName) => (
  `🦋  error an error occurred while publishing ${packageName}: undefined You cannot publish over the previously published versions: 0.3.1.`
);

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
