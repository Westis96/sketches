/**
 * Scores a stroke against its reference on six dimensions and turns the result
 * into one instruction. Both paths are resampled by arc length; distances are
 * relative to a tolerance derived from the brush width, so thick brushes are
 * forgiving and fine liners are not.
 *
 *   shape       coverage (reference → stroke) and precision (stroke → reference)
 *   length      stroke length over reference length
 *   direction   drawn from the start dot, not from the end
 *   pressure    the *profile* of pressure along the stroke vs the reference's
 *   speed       mean speed against the step's target (needs timestamps)
 *   confidence  one pull: no stalls, no reversals, low jitter (needs timestamps)
 *
 * A dimension that cannot be measured (a finger has no pressure, a synthetic
 * stroke has no time) is `na` and drops out of the mean. Feedback follows the
 * bandwidth rule: a dimension only speaks when it is outside its band.
 */
import type { Point } from '@/engine/records';
import { pathLength, resampleN } from './geometry';

export type Dim = 'shape' | 'length' | 'direction' | 'pressure' | 'speed' | 'confidence';
export const DIMS: Dim[] = ['shape', 'length', 'direction', 'pressure', 'speed', 'confidence'];
export const DIM_NAME: Record<Dim, string> = { shape: 'Shape', length: 'Length', direction: 'Direction', pressure: 'Pressure', speed: 'Speed', confidence: 'Confidence' };
export type Band = 'ok' | 'low' | 'high' | 'na';
/** What the stroke is being scored for: the weights and the band width follow. */
export type ScoreMode = 'warmup' | 'trainer' | 'guided' | 'perform' | 'seeing';

export interface Tip { dim: Dim; text: string }

export interface StrokeScore {
  /** 0–100. */
  score: number;
  /** Per dimension, 0–1; NaN when not measured. */
  dims: Record<Dim, number>;
  band: Record<Dim, Band>;
  /** One instruction, or null when everything is in band. */
  tip: Tip | null;
  /** True when the stroke was drawn from the reference's end to its start. */
  reversed: boolean;
  /** Mean distance from the reference to the user's stroke, in world units. */
  coverage: number;
  /** Mean distance from the user's stroke to the reference. */
  precision: number;
  /** user length / reference length. */
  lengthRatio: number;
  /** Mean speed in world units per ms, or NaN without timestamps. */
  speed: number;
}

export interface ScoreOptions {
  /** World units; full marks inside it, nothing beyond about 3.5 of them. */
  tolerance: number;
  mode?: ScoreMode;
  /** Target speed in world units per ms; the step or trainer sets it. */
  targetSpeed?: number;
  /** False for fingers and mice, whose pressure is simulated. */
  hasPressure?: boolean;
  /** Weight the mode's focus dimension at 0.5 (trainers and the warm-up). */
  focus?: Dim;
}

const N = 48;
export const DEFAULT_SPEED = 0.45; // world units per ms: an unhurried pull across the box in ~1.8 s

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function meanNearest(from: Point[], to: Point[]): number {
  let sum = 0;
  for (const a of from) {
    let best = Infinity;
    for (const b of to) {
      const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
      if (d < best) best = d;
    }
    sum += Math.sqrt(best);
  }
  return sum / from.length;
}

/** Base weights per mode; `focus` lifts one dimension to half the total. */
const WEIGHTS: Record<ScoreMode, Record<Dim, number>> = {
  warmup:  { shape: 1, length: 0.5, direction: 0.5, pressure: 0.5, speed: 1, confidence: 2 },
  trainer: { shape: 1.5, length: 0.5, direction: 0.5, pressure: 1, speed: 1, confidence: 1 },
  guided:  { shape: 3, length: 0.5, direction: 0.5, pressure: 1, speed: 0.5, confidence: 0.5 },
  perform: { shape: 1, length: 1, direction: 1, pressure: 1, speed: 1, confidence: 1 },
  seeing:  { shape: 1, length: 0.3, direction: 0, pressure: 0, speed: 0, confidence: 0.3 },
};

/** Out-of-band threshold per dimension: below this the pill speaks. */
const BAND_FLOOR: Record<Dim, number> = { shape: 0.62, length: 0.75, direction: 0.5, pressure: 0.6, speed: 0.55, confidence: 0.6 };

