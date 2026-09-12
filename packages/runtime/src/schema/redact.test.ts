import { describe, expect, it } from "vitest";
import { redactJson } from "./redact.js";

describe("redactJson", () => {
  it.each([
    { path: "/__proto__/p1", value: { a: 1 } },
    { path: "/a/__proto__/p2", value: { a: { b: 1 } } },
    { path: "/0/__proto__/p3", value: [{ a: 1 }] },
    { path: "/__proto__/__proto__/p4", value: JSON.parse('{"__proto__":{"x":1}}') },
  ])("does not pollute Object.prototype through $path", ({ path, value }) => {
    const before = Object.getOwnPropertyNames(Object.prototype);
    try {
      redactJson({ value, paths: [path] });
      expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(before);
    } finally {
      for (const key of Object.getOwnPropertyNames(Object.prototype)) {
        if (!before.includes(key)) Reflect.deleteProperty(Object.prototype, key);
      }
    }
  });

  it("does not swap the clone's prototype through a last-segment __proto__", () => {
    const out = redactJson({
      value: { a: 1 },
      paths: ["/__proto__"],
      replacement: { injected: true },
    }) as Record<string, unknown>;
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(out.injected).toBeUndefined();
  });

  it("redacts an own last-segment __proto__ data key", () => {
    const out = redactJson({
      value: JSON.parse('{"__proto__":"secret","k":1}'),
      paths: ["/__proto__"],
    });
    expect(Object.getOwnPropertyDescriptor(out, "__proto__")?.value).toBe("[REDACTED]");
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  });

  it("redacts through an own __proto__ data key", () => {
    const out = redactJson({
      value: JSON.parse('{"__proto__":{"token":"x"}}'),
      paths: ["/__proto__/token"],
    });
    expect(Object.getOwnPropertyDescriptor(out, "__proto__")?.value).toEqual({ token: "[REDACTED]" });
  });

  it("redacts through an own constructor field", () => {
    expect(redactJson({ value: { constructor: { token: "x" } }, paths: ["/constructor/token"] }))
      .toEqual({ constructor: { token: "[REDACTED]" } });
  });

  it("creates a missing last key", () => {
    expect(redactJson({ value: { a: 1 }, paths: ["/b"] })).toEqual({ a: 1, b: "[REDACTED]" });
  });

  it("skips an inherited toString path", () => {
    expect(redactJson({ value: { a: 1 }, paths: ["/toString/x"] })).toEqual({ a: 1 });
  });
});
