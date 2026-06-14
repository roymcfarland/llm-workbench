// Copyright 2026 Roy McFarland
// SPDX-License-Identifier: LicenseRef-Proprietary
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  buildPrecompiledValidatorsModule,
  GENERATED_VALIDATORS_PATH,
} from "./gen-validators.mts";

describe("precompiled validator generation", () => {
  it("keeps the committed validator module fresh", async () => {
    const actual = await readFile(GENERATED_VALIDATORS_PATH, "utf8");
    expect(actual, "precompiled validators are stale; run `npm run gen:validators`").toBe(
      buildPrecompiledValidatorsModule(),
    );
  });

  it("emits working validators without dynamic-code markers", async () => {
    const source = await readFile(GENERATED_VALIDATORS_PATH, "utf8");
    expect(source).not.toMatch(/\beval\b|new Function/);

    const { precompiledValidators } = await import(
      "../apps/web/lib/security/precompiled-validators.generated.mjs"
    );
    const powerValidator = precompiledValidators["dlrn.power"];
    const ruleValidator = precompiledValidators.demoJobRule;

    expect(powerValidator({ gigawatts: 1.21, source: "plutonium" })).toBe(true);
    expect(powerValidator({})).toBe(false);
    expect(ruleValidator({ kind: "remote", value: "yes" })).toBe(true);
    expect(ruleValidator({ kind: "remote", value: "yes", extra: true })).toBe(false);
  });
});
