/** Per-lesson personal bests, kept in localStorage next to the drawing. */
export interface LessonProgress { best: number; stars: number; plays: number }
export type Progress = Record<string, LessonProgress>;

export const PROGRESS_KEY = 'p5brush-studio:practice:v1';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const doc = raw ? (JSON.parse(raw) as Progress) : {};
    return doc && typeof doc === 'object' ? doc : {};
  } catch {
    return {};
  }
}

export function saveProgress(p: Progress) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
}

/** Records a finished run; returns the updated progress and whether it is a new best. */
export function recordRun(p: Progress, id: string, score: number, stars: number): { progress: Progress; newBest: boolean } {
  const prev = p[id];
  const newBest = !prev || score > prev.best;
  const next: Progress = {
    ...p,
    [id]: { best: newBest ? score : prev.best, stars: Math.max(stars, prev?.stars ?? 0), plays: (prev?.plays ?? 0) + 1 },
  };
  return { progress: next, newBest };
}
