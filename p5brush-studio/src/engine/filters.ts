/**
 * Input filters: Kalman filters (and the older streamline / running-average
 * options) for every pointer channel. Each filter is causal and depends only on
 * the samples before it, so a stroke conditioned prefix by prefix (live chunks)
 * and in one go (replay) comes out the same. Time is the sample index: points
 * are already thinned to one per screen pixel of travel, and no timestamps are
 * stored, so a "step" is one recorded sample.
 *
 * A stroke stores the parameters it was conditioned with (`BrushRecord.filt`),
 * so changing the sliders never changes existing strokes. Records without it
 * use the legacy behaviour, which the default parameters reproduce exactly.
 */

export type PositionMode = 'kalman' | 'streamline' | 'off';
export type PressureMode = 'kalman' | 'average' | 'off';
export type OnOff = 'kalman' | 'off';

export interface FilterParams {
  /** Position: constant-velocity Kalman (q = process noise per step, r = measurement noise, in world px²). */
  position: { mode: PositionMode; q: number; r: number; streamline: number };
  /** Pressure: random-walk Kalman on the 0..1 force (or the simulated pressure). */
  pressure: { mode: PressureMode; q: number; r: number };
  /** Altitude and azimuth (degrees²). */
  tilt: { mode: OnOff; q: number; r: number };
  /** Barrel twist (degrees²). */
  twist: { mode: OnOff; q: number; r: number };
}

export interface FilterSettings extends FilterParams {
  /** Draw the raw input path over the stroke while drawing (tuning aid). */
  showRaw: boolean;
}

/** A settings change: any channel may be given partially. */
export type FilterPatch = { [K in keyof FilterParams]?: Partial<FilterParams[K]> } & { showRaw?: boolean };

/**
 * What a stroke without stored parameters means: the pre-filter behaviour
 * (streamline 0.575 on position, a half-weight running average on pen pressure).
 */
export const LEGACY_FILTERS: FilterSettings = {
  position: { mode: 'streamline', q: 0.02, r: 4, streamline: 0.575 },
  pressure: { mode: 'average', q: 0.0005, r: 0.01 },
  tilt: { mode: 'off', q: 2, r: 20 },
  twist: { mode: 'off', q: 2, r: 20 },
  showRaw: false,
};

/** The app's defaults: Kalman on every channel ("Balanced" position, "Medium" pressure). */
export const DEFAULT_FILTERS: FilterSettings = {
  position: { mode: 'kalman', q: 0.02, r: 4, streamline: 0.575 },
  pressure: { mode: 'kalman', q: 0.0005, r: 0.01 },
  tilt: { mode: 'kalman', q: 2, r: 20 },
  twist: { mode: 'kalman', q: 2, r: 20 },
  showRaw: false,
};

/** Channel-by-channel equality of two parameter sets (independent of key order). */
export const sameFilterParams = (a: FilterParams, b: FilterParams) =>
  (['position', 'pressure', 'tilt', 'twist'] as const).every((k) => {
    const x = a[k] as unknown as Record<string, unknown>, y = b[k] as unknown as Record<string, unknown>;
    const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
    return [...keys].every((key) => x[key] === y[key]);
  });
const sameParams = sameFilterParams;

/** The parameters a new stroke should store, or undefined when they are the legacy ones (absent = legacy). */
export function activeFilters(s: FilterSettings): FilterParams | undefined {
  if (sameParams(s, LEGACY_FILTERS)) return undefined;
  const { position, pressure, tilt, twist } = s;
  return { position: { ...position }, pressure: { ...pressure }, tilt: { ...tilt }, twist: { ...twist } };
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : d);

/** Validates a stored parameter set (autosave), filling gaps from the defaults. */
export function parseFilters(v: unknown): FilterParams | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const f = v as Partial<Record<keyof FilterParams, Record<string, unknown>>>;
  const D = LEGACY_FILTERS;
  const mode = <T extends string>(m: unknown, allowed: readonly T[], d: T): T => (allowed.includes(m as T) ? (m as T) : d);
  return {
    position: { mode: mode(f.position?.mode, ['kalman', 'streamline', 'off'], D.position.mode), q: num(f.position?.q, D.position.q), r: num(f.position?.r, D.position.r), streamline: num(f.position?.streamline, D.position.streamline) },
    pressure: { mode: mode(f.pressure?.mode, ['kalman', 'average', 'off'], D.pressure.mode), q: num(f.pressure?.q, D.pressure.q), r: num(f.pressure?.r, D.pressure.r) },
    tilt: { mode: mode(f.tilt?.mode, ['kalman', 'off'], D.tilt.mode), q: num(f.tilt?.q, D.tilt.q), r: num(f.tilt?.r, D.tilt.r) },
    twist: { mode: mode(f.twist?.mode, ['kalman', 'off'], D.twist.mode), q: num(f.twist?.q, D.twist.q), r: num(f.twist?.r, D.twist.r) },
  };
}

/**
 * Scalar random-walk Kalman filter: the value is assumed to drift by a step of
 * variance q between samples and to be measured with variance r. Its gain
 * starts high (the first samples are trusted) and settles to a steady state,
 * which is where it differs from a fixed running average.
 */
export class Kalman1D {
  private x: number | null = null;
  private P = 0;
  constructor(private readonly q: number, private readonly r: number) {}
  update(z: number): number {
    if (this.x === null) { this.x = z; this.P = this.r; return z; }
    this.P += this.q;
    const K = this.P / (this.P + this.r);
    this.x += K * (z - this.x);
    this.P *= 1 - K;
    return this.x;
  }
  /** Circular variant for angles in degrees: the measurement is unwrapped to the nearest turn first. */
  updateAngle(z: number): number {
    if (this.x !== null) z = this.x + ((((z - this.x) % 360) + 540) % 360) - 180;
    const v = this.update(z);
    return ((v % 360) + 360) % 360;
  }
  /** Steady-state gain for these parameters (how much of each new sample gets through). */
  static steadyGain(q: number, r: number): number {
    // P∞ solves P² - qP - qr = 0 (post-predict covariance); K = P/(P+r)
    const P = (q + Math.sqrt(q * q + 4 * q * r)) / 2;
    return P / (P + r);
  }
}

/**
 * Constant-velocity Kalman filter for one coordinate, one step per sample:
 * state (position, velocity), F = [[1,1],[0,1]], H = [1,0], process noise q on
 * the acceleration, measurement noise r.
 */
export class KalmanCV {
  private x = 0; private v = 0;
  private p00 = 0; private p01 = 0; private p11 = 0;
  private started = false;
  constructor(private readonly q: number, private readonly r: number) {}
  update(z: number): number {
    if (!this.started) {
      this.started = true;
      this.x = z; this.v = 0;
      this.p00 = this.r; this.p01 = 0; this.p11 = this.r * 4;
      return z;
    }
    const q = this.q;
    // predict
    const x1 = this.x + this.v, v1 = this.v;
    const p00 = this.p00 + 2 * this.p01 + this.p11 + q * 0.25;
    const p01 = this.p01 + this.p11 + q * 0.5;
    const p11 = this.p11 + q;
    // update
    const S = p00 + this.r;
    const k0 = p00 / S, k1 = p01 / S;
    const y = z - x1;
    this.x = x1 + k0 * y;
    this.v = v1 + k1 * y;
    this.p00 = (1 - k0) * p00;
    this.p01 = (1 - k0) * p01;
    this.p11 = p11 - k1 * p01;
    return this.x;
  }
  get velocity() { return this.v; }
}
