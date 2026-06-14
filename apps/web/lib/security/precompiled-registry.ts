import {
  SchemaRegistry,
  demoArtifactTypes,
  demoRuleSchemas,
  type JsonSchema,
} from "@llm-workbench/runtime";
import type { ValidateFunction } from "ajv";

import {
  scenarioArtifactTypes,
  scenarioRuleSchemas,
} from "@/lib/landing/scenarios/schemas";
import { precompiledValidators } from "@/lib/security/precompiled-validators.generated.mjs";

type ArtifactSchema = {
  id: string;
  schema: JsonSchema;
  exportRedactPaths?: string[];
};

type RuleSchema = {
  id: string;
  schema: JsonSchema;
};

const artifactTypes: ArtifactSchema[] = [
  ...demoArtifactTypes,
  ...scenarioArtifactTypes,
];

const ruleSchemas: RuleSchema[] = [...demoRuleSchemas, ...scenarioRuleSchemas];

function requirePrecompiledValidator(id: string): ValidateFunction<unknown> {
  const validate = precompiledValidators[id];
  if (!validate) {
    throw new Error(
      `Missing precompiled Ajv validator for schema id "${id}". ` +
        "Run `npm run gen:validators` after changing registered schemas.",
    );
  }
  return validate;
}

function assertCompleteValidatorCoverage(): void {
  const missing = [...artifactTypes, ...ruleSchemas]
    .map(({ id }) => id)
    .filter((id) => !precompiledValidators[id]);

  if (missing.length > 0) {
    throw new Error(
      `Missing precompiled Ajv validator(s) for schema id(s): ${missing.join(", ")}. ` +
        "Run `npm run gen:validators` after changing registered schemas.",
    );
  }
}

export function buildPrecompiledRegistry(): SchemaRegistry {
  assertCompleteValidatorCoverage();

  const registry = new SchemaRegistry();

  for (const { id, schema, exportRedactPaths } of artifactTypes) {
    registry.registerArtifactType({
      id,
      schema,
      exportRedactPaths,
      validate: requirePrecompiledValidator(id),
    });
  }

  for (const { id, schema } of ruleSchemas) {
    registry.registerRulePayloadSchema({
      id,
      schema,
      validate: requirePrecompiledValidator(id),
    });
  }

  return registry;
}
