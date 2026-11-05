import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronRight,
  Flame,
  Info,
  MapPin,
  Megaphone,
  Moon,
  Plus,
  Radio,
  Search,
  Sparkles,
  Star,
  Sun,
  ThumbsUp,
  TrainFront,
  Wind,
  X,
} from "lucide-react";
import { useRef } from "react";
import { useRoadSegments } from "@/lib/mobility/routing";
import { searchPlaces, reversePlace } from "@/lib/mobility/geocode";
import { setDark, useIsDark } from "@/lib/theme";
import type { Place } from "@/lib/mobility/geo";
import { CityMap } from "@/components/map/CityMap";
import { ModeIcon, ProviderBadge } from "@/components/trip/ProviderBadge";
import {
  applyAlerts,
  formatDuration,
  generateFleet,
  markPareto,
  rankOptions,
  type SortKey,
  type TripOption,
} from "@/lib/mobility/engine";
import { useServiceAlerts } from "@/lib/mobility/alerts";
import { TriangleAlert } from "lucide-react";
import { useTripOptions } from "@/lib/mobility/tripOptions";
import { DemandPanel } from "@/components/trip/DemandPanel";
import { useDemandForecast, type Horizon } from "@/lib/mobility/demand";
import { PLACES, placeById, type LatLng } from "@/lib/mobility/geo";
import { MODE_LABEL, PROVIDERS, type Mode } from "@/lib/mobility/providers";
import { ALL_MODES, parseModes, parseStops, searchSchema, useTick } from "@/lib/mobility/search";
import {
  pulseFeed,
  REPORT_META,
  useGamification,
  usePulseReports,
  type ReportType,
} from "@/lib/mobility/pulse";
import { hapticDoublePulse, hapticThud, hapticTick } from "@/lib/mobility/haptics";
import { useDiscoveryRoutes } from "@/lib/mobility/discovery";

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "AllRide — Compare every ride in Stuttgart" },
      {
        name: "description",
        content:
          "Uber, Bolt, taxi, VVS transit and e-scooters compared side by side for any trip across Stuttgart.",
      },
      { property: "og:title", content: "AllRide — Compare every ride in Stuttgart" },
      {
        property: "og:description",
        content: "Find the fastest, cheapest or best-rated way across Stuttgart in one search.",
      },
    ],
  }),
  component: Home,
});

const SORTS: { key: SortKey; label: string }[] = [
  { key: "fastest", label: "Fastest" },
  { key: "cheapest", label: "Cheapest" },
  { key: "eco", label: "Greenest" },
  { key: "transfers", label: "Fewest changes" },
  { key: "rated", label: "Best rated" },
];

