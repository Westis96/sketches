/**
 * Brush specs, stroke records and the path → segment geometry shared by the
 * renderer and the p5 sketch export.
 */
import { checkTip } from './tipShim';
import { lerpAngle, nibAngle, tiltFactors, type PencilFx } from './pencil';
import { LEGACY_FILTERS, Kalman1D, KalmanCV, parseFilters, type FilterParams } from './filters';

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
 * Running state of the conditioning pipeline. `conditionFrom` advances it over
 * new raw points; a fresh state fed all points is the batch result, and a
 * state carried across live chunks gives exactly the same output for the same
 * prefixes (every stage is causal once six raw points exist: the early-jitter
 * decisions are made by then, and the simulated-pressure seed recomputes from
 * scratch until it is final).
 */
export interface CondState {
  /** Raw points consumed. */
  n: number;
  /** Pass 1 (early jitter): travel through kept points, last kept raw point, kept count. */
  run: number;
  last: Point | null;
  kept: number;
  /** Pen: the first kept point waits for the second (its pressure borrows from it). */
  pending: Point | null;
  /** Pressure stage: running value and optional Kalman filter. */
  prev: number;
  k: Kalman1D | null;
  /** Simulated pressure: kept points buffered until the seed is final (travel > 5 widths). */
  buf: Point[];
  seeded: boolean;
  /** Tilt filters (altitude, azimuth, twist); applied only when the first point carried tilt. */
  tiltOn: boolean | null;
  ka: Kalman1D | null; kz: Kalman1D | null; kt: Kalman1D | null;
  /** Position stage. */
  sx: number; sy: number; kx: KalmanCV | null; ky: KalmanCV | null;
  /** Pressure-stage points (raw positions, filtered pressure and tilt) and the position-filtered output, index-aligned. */
  pre: Point[];
  out: Point[];
}

export const freshCondState = (): CondState => ({
  n: 0, run: 0, last: null, kept: 0, pending: null, prev: 0.5, k: null, buf: [], seeded: false,
  tiltOn: null, ka: null, kz: null, kt: null, sx: 0, sy: 0, kx: null, ky: null, pre: [], out: [],
});

/**
 * Advances the conditioning over raw points [state.n, upto), the way tldraw's
 * freehand pipeline does:
 *  - drops the first few samples while the stroke has travelled less than one
 *    stroke width, which removes the hook a fast pen-down leaves;
 *  - without a pressure-sensitive device, simulates pressure from velocity
 *    (slow = heavy, fast = light) so finger and mouse strokes get dynamics;
 *  - with a pen, keeps the device pressure and takes the edge off single
 *    samples (a running average or a Kalman filter, per `rec.filt`);
 *  - filters altitude, azimuth and twist when the record asks for it;
 *  - smooths the position (streamline or a constant-velocity Kalman filter).
 */
export function conditionFrom(rec: BrushRecord, st: CondState, upto: number): void {
  const raw = rec.points;
  const size = strokeWidthFor(rec);
  const simulate = rec.input !== 'pen';
  const filt = rec.filt;
  const pf = (filt ?? LEGACY_FILTERS).pressure;
  const pos = (filt ?? LEGACY_FILTERS).position;
  // The simulated seed depends on the first five stroke widths of travel: until
  // the prefix contains them, every call recomputes from the start.
  if (simulate && !st.seeded && st.n > 0) Object.assign(st, freshCondState());

  const emitPre = (pt: Point) => {
    // tilt filters
    st.tiltOn ??= pt.alt !== undefined;
    if (filt && st.tiltOn && pt.alt !== undefined) {
      if (filt.tilt.mode === 'kalman') {
        st.ka ??= new Kalman1D(filt.tilt.q, filt.tilt.r);
        st.kz ??= new Kalman1D(filt.tilt.q, filt.tilt.r);
        pt.alt = clamp(Math.round(st.ka.update(pt.alt)), 0, 90);
        pt.az = Math.round(st.kz.updateAngle(pt.az ?? 0)) % 360;
      }
      if (filt.twist.mode === 'kalman') {
        st.kt ??= new Kalman1D(filt.twist.q, filt.twist.r);
        pt.tw = Math.round(st.kt.updateAngle(pt.tw ?? 0)) % 360;
      }
    }
    st.pre.push(pt);
    // position stage
    if (st.pre.length === 1) {
      st.sx = pt.x; st.sy = pt.y;
      if (pos.mode === 'kalman') { st.kx = new KalmanCV(pos.q, pos.r); st.ky = new KalmanCV(pos.q, pos.r); st.kx.update(pt.x); st.ky.update(pt.y); }
      st.out.push(pt);
    } else if (pos.mode === 'kalman') {
      st.out.push(at(pt, Math.round(st.kx!.update(pt.x) * 100) / 100, Math.round(st.ky!.update(pt.y) * 100) / 100, pt.p));
    } else if (pos.mode === 'streamline') {
      st.sx += (pt.x - st.sx) * pos.streamline;
      st.sy += (pt.y - st.sy) * pos.streamline;
      st.out.push(at(pt, Math.round(st.sx * 100) / 100, Math.round(st.sy * 100) / 100, pt.p));
    } else {
      st.out.push(pt);
    }
  };

  const penStep = (pt: Point) => {
    const j = st.kept++;
    if (j === 0) { st.pending = pt; return; }
    if (j === 1) {
      const p0 = st.pending!;
      st.pending = null;
      // A pen-down sample often carries no pressure yet: the first point borrows from the next.
      st.prev = p0.p < 0.1 ? pt.p * 0.6 : (p0.p + pt.p) / 2;
      st.k = pf.mode === 'kalman' ? new Kalman1D(pf.q, pf.r) : null;
      st.k?.update(st.prev);
      emitPre(at(p0, p0.x, p0.y, Math.round(st.prev * 1000) / 1000));
    }
    const z = pt.p;
    const p = st.k ? st.k.update(z) : pf.mode === 'off' ? z : st.prev + (z - st.prev) * 0.5;
    st.prev = p;
    emitPre(at(pt, pt.x, pt.y, Math.round(p * 1000) / 1000));
  };

  // Simulated pressure, pass 3 for one kept point at distance d from the previous one.
  const simStep = (pt: Point, d: number, first: boolean) => {
    const sp = Math.min(1, d / size);
    const target = Math.min(1, 1 - sp);
    const p = first ? st.prev : Math.min(1, st.prev + (target - st.prev) * (sp * RATE_OF_PRESSURE_CHANGE));
    st.prev = p;
    // Tempered to tldraw's effective range so it maps to a moderate size swing through mapStylus (0.5 → ×1).
    const v = 0.25 + 0.5 * p;
    emitPre(at(pt, pt.x, pt.y, st.k ? Math.round(st.k.update(v) * 1000) / 1000 : v));
  };

  for (let i = st.n; i < upto; i++) {
    const pt = raw[i];
    let d = 0;
    if (i > 0) {
      d = Math.hypot(pt.x - st.last!.x, pt.y - st.last!.y);
      // Pass 1: early jitter. Never drop the last point.
      if (i < 4 && i < upto - 1 && st.run + d < size) continue;
      st.run += d;
    }
    st.last = pt;
    if (!simulate) penStep(pt);
    else if (st.seeded) simStep(pt, d, false);
    else { st.buf.push(pt); st.kept++; }
  }
  st.n = upto;

  if (simulate && !st.seeded && st.buf.length >= 2) {
    const pts = st.buf;
    const dists = pts.map((p, i) => (i === 0 ? 0 : Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)));
    // Pass 2: seed the simulated follower from the first stroke widths so the start is not a blob.
    let prev = 0.5, running = 0, final = false;
    for (let i = 0; i <= pts.length; i++) {
      if (running > size * 5) { final = true; break; }
      if (i === pts.length) break;
      const sp = Math.min(1, dists[i] / size);
      const target = Math.min(1, 1 - sp);
      const p = Math.min(1, prev + (target - prev) * (sp * RATE_OF_PRESSURE_CHANGE));
      prev = prev + (p - prev) * 0.5;
      running += dists[i];
    }
    st.prev = prev;
    st.k = pf.mode === 'kalman' ? new Kalman1D(pf.q, pf.r) : null;
    // Pass 3: simulated pressure per point, slow = heavy, fast = light.
    pts.forEach((p, i) => simStep(p, dists[i], i === 0));
    if (final) { st.seeded = true; st.buf = []; }
  }
}

