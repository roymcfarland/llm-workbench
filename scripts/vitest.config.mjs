// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.mjs"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage/scripts",
    },
  },
});
