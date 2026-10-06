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
- "Continue with" handoffs call `trackHandoff`, which logs a conversion and builds links from provider templates stored in the database; why: affiliate tags and links editable without code changes.
- Live transit delays come from the `gtfs_rt_service_alerts` table via `useServiceAlerts` and are applied client-side with `applyAlerts`; why: the source can be swapped for a real GTFS-RT feed without UI changes.
