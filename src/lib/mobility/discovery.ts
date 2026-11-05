import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { placeById, type Place } from "./geo";

/** Curated "Explore your city in 15 min" itineraries. */
export type DiscoveryRoute = {
  id: string;
  title: string;
  description: string;
  stops: Place[];
  durationMin: number;
  ecoScore: number;
};

/** Local fallback, mirrors the curated_discovery_routes seed rows. */
const LOCAL_ROUTES: DiscoveryRoute[] = [
  {
    id: "local-sunset",
    title: "Sunset e-scooter loop",
    description: "Killesberg heights down to the Feuersee — golden-hour views, then a coffee at the lake.",
    stops: ["killesberg", "feuersee", "schlossplatz"].map((id) => placeById(id)!),
    durationMin: 38,
    ecoScore: 9.2,
  },
  {
    id: "local-museum",
    title: "Museum mile by U-Bahn",
    description: "Schlossplatz to Bad Cannstatt: art at the Staatsgalerie, then Wilhelma park by the Neckar.",
    stops: ["schlossplatz", "hbf", "wilhelma"].map((id) => placeById(id)!),
    durationMin: 52,
    ecoScore: 8.7,
  },
  {
    id: "local-stairs",
    title: "Vineyard stairs hike",
    description: "Marienplatz up the Stafflen to Degerloch — Stuttgart's famous outdoor stairways with valley views.",
    stops: ["marienplatz", "heslach", "degerloch"].map((id) => placeById(id)!),
    durationMin: 45,
    ecoScore: 9.8,
  },
  {
    id: "local-neckar",
    title: "Neckar river ride",
    description: "Flat riverside cycle from Ostendplatz past the MHP Arena to Cannstatter Wasen.",
    stops: ["ostendplatz", "arena", "cannstatt"].map((id) => placeById(id)!),
    durationMin: 30,
    ecoScore: 9.5,
  },
];

export function useDiscoveryRoutes(): DiscoveryRoute[] {
  const [routes, setRoutes] = useState<DiscoveryRoute[]>(LOCAL_ROUTES);
  useEffect(() => {
    let alive = true;
    supabase
      .from("curated_discovery_routes")
      .select("id, title, description, route_geojson, estimated_duration_mins, eco_score")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!alive || error || !data?.length) return;
        const mapped = data.flatMap((r) => {
          const gj = r.route_geojson as { stops?: unknown } | null;
          const ids = Array.isArray(gj?.stops) ? gj.stops : [];
          const stops = ids
            .map((id) => (typeof id === "string" ? placeById(id) : undefined))
            .filter((p): p is Place => !!p);
          if (stops.length < 2) return [];
          return [
            {
              id: r.id,
              title: r.title,
              description: r.description,
              stops,
              durationMin: r.estimated_duration_mins,
              ecoScore: Number(r.eco_score),
            },
          ];
        });
        if (mapped.length) setRoutes(mapped);
      });
    return () => {
      alive = false;
    };
  }, []);
  return routes;
}
