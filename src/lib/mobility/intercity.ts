/**
 * Simulated intercity planner (Stuttgart → other cities).
 * All times are UTC epoch ms internally; the UI renders each stop in its own city's time zone.
 * Schedules are deterministic per day so server and client agree; swap CORRIDORS for NeTEx/SIRI/NDC feeds later.
 */

export type IntercityMode = "high_speed_rail" | "aviation" | "evtol" | "intercity_bus";
export type LegKind = IntercityMode | "walk" | "scooter" | "sbahn" | "metro" | "robotaxi" | "checkin";

export type Hub = {
  id: string;
  name: string;
  city: string;
  tz: string;
  kind: "station" | "airport" | "vertiport" | "bus";
};

export const HUBS: Record<string, Hub> = {
  "str-hbf": { id: "str-hbf", name: "Stuttgart Hbf", city: "stuttgart", tz: "Europe/Berlin", kind: "station" },
  "str-air": { id: "str-air", name: "Stuttgart Airport (STR)", city: "stuttgart", tz: "Europe/Berlin", kind: "airport" },
  "str-vtp": { id: "str-vtp", name: "Stuttgart Vertiport Neckarpark", city: "stuttgart", tz: "Europe/Berlin", kind: "vertiport" },
  "str-zob": { id: "str-zob", name: "Stuttgart ZOB Flughafen", city: "stuttgart", tz: "Europe/Berlin", kind: "bus" },
  "muc-hbf": { id: "muc-hbf", name: "München Hbf", city: "munich", tz: "Europe/Berlin", kind: "station" },
  "muc-air": { id: "muc-air", name: "Munich Airport (MUC)", city: "munich", tz: "Europe/Berlin", kind: "airport" },
  "muc-vtp": { id: "muc-vtp", name: "Munich Vertiport Ostbahnhof", city: "munich", tz: "Europe/Berlin", kind: "vertiport" },
  "fra-hbf": { id: "fra-hbf", name: "Frankfurt Hbf", city: "frankfurt", tz: "Europe/Berlin", kind: "station" },
  "ber-hbf": { id: "ber-hbf", name: "Berlin Hbf", city: "berlin", tz: "Europe/Berlin", kind: "station" },
  "ber-air": { id: "ber-air", name: "Berlin BER", city: "berlin", tz: "Europe/Berlin", kind: "airport" },
  "par-est": { id: "par-est", name: "Paris Gare de l'Est", city: "paris", tz: "Europe/Paris", kind: "station" },
  "zrh-hb": { id: "zrh-hb", name: "Zürich HB", city: "zurich", tz: "Europe/Zurich", kind: "station" },
  "lhr-air": { id: "lhr-air", name: "London Heathrow (LHR)", city: "london", tz: "Europe/London", kind: "airport" },
  "ist-air": { id: "ist-air", name: "Istanbul Airport (IST)", city: "istanbul", tz: "Europe/Istanbul", kind: "airport" },
};

export const CITIES: { id: string; name: string; tz: string }[] = [
  { id: "munich", name: "Munich", tz: "Europe/Berlin" },
  { id: "frankfurt", name: "Frankfurt", tz: "Europe/Berlin" },
  { id: "berlin", name: "Berlin", tz: "Europe/Berlin" },
  { id: "paris", name: "Paris", tz: "Europe/Paris" },
  { id: "zurich", name: "Zürich", tz: "Europe/Zurich" },
  { id: "london", name: "London", tz: "Europe/London" },
  { id: "istanbul", name: "Istanbul", tz: "Europe/Istanbul" },
];

export type Corridor = {
  id: string;
  from: string;
  to: string;
  mode: IntercityMode;
  provider: string;
  label: string;
  durationMin: number;
  everyMin: number;
  /** first departure, minutes after 00:00 UTC */
  firstUtcMin: number;
  lastUtcMin: number;
  priceEur: number;
  /** 0..1, share of departures on time */
  reliability: number;
};

