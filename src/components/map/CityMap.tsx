import { useEffect, useRef, useState } from "react";
import { BUILT_UP, DISTRICT_LABELS, NECKAR, PARKS, ROADS } from "@/lib/mobility/city";
import { project, type LatLng, type Place } from "@/lib/mobility/geo";
import type { Segment, Vehicle } from "@/lib/mobility/engine";

type View = { center: LatLng; scale: number }; // scale = pixels per metre

const COLORS = {
  land: "#f3f1ec",
  built: "#e6e3dc",
  park: "#d5e8cd",
  water: "#a9d4ee",
  roadMajor: "#ffffff",
  roadMajorCasing: "#e0dcd3",
  roadMinor: "#faf9f6",
  label: "#8a8479",
  pin: "#111827",
};

const PROVIDER_COLORS: Record<string, string> = {
  lime: "#5bd63a",
  tier: "#2f3ae0",
  voi: "#f0503c",
  dott: "#1f2b6c",
  nextbike: "#e8384f",
  uber: "#111827",
  bolt: "#2fbe62",
  freenow: "#f43f5e",
  taxi: "#f2b705",
  vvs: "#0a58a8",
  walk: "#8e8e93",
};

function segColor(seg: Segment): string {
  if (seg.mode === "walk") return COLORS.label;
  return PROVIDER_COLORS[seg.providerId] ?? "#0a58a8";
}

