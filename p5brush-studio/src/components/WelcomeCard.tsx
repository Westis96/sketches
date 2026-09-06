import { GraduationCap, Hand, Palette, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
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
    <Card className="enter-up welcome-in pointer-events-auto w-[min(380px,calc(100vw-16px))] p-4 text-[12px]" role="dialog" aria-label="Welcome" data-testid="welcome">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <CardTitle>p5.brush Realtime Studio</CardTitle>
          <CardDescription className="mt-0.5">
            Draw anywhere with {coarse ? 'a Pencil or a finger' : 'a pen, mouse or trackpad'}. Every stroke is rendered live by the p5.brush engine.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => studio.dismissWelcome()}><X /></Button>
      </div>
      <ul className="mt-3 space-y-2">
        <li className="flex items-center gap-2.5 text-[var(--text-2)]"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Palette className="h-4 w-4" /></span>Brushes, colours and paper live in the style panel{coarse ? '' : ' (P)'}.</li>
        <li className="flex items-center gap-2.5 text-[var(--text-2)]"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--accent-soft)] text-[var(--accent-strong)]"><GraduationCap className="h-4 w-4" /></span>Practice traces sample drawings stroke by stroke and scores you.</li>
        <li className="flex items-center gap-2.5 text-[var(--text-2)]"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Hand className="h-4 w-4" /></span>{coarse ? 'Pinch to zoom, two fingers pan, two-finger tap undoes.' : 'Scroll pans, ctrl+scroll zooms, ⌘Z undoes, ? lists shortcuts.'}</li>
      </ul>
      <div className="mt-3 flex items-center gap-1.5">
        <Button onClick={() => studio.dismissWelcome()}>Start drawing</Button>
        <Button variant="secondary" onClick={() => { studio.dismissWelcome(); onTryLesson(); }}><GraduationCap />Try a lesson</Button>
      </div>
    </Card>
  );
}
