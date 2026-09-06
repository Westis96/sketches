/**
 * Brush specs, stroke records and the path → segment geometry shared by the
 * renderer and the p5 sketch export.
 */
import { checkTip } from './tipShim';
import { lerpAngle, nibAngle, tiltFactors, type PencilFx } from './pencil';
import { DEFAULT_FILTERS, Kalman1D, KalmanCV, parseFilters, type FilterParams } from './filters';

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

/** A path point; `alt`/`az`/`tw` (whole degrees) are present on pen samples: altitude, azimuth, barrel twist. */
export interface Point { x: number; y: number; p: number; alt?: number; az?: number; tw?: number }

/** Copies a point's extra fields (tilt) onto a new position. */
const at = (src: Point, x: number, y: number, p: number): Point => {
  const out: Point = { x, y, p };
  if (src.alt !== undefined) { out.alt = src.alt; out.az = src.az; out.tw = src.tw; }
  return out;
};

/** Linear interpolation between two points (angles along the shortest arc), at a given position. */
const between = (a: Point, b: Point, t: number, x: number, y: number, p: number): Point => {
  const out: Point = { x, y, p };
  if (a.alt !== undefined && b.alt !== undefined) {
    out.alt = Math.round(a.alt + (b.alt - a.alt) * t);
    out.az = Math.round(lerpAngle(a.az ?? 0, b.az ?? 0, t));
    out.tw = Math.round(lerpAngle(a.tw ?? 0, b.tw ?? 0, t));
  } else if (a.alt !== undefined || b.alt !== undefined) {
    const src = a.alt !== undefined ? a : b;
    out.alt = src.alt; out.az = src.az; out.tw = src.tw;
  }
  return out;
};

/** Which device produced a stroke. Decides whether pressure is real or simulated. */
export type InputKind = 'pen' | 'touch' | 'mouse';

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
  /** Absent on records saved before input conditioning existed; those replay as-is. */
  input?: InputKind;
  /**
   * Raw point counts at which the live preview stamped each chunk (the last entry
   * is the full count). Present on strokes drawn by hand: replays stamp the same
   * chunks with the same seeds, so what was on screen at lift is exactly what
   * every later render shows. Absent on programmatic strokes, rendered in one go.
   */
  chunks?: number[];
  /** View zoom the stroke was drawn at (informational). */
  zoom?: number;
  /** Pencil effects the stroke was drawn with (tilt shading, nib, roll); absent = plain. */
  fx?: PencilFx;
  /** Barrel twist at pen-down, set on chunk records so the roll baseline is the stroke's, not the chunk's. Not saved. */
  rollFrom?: number;
  /** Input filter parameters the stroke was conditioned with; absent = the legacy defaults. */
  filt?: FilterParams;
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
  | { t: 'b'; spec: BrushSpec; tip: string; size: number; color: string; pm: PressureMode; sens: number; seed: number; pts: number[]; in?: InputKind; ch?: number[]; z?: number; tl?: number[]; fx?: PencilFx; fl?: FilterParams }
  | { t: 'e'; size: number; pts: number[] }
  | { t: 'c' };

const packPoints = (pts: Point[]) => pts.flatMap((p) => [p.x, p.y, p.p]);
/** Tilt triples (altitude, azimuth, twist) per point, or undefined when no point carries tilt. */
const packTilt = (pts: Point[]) => (pts.some((p) => p.alt !== undefined) ? pts.flatMap((p) => [p.alt ?? 90, p.az ?? 0, p.tw ?? 0]) : undefined);
const unpackPoints = (a: number[], tilt?: number[]): Point[] => {
  const out: Point[] = [];
  for (let i = 0; i + 2 < a.length; i += 3) out.push({ x: a[i], y: a[i + 1], p: a[i + 2] });
  if (tilt && tilt.length === out.length * 3) out.forEach((p, i) => { p.alt = tilt[i * 3]; p.az = tilt[i * 3 + 1]; p.tw = tilt[i * 3 + 2]; });
  return out;
};
const isFx = (fx: unknown): fx is PencilFx => {
  const f = fx as PencilFx;
  return !!f && typeof f === 'object' && typeof f.tiltWidth === 'number' && typeof f.tiltFade === 'number' && (f.nib === 'stroke' || f.nib === 'azimuth') && typeof f.roll === 'boolean';
};

