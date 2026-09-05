/**
 * Brush specs, stroke records and the path → segment geometry shared by the
 * renderer and the p5 sketch export.
 */
import { checkTip } from './tipShim';

export interface GaussianPressure {
  mode: 'gaussian';
  curve: [number, number];
  min_max: [number, number];
}

export interface BrushSpec {
  type: 'custom';
  weight: number;
  scatter: number;
  opacity: number;
  spacing: number;
  noise: number;
  pressure: GaussianPressure;
  rotate: 'none' | 'natural' | 'random';
  markerTip: boolean;
}

export type PressureMode = 'gaussian' | 'both' | 'stylus';
export type Tool = 'brush' | 'eraser';
export type PaperName = 'hotpress' | 'washi' | 'bristol';

export interface Point { x: number; y: number; p: number }

export interface BrushRecord {
  tool: 'brush';
  spec: BrushSpec;
  tipSource: string;
  size: number;
  color: string;
  pressureMode: PressureMode;
  sensitivity: number;
  seed: number;
  points: Point[];
}

export interface EraserRecord {
  tool: 'eraser';
  size: number;
  points: Point[];
}

/** Clears the paper. Kept in the history so Clear is undoable like any stroke. */
export interface ClearRecord { tool: 'clear' }

export type StrokeRecord = BrushRecord | EraserRecord | ClearRecord;

/** Records that are currently visible: everything after the last clear. */
export function visibleRecords<T extends { tool: string }>(records: T[]): T[] {
  for (let i = records.length - 1; i >= 0; i--) if (records[i].tool === 'clear') return records.slice(i + 1);
  return records;
}

// ---------------------------------------------------------------------------
// Persistence (localStorage): compact, versioned, validated on load
// ---------------------------------------------------------------------------
export const SAVE_VERSION = 1;

type SavedRecord =
  | { t: 'b'; spec: BrushSpec; tip: string; size: number; color: string; pm: PressureMode; sens: number; seed: number; pts: number[] }
  | { t: 'e'; size: number; pts: number[] }
  | { t: 'c' };

const packPoints = (pts: Point[]) => pts.flatMap((p) => [p.x, p.y, p.p]);
const unpackPoints = (a: number[]): Point[] => {
  const out: Point[] = [];
  for (let i = 0; i + 2 < a.length; i += 3) out.push({ x: a[i], y: a[i + 1], p: a[i + 2] });
  return out;
};

export function serializeRecords(records: StrokeRecord[]): SavedRecord[] {
  return records.map((r): SavedRecord => {
    if (r.tool === 'clear') return { t: 'c' };
    if (r.tool === 'eraser') return { t: 'e', size: r.size, pts: packPoints(r.points) };
    return { t: 'b', spec: r.spec, tip: r.tipSource, size: r.size, color: r.color, pm: r.pressureMode, sens: r.sensitivity, seed: r.seed, pts: packPoints(r.points) };
  });
}

export function deserializeRecords(saved: unknown): StrokeRecord[] {
  if (!Array.isArray(saved)) return [];
  const out: StrokeRecord[] = [];
  for (const r of saved as SavedRecord[]) {
    if (!r || typeof r !== 'object') continue;
    if (r.t === 'c') { out.push({ tool: 'clear' }); continue; }
    if (!Array.isArray(r.pts) || r.pts.length < 3) continue;
    const points = unpackPoints(r.pts);
    if (r.t === 'e') { out.push({ tool: 'eraser', size: +r.size || 24, points }); continue; }
    if (r.t === 'b' && r.spec && typeof r.tip === 'string') {
      out.push({ tool: 'brush', spec: r.spec, tipSource: r.tip, size: +r.size || 1, color: r.color || '#1a1c23', pressureMode: r.pm || 'gaussian', sensitivity: +r.sens || 1.25, seed: r.seed | 0, points });
    }
  }
  return out;
}

/** The user's brush specification — passed to brush.add() verbatim. */
export const DEFAULT_TIP_SOURCE =
`_m.fill(0, 150);
_m.rotate(45);
_m.rect(-10, -10, 25, 25);
_m.rect(10, 10, 15, 15);`;

export const DEFAULT_SPEC: BrushSpec = {
  type: 'custom',
  weight: 29,
  scatter: 0.45,
  opacity: 6,
  spacing: 0.4,
  noise: 1,
  pressure: { mode: 'gaussian', curve: [0.36, 0.25], min_max: [0.48, 1.06] },
  rotate: 'none',
  markerTip: true,
};

export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(3)));

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * Uniform arc-length resampling. Segment boundaries then align with p5.brush's
 * stamping step (segLen is a multiple of spacing), avoiding integration drift.
 */
