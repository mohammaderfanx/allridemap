import { useSyncExternalStore } from "react";
import { PLACES } from "./geo";

/**
 * AllRide Pulse — crowdsourced micro-reports with a trust/XP loop.
 * Reports are simulated locally now; the store mirrors the
 * community_mobility_reports table so a real feed can replace it
 * without UI changes. XP/tier persist in localStorage until accounts exist.
 */

export type ReportType =
  | "scooter_damaged"
  | "station_elevator_broken"
  | "high_crowding"
  | "police_check"
  | "custom_shortcut"
  | "surge_pricing";

export const REPORT_META: Record<ReportType, { label: string; emoji: string }> = {
  scooter_damaged: { label: "Scooter broken", emoji: "🛴" },
  station_elevator_broken: { label: "Elevator out", emoji: "🛗" },
  high_crowding: { label: "Crowded", emoji: "👥" },
  police_check: { label: "Ticket check", emoji: "🎫" },
  custom_shortcut: { label: "Shortcut", emoji: "✨" },
  surge_pricing: { label: "Surge pricing", emoji: "📈" },
};

export type PulseReport = {
  id: string;
  type: ReportType;
  lat: number;
  lng: number;
  upvotes: number;
  createdAt: number;
  expiresAt: number;
  mine?: boolean;
};

export const REPORT_TTL_MS = 15 * 60 * 1000;

export const XP_PER_REPORT = 10;
export const XP_PER_UPVOTE = 2;

export type TrustTier = "Newcomer" | "Navigator" | "Pathfinder" | "City Master";

export function tierForXp(xp: number): TrustTier {
  if (xp >= 200) return "City Master";
  if (xp >= 80) return "Pathfinder";
  if (xp >= 25) return "Navigator";
  return "Newcomer";
}

export function badgesFor(xp: number, reports: number, upvotes: number): string[] {
  const b: string[] = [];
  if (reports >= 1) b.push("First Signal");
  if (reports >= 5) b.push("Community Guardian");
  if (upvotes >= 10) b.push("Trusted Voice");
  if (xp >= 200) b.push("City Master");
  return b;
}

/** Reports still visible on the map. */
export function activeReports(reports: PulseReport[], now: number): PulseReport[] {
  return reports.filter((r) => r.expiresAt > now);
}

type GamState = { xp: number; reports: number; upvotes: number; voted: string[] };
const GAM_KEY = "allride.gamification.v1";

function loadGam(): GamState {
  try {
    const raw = localStorage.getItem(GAM_KEY);
    if (!raw) return { xp: 0, reports: 0, upvotes: 0, voted: [] };
    const p = JSON.parse(raw) as Partial<GamState>;
    return {
      xp: typeof p.xp === "number" && Number.isFinite(p.xp) ? p.xp : 0,
      reports: typeof p.reports === "number" ? p.reports : 0,
      upvotes: typeof p.upvotes === "number" ? p.upvotes : 0,
      voted: Array.isArray(p.voted) ? p.voted.filter((v) => typeof v === "string") : [],
    };
  } catch {
    return { xp: 0, reports: 0, upvotes: 0, voted: [] };
  }
}

function seedReports(): PulseReport[] {
  const now = Date.now();
  const defs: [ReportType, string, number][] = [
    ["scooter_damaged", "marienplatz", 4],
    ["high_crowding", "hbf", 9],
    ["station_elevator_broken", "charlottenplatz", 6],
    ["custom_shortcut", "feuersee", 12],
    ["surge_pricing", "schlossplatz", 2],
    ["police_check", "ostendplatz", 7],
  ];
  return defs.flatMap(([type, placeId, minsAgo]) => {
    const p = PLACES.find((x) => x.id === placeId);
    if (!p) return [];
    // jitter so pins don't sit exactly on place pins
    const lat = p.lat + 0.0012;
    const lng = p.lng - 0.0015;
    return [
      {
        id: `seed-${type}-${placeId}`,
        type,
        lat,
        lng,
        upvotes: Math.max(1, 10 - Math.floor(minsAgo / 2)),
        createdAt: now - minsAgo * 60_000,
        expiresAt: now - minsAgo * 60_000 + REPORT_TTL_MS,
      },
    ];
  });
}

class PulseFeed {
  private reports: PulseReport[] = [];
  private mine: PulseReport[] = [];
  private gam: GamState = { xp: 0, reports: 0, upvotes: 0, voted: [] };
  private listeners = new Set<() => void>();
  private seq = 0;

  constructor() {
    if (typeof window !== "undefined") this.gam = loadGam();
    this.reports = seedReports();
  }

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private persist() {
    try {
      localStorage.setItem(GAM_KEY, JSON.stringify(this.gam));
    } catch {
      /* private mode */
    }
  }

  getReports = (): PulseReport[] => {
    const now = Date.now();
    return [...activeReports(this.mine, now), ...activeReports(this.reports, now)];
  };

  getGamification = () => ({
    xp: this.gam.xp,
    tier: tierForXp(this.gam.xp),
    badges: badgesFor(this.gam.xp, this.gam.reports, this.gam.upvotes),
    reports: this.gam.reports,
  });

  addReport = (type: ReportType, lat: number, lng: number) => {
    const now = Date.now();
    this.mine = [
      {
        id: `me-${now}-${this.seq++}`,
        type,
        lat,
        lng,
        upvotes: 0,
        createdAt: now,
        expiresAt: now + REPORT_TTL_MS,
        mine: true,
      },
      ...this.mine,
    ];
    this.gam = {
      ...this.gam,
      xp: this.gam.xp + XP_PER_REPORT,
      reports: this.gam.reports + 1,
    };
    this.persist();
    this.emit();
  };

  upvote = (id: string) => {
    if (this.gam.voted.includes(id)) return false;
    this.gam = {
      ...this.gam,
      xp: this.gam.xp + XP_PER_UPVOTE,
      upvotes: this.gam.upvotes + 1,
      voted: [...this.gam.voted, id],
    };
    const bump = (r: PulseReport) => (r.id === id ? { ...r, upvotes: r.upvotes + 1 } : r);
    this.reports = this.reports.map(bump);
    this.mine = this.mine.map(bump);
    this.persist();
    this.emit();
    return true;
  };

  hasVoted = (id: string) => this.gam.voted.includes(id);
}

export const pulseFeed = new PulseFeed();

export function usePulseReports() {
  return useSyncExternalStore(pulseFeed.subscribe, pulseFeed.getReports, () => [] as PulseReport[]);
}

export function useGamification() {
  return useSyncExternalStore(pulseFeed.subscribe, pulseFeed.getGamification, () => ({
    xp: 0,
    tier: "Newcomer" as TrustTier,
    badges: [] as string[],
    reports: 0,
  }));
}
