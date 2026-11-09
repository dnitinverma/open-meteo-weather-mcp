import type { CSSProperties } from "react";
import type { SkyName } from "./sky";
import "./ambience.css";

/** What moves in each sky. Everything is CSS (transform and opacity only) and decorative. */
interface Spec {
  glow?: "sun" | "moon" | "dim";
  clouds?: number;
  fog?: number;
  rain?: number;
  snow?: number;
  stars?: number;
  flash?: boolean;
}

export const AMBIENCE: Record<SkyName, Spec> = {
  clear: { glow: "sun", stars: 16 },
  partly: { glow: "sun", clouds: 2, stars: 12 },
  overcast: { clouds: 4 },
  fog: { fog: 3 },
  rain: { clouds: 2, rain: 34 },
  snow: { snow: 18 },
  storm: { clouds: 2, rain: 40, flash: true },
  night: { glow: "moon", stars: 22 },
  "haze-moderate": { glow: "dim", fog: 2 },
  "haze-usg": { glow: "dim", fog: 3 },
  "haze-unhealthy": { glow: "dim", fog: 3 },
  "haze-very": { glow: "dim", fog: 4 },
  "haze-hazardous": { glow: "dim", fog: 4 },
};

/** Deterministic pseudo-random numbers in 0..1 (same layout every render, no Math.random). */
export function scatter(count: number, seed: number): [number, number, number][] {
  let s = seed >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return Array.from({ length: count }, () => [next(), next(), next()]);
}

const vars = (v: Record<string, string | number>) => v as CSSProperties;

/**
 * The weather itself, drifting behind the card's content: rain streaks, snowflakes, clouds,
 * fog, stars. Hidden from assistive tech and faded toward the bottom so text stays calm.
 * Stops entirely for people who prefer reduced motion (see ambience.css).
 */
export function SkyAmbience({ sky }: { sky: SkyName }) {
  const spec = AMBIENCE[sky];
  const clouds = spec.clouds ?? 0;
  const fog = spec.fog ?? 0;
  return (
    <div className="amb" aria-hidden="true" data-ambience={sky} key={sky}>
      {spec.glow && <span className={`amb-glow amb-glow-${spec.glow}`} />}
      {spec.stars ? (
        <span className="amb-layer amb-stars">
          {scatter(spec.stars, 7).map(([x, y, d], i) => (
            <i
              key={i}
              style={vars({
                "--x": `${x * 100}%`,
                "--y": `${y * 55}%`,
                "--d": d,
                "--r": 1 + (i % 3) * 0.5,
              })}
            />
          ))}
        </span>
      ) : null}
      {spec.clouds ? (
        <span className="amb-layer amb-clouds">
          {scatter(spec.clouds, 11).map(([x, y, d], i) => (
            <i
              key={i}
              style={vars({
                "--y": `${6 + y * 34}%`,
                "--w": `${150 + x * 130}px`,
                "--s": `${70 + d * 60}s`,
                "--d": (i + d) / clouds,
              })}
            />
          ))}
        </span>
      ) : null}
      {spec.fog ? (
        <span className="amb-layer amb-fog">
          {scatter(spec.fog, 13).map(([x, y, d], i) => (
            <i
              key={i}
              style={vars({
                "--y": `${8 + y * 70}%`,
                "--h": `${60 + x * 50}px`,
                "--s": `${55 + d * 50}s`,
                "--d": (i + d) / fog,
              })}
            />
          ))}
        </span>
      ) : null}
      {spec.rain ? (
        <span className="amb-layer amb-rain">
          {scatter(spec.rain, 17).map(([x, l, d], i) => (
            <i
              key={i}
              style={vars({
                "--x": `${x * 100}%`,
                "--l": `${24 + l * 22}px`,
                "--s": `${0.9 + d * 0.7}s`,
                "--d": d,
              })}
            />
          ))}
        </span>
      ) : null}
      {spec.snow ? (
        <span className="amb-layer amb-snow">
          {scatter(spec.snow, 19).map(([x, z, d], i) => (
            <i
              key={i}
              style={vars({
                "--x": `${x * 100}%`,
                "--z": `${3 + z * 3}px`,
                "--s": `${7 + d * 6}s`,
                "--d": d,
              })}
            />
          ))}
        </span>
      ) : null}
      {spec.flash && <span className="amb-layer amb-flash" />}
    </div>
  );
}
