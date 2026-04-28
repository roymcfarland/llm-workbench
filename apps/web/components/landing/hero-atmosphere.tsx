"use client";

import { Sparkles } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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

/** Window-based pointer so we can keep `pointer-events: none` on the canvas (clicks pass through). */
function PointerParallax() {
  const { camera } = useThree();
  const target = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      target.current.y = -(e.clientY / Math.max(window.innerHeight, 1)) * 2 + 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  useFrame(() => {
    if (document.visibilityState === "hidden") return;
    const tx = target.current.x * 0.38;
    const ty = target.current.y * 0.24;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, tx, 0.045);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, ty, 0.045);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, 4.55, 0.06);
    camera.lookAt(0, 0, 0);
  });
  return null;
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
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = spread * Math.cbrt(Math.random());
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

function WireHaloRings() {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (document.visibilityState === "hidden") return;
    if (a.current) {
      a.current.rotation.x += dt * 0.095;
      a.current.rotation.y += dt * 0.055;
    }
    if (b.current) {
      b.current.rotation.x -= dt * 0.075;
      b.current.rotation.z += dt * 0.042;
    }
  });
  return (
    <group>
      <mesh ref={a}>
        <torusGeometry args={[1.18, 0.016, 14, 100]} />
        <meshBasicMaterial color="#c4b5fd" transparent opacity={0.32} wireframe />
      </mesh>
      <mesh ref={b} rotation={[0.45, 0.25, 0.35]}>
        <torusGeometry args={[1.62, 0.012, 12, 88]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.2} wireframe />
      </mesh>
    </group>
  );
}

function UniverseScene({ isDark, isMobile }: { isDark: boolean; isMobile: boolean }) {
  const sparkleCount = isMobile ? 90 : 260;
  const n = isMobile ? 3200 : 10500;
  const c1 = isDark ? "#5eead4" : "#0d9488";
  const c2 = isDark ? "#d8b4fe" : "#7c3aed";
  return (
    <>
      <PointerParallax />
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
      <WireHaloRings />
      <Sparkles
        count={sparkleCount}
        scale={isMobile ? 8.5 : 12.5}
        size={isMobile ? 1.9 : 2.6}
        speed={0.32}
        opacity={isDark ? 0.52 : 0.34}
        color={isDark ? "#f0abfc" : "#db2777"}
      />
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
      >
        <Suspense fallback={null}>
          <UniverseScene isDark={isDark} isMobile={mobile} />
        </Suspense>
      </Canvas>
    </div>
  );
}
