import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { getSessionUserId } from "@/lib/auth/session";

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>;
const mockHeaders = vi.mocked(headers) as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getSessionUserId", () => {
  it("returns null without calling auth when x-nonce is absent", async () => {
    mockHeaders.mockResolvedValue(new Headers());

    await expect(getSessionUserId()).resolves.toBeNull();
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it("returns the signed-in userId when x-nonce is present", async () => {
    mockHeaders.mockResolvedValue(new Headers({ "x-nonce": "test-nonce" }));
    mockAuth.mockResolvedValue({ userId: "u1" });

    await expect(getSessionUserId()).resolves.toBe("u1");
  });

  it("returns null for a signed-out proxied request", async () => {
    mockHeaders.mockResolvedValue(new Headers({ "x-nonce": "test-nonce" }));
    mockAuth.mockResolvedValue({ userId: null });

    await expect(getSessionUserId()).resolves.toBeNull();
  });

  it("propagates the same Clerk error on a proxied request", async () => {
    mockHeaders.mockResolvedValue(new Headers({ "x-nonce": "test-nonce" }));
    const error = new Error("Clerk session failure");
    mockAuth.mockRejectedValue(error);

    await expect(getSessionUserId()).rejects.toBe(error);
  });
});
