import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MLMap, StyleSpecification } from "maplibre-gl";
import type { LatLng, Place } from "@/lib/mobility/geo";
import type { Segment, Vehicle } from "@/lib/mobility/engine";
import { vehicleFeed, type LiveVehicle } from "@/lib/mobility/simulation";

const tiles = (variant: string) =>
  ["a", "b", "c", "d"].map((s) => `https://${s}.basemaps.cartocdn.com/rastertiles/${variant}/{z}/{x}/{y}@2x.png`);

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    light: { type: "raster", tiles: tiles("voyager"), tileSize: 256, attribution: "© OpenStreetMap contributors © CARTO" },
    dark: { type: "raster", tiles: tiles("dark_all"), tileSize: 256, attribution: "© OpenStreetMap contributors © CARTO" },
  },
  layers: [
    { id: "light", type: "raster", source: "light" },
    { id: "dark", type: "raster", source: "dark", layout: { visibility: "none" } },
  ],
};

type Logo = { bg: string; fg: string; text: string; border?: string; round?: boolean };
function logoFor(providerId: string, dark: boolean, label?: string): Logo {
  switch (providerId) {
    case "uber": return dark ? { bg: "#ffffff", fg: "#000000", text: "Uber" } : { bg: "#000000", fg: "#ffffff", text: "Uber" };
    case "bolt": return { bg: "#32bb78", fg: "#ffffff", text: "Bolt" };
    case "freenow": return { bg: "#e4003a", fg: "#ffffff", text: "FREENOW" };
    case "taxi": return { bg: "#f7c600", fg: "#111111", text: "TAXI" };
    case "lime": return { bg: "#0fd125", fg: "#ffffff", text: "lime", round: true };
    case "tier": return { bg: "#0e1a50", fg: "#69d2aa", text: "TIER" };
    case "voi": return { bg: "#f26961", fg: "#ffffff", text: "voi", round: true };
    case "dott": return { bg: "#00a8e9", fg: "#ffffff", text: "dott", round: true };
    case "nextbike": return { bg: "#e8384f", fg: "#ffffff", text: "Rad" };
    case "vvs":
      return label?.trim().startsWith("S")
        ? { bg: "#ffffff", fg: "#ec0016", text: "DB", border: "#ec0016" }
        : { bg: "#ffd500", fg: "#003a70", text: "VVS" };
    default: return { bg: "#8e8e93", fg: "#ffffff", text: "walk", round: true };
  }
}

function drawLogo(ctx: CanvasRenderingContext2D, lg: Logo, x: number, y: number, size: number) {
  ctx.font = `800 ${Math.round(size * 0.42)}px Manrope, ui-sans-serif, system-ui`;
  const tw = ctx.measureText(lg.text).width;
  const w = lg.round ? Math.max(size, tw + size * 0.5) : Math.max(size * 1.2, tw + size * 0.55);
  const h = size;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, lg.round ? h / 2 : h * 0.28);
  ctx.fillStyle = lg.bg;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = lg.border ? 2 : 1.5;
  ctx.strokeStyle = lg.border ?? "rgba(255,255,255,0.9)";
  ctx.stroke();
  ctx.fillStyle = lg.fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(lg.text, x, y + 0.5);
  ctx.textBaseline = "alphabetic";
}


