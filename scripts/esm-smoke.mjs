// Plain-Node ESM smoke test — the guard for "the packages are actually
// importable by an outside consumer."
//
// WHY this exists and why it must run under plain `node` (not vitest): the
// runtime's vitest suite runs through Vite, which bundles CommonJS deps and
// papers over CJS/ESM named-import interop problems. A named import from a
// CommonJS dependency (`import { applyPatch } from "fast-json-patch"`) passes
// every bundled test yet throws `SyntaxError: Named export not found` the
// moment a real consumer imports the published package under Node's ESM loader.
// This script imports the server-side publishable packages exactly as an
// installed consumer would and drives a minimal run, so that regression fails
// CI loudly instead of shipping a package nobody can import.
//
// Run via `npm run smoke:esm` (after `npm run build`). Wired into the root `ci`
// script and the CI workflow.

import {
  WorkbenchRuntime,
  SchemaRegistry,
  registerDemoSchemas,
} from "@llm-workbench/runtime";
// These two are server-side and must also stay plain-Node importable.
import "@llm-workbench/ai-sdk";
import "@llm-workbench/mcp";

const registry = new SchemaRegistry();
registerDemoSchemas(registry);

const rt = new WorkbenchRuntime();
const { runId } = rt.startRun({
  workflow: {
    id: "esm-smoke",
    version: 1,
    steps: [{ id: "a", gatePolicy: "AUTO" }],
    edges: [],
  },
});
const s = rt.session(runId);
s.beginStep("a");
s.writeArtifact({
  artifactKey: "k",
  typeId: "compiledProfile",
  data: { headline: "h", skills: ["s"], summary: "y" },
});
// Exercises fast-json-patch, the dependency whose named import broke plain Node.
s.patchArtifact({
  artifactKey: "k",
  patch: [{ op: "replace", path: "/headline", value: "patched" }],
});
s.completeStep("a");
const bundle = await s.exportRunBundle({ profile: "full" });

if (!bundle.integrity?.sha256 || bundle.trace.length === 0) {
  console.error("ESM smoke FAILED: run did not produce a signed bundle");
  process.exit(1);
}
console.log(
  `ESM smoke OK: runtime + ai-sdk + mcp import under plain Node; ` +
    `drove a run (${bundle.trace.length} trace events, signed ${bundle.integrity.sha256.slice(0, 12)}…)`,
);
