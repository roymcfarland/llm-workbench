// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: LicenseRef-Proprietary
//
// ANSI-aware structured logger and `fail()` helper used across the
// bootstrap script. Color is emitted only when stdout is a TTY so logs
// stay clean in CI captures and pipe redirects.

const TTY = Boolean(process.stdout && process.stdout.isTTY);

function paint(code, s) {
  return TTY ? `\x1b[${code}m${s}\x1b[0m` : String(s);
}

export const colors = {
  bold: (s) => paint(1, s),
  dim: (s) => paint(2, s),
  red: (s) => paint(31, s),
  green: (s) => paint(32, s),
  yellow: (s) => paint(33, s),
  cyan: (s) => paint(36, s),
};

export function logger(step) {
  const prefix = colors.cyan(`[${step}]`);
  return {
    info: (msg) => process.stdout.write(`${prefix} ${msg}\n`),
    ok: (msg) => process.stdout.write(`${prefix} ${colors.green("✓")} ${msg}\n`),
    warn: (msg) => process.stderr.write(`${prefix} ${colors.yellow("!")} ${msg}\n`),
    err: (msg) => process.stderr.write(`${prefix} ${colors.red("✗")} ${msg}\n`),
    note: (msg) => process.stdout.write(`${prefix} ${colors.dim(msg)}\n`),
  };
}

/**
 * Emit a structured error and exit with a non-zero code. Avoids the
 * common `console.error(...) + process.exit(1)` pattern by enforcing
 * stderr formatting and an optional remediation hint.
 *
 * The `exit` argument is injected for tests so we can assert the error
 * payload without tearing down the test runner.
 */
export function fail(message, options = {}) {
  const { code = 1, hint, exit = process.exit, stderr = process.stderr } = options;
  stderr.write(`${colors.red("error:")} ${message}\n`);
  if (hint) stderr.write(`${colors.dim("hint:")} ${hint}\n`);
  return exit(code);
}
