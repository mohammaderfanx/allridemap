import { useSyncExternalStore } from "react";
import { distanceM } from "./geo";
import type { Segment, TripOption } from "./engine";

/** Average private petrol/diesel car, grams CO2 per km (tank-to-wheel + upstream). */
export const CAR_BASELINE_G_PER_KM = 170;
export const BASELINE_LABEL = "Average private petrol car";
/** 1 green point per 100 g CO2 saved. */
export const GRAMS_PER_POINT = 100;

export function tripDistanceKm(segments: Segment[]): number {
  let m = 0;
  segments.forEach((s) => {
    for (let i = 1; i < s.path.length; i++) m += distanceM(s.path[i - 1]!, s.path[i]!);
  });
  return m / 1000;
}

export function co2SavedGrams(distanceKm: number, tripCo2g: number): number {
  return Math.max(0, Math.round(distanceKm * CAR_BASELINE_G_PER_KM - tripCo2g));
}

export function pointsFor(savedG: number): number {
  return Math.floor(savedG / GRAMS_PER_POINT);
}

export function savingsFor(option: Pick<TripOption, "segments" | "co2g">) {
  const km = tripDistanceKm(option.segments);
  const saved = co2SavedGrams(km, option.co2g);
  return { km, saved, points: pointsFor(saved) };
}

/* ---- on-device ledger (no accounts yet); swappable for a server ledger later ---- */
export type LedgerEntry = {
  id: string;
  at: string;
  provider: string;
  co2SavedG: number;
  baseline: string;
};
const KEY = "allride.carbonLedger.v1";
const listeners = new Set<() => void>();
let cache: LedgerEntry[] | null = null;
const EMPTY: LedgerEntry[] = [];

function read(): LedgerEntry[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "[]") as LedgerEntry[];
  } catch {
    cache = [];
  }
  return cache;
}

export function recordSaving(provider: string, co2SavedG: number) {
  const next = [
    ...read(),
    {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      provider,
      co2SavedG,
      baseline: BASELINE_LABEL,
    },
  ];
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full / private mode */
  }
  listeners.forEach((l) => l());
}

export function useCarbonLedger(): LedgerEntry[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => EMPTY,
  );
}

export function ledgerTotals(entries: LedgerEntry[]) {
  const saved = entries.reduce((a, e) => a + e.co2SavedG, 0);
  return { trips: entries.length, saved, points: pointsFor(saved) };
}
