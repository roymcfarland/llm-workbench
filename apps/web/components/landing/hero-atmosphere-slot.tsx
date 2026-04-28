"use client";

import dynamic from "next/dynamic";

const HeroAtmosphere = dynamic(
  () =>
    import("@/components/landing/hero-atmosphere").then((m) => m.HeroAtmosphere),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="absolute inset-0 min-h-[min(100dvh,56rem)] w-full landing-mesh opacity-70"
      />
    ),
  },
);

type HeroAtmosphereSlotProps = {
  className?: string;
};

export function HeroAtmosphereSlot({ className }: HeroAtmosphereSlotProps) {
  return <HeroAtmosphere className={className} />;
}
