// SDK 5's dependency tree introduces advisories into the root lockfile.
// Keep the pinned compatibility check isolated and never execute install scripts.
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = resolve(packageDir, "../..");
const scratch = await mkdtemp(join(tmpdir(), "llm-workbench-ai5-"));
const version = "5.0.273";
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}
try {
  await writeFile(join(scratch, "package.json"), JSON.stringify({ private: true, type: "module" }));
  run(process.platform === "win32" ? "npm.cmd" : "npm", [
    "install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", `ai@${version}`,
  ], scratch);
  const installed = JSON.parse(await readFile(join(scratch, "node_modules/ai/package.json"), "utf8"));
  if (installed.version !== version) throw new Error(`Expected ai ${version}, found ${installed.version}`);
  const config = join(scratch, "tsconfig.json");
  await writeFile(config, JSON.stringify({
    extends: join(packageDir, "tsconfig.ai5.json"),
    compilerOptions: {
      baseUrl: repoDir,
      typeRoots: [join(repoDir, "node_modules/@types")],
      paths: {
        ai: [join(scratch, "node_modules/ai/dist/index.d.ts")],
        "json-schema": [require.resolve("@types/json-schema/index.d.ts")],
      },
    },
  }, null, 2));
  run(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", config], repoDir);
  console.log(`AI SDK ${version}: declarations and type tests passed.`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