export const CORRIDORS: Corridor[] = [
  { id: "ice-muc", from: "str-hbf", to: "muc-hbf", mode: "high_speed_rail", provider: "DB", label: "ICE", durationMin: 132, everyMin: 60, firstUtcMin: 4 * 60 + 12, lastUtcMin: 21 * 60, priceEur: 49.9, reliability: 0.71 },
  { id: "bus-muc", from: "str-zob", to: "muc-hbf", mode: "intercity_bus", provider: "FlixBus", label: "FlixBus", durationMin: 185, everyMin: 120, firstUtcMin: 5 * 60, lastUtcMin: 20 * 60, priceEur: 14.99, reliability: 0.82 },
  { id: "evtol-muc", from: "str-vtp", to: "muc-vtp", mode: "evtol", provider: "Volocopter", label: "VoloCity shuttle", durationMin: 58, everyMin: 90, firstUtcMin: 6 * 60, lastUtcMin: 18 * 60, priceEur: 189, reliability: 0.9 },
  { id: "ice-fra", from: "str-hbf", to: "fra-hbf", mode: "high_speed_rail", provider: "DB", label: "ICE", durationMin: 78, everyMin: 30, firstUtcMin: 4 * 60 + 5, lastUtcMin: 21 * 60, priceEur: 39.9, reliability: 0.68 },
  { id: "bus-fra", from: "str-zob", to: "fra-hbf", mode: "intercity_bus", provider: "FlixBus", label: "FlixBus", durationMin: 155, everyMin: 120, firstUtcMin: 5 * 60 + 30, lastUtcMin: 19 * 60, priceEur: 11.99, reliability: 0.8 },
  { id: "ice-ber", from: "str-hbf", to: "ber-hbf", mode: "high_speed_rail", provider: "DB", label: "ICE Sprinter", durationMin: 330, everyMin: 120, firstUtcMin: 4 * 60 + 20, lastUtcMin: 18 * 60, priceEur: 79.9, reliability: 0.64 },
  { id: "air-ber", from: "str-air", to: "ber-air", mode: "aviation", provider: "Eurowings", label: "EW 2061", durationMin: 70, everyMin: 180, firstUtcMin: 5 * 60, lastUtcMin: 19 * 60, priceEur: 89, reliability: 0.78 },
  { id: "tgv-par", from: "str-hbf", to: "par-est", mode: "high_speed_rail", provider: "SNCF", label: "TGV INOUI", durationMin: 190, everyMin: 180, firstUtcMin: 5 * 60 + 50, lastUtcMin: 18 * 60, priceEur: 69, reliability: 0.8 },
  { id: "ic-zrh", from: "str-hbf", to: "zrh-hb", mode: "high_speed_rail", provider: "SBB", label: "IC", durationMin: 175, everyMin: 120, firstUtcMin: 5 * 60 + 15, lastUtcMin: 18 * 60, priceEur: 44, reliability: 0.88 },
  { id: "air-lhr", from: "str-air", to: "lhr-air", mode: "aviation", provider: "British Airways", label: "BA 951", durationMin: 105, everyMin: 240, firstUtcMin: 5 * 60 + 40, lastUtcMin: 18 * 60, priceEur: 129, reliability: 0.74 },
  { id: "air-ist", from: "str-air", to: "ist-air", mode: "aviation", provider: "Turkish Airlines", label: "TK 1704", durationMin: 175, everyMin: 360, firstUtcMin: 6 * 60, lastUtcMin: 18 * 60, priceEur: 159, reliability: 0.76 },
];

export const MODE_NAME: Record<IntercityMode, string> = {
  high_speed_rail: "Train",
  aviation: "Flight",
  evtol: "Air taxi (eVTOL)",
  intercity_bus: "Coach",
};

export type ItinLeg = {
  kind: LegKind;
  label: string;
  detail: string;
  fromName: string;
  toName: string;
  /** UTC epoch ms */
  departUtc: number;
  arriveUtc: number;
  fromTz: string;
  toTz: string;
  priceEur: number;
};

