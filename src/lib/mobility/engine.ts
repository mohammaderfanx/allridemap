import { distanceM, lerp, placeById, PLACES, type LatLng, type Place } from "./geo";
import { deepLink, providerById, type Mode } from "./providers";

/* ------------------------------------------------------------------ *
 * Deterministic pseudo-random helpers (same output on server+client)
 * ------------------------------------------------------------------ */

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rand(key: string): number {
  return mulberry32(hash(key))();
}

/* ------------------------------------------------------------------ *
 * Live-ish city state
 * ------------------------------------------------------------------ */

export type Vehicle = {
  id: string;
  providerId: string;
  mode: Mode;
  lat: number;
  lng: number;
  battery: number;
};

const SCOOTER_PROVIDERS = ["lime", "tier", "voi", "dott"];

/** Deterministic fleet, gently animated by `tick` so badges feel live. */
export function generateFleet(tick = 0): Vehicle[] {
  const out: Vehicle[] = [];
  PLACES.forEach((place, pi) => {
    const density = place.district === "Mitte" ? 26 : place.district === "Bad Cannstatt" ? 18 : 11;
    for (let i = 0; i < density; i++) {
      const r = mulberry32(hash(`${place.id}:${i}`));
      const providerId = i % 7 === 6 ? "nextbike" : SCOOTER_PROVIDERS[Math.floor(r() * 4)]!;
      const spread = 0.0075 + r() * 0.011;
      const ang = r() * Math.PI * 2;
      const drift = Math.sin(tick / 9 + pi + i) * 0.00035;
      out.push({
        id: `${place.id}-${i}`,
        providerId,
        mode: providerId === "nextbike" ? "bike" : "scooter",
        lat: place.lat + Math.sin(ang) * spread * 0.72 + drift,
        lng: place.lng + Math.cos(ang) * spread + drift * 1.4,
        battery: Math.round(28 + r() * 71),
      });
    }
  });
  return out;
}

/** Surge factor for ride-hailing, slowly oscillating and area dependent. */
export function surgeFor(providerId: string, origin: Place, tick = 0): number {
  const base = 1 + rand(`${providerId}:${origin.id}:surge`) * 0.55;
  const wave = 0.12 * Math.sin(tick / 23 + hash(providerId) / 1e9);
  return Math.max(1, Number((base + wave).toFixed(2)));
}

/** Provider trust score, specific to the pickup area. */
export function ratingFor(providerId: string, place: Place): number {
  const central = place.district === "Mitte" || place.district === "Bad Cannstatt";
  const base = 3.3 + rand(`${providerId}:${place.id}:rate`) * 1.3;
  return Number(Math.min(5, base + (central ? 0.35 : -0.15)).toFixed(1));
}

/* ------------------------------------------------------------------ *
 * Route shapes
 * ------------------------------------------------------------------ */

function polyline(a: LatLng, b: LatLng, seed: string, bend = 1): LatLng[] {
  const pts: LatLng[] = [];
  const steps = 8;
  const r = mulberry32(hash(seed));
  const off = (r() - 0.5) * 0.006 * bend;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (i === 0 || i === steps) {
      pts.push(i === 0 ? { lat: a.lat, lng: a.lng } : { lat: b.lat, lng: b.lng });
      continue;
    }
    const p = lerp(a, b, t);
    const k = Math.sin(t * Math.PI);
    pts.push({
      lat: p.lat + off * k + (r() - 0.5) * 0.0006 * bend,
      lng: p.lng + off * k * 0.8 + (r() - 0.5) * 0.0006 * bend,
    });
  }
  return pts;
}

export type Segment = {
  mode: Mode;
  providerId: string;
  label: string;
  detail: string;
  durationMin: number;
  distanceM: number;
  path: LatLng[];
  /** key waypoints the street router must pass through */
  via: LatLng[];
};

export type TripOption = {
  id: string;
  providerId: string;
  providerName: string;
  mode: Mode;
  headline: string;
  price: number | null;
  priceLabel: string;
  durationMin: number;
  departsInMin: number;
  rating: number;
  availability: string;
  surge?: number;
  co2g: number;
  segments: Segment[];
  deepLink: { app: string; web: string };
  /** number of vehicle changes */
  transfers?: number;
  /** transit line used, for live delay matching */
  lineCode?: string;
  /** live service alert applied to this option */
  alert?: { header: string; delayMin: number; severity: string };
  /** not beaten on time, cost, CO2 and transfers by any other option */
  pareto?: boolean;
};

