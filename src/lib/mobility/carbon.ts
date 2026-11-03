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

function isEntry(e: unknown): e is LedgerEntry {
  if (!e || typeof e !== "object") return false;
  const x = e as Record<string, unknown>;
  return typeof x.id === "string" && typeof x.at === "string" && typeof x.provider === "string" &&
    typeof x.co2SavedG === "number" && Number.isFinite(x.co2SavedG);
}

/** Parses stored ledger data; anything damaged is dropped instead of crashing the page. */
export function parseLedger(raw: string | null): LedgerEntry[] {
  try {
    const v: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function load(): LedgerEntry[] {
  try {
    return parseLedger(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

function read(): LedgerEntry[] {
  if (!cache) cache = load();
  return cache;
}

let storageBound = false;
function bindStorage() {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;
  // Keep totals in sync when another tab records a trip.
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    cache = load();
    listeners.forEach((l) => l());
  });
}

export function recordSaving(provider: string, co2SavedG: number) {
  // Re-read storage first so we never overwrite trips saved in another tab.
  const next = [
    ...load(),
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
      bindStorage();
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
