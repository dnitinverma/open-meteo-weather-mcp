import { useEffect, useRef, useState } from "react";

export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/** Value `t` (0..1) of the way from `from` to `to`, eased. */
export function valueAt(from: number, to: number, t: number): number {
  return from + (to - from) * easeOutCubic(Math.min(Math.max(t, 0), 1));
}

/**
 * True when motion should be skipped: the user asked for reduced motion, or there is no
 * matchMedia to ask (tests, very old webviews), in which case values simply appear.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A number that glides to its target: from `from` on first appearance, from wherever it is when
 * the target changes (so a unit toggle or a refresh counts to the new reading).
 */
export function useAnimatedNumber(target: number, duration = 800, from = 0): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? target : from));
  const current = useRef(shown);

  useEffect(() => {
    if (prefersReducedMotion()) {
      current.current = target;
      setShown(target);
      return;
    }
    const start = current.current;
    if (start === target) return;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = (now - startedAt) / duration;
      const value = t >= 1 ? target : valueAt(start, target, t);
      current.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return shown;
}

/** Renders `value` rounded to `digits` decimals, counting up to it. Plain text, no wrapper. */
export function AnimatedNumber({
  value,
  digits = 0,
  duration = 800,
}: {
  value: number;
  digits?: number;
  duration?: number;
}) {
  const shown = useAnimatedNumber(value, duration);
  return <>{digits > 0 ? shown.toFixed(digits) : Math.round(shown)}</>;
}
