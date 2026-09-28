import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronRight, Info, MapPin, Star } from "lucide-react";
import { CityMap } from "@/components/map/CityMap";
import { ProviderBadge } from "@/components/trip/ProviderBadge";
import { buildOptions, formatDuration, generateFleet, rankOptions, type SortKey } from "@/lib/mobility/engine";
import { PLACES, distanceM, placeById, type LatLng } from "@/lib/mobility/geo";
import { MODE_LABEL, PROVIDERS, type Mode } from "@/lib/mobility/providers";
import { ALL_MODES, parseModes, searchSchema, useTick } from "@/lib/mobility/search";

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
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const from = search.from ?? "hbf";
  const to = search.to;
  const sort = search.sort ?? "fastest";
  const modes = parseModes(search.modes);
  const origin = placeById(from);
  const dest = to ? placeById(to) : undefined;

  const fleet = useMemo(() => generateFleet(tick), [tick]);
  const options = useMemo(
    () => (dest ? rankOptions(buildOptions(from, dest.id, tick), sort).filter((o) => modes.includes(o.mode)) : []),
    [from, dest, tick, sort, modes.join()],
  );
  const active = options.find((o) => o.id === selected) ?? options[0];
  const visibleProviders = PROVIDERS.filter((p) => modes.includes(p.mode)).map((p) => p.id);

  const set = (patch: Partial<typeof search>) => navigate({ search: (s) => ({ ...s, ...patch }), replace: true });

  const onPickPoint = (p: LatLng) => {
    if (!picking) return;
    const nearest = [...PLACES].sort((a, b) => distanceM(a, p) - distanceM(b, p))[0]!;
    set({ [picking]: nearest.id });
    setPicking(null);
  };

  const toggleMode = (m: Mode) => {
    const next = modes.includes(m) ? modes.filter((x) => x !== m) : [...modes, m];
    set({ modes: next.length === ALL_MODES.length || !next.length ? undefined : next.join(",") });
  };

  const cheapest = options.length ? Math.min(...options.map((o) => o.price ?? 99)) : 0;
  const fastest = options.length ? Math.min(...options.map((o) => o.durationMin)) : 0;

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background font-sans">
      <CityMap
        className="absolute inset-0"
        origin={origin}
        destination={dest}
        fleet={fleet}
        activeSegments={active?.segments}
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
            <Link to="/about" className="text-muted-foreground hover:text-foreground" aria-label="About">
              <Info className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1.5">
              <PlaceSelect label="From" value={from} onChange={(v) => set({ from: v })} onMap={() => setPicking("from")} picking={picking === "from"} />
              <PlaceSelect label="To" value={to ?? ""} onChange={(v) => set({ to: v || undefined })} onMap={() => setPicking("to")} picking={picking === "to"} />
            </div>
            <button
              aria-label="Swap"
              onClick={() => to && set({ from: to, to: from })}
              className="rounded-full border border-border bg-card p-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
          </div>
          {picking && (
            <p className="mt-2 px-1 text-xs font-medium text-primary">Tap the map to set your {picking === "from" ? "start" : "destination"}</p>
          )}
        </div>
      </div>

      {/* Results sheet */}
      <section
        className={`absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-3xl border border-border/60 bg-frost shadow-sheet backdrop-blur-xl transition-[max-height] duration-300 md:inset-x-auto md:bottom-3 md:right-3 md:top-20 md:w-[400px] md:rounded-3xl ${
          expanded ? "max-h-[62dvh] md:max-h-none" : "max-h-[132px] md:max-h-none"
        }`}
      >
        <button onClick={() => setExpanded((e) => !e)} className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted-foreground/30 md:hidden" aria-label="Toggle results" />
        <div className="px-4 pb-2 pt-3">
          {dest ? (
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-bold text-foreground">{options.length} ways to {dest.name}</h2>
              <span className="text-xs text-muted-foreground">Live · updated {tick * 3}s</span>
            </div>
          ) : (
            <h2 className="text-base font-bold text-foreground">Where to?</h2>
          )}
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {ALL_MODES.map((m) => (
              <button
                key={m}
                onClick={() => toggleMode(m)}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  modes.includes(m) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                }`}
              >
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

        <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-4">
          {!dest &&
            PLACES.filter((p) => p.id !== from)
              .slice(0, 8)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => set({ to: p.id })}
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

function PlaceSelect({
  label,
  value,
  onChange,
  onMap,
  picking,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onMap: () => void;
  picking: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-xl bg-muted px-3 py-2 ${picking ? "ring-2 ring-primary" : ""}`}>
      <span className="w-8 text-[11px] font-bold uppercase text-muted-foreground">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none"
      >
        {!value && <option value="">Choose destination</option>}
        {PLACES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button onClick={onMap} aria-label={`Pick ${label} on map`} className="text-muted-foreground hover:text-primary">
        <MapPin className="h-4 w-4" />
      </button>
    </div>
  );
}
