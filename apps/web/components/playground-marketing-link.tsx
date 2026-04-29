"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";

import { useAuth } from "@clerk/nextjs";

type Inherited = Omit<ComponentPropsWithoutRef<typeof Link>, "href">;

/**
 * Single anchor for playground CTAs: `/sign-in?redirect_url=…` when signed out (better
 * for crawlers than `/playground`), `/playground` when signed in. Forwards refs for
 * `Button asChild`. Defaults `prefetch={false}` to avoid probing gated routes.
 */
export const PlaygroundMarketingLink = forwardRef<HTMLAnchorElement, Inherited>(
  function PlaygroundMarketingLink({ prefetch = false, ...rest }, ref) {
    const { isLoaded, userId } = useAuth();
    const href =
      !isLoaded || !userId ? "/sign-in?redirect_url=/playground" : "/playground";

    return <Link ref={ref} href={href} prefetch={prefetch} {...rest} />;
  },
);
