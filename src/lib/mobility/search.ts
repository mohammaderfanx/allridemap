import { z } from "zod";
import { useEffect, useState } from "react";
import type { Mode } from "./providers";

export const ALL_MODES: Mode[] = ["ride", "transit", "scooter", "bike", "walk"];

export const searchSchema = z.object({
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
  sort: z.enum(["fastest", "cheapest", "rated"]).optional().catch(undefined),
  modes: z.string().optional().catch(undefined),
});
export type TripSearch = z.infer<typeof searchSchema>;

export function parseModes(modes?: string): Mode[] {
  if (!modes) return ALL_MODES;
  const set = modes.split(",").filter((m): m is Mode => (ALL_MODES as string[]).includes(m));
  return set.length ? set : ALL_MODES;
}

/** Simulated live telemetry tick (every 3 s). */
export function useTick(ms = 3000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return tick;
}
