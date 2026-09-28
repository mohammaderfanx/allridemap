import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About AllRide — Stuttgart mobility compared" },
      { name: "description", content: "How AllRide compares ride-hailing, VVS transit and e-scooters across Stuttgart." },
      { property: "og:title", content: "About AllRide" },
      { property: "og:description", content: "One search for every way across Stuttgart." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16 font-sans">
      <Link to="/" className="text-sm font-semibold text-primary">← Back to map</Link>
      <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground">
        All<span className="text-primary">Ride</span>
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        One search for every way across Stuttgart — Uber, Bolt, FreeNow, taxis, VVS S-Bahn, Stadtbahn and buses, Lime, Tier, Voi, Dott and RegioRad bikes.
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Prices, pickup times and vehicle positions are currently realistic demo data. Tapping "Continue" opens the provider's own app to book.
      </p>
    </main>
  );
}
