/**
 * Deterministic path builders for lesson authoring. Everything here is pure,
 * so a lesson's reference strokes are identical on every device.
 */
import type { Point } from '@/engine/records';

export type XY = [number, number];
/** Pressure profile along a path, t in [0, 1] → pressure in (0, 1]. */
export type Profile = (t: number) => number;

export const bell: Profile = (t) => 0.5 + 0.4 * Math.sin(t * Math.PI);
export const taperOut: Profile = (t) => 0.85 - 0.55 * t;
export const taperIn: Profile = (t) => 0.3 + 0.55 * t;
export const flat = (p: number): Profile => () => p;

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Catmull-Rom spline through `ctrl`, `steps` samples per span, pressure from `prof`. */
export function spline(ctrl: XY[], steps = 24, prof: Profile = bell): Point[] {
  if (ctrl.length === 1) return [{ x: ctrl[0][0], y: ctrl[0][1], p: prof(0) }];
  const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
  const out: Point[] = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push({ x: round2(x), y: round2(y), p: 0 });
    }
  }
  const last = ctrl[ctrl.length - 1];
  out.push({ x: last[0], y: last[1], p: 0 });
  out.forEach((q, i) => { q.p = round2(prof(i / (out.length - 1))); });
  return out;
}

/** Closed circle (or arc) around (cx, cy); `turns` < 1 gives an arc. */
export function circle(cx: number, cy: number, r: number, n = 40, start = 0, turns = 1, prof: Profile = flat(0.7)): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * Math.PI * 2 * turns;
    out.push({ x: round2(cx + Math.cos(a) * r), y: round2(cy + Math.sin(a) * r), p: round2(prof(i / n)) });
  }
  return out;
}

/** Rotates/offsets a local (x, y) around an origin: local +x points along `angle`. */
export const frame = (ox: number, oy: number, angle: number) => (x: number, y: number): XY =>
  [ox + x * Math.cos(angle) - y * Math.sin(angle), oy + x * Math.sin(angle) + y * Math.cos(angle)];

/** Total polyline length. */
export function pathLength(pts: Point[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return l;
}

/** `n` points spaced evenly by arc length (first and last kept). */
export function resampleN(pts: Point[], n: number): Point[] {
  if (pts.length === 0) return [];
  if (pts.length === 1 || n < 2) return [pts[0]];
  const total = pathLength(pts);
  if (total === 0) return Array.from({ length: n }, () => ({ ...pts[0] }));
  const out: Point[] = [{ ...pts[0] }];
  const step = total / (n - 1);
  let acc = 0, i = 1, prev = pts[0];
  while (out.length < n - 1 && i < pts.length) {
    const cur = pts[i];
    const seg = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    if (acc + seg >= step) {
      const t = (step - acc) / seg;
      const q = { x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t, p: prev.p + (cur.p - prev.p) * t };
      out.push(q);
      prev = q;
      acc = 0;
    } else {
      acc += seg;
      prev = cur;
      i++;
    }
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out;
}

export interface Box { x: number; y: number; w: number; h: number }
export function boundsOf(paths: Point[][]): Box | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pts of paths) for (const q of pts) {
    if (q.x < minX) minX = q.x; if (q.x > maxX) maxX = q.x;
    if (q.y < minY) minY = q.y; if (q.y > maxY) maxY = q.y;
  }
  return Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
}
