import { fileURLToPath } from "node:url";
import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

// `server-only` throws at import time outside React Server Components. The
// runs-store and tenant modules import it; aliasing to a no-op lets vitest
// load them in a Node test environment without exercising real Clerk or
// Supabase clients (we mock those at the test boundary).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": here,
      "server-only": path.join(here, "test/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["**/*.test.ts", "**/*.test.tsx"],
    environment: "node",
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
});
