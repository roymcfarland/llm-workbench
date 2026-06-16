// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: MIT
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.mjs"],
    environment: "node",
  },
});
