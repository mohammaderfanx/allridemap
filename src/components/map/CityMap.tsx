import { useEffect, useRef, useState } from "react";
import { Box, Compass, Minus, Plus } from "lucide-react";
import { BUILT_UP, DISTRICT_LABELS, NECKAR, PARKS, ROADS } from "@/lib/mobility/city";
import { project, unproject, type LatLng, type Place } from "@/lib/mobility/geo";
import type { Segment, Vehicle } from "@/lib/mobility/engine";
import { generateBuildings, type Building } from "@/lib/mobility/buildings";
import { vehicleFeed, type LiveVehicle } from "@/lib/mobility/simulation";

/** cx/cy in local metres, scale = px per metre, bearing/pitch in radians */
type View = { cx: number; cy: number; scale: number; bearing: number; pitch: number };

const PALETTES = {
  light: {
    land: "#f3f1ec", built: "#e9e6df", park: "#cfe6c4", water: "#9fcdec", roadMajor: "#ffffff", casing: "#dcd7cc",
    roadMinor: "#fbfaf7", label: "#8a8479", text: "#1c1c1e", roof: [250, 249, 246], wall: [214, 209, 199], halo: "rgba(255,255,255,0.9)", pin: "#111827", pinInner: "#ffffff",
  },
  dark: {
    land: "#1b1e23", built: "#23272e", park: "#1d3024", water: "#1b3b56", roadMajor: "#4a505b", casing: "#2a2e35",
    roadMinor: "#343942", label: "#8b93a1", text: "#f2f2f7", roof: [72, 78, 90], wall: [44, 48, 57], halo: "rgba(20,22,26,0.9)", pin: "#f2f2f7", pinInner: "#1b1e23",
  },
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

function mix(c: number[], k: number) {
  return `rgb(${Math.round(c[0]! * k)},${Math.round(c[1]! * k)},${Math.round(c[2]! * k)})`;
}

type Track = { pts: { x: number; y: number }[]; cum: number[]; len: number };
function track(path: LatLng[]): Track {
  const pts = path.map(project);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  return { pts, cum, len: cum[cum.length - 1] ?? 0 };
}
function along(t: Track, d: number) {
  let i = 1;
  while (i < t.cum.length - 1 && t.cum[i]! < d) i++;
  const a = t.pts[i - 1] ?? t.pts[0]!;
  const b = t.pts[i] ?? a;
  const s = t.cum[i]! - t.cum[i - 1]! || 1;
  const k = Math.min(1, Math.max(0, (d - t.cum[i - 1]!) / s));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

const CENTER0 = project({ lat: 48.7784, lng: 9.1794 });
const MIN_SCALE = 0.004;
const MAX_SCALE = 0.3;
const MAX_PITCH = (60 * Math.PI) / 180;

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
  const viewRef = useRef<View>({ cx: CENTER0.x, cy: CENTER0.y, scale: 0.035, bearing: -0.25, pitch: (48 * Math.PI) / 180 });
  const targetRef = useRef<View | null>(null);
  const [bearingDeg, setBearingDeg] = useState((-0.25 * 180) / Math.PI);
  const [is3d, setIs3d] = useState(true);
  const propsRef = useRef({ origin, destination, fleet, activeSegments, visibleProviders, onPickPoint });
  propsRef.current = { origin, destination, fleet, activeSegments, visibleProviders, onPickPoint };
  const buildingsRef = useRef<Building[] | null>(null);
  const liveRef = useRef<{ prev: Map<string, LiveVehicle>; cur: LiveVehicle[]; at: number }>({ prev: new Map(), cur: [], at: 0 });

  const syncUi = () => {
    const v = viewRef.current;
    setBearingDeg((v.bearing * 180) / Math.PI);
    setIs3d(v.pitch > 0.05);
  };

  const camera = (v: View, w: number, h: number) => {
    const cosB = Math.cos(v.bearing), sinB = Math.sin(v.bearing), cosP = Math.cos(v.pitch), sinP = Math.sin(v.pitch);
    const D = h * 1.6;
    const oy = h * 0.52;
    const proj = (x: number, y: number, z = 0): [number, number, number] => {
      const dx = (x - v.cx) * v.scale, dy = (y - v.cy) * v.scale;
      const gx = dx * cosB - dy * sinB;
      const gy = dx * sinB + dy * cosB;
      const zz = z * v.scale;
      const depth = D - gy * sinP - zz * cosP;
      const f = D / Math.max(depth, D * 0.05);
      return [w / 2 + gx * f, oy + (gy * cosP - zz * sinP) * f, depth];
    };
    const unproj = (sx: number, sy: number) => {
      const X = sx - w / 2, Y = sy - oy;
      const gy = (Y * D) / Math.max(D * cosP + Y * sinP, 1);
      const gx = (X * (D - gy * sinP)) / D;
      const dx = gx * cosB + gy * sinB;
      const dy = -gx * sinB + gy * cosB;
      return { x: v.cx + dx / v.scale, y: v.cy + dy / v.scale };
    };
    return { proj, unproj, D };
  };

  // Subscribe to the live vehicle feed (simulated now, real-time later)
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

  // Fly to fit the route when it changes
  useEffect(() => {
    if (!activeSegments?.length || !wrapRef.current) return;
    const pts = activeSegments.flatMap((s) => s.path).map(project);
    if (!pts.length) return;
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const { clientWidth: w, clientHeight: h } = wrapRef.current;
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 400);
    const v = viewRef.current;
    targetRef.current = {
      ...v,
      cx: (Math.min(...xs) + Math.max(...xs)) / 2,
      cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      scale: Math.max(MIN_SCALE, Math.min((Math.min(w, h) * 0.62) / span, 0.12)),
    };
  }, [activeSegments]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    if (!buildingsRef.current) buildingsRef.current = generateBuildings();
    let raf = 0;

    const draw = () => {
      const P = propsRef.current;
      const dark = document.documentElement.classList.contains("dark");
      const C = dark ? PALETTES.dark : PALETTES.light;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // ease towards target view
      const t = targetRef.current;
      if (t) {
        const v = viewRef.current;
        const k = 0.12;
        v.cx += (t.cx - v.cx) * k;
        v.cy += (t.cy - v.cy) * k;
        v.scale *= Math.pow(t.scale / v.scale, k);
        v.bearing += (t.bearing - v.bearing) * k;
        v.pitch += (t.pitch - v.pitch) * k;
        if (Math.abs(t.cx - v.cx) < 1 && Math.abs(t.cy - v.cy) < 1 && Math.abs(Math.log(t.scale / v.scale)) < 0.005 && Math.abs(t.bearing - v.bearing) < 0.002 && Math.abs(t.pitch - v.pitch) < 0.002) {
          Object.assign(v, t);
          targetRef.current = null;
          syncUi();
        }
      }

      const v = viewRef.current;
      const { proj } = camera(v, w, h);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = C.land;
      ctx.fillRect(0, 0, w, h);
      if (v.pitch > 0.1) {
        const g = ctx.createLinearGradient(0, 0, 0, h * 0.25);
        g.addColorStop(0, dark ? "rgba(10,12,16,0.9)" : "rgba(200,222,240,0.9)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h * 0.25);
      }

      const pathLL = (pts: LatLng[]) => {
        ctx.beginPath();
        pts.forEach((p, i) => {
          const q = project(p);
          const [x, y] = proj(q.x, q.y);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
      };
      const fillRing = (ring: LatLng[], fill: string) => {
        pathLL(ring);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      };
      BUILT_UP.forEach((b) => fillRing(b.ring, C.built));
      PARKS.forEach((p) => fillRing(p.ring, C.park));

      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      pathLL(NECKAR);
      ctx.strokeStyle = C.water;
      ctx.lineWidth = Math.max(4, 240 * v.scale);
      ctx.stroke();

      for (const pass of [0, 1]) {
        ROADS.forEach((r) => {
          const major = r.class === "major";
          pathLL(r.path);
          const base = major ? Math.max(3.5, 26 * v.scale * 4) : Math.max(2, 14 * v.scale * 4);
          ctx.lineWidth = pass === 0 ? base + 2 : base;
          ctx.strokeStyle = pass === 0 ? C.casing : major ? C.roadMajor : C.roadMinor;
          ctx.stroke();
        });
      }

      // faint route trail (solid, no dots)
      const segs = P.activeSegments ?? [];
      segs.forEach((seg) => {
        pathLL(seg.path);
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = seg.mode === "transit" ? 6 : 4;
        ctx.strokeStyle = seg.mode === "walk" ? C.label : logoFor(seg.providerId, dark, seg.label).bg;
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      // 3D buildings (extruded footprints only, ground stays flat)
      if (v.scale > 0.012) {
        const list: { b: Building; depth: number }[] = [];
        for (const b of buildingsRef.current!) {
          const [sx, sy, depth] = proj(b.cx, b.cy);
          if (sx < -80 || sx > w + 80 || sy < -200 || sy > h + 80) continue;
          list.push({ b, depth });
        }
        list.sort((a, c) => c.depth - a.depth);
        const lx = -0.55, ly = -0.83;
        const hScale = v.pitch > 0.05 ? 1 : 0;
        for (const { b } of list) {
          const base = b.pts.map((p) => proj(p.x, p.y, 0));
          const top = b.pts.map((p) => proj(p.x, p.y, b.h * hScale));
          if (hScale) {
            const walls = b.pts.map((p, i) => {
              const q = b.pts[(i + 1) % 4]!;
              const nx = q.y - p.y, ny = -(q.x - p.x);
              const nl = Math.hypot(nx, ny) || 1;
              const md = (base[i]![2] + base[(i + 1) % 4]![2]) / 2;
              return { i, md, lum: 0.78 + 0.22 * ((nx / nl) * lx + (ny / nl) * ly) };
            });
            walls.sort((a, c) => c.md - a.md);
            for (const wl of walls) {
              const j = (wl.i + 1) % 4;
              ctx.beginPath();
              ctx.moveTo(base[wl.i]![0], base[wl.i]![1]);
              ctx.lineTo(base[j]![0], base[j]![1]);
              ctx.lineTo(top[j]![0], top[j]![1]);
              ctx.lineTo(top[wl.i]![0], top[wl.i]![1]);
              ctx.closePath();
              ctx.fillStyle = mix(C.wall, wl.lum);
              ctx.fill();
            }
          }
          ctx.beginPath();
          top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.fillStyle = mix(C.roof, 1);
          ctx.fill();
          ctx.lineWidth = 0.6;
          ctx.strokeStyle = mix(C.wall, 0.95);
          ctx.stroke();
        }
      }

      // district labels
      ctx.font = "600 11px Manrope, ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      DISTRICT_LABELS.forEach((d) => {
        const q = project(d.at);
        const [x, y] = proj(q.x, q.y);
        if (x < -40 || x > w + 40 || y < -20 || y > h + 20) return;
        ctx.lineWidth = 3;
        ctx.strokeStyle = C.halo;
        ctx.strokeText(d.name.toUpperCase(), x, y);
        ctx.fillStyle = C.label;
        ctx.fillText(d.name.toUpperCase(), x, y);
      });

      const now = performance.now();
      if (segs.length) {
        // provider logos travelling along each leg of the route
        segs.forEach((seg, idx) => {
          const tr = track(seg.path);
          if (!tr.len) return;
          const period = 4200 + Math.min(6000, tr.len * 1.2);
          const d = (((now + idx * 900) % period) / period) * tr.len;
          const p = along(tr, d);
          const [x, y] = proj(p.x, p.y);
          if (seg.mode === "walk") {
            ctx.beginPath();
            ctx.arc(x, y, 9, 0, Math.PI * 2);
            ctx.fillStyle = "#8e8e93";
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(x, y - 3.5, 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(x - 1, y - 1.5, 2, 6);
          } else {
            drawLogo(ctx, logoFor(seg.providerId, dark, seg.label), x, y, 22);
          }
        });
      } else {
        // parked scooters/bikes clustered
        const cell = 58;
        const buckets = new Map<string, { n: number; x: number; y: number; providerId: string }>();
        P.fleet.forEach((veh) => {
          if (!P.visibleProviders.includes(veh.providerId)) return;
          const q = project(veh);
          const [x, y] = proj(q.x, q.y);
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
          const r = b.n > 1 ? 11 : 5;
          ctx.beginPath();
          ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
          ctx.fillStyle = lg.bg;
          ctx.globalAlpha = 0.9;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          if (b.n > 1) {
            ctx.fillStyle = lg.fg;
            ctx.font = "800 10px Manrope, ui-sans-serif, system-ui";
            ctx.fillText(String(b.n), b.x, b.y + 0.5);
          }
        });
        ctx.textBaseline = "alphabetic";

        // moving vehicles from the live feed, smoothly interpolated
        const L = liveRef.current;
        const k = Math.min(1, (now - L.at) / vehicleFeed.intervalMs);
        const items = L.cur
          .filter((c) => P.visibleProviders.includes(c.providerId))
          .map((c) => {
            const pv = L.prev.get(c.id) ?? c;
            const q = project({ lat: pv.lat + (c.lat - pv.lat) * k, lng: pv.lng + (c.lng - pv.lng) * k });
            const [x, y, depth] = proj(q.x, q.y);
            return { c, x, y, depth };
          })
          .filter((i) => i.x > -40 && i.x < w + 40 && i.y > -40 && i.y < h + 40)
          .sort((a, b) => b.depth - a.depth);
        items.forEach(({ c, x, y }) => drawLogo(ctx, logoFor(c.providerId, dark, c.mode === "transit" ? "S" : undefined), x, y, c.mode === "transit" ? 20 : 17));
      }

      const pin = (p: LatLng, label: string, filled: boolean) => {
        const q = project(p);
        const [x, y] = proj(q.x, q.y);
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fillStyle = filled ? C.pin : C.pinInner;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = filled ? C.pinInner : C.pin;
        ctx.stroke();
        ctx.font = "700 12px Manrope, ui-sans-serif, system-ui";
        ctx.textAlign = "left";
        ctx.lineWidth = 3;
        ctx.strokeStyle = C.halo;
        ctx.strokeText(label, x + 14, y + 4);
        ctx.fillStyle = C.text;
        ctx.fillText(label, x + 14, y + 4);
      };
      if (P.origin) pin(P.origin, P.origin.name, false);
      if (P.destination) pin(P.destination, P.destination.name, true);
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---- interaction ---------------------------------------------------------
  const zoomAt = (factor: number, sx: number, sy: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    targetRef.current = null;
    const v = viewRef.current;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const before = camera(v, w, h).unproj(sx, sy);
    v.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * factor));
    const after = camera(v, w, h).unproj(sx, sy);
    v.cx += before.x - after.x;
    v.cy += before.y - after.y;
  };

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; rotate: boolean; pinchDist?: number; pinchAngle?: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    targetRef.current = null;
    const rotate = e.button === 2 || e.ctrlKey || e.shiftKey || e.altKey;
    if (pointers.current.size === 1) gesture.current = { moved: false, rotate };
    else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { moved: true, rotate: false, pinchDist: Math.hypot(a!.x - b!.x, a!.y - b!.y), pinchAngle: Math.atan2(b!.y - a!.y, b!.x - a!.x) };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    const g = gesture.current;
    if (!prev || !g || !wrapRef.current) return;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = viewRef.current;
    const rect = wrapRef.current.getBoundingClientRect();
    if (pointers.current.size === 2 && g.pinchDist) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const ang = Math.atan2(b!.y - a!.y, b!.x - a!.x);
      zoomAt(dist / g.pinchDist, (a!.x + b!.x) / 2 - rect.left, (a!.y + b!.y) / 2 - rect.top);
      v.bearing += ang - (g.pinchAngle ?? ang);
      g.pinchDist = dist;
      g.pinchAngle = ang;
      syncUi();
      return;
    }
    if (Math.abs(dx) + Math.abs(dy) > 2) g.moved = true;
    if (g.rotate) {
      v.bearing += dx * 0.006;
      v.pitch = Math.max(0, Math.min(MAX_PITCH, v.pitch - dy * 0.006));
      syncUi();
      return;
    }
    const cam = camera(v, rect.width, rect.height);
    const a = cam.unproj(e.clientX - rect.left - dx, e.clientY - rect.top - dy);
    const b = cam.unproj(e.clientX - rect.left, e.clientY - rect.top);
    v.cx -= b.x - a.x;
    v.cy -= b.y - a.y;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size) return;
    gesture.current = null;
    const pick = propsRef.current.onPickPoint;
    if (!g || g.moved || g.rotate || !pick || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const p = camera(viewRef.current, rect.width, rect.height).unproj(e.clientX - rect.left, e.clientY - rect.top);
    pick(unproject(p.x, p.y));
  };

  const animateTo = (patch: Partial<View>) => {
    targetRef.current = { ...viewRef.current, ...patch };
    const v = { ...viewRef.current, ...patch };
    setBearingDeg((v.bearing * 180) / Math.PI);
    setIs3d(v.pitch > 0.05);
  };
  const zoomBtn = (f: number) => {
    const v = viewRef.current;
    animateTo({ scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.scale * f)) });
  };

  const btn = "flex h-10 w-10 items-center justify-center text-foreground transition-colors hover:bg-accent";
  return (
    <div ref={wrapRef} className={className}>
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="pointer-events-auto absolute right-3 top-3 flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-frost shadow-sm backdrop-blur-xl md:right-[424px]">
        <button aria-label="Zoom in" className={btn} onClick={() => zoomBtn(1.5)}>
          <Plus className="h-4 w-4" />
        </button>
        <div className="h-px bg-border/70" />
        <button aria-label="Zoom out" className={btn} onClick={() => zoomBtn(1 / 1.5)}>
          <Minus className="h-4 w-4" />
        </button>
        <div className="h-px bg-border/70" />
        <button
          aria-label={is3d ? "Switch to 2D" : "Switch to 3D"}
          className={`${btn} text-xs font-extrabold ${is3d ? "text-primary" : ""}`}
          onClick={() => animateTo({ pitch: is3d ? 0 : (48 * Math.PI) / 180 })}
        >
          {is3d ? "3D" : <Box className="h-4 w-4" />}
        </button>
        <div className="h-px bg-border/70" />
        <button aria-label="Reset north" className={btn} onClick={() => animateTo({ bearing: 0 })}>
          <Compass className="h-4 w-4 transition-transform" style={{ transform: `rotate(${bearingDeg - 45}deg)` }} />
        </button>
      </div>
    </div>
  );
}
