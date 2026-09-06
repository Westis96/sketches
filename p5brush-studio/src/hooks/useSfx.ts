import { useEffect, useSyncExternalStore } from 'react';
import type { Studio } from '@/engine/Studio';
import { LEVELS, isPlayable } from '@/practice/curriculum';
import { missionDone, type Progress } from '@/practice/progress';
import { brushKindOf, sfx } from '@/sound/sfx';

/** The sound preference, live. */
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(sfx.subscribe, () => sfx.enabled, () => sfx.enabled);
}

/** Missions newly done between two progress records: any, and whether one finished a whole level. */
function newlyDone(before: Progress, after: Progress): { any: boolean; level: boolean } {
  let any = false, level = false;
  for (const lvl of LEVELS) {
    const ids = lvl.missions.filter(isPlayable).map((x) => x.id);
    const b = ids.filter((id) => missionDone(before, id)).length, a = ids.filter((id) => missionDone(after, id)).length;
    if (a > b) { any = true; if (a === ids.length) level = true; }
  }
  return { any, level };
}

/**
 * Plays the cues by watching the engine: a scored stroke, a guide change, a streak,
 * an undo, a session starting, the results with their stars, a mission or level
 * newly finished; the studio's own events (undo, redo, clear, export, tool); and the
 * brush bed from the stroke readings. UI taps on the physical buttons and path nodes
 * click through one capturing listener, which is also where the audio context is
 * unlocked.
 */
export function useSfx(studio: Studio) {
  useEffect(() => {
    let prev = studio.getState();
    const unsub = studio.subscribe(() => {
      const s = studio.getState(), p = prev;
      prev = s;
      const done = s.progress !== p.progress ? newlyDone(p.progress, s.progress) : { any: false, level: false };
      const pr = s.practice, pp = p.practice;
      if (!pr) { if (done.level) sfx.play('levelUp'); else if (done.any) sfx.play('unlock'); return; }
      const same = pp && pp.missionId === pr.missionId && pp.part === pr.part;
      if (pr.status === 'active') {
        if (!same && pr.part !== 'teach') sfx.play('start');
        const f = pr.feedback;
        if (f && f !== pp?.feedback) {
          if (!f.accepted) sfx.play('miss');
          else if (f.looped) sfx.play('loop');
          else if (pr.part === 'perform') sfx.play('tap');
          else if (f.tip) sfx.play('tip');
          else if (f.score >= 95) sfx.play('great');
          else sfx.play('clean', { score: f.score });
          if (same && pr.streak !== pp!.streak && (pr.streak === 3 || (pr.streak >= 5 && pr.streak % 5 === 0))) sfx.play('streak');
          if (same && pr.part === 'perform' && pr.misses === 2 && pp!.misses !== 2) sfx.play('lastTry');
        }
        if (same && pr.note && pr.note !== pp!.note) {
          if (/stepped down/.test(pr.note)) sfx.play('stepDown');
          else if (/stepped up/.test(pr.note)) sfx.play('stepUp');
        }
        if (same && pp!.status === 'active' && pr.step < pp!.step) sfx.play('undo');
      } else if (pr.status === 'complete' && (!same || pp!.status !== 'complete')) {
        if (done.level) sfx.play('levelUp');
        else { sfx.play('complete'); if (done.any) sfx.play('unlock'); }
        if (pr.part === 'perform' && pr.summary) {
          for (let i = 0; i < pr.summary.stars; i++) sfx.play('star', { index: i });
          if (pr.summary.newBest && pr.summary.firstScore !== undefined) sfx.play('best');
        }
      }
    });
    const offStroke = studio.onStroke((r) => {
      if (r.phase === 'down') sfx.brushStart(brushKindOf(r.brush, r.tool));
      else if (r.phase === 'move') sfx.brushUpdate(r.speed, r.pressure);
      else sfx.brushStop();
    });
    const offEvent = studio.onEvent((e) => sfx.play(e === 'export' ? 'shutter' : e));
    const onDown = (e: PointerEvent) => {
      sfx.unlock();
      const el = (e.target as Element | null)?.closest?.('.duo-btn, .node') as HTMLButtonElement | null;
      if (el && !el.disabled) sfx.play(el.classList.contains('node') ? 'tap' : 'click');
    };
    const onKey = () => sfx.unlock();
    const onShow = () => { if (document.visibilityState === 'visible') sfx.unlock(); else sfx.brushStop(); };
    document.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('keydown', onKey, { capture: true });
    document.addEventListener('visibilitychange', onShow);
    return () => {
      unsub(); offStroke(); offEvent();
      sfx.brushStop();
      document.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('keydown', onKey, { capture: true });
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [studio]);
}