export function CityMap({
  origin,
  destination,
  fleet,
  activeSegments,
  visibleProviders,
  onPickPoint,
  className,
}: {
  origin?: Place | undefined;
  destination?: Place | undefined;
  fleet: Vehicle[];
  activeSegments?: Segment[] | undefined;
  visibleProviders: string[];
  onPickPoint?: ((p: LatLng) => void) | undefined;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<View>({ center: { lat: 48.7784, lng: 9.1794 }, scale: 0.035 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  // Fit the route when it changes
  useEffect(() => {
    if (!activeSegments?.length || !wrapRef.current) return;
    const pts = activeSegments.flatMap((s) => s.path);
    if (!pts.length) return;
    const xs = pts.map((p) => project(p).x);
    const ys = pts.map((p) => project(p).y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const { clientWidth: w, clientHeight: h } = wrapRef.current;
    const pad = 90;
    const scale = Math.min((w - pad * 2) / Math.max(maxX - minX, 300), (h - pad * 2) / Math.max(maxY - minY, 300));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setView({
      center: {
        lng: 9.1794 + cx / (111320 * Math.cos((48.7784 * Math.PI) / 180)),
        lat: 48.7784 - cy / 110574,
      },
      scale: Math.max(0.006, Math.min(scale, 0.12)),
    });
  }, [activeSegments]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let raf = 0;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const v = viewRef.current;
      const c = project(v.center);
      const toPx = (p: LatLng) => {
        const q = project(p);
        return [(q.x - c.x) * v.scale + w / 2, (q.y - c.y) * v.scale + h / 2] as const;
      };

      ctx.fillStyle = COLORS.land;
      ctx.fillRect(0, 0, w, h);

      const poly = (ring: LatLng[], fill: string) => {
        ctx.beginPath();
        ring.forEach((p, i) => {
          const [x, y] = toPx(p);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      };

      BUILT_UP.forEach((b) => poly(b.ring, COLORS.built));
      PARKS.forEach((p) => poly(p.ring, COLORS.park));

      // river
      ctx.beginPath();
      NECKAR.forEach((p, i) => {
        const [x, y] = toPx(p);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = COLORS.water;
      ctx.lineWidth = Math.max(4, 260 * v.scale);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();

      // roads (casing + fill)
      const drawRoads = (pass: 0 | 1) => {
        ROADS.forEach((r) => {
          const major = r.class === "major";
          ctx.beginPath();
          r.path.forEach((p, i) => {
            const [x, y] = toPx(p);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          const base = major ? Math.max(3.5, 120 * v.scale) : Math.max(2, 60 * v.scale);
          ctx.lineWidth = pass === 0 ? base + 2 : base;
          ctx.strokeStyle = pass === 0 ? COLORS.roadMajorCasing : major ? COLORS.roadMajor : COLORS.roadMinor;
          ctx.stroke();
        });
      };
      drawRoads(0);
      drawRoads(1);

      // district labels
      ctx.font = "500 11px ui-sans-serif, Inter, system-ui";
      ctx.fillStyle = COLORS.label;
      ctx.textAlign = "center";
      DISTRICT_LABELS.forEach((d) => {
        const [x, y] = toPx(d.at);
        if (x < -40 || x > w + 40 || y < -20 || y > h + 20) return;
        ctx.fillText(d.name.toUpperCase(), x, y);
      });

      // route overlay
      if (activeSegments?.length) {
        activeSegments.forEach((seg) => {
          ctx.beginPath();
          seg.path.forEach((p, i) => {
            const [x, y] = toPx(p);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.setLineDash(seg.mode === "walk" ? [2, 7] : []);
          ctx.lineWidth = seg.mode === "transit" ? 8 : seg.mode === "walk" ? 4 : 6;
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth += 3;
          ctx.stroke();
          ctx.lineWidth -= 3;
          ctx.strokeStyle = segColor(seg);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      } else {
        // vehicle clusters
        const cell = 58;
        const buckets = new Map<string, { n: number; x: number; y: number; providerId: string }>();
        fleet.forEach((veh) => {
          if (!visibleProviders.includes(veh.providerId)) return;
          const [x, y] = toPx(veh);
          if (x < -30 || x > w + 30 || y < -30 || y > h + 30) return;
          const k = `${veh.providerId}:${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
          const b = buckets.get(k);
          if (b) {
            b.n += 1;
            b.x = (b.x * (b.n - 1) + x) / b.n;
            b.y = (b.y * (b.n - 1) + y) / b.n;
          } else buckets.set(k, { n: 1, x, y, providerId: veh.providerId });
        });
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        [...buckets.values()].forEach((b) => {
          const color = PROVIDER_COLORS[b.providerId] ?? "#555";
          const r = b.n > 1 ? 13 : 7;
          ctx.beginPath();
          ctx.arc(b.x, b.y, r + 2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(15,23,42,0.13)";
          ctx.fill();
          ctx.beginPath();
          ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();
          if (b.n > 1) {
            ctx.fillStyle = "#ffffff";
            ctx.font = "700 11px ui-sans-serif, Inter, system-ui";
            ctx.fillText(String(b.n), b.x, b.y + 0.5);
          }
        });
        ctx.textBaseline = "alphabetic";
      }

      // endpoints
      const pin = (p: LatLng, label: string, filled: boolean) => {
        const [x, y] = toPx(p);
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fillStyle = filled ? COLORS.pin : "#ffffff";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = filled ? "#ffffff" : COLORS.pin;
        ctx.stroke();
        ctx.font = "600 12px ui-sans-serif, Inter, system-ui";
        ctx.fillStyle = "#1c1c1e";
        ctx.textAlign = "left";
        ctx.fillText(label, x + 14, y + 4);
      };
      if (origin) pin(origin, origin.name, false);
      if (destination) pin(destination, destination.name, true);
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [fleet, activeSegments, visibleProviders, origin, destination]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    d.x = e.clientX;
    d.y = e.clientY;
    setView((v) => {
      const c = project(v.center);
      const nx = c.x - dx / v.scale;
      const ny = c.y - dy / v.scale;
      return {
        ...v,
        center: {
          lng: 9.1794 + nx / (111320 * Math.cos((48.7784 * Math.PI) / 180)),
          lat: 48.7784 - ny / 110574,
        },
      };
    });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.moved || !onPickPoint || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const v = viewRef.current;
    const c = project(v.center);
    const x = c.x + (e.clientX - rect.left - rect.width / 2) / v.scale;
    const y = c.y + (e.clientY - rect.top - rect.height / 2) / v.scale;
    onPickPoint({
      lng: 9.1794 + x / (111320 * Math.cos((48.7784 * Math.PI) / 180)),
      lat: 48.7784 - y / 110574,
    });
  };

  const zoomBy = (f: number) =>
    setView((v) => ({ ...v, scale: Math.max(0.004, Math.min(0.2, v.scale * f)) }));

  return (
    <div ref={wrapRef} className={className}>
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={(e) => zoomBy(e.deltaY > 0 ? 0.9 : 1.1)}
      />
      <div className="pointer-events-auto absolute right-3 top-3 flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur-xl">
        <button
          aria-label="Zoom in"
          className="px-3 py-2 text-lg font-medium text-foreground transition-colors hover:bg-accent"
          onClick={() => zoomBy(1.35)}
        >
          +
        </button>
        <div className="h-px bg-border/70" />
        <button
          aria-label="Zoom out"
          className="px-3 py-2 text-lg font-medium text-foreground transition-colors hover:bg-accent"
          onClick={() => zoomBy(0.74)}
        >
          −
        </button>
      </div>
    </div>
  );
}
