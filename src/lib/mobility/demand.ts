import { useEffect, useState } from "react";
import { CITY_CENTER, PLACES, distanceM, type LatLng } from "./geo";

/**
 * Demand & fleet prediction (simulated).
 * Spatial unit: Uber H3 hexagons at resolution 8 (~0.7 km²).
 * The model is a deterministic stand-in for a trained model; swap `predictCell`
 * for a real API response keyed by H3 index without touching the map/UI.
 */
export const H3_RES = 8;
export type Horizon = 0 | 30 | 60;
export type DemandCell = {
  h3: string;
  boundary: LatLng[];
  /** predicted wait for a vehicle, minutes */
  waitMin: number;
  /** predicted available vehicles nearby */
  supply: number;
  /** demand / supply ratio, >1 means shortfall */
  pressure: number;
  surge: number;
};

type H3 = typeof import("h3-js");
let h3Promise: Promise<H3> | null = null;
const loadH3 = () => (h3Promise ??= import("h3-js"));

/** Base demand hotspots (stations, nightlife, offices) with weights. */
const HOTSPOTS: { id: string; w: number; peak: "commute" | "evening" | "all" }[] = [
  { id: "hbf", w: 1.0, peak: "all" },
  { id: "schlossplatz", w: 0.8, peak: "evening" },
  { id: "marienplatz", w: 0.5, peak: "evening" },
  { id: "feuersee", w: 0.45, peak: "evening" },
  { id: "cannstatt", w: 0.7, peak: "commute" },
  { id: "vaihingen", w: 0.6, peak: "commute" },
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

function timeFactor(hour: number, peak: "commute" | "evening" | "all") {
  const commute = Math.exp(-((hour - 8) ** 2) / 2) + Math.exp(-((hour - 17.5) ** 2) / 2);
  const evening = Math.exp(-((((hour - 22 + 24) % 24) - 0) ** 2) / 6) + Math.exp(-((hour - 21) ** 2) / 4);
  if (peak === "commute") return 0.3 + commute;
  if (peak === "evening") return 0.3 + evening;
  return 0.5 + 0.6 * commute + 0.4 * evening;
}

export function predictCell(h3: string, center: LatLng, at: Date): Omit<DemandCell, "boundary"> {
  const hour = at.getHours() + at.getMinutes() / 60;
  let demand = 0.15;
  for (const hs of HOTSPOTS) {
    const p = PLACES.find((x) => x.id === hs.id);
    if (!p) continue;
    const d = distanceM(center, p);
    demand += hs.w * timeFactor(hour, hs.peak) * Math.exp(-(d * d) / (2 * 900 * 900));
  }
  // slow-moving noise per 15-min bucket so the forecast evolves
  const bucket = Math.floor(at.getTime() / 900000);
  demand *= 0.8 + 0.4 * hash(h3 + bucket);
  const distC = distanceM(center, CITY_CENTER);
  const supply = Math.max(0, Math.round(14 * Math.exp(-distC / 2500) * (0.6 + 0.8 * hash(h3 + "s" + bucket))));
  const pressure = demand * 10 / Math.max(1, supply);
  const waitMin = Math.round(Math.min(25, 2 + pressure * 3 + distC / 1200));
  const surge = Math.round(Math.min(2.2, Math.max(1, 0.8 + pressure * 0.35)) * 100) / 100;
  return { h3, waitMin, supply, pressure, surge };
}

export async function predictDemand(horizon: Horizon, now = new Date()): Promise<DemandCell[]> {
  const h3 = await loadH3();
  const origin = h3.latLngToCell(CITY_CENTER.lat, CITY_CENTER.lng, H3_RES);
  const at = new Date(now.getTime() + horizon * 60000);
  return h3.gridDisk(origin, 7).map((cell) => {
    const [lat, lng] = h3.cellToLatLng(cell);
    const boundary = h3.cellToBoundary(cell).map(([la, ln]) => ({ lat: la, lng: ln }));
    return { ...predictCell(cell, { lat, lng }, at), boundary };
  });
}

/** Re-predicts every minute while enabled. */
export function useDemandForecast(enabled: boolean, horizon: Horizon) {
  const [cells, setCells] = useState<DemandCell[]>([]);
  useEffect(() => {
    if (!enabled) return setCells([]);
    let alive = true;
    const run = () =>
      predictDemand(horizon)
        .then((c) => alive && setCells(c))
        .catch(() => alive && setCells([]));
    run();
    const id = setInterval(run, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [enabled, horizon]);
  return cells;
}