export type ServiceAlert = { affected_lines: string[]; header_text: string; delay_minutes: number; severity_level: string };

const WALK_KMH = 4.8;
const SCOOTER_KMH = 17;
const BIKE_KMH = 15;
const RIDE_KMH = 26;
const TRANSIT_KMH = 33;

function minutes(distM: number, kmh: number): number {
  return Math.max(1, Math.round((distM / 1000 / kmh) * 60));
}

function euro(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

const TRANSIT_LINES = [
  { code: "S1", kind: "S-Bahn", color: "--line-s1" },
  { code: "S2", kind: "S-Bahn", color: "--line-s2" },
  { code: "U6", kind: "Stadtbahn", color: "--line-u6" },
  { code: "U14", kind: "Stadtbahn", color: "--line-u14" },
  { code: "Bus 42", kind: "Bus", color: "--line-bus" },
];

export function buildOptions(originId: string, destId: string, tick = 0, stopIds: string[] = []): TripOption[] {
  const origin = placeById(originId);
  const dest = placeById(destId);
  if (!origin || !dest || origin.id === dest.id) return [];
  const stops = stopIds.map(placeById).filter((p): p is Place => !!p);
  const waypoints: LatLng[] = [origin, ...stops, dest];

  let straight = 0;
  for (let i = 1; i < waypoints.length; i++) straight += distanceM(waypoints[i - 1]!, waypoints[i]!);
  const options: TripOption[] = [];
  const key = `${origin.id}>${stops.map((s) => s.id).join(">")}${stops.length ? ">" : ""}${dest.id}`;

  /* --- Walking ------------------------------------------------------ */
  const walkDist = straight * 1.22;
  if (walkDist < 5200) {
    const dur = minutes(walkDist, WALK_KMH);
    options.push({
      id: `walk-${key}`,
      providerId: "walk",
      providerName: "Walking",
      mode: "walk",
      headline: "Walk the whole way",
      price: 0,
      priceLabel: "Free",
      durationMin: dur,
      departsInMin: 0,
      rating: 5,
      availability: "Always available",
      co2g: 0,
      segments: [
        {
          mode: "walk",
          providerId: "walk",
          label: `Walk to ${dest.name}`,
          detail: `${(walkDist / 1000).toFixed(1)} km on foot`,
          durationMin: dur,
          distanceM: Math.round(walkDist),
          via: [],
          path: polyline(origin, dest, `walk-${key}`, 0.5),
        },
      ],
      deepLink: { app: "/", web: "/" },
    });
  }

  /* --- Ride-hailing ------------------------------------------------- */
  for (const providerId of ["uber", "bolt", "freenow", "taxi"]) {
    const p = providerById(providerId);
    const dist = straight * 1.35;
    const surge = surgeFor(providerId, origin, tick);
    const ride = minutes(dist, RIDE_KMH);
    const wait = 1 + Math.round(rand(`${providerId}:${origin.id}:wait`) * 7 + Math.sin(tick / 11) + 1);
    const price = (p.baseFare + (dist / 1000) * p.perKm + ride * p.perMin) * surge;
    const pickupWalk = Math.round(rand(`${providerId}:${key}:pw`) * 120);
    options.push({
      id: `${providerId}-${key}`,
      providerId,
      providerName: p.name,
      mode: "ride",
      headline: `${p.name} · door to door`,
      price: Number(price.toFixed(2)),
      priceLabel: euro(price),
      durationMin: ride + wait,
      departsInMin: wait,
      rating: ratingFor(providerId, origin),
      availability: `${wait} min pickup${surge > 1.25 ? " · high demand" : ""}`,
      surge,
      co2g: Math.round((dist / 1000) * 118),
      segments: [
        {
          mode: "walk",
          providerId: "walk",
          label: "Walk to pickup point",
          detail: `${pickupWalk} m`,
          durationMin: 1,
          distanceM: pickupWalk,
          via: [],
          path: polyline(origin, lerp(origin, dest, 0.04), `pw-${providerId}-${key}`, 0.3),
        },
        {
          mode: "ride",
          providerId,
          label: `${p.name} to ${dest.name}`,
          detail: `${(dist / 1000).toFixed(1)} km${surge > 1.25 ? ` · ${surge.toFixed(1)}× surge` : ""}`,
          durationMin: ride,
          distanceM: Math.round(dist),
          via: [],
          path: polyline(origin, dest, `ride-${providerId}-${key}`, 1),
        },
      ],
      deepLink: deepLink(providerId, { ...origin }, { ...dest }),
    });
  }

  /* --- Micro-mobility ----------------------------------------------- */
  if (straight < 7000) {
    for (const providerId of [...SCOOTER_PROVIDERS, "nextbike"]) {
      const p = providerById(providerId);
      const kmh = p.mode === "bike" ? BIKE_KMH : SCOOTER_KMH;
      const dist = straight * 1.25;
      const walkToVehicle = 60 + Math.round(rand(`${providerId}:${origin.id}:wv`) * 380);
      const walkMin = minutes(walkToVehicle, WALK_KMH);
      const rideMin = minutes(dist, kmh);
      const price = p.baseFare + rideMin * p.perMin;
      const nearby = 2 + Math.round(rand(`${providerId}:${origin.id}:cnt`) * 12 + Math.sin(tick / 7 + hash(providerId) % 5) * 2);
      const battery = 45 + Math.round(rand(`${providerId}:${origin.id}:bat`) * 54);
      options.push({
        id: `${providerId}-${key}`,
        providerId,
        providerName: p.name,
        mode: p.mode,
        headline: `${p.name} · ${p.mode === "bike" ? "bike" : "scooter"} nearby`,
        price: Number(price.toFixed(2)),
        priceLabel: price === 0 ? "Free" : euro(price),
        durationMin: walkMin + rideMin,
        departsInMin: walkMin,
        rating: ratingFor(providerId, origin),
        availability: `${Math.max(1, nearby)} nearby · ${battery}% battery`,
        co2g: 0,
        segments: [
          {
            mode: "walk",
            providerId: "walk",
            label: "Walk to vehicle",
            detail: `${walkToVehicle} m`,
            durationMin: walkMin,
            distanceM: walkToVehicle,
            via: [],
          path: polyline(origin, lerp(origin, dest, 0.07), `mv-${providerId}-${key}`, 0.4),
          },
          {
            mode: p.mode,
            providerId,
            label: `Ride to ${dest.name}`,
            detail: `${(dist / 1000).toFixed(1)} km · ${p.unlockLabel ?? ""}`.trim(),
            durationMin: rideMin,
            distanceM: Math.round(dist),
            via: [],
          path: polyline(origin, dest, `sc-${providerId}-${key}`, 0.8),
          },
        ],
        deepLink: deepLink(providerId, { ...origin }, { ...dest }),
      });
    }
  }

  /* --- Public transit ------------------------------------------------ */
  const lineIdx = hash(key) % TRANSIT_LINES.length;
  for (let v = 0; v < 2; v++) {
    const line = TRANSIT_LINES[(lineIdx + v * 2) % TRANSIT_LINES.length]!;
    const hub = PLACES[hash(`${key}:${v}:hub`) % PLACES.length]!;
    const accessWalk = 180 + Math.round(rand(`${key}:${v}:aw`) * 500);
    const egressWalk = 150 + Math.round(rand(`${key}:${v}:ew`) * 500);
    const w1 = minutes(accessWalk, WALK_KMH);
    const w2 = minutes(egressWalk, WALK_KMH);
    const rideMin = minutes(straight * 1.15, TRANSIT_KMH) + (v === 1 ? 4 : 0);
    const departs = 1 + ((hash(`${key}:${v}:dep`) + Math.round(tick / 3)) % 11);
    const fare = straight > 9000 ? 4.4 : straight > 4500 ? 3.2 : 2.1;
    const stops = 3 + (hash(`${key}:${v}:stops`) % 7);
    const mid = lerp(origin, dest, 0.5);
    options.push({
      id: `vvs-${line.code.replace(/\s/g, "")}-${key}`,
      providerId: "vvs",
      providerName: `VVS ${line.code}`,
      mode: "transit",
      headline: `${line.kind} ${line.code}${v === 1 ? " + transfer" : ""}`,
      price: fare,
      priceLabel: euro(fare),
      durationMin: w1 + departs + rideMin + w2,
      departsInMin: departs,
      rating: ratingFor(`vvs-${line.code}`, origin),
      availability: `Departs in ${departs} min · every ${v === 1 ? 15 : 10} min`,
      co2g: Math.round((straight / 1000) * 29),
      segments: [
        {
          mode: "walk",
          providerId: "walk",
          label: `Walk to ${hub.name} stop`,
          detail: `${accessWalk} m`,
          durationMin: w1,
          distanceM: accessWalk,
          via: [],
          path: polyline(origin, lerp(origin, mid, 0.18), `tw1-${line.code}-${key}`, 0.4),
        },
        {
          mode: "transit",
          providerId: "vvs",
          label: `${line.kind} ${line.code}`,
          detail: `${stops} stops${v === 1 ? " · 1 transfer" : ""}`,
          durationMin: rideMin,
          distanceM: Math.round(straight * 1.15),
          via: [],
          path: polyline(lerp(origin, mid, 0.18), lerp(mid, dest, 0.82), `tr-${line.code}-${key}`, 0.6),
        },
        {
          mode: "walk",
          providerId: "walk",
          label: `Walk to ${dest.name}`,
          detail: `${egressWalk} m`,
          durationMin: w2,
          distanceM: egressWalk,
          via: [],
          path: polyline(lerp(mid, dest, 0.82), dest, `tw2-${line.code}-${key}`, 0.4),
        },
      ],
      deepLink: deepLink("vvs", { ...origin }, { ...dest }),
    });
  }

  /* --- Multi-modal combos: walk → scooter → train → walk ------------ */
  if (straight > 2500 && !stops.length) {
    const line = TRANSIT_LINES[lineIdx]!;
    for (const providerId of ["lime", "tier"]) {
      const p = providerById(providerId);
      const hubPt = lerp(origin, dest, 0.3);
      const exitPt = lerp(origin, dest, 0.9);
      const walk1 = 80 + Math.round(rand(`${providerId}:${key}:cw`) * 220);
      const scootDist = distanceM(origin, hubPt) * 1.2;
      const trainDist = distanceM(hubPt, exitPt) * 1.15;
      const walk2 = Math.round(distanceM(exitPt, dest) * 1.2);
      const w1 = minutes(walk1, WALK_KMH);
      const sc = minutes(scootDist, SCOOTER_KMH);
      const wait = 1 + ((hash(`${key}:${providerId}:cw`) + Math.round(tick / 3)) % 6);
      const tr = minutes(trainDist, TRANSIT_KMH);
      const w2 = minutes(walk2, WALK_KMH);
      const fare = (straight > 9000 ? 4.4 : straight > 4500 ? 3.2 : 2.1) + p.baseFare + sc * p.perMin;
      options.push({
        id: `combo-${providerId}-${line.code.replace(/\s/g, "")}-${key}`,
        providerId,
        providerName: `${p.name} + VVS ${line.code}`,
        mode: "transit",
        headline: `Scooter to the station, then ${line.kind} ${line.code}`,
        price: Number(fare.toFixed(2)),
        priceLabel: euro(fare),
        durationMin: w1 + sc + wait + tr + w2,
        departsInMin: w1,
        rating: ratingFor(providerId, origin),
        availability: `Walk ${walk1} m → ${p.name} ${(scootDist / 1000).toFixed(1)} km → ${line.code}`,
        co2g: Math.round((trainDist / 1000) * 29),
        lineCode: line.code,
        segments: [
          { mode: "walk", providerId: "walk", label: `Walk to ${p.name} scooter`, detail: `${walk1} m`, durationMin: w1, distanceM: walk1, via: [], path: polyline(origin, lerp(origin, hubPt, 0.08), `cw1-${providerId}-${key}`, 0.3) },
          { mode: "scooter", providerId, label: `${p.name} to the station`, detail: `${(scootDist / 1000).toFixed(1)} km · ${p.unlockLabel ?? ""}`, durationMin: sc, distanceM: Math.round(scootDist), via: [], path: polyline(lerp(origin, hubPt, 0.08), hubPt, `cs-${providerId}-${key}`, 0.5) },
          { mode: "transit", providerId: "vvs", label: `${line.kind} ${line.code}`, detail: `${3 + (hash(key) % 5)} stops · departs in ${wait} min`, durationMin: tr + wait, distanceM: Math.round(trainDist), via: [], path: polyline(hubPt, exitPt, `ct-${providerId}-${key}`, 0.6) },
          { mode: "walk", providerId: "walk", label: `Walk to ${dest.name}`, detail: `${walk2} m`, durationMin: w2, distanceM: walk2, via: [], path: polyline(exitPt, dest, `cw2-${providerId}-${key}`, 0.3) },
        ],
        deepLink: deepLink(providerId, { ...origin }, { ...dest }),
      });
    }
  }

  // Transfers = vehicle changes (+1 for options that include a line change).
  options.forEach((o) => {
    const vehicles = o.segments.filter((s) => s.mode !== "walk").length;
    o.transfers = Math.max(0, vehicles - 1) + (o.headline.includes("transfer") ? 1 : 0);
    if (!o.lineCode && o.providerId === "vvs") o.lineCode = o.providerName.replace(/^VVS\s*/, "");
  });

  // Attach routing waypoints: legs spanning the whole trip pass through every stop.
  const near = (a: LatLng, b: LatLng) => Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
  options.forEach((o) =>
    o.segments.forEach((s) => {
      const a = s.path[0]!;
      const b = s.path[s.path.length - 1]!;
      const whole = (near(a, origin) && near(b, dest)) || (s.mode === "transit" && !o.id.startsWith("combo-"));
      s.via = whole ? [a, ...stops, b] : [a, b];
    }),
  );
  return options;
}

/** Applies live delay alerts to transit options on affected lines. */
export function applyAlerts(options: TripOption[], alerts: ServiceAlert[]): TripOption[] {
  if (!alerts.length) return options;
  return options.map((o) => {
    const a = o.lineCode ? alerts.find((x) => x.affected_lines.includes(o.lineCode!)) : undefined;
    if (!a) return o;
    return {
      ...o,
      durationMin: o.durationMin + a.delay_minutes,
      departsInMin: o.departsInMin + a.delay_minutes,
      availability: `+${a.delay_minutes} min delay · ${o.availability}`,
      alert: { header: a.header_text, delayMin: a.delay_minutes, severity: a.severity_level },
    };
  });
}

/** Marks options on the Pareto frontier of time, cost, CO2 and transfers. */
export function markPareto(options: TripOption[]): TripOption[] {
  const v = (o: TripOption) => [o.durationMin, o.price ?? 99, o.co2g, o.transfers ?? 0];
  return options.map((o) => {
    const a = v(o);
    const dominated = options.some((q) => {
      if (q === o) return false;
      const b = v(q);
      return b.every((x, i) => x <= a[i]!) && b.some((x, i) => x < a[i]!);
    });
    return { ...o, pareto: !dominated };
  });
}

export type SortKey = "fastest" | "cheapest" | "rated" | "eco" | "transfers";

export function rankOptions(options: TripOption[], sort: SortKey): TripOption[] {
  const list = [...options];
  if (sort === "cheapest") list.sort((a, b) => (a.price ?? 99) - (b.price ?? 99) || a.durationMin - b.durationMin);
  else if (sort === "rated") list.sort((a, b) => b.rating - a.rating || a.durationMin - b.durationMin);
  else if (sort === "eco") list.sort((a, b) => a.co2g - b.co2g || a.durationMin - b.durationMin);
  else if (sort === "transfers") list.sort((a, b) => (a.transfers ?? 0) - (b.transfers ?? 0) || a.durationMin - b.durationMin);
  else list.sort((a, b) => a.durationMin - b.durationMin || (a.price ?? 99) - (b.price ?? 99));
  return list;
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min`;
}
