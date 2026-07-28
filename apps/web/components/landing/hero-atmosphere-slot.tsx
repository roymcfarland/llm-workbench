"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

function HeroPlaceholder() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 min-h-[min(100dvh,56rem)] w-full landing-mesh opacity-70"
    />
  );
}

const CosmosField = dynamic(
  () =>
    import("@/components/landing/cosmos-field").then((m) => m.CosmosField),
  { ssr: false, loading: HeroPlaceholder },
);

const HeroAtmosphere = dynamic(
  () =>
    import("@/components/landing/hero-atmosphere").then((m) => m.HeroAtmosphere),
  { ssr: false, loading: HeroPlaceholder },
);

type HeroAtmosphereSlotProps = {
  className?: string;
};

export function HeroAtmosphereSlot({ className }: HeroAtmosphereSlotProps) {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);

  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  if (reducedMotion === null) return <HeroPlaceholder />;
  return reducedMotion ? (
    <CosmosField className={className} />
  ) : (
    <HeroAtmosphere className={className} />
  );
}
