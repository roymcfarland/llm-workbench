"use client";

import {
  type CSSProperties,
  type MutableRefObject,
  type ReactElement,
  type SVGProps,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const CRAFT_KINDS = [
  "satellite",
  "orbitalStation",
  "saucer",
  "starFighter",
  "moonStation",
  "xWing",
] as const;

const FIRST_LAUNCH_DELAY = [6_000, 10_000] as const;
const NEXT_LAUNCH_DELAY = [25_000, 40_000] as const;
const OVERLAP_LAUNCH_DELAY = [11_000, 18_000] as const;
const UPPER_TOP_BANDS = [
  [7, 18],
  [18, 30],
  [30, 39],
] as const;
const EDGE_TOP_BANDS = [
  [56, 66],
  [66, 76],
] as const;

type CraftKind = (typeof CRAFT_KINDS)[number];
type DelayRange = readonly [min: number, max: number];
type SvgComponent = (props: SVGProps<SVGSVGElement>) => ReactElement;

type Craft = {
  id: number;
  kind: CraftKind;
  style: CraftStyle;
};

type CraftStyle = CSSProperties & {
  "--craft-duration": string;
  "--craft-drift-y": string;
  "--craft-end-rotation": string;
  "--craft-end-x": string;
  "--craft-opacity": string;
  "--craft-scale": string;
  "--craft-start-rotation": string;
  "--craft-start-x": string;
  "--craft-top": string;
  "--craft-width": string;
};

const CRAFT_COMPONENTS: Record<CraftKind, SvgComponent> = {
  satellite: SatelliteCraft,
  orbitalStation: OrbitalStationCraft,
  saucer: SaucerCraft,
  starFighter: StarFighterCraft,
  moonStation: MoonStationCraft,
  xWing: XWingCraft,
};

export function DriftingCraft() {
  const reducedMotion = useReducedMotionPreference();
  const motionAllowed = reducedMotion === false;
  const [activeCraft, setActiveCraft] = useState<Craft[]>([]);
  const activeCountRef = useRef(0);
  const hasLaunchedRef = useRef(false);
  const launchRef = useRef<(allowSecond?: boolean) => void>(() => undefined);
  const nextLaunchTimerRef = useRef<number | null>(null);
  const overlapLaunchTimerRef = useRef<number | null>(null);
  const sequenceRef = useRef(0);

  const clearAllTimers = useCallback(() => {
    clearScheduledTimer(nextLaunchTimerRef);
    clearScheduledTimer(overlapLaunchTimerRef);
  }, []);

  const scheduleNextLaunch = useCallback((range: DelayRange) => {
    clearScheduledTimer(nextLaunchTimerRef);
    nextLaunchTimerRef.current = window.setTimeout(() => {
      nextLaunchTimerRef.current = null;
      launchRef.current(false);
    }, randomBetween(range[0], range[1]));
  }, []);

  const launchCraft = useCallback((allowSecond = false) => {
    if (activeCountRef.current >= (allowSecond ? 2 : 1)) return;

    sequenceRef.current += 1;
    const craft = createCraft(sequenceRef.current);
    hasLaunchedRef.current = true;

    setActiveCraft((current) => {
      if (current.length >= 2) return current;
      if (current.length >= 1 && !allowSecond) return current;
      return [...current, craft];
    });

    if (!allowSecond && Math.random() < 0.2) {
      clearScheduledTimer(overlapLaunchTimerRef);
      overlapLaunchTimerRef.current = window.setTimeout(() => {
        overlapLaunchTimerRef.current = null;
        launchRef.current(true);
      }, randomBetween(OVERLAP_LAUNCH_DELAY[0], OVERLAP_LAUNCH_DELAY[1]));
    }
  }, []);

  useEffect(() => {
    launchRef.current = launchCraft;
  }, [launchCraft]);

  useEffect(() => {
    activeCountRef.current = activeCraft.length;

    if (!motionAllowed || !hasLaunchedRef.current || activeCraft.length > 0) {
      return;
    }

    scheduleNextLaunch(NEXT_LAUNCH_DELAY);
  }, [activeCraft.length, motionAllowed, scheduleNextLaunch]);

  useEffect(() => {
    if (!motionAllowed) {
      hasLaunchedRef.current = false;
      activeCountRef.current = 0;
      clearAllTimers();
      setActiveCraft([]);
      return undefined;
    }

    scheduleNextLaunch(FIRST_LAUNCH_DELAY);
    return clearAllTimers;
  }, [clearAllTimers, motionAllowed, scheduleNextLaunch]);

  const removeCraft = useCallback((id: number) => {
    setActiveCraft((current) => current.filter((craft) => craft.id !== id));
  }, []);

  if (!motionAllowed) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-20 overflow-hidden"
    >
      <style>{DRIFTING_CRAFT_STYLES}</style>
      {activeCraft.map((craft) => {
        const CraftSvg = CRAFT_COMPONENTS[craft.kind];
        return (
          <div
            key={craft.id}
            className="drifting-craft__item"
            style={craft.style}
            onAnimationEnd={() => removeCraft(craft.id)}
          >
            <CraftSvg className="block h-auto w-full overflow-visible" />
          </div>
        );
      })}
    </div>
  );
}

