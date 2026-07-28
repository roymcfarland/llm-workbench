"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";

type Inherited = Omit<ComponentPropsWithoutRef<typeof Link>, "href">;

type PlaygroundMarketingLinkProps = Inherited & {
  isSignedIn: boolean;
};

/**
 * Single anchor for playground CTAs. Auth state is resolved server-side and passed
 * in so marketing pages ship no Clerk client runtime. Signed-out visitors use
 * `/sign-in?redirect_url=…` (better for crawlers than `/playground`), while signed-in
 * visitors link directly to `/playground`. Forwards refs for `Button asChild`.
 * Defaults `prefetch={false}` to avoid probing gated routes.
 */
export const PlaygroundMarketingLink = forwardRef<
  HTMLAnchorElement,
  PlaygroundMarketingLinkProps
>(function PlaygroundMarketingLink({ isSignedIn, prefetch = false, ...rest }, ref) {
  const href = isSignedIn ? "/playground" : "/sign-in?redirect_url=/playground";

  return <Link ref={ref} href={href} prefetch={prefetch} {...rest} />;
});
