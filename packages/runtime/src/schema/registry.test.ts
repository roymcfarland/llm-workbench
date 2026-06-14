import { describe, expect, it } from "vitest";
import type { ValidateFunction } from "ajv";
import { redactJson } from "./redact.js";
import { SchemaRegistry } from "./registry.js";

describe("SchemaRegistry", () => {
  it("validates artifacts and applies validated patches", () => {
    const r = new SchemaRegistry();
    r.registerArtifactType({
      id: "doc",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { a: { type: "number" }, b: { type: "string" } },
        required: ["a"],
      },
    });
    expect(r.validateArtifact("doc", { a: 1 }).ok).toBe(true);
    expect(r.validateArtifact("doc", { a: "x" } as never).ok).toBe(false);

    const patched = r.applyValidatedPatch({
      typeId: "doc",
      base: { a: 1 },
      patch: [{ op: "replace", path: "/a", value: 2 }],
    });
    expect(patched.ok).toBe(true);
    if (patched.ok) expect(patched.data).toEqual({ a: 2 });
  });

  it("redactJson skips invalid pointers without throwing", () => {
    const out = redactJson({ value: { a: 1 }, paths: ["/missing/deep", "/a"] });
    expect(out).toEqual({ a: "[REDACTED]" });
  });

  it("stores supplied validators without compiling schemas", () => {
    const r = new SchemaRegistry();
    const validate = (() => true) as ValidateFunction<unknown>;
    validate.errors = null;

    r.registerArtifactType({
      id: "precompiled",
      schema: { type: "object", unknownStrictKeyword: true },
      validate,
    });
    r.registerRulePayloadSchema({
      id: "precompiledRule",
      schema: { type: "object", unknownStrictKeyword: true },
      validate,
    });

    expect(r.validateArtifact("precompiled", { ok: true }).ok).toBe(true);
    expect(r.validateRulePayload("precompiledRule", { ok: true }).ok).toBe(true);
  });
});