export function scoreStroke(user: Point[], ref: Point[], opts: ScoreOptions): StrokeScore {
  const { tolerance } = opts;
  const mode = opts.mode ?? 'guided';
  const u = resampleN(user, N), r = resampleN(ref, N);
  const coverage = meanNearest(r, u);
  const precision = meanNearest(u, r);
  const lu = pathLength(user), lr = pathLength(ref);
  const lengthRatio = lr > 0 ? lu / lr : 1;

  // --- shape
  const dist = coverage * 0.6 + precision * 0.4;
  const shape = clamp01(1 - Math.max(0, dist - tolerance * 0.5) / (tolerance * 3));

  // --- length: 1 at a match, 0 at half or double
  const ratio = Math.min(lengthRatio, 1 / Math.max(lengthRatio, 1e-6));
  const length = clamp01((ratio - 0.5) / 0.5);

  // --- direction
  const dStart = Math.hypot(u[0].x - r[0].x, u[0].y - r[0].y);
  const dStartRev = Math.hypot(u[0].x - r[N - 1].x, u[0].y - r[N - 1].y);
  const dEnd = Math.hypot(u[N - 1].x - r[N - 1].x, u[N - 1].y - r[N - 1].y);
  const dEndRev = Math.hypot(u[N - 1].x - r[0].x, u[N - 1].y - r[0].y);
  const closed = Math.hypot(r[0].x - r[N - 1].x, r[0].y - r[N - 1].y) < tolerance;
  const reversed = !closed && dStartRev + dEndRev < dStart + dEnd;
  const direction = reversed ? 0 : 1;

  // --- pressure: compare the shape of the profile, not the absolute level (devices differ)
  let pressure = NaN, pressureWhere: 'start' | 'middle' | 'end' = 'middle', pressureSign = 0;
  if (opts.hasPressure !== false && ref.some((q) => q.p > 0)) {
    const norm = (pts: Point[]) => {
      const m = pts.reduce((a, q) => a + q.p, 0) / pts.length || 1;
      return pts.map((q) => q.p / m);
    };
    const pu = norm(u), pr = norm(r);
    const diff = pu.map((v, i) => v - pr[i]);
    const mad = diff.reduce((a, v) => a + Math.abs(v), 0) / N;
    pressure = clamp01(1 - mad / 0.55);
    // Where is it worst? Thirds, signed: positive means the user pressed harder than the reference.
    const third = Math.floor(N / 3);
    const sums = [0, 1, 2].map((k) => diff.slice(k * third, k === 2 ? N : (k + 1) * third).reduce((a, v) => a + v, 0) / third);
    let worst = 0;
    for (let k = 1; k < 3; k++) if (Math.abs(sums[k]) > Math.abs(sums[worst])) worst = k;
    pressureWhere = (['start', 'middle', 'end'] as const)[worst];
    pressureSign = Math.sign(sums[worst]);
  }

  // --- speed and confidence need timestamps
  let speed = NaN, speedScore = NaN, confidence = NaN;
  const times = user.map((q) => q.t);
  const timed = user.length >= 3 && times.every((t) => typeof t === 'number') && (times[times.length - 1] as number) > (times[0] as number);
  if (timed) {
    const dur = (times[times.length - 1] as number) - (times[0] as number);
    speed = lu / dur;
    const target = opts.targetSpeed ?? DEFAULT_SPEED;
    // 1 at the target, 0 at a third or three times of it (log scale, symmetric)
    speedScore = clamp01(1 - Math.abs(Math.log(speed / target)) / Math.log(3));
    confidence = confidenceOf(user, tolerance, speed);
  } else {
    // Without time, confidence is jitter and reversals only.
    confidence = user.length >= 6 ? confidenceOf(user, tolerance, NaN) : NaN;
  }

  const dims: Record<Dim, number> = { shape, length, direction, pressure, speed: speedScore, confidence };
  const w = { ...WEIGHTS[mode] };
  if (opts.focus) {
    const rest = DIMS.filter((d) => d !== opts.focus).reduce((a, d) => a + w[d], 0);
    w[opts.focus] = rest; // exactly half the total
  }
  let num = 0, den = 0;
  for (const d of DIMS) {
    if (Number.isNaN(dims[d]) || w[d] === 0) continue;
    num += w[d] * dims[d];
    den += w[d];
  }
  const score = den > 0 ? Math.round(100 * num / den) : 0;

  // --- bands and the one instruction
  const band = {} as Record<Dim, Band>;
  for (const d of DIMS) {
    const v = dims[d];
    if (Number.isNaN(v) || w[d] === 0) { band[d] = 'na'; continue; }
    if (v >= BAND_FLOOR[d]) { band[d] = 'ok'; continue; }
    if (d === 'length') band[d] = lengthRatio < 1 ? 'low' : 'high';
    else if (d === 'speed') band[d] = speed < (opts.targetSpeed ?? DEFAULT_SPEED) ? 'low' : 'high';
    else if (d === 'pressure') band[d] = pressureSign > 0 ? 'high' : 'low';
    else band[d] = 'low';
  }
  let tip: Tip | null = null;
  let worstCost = 0;
  for (const d of DIMS) {
    if (band[d] === 'ok' || band[d] === 'na') continue;
    const cost = w[d] * (BAND_FLOOR[d] - dims[d]);
    if (cost > worstCost) { worstCost = cost; tip = { dim: d, text: tipText(d, band[d], pressureWhere) }; }
  }
  // A stroke half as long (or twice as long) as the reference cannot cover it: length explains the shape miss.
  if (band.length !== 'ok' && band.length !== 'na' && (lengthRatio < 0.7 || lengthRatio > 1.45)) tip = { dim: 'length', text: tipText('length', band.length, pressureWhere) };
  // Direction wins whenever it is wrong: nothing else matters until the stroke goes the right way.
  if (reversed && band.direction !== 'na') tip = { dim: 'direction', text: 'Start at the dot' };

  return { score, dims, band, tip, reversed, coverage, precision, lengthRatio, speed };
}