export function serializeRecords(records: StrokeRecord[]): SavedRecord[] {
  return records.map((r): SavedRecord => {
    if (r.tool === 'clear') return { t: 'c' };
    if (r.tool === 'eraser') return { t: 'e', size: r.size, pts: packPoints(r.points) };
    const saved: SavedRecord = { t: 'b', spec: r.spec, tip: r.tipSource, size: r.size, color: r.color, pm: r.pressureMode, sens: r.sensitivity, seed: r.seed, pts: packPoints(r.points) };
    if (r.input) saved.in = r.input;
    if (r.chunks) saved.ch = r.chunks;
    if (r.zoom !== undefined) saved.z = r.zoom;
    const tl = packTilt(r.points);
    if (tl) saved.tl = tl;
    if (r.fx) saved.fx = r.fx;
    if (r.filt) saved.fl = r.filt;
    return saved;
  });
}

export function deserializeRecords(saved: unknown): StrokeRecord[] {
  if (!Array.isArray(saved)) return [];
  const out: StrokeRecord[] = [];
  for (const r of saved as SavedRecord[]) {
    if (!r || typeof r !== 'object') continue;
    if (r.t === 'c') { out.push({ tool: 'clear' }); continue; }
    if (!Array.isArray(r.pts) || r.pts.length < 3) continue;
    const points = unpackPoints(r.pts, r.t === 'b' && Array.isArray(r.tl) ? r.tl : undefined);
    if (r.t === 'e') { out.push({ tool: 'eraser', size: +r.size || 24, points }); continue; }
    if (r.t === 'b' && r.spec && typeof r.tip === 'string') {
      const rec: BrushRecord = { tool: 'brush', spec: r.spec, tipSource: r.tip, size: +r.size || 1, color: r.color || '#1a1c23', pressureMode: r.pm || 'gaussian', sensitivity: +r.sens || 1.25, seed: r.seed | 0, points };
      if (r.in === 'pen' || r.in === 'touch' || r.in === 'mouse') rec.input = r.in;
      if (Array.isArray(r.ch) && r.ch.every((n) => Number.isInteger(n) && n > 0 && n <= points.length)) rec.chunks = r.ch;
      if (typeof r.z === 'number' && r.z > 0) rec.zoom = r.z;
      if (isFx(r.fx)) rec.fx = r.fx;
      const fl = parseFilters(r.fl);
      if (fl) rec.filt = fl;
      out.push(rec);
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
  points = smoothPath(points);
  const out: Point[] = [{ ...points[0] }];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    let d = segLen - carry;
    while (d <= len) {
      const t = d / len;
      out.push(between(a, b, t, a.x + dx * t, a.y + dy * t, a.p + (b.p - a.p) * t));
      d += segLen;
    }
    carry = len - (d - segLen);
  }
  const last = points[points.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > segLen * 0.35) out.push({ ...last });
  // A tap still needs a plot with length: make it a tiny dash.
  if (out.length < 2) out.push({ ...out[0], x: out[0].x + segLen });
  return out;
}

/**
 * Replaces the straight segments between input points by a centripetal
 * Catmull-Rom curve through them (four samples per segment). A tip swept along
 * straight segments shows a facet at every direction change, which a chisel or
 * any wide tip makes visible as a stepped edge; the curve turns gradually.
 * Endpoints are clamped, so the curve still passes through every input point.
 */
export function smoothPath(points: Point[]): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [points[0]];
  const SUB = 4;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    // centripetal parameterisation (alpha = 0.5): no cusps or overshoot on uneven spacing
    // (coincident points get a tiny non-zero interval so the divisions stay finite)
    const t0 = 0;
    const t1 = t0 + (Math.sqrt(Math.hypot(p1.x - p0.x, p1.y - p0.y)) || 1e-4);
    const t2 = t1 + (Math.sqrt(Math.hypot(p2.x - p1.x, p2.y - p1.y)) || 1e-4);
    const t3 = t2 + (Math.sqrt(Math.hypot(p3.x - p2.x, p3.y - p2.y)) || 1e-4);
    for (let k = 1; k <= SUB; k++) {
      const t = t1 + ((t2 - t1) * k) / SUB;
      const c = (a: Point, b: Point, ta: number, tb: number, key: 'x' | 'y') => ((tb - t) * a[key] + (t - ta) * b[key]) / (tb - ta);
      const a1x = c(p0, p1, t0, t1, 'x'), a1y = c(p0, p1, t0, t1, 'y');
      const a2x = c(p1, p2, t1, t2, 'x'), a2y = c(p1, p2, t1, t2, 'y');
      const a3x = c(p2, p3, t2, t3, 'x'), a3y = c(p2, p3, t2, t3, 'y');
      const b1x = ((t2 - t) * a1x + (t - t0) * a2x) / (t2 - t0), b1y = ((t2 - t) * a1y + (t - t0) * a2y) / (t2 - t0);
      const b2x = ((t3 - t) * a2x + (t - t1) * a3x) / (t3 - t1), b2y = ((t3 - t) * a2y + (t - t1) * a3y) / (t3 - t1);
      const x = ((t2 - t) * b1x + (t - t1) * b2x) / (t2 - t1), y = ((t2 - t) * b1y + (t - t1) * b2y) / (t2 - t1);
      const u = k / SUB;
      out.push(between(p1, p2, u, k === SUB ? p2.x : x, k === SUB ? p2.y : y, p1.p + (p2.p - p1.p) * u));
    }
  }
  return out;
}

