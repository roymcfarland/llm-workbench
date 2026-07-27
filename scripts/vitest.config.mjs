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
      // Scope to this workspace's own sources. Vitest resolves coverage globs
      // from the repo root (where `test:scripts` runs), so a bare `**/*.mjs`
      // swept in 12 unrelated files -- apps/web build scripts, an examples
      // server, and root/apps/web config files -- and attributed them to the
      // `scripts` flag at 0% each.
      include: ["scripts/**/*.mjs"],
    },
  },
});
