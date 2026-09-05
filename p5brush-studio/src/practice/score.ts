/**
 * Scores a traced stroke against its reference. Both paths are resampled by
 * arc length; the score blends how well the reference was covered, how far
 * the user strayed from it, whether the length matched and whether it was
 * drawn in the same direction. Distances are relative to a tolerance derived
 * from the brush width, so thick brushes are forgiving and fine liners are not.
 */
import type { Point } from '@/engine/records';
import { pathLength, resampleN } from './geometry';

export interface TraceScore {
  /** 0–100. */
  score: number;
  /** Mean distance from the reference to the user's stroke, in world units. */
  coverage: number;
  /** Mean distance from the user's stroke to the reference. */
  precision: number;
  /** True when the stroke was drawn from the reference's end to its start. */
  reversed: boolean;
  /** user length / reference length. */
  lengthRatio: number;
}

const N = 48;

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

export function scoreTrace(user: Point[], ref: Point[], tolerance: number): TraceScore {
  const u = resampleN(user, N), r = resampleN(ref, N);
  const coverage = meanNearest(r, u);
  const precision = meanNearest(u, r);
  const lu = pathLength(user), lr = pathLength(ref);
  const lengthRatio = lr > 0 ? lu / lr : 1;

  const dStart = Math.hypot(u[0].x - r[0].x, u[0].y - r[0].y);
  const dStartRev = Math.hypot(u[0].x - r[N - 1].x, u[0].y - r[N - 1].y);
  const dEnd = Math.hypot(u[N - 1].x - r[N - 1].x, u[N - 1].y - r[N - 1].y);
  const dEndRev = Math.hypot(u[N - 1].x - r[0].x, u[N - 1].y - r[0].y);
  const closed = Math.hypot(r[0].x - r[N - 1].x, r[0].y - r[N - 1].y) < tolerance;
  const reversed = !closed && dStartRev + dEndRev < dStart + dEnd;

  // Position: 0.6 coverage, 0.4 precision; full marks inside the tolerance,
  // nothing beyond ~3.5 tolerances.
  const dist = coverage * 0.6 + precision * 0.4;
  const position = clamp01(1 - Math.max(0, dist - tolerance * 0.5) / (tolerance * 3));
  const ratio = Math.min(lengthRatio, 1 / Math.max(lengthRatio, 1e-6));
  const length = 0.75 + 0.25 * clamp01(ratio);
  const direction = reversed ? 0.85 : 1;
  const score = Math.round(100 * position * length * direction);
  return { score, coverage, precision, reversed, lengthRatio };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Stars for a finished lesson from its mean step score (skipped steps count as 0). */
export function starsFor(avg: number): 0 | 1 | 2 | 3 {
  if (avg >= 85) return 3;
  if (avg >= 65) return 2;
  if (avg >= 35) return 1;
  return 0;
}

/** Short verdict for the score pill. */
export function verdictFor(score: number): string {
  if (score >= 95) return 'Perfect';
  if (score >= 85) return 'Great';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Okay';
  return 'Rough';
}

/** Below this the stroke is removed and the step stays open. */
export const PASS_SCORE = 30;
