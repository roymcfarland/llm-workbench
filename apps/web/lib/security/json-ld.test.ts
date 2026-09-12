import { describe, expect, it } from "vitest";

import { serializeJsonLd } from "./json-ld";

describe("serializeJsonLd", () => {
  it("prevents script termination while preserving nested JSON values", () => {
    const input = {
      text: "</script><img src=x>",
      nested: { text: "</ScRiPt><img src=x>" },
      array: ["<!--", "<", { text: "</script>" }, 1, null, true],
    };
    const output = serializeJsonLd(input);
    expect(output).not.toContain("<");
    expect(output).toContain("\\u003c/script>");
    expect(JSON.parse(output)).toEqual(input);
  });
});
