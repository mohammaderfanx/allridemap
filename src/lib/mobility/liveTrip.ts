import { useEffect, useState } from "react";
import type { Segment } from "./engine";
import { distanceM, type LatLng } from "./geo";

/** Simulated trip clock: 1 real second = SPEED trip seconds. Swap for GPS later without UI changes. */
export const LIVE_SPEED = 30;

export type LiveProgress = {
  elapsedMin: number;
  totalMin: number;
  step: number;
  stepFraction: number;
  stepRemainingMin: number;
  position: LatLng | undefined;
  done: boolean;
};

function pointAlong(path: LatLng[], f: number): LatLng | undefined {
  if (path.length === 0) return undefined;
  if (path.length === 1) return path[0];
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1]! + distanceM(path[i - 1]!, path[i]!));
  const target = cum[cum.length - 1]! * Math.min(1, Math.max(0, f));
  for (let i = 1; i < path.length; i++) {
    if (cum[i]! >= target) {
      const seg = cum[i]! - cum[i - 1]! || 1;
      const t = (target - cum[i - 1]!) / seg;
      const a = path[i - 1]!,
        b = path[i]!;
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    }
  }
  return path[path.length - 1];
}

export function computeProgress(segments: Segment[], elapsedMin: number): LiveProgress {
  const durs = segments.map((s) => Math.max(0.5, s.durationMin));
  const totalMin = durs.reduce((a, b) => a + b, 0);
  const e = Math.min(elapsedMin, totalMin);
  let acc = 0;
  for (let i = 0; i < segments.length; i++) {
    const d = durs[i]!;
    if (e < acc + d || i === segments.length - 1) {
      const f = Math.min(1, (e - acc) / d);
      return {
        elapsedMin: e,
        totalMin,
        step: i,
        stepFraction: f,
        stepRemainingMin: Math.max(0, d - (e - acc)),
        position: pointAlong(segments[i]!.path, f),
        done: e >= totalMin,
      };
    }
    acc += d;
  }
  return { elapsedMin: 0, totalMin, step: 0, stepFraction: 0, stepRemainingMin: 0, position: undefined, done: true };
}

/** Elapsed trip minutes, ticking smoothly while running. */
export function useLiveClock(running: boolean, paused: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    if (paused) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      setElapsed((e) => e + ((now - last) / 60000) * LIVE_SPEED);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, paused]);
  return [elapsed, setElapsed] as const;
}
