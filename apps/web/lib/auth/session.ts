import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";

export async function getSessionUserId(): Promise<string | null> {
  // The proxy matcher skips dotted paths, so those requests have no Clerk
  // context. Clerk errors on proxied requests must stay loud.
  if (!(await headers()).get("x-nonce")) return null;

  return (await auth()).userId ?? null;
}