export const segmentLengthFor = (spacing: number) => spacing * Math.max(1, Math.round(2 / spacing));

/** Mouse/touch report 0.5 → 1.0. Pen force curves around that neutral point. */
export const mapStylus = (p: number, sensitivity: number) =>
  clamp(Math.pow(Math.max(p, 0.02) / 0.5, 0.75 * sensitivity), 0.3, 1.6);

/** `alpha`, `keep` (share of stamps drawn) and `angle` are per-stamp overrides from the pencil effects (see pencil.ts); absent = engine default. */
export interface Segment { a: number; len: number; p: number; alpha?: number; keep?: number; angle?: number }
export interface StrokeGeometry {
  origin: Point;
  segs: Segment[];
  endA: number;
  endP: number;
  stamps: number;
}

// ---------------------------------------------------------------------------
// Input conditioning (after tldraw's freehand pipeline)
// ---------------------------------------------------------------------------

/** How fast simulated / smoothed pressure follows its target. */
const RATE_OF_PRESSURE_CHANGE = 0.275;

/** The stroke width the conditioning works in: roughly the visible mark, in world units. */
export const strokeWidthFor = (rec: BrushRecord) => clamp(rec.spec.weight * rec.size * 0.5, 4, 40);

/**
 * Conditions raw pointer points before geometry, the way tldraw does:
 *  - drops the first few samples while the stroke has travelled less than one
 *    stroke width, which removes the hook a fast pen-down leaves;
 *  - without a pressure-sensitive device, simulates pressure from velocity
 *    (slow = heavy, fast = light) so finger and mouse strokes get dynamics;
 *  - with a pen, keeps the device pressure and only takes the edge off single
 *    samples (a short moving average), so the mark tracks the pencil at once;
 *    p5.brush's own pressure envelope already shapes the start of a stroke.
 * Records without an `input` field predate this and are returned untouched.
 */
export function conditionPoints(rec: BrushRecord, final = false): Point[] {
  const out = conditionPressure(rec);
  if (!rec.input || out.length < 3) return out;
  const f = (rec.filt ?? DEFAULT_FILTERS).position;
  if (f.mode === 'off') return out;
  // Causal position smoothing (prefix-stable, so chunk replays match). Streamline:
  // each point moves part of the way from the previous smoothed point toward its
  // sample, which takes the sub-pixel jitter out of the path at the cost of a
  // short lag. Kalman: a constant-velocity model per axis, which follows a steady
  // hand with less lag and still averages out the jitter (see filters.ts).
  // On lift the last point is the raw sample, so the stroke ends under the pen.
  const smoothed: Point[] = [out[0]];
  if (f.mode === 'kalman') {
    const kx = new KalmanCV(f.q, f.r), ky = new KalmanCV(f.q, f.r);
    kx.update(out[0].x); ky.update(out[0].y);
    for (let i = 1; i < out.length; i++) smoothed.push(at(out[i], Math.round(kx.update(out[i].x) * 100) / 100, Math.round(ky.update(out[i].y) * 100) / 100, out[i].p));
  } else {
    let sx = out[0].x, sy = out[0].y;
    for (let i = 1; i < out.length; i++) {
      sx += (out[i].x - sx) * f.streamline;
      sy += (out[i].y - sy) * f.streamline;
      smoothed.push(at(out[i], Math.round(sx * 100) / 100, Math.round(sy * 100) / 100, out[i].p));
    }
  }
  if (final) smoothed[smoothed.length - 1] = { ...out[out.length - 1] };
  return smoothed;
}

