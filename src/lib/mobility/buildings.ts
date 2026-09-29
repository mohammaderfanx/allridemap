import { BUILT_UP, ROADS } from "./city";
import { project } from "./geo";

export type Building = { pts: { x: number; y: number }[]; h: number; cx: number; cy: number };

function inside(pt: { x: number; y: number }, ring: { x: number; y: number }[]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

function distSeg(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/** Procedural, deterministic building footprints inside built-up areas (metres). */
export function generateBuildings(): Building[] {
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const roads = ROADS.map((r) => ({ major: r.class === "major", pts: r.path.map(project) }));
  const out: Building[] = [];
  const step = 52;
  BUILT_UP.forEach((b) => {
    const ring = b.ring.map(project);
    const xs = ring.map((p) => p.x);
    const ys = ring.map((p) => p.y);
    for (let x = Math.min(...xs); x < Math.max(...xs); x += step) {
      for (let y = Math.min(...ys); y < Math.max(...ys); y += step) {
        const c = { x: x + (rnd() - 0.5) * 14, y: y + (rnd() - 0.5) * 14 };
        if (!inside(c, ring)) continue;
        let near = false;
        for (const r of roads) {
          for (let i = 1; i < r.pts.length && !near; i++) if (distSeg(c, r.pts[i - 1]!, r.pts[i]!) < (r.major ? 38 : 26)) near = true;
          if (near) break;
        }
        if (near || rnd() < 0.12) continue;
        const w = 16 + rnd() * 20;
        const d = 14 + rnd() * 18;
        const a = (rnd() - 0.5) * 0.35;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const corners = [
          [-w / 2, -d / 2],
          [w / 2, -d / 2],
          [w / 2, d / 2],
          [-w / 2, d / 2],
        ].map(([px, py]) => ({ x: c.x + px! * ca - py! * sa, y: c.y + px! * sa + py! * ca }));
        const centre = Math.hypot(c.x, c.y);
        const h = (centre < 900 ? 18 : 9) + rnd() * (centre < 900 ? 30 : 16) + (rnd() < 0.03 ? 40 : 0);
        out.push({ pts: corners, h, cx: c.x, cy: c.y });
      }
    }
  });
  return out;
}