function useReducedMotionPreference(): boolean | null {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setReducedMotion(false);
      return undefined;
    }

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(query.matches);

    updatePreference();
    query.addEventListener?.("change", updatePreference);
    return () => query.removeEventListener?.("change", updatePreference);
  }, []);

  return reducedMotion;
}

function createCraft(id: number): Craft {
  const leftToRight = Math.random() < 0.72;
  const startRotation = randomBetween(-7, 7);
  const endRotation = startRotation + randomBetween(-9, 9);

  return {
    id,
    kind: pickOne(CRAFT_KINDS),
    style: {
      "--craft-duration": `${randomBetween(18_000, 30_000).toFixed(0)}ms`,
      "--craft-drift-y": `${randomBetween(-34, 34).toFixed(1)}px`,
      "--craft-end-rotation": `${endRotation.toFixed(2)}deg`,
      "--craft-end-x": leftToRight ? "calc(100vw + 14rem)" : "-14rem",
      "--craft-opacity": randomBetween(0.16, 0.2).toFixed(3),
      "--craft-scale": randomBetween(0.6, 1.2).toFixed(3),
      "--craft-start-rotation": `${startRotation.toFixed(2)}deg`,
      "--craft-start-x": leftToRight ? "-14rem" : "calc(100vw + 14rem)",
      "--craft-top": `${pickTopPercent().toFixed(2)}%`,
      "--craft-width": `${randomBetween(72, 108).toFixed(1)}px`,
    },
  };
}

function pickTopPercent(): number {
  const band = Math.random() < 0.82 ? pickOne(UPPER_TOP_BANDS) : pickOne(EDGE_TOP_BANDS);
  return randomBetween(band[0], band[1]);
}

function pickOne<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)]!;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clearScheduledTimer(ref: MutableRefObject<number | null>) {
  if (ref.current === null) return;
  window.clearTimeout(ref.current);
  ref.current = null;
}

function SatelliteCraft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 64" fill="none" {...props}>
      <rect x="47" y="24" width="26" height="17" rx="4" fill="currentColor" />
      <rect x="9" y="19" width="29" height="26" rx="2" fill="currentColor" />
      <rect x="82" y="19" width="29" height="26" rx="2" fill="currentColor" />
      <path
        d="M38 32h9M73 32h9M60 24V14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <path
        d="M66 16c10 0 18 7 19 17"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <circle cx="60" cy="12" r="4" fill="currentColor" />
    </svg>
  );
}

