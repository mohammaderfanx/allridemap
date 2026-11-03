import { useEffect, useState } from "react";
import { buildOptions, type TripOption } from "./engine";
import { searchTrips } from "./backend.functions";

/** Last server snapshot per trip, shared by the list and the trip page so both show identical fares and times. */
const snapshots = new Map<string, TripOption[]>();

export function tripKeyFor(from: string, to: string | undefined, stopIds: string[]) {
  return to ? `${from}|${stopIds.join("|")}|${to}` : "";
}

/** Options for a trip: the shared 60 s server snapshot, or a local computation until it arrives. */
export function useTripOptions(
  from: string,
  to: string | undefined,
  stopIds: string[],
  tick: number,
): TripOption[] {
  const key = tripKeyFor(from, to, stopIds);
  const [, bump] = useState(0);
  useEffect(() => {
    if (!to) return;
    let alive = true;
    const load = () =>
      searchTrips({ data: { from, to, stops: stopIds } })
        .then((r) => {
          if (!alive || !r.options.length) return;
          snapshots.set(key, r.options);
          bump((n) => n + 1);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!to) return [];
  return snapshots.get(key) ?? buildOptions(from, to, tick, stopIds);
}
