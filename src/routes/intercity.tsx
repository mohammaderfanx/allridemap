import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  Bike,
  BusFront,
  CarTaxiFront,
  Footprints,
  Plane,
  ShieldCheck,
  Timer,
  TrainFront,
  TramFront,
  Scooter,
  Drone,
  Luggage,
  BatteryCharging,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  CITIES,
  MODE_NAME,
  formatLocalTime,
  planIntercity,
  zoneLabel,
  type Itinerary,
  type LegKind,
} from "@/lib/mobility/intercity";

export const Route = createFileRoute("/intercity")({
  validateSearch: z.object({
    city: z.string().optional().catch(undefined),
    trip: z.string().optional().catch(undefined),
  }),
  head: () => ({
    meta: [
      { title: "Intercity trips from Stuttgart — AllRide" },
      {
        name: "description",
        content:
          "Door-to-door trips from Stuttgart to Munich, Berlin, Paris, London and more by train, flight, coach or air taxi.",
      },
      { property: "og:title", content: "Intercity trips from Stuttgart — AllRide" },
      {
        property: "og:description",
        content: "Scooter, S-Bahn, ICE, flight or eVTOL — one timeline in each city's local time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Intercity,
});

const LEG_ICON: Record<LegKind, typeof TrainFront> = {
  high_speed_rail: TrainFront,
  aviation: Plane,
  evtol: Drone,
  intercity_bus: BusFront,
  walk: Footprints,
  scooter: Scooter,
  sbahn: TramFront,
  metro: TramFront,
  robotaxi: CarTaxiFront,
  checkin: ShieldCheck,
};
const MODE_ICON = { high_speed_rail: TrainFront, aviation: Plane, evtol: Drone, intercity_bus: BusFront };

const eur = (n: number) =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const dur = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};

function useReliability() {
  const [r, setR] = useState<Record<string, number>>({});
  useEffect(() => {
    supabase
      .from("intercity_corridor_routes")
      .select("corridor_code, realtime_reliability_score")
      .then(({ data }) => {
        if (data)
          setR(Object.fromEntries(data.map((d) => [d.corridor_code, Number(d.realtime_reliability_score)])));
      });
  }, []);
  return r;
}

function Intercity() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const city = search.city ?? "munich";
  const reliability = useReliability();
  // Planning time is client-only to avoid a server/client clock mismatch; refreshed each minute.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const trips = useMemo(
    () => (now ? planIntercity(city, now, reliability) : []),
    [city, now, reliability],
  );
  const chosen = trips.find((t) => t.id === search.trip) ?? trips[0];
  const set = (p: { city?: string | undefined; trip?: string | undefined }) =>
    navigate({ search: (s) => ({ ...s, ...p }), replace: true });
  const cityTz = CITIES.find((c) => c.id === city)?.tz ?? "Europe/Berlin";

  return (
    <main className="min-h-dvh bg-background font-sans">
      <div className="mx-auto grid max-w-6xl gap-4 p-4 md:grid-cols-[400px_1fr]">
        <section className="space-y-3">
          <Link to="/" className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to city map
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Stuttgart <span className="text-primary">→</span> anywhere
          </h1>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Destination city">
            {CITIES.map((c) => (
              <button
                key={c.id}
                role="radio"
                aria-checked={c.id === city}
                onClick={() => set({ city: c.id, trip: undefined })}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${c.id === city ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
              >
                {c.name}
              </button>
            ))}
          </div>
          {!now && <p className="text-sm text-muted-foreground">Loading departures…</p>}
          {now && !trips.length && (
            <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No departures in the next 24 hours.</p>
          )}
          <ul className="space-y-2">
            {trips.map((t) => (
              <li key={t.id}>
                <TripCard trip={t} active={t.id === chosen?.id} onClick={() => set({ trip: t.id })} cityTz={cityTz} />
              </li>
            ))}
          </ul>
        </section>
        <section>{chosen && <Timeline trip={chosen} />}</section>
      </div>
    </main>
  );
}

function TripCard({ trip, active, onClick, cityTz }: { trip: Itinerary; active: boolean; onClick: () => void; cityTz: string }) {
  const Icon = MODE_ICON[trip.mode];
  const main = trip.legs.find((l) => l.kind === trip.mode)!;
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`w-full rounded-2xl border bg-card p-3 text-left transition-all ${active ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-border"}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-foreground">{main.label}</div>
          <div className="text-xs text-muted-foreground">
            Leave {formatLocalTime(trip.departUtc, "Europe/Berlin")} · arrive{" "}
            {formatLocalTime(trip.arriveUtc, cityTz)} {zoneLabel(trip.arriveUtc, cityTz)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-foreground">{eur(trip.priceEur)}</div>
          <div className="text-xs text-muted-foreground">{dur(trip.arriveUtc - trip.departUtc)}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
        <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{MODE_NAME[trip.mode]}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{trip.bufferMin} min buffer</span>
        <span className={`rounded-full px-2 py-0.5 ${trip.connectionRisk > 0.12 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
          {Math.round((1 - trip.connectionRisk) * 100)}% connection safe
        </span>
      </div>
    </button>
  );
}

function Timeline({ trip }: { trip: Itinerary }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-sheet">
      <h2 className="text-lg font-extrabold text-foreground">Door-to-door · {dur(trip.arriveUtc - trip.departUtc)}</h2>
      <p className="text-xs text-muted-foreground">All times shown in each city's local time.</p>
      {trip.evtol && (
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-3 text-xs sm:grid-cols-4">
          <Info icon={Timer} label="Check-in" value={`${trip.evtol.checkinMin} min before`} />
          <Info icon={BatteryCharging} label="Charging" value={trip.evtol.chargingDelayMin ? `+${trip.evtol.chargingDelayMin} min` : "On time"} />
          <Info icon={Luggage} label="Luggage" value={`Max ${trip.evtol.luggageLimitKg} kg`} />
          <Info icon={Drone} label="Seats left" value={String(trip.evtol.seatsLeft)} />
        </div>
      )}
      {trip.airport && (
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-3 text-xs">
          <Info icon={ShieldCheck} label="Security queue now" value={`~${trip.airport.securityWaitMin} min`} />
          <Info icon={Timer} label="Gate closes" value={`${trip.airport.checkinCloseMin} min before`} />
        </div>
      )}
      <ol className="mt-5">
        {trip.legs.map((l, i) => {
          const Icon = LEG_ICON[l.kind] ?? Bike;
          const tzChange = l.fromTz !== l.toTz || (i > 0 && trip.legs[i - 1]!.toTz !== l.fromTz);
          return (
            <li key={i} className="flex gap-3">
              <div className="w-14 shrink-0 pt-1 text-right">
                <div className="text-sm font-bold tabular-nums text-foreground">{formatLocalTime(l.departUtc, l.fromTz)}</div>
                {tzChange && <div className="text-[10px] text-muted-foreground">{zoneLabel(l.departUtc, l.fromTz)}</div>}
              </div>
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                {i < trip.legs.length - 1 && <div className="my-1 w-0.5 flex-1 bg-border" />}
              </div>
              <div className="flex-1 pb-5">
                <div className="flex justify-between gap-2">
                  <span className="text-sm font-bold text-foreground">{l.label}</span>
                  {l.priceEur > 0 && <span className="text-sm text-muted-foreground">{eur(l.priceEur)}</span>}
                </div>
                <p className="text-xs text-muted-foreground">{l.detail}</p>
                {l.fromTz !== l.toTz && (
                  <p className="mt-1 text-xs font-semibold text-primary">
                    Arrives {formatLocalTime(l.arriveUtc, l.toTz)} {zoneLabel(l.arriveUtc, l.toTz)} local time
                  </p>
                )}
              </div>
            </li>
          );
        })}
        <li className="flex gap-3">
          <div className="w-14 shrink-0 text-right text-sm font-bold tabular-nums text-foreground">
            {formatLocalTime(trip.arriveUtc, trip.legs[trip.legs.length - 1]!.toTz)}
          </div>
          <div className="w-8" />
          <div className="text-sm font-bold text-foreground">Arrive · total {eur(trip.priceEur)}</div>
        </li>
      </ol>
      <p className="mt-2 text-[11px] text-muted-foreground">Schedules, prices and queues are demo data.</p>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Timer; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="font-bold text-foreground">{value}</div>
    </div>
  );
}
