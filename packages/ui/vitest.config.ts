import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: false,
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
});
