import { useSyncExternalStore } from "react";
import { ROADS } from "./city";
import { project, unproject } from "./geo";
import type { Mode } from "./providers";

/**
 * Live vehicle positions. The UI only depends on the `VehicleFeed` interface,
 * so the simulated feed below can be swapped for a WebSocket / API feed later.
 */
export type LiveVehicle = {
  id: string;
  providerId: string;
  mode: Mode;
  lat: number;
  lng: number;
  /** degrees, 0 = north */
  heading: number;
};

export interface VehicleFeed {
  subscribe(cb: () => void): () => void;
  getSnapshot(): LiveVehicle[];
  /** Update interval in ms, used by the map to interpolate smoothly. */
  readonly intervalMs: number;
}

type Track = { pts: { x: number; y: number }[]; cum: number[]; len: number };

function toTrack(path: { lat: number; lng: number }[]): Track {
  const pts = path.map(project);
  const cum = [0];
  for (let i = 1; i < pts.length; i++)
    cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  return { pts, cum, len: cum[cum.length - 1]! };
}

function pointAt(t: Track, d: number) {
  let i = 1;
  while (i < t.cum.length - 1 && t.cum[i]! < d) i++;
  const a = t.pts[i - 1]!;
  const b = t.pts[i]!;
  const seg = t.cum[i]! - t.cum[i - 1]! || 1;
  const k = Math.min(1, Math.max(0, (d - t.cum[i - 1]!) / seg));
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    heading: (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI,
  };
}

type Agent = {
  id: string;
  providerId: string;
  mode: Mode;
  track: Track;
  d: number;
  dir: 1 | -1;
  mps: number;
};

class SimulatedFeed implements VehicleFeed {
  readonly intervalMs = 400;
  private agents: Agent[] = [];
  private snapshot: LiveVehicle[] = [];
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const major = ROADS.filter((r) => r.class === "major").map((r) => toTrack(r.path));
    const minor = ROADS.filter((r) => r.class === "minor").map((r) => toTrack(r.path));
    const all = [...major, ...minor];
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const add = (n: number, ids: string[], mode: Mode, tracks: Track[], kmh: number) => {
      for (let i = 0; i < n; i++) {
        const track = tracks[Math.floor(rnd() * tracks.length)]!;
        this.agents.push({
          id: `${mode}-${i}`,
          providerId: ids[i % ids.length]!,
          mode,
          track,
          d: rnd() * track.len,
          dir: rnd() > 0.5 ? 1 : -1,
          mps: (kmh * (0.8 + rnd() * 0.4)) / 3.6,
        });
      }
    };
    add(16, ["uber", "bolt", "freenow", "taxi"], "ride", all, 32);
    add(6, ["vvs"], "transit", major, 42);
    add(14, ["lime", "tier", "voi", "dott"], "scooter", minor.length ? minor : all, 18);
    add(6, ["nextbike"], "bike", minor.length ? minor : all, 15);
    this.step(0);
  }

  private step(dt: number) {
    // Simulation runs 6x real time so movement is visible on a city-scale map.
    const speedUp = 6;
    this.snapshot = this.agents.map((a) => {
      a.d += a.dir * a.mps * dt * speedUp;
      if (a.d > a.track.len) {
        a.d = a.track.len;
        a.dir = -1;
      } else if (a.d < 0) {
        a.d = 0;
        a.dir = 1;
      }
      const p = pointAt(a.track, a.d);
      const ll = unproject(p.x, p.y);
      return {
        id: a.id,
        providerId: a.providerId,
        mode: a.mode,
        lat: ll.lat,
        lng: ll.lng,
        heading: a.dir === 1 ? p.heading : p.heading + 180,
      };
    });
    this.listeners.forEach((l) => l());
  }

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    if (!this.timer && typeof window !== "undefined") {
      this.timer = setInterval(() => this.step(this.intervalMs / 1000), this.intervalMs);
    }
    return () => {
      this.listeners.delete(cb);
      if (!this.listeners.size && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  };

  getSnapshot = () => this.snapshot;
}

export const vehicleFeed: VehicleFeed = new SimulatedFeed();

export function useLiveVehicles(feed: VehicleFeed = vehicleFeed) {
  return useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getSnapshot);
}
