"use client";

import { Sparkles } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

import { CosmosField } from "@/components/landing/cosmos-field";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const h = () => setReduced(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return reduced;
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia("(max-width: 768px)");
    setMobile(mq.matches);
    const h = () => setMobile(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return mobile;
}

/** Deterministic pseudo-random in [0,1) for stable particle placement (pure render). */
function hash01(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function GalaxyPoints({
  count,
  spread,
  color,
  size,
  speed,
}: {
  count: number;
  spread: number;
  color: string;
  size: number;
  speed: number;
}) {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = hash01(i, 0);
      const v = hash01(i, 1);
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = spread * Math.cbrt(hash01(i, 2));
      const sinPhi = Math.sin(phi);
      positions[i * 3] = r * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = r * sinPhi * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count, spread]);

  useFrame((_, dt) => {
    if (!ref.current || document.visibilityState === "hidden") return;
    ref.current.rotation.y += dt * speed;
    ref.current.rotation.x += dt * speed * 0.11;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        color={color}
        size={size}
        transparent
        opacity={0.92}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function PostGlow({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <Bloom
        luminanceThreshold={0.11}
        mipmapBlur
        intensity={0.78}
        radius={0.39}
      />
    </EffectComposer>
  );
}

function UniverseScene({
  isDark,
  isMobile,
}: {
  isDark: boolean;
  isMobile: boolean;
}) {
  const sparkleCount = isMobile ? 90 : 280;
  const n = isMobile ? 3200 : 11000;
  const c1 = isDark ? "#5eead4" : "#0d9488";
  const c2 = isDark ? "#d8b4fe" : "#7c3aed";
  const bloom = !isMobile;

  return (
    <>
      <GalaxyPoints
        count={n}
        spread={isMobile ? 5.2 : 6.8}
        color={c1}
        size={isMobile ? 0.019 : 0.013}
        speed={0.022}
      />
      <GalaxyPoints
        count={Math.floor(n * 0.42)}
        spread={isMobile ? 3.4 : 4.4}
        color={c2}
        size={isMobile ? 0.015 : 0.01}
        speed={-0.016}
      />
      <Sparkles
        count={sparkleCount}
        scale={isMobile ? 8.5 : 12.5}
        size={isMobile ? 1.9 : 2.6}
        speed={0.32}
        opacity={isDark ? 0.52 : 0.34}
        color={isDark ? "#f0abfc" : "#db2777"}
      />
      <PostGlow enabled={bloom} />
    </>
  );
}

type HeroAtmosphereProps = {
  className?: string;
};

export function HeroAtmosphere({ className }: HeroAtmosphereProps) {
  const reduced = usePrefersReducedMotion();
  const mobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { resolvedTheme } = useTheme();
  const isDark = !mounted || resolvedTheme !== "light";

  if (reduced) {
    return <CosmosField className={className} />;
  }

  return (
    <div className={cn("absolute inset-0 touch-none overflow-hidden", className)}>
      <Canvas
        aria-hidden
        className="h-full min-h-full w-full !touch-none"
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
        dpr={[1, 2]}
        camera={{ fov: 54, near: 0.08, far: 55, position: [0, 0, 4.55] }}
        style={{ pointerEvents: "none" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
          gl.setClearColor(0x000000, 0);
        }}
      >
        <Suspense fallback={null}>
          <UniverseScene isDark={isDark} isMobile={mobile} />
        </Suspense>
      </Canvas>
    </div>
  );
}