function Home() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const tick = useTick();
  const [picking, setPicking] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [pulseOn, setPulseOn] = useState(true);
  const [reportMode, setReportMode] = useState(false);
  const [reportDraft, setReportDraft] = useState<LatLng | null>(null);
  const pulseReports = usePulseReports();
  const gam = useGamification();
  const discoveryRoutes = useDiscoveryRoutes();

  const from = search.from ?? "hbf";
  const to = search.to;
  const sort = search.sort ?? "fastest";
  const modes = parseModes(search.modes);
  const origin = placeById(from);
  const dest = to ? placeById(to) : undefined;
  const stopIds = parseStops(search.stops);
  const stops = stopIds.map(placeById).filter((p): p is Place => !!p);
  const alt = search.alt ?? 0;

  const fleet = useMemo(() => generateFleet(tick), [tick]);
  // Shared 60s cached snapshot from the server (same source as the trip page).
  const base = useTripOptions(from, dest?.id, stopIds, tick);
  const alerts = useServiceAlerts();
  const options = useMemo(
    () => rankOptions(markPareto(applyAlerts(base, alerts)), sort).filter((o) => modes.includes(o.mode)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, sort, modes.join(), alerts],
  );
  const active = options.find((o) => o.id === selected) ?? options[0];
  // Most relevant delay: the delayed option that would otherwise rank best, and the fastest undelayed replacement.
  const delayed = [...options]
    .filter((o) => o.alert)
    .sort((a, b) => a.durationMin - a.alert!.delayMin - (b.durationMin - b.alert!.delayMin))[0];
  const reroute = delayed
    ? [...options]
        .filter((o) => !o.alert && o.mode !== "walk")
        .sort((a, b) => a.durationMin - b.durationMin)[0]
    : undefined;
  const road = useRoadSegments(active?.segments, alt);
  const otherAlts = road.alternatives
    .filter((_, i) => i !== Math.min(alt, road.alternatives.length - 1))
    .map((r) => r.path);
  const visibleProviders = PROVIDERS.filter((p) => modes.includes(p.mode)).map((p) => p.id);

  const set = (patch: Partial<typeof search>) =>
    navigate({ search: (s) => ({ ...s, ...patch }), replace: true });

  // Latest-wins: a slow map lookup must not overwrite a place chosen afterwards.
  const pickSeq = useRef(0);
  const onPickPoint = (p: LatLng) => {
    if (reportMode) {
      setReportMode(false);
      setReportDraft(p);
      hapticTick();
      return;
    }
    if (!picking) return;
    const which = picking;
    setPicking(null);
    const seq = ++pickSeq.current;
    reversePlace(p.lat, p.lng)
      .then((pl) => seq === pickSeq.current && applyPlace(which, pl))
      .catch(() => {});
  };

  const setStops = (ids: string[]) =>
    set({ stops: ids.length ? ids.join("|") : undefined, alt: undefined });
  const applyPlace = (which: string, pl: Place) => {
    pickSeq.current++;
    if (which === "from") set({ from: pl.id, alt: undefined });
    else if (which === "to") set({ to: pl.id, alt: undefined });
    else {
      const i = Number(which.slice(4));
      setStops(stopIds.map((s, j) => (j === i ? pl.id : s)));
    }
  };
  const clearTrip = () => {
    setSelected(null);
    setPicking(null);
    set({ to: undefined, stops: undefined, alt: undefined });
  };
  const dragY = useRef<number | null>(null);

  const toggleMode = (m: Mode) => {
    const next = modes.includes(m) ? modes.filter((x) => x !== m) : [...modes, m];
    set({ modes: next.length === ALL_MODES.length || !next.length ? undefined : next.join(",") });
  };

  const dark = useIsDark();
  const [heatOn, setHeatOn] = useState(false);
  const [horizon, setHorizon] = useState<Horizon>(30);
  const heatCells = useDemandForecast(heatOn, horizon);
  const cheapest = options.length ? Math.min(...options.map((o) => o.price ?? 99)) : 0;
  const fastest = options.length ? Math.min(...options.map((o) => o.durationMin)) : 0;

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background font-sans">
      <CityMap
        className="absolute inset-0"
        origin={origin}
        destination={dest}
        fleet={fleet}
        stops={stops}
        activeSegments={road.ready ? road.segments : undefined}
        alternatives={road.ready ? otherAlts : []}
        visibleProviders={visibleProviders}
        onPickPoint={onPickPoint}
        heatmap={heatOn ? heatCells : undefined}
        reports={pulseOn ? pulseReports : []}
        cinematic={!!dest}
      />

      {/* Search card */}
      <div className="absolute left-3 right-16 top-3 z-10 md:right-auto md:w-[380px]">
        <div className="rounded-3xl border border-border/60 bg-frost p-3 shadow-lg backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-lg font-extrabold tracking-tight text-foreground">
              All<span className="text-primary">Ride</span>
            </span>
            <div className="flex items-center gap-3">
              <span
                className="hidden items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary sm:flex"
                title={`${gam.xp} XP · ${gam.badges.length} badges`}
              >
                <Sparkles className="h-3 w-3" />
                {gam.tier} · {gam.xp}
              </span>
              <button
                onClick={() => {
                  hapticTick();
                  setReportMode((v) => !v);
                  setReportDraft(null);
                }}
                aria-label="Drop a community report on the map"
                aria-pressed={reportMode}
                className={reportMode ? "text-primary" : "text-muted-foreground hover:text-foreground"}
              >
                <Megaphone className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPulseOn(!pulseOn)}
                aria-label={pulseOn ? "Hide community pulse" : "Show community pulse"}
                aria-pressed={pulseOn}
                className={pulseOn ? "text-primary" : "text-muted-foreground hover:text-foreground"}
              >
                <Radio className="h-4 w-4" />
              </button>
              <button
                onClick={() => setHeatOn(!heatOn)}
                aria-label={heatOn ? "Hide demand forecast" : "Show demand forecast"}
                aria-pressed={heatOn}
                className={heatOn ? "text-primary" : "text-muted-foreground hover:text-foreground"}
              >
                <Flame className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDark(!dark)}
                aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                className="text-muted-foreground hover:text-foreground"
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Link
                to="/intercity"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Intercity trips"
              >
                <TrainFront className="h-4 w-4" />
              </Link>
              <Link
                to="/about"
                className="text-muted-foreground hover:text-foreground"
                aria-label="About"
              >
                <Info className="h-4 w-4" />
              </Link>
            </div>
          </div>
          {heatOn && <DemandPanel horizon={horizon} setHorizon={setHorizon} cells={heatCells} />}
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1.5">
              <PlaceInput
                label="From"
                place={origin}
                placeholder="Start address"
                onSelect={(p) => applyPlace("from", p)}
                onMap={() => setPicking("from")}
                picking={picking === "from"}
              />
              {stops.map((st, i) => (
                <div key={`${st.id}-${i}`} className="flex items-center gap-1">
                  <div className="flex-1">
                    <PlaceInput
                      label={`${i + 1}`}
                      place={st}
                      placeholder="Add a stop"
                      onSelect={(p) => applyPlace(`stop${i}`, p)}
                      onMap={() => setPicking(`stop${i}`)}
                      picking={picking === `stop${i}`}
                    />
                  </div>
                  <button
                    aria-label={`Remove stop ${i + 1}`}
                    onClick={() => setStops(stopIds.filter((_, j) => j !== i))}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <PlaceInput
                label="To"
                place={dest}
                placeholder="Where to?"
                onSelect={(p) => applyPlace("to", p)}
                onMap={() => setPicking("to")}
                picking={picking === "to"}
              />
            </div>
            <button
              aria-label="Swap"
              onClick={() => to && set({ from: to, to: from })}
              className="rounded-full border border-border bg-card p-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
          </div>
          {dest && stops.length < 4 && (
            <button
              onClick={() =>
                setStops(
                  [...stopIds, dest.id === "schlossplatz" ? "marienplatz" : "schlossplatz"].slice(
                    0,
                    4,
                  ),
                )
              }
              className="mt-2 flex items-center gap-1 px-1 text-xs font-bold text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Add stop
            </button>
          )}
          {picking && (
            <p className="mt-2 px-1 text-xs font-medium text-primary">
              Tap the map to set your{" "}
              {picking === "from" ? "start" : picking === "to" ? "destination" : "stop"}
            </p>
          )}
          {reportMode && (
            <p className="mt-2 px-1 text-xs font-medium text-primary">
              Tap the map where you want to drop your report
            </p>
          )}
        </div>
      </div>

      {/* Report type picker after a map tap */}
      {reportDraft && (
        <div className="absolute left-1/2 top-1/2 z-20 w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border/60 bg-frost p-3 shadow-lg backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">What's happening here?</h3>
            <button
              onClick={() => setReportDraft(null)}
              aria-label="Cancel report"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(REPORT_META) as ReportType[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  pulseFeed.addReport(t, reportDraft.lat, reportDraft.lng);
                  hapticDoublePulse();
                  setReportDraft(null);
                }}
                className="flex items-center gap-2 rounded-xl bg-card px-2.5 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-accent"
              >
                <span aria-hidden>{REPORT_META[t].emoji}</span>
                {REPORT_META[t].label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            +10 XP · visible for 15 minutes
          </p>
        </div>
      )}

      {/* Live micro-widgets */}
      <div className="absolute left-3 top-3 z-[5] mt-[188px] flex flex-col gap-1.5 md:left-auto md:right-3 md:top-20 md:mt-0">
        <span className="flex items-center gap-1.5 self-start rounded-full border border-border/60 bg-frost px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-xl">
          <Wind className="h-3 w-3 text-primary" /> AQI 38 · Good
        </span>
        <span className="flex items-center gap-1.5 self-start rounded-full border border-border/60 bg-frost px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-xl">
          🛴 {fleet.filter((v) => v.mode === "scooter").length} scooters nearby
        </span>
        {pulseOn && pulseReports.length > 0 && (
          <span className="flex items-center gap-1.5 self-start rounded-full border border-border/60 bg-frost px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-xl">
            <Radio className="h-3 w-3 text-primary" /> {pulseReports.length} live reports
          </span>
        )}
      </div>

      {/* Results sheet */}
      <section
        className={`absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-3xl border border-border/60 bg-frost shadow-sheet backdrop-blur-xl transition-[max-height] duration-300 md:inset-x-auto md:bottom-3 md:right-3 md:top-20 md:w-[400px] md:rounded-3xl ${
          expanded ? "max-h-[62dvh] md:max-h-none" : "max-h-[96px] md:max-h-none"
        }`}
      >
        <button
          onPointerDown={(e) => {
            dragY.current = e.clientY;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            const start = dragY.current;
            dragY.current = null;
            if (start === null) return;
            const dy = e.clientY - start;
            hapticTick();
            if (dy < -25) setExpanded(true);
            else if (dy > 25) setExpanded(false);
            else setExpanded((v) => !v);
          }}
          onClick={(e) => {
            // Keyboard / screen reader activation (pointer taps are handled above).
            if (e.detail === 0) setExpanded((v) => !v);
          }}
          aria-expanded={expanded}
          className="flex w-full shrink-0 touch-none justify-center pb-1 pt-3 md:hidden"
          aria-label={expanded ? "Collapse results" : "Expand results"}
        >
          <span className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
        </button>
        <div className="px-4 pb-2 pt-3">
          {dest ? (
            <div className="flex items-baseline justify-between">
              <h2 className="min-w-0 truncate text-base font-bold text-foreground">
                {options.length} ways to {dest.name}
                {stops.length ? ` · ${stops.length} stop${stops.length > 1 ? "s" : ""}` : ""}
              </h2>
              <button
                onClick={clearTrip}
                aria-label="Close route and go back"
                className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-foreground hover:bg-accent"
              >
                <X className="h-3.5 w-3.5" /> Close
              </button>
            </div>
          ) : (
            <h2 className="text-base font-bold text-foreground">Where to?</h2>
          )}
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {ALL_MODES.map((m) => (
              <button
                key={m}
                onClick={() => toggleMode(m)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  modes.includes(m)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                <ModeIcon mode={m} className="h-3.5 w-3.5" />
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
          {dest && (
            <div className="mt-2 grid grid-cols-5 rounded-xl bg-muted p-1">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => set({ sort: s.key === "fastest" ? undefined : s.key })}
                  className={`rounded-lg px-0.5 py-1.5 text-[11px] font-semibold leading-tight transition-all ${
                    sort === s.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {dest && delayed && (
          <div className="mx-3 mb-2 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-2.5">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1 text-xs">
              <div className="font-bold text-foreground">{delayed.alert!.header}</div>
              {reroute && (
                <div className="text-muted-foreground">
                  Rerouting: {reroute.providerName} gets you there in{" "}
                  {formatDuration(reroute.durationMin)}.
                </div>
              )}
            </div>
            {reroute && active?.id !== reroute.id && (
              <button
                onClick={() => setSelected(reroute.id)}
                className="shrink-0 rounded-full bg-card px-2.5 py-1 text-xs font-bold text-primary"
              >
                Switch
              </button>
            )}
          </div>
        )}
        {dest && road.alternatives.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-3 pb-2">
            {road.alternatives.map((r, i) => {
              const fastestAlt = Math.min(...road.alternatives.map((x) => x.durationS));
              const shortestAlt = Math.min(...road.alternatives.map((x) => x.distanceM));
              const on = Math.min(alt, road.alternatives.length - 1) === i;
              return (
                <button
                  key={i}
                  onClick={() => set({ alt: i || undefined })}
                  className={`shrink-0 rounded-2xl border px-3 py-2 text-left transition-colors ${on ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent"}`}
                >
                  <div className="text-xs font-bold text-foreground">
                    Route {i + 1}
                    {r.durationS === fastestAlt
                      ? " · Fastest"
                      : r.distanceM === shortestAlt
                        ? " · Shortest"
                        : ""}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {Math.round(r.durationS / 60)} min · {(r.distanceM / 1000).toFixed(1)} km
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-4">
          {!dest && (
            <>
              <h3 className="flex items-center gap-1.5 px-1 pt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Explore Stuttgart in 15 min
              </h3>
              {discoveryRoutes.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    hapticThud();
                    const mids = r.stops.slice(1, -1).map((p) => p.id);
                    set({
                      from: r.stops[0]!.id,
                      to: r.stops[r.stops.length - 1]!.id,
                      stops: mids.length ? mids.join("|") : undefined,
                      alt: undefined,
                    });
                  }}
                  className="w-full rounded-2xl border border-border/60 bg-card p-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-foreground">{r.title}</span>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {r.durationMin} min · eco {r.ecoScore.toFixed(1)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                    {r.stops.map((p) => p.name).join(" → ")}
                  </p>
                </button>
              ))}
              {pulseOn && pulseReports.length > 0 && (
                <>
                  <h3 className="flex items-center gap-1.5 px-1 pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <Radio className="h-3.5 w-3.5 text-primary" /> AllRide Pulse
                  </h3>
                  {pulseReports.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2.5 rounded-2xl bg-card p-2.5"
                    >
                      <span className="text-lg" aria-hidden>
                        {REPORT_META[r.type].emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-foreground">
                          {REPORT_META[r.type].label}
                          {r.mine && <span className="ml-1 text-primary">· yours</span>}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          fades in {Math.max(1, Math.round((r.expiresAt - Date.now()) / 60000))} min
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (pulseFeed.upvote(r.id)) hapticDoublePulse();
                        }}
                        disabled={pulseFeed.hasVoted(r.id)}
                        aria-label={`Confirm report: ${REPORT_META[r.type].label}`}
                        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                          pulseFeed.hasVoted(r.id)
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-foreground hover:bg-accent"
                        }`}
                      >
                        <ThumbsUp className="h-3 w-3" /> {r.upvotes}
                      </button>
                    </div>
                  ))}
                </>
              )}
              <h3 className="px-1 pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Popular places
              </h3>
            </>
          )}
          {!dest &&
            PLACES.filter((p) => p.id !== from)
              .slice(0, 8)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => set({ to: p.id, alt: undefined })}
                  className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left transition-colors hover:bg-accent"
                >
                  <MapPin className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.district}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
          {dest && !options.length && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No options match these filters.
            </p>
          )}
          {options.map((o) => {
            const isActive = active?.id === o.id;
            return (
              <div
                key={o.id}
                onClick={() => {
                  if (active?.id !== o.id) hapticThud();
                  setSelected(o.id);
                }}
                className={`cursor-pointer rounded-2xl border bg-card p-3 transition-all ${isActive ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-border"}`}
              >
                <div className="flex items-center gap-3">
                  <ProviderBadge providerId={o.providerId} mode={o.mode} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-foreground">
                        {o.providerName}
                      </span>
                      {o.durationMin === fastest && <Tag>Fastest</Tag>}
                      {(o.price ?? 99) === cheapest && <Tag>Cheapest</Tag>}
                      {o.pareto && o.durationMin !== fastest && (o.price ?? 99) !== cheapest && (
                        <Tag>Best trade-off</Tag>
                      )}
                      {o.alert && (
                        <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                          +{o.alert.delayMin} min
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{o.availability}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-foreground">{o.priceLabel}</div>
                    <div className="text-xs font-medium text-muted-foreground">
                      {formatDuration(o.durationMin)}
                    </div>
                  </div>
                </div>
                {isActive && (
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3.5 w-3.5 fill-current text-[color:var(--brand-taxi)]" />{" "}
                      {o.rating.toFixed(1)} in {origin?.district}
                    </span>
                    <Link
                      to="/trip/$optionId"
                      params={{ optionId: o.id }}
                      search={search}
                      className="flex items-center gap-1 text-xs font-bold text-primary"
                    >
                      Details <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
      {children}
    </span>
  );
}

function PlaceInput({
  label,
  place,
  placeholder,
  onSelect,
  onMap,
  picking,
}: {
  label: string;
  place: Place | undefined;
  placeholder: string;
  onSelect: (p: Place) => void;
  onMap: () => void;
  picking: boolean;
}) {
  const [q, setQ] = useState(place?.name ?? "");
  const [focus, setFocus] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [hi, setHi] = useState(-1);
  const listId = `place-list-${label}`;
  const choose = (r: Place) => {
    onSelect(r);
    setQ(r.name);
    (document.activeElement as HTMLElement | null)?.blur();
  };
  useEffect(() => setQ(place?.name ?? ""), [place?.id]);
  useEffect(() => {
    if (!focus) return;
    const ctl = new AbortController();
    const t = setTimeout(
      async () => setResults(await searchPlaces(q === place?.name ? "" : q, ctl.signal)),
      220,
    );
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, focus]);
  return (
    <div className="relative">
      <div
        className={`flex items-center gap-2 rounded-xl bg-muted px-3 py-2 ${picking || focus ? "ring-2 ring-primary" : ""}`}
      >
        <span className="w-8 text-[11px] font-bold uppercase text-muted-foreground">{label}</span>
        <input
          aria-label={label}
          value={q}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={focus && results.length > 0}
          aria-controls={listId}
          aria-activedescendant={hi >= 0 ? `${listId}-${hi}` : undefined}
          onChange={(e) => {
            setQ(e.target.value);
            setHi(-1);
          }}
          onKeyDown={(e) => {
            if (!results.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((h) => (h + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => (h <= 0 ? results.length - 1 : h - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const r = results[hi >= 0 ? hi : 0];
              if (r) choose(r);
            } else if (e.key === "Escape") {
              (e.target as HTMLElement).blur();
            }
          }}
          onFocus={(e) => {
            setFocus(true);
            e.target.select();
          }}
          onBlur={() => {
            setFocus(false);
            setQ(place?.name ?? "");
          }}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={onMap}
          aria-label={`Pick ${label} on map`}
          className="text-muted-foreground hover:text-primary"
        >
          <MapPin className="h-4 w-4" />
        </button>
      </div>
      {focus && results.length > 0 && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border border-border bg-popover shadow-lg">
          {results.map((r, i) => (
            <li key={r.id} id={`${listId}-${i}`} role="option" aria-selected={i === hi}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(r);
                }}
                tabIndex={-1}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent ${i === hi ? "bg-accent" : ""}`}
              >
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-popover-foreground">
                    {r.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{r.district}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