export function resamplePath(points: Point[], segLen: number): Point[] {
  const out: Point[] = [{ x: points[0].x, y: points[0].y, p: points[0].p }];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    let d = segLen - carry;
    while (d <= len) {
      const t = d / len;
      out.push({ x: a.x + dx * t, y: a.y + dy * t, p: a.p + (b.p - a.p) * t });
      d += segLen;
    }
    carry = len - (d - segLen);
  }
  const last = points[points.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > segLen * 0.35) out.push({ x: last.x, y: last.y, p: last.p });
  // A tap still needs a plot with length: make it a tiny dash.
  if (out.length < 2) out.push({ x: out[0].x + segLen, y: out[0].y, p: out[0].p });
  return out;
}

export const segmentLengthFor = (spacing: number) => spacing * Math.max(1, Math.round(2 / spacing));

/** Mouse/touch report 0.5 → 1.0. Pen force curves around that neutral point. */
export const mapStylus = (p: number, sensitivity: number) =>
  clamp(Math.pow(Math.max(p, 0.02) / 0.5, 0.75 * sensitivity), 0.3, 1.6);

export interface Segment { a: number; len: number; p: number }
export interface StrokeGeometry {
  origin: Point;
  segs: Segment[];
  endA: number;
  endP: number;
  stamps: number;
}

/** Segments (angle in degrees, p5.brush convention) for a brush record. */
export function strokeSegments(rec: BrushRecord): StrokeGeometry {
  const pts = resamplePath(rec.points, segmentLengthFor(rec.spec.spacing));
  const pf = rec.pressureMode === 'gaussian' ? () => 1 : (pt: Point) => mapStylus(pt.p, rec.sensitivity);
  const segs: Segment[] = [];
  let a = 0, stamps = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    a = ((Math.atan2(-dy, dx) * 180) / Math.PI + 360) % 360;
    segs.push({ a, len, p: pf(pts[i - 1]) });
    stamps += len / rec.spec.spacing;
  }
  return { origin: pts[0], segs, endA: a, endP: pf(pts[pts.length - 1]), stamps: Math.round(stamps) };
}

// ---------------------------------------------------------------------------
// brush.add(...) code generation / parsing
// ---------------------------------------------------------------------------

export function specCode(spec: BrushSpec, tipSource: string, name = 'myBrush'): string {
  const p = spec.pressure;
  const tip = tipSource.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => '      ' + l).join('\n');
  return `brush.add("${name}", {
  type:    "custom",
  weight:  ${fmt(spec.weight)},
  scatter: ${fmt(spec.scatter)},
  opacity: ${fmt(spec.opacity)},
  spacing: ${fmt(spec.spacing)},
  noise:   ${fmt(spec.noise)},
  pressure: { mode: "gaussian", curve: [${fmt(p.curve[0])}, ${fmt(p.curve[1])}], min_max: [${fmt(p.min_max[0])}, ${fmt(p.min_max[1])}] },
  rotate:  "${spec.rotate}",
  markerTip: ${spec.markerTip},
  tip: (_m) => {
${tip}
  },
});`;
}

export interface ParsedSpec { spec: BrushSpec; tipSource: string; name: string }

/** Parses a `brush.add("name", { ... })` snippet such as the Brush Maker emits. */
export function parseSpecCode(text: string): ParsedSpec {
  const m = /brush\.add\s*\(\s*(["'`])([^"'`]*)\1\s*,\s*(\{[\s\S]*\})\s*\)\s*;?\s*$/.exec(text.trim());
  if (!m) throw new Error('Expected brush.add("name", { ... })');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-explicit-any
  const cfg = new Function(`"use strict"; return (${m[3]});`)() as Record<string, any>;
  if (cfg.type && cfg.type !== 'custom') throw new Error('Only type: "custom" brushes are supported here');
  if (typeof cfg.tip !== 'function') throw new Error('Missing tip: (_m) => { ... }');
  const bodyMatch = /^[^{]*\{([\s\S]*)\}\s*$/.exec(String(cfg.tip));
  const tipSource = (bodyMatch ? bodyMatch[1] : '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
  const spec = clone(DEFAULT_SPEC);
  for (const k of ['weight', 'scatter', 'opacity', 'spacing', 'noise'] as const) if (typeof cfg[k] === 'number') spec[k] = cfg[k];
  if (cfg.vibration !== undefined && cfg.scatter === undefined) spec.scatter = cfg.vibration;
  if (cfg.rotate) spec.rotate = cfg.rotate;
  if (cfg.markerTip !== undefined) spec.markerTip = !!cfg.markerTip;
  const pr = cfg.pressure;
  if (pr && !Array.isArray(pr) && typeof pr === 'object' && Array.isArray(pr.curve) && Array.isArray(pr.min_max)) {
    spec.pressure = { mode: 'gaussian', curve: [+pr.curve[0], +pr.curve[1]], min_max: [+pr.min_max[0], +pr.min_max[1]] };
  } else if (Array.isArray(pr)) {
    // Simple [start, end] / [start, mid, end] ramps: approximate with a gaussian envelope.
    spec.pressure = { mode: 'gaussian', curve: [0.2, 0.25], min_max: [Math.min(...pr), Math.max(...pr)] };
  }
  checkTip(tipSource);
  return { spec, tipSource, name: m[2] };
}