/**
 * One pull. Penalises stalls (long gaps in progress while the pen is down),
 * reversals along the path that the reference does not have, and lateral jitter
 * relative to the tolerance.
 */
function confidenceOf(user: Point[], tolerance: number, meanSpeed: number): number {
  const n = user.length;
  // Jitter: deviation of each point from a 5-point moving average of its neighbours.
  let jitter = 0, cnt = 0;
  for (let i = 2; i < n - 2; i++) {
    const mx = (user[i - 2].x + user[i - 1].x + user[i].x + user[i + 1].x + user[i + 2].x) / 5;
    const my = (user[i - 2].y + user[i - 1].y + user[i].y + user[i + 1].y + user[i + 2].y) / 5;
    jitter += Math.hypot(user[i].x - mx, user[i].y - my);
    cnt++;
  }
  jitter = cnt ? jitter / cnt : 0;
  const jitterPenalty = clamp01(jitter / (tolerance * 0.5));

  // Reversals: sharp direction changes (> 120°) between consecutive resampled segments.
  const r = resampleN(user, 24);
  let reversals = 0;
  for (let i = 2; i < r.length; i++) {
    const ax = r[i - 1].x - r[i - 2].x, ay = r[i - 1].y - r[i - 2].y, bx = r[i].x - r[i - 1].x, by = r[i].y - r[i - 1].y;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la < 1e-6 || lb < 1e-6) continue;
    if ((ax * bx + ay * by) / (la * lb) < -0.5) reversals++;
  }
  const reversalPenalty = clamp01(reversals / 3);

  // Stalls: intervals where the pen barely moves for more than 120 ms mid-stroke.
  let stallPenalty = 0;
  if (!Number.isNaN(meanSpeed)) {
    let stalled = 0;
    for (let i = 1; i < n; i++) {
      const dt = (user[i].t ?? 0) - (user[i - 1].t ?? 0);
      const dl = Math.hypot(user[i].x - user[i - 1].x, user[i].y - user[i - 1].y);
      if (dt > 120 && dl / dt < meanSpeed * 0.15) stalled += dt;
    }
    const dur = (user[n - 1].t ?? 0) - (user[0].t ?? 0);
    stallPenalty = dur > 0 ? clamp01(stalled / (dur * 0.35)) : 0;
  }
  return clamp01(1 - 0.45 * jitterPenalty - 0.35 * reversalPenalty - 0.4 * stallPenalty);
}

function tipText(d: Dim, band: Band, where: 'start' | 'middle' | 'end'): string {
  switch (d) {
    case 'shape': return 'Drifted off the line';
    case 'length': return band === 'low' ? 'Too short' : 'Too long';
    case 'direction': return 'Start at the dot';
    case 'pressure': return band === 'high' ? `Lighter at the ${where}` : `Press harder at the ${where}`;
    case 'speed': return band === 'low' ? 'Faster: one pull' : 'Slower';
    case 'confidence': return 'Hesitated: ghost it, then one pull';
  }
}

/** The word for an in-band stroke. */
export function praiseFor(score: number): string {
  if (score >= 95) return 'Perfect';
  if (score >= 85) return 'Great';
  return 'Clean';
}

/** Legacy signature kept for callers and tests: a guided-mode score with the old fields. */
export interface TraceScore { score: number; coverage: number; precision: number; reversed: boolean; lengthRatio: number }
export function scoreTrace(user: Point[], ref: Point[], tolerance: number): TraceScore {
  const s = scoreStroke(user, ref, { tolerance, mode: 'guided' });
  return { score: s.score, coverage: s.coverage, precision: s.precision, reversed: s.reversed, lengthRatio: s.lengthRatio };
}

/** Stars for a finished Perform from its mean step score (skipped steps count as 0). */
export function starsFor(avg: number, skipped = 0): 0 | 1 | 2 | 3 {
  if (avg >= 85 && skipped === 0) return 3;
  if (avg >= 70) return 2;
  if (avg >= 50) return 1;
  return 0;
}

/** Below this the stroke is removed and the step stays open. */
export const PASS_SCORE = 30;
/** Perform is stricter: below this the stroke is retried (three tries at most). */
export const PERFORM_PASS_SCORE = 50;
/** Two strokes at or above this step the assist tier down. */
export const STEP_DOWN_SCORE = 85;