export type Itinerary = {
  id: string;
  corridorId: string;
  mode: IntercityMode;
  provider: string;
  legs: ItinLeg[];
  departUtc: number;
  arriveUtc: number;
  priceEur: number;
  /** minutes of buffer at the main departure hub */
  bufferMin: number;
  /** probability (0..1) the main connection is made */
  connectionRisk: number;
  evtol?: { checkinMin: number; chargingDelayMin: number; luggageLimitKg: number; seatsLeft: number } | undefined;
  airport?: { securityWaitMin: number; checkinCloseMin: number } | undefined;
};

const MIN = 60_000;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Simulated live security queue at an airport, by local hour (peaks 6–8 and 16–18). */
export function securityWaitMin(hubId: string, utcMs: number): number {
  const hour = new Date(utcMs).getUTCHours() + 1;
  const peak = Math.exp(-((hour - 7) ** 2) / 2) + Math.exp(-((hour - 17) ** 2) / 3);
  return Math.round(8 + peak * 22 + (hash(hubId + hour) % 5));
}

/** Local first-mile from the city centre to each Stuttgart hub. */
const FIRST_MILE: Record<string, { kind: LegKind; label: string; detail: string; min: number; price: number }[]> = {
  "str-hbf": [{ kind: "scooter", label: "Lime to Hauptbahnhof", detail: "1,4 km · park at the north exit", min: 7, price: 2.68 }],
  "str-air": [
    { kind: "walk", label: "Walk to Stadtmitte", detail: "S-Bahn platform 1", min: 4, price: 0 },
    { kind: "sbahn", label: "S2 / S3 to Flughafen", detail: "VVS · every 15 min", min: 27, price: 4.2 },
  ],
  "str-vtp": [{ kind: "robotaxi", label: "Robotaxi to Neckarpark", detail: "Autonomous shuttle · 6 km", min: 14, price: 16.5 }],
  "str-zob": [{ kind: "sbahn", label: "S2 to Flughafen/Messe", detail: "VVS · ZOB next to the terminal", min: 29, price: 4.2 }],
};

/** Last mile at the destination. */
function lastMile(hub: Hub): { kind: LegKind; label: string; detail: string; min: number; price: number } {
  if (hub.kind === "airport") return { kind: "metro", label: "Rail link to city centre", detail: "Airport express", min: 35, price: 13 };
  if (hub.kind === "vertiport") return { kind: "robotaxi", label: "Robotaxi to final destination", detail: "Pre-booked, waits 10 min", min: 12, price: 14 };
  return { kind: "metro", label: "Metro to final destination", detail: "Local transit · 3 stops", min: 11, price: 3.5 };
}

/** Minimum buffer at the main hub, widened when the corridor runs late often (live reliability). */
function requiredBuffer(c: Corridor, hub: Hub, departUtc: number) {
  if (c.mode === "aviation") return securityWaitMin(hub.id, departUtc) + 30; // bag drop / gate closes 30 min before
  if (c.mode === "evtol") return 20; // check-in + weigh-in
  return Math.round(4 + (1 - c.reliability) * 20);
}