/** Kalman filters on altitude, azimuth and twist, in place on freshly built points. */
function filterTilt(out: Point[], filt: FilterParams | undefined) {
  if (!filt || out.length < 2 || out[0].alt === undefined) return;
  if (filt.tilt.mode === 'kalman') {
    const ka = new Kalman1D(filt.tilt.q, filt.tilt.r), kz = new Kalman1D(filt.tilt.q, filt.tilt.r);
    for (const p of out) {
      if (p.alt === undefined) continue;
      p.alt = clamp(Math.round(ka.update(p.alt)), 0, 90);
      p.az = Math.round(kz.updateAngle(p.az ?? 0)) % 360;
    }
  }
  if (filt.twist.mode === 'kalman') {
    const kt = new Kalman1D(filt.twist.q, filt.twist.r);
    for (const p of out) if (p.alt !== undefined) p.tw = Math.round(kt.updateAngle(p.tw ?? 0)) % 360;
  }
}

function conditionPressure(rec: BrushRecord): Point[] {
  const raw = rec.points;
  if (!rec.input || raw.length < 2) return raw;
  const size = strokeWidthFor(rec);
  const simulate = rec.input !== 'pen';

  // Pass 1: early jitter. Never drop the last point.
  const pts: Point[] = [raw[0]];
  let run = 0;
  for (let i = 1; i < raw.length; i++) {
    const prev = pts[pts.length - 1];
    const d = Math.hypot(raw[i].x - prev.x, raw[i].y - prev.y);
    if (i < 4 && i < raw.length - 1 && run + d < size) continue;
    run += d;
    pts.push(raw[i]);
  }
  if (pts.length < 2) return pts;

  const out: Point[] = new Array(pts.length);
  const pf = (rec.filt ?? DEFAULT_FILTERS).pressure;
  if (!simulate) {
    // Pen: the device pressure is the truth. A pen-down sample often carries no
    // pressure yet, so the first point borrows from the next; after that either a
    // half-weight running average removes single-sample spikes without lag, or a
    // random-walk Kalman filter does (its gain is set by q and r), or nothing.
    let prev = pts[0].p < 0.1 ? pts[1].p * 0.6 : (pts[0].p + pts[1].p) / 2;
    const k = pf.mode === 'kalman' ? new Kalman1D(pf.q, pf.r) : null;
    if (k) k.update(prev);
    for (let i = 0; i < pts.length; i++) {
      const z = pts[i].p;
      const p = i === 0 ? prev : k ? k.update(z) : pf.mode === 'off' ? z : prev + (z - prev) * 0.5;
      prev = p;
      out[i] = at(pts[i], pts[i].x, pts[i].y, Math.round(p * 1000) / 1000);
    }
    filterTilt(out, rec.filt);
    return out;
  }

  const dists = pts.map((p, i) => (i === 0 ? 0 : Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)));

  // Pass 2: seed the simulated follower from the first stroke widths so the start is not a blob.
  let prev = 0.5;
  let running = 0;
  for (let i = 0; i < pts.length; i++) {
    if (running > size * 5) break;
    const sp = Math.min(1, dists[i] / size);
    const target = Math.min(1, 1 - sp);
    const p = Math.min(1, prev + (target - prev) * (sp * RATE_OF_PRESSURE_CHANGE));
    prev = prev + (p - prev) * 0.5;
    running += dists[i];
  }

  // Pass 3: simulated pressure per point, slow = heavy, fast = light. A Kalman
  // pressure filter smooths the simulated value too.
  const k = pf.mode === 'kalman' ? new Kalman1D(pf.q, pf.r) : null;
  for (let i = 0; i < pts.length; i++) {
    const sp = Math.min(1, dists[i] / size);
    const target = Math.min(1, 1 - sp);
    const p = i === 0 ? prev : Math.min(1, prev + (target - prev) * (sp * RATE_OF_PRESSURE_CHANGE));
    prev = p;
    // Tempered to tldraw's effective range so it maps to a moderate size swing
    // through mapStylus (0.5 → ×1).
    const v = 0.25 + 0.5 * p;
    out[i] = at(pts[i], pts[i].x, pts[i].y, k ? Math.round(k.update(v) * 1000) / 1000 : v);
  }
  filterTilt(out, rec.filt);
  return out;
}

// ---------------------------------------------------------------------------
// Live chunks: strokes drawn by hand are stamped piece by piece as they arrive
// ---------------------------------------------------------------------------

/** Raw samples needed before the first chunk: conditioning's early decisions are final by then. */
export const CHUNK_MIN_RAW = 6;

/**
 * Points of the chunk that covers raw samples up to `upto` (exclusive), given
 * the conditioned length reached by the previous chunk. Conditioning runs on
 * the frozen prefix only, so a replay computes exactly what the live stroke
 * did. Chunks overlap by one point so stamping is continuous.
 */
