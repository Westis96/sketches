import { GraduationCap, Hand, Palette, X } from 'lucide-react';
import { useStudio, useStudioState } from '@/hooks/useStudio';

/**
 * First-visit card above the dock: what the app is and the three things worth
 * knowing. Dismissed once, never shown again (the flag lives in localStorage).
 */
export function WelcomeCard({ onTryLesson }: { onTryLesson: () => void }) {
  const studio = useStudio();
  const firstRun = useStudioState((s) => s.firstRun);
  if (!firstRun) return null;
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  return (
    <div className="tl-panel welcome-in pointer-events-auto w-[min(380px,calc(100vw-16px))] p-4 text-[12px]" role="dialog" aria-label="Welcome" data-testid="welcome">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-[var(--tl-text-1)]">p5.brush Realtime Studio</div>
          <div className="mt-0.5 text-[12px] leading-snug text-[var(--tl-text-2)]">
            Draw anywhere with {coarse ? 'a Pencil or a finger' : 'a pen, mouse or trackpad'}. Every stroke is rendered live by the p5.brush engine.
          </div>
        </div>
        <button type="button" aria-label="Dismiss" className="tl-opt h-7 w-7 px-0" onClick={() => studio.dismissWelcome()}><X className="h-4 w-4" /></button>
      </div>
      <ul className="mt-3 space-y-2">
        <li className="flex items-center gap-2.5 text-[var(--tl-text-2)]"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--tl-low)]"><Palette className="h-4 w-4" /></span>Brushes, colours and paper live in the style panel{coarse ? '' : ' (P)'}.</li>
        <li className="flex items-center gap-2.5 text-[var(--tl-text-2)]"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--tl-low)]"><GraduationCap className="h-4 w-4" /></span>Practice traces sample drawings stroke by stroke and scores you.</li>
        <li className="flex items-center gap-2.5 text-[var(--tl-text-2)]"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--tl-low)]"><Hand className="h-4 w-4" /></span>{coarse ? 'Pinch to zoom, two fingers pan, two-finger tap undoes.' : 'Scroll pans, ctrl+scroll zooms, ⌘Z undoes, ? lists shortcuts.'}</li>
      </ul>
      <div className="mt-3 flex items-center gap-1.5">
        <button type="button" className="inline-flex h-9 items-center rounded-[9px] bg-[var(--tl-selected)] px-3.5 font-medium text-white hover:bg-[#2a74d8]" onClick={() => studio.dismissWelcome()}>Start drawing</button>
        <button type="button" className="tl-opt h-9 gap-1.5 px-3" onClick={() => { studio.dismissWelcome(); onTryLesson(); }}><GraduationCap className="h-3.5 w-3.5" />Try a lesson</button>
      </div>
    </div>
  );
}