type Track = { pts: [number, number][]; cum: number[]; len: number };
function track(pts: [number, number][]): Track {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  return { pts, cum, len: cum[cum.length - 1] ?? 0 };
}
function along(t: Track, d: number): [number, number] {
  let i = 1;
  while (i < t.cum.length - 1 && t.cum[i]! < d) i++;
  const a = t.pts[i - 1] ?? t.pts[0]!;
  const b = t.pts[i] ?? a;
  const s = t.cum[i]! - t.cum[i - 1]! || 1;
  const k = Math.min(1, Math.max(0, (d - t.cum[i - 1]!) / s));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

export function CityMap({
  origin,
  destination,
  stops = [],
  fleet,
  activeSegments,
  alternatives = [],
  visibleProviders,
  onPickPoint,
  fitPadding,
  className,
}: {
  origin?: Place | undefined;
  destination?: Place | undefined;
  stops?: Place[];
  fleet: Vehicle[];
  activeSegments?: Segment[] | undefined;
  /** other route choices, drawn muted */
  alternatives?: LatLng[][];
  visibleProviders: string[];
  onPickPoint?: ((p: LatLng) => void) | undefined;
  fitPadding?: { top: number; bottom: number; left: number; right: number };
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const propsRef = useRef({ origin, destination, stops, fleet, activeSegments, alternatives, visibleProviders, onPickPoint });
  propsRef.current = { origin, destination, stops, fleet, activeSegments, alternatives, visibleProviders, onPickPoint };
  const liveRef = useRef<{ prev: Map<string, LiveVehicle>; cur: LiveVehicle[]; at: number }>({ prev: new Map(), cur: [], at: 0 });

  // live vehicle feed (simulated now, real-time later)
  useEffect(() => {
    const onData = () => {
      const L = liveRef.current;
      const now = performance.now();
      const k = Math.min(1, (now - L.at) / vehicleFeed.intervalMs);
      const prev = new Map<string, LiveVehicle>();
      L.cur.forEach((c) => {
        const p = L.prev.get(c.id) ?? c;
        prev.set(c.id, { ...c, lat: p.lat + (c.lat - p.lat) * k, lng: p.lng + (c.lng - p.lng) * k });
      });
      L.prev = prev;
      L.cur = vehicleFeed.getSnapshot();
      L.at = now;
    };
    liveRef.current.cur = vehicleFeed.getSnapshot();
    return vehicleFeed.subscribe(onData);
  }, []);

  // create the map + overlay render loop
  useEffect(() => {
    let raf = 0;
    let disposed = false;
    let map: MLMap | null = null;
    Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl-worker.mjs?url")]).then(([mod, worker]) => {
      const maplibregl = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
      maplibregl.setWorkerUrl((worker as { default: string }).default);
      if (disposed || !mapDivRef.current) return;
      const created = new maplibregl.Map({
        container: mapDivRef.current,
        style: STYLE,
        center: [9.1794, 48.7784],
        zoom: 12.6,
        maxPitch: 0,
        pitchWithRotate: false,
        attributionControl: { compact: true },
      });
      map = created;
      created.touchPitch.disable();
      created.on("click", (e) => propsRef.current.onPickPoint?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
      mapRef.current = created;

      const draw = () => {
        const canvas = canvasRef.current;
        const wrap = wrapRef.current;
        const m = mapRef.current;
        if (!canvas || !wrap || !m) return;
        const P = propsRef.current;
        const dark = document.documentElement.classList.contains("dark");
        if (m.isStyleLoaded() && m.getLayoutProperty("dark", "visibility") !== (dark ? "visible" : "none")) {
          m.setLayoutProperty("dark", "visibility", dark ? "visible" : "none");
          m.setLayoutProperty("light", "visibility", dark ? "none" : "visible");
        }
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = wrap.clientWidth, h = wrap.clientHeight;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const px = (p: LatLng): [number, number] => {
          const q = m.project([p.lng, p.lat]);
          return [q.x, q.y];
        };
        // icons grow when zooming in, shrink when zooming out
        const k = Math.max(0.55, Math.min(2, Math.pow(2, (m.getZoom() - 13) * 0.45)));
        const text = dark ? "#f2f2f7" : "#1c1c1e";
        const halo = dark ? "rgba(20,22,26,0.9)" : "rgba(255,255,255,0.95)";
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        const stroke = (pts: LatLng[]) => {
          ctx.beginPath();
          pts.forEach((p, i) => {
            const [x, y] = px(p);
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          });
        };
        P.alternatives.forEach((alt) => {
          stroke(alt);
          ctx.lineWidth = 6;
          ctx.strokeStyle = dark ? "rgba(160,170,190,0.55)" : "rgba(110,120,140,0.5)";
          ctx.stroke();
        });
        const segs = P.activeSegments ?? [];
        segs.forEach((seg) => {
          const color = seg.mode === "walk" ? "#8e8e93" : logoFor(seg.providerId, dark, seg.label).bg;
          stroke(seg.path);
          ctx.lineWidth = seg.mode === "walk" ? 6 : 9;
          ctx.strokeStyle = dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.95)";
          ctx.stroke();
          ctx.lineWidth = seg.mode === "walk" ? 3.5 : 5.5;
          ctx.strokeStyle = color === "#ffffff" ? "#ec0016" : color;
          ctx.stroke();
        });

        const now = performance.now();
        if (segs.length) {
          segs.forEach((seg, idx) => {
            const tr = track(seg.path.map(px));
            if (tr.len < 2) return;
            const period = 4500 + Math.min(6000, tr.len * 8);
            const [x, y] = along(tr, (((now + idx * 900) % period) / period) * tr.len);
            if (seg.mode === "walk") {
              const r = 8 * k;
              ctx.beginPath();
              ctx.arc(x, y, r, 0, Math.PI * 2);
              ctx.fillStyle = "#8e8e93";
              ctx.fill();
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.fillStyle = "#ffffff";
              ctx.beginPath();
              ctx.arc(x, y - r * 0.38, r * 0.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillRect(x - r * 0.11, y - r * 0.15, r * 0.22, r * 0.65);
            } else drawLogo(ctx, logoFor(seg.providerId, dark, seg.label), x, y, 22 * k);
          });
        } else {
          const cell = 58;
          const buckets = new Map<string, { n: number; x: number; y: number; providerId: string }>();
          P.fleet.forEach((veh) => {
            if (!P.visibleProviders.includes(veh.providerId)) return;
            const [x, y] = px(veh);
            if (x < -30 || x > w + 30 || y < -30 || y > h + 30) return;
            const key = `${veh.providerId}:${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
            const b = buckets.get(key);
            if (b) {
              b.n += 1;
              b.x += (x - b.x) / b.n;
              b.y += (y - b.y) / b.n;
            } else buckets.set(key, { n: 1, x, y, providerId: veh.providerId });
          });
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          buckets.forEach((b) => {
            const lg = logoFor(b.providerId, dark);
            const r = (b.n > 1 ? 10 : 5) * k;
            ctx.beginPath();
            ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
            ctx.fillStyle = lg.bg;
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            if (b.n > 1) {
              ctx.fillStyle = lg.fg;
              ctx.font = `800 ${Math.round(10 * k)}px Manrope, ui-sans-serif, system-ui`;
              ctx.fillText(String(b.n), b.x, b.y + 0.5);
            }
          });
          ctx.textBaseline = "alphabetic";

          const L = liveRef.current;
          const t = Math.min(1, (now - L.at) / vehicleFeed.intervalMs);
          L.cur.forEach((c) => {
            if (!P.visibleProviders.includes(c.providerId)) return;
            const pv = L.prev.get(c.id) ?? c;
            const [x, y] = px({ lat: pv.lat + (c.lat - pv.lat) * t, lng: pv.lng + (c.lng - pv.lng) * t });
            if (x < -40 || x > w + 40 || y < -40 || y > h + 40) return;
            drawLogo(ctx, logoFor(c.providerId, dark, c.mode === "transit" ? "S" : undefined), x, y, (c.mode === "transit" ? 19 : 16) * k);
          });
        }

        const pin = (p: LatLng, label: string, kind: "start" | "stop" | "end", n?: number) => {
          const [x, y] = px(p);
          const r = 9 * Math.min(1.4, k);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = kind === "start" ? "#ffffff" : kind === "stop" ? "#f59e0b" : "#111827";
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = kind === "start" ? "#111827" : "#ffffff";
          ctx.stroke();
          if (n) {
            ctx.fillStyle = "#ffffff";
            ctx.font = `800 ${Math.round(r * 1.1)}px Manrope, ui-sans-serif, system-ui`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(n), x, y + 0.5);
            ctx.textBaseline = "alphabetic";
          }
          ctx.font = "700 12px Manrope, ui-sans-serif, system-ui";
          ctx.textAlign = "left";
          ctx.lineWidth = 3;
          ctx.strokeStyle = halo;
          ctx.strokeText(label, x + r + 5, y + 4);
          ctx.fillStyle = text;
          ctx.fillText(label, x + r + 5, y + 4);
        };
        if (P.origin) pin(P.origin, P.origin.name, "start");
        P.stops.forEach((s, i) => pin(s, s.name, "stop", i + 1));
        if (P.destination) pin(P.destination, P.destination.name, "end");
      };
      const loop = () => {
        draw();
        raf = requestAnimationFrame(loop);
      };
      loop();
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // fit the selected route
  const fitKey = (activeSegments ?? []).map((s) => `${s.path.length}:${s.path[0]?.lat}`).join("|");
  useEffect(() => {
    const pts = (activeSegments ?? []).flatMap((s) => s.path);
    if (!pts.length) return;
    let tries = 0;
    const go = () => {
      const m = mapRef.current;
      if (!m) {
        if (tries++ < 20) setTimeout(go, 150);
        return;
      }
      const lngs = pts.map((p) => p.lng), lats = pts.map((p) => p.lat);
      const wrap = wrapRef.current;
      const mobile = (wrap?.clientWidth ?? 1000) < 768;
      m.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: fitPadding ?? (mobile ? { top: 190, bottom: 280, left: 40, right: 40 } : { top: 80, bottom: 80, left: 440, right: 460 }), maxZoom: 16, duration: 700 },
      );
    };
    go();
  }, [fitKey]);

  return (
    <div ref={wrapRef} className={className}>
      <div ref={mapDivRef} style={{ position: "absolute", inset: 0 }} />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