export function chunkPoints(rec: BrushRecord, upto: number, prevCondLen: number, final = false): { pts: Point[]; condLen: number } | null {
  const prefix = rec.points.slice(0, upto);
  if (prefix.length === 0) return null;
  const cond = conditionPoints({ ...rec, points: prefix }, final);
  const start = prevCondLen === 0 ? 0 : prevCondLen - 1;
  const pts = cond.slice(start);
  if (pts.length < (final ? 1 : 2)) return null;
  return { pts, condLen: cond.length };
}

/** Engine params for a chunk: nothing that is per-stroke, so chunks join without seams. */
export const chunkSpec = (spec: BrushSpec): BrushSpec =>
  ({ ...spec, noise: 0, markerTip: false, pressure: { mode: 'gaussian', curve: [0, 0], min_max: [1, 1] } });

/**
 * Pressure envelope for chunked strokes, a function of the distance from the
 * stroke's start only (p5.brush's own envelope is relative to the finished
 * length, which is unknown while drawing). Same curve family with its expected
 * random parameters: the mark rises over its first stretch, then holds.
 */
export function liveEnvelope(pressure: BrushSpec['pressure']): (s: number) => number {
  const [min, max] = pressure.min_max;
  if (min === max) return () => min;
  const a = 0.5, b = 1 - pressure.curve[1] * 1.25, c = 3.25, REF = 300;
  return (s: number) => {
    const L = Math.max(REF, s * 2);
    const peak = a * L;
    const hw = (s < peak ? b * 1.2 : b * 0.8) * (L / 2);
    const g = 1 / (1 + Math.pow(Math.abs((s - peak) / hw), 2 * c));
    return min + (max - min) * g;
  };
}

/** Segments (angle in degrees, p5.brush convention) for a brush record. */
export function strokeSegments(rec: BrushRecord): StrokeGeometry {
  const pts = resamplePath(conditionPoints(rec), segmentLengthFor(rec.spec.spacing));
  const base = rec.pressureMode === 'gaussian' ? () => 1 : (pt: Point) => mapStylus(pt.p, rec.sensitivity);
  const fx = rec.fx;
  // Tilt shading widens the stamps of a flat pencil: folded into the plot pressure.
  const pf = fx ? (pt: Point) => base(pt) * tiltFactors(pt.alt, fx, base(pt), rec.spec.opacity).widen : base;
  const tw0 = fx?.roll ? rec.rollFrom ?? rec.points[0].tw ?? 0 : 0;
  const segs: Segment[] = [];
  let a = 0, stamps = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    // Quantised to a thousandth of a degree, with 360 folded to 0: floating noise
    // on a flat run otherwise flickers between 0 and 359.999…, and the engine
    // drops a plot whose angles straddle the seam like that.
    a = Math.round((((Math.atan2(-dy, dx) * 180) / Math.PI + 360) % 360) * 1000) / 1000;
    if (a >= 360) a = 0;
    const seg: Segment = { a, len, p: pf(pts[i - 1]) };
    if (fx) {
      const pt = pts[i - 1];
      const { alpha, keep } = tiltFactors(pt.alt, fx, base(pt), rec.spec.opacity);
      if (alpha < 1) seg.alpha = alpha;
      if (keep < 1) seg.keep = keep;
      const angle = nibAngle(pt, a, rec.spec.rotate, fx, tw0);
      if (angle !== null) seg.angle = angle;
    }
    segs.push(seg);
    stamps += len / rec.spec.spacing;
  }
  return { origin: pts[0], segs, endA: a, endP: pf(pts[pts.length - 1]), stamps: Math.round(stamps) };
}

// ---------------------------------------------------------------------------
// Bounds (world units), used for viewport culling and zoom-to-fit
// ---------------------------------------------------------------------------
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

const boundsCache = new WeakMap<object, Bounds>();

/** Padded world-space bounds of a brush or eraser record; cached per record. */
export function recordBounds(rec: BrushRecord | EraserRecord): Bounds {
  const cached = boundsCache.get(rec);
  if (cached) return cached;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of rec.points) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  // Generous: full tip footprint at peak pressure plus scatter reach.
  const pad = rec.tool === 'eraser'
    ? rec.size / 2 + 2
    : rec.spec.weight * rec.size * Math.max(1, rec.spec.pressure.min_max[0], rec.spec.pressure.min_max[1]) * 1.5 + rec.spec.scatter * rec.size * 3 + 4;
  const b = { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  boundsCache.set(rec, b);
  return b;
}

export const boundsIntersect = (a: Bounds, b: Bounds) => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

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
