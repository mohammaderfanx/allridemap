import { useEffect, useState } from "react";
import type { LatLng } from "./geo";
import type { Mode } from "./providers";
import type { Segment } from "./engine";

export type RoadRoute = { path: LatLng[]; distanceM: number; durationS: number };

const cache = new Map<string, Promise<RoadRoute[]>>();

function profileFor(mode: Mode) {
  return mode === "walk" ? "foot" : mode === "bike" || mode === "scooter" ? "bike" : "car";
}

/** Street-following routes from the free OpenStreetMap router. */
export function fetchRoutes(via: LatLng[], mode: Mode, alternatives = false): Promise<RoadRoute[]> {
  const coords = via.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(";");
  const key = `${profileFor(mode)}|${coords}|${alternatives}`;
  let hit = cache.get(key);
  if (!hit) {
    const url = `https://routing.openstreetmap.de/routed-${profileFor(mode)}/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=${alternatives ? 3 : "false"}`;
    hit = fetch(url)
      .then((r) => r.json())
      .then(
        (j: {
          routes?: {
            geometry: { coordinates: [number, number][] };
            distance: number;
            duration: number;
          }[];
        }) =>
          (j.routes ?? []).map((r) => ({
            path: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
            distanceM: r.distance,
            durationS: r.duration,
          })),
      )
      .catch(() => {
        cache.delete(key);
        return [];
      });
    cache.set(key, hit);
  }
  return hit;
}

/** Alternatives for a route; multi-stop routes combine per-leg alternatives so stops are still visited in order. */
async function alternativesFor(via: LatLng[], mode: Mode): Promise<RoadRoute[]> {
  if (via.length <= 2) return legAlternatives(via, mode);
  const legs = await Promise.all(via.slice(1).map((p, i) => legAlternatives([via[i]!, p], mode)));
  if (legs.some((l) => !l.length)) return fetchRoutes(via, mode);
  const count = Math.max(...legs.map((l) => l.length));
  const out: RoadRoute[] = [];
  for (let k = 0; k < Math.min(3, count); k++) {
    const parts = legs.map((l) => l[Math.min(k, l.length - 1)]!);
    out.push({
      path: parts.flatMap((r, i) => (i ? r.path.slice(1) : r.path)),
      distanceM: parts.reduce((s, r) => s + r.distanceM, 0),
      durationS: parts.reduce((s, r) => s + r.durationS, 0),
    });
  }
  return out.filter(
    (r, i) => out.findIndex((o) => Math.abs(o.distanceM - r.distanceM) < 150) === i,
  );
}

/** Alternatives for a single A→B leg: router alternatives plus left/right detours for variety. */
async function legAlternatives(via: LatLng[], mode: Mode): Promise<RoadRoute[]> {
  const base = await fetchRoutes(via, mode, true);
  if (base.length >= 3) return base.slice(0, 3);
  const [a, b] = via as [LatLng, LatLng];
  const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
  const dLat = b.lat - a.lat;
  const dLng = b.lng - a.lng;
  const detours = [0.22, -0.22].map((k) => ({
    lat: mid.lat + dLng * k * 0.66,
    lng: mid.lng - dLat * k * 1.5,
  }));
  const extra = await Promise.all(detours.map((d) => fetchRoutes([a, d, b], mode)));
  const all = [...base, ...extra.map((r) => r[0]).filter((r): r is RoadRoute => !!r)];
  const unique = all.filter(
    (r, i) => all.findIndex((o) => Math.abs(o.distanceM - r.distanceM) < 150) === i,
  );
  return unique.slice(0, 3);
}

export function mainSegmentIndex(segments: Segment[]) {
  let best = 0;
  segments.forEach((s, i) => {
    const b = segments[best]!;
    if (
      (s.mode !== "walk" && b.mode === "walk") ||
      ((s.mode !== "walk") === (b.mode !== "walk") && s.distanceM > b.distanceM)
    )
      best = i;
  });
  return best;
}

/** Replaces straight segment paths with street-following ones; exposes alternatives for the main leg. */
export function useRoadSegments(segments: Segment[] | undefined, altIndex: number) {
  const [state, setState] = useState<{ key: string; segs: Segment[]; alts: RoadRoute[] } | null>(
    null,
  );
  const key =
    segments
      ?.map((s) => s.via.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(";") + s.mode)
      .join("|") ?? "";

  useEffect(() => {
    if (!segments?.length) return;
    let alive = true;
    const mi = mainSegmentIndex(segments);
    Promise.all(
      segments.map((s, i) =>
        i === mi ? alternativesFor(s.via, s.mode) : fetchRoutes(s.via, s.mode),
      ),
    ).then((results) => {
      if (!alive) return;
      const alts = results[mi] ?? [];
      setState({
        key,
        alts,
        segs: segments.map((s, i) => {
          const r = i === mi ? alts[Math.min(altIndex, alts.length - 1)] : results[i]?.[0];
          return r ? { ...s, path: r.path } : s;
        }),
      });
    });
    return () => {
      alive = false;
    };
  }, [key, altIndex]);

  if (!segments?.length)
    return { segments: undefined, alternatives: [] as RoadRoute[], mainIndex: 0, ready: false };
  const ready = state?.key === key;
  return {
    segments: ready ? state.segs : segments,
    alternatives: ready ? state.alts : [],
    mainIndex: mainSegmentIndex(segments),
    ready,
  };
}
