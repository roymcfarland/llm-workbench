import { Ajv } from "ajv";
import type { ErrorObject, ValidateFunction } from "ajv";
// fast-json-patch is CommonJS; under plain Node ESM its named exports are not
// statically detectable, so `import { applyPatch }` throws at runtime (it works
// only under bundlers). Default-import the module and destructure.
import fastJsonPatch from "fast-json-patch";
import type { Operation } from "fast-json-patch";
const { applyPatch } = fastJsonPatch;

export type JsonSchema = Record<string, unknown>;

export type RegisteredArtifactType = {
  id: string;
  schema: JsonSchema;
  validate: ValidateFunction<unknown>;
  /** JSON Pointer paths (RFC 6901) redacted in `profile: "user"` exports. */
  exportRedactPaths: string[];
};

export type RegisteredRuleSchema = {
  id: string;
  schema: JsonSchema;
  validate: ValidateFunction<unknown>;
};

export type RegisterArtifactTypeInput = {
  id: string;
  schema: JsonSchema;
  validate?: ValidateFunction<unknown>;
  exportRedactPaths?: string[];
};

export type RegisterRulePayloadSchemaInput = {
  id: string;
  schema: JsonSchema;
  validate?: ValidateFunction<unknown>;
};

export class SchemaRegistry {
  private ajv?: Ajv;
  private artifacts = new Map<string, RegisteredArtifactType>();
  private rules = new Map<string, RegisteredRuleSchema>();

  private get compiler(): Ajv {
    this.ajv ??= new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });
    return this.ajv;
  }

  registerArtifactType(input: RegisterArtifactTypeInput): void {
    const validate = input.validate ?? this.compiler.compile(input.schema);
    this.artifacts.set(input.id, {
      id: input.id,
      schema: input.schema,
      validate,
      exportRedactPaths: input.exportRedactPaths ?? [],
    });
  }

  getExportRedactPaths(typeId: string): string[] {
    return this.artifacts.get(typeId)?.exportRedactPaths ?? [];
  }

  registerRulePayloadSchema(input: RegisterRulePayloadSchemaInput): void {
    const validate = input.validate ?? this.compiler.compile(input.schema);
    this.rules.set(input.id, { id: input.id, schema: input.schema, validate });
  }

  validateArtifact(typeId: string, data: unknown): { ok: true } | { ok: false; errors: ErrorObject[] } {
    const reg = this.artifacts.get(typeId);
    if (!reg) return { ok: false, errors: [{ message: `Unknown artifact typeId: ${typeId}` } as ErrorObject] };
    const ok = reg.validate(data);
    if (ok) return { ok: true };
    return { ok: false, errors: reg.validate.errors ?? [] };
  }

  validateRulePayload(ruleSchemaId: string, payload: unknown): { ok: true } | { ok: false; errors: ErrorObject[] } {
    const reg = this.rules.get(ruleSchemaId);
    if (!reg) return { ok: false, errors: [{ message: `Unknown ruleSchemaId: ${ruleSchemaId}` } as ErrorObject] };
    const ok = reg.validate(payload);
    if (ok) return { ok: true };
    return { ok: false, errors: reg.validate.errors ?? [] };
  }

  validateRuleSet(input: { ruleSchemaId: string; rules: Array<{ id: string; payload: unknown }> }): {
    ok: true;
  } | {
    ok: false;
    errors: Array<{ ruleId: string; errors: ErrorObject[] }>;
  } {
    const errors: Array<{ ruleId: string; errors: ErrorObject[] }> = [];
    for (const r of input.rules) {
      const v = this.validateRulePayload(input.ruleSchemaId, r.payload);
      if (!v.ok) errors.push({ ruleId: r.id, errors: v.errors });
    }
    if (errors.length) return { ok: false, errors };
    return { ok: true };
  }

  applyValidatedPatch(input: {
    typeId: string;
    base: unknown;
    patch: Operation[];
  }): { ok: true; data: unknown } | { ok: false; errors: ErrorObject[] } {
    const clone = structuredClone(input.base);
    let next: unknown;
    try {
      next = applyPatch(clone, input.patch, true, false).newDocument;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, errors: [{ message } as ErrorObject] };
    }
    const v = this.validateArtifact(input.typeId, next);
    if (!v.ok) return v;
    return { ok: true, data: next };
  }
}

export function formatAjvErrors(errors: ErrorObject[]): string {
  return errors
    .map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim())
    .join("; ");
}
