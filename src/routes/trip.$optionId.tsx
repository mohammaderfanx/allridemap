import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, Leaf, Star } from "lucide-react";
import { CityMap } from "@/components/map/CityMap";
import { ModeIcon, ProviderBadge } from "@/components/trip/ProviderBadge";
import { buildOptions, formatDuration } from "@/lib/mobility/engine";
import { placeById } from "@/lib/mobility/geo";
import { providerById } from "@/lib/mobility/providers";
import { searchSchema, useTick } from "@/lib/mobility/search";

export const Route = createFileRoute("/trip/$optionId")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Trip details — AllRide Stuttgart" },
      { name: "description", content: "Step-by-step breakdown of your Stuttgart trip with fare, ETA and provider rating." },
      { property: "og:title", content: "Trip details — AllRide Stuttgart" },
      { property: "og:description", content: "Every leg of your trip, then hand off to the provider app." },
    ],
  }),
  component: TripDetail,
});

function TripDetail() {
  const { optionId } = Route.useParams();
  const search = Route.useSearch();
  const tick = useTick();
  const from = search.from ?? "hbf";
  const option = useMemo(
    () => (search.to ? buildOptions(from, search.to, tick).find((o) => o.id === optionId) : undefined),
    [from, search.to, tick, optionId],
  );

  if (!option) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 font-sans">
        <p className="text-muted-foreground">This trip option is no longer available.</p>
        <Link to="/" search={search} className="font-bold text-primary">Back to search</Link>
      </main>
    );
  }

  const origin = placeById(from);
  const dest = placeById(search.to!);
  const openProvider = () => {
    if (option.providerId === "walk") return;
    const t = setTimeout(() => window.open(option.deepLink.web, "_blank"), 900);
    window.addEventListener("blur", () => clearTimeout(t), { once: true });
    window.location.href = option.deepLink.app;
  };

  return (
    <main className="relative flex h-dvh flex-col bg-background font-sans md:flex-row">
      <CityMap className="relative h-[40dvh] md:h-full md:flex-1" origin={origin} destination={dest} fleet={[]} activeSegments={option.segments} visibleProviders={[]} />
      <section className="-mt-6 flex flex-1 flex-col overflow-y-auto rounded-t-3xl bg-card p-5 shadow-sheet md:mt-0 md:w-[420px] md:flex-none md:rounded-none">
        <Link to="/" search={search} className="mb-4 flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All options
        </Link>
        <div className="flex items-center gap-3">
          <ProviderBadge providerId={option.providerId} mode={option.mode} size={52} />
          <div className="flex-1">
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">{option.providerName}</h1>
            <p className="text-sm text-muted-foreground">{origin?.name} → {dest?.name}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat label="Fare" value={option.priceLabel} />
          <Stat label="Arrive in" value={formatDuration(option.durationMin)} />
          <Stat label="Rating" value={<span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-current text-[color:var(--brand-taxi)]" />{option.rating.toFixed(1)}</span>} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {option.availability}
          {option.surge && option.surge > 1.05 ? ` · ${option.surge.toFixed(2)}× demand pricing` : ""}
        </p>

        <ol className="mt-6 space-y-0">
          {option.segments.map((s, i) => (
            <li key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full text-primary-foreground" style={{ background: `var(${providerById(s.providerId).colorVar})` }}>
                  <ModeIcon mode={s.mode} className="h-4 w-4" />
                </div>
                {i < option.segments.length - 1 && <div className={`my-1 w-0.5 flex-1 ${s.mode === "walk" ? "border-l-2 border-dotted border-muted-foreground/40" : "bg-border"}`} />}
              </div>
              <div className="flex-1 pb-5">
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-foreground">{s.label}</span>
                  <span className="text-sm font-medium text-muted-foreground">{s.durationMin} min</span>
                </div>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Leaf className="h-3.5 w-3.5" /> {option.co2g ? `~${option.co2g} g CO₂` : "Zero emissions"}
        </p>

        <div className="mt-auto pt-6">
          {option.providerId === "walk" ? (
            <p className="rounded-2xl bg-muted p-4 text-center text-sm font-semibold text-foreground">Enjoy the walk — no app needed.</p>
          ) : (
            <>
              <button onClick={openProvider} className="w-full rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-lg transition-transform active:scale-[0.98]">
                Continue with {option.providerName}
              </button>
              <a href={option.deepLink.web} target="_blank" rel="noreferrer" className="mt-2 block text-center text-xs font-semibold text-muted-foreground hover:text-foreground">
                Open in browser instead
              </a>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-muted p-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-extrabold text-foreground">{value}</div>
    </div>
  );
}
