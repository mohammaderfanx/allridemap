import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, ChevronRight, Info, MapPin, Moon, Plus, Search, Star, Sun, X } from "lucide-react";
import { useRef } from "react";
import { useRoadSegments } from "@/lib/mobility/routing";
import { searchPlaces, reversePlace } from "@/lib/mobility/geocode";
import { setDark, useIsDark } from "@/lib/theme";
import type { Place } from "@/lib/mobility/geo";
import { CityMap } from "@/components/map/CityMap";
import { ModeIcon, ProviderBadge } from "@/components/trip/ProviderBadge";
import { buildOptions, formatDuration, generateFleet, rankOptions, type SortKey, type TripOption } from "@/lib/mobility/engine";
import { searchTrips } from "@/lib/mobility/backend.functions";
import { PLACES, placeById, type LatLng } from "@/lib/mobility/geo";
import { MODE_LABEL, PROVIDERS, type Mode } from "@/lib/mobility/providers";
import { ALL_MODES, parseModes, parseStops, searchSchema, useTick } from "@/lib/mobility/search";

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "AllRide — Compare every ride in Stuttgart" },
      { name: "description", content: "Uber, Bolt, taxi, VVS transit and e-scooters compared side by side for any trip across Stuttgart." },
      { property: "og:title", content: "AllRide — Compare every ride in Stuttgart" },
      { property: "og:description", content: "Find the fastest, cheapest or best-rated way across Stuttgart in one search." },
    ],
  }),
  component: Home,
});

const SORTS: { key: SortKey; label: string }[] = [
  { key: "fastest", label: "Fastest" },
  { key: "cheapest", label: "Cheapest" },
  { key: "rated", label: "Best rated" },
];