/** Batch conditioning of `rec.points` (replays); see conditionFrom. */
export function conditionPoints(rec: BrushRecord, final = false): Point[] {
  return conditionedPrefix(rec, freshCondState(), rec.points.length, final);
}

/**
 * Output of the pipeline for the prefix [0, upto) after advancing `st` to it.
 * Records without an `input` predate conditioning and are returned untouched;
 * tiny prefixes keep the raw samples (there is nothing to smooth yet). On lift
 * (`final`) the last point is the raw sample, so the stroke ends under the pen.
 */
export function conditionedPrefix(rec: BrushRecord, st: CondState, upto: number, final: boolean): Point[] {
  if (!rec.input || upto < 2) return rec.points.slice(0, upto);
  conditionFrom(rec, st, upto);
  const kept = st.pending ? [st.pending] : rec.input !== 'pen' && !st.seeded && st.buf.length < 2 ? st.buf : null;
  if (kept) return kept;
  if (st.pre.length < 3) return st.pre.slice();
  const out = st.out.slice();
  if (final) out[out.length - 1] = { ...st.pre[st.pre.length - 1] };
  return out;
}

// ---------------------------------------------------------------------------
// Live chunks: strokes drawn by hand are stamped piece by piece as they arrive
// ---------------------------------------------------------------------------

/** Raw samples needed before the first chunk: conditioning's early decisions are final by then. */
export const CHUNK_MIN_RAW = 6;

/**
 * Points of the chunk that covers raw samples up to `upto` (exclusive), given
 * the conditioned length reached by the previous chunk. Replays condition each
 * prefix from scratch; the live stroke carries a CondState across chunks (see
 * chunkStep), which gives the same points. Chunks overlap by one point so
 * stamping is continuous.
 */
export function chunkPoints(rec: BrushRecord, upto: number, prevCondLen: number, final = false): { pts: Point[]; condLen: number } | null {
  if (upto === 0) return null;
  return chunkFrom(conditionPoints({ ...rec, points: rec.points.slice(0, upto) }, final), prevCondLen, final);
}

/** Live counterpart of chunkPoints: advances `st` instead of reconditioning the whole prefix. */
export function chunkStep(rec: BrushRecord, upto: number, prevCondLen: number, st: CondState, final = false): { pts: Point[]; condLen: number } | null {
  if (upto === 0) return null;
  // Below CHUNK_MIN_RAW the early-jitter decisions still depend on the prefix length: condition that prefix on its own.
  const cond = upto < CHUNK_MIN_RAW ? conditionPoints({ ...rec, points: rec.points.slice(0, upto) }, final) : conditionedPrefix(rec, st, upto, final);
  return chunkFrom(cond, prevCondLen, final);
}

function chunkFrom(cond: Point[], prevCondLen: number, final: boolean): { pts: Point[]; condLen: number } | null {
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
