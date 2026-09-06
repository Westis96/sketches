import { useEffect, useSyncExternalStore } from 'react';
import type { Studio } from '@/engine/Studio';
import { sfx } from '@/sound/sfx';

/** The sound preference, live. */
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(sfx.subscribe, () => sfx.enabled, () => sfx.enabled);
}

/**
 * Plays the session cues by watching the engine's state: a scored stroke, a guide
 * change, a streak, an undo, and the results with their stars. UI taps on the
 * physical buttons and path nodes click through one capturing listener, which is
 * also where the audio context is unlocked.
 */
export function useSfx(studio: Studio) {
  useEffect(() => {
    let prev = studio.getState();
    const unsub = studio.subscribe(() => {
      const s = studio.getState(), p = prev;
      prev = s;
      const pr = s.practice, pp = p.practice;
      if (!pr) return;
      const same = pp && pp.missionId === pr.missionId && pp.part === pr.part;
      if (pr.status === 'active') {
        const f = pr.feedback;
        if (f && f !== pp?.feedback) {
          if (!f.accepted) sfx.play('miss');
          else if (f.looped) sfx.play('loop');
          else if (pr.part === 'perform') sfx.play('tap');
          else if (f.tip) sfx.play('tip');
          else if (f.score >= 95) sfx.play('great');
          else sfx.play('clean', { score: f.score });
          if (same && pr.streak !== pp!.streak && (pr.streak === 3 || (pr.streak >= 5 && pr.streak % 5 === 0))) sfx.play('streak');
        }
        if (same && pr.note && pr.note !== pp!.note) {
          if (/stepped down/.test(pr.note)) sfx.play('stepDown');
          else if (/stepped up/.test(pr.note)) sfx.play('stepUp');
        }
        if (same && pp!.status === 'active' && pr.step < pp!.step) sfx.play('undo');
      } else if (pr.status === 'complete' && (!same || pp!.status !== 'complete')) {
        sfx.play('complete');
        if (pr.part === 'perform' && pr.summary) {
          for (let i = 0; i < pr.summary.stars; i++) sfx.play('star', { index: i });
          if (pr.summary.newBest && pr.summary.firstScore !== undefined) sfx.play('best');
        }
      }
    });
    const onDown = (e: PointerEvent) => {
      sfx.unlock();
      const el = (e.target as Element | null)?.closest?.('.duo-btn, .node') as HTMLButtonElement | null;
      if (el && !el.disabled) sfx.play(el.classList.contains('node') ? 'tap' : 'click');
    };
    const onKey = () => sfx.unlock();
    const onShow = () => { if (document.visibilityState === 'visible') sfx.unlock(); };
    document.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('keydown', onKey, { capture: true });
    document.addEventListener('visibilitychange', onShow);
    return () => {
      unsub();
      document.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('keydown', onKey, { capture: true });
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [studio]);
}
