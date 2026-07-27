import { createRequire } from "node:module";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const require = createRequire(import.meta.url);
const { version: reactVersion } = require("react/package.json");

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...nextCoreWebVitals,
  {
    files: ["**/*.{js,jsx,mjs,cjs,mts,cts}"],
    // Next's bundled Babel parser does not yet expose ESLint 10's addGlobals API.
    languageOptions: { parser: tseslint.parser },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    settings: {
      // ESLint 10 removed context.getFilename(), which react's auto-detection uses.
      react: { version: reactVersion },
    },
    rules: {
      // React 19 / eslint-plugin-react-hooks 7 — too strict for R3F useFrame,
      // next-themes mount guards, and media-query listeners used across the app.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
    },
  },
];

export default config;
