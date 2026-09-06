/**
 * Hash routes for the studio. The engine owns the run; the route says which run
 * should exist and which sheets are open.
 *
 *   /                          redirect: first run → /learn, otherwise the last mode used
 *   /sketch                    free drawing (the studio)
 *   /learn                     the Path
 *   /learn/:mission            the Path with a mission sheet on top
 *   /learn/:mission/:part      a session (teach | trainer | guided | perform); ?tier=light for Perform
 *   /warmup                    the warm-up session
 *   /progress                  stars, bests, minutes
 */
import type { Part, Tier } from './curriculum';
import { TIERS } from './curriculum';

export type Route =
  | { kind: 'root' }
  | { kind: 'studio' }
  | { kind: 'learn' }
  | { kind: 'mission'; missionId: string }
  | { kind: 'session'; missionId: string; part: Part; tier?: Tier }
  | { kind: 'warmup' }
  | { kind: 'progress' };

const PARTS: Part[] = ['teach', 'trainer', 'guided', 'perform'];

export function parseRoute(pathname: string, search = ''): Route {
  const seg = pathname.split('/').filter(Boolean);
  if (seg.length === 0) return { kind: 'root' };
  if (seg[0] === 'sketch') return { kind: 'studio' };
  if (seg[0] === 'warmup') return { kind: 'warmup' };
  if (seg[0] === 'progress') return { kind: 'progress' };
  if (seg[0] === 'learn') {
    if (seg.length === 1) return { kind: 'learn' };
    if (seg.length === 2) return { kind: 'mission', missionId: seg[1] };
    const part = seg[2] as Part;
    if (PARTS.includes(part)) {
      const t = new URLSearchParams(search).get('tier') as Tier | null;
      return { kind: 'session', missionId: seg[1], part, tier: t && TIERS.includes(t) ? t : undefined };
    }
    return { kind: 'mission', missionId: seg[1] };
  }
  return { kind: 'studio' };
}

/** A stable key for effects: changes only when the run the route asks for changes. */
export const routeKey = (r: Route) =>
  r.kind === 'session' ? `session:${r.missionId}:${r.part}:${r.tier ?? ''}` : r.kind === 'mission' ? `mission:${r.missionId}` : r.kind;

export const sketchPath = () => '/sketch';
export const learnPath = () => '/learn';
export const missionPath = (id: string) => `/learn/${id}`;
export const sessionPath = (id: string, part: Part, tier?: Tier) => `/learn/${id}/${part}${tier ? `?tier=${tier}` : ''}`;
export const warmupPath = () => '/warmup';
export const progressPath = () => '/progress';