function Home() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const tick = useTick();
  const [picking, setPicking] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

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
  // Shared 60s cached snapshot from the server; local computation shows instantly until it arrives.
  const [served, setServed] = useState<{ key: string; options: TripOption[] } | null>(null);
  const tripKey = dest ? `${from}|${search.stops ?? ""}|${dest.id}` : "";
  useEffect(() => {
    if (!dest) return;
    let alive = true;
    const load = () =>
      searchTrips({ data: { from, to: dest.id, stops: stopIds } })
        .then((r) => alive && r.options.length && setServed({ key: tripKey, options: r.options }))
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [tripKey]);
  const options = useMemo(() => {
    if (!dest) return [];
    const base = served?.key === tripKey ? served.options : buildOptions(from, dest.id, tick, stopIds);
    return rankOptions(base, sort).filter((o) => modes.includes(o.mode));
  }, [from, dest, tick, sort, modes.join(), search.stops, served, tripKey]);
  const active = options.find((o) => o.id === selected) ?? options[0];
  const road = useRoadSegments(active?.segments, alt);
  const otherAlts = road.alternatives.filter((_, i) => i !== Math.min(alt, road.alternatives.length - 1)).map((r) => r.path);
  const visibleProviders = PROVIDERS.filter((p) => modes.includes(p.mode)).map((p) => p.id);

  const set = (patch: Partial<typeof search>) => navigate({ search: (s) => ({ ...s, ...patch }), replace: true });

  const onPickPoint = (p: LatLng) => {
    if (!picking) return;
    const which = picking;
    setPicking(null);
    reversePlace(p.lat, p.lng).then((pl) => applyPlace(which, pl));
  };

  const setStops = (ids: string[]) => set({ stops: ids.length ? ids.join("|") : undefined, alt: undefined });
  const applyPlace = (which: string, pl: Place) => {
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
      />

      {/* Search card */}
      <div className="absolute left-3 right-16 top-3 z-10 md:right-auto md:w-[380px]">
        <div className="rounded-3xl border border-border/60 bg-frost p-3 shadow-lg backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-lg font-extrabold tracking-tight text-foreground">
              All<span className="text-primary">Ride</span>
            </span>
            <div className="flex items-center gap-3">
              <button onClick={() => setDark(!dark)} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} className="text-muted-foreground hover:text-foreground">
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Link to="/about" className="text-muted-foreground hover:text-foreground" aria-label="About">
                <Info className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1.5">
              <PlaceInput label="From" place={origin} placeholder="Start address" onSelect={(p) => set({ from: p.id })} onMap={() => setPicking("from")} picking={picking === "from"} />
              {stops.map((st, i) => (
                <div key={`${st.id}-${i}`} className="flex items-center gap-1">
                  <div className="flex-1">
                    <PlaceInput label={`${i + 1}`} place={st} placeholder="Add a stop" onSelect={(p) => applyPlace(`stop${i}`, p)} onMap={() => setPicking(`stop${i}`)} picking={picking === `stop${i}`} />
                  </div>
                  <button aria-label={`Remove stop ${i + 1}`} onClick={() => setStops(stopIds.filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <PlaceInput label="To" place={dest} placeholder="Where to?" onSelect={(p) => set({ to: p.id, alt: undefined })} onMap={() => setPicking("to")} picking={picking === "to"} />
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
              onClick={() => setStops([...stopIds, dest.id === "schlossplatz" ? "marienplatz" : "schlossplatz"].slice(0, 4))}
              className="mt-2 flex items-center gap-1 px-1 text-xs font-bold text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Add stop
            </button>
          )}
          {picking && (
            <p className="mt-2 px-1 text-xs font-medium text-primary">Tap the map to set your {picking === "from" ? "start" : picking === "to" ? "destination" : "stop"}</p>
          )}
        </div>
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
            if (dy < -25) setExpanded(true);
            else if (dy > 25) setExpanded(false);
            else setExpanded((v) => !v);
          }}
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
              <button onClick={clearTrip} aria-label="Close route and go back" className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-foreground hover:bg-accent">
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
                  modes.includes(m) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                }`}
              >
                <ModeIcon mode={m} className="h-3.5 w-3.5" />
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
          {dest && (
            <div className="mt-2 grid grid-cols-3 rounded-xl bg-muted p-1">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => set({ sort: s.key === "fastest" ? undefined : s.key })}
                  className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
                    sort === s.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

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
                    {r.durationS === fastestAlt ? " · Fastest" : r.distanceM === shortestAlt ? " · Shortest" : ""}
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
          {dest && !options.length && <p className="p-4 text-center text-sm text-muted-foreground">No options match these filters.</p>}
          {options.map((o) => {
            const isActive = active?.id === o.id;
            return (
              <div
                key={o.id}
                onClick={() => setSelected(o.id)}
                className={`cursor-pointer rounded-2xl border bg-card p-3 transition-all ${isActive ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-border"}`}
              >
                <div className="flex items-center gap-3">
                  <ProviderBadge providerId={o.providerId} mode={o.mode} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-foreground">{o.providerName}</span>
                      {o.durationMin === fastest && <Tag>Fastest</Tag>}
                      {(o.price ?? 99) === cheapest && <Tag>Cheapest</Tag>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{o.availability}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-foreground">{o.priceLabel}</div>
                    <div className="text-xs font-medium text-muted-foreground">{formatDuration(o.durationMin)}</div>
                  </div>
                </div>
                {isActive && (
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3.5 w-3.5 fill-current text-[color:var(--brand-taxi)]" /> {o.rating.toFixed(1)} in {origin?.district}
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
  return <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">{children}</span>;
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
  useEffect(() => setQ(place?.name ?? ""), [place?.id]);
  useEffect(() => {
    if (!focus) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => setResults(await searchPlaces(q === place?.name ? "" : q, ctl.signal)), 220);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, focus]);
  return (
    <div className="relative">
      <div className={`flex items-center gap-2 rounded-xl bg-muted px-3 py-2 ${picking || focus ? "ring-2 ring-primary" : ""}`}>
        <span className="w-8 text-[11px] font-bold uppercase text-muted-foreground">{label}</span>
        <input
          aria-label={label}
          value={q}
          placeholder={placeholder}
          onChange={(e) => setQ(e.target.value)}
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
        <button onClick={onMap} aria-label={`Pick ${label} on map`} className="text-muted-foreground hover:text-primary">
          <MapPin className="h-4 w-4" />
        </button>
      </div>
      {focus && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border border-border bg-popover shadow-lg">
          {results.map((r) => (
            <li key={r.id}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(r);
                  setQ(r.name);
                  (document.activeElement as HTMLElement | null)?.blur();
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
              >
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-popover-foreground">{r.name}</span>
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
