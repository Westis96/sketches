/**
 * Practice progress, kept in localStorage next to the drawing.
 *
 * Version 2 is per mission and per part. Version 1 (one best per whole lesson,
 * traced with the full guide) migrates onto the matching mission's Perform at the
 * Full tier, so nobody loses their stars.
 */
import { missionById, missionForPiece, partsOf, type Tier } from './curriculum';

export interface PartBest { best: number; plays: number }
export interface PerformBest extends PartBest {
  stars: number;
  /** The tier the best was earned at, and the best per tier. */
  tier: Tier;
  byTier: Partial<Record<Tier, number>>;
}
/** The first Perform of a mission, kept for "then vs now". Strokes are the saved-record form. */
export interface FirstAttempt { at: number; score: number; stars: number; strokes: unknown[] }
export interface MissionProgress {
  trainer?: PartBest & { clean: number; reps: number };
  guided?: PartBest & { tier: Tier };
  perform?: PerformBest;
  first?: FirstAttempt;
}
export interface Progress {
  v: 2;
  missions: Record<string, MissionProgress>;
  /** Seconds spent in sessions, all time. */
  seconds: number;
  warmups: number;
  lastMission?: string;
}

export const PROGRESS_KEY = 'p5brush-studio:practice:v2';
const LEGACY_KEY = 'p5brush-studio:practice:v1';

const empty = (): Progress => ({ v: 2, missions: {}, seconds: 0, warmups: 0 });

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const doc = JSON.parse(raw) as Progress;
      if (doc && doc.v === 2 && doc.missions && typeof doc.missions === 'object') return { ...empty(), ...doc };
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const p = migrateV1(JSON.parse(legacy));
      saveProgress(p);
      return p;
    }
  } catch { /* unreadable: start fresh */ }
  return empty();
}

/** v1: { [lessonId]: { best, stars, plays } } */
function migrateV1(doc: unknown): Progress {
  const p = empty();
  if (!doc || typeof doc !== 'object') return p;
  for (const [lessonId, v] of Object.entries(doc as Record<string, { best?: number; stars?: number; plays?: number }>)) {
    const mission = missionForPiece(lessonId);
    if (!mission || !v || typeof v.best !== 'number') continue;
    p.missions[mission.id] = { perform: { best: v.best, plays: v.plays ?? 1, stars: v.stars ?? 0, tier: 'full', byTier: { full: v.best } } };
  }
  return p;
}

export function saveProgress(p: Progress) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
}

export const missionDone = (p: Progress, id: string) => {
  const m = p.missions[id];
  return !!m && (!!m.perform || (!!m.trainer && !m.guided && !m.perform && isTrainerOnly(id)));
};
// A mission with no piece is done once its trainer has been played.
const isTrainerOnly = (id: string) => { const x = missionById(id); return !!x && partsOf(x).length === 1; };

export function recordTrainer(p: Progress, id: string, score: number, clean: number, reps: number): Progress {
  const m = { ...(p.missions[id] ?? {}) };
  const prev = m.trainer;
  m.trainer = { best: Math.max(score, prev?.best ?? 0), plays: (prev?.plays ?? 0) + 1, clean: Math.max(clean, prev?.clean ?? 0), reps };
  return { ...p, missions: { ...p.missions, [id]: m }, lastMission: id };
}

export function recordGuided(p: Progress, id: string, score: number, tier: Tier): Progress {
  const m = { ...(p.missions[id] ?? {}) };
  const prev = m.guided;
  m.guided = { best: Math.max(score, prev?.best ?? 0), plays: (prev?.plays ?? 0) + 1, tier };
  return { ...p, missions: { ...p.missions, [id]: m }, lastMission: id };
}

export function recordPerform(p: Progress, id: string, score: number, stars: number, tier: Tier, strokes: unknown[]): { progress: Progress; newBest: boolean } {
  const m = { ...(p.missions[id] ?? {}) };
  const prev = m.perform;
  const newBest = !prev || score > prev.best;
  const byTier = { ...(prev?.byTier ?? {}) };
  byTier[tier] = Math.max(score, byTier[tier] ?? 0);
  m.perform = { best: newBest ? score : prev!.best, plays: (prev?.plays ?? 0) + 1, stars: Math.max(stars, prev?.stars ?? 0), tier: newBest ? tier : prev!.tier, byTier };
  if (!m.first) m.first = { at: Date.now(), score, stars, strokes };
  return { progress: { ...p, missions: { ...p.missions, [id]: m }, lastMission: id }, newBest };
}

export function addSeconds(p: Progress, s: number): Progress { return { ...p, seconds: (p.seconds ?? 0) + s }; }
export function recordWarmup(p: Progress): Progress { return { ...p, warmups: (p.warmups ?? 0) + 1 }; }

/** Stars earned / possible for a level. */
export function levelStars(p: Progress, missionIds: string[]): { earned: number; possible: number } {
  let earned = 0;
  for (const id of missionIds) earned += p.missions[id]?.perform?.stars ?? 0;
  return { earned, possible: missionIds.length * 3 };
}
