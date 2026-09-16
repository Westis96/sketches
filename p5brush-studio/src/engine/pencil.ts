/**
 * Apple Pencil features beyond pressure: tilt shading, an azimuth-locked nib,
 * barrel roll, the hover footprint, the predicted tail and pressure calibration.
 * Hover footprint and predicted tail are on by default; nib and roll come with
 * the brush; tilt shading stays in the lab. The ones that change the ink are
 * stored on each stroke (`BrushRecord.fx`) so replays never depend on the
 * current settings.
 */

/** Per-stroke rendering effects (what a record remembers). */
export interface PencilFx {
  /** Width factor when the pencil lies flat (1 = no tilt shading). */
  tiltWidth: number;
  /** Stamp opacity factor when the pencil lies flat (1 = no fade). */
  tiltFade: number;
  /** What the tip's rotation follows: the stroke direction (engine default) or the pencil's azimuth. */
  nib: 'stroke' | 'azimuth';
  /** Add the barrel roll since pen-down to the tip rotation (Pencil Pro). */
  roll: boolean;
}

export interface PencilCalibration { min: number; max: number }

/** Lab settings: the effects plus the input-side features. */
export interface PencilSettings extends PencilFx {
  tiltShade: boolean;
  hover: boolean;
  predict: boolean;
  calib: PencilCalibration | null;
}

export const DEFAULT_PENCIL: PencilSettings = {
  tiltShade: false, tiltWidth: 2.2, tiltFade: 0.6,
  nib: 'stroke', roll: false,
  hover: true, predict: true, calib: null,
};

/** Every feature off (the lab's "All off"); the calibration is kept. */
export const allPencilOff = (p: PencilSettings): PencilSettings => ({ ...DEFAULT_PENCIL, hover: false, predict: false, calib: p.calib });
export const anyPencilOn = (p: PencilSettings) => p.tiltShade || p.nib !== 'stroke' || p.roll || p.hover || p.predict;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** The effects a new pen stroke should carry, or undefined when none is on. */
export function activeFx(p: PencilSettings): PencilFx | undefined {
  if (!p.tiltShade && p.nib === 'stroke' && !p.roll) return undefined;
  return { tiltWidth: p.tiltShade ? p.tiltWidth : 1, tiltFade: p.tiltShade ? p.tiltFade : 1, nib: p.nib, roll: p.roll };
}

/**
 * How flat the pencil is held, 0 (upright, altitude ≥ 80°) to 1 (altitude ≤ 25°,
 * about as flat as a Pencil reports). Altitude is in degrees, 90 = perpendicular.
 */
export const tiltFlat = (alt: number | undefined) => (alt === undefined ? 0 : clamp((80 - alt) / 55, 0, 1));

/**
 * Tilt shading for one point: the width factor, and what keeps the mark's
 * darkness where the fade says it should be. Widening happens through the plot
 * pressure, and the engine answers a higher pressure twice: the tip covers each
 * pixel with proportionally more stamps, and stamp alpha grows with pressure
 * above 0.8. The alpha factor undoes the second (floored so a translucent brush
 * stays above the 8-bit mask's resolution), thinning the stamps undoes the rest,
 * and the fade scales the result: at fade 1 a flat pencil is wider at the same
 * darkness, below 1 it is lighter as well.
 * `p` is the mapped pressure the widening multiplies, `opacity` the brush's 0–255 alpha.
 */
export function tiltFactors(alt: number | undefined, fx: PencilFx, p = 1, opacity = 255): { widen: number; fade: number; alpha: number; keep: number } {
  const f = tiltFlat(alt);
  const widen = 1 + (fx.tiltWidth - 1) * f;
  const fade = 1 - (1 - fx.tiltFade) * f;
  if (widen === 1 && fade === 1) return { widen, fade, alpha: 1, keep: 1 };
  const boost = Math.max(0.8, p * widen) / Math.max(0.8, p);
  const alpha = clamp(1 / boost, Math.min(1, 1.5 / Math.max(1, opacity)), 1);
  const keep = clamp(fade / (widen * boost * alpha), 0.02, 1);
  return { widen, fade, alpha: Math.round(alpha * 1000) / 1000, keep: Math.round(keep * 1000) / 1000 };
}

/**
 * Tip rotation for one point, in the engine's "natural" convention (degrees; the
 * engine's own natural rotation is minus the heading). Pointer azimuth runs
 * clockwise on screen from +x, engine angles run counter-clockwise, so a nib
 * locked to the azimuth is rotated by +azimuth. Returns null to leave the
 * engine's own rotation in place.
 */
export function nibAngle(pt: { az?: number; tw?: number }, heading: number, rotate: 'none' | 'natural' | 'random', fx: PencilFx, tw0: number): number | null {
  let base: number | null = null;
  if (fx.nib === 'azimuth' && pt.az !== undefined) base = pt.az;
  else if (fx.roll && pt.tw !== undefined) base = rotate === 'natural' ? -heading : rotate === 'none' ? 0 : null;
  if (base === null) return null;
  if (fx.roll && pt.tw !== undefined) base += pt.tw - tw0;
  return Math.round(base * 10) / 10;
}

/** Shortest-arc interpolation between two angles in degrees, result in [0, 360). */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = ((b - a) % 360 + 540) % 360 - 180;
  const v = a + d * t;
  d = ((v % 360) + 360) % 360;
  return d;
}

export interface Tilt { alt: number; az: number; tw: number }

/**
 * Altitude, azimuth and twist of a pen event in whole degrees. Prefers the
 * spherical angles (Safari 16.4+, Chrome 86+) and falls back to tiltX/tiltY.
 * Null for anything that is not a pen.
 */
export function eventTilt(e: PointerEvent): Tilt | null {
  if (e.pointerType !== 'pen') return null;
  const ev = e as PointerEvent & { altitudeAngle?: number; azimuthAngle?: number };
  let alt: number, az: number;
  if (typeof ev.altitudeAngle === 'number' && typeof ev.azimuthAngle === 'number') {
    alt = (ev.altitudeAngle * 180) / Math.PI;
    az = (ev.azimuthAngle * 180) / Math.PI;
  } else {
    const tx = ((e.tiltX || 0) * Math.PI) / 180, ty = ((e.tiltY || 0) * Math.PI) / 180;
    if (tx === 0 && ty === 0) { alt = 90; az = 0; } else {
      const tanX = Math.tan(tx), tanY = Math.tan(ty);
      az = (Math.atan2(tanY, tanX) * 180) / Math.PI;
      alt = (Math.atan(1 / Math.hypot(tanX, tanY)) * 180) / Math.PI;
    }
  }
  alt = clamp(Math.round(alt), 0, 90);
  az = ((Math.round(az) % 360) + 360) % 360;
  const tw = ((Math.round(e.twist || 0) % 360) + 360) % 360;
  return { alt, az, tw };
}

/** Maps a raw pen pressure through the calibrated range onto 0.02..1 (0.5 = mid-range). */
export function calibratePressure(p: number, c: PencilCalibration | null): number {
  if (!c || !(c.max > c.min)) return p;
  return 0.02 + 0.98 * clamp((p - c.min) / (c.max - c.min), 0, 1);
}

/** 5th/95th percentiles of the pressures seen while calibrating, or null if too few or too flat. */
export function calibrationFrom(samples: number[]): PencilCalibration | null {
  if (samples.length < 40) return null;
  const s = [...samples].sort((a, b) => a - b);
  const min = s[Math.floor(s.length * 0.05)], max = s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
  if (!(max - min > 0.1)) return null;
  return { min: Math.round(min * 1000) / 1000, max: Math.round(max * 1000) / 1000 };
}
