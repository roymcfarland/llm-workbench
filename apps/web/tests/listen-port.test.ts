import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLAYWRIGHT_PORT,
  parseListenPortFromEnv,
} from "../e2e/listen-port";

describe("parseListenPortFromEnv", () => {
  it("returns default when unset", () => {
    expect(parseListenPortFromEnv({})).toBe(DEFAULT_PLAYWRIGHT_PORT);
  });

  it("respects PLAYWRIGHT_WEB_PORT", () => {
    expect(
      parseListenPortFromEnv({ PLAYWRIGHT_WEB_PORT: "4000", PATH: "/" }),
    ).toBe(4000);
  });

  it("rejects garbage and out-of-range", () => {
    expect(
      parseListenPortFromEnv({ PLAYWRIGHT_WEB_PORT: "nope", PATH: "/" }),
    ).toBe(DEFAULT_PLAYWRIGHT_PORT);
    expect(
      parseListenPortFromEnv({ PLAYWRIGHT_WEB_PORT: "99999", PATH: "/" }),
    ).toBe(DEFAULT_PLAYWRIGHT_PORT);
    expect(parseListenPortFromEnv({ PLAYWRIGHT_WEB_PORT: "0", PATH: "/" })).toBe(
      DEFAULT_PLAYWRIGHT_PORT,
    );
  });

  it("trims whitespace", () => {
    expect(parseListenPortFromEnv({ PLAYWRIGHT_WEB_PORT: "  3405  " })).toBe(
      3405,
    );
  });
});
