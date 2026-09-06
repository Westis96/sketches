import { useNavigate } from 'react-router';
import { ChevronLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Stars } from './Stars';
import { useStudioState } from '@/hooks/useStudio';
import { LEVELS, MISSIONS, TIER_LABEL, isPlayable } from '@/practice/curriculum';
import { levelStars, missionDone } from '@/practice/progress';
import { learnPath, missionPath } from '@/practice/routes';

/** Stars per level, missions done, minutes, and every mission's first-try vs best. */
export function ProgressScreen({ open, instant }: { open: boolean; instant?: boolean }) {
  const navigate = useNavigate();
  const progress = useStudioState((s) => s.progress);
  const minutes = Math.round((progress.seconds ?? 0) / 60);
  const done = MISSIONS.filter((x) => isPlayable(x) && missionDone(progress, x.id)).length;
  const playable = MISSIONS.filter(isPlayable).length;
  const pairs = MISSIONS.filter((x) => progress.missions[x.id]?.first).map((x) => ({ x, m: progress.missions[x.id] }));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) navigate(learnPath()); }}>
      <DialogContent aria-label="Progress" instant={instant} className="tl-scroll max-h-[88vh] w-[min(560px,calc(100vw-24px))] overflow-y-auto p-4" data-testid="progress">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" aria-label="Back to the path" onClick={() => navigate(learnPath())}><ChevronLeft /></Button>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[16px]">Progress</DialogTitle>
            <DialogDescription className="mt-0.5">Stars are earned by performing a piece. Your first Perform of each piece is kept, so you can see how far you've come.</DialogDescription>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={() => navigate('/')}><X /></Button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[[`${minutes}`, 'minutes practised'], [`${done} / ${playable}`, 'missions done'], [`${progress.warmups ?? 0}`, 'warm-ups']].map(([v, l]) => (
            <div key={l} className="rounded-[12px] bg-[var(--low)] px-2 py-2.5">
              <div className="font-mono text-[18px] font-semibold tabular-nums text-[var(--text-1)]">{v}</div>
              <div className="text-[10.5px] text-[var(--text-3)]">{l}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          {LEVELS.map((level) => {
            const ids = level.missions.filter((x) => isPlayable(x) && x.piece).map((x) => x.id);
            const st = levelStars(progress, ids);
            return (
              <div key={level.n} className="flex items-center gap-3 text-[12.5px]">
                <span className="w-5 font-mono text-[11px] text-[var(--text-3)]">{level.n}</span>
                <span className="w-40 truncate font-medium text-[var(--text-1)]">{level.theme}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--hint)]">
                  <span className="block h-full rounded-full bg-[var(--warning)]" style={{ width: st.possible ? `${(100 * st.earned) / st.possible}%` : 0 }} />
                </span>
                <span className="w-16 text-right font-mono text-[11px] tabular-nums text-[var(--text-2)]">{st.possible ? `${st.earned} / ${st.possible} ★` : '—'}</span>
              </div>
            );
          })}
        </div>

        {pairs.length > 0 && (
          <div className="mt-4">
            <div className="tl-label">Then vs now</div>
            <ul className="flex flex-col gap-1">
              {pairs.map(({ x, m }) => (
                <li key={x.id}>
                  <button type="button" className="press flex w-full items-center gap-3 rounded-[10px] px-2 py-1.5 text-left hover:bg-[var(--low)]" onClick={() => navigate(missionPath(x.id))}>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text-1)]"><span className="font-mono text-[10.5px] text-[var(--text-3)]">{x.id}</span> {x.title}</span>
                    <span className="font-mono text-[11px] tabular-nums text-[var(--text-3)]">{m.first!.score} → {m.perform?.best ?? m.first!.score}</span>
                    <Stars n={m.perform?.stars ?? 0} size="h-3 w-3" />
                    <span className="hidden text-[10.5px] text-[var(--text-3)] sm:inline">{m.perform ? TIER_LABEL[m.perform.tier].toLowerCase() : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