function OrbitalStationCraft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 72" fill="none" {...props}>
      <ellipse
        cx="60"
        cy="36"
        rx="48"
        ry="15"
        stroke="currentColor"
        strokeWidth="7"
      />
      <circle cx="60" cy="36" r="19" fill="currentColor" />
      <circle cx="60" cy="36" r="7" fill="var(--color-background)" opacity="0.34" />
      <path d="M60 17v-9M60 64v-9" stroke="currentColor" strokeLinecap="round" strokeWidth="5" />
    </svg>
  );
}

function SaucerCraft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 64" fill="none" {...props}>
      <ellipse cx="60" cy="36" rx="48" ry="12" fill="currentColor" />
      <path d="M37 34c4-12 14-19 23-19s19 7 23 19H37Z" fill="currentColor" />
      <ellipse cx="60" cy="42" rx="31" ry="6" fill="var(--color-background)" opacity="0.28" />
      <circle cx="43" cy="43" r="2.5" fill="currentColor" />
      <circle cx="60" cy="45" r="2.5" fill="currentColor" />
      <circle cx="77" cy="43" r="2.5" fill="currentColor" />
    </svg>
  );
}

function StarFighterCraft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 128 72" fill="none" {...props}>
      <path d="M18 36 74 23l31 13-31 13L18 36Z" fill="currentColor" />
      <path d="M54 29 31 8l42 16-6 8-13-3ZM54 43 31 64l42-16-6-8-13 3Z" fill="currentColor" />
      <path d="M83 27 114 13l-16 19-15-5ZM83 45l31 14-16-19-15 5Z" fill="currentColor" />
      <ellipse cx="31" cy="36" rx="12" ry="5" fill="var(--color-background)" opacity="0.26" />
    </svg>
  );
}

function MoonStationCraft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 96 96" fill="none" {...props}>
      <circle cx="48" cy="48" r="34" fill="currentColor" />
      <circle cx="60" cy="36" r="10" fill="var(--color-background)" opacity="0.34" />
      <circle cx="60" cy="36" r="4" fill="currentColor" opacity="0.68" />
      <path
        d="M17 49c18 5 42 5 62 0"
        stroke="var(--color-background)"
        strokeLinecap="round"
        strokeWidth="4"
        opacity="0.38"
      />
    </svg>
  );
}

function XWingCraft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 128 72" fill="none" {...props}>
      <path d="M24 36 76 28l28 8-28 8-52-8Z" fill="currentColor" />
      <path d="M58 29 25 8l43 14-1 8-9-1ZM58 43 25 64l43-14-1-8-9 1Z" fill="currentColor" />
      <path d="M75 27 112 10 91 34l-16-7ZM75 45l37 17-21-24-16 7Z" fill="currentColor" />
      <circle cx="92" cy="23" r="4" fill="currentColor" />
      <circle cx="92" cy="49" r="4" fill="currentColor" />
      <rect x="99" y="33" width="14" height="6" rx="3" fill="currentColor" />
    </svg>
  );
}

const DRIFTING_CRAFT_STYLES = `
  .drifting-craft__item {
    animation: drifting-craft-flight var(--craft-duration) linear forwards;
    color: color-mix(
      in srgb,
      var(--color-muted-foreground) 78%,
      var(--color-foreground) 22%
    );
    filter: drop-shadow(0 0 12px color-mix(in srgb, currentColor 34%, transparent));
    left: 0;
    opacity: var(--craft-opacity);
    position: absolute;
    top: var(--craft-top);
    transform: translate3d(var(--craft-start-x), 0, 0)
      scale(var(--craft-scale))
      rotate(var(--craft-start-rotation));
    transform-origin: center;
    width: var(--craft-width);
    will-change: transform;
  }

  @keyframes drifting-craft-flight {
    to {
      transform: translate3d(var(--craft-end-x), var(--craft-drift-y), 0)
        scale(var(--craft-scale))
        rotate(var(--craft-end-rotation));
    }
  }
`;
