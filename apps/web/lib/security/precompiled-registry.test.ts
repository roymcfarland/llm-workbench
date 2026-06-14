// @vitest-environment node

import {
  demoArtifactTypes,
  demoRuleSchemas,
  type SchemaRegistry,
} from "@llm-workbench/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  scenarioArtifactTypes,
  scenarioRuleSchemas,
} from "@/lib/landing/scenarios/schemas";

const validatorModule = "@/lib/security/precompiled-validators.generated.mjs";

const artifactTypes = [...demoArtifactTypes, ...scenarioArtifactTypes];
const ruleSchemas = [...demoRuleSchemas, ...scenarioRuleSchemas];
const schemaIds = [...artifactTypes, ...ruleSchemas].map(({ id }) => id);

async function loadBuilder(): Promise<
  typeof import("./precompiled-registry")
> {
  return import("./precompiled-registry");
}

function expectKnownArtifact(registry: SchemaRegistry, id: string): void {
  const result = registry.validateArtifact(id, {});
  if (!result.ok) {
    expect(result.errors[0]?.message).not.toBe(`Unknown artifact typeId: ${id}`);
  }
}

function expectKnownRule(registry: SchemaRegistry, id: string): void {
  const result = registry.validateRulePayload(id, {});
  if (!result.ok) {
    expect(result.errors[0]?.message).not.toBe(`Unknown ruleSchemaId: ${id}`);
  }
}

describe("buildPrecompiledRegistry", () => {
  afterEach(() => {
    vi.doUnmock(validatorModule);
    vi.resetModules();
  });

  it("registers every demo and scenario schema with precompiled validators", async () => {
    const { buildPrecompiledRegistry } = await loadBuilder();

    const registry = buildPrecompiledRegistry();

    for (const { id } of artifactTypes) {
      expectKnownArtifact(registry, id);
    }
    for (const { id } of ruleSchemas) {
      expectKnownRule(registry, id);
    }
    expect(registry.getExportRedactPaths("parserInputs")).toEqual([
      "/resumeText",
      "/profiles/0/url",
    ]);
  });

  it("throws clearly when a registered schema is missing a precompiled validator", async () => {
    const missingId = schemaIds[0];
    const validators = Object.fromEntries(
      schemaIds.slice(1).map((id) => [id, vi.fn(() => true)]),
    );

    vi.doMock(validatorModule, () => ({
      precompiledValidators: validators,
    }));

    const { buildPrecompiledRegistry } = await loadBuilder();

    expect(() => buildPrecompiledRegistry()).toThrow(
      `Missing precompiled Ajv validator(s) for schema id(s): ${missingId}`,
    );
  });
});
