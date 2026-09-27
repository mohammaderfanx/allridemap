# OmniTransit — Stuttgart trip search (v1)

A mobile-first web app that finds the best way across Stuttgart by comparing ride-hailing, public transit, and e-scooters side by side. Everything runs on realistic built-in demo data, so the whole flow works immediately with no provider accounts.

## What the user can do

1. **Home / map** — Stuttgart map with scooters and bikes grouped into provider clusters that split apart as you zoom, plus live price/ETA pill badges.
2. **Search a trip** — pick start and destination from Stuttgart places (Hauptbahnhof, Schlossplatz, Bad Cannstatt, Vaihingen, Flughafen, Killesberg, Marienplatz…) or tap the map.
3. **Compare options** — a bottom sheet lists every option ranked by Fastest, Cheapest, or Best rated: Uber, Bolt, FreeNow, taxi, S-Bahn/U-Bahn/bus, Lime/Tier/Voi/Dott scooters, plus walk-only.
4. **Option detail** — segment-by-segment breakdown (walk → ride → walk) with fare, ETA, provider rating for that area, and live availability.
5. **Hand off to the provider** — a "Continue with …" button that deep-links to the provider app with pickup/dropoff, with a web fallback.
6. **Filters** — toggle transport modes and providers; sort control persists in the URL so a search is shareable.

## Design direction

Apple-clean typographic base with Wolt-style vibrant accents:
- Frosted translucent sheets over the map, generous negative space, strong type hierarchy.
- Spring-physics bottom sheet with snap points (peek / half / full), dragged on mobile and docked as a right-hand pane on desktop.
- Provider-branded colors on markers and route lines; walk segments dotted grey, scooter solid vibrant, transit thick branded lines.

## Map approach

The map is a custom high-performance vector canvas rendering a stylized Stuttgart basemap (rivers, parks, the Kessel road grid, districts) in Apple-Maps-like colors, with pan/zoom, clustering, badges, and animated multi-modal route overlays. This keeps the app self-contained and free of map-provider accounts. If you later want real street tiles, Mapbox can be connected and swapped in behind the same layer.

## Technical notes

- TanStack Start routes: `/` (map + search + results sheet), `/trip/$optionId` (option detail), `/about`.
- Search state (origin, destination, sort, mode filters) lives in URL search params via `validateSearch`.
- A demo data engine in `src/lib/mobility/` generates providers, vehicle positions, geo-aware ratings, surge multipliers, and multi-modal itineraries from Stuttgart coordinates; served through a server function so results are cached by TanStack Query and re-rankable client-side.
- Simulated live telemetry: an interval-driven store nudges vehicle positions, availability, and surge so badges and counts update while the map is open.
- Map rendering: canvas layer with quadtree-backed clustering; route overlays drawn as animated polylines.
- Design tokens (provider colors, frost surfaces, shadows) added to `src/styles.css`; no hardcoded color classes.
- No accounts, no database in v1.

## Out of scope for v1

Native iOS/Android apps, real provider APIs and affiliate tracking, WebSockets, accounts and saved trips.
