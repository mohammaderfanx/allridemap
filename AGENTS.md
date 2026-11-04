<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Trip searches go through `searchTrips` (src/lib/mobility/backend.functions.ts), which caches option snapshots in Lovable Cloud for 60s; why: shared low-cost results with graceful local fallback.
- The trip list and trip page both read options via `useTripOptions` (src/lib/mobility/tripOptions.ts), sharing one server snapshot; why: fares and times must match between list and detail.
- Live transit delays come from the `gtfs_rt_service_alerts` table via `useServiceAlerts` and are applied client-side with `applyAlerts`; why: the source can be swapped for a real GTFS-RT feed without UI changes.
- "Continue with" opens a signed, single-use, 10-minute link (`createHandoff` → /api/public/handoff); provider postbacks hit /api/public/webhooks/affiliates/$provider signed with AFFILIATE_WEBHOOK_SECRET; why: affiliate tags never reach the browser and conversions cannot be forged.
- Demand forecasts come from `predictDemand` (src/lib/mobility/demand.ts) on H3 res-8 cells, h3-js loaded via dynamic import; why: a real model API keyed by H3 index can replace the simulated `predictCell` without UI changes.
- Intercity trips come from `planIntercity` (src/lib/mobility/intercity.ts): UTC epoch ms internally, rendered per city time zone with Intl; corridor reliability is read from `intercity_corridor_routes`; why: schedules can be swapped for NeTEx/SIRI/NDC feeds without UI changes.
