import { WorkbenchError } from "../errors.js";
import type { RuleSet } from "../protocol/rules.js";
import type { SchemaRegistry } from "../schema/registry.js";
import { formatAjvErrors } from "../schema/registry.js";
import type { WorkbenchSession } from "../runtime/session.js";

export function validatedWriteArtifact(
  registry: SchemaRegistry,
  session: WorkbenchSession,
  input: {
    artifactKey: string;
    typeId: string;
    data: unknown;
    idempotencyKey?: string;
  },
) {
  const v = registry.validateArtifact(input.typeId, input.data);
  if (!v.ok) throw new WorkbenchError("INVALID_INPUT", formatAjvErrors(v.errors));
  return session.writeArtifact(input);
}

export function validatedReplaceRuleSet(registry: SchemaRegistry, session: WorkbenchSession, ruleSet: RuleSet) {
  const v = registry.validateRuleSet({ ruleSchemaId: ruleSet.ruleSchemaId, rules: ruleSet.rules.map((r) => ({ id: r.id, payload: r.payload })) });
  if (!v.ok) {
    const msg = v.errors.map((e) => `${e.ruleId}: ${formatAjvErrors(e.errors)}`).join("; ");
    throw new WorkbenchError("INVALID_INPUT", msg);
  }
  session.replaceRuleSet(ruleSet);
}