/** Next departures of each corridor to the city, after `afterUtc`. Bounded: max 3 departures per corridor, 24 h window. */
export function planIntercity(
  cityId: string,
  afterUtc: number,
  reliability: Record<string, number> = {},
): Itinerary[] {
  const out: Itinerary[] = [];
  const corridors = CORRIDORS.filter((c) => HUBS[c.to]?.city === cityId);
  for (const base of corridors) {
    const c = { ...base, reliability: reliability[base.id] ?? base.reliability };
    const fromHub = HUBS[c.from]!;
    const toHub = HUBS[c.to]!;
    const first = FIRST_MILE[c.from] ?? [];
    const firstMin = first.reduce((a, l) => a + l.min, 0);
    const day = new Date(afterUtc);
    day.setUTCHours(0, 0, 0, 0);
    let found = 0;
    for (let d = 0; d < 2 && found < 3; d++) {
      for (let m = c.firstUtcMin; m <= c.lastUtcMin && found < 3; m += c.everyMin) {
        const dep = day.getTime() + d * 1440 * MIN + m * MIN;
        const buffer = requiredBuffer(c, fromHub, dep);
        const leaveAt = dep - (buffer + firstMin) * MIN;
        if (leaveAt < afterUtc) continue;
        found++;
        const legs: ItinLeg[] = [];
        let t = leaveAt;
        for (const l of first) {
          legs.push({ kind: l.kind, label: l.label, detail: l.detail, fromName: legs.length ? "" : "Your location", toName: fromHub.name, departUtc: t, arriveUtc: t + l.min * MIN, fromTz: fromHub.tz, toTz: fromHub.tz, priceEur: l.price });
          t += l.min * MIN;
        }
        const evtol =
          c.mode === "evtol"
            ? { checkinMin: 15, chargingDelayMin: hash(c.id + dep) % 3 === 0 ? 6 : 0, luggageLimitKg: 15, seatsLeft: 1 + (hash(c.id + dep + "s") % 3) }
            : undefined;
        const airport =
          c.mode === "aviation" ? { securityWaitMin: securityWaitMin(fromHub.id, dep), checkinCloseMin: 30 } : undefined;
        legs.push({
          kind: "checkin",
          label: airport ? `Security & boarding · ~${airport.securityWaitMin} min queue` : evtol ? "Check-in & weigh-in" : "Transfer to platform",
          detail: airport ? "Gate closes 30 min before departure" : evtol ? `Max ${evtol.luggageLimitKg} kg luggage · battery check` : `Buffer for ${Math.round((1 - c.reliability) * 100)}% late-running risk`,
          fromName: fromHub.name, toName: fromHub.name, departUtc: t, arriveUtc: dep, fromTz: fromHub.tz, toTz: fromHub.tz, priceEur: 0,
        });
        const delay = evtol?.chargingDelayMin ?? 0;
        const arr = dep + (c.durationMin + delay) * MIN;
        legs.push({
          kind: c.mode, label: `${c.provider} ${c.label}`, detail: `${MODE_NAME[c.mode]} · ${Math.round(c.reliability * 100)}% on time${delay ? ` · +${delay} min charging` : ""}`,
          fromName: fromHub.name, toName: toHub.name, departUtc: dep + delay * MIN, arriveUtc: arr, fromTz: fromHub.tz, toTz: toHub.tz, priceEur: c.priceEur,
        });
        const lm = lastMile(toHub);
        legs.push({ kind: lm.kind, label: lm.label, detail: lm.detail, fromName: toHub.name, toName: "Destination", departUtc: arr, arriveUtc: arr + lm.min * MIN, fromTz: toHub.tz, toTz: toHub.tz, priceEur: lm.price });
        const price = legs.reduce((a, l) => a + l.priceEur, 0);
        out.push({
          id: `${c.id}-${dep}`,
          corridorId: c.id,
          mode: c.mode,
          provider: c.provider,
          legs,
          departUtc: leaveAt,
          arriveUtc: arr + lm.min * MIN,
          priceEur: Math.round(price * 100) / 100,
          bufferMin: buffer,
          connectionRisk: Math.min(0.5, (1 - c.reliability) * (c.mode === "aviation" ? 0.3 : 0.5)),
          evtol,
          airport,
        });
      }
    }
  }
  return out.sort((a, b) => a.arriveUtc - b.arriveUtc);
}

/** Renders a UTC instant in a given IANA time zone, e.g. "14:05". */
export function formatLocalTime(utcMs: number, tz: string): string {
  return new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(utcMs);
}

/** Short zone name for a UTC instant in a zone, e.g. "CET", "GMT", "GMT+3". */
export function zoneLabel(utcMs: number, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "short" }).formatToParts(utcMs);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
}
