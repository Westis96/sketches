import { useNavigate } from 'react-router';
import { LearnNav } from './LearnNav';
import { Stars } from './Stars';
import { useStudioState } from '@/hooks/useStudio';
import { LEVELS, MISSIONS, TIER_LABEL, isPlayable, levelVars } from '@/practice/curriculum';
import { levelStars, missionDone } from '@/practice/progress';
import { missionPath } from '@/practice/routes';

/** Stars per level, missions done, minutes, and every mission's first-try vs best. */
export function ProgressPage() {
  const navigate = useNavigate();
  const progress = useStudioState((s) => s.progress);
  const minutes = Math.round((progress.seconds ?? 0) / 60);
  const done = MISSIONS.filter((x) => isPlayable(x) && missionDone(progress, x.id)).length;
  const playable = MISSIONS.filter(isPlayable).length;
  const pairs = MISSIONS.filter((x) => progress.missions[x.id]?.first).map((x) => ({ x, m: progress.missions[x.id] }));

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto overscroll-contain bg-[var(--paper)]" data-testid="progress">
      <LearnNav active="progress" />
      <div className="mx-auto max-w-[560px] px-4 pb-24 pt-2">
        <h1 className="font-display text-[26px] font-extrabold text-[var(--text-1)]">Progress</h1>
        <p className="mt-1 text-[12.5px] text-[var(--text-2)]">Stars are earned by performing a piece. Your first Perform of each piece is kept, so you can see how far you've come.</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[[`${minutes}`, 'minutes'], [`${done} / ${playable}`, 'missions done'], [`${progress.warmups ?? 0}`, 'warm-ups']].map(([v, l], i) => (
            <div key={l} className="tile-in overflow-hidden rounded-[14px] border-2 border-[var(--accent)]" style={{ '--enter-delay': `${i * 80}ms` } as React.CSSProperties}>
              <div className="bg-[var(--accent)] px-2 py-1 text-center font-display text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-white">{l}</div>
              <div className="bg-[var(--surface-solid)] px-2 py-2.5 text-center font-display text-[22px] font-extrabold tabular-nums text-[var(--text-1)]">{v}</div>
            </div>
          ))}
        </div>

        <h2 className="mt-6 font-display text-[16px] font-extrabold text-[var(--text-1)]">Stars per level</h2>
        <div className="mt-2 flex flex-col gap-2">
          {LEVELS.map((level) => {
            const ids = level.missions.filter((x) => isPlayable(x) && x.piece).map((x) => x.id);
            const st = levelStars(progress, ids);
            return (
              <div key={level.n} className="flex items-center gap-3 rounded-[14px] bg-[var(--surface-solid)] px-3 py-2.5 shadow-[var(--shadow-sm)]" style={levelVars(level.n)}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-[13px] font-extrabold text-white" style={{ background: 'var(--lvl)', boxShadow: '0 3px 0 var(--lvl-deep)' }}>{level.n}</span>
                <span className="w-36 truncate font-display text-[13px] font-extrabold text-[var(--text-1)]">{level.theme}</span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--hint)]">
                  <span className="bar-fill block h-full rounded-full" style={{ width: st.possible ? `${(100 * st.earned) / st.possible}%` : 0, background: 'var(--lvl)' }} />
                </span>
                <span className="w-16 text-right font-mono text-[11px] tabular-nums text-[var(--text-2)]">{st.possible ? `${st.earned} / ${st.possible} ★` : '—'}</span>
              </div>
            );
          })}
        </div>

        {pairs.length > 0 && (
          <>
            <h2 className="mt-6 font-display text-[16px] font-extrabold text-[var(--text-1)]">Then vs now</h2>
            <ul className="mt-2 flex flex-col gap-1.5">
              {pairs.map(({ x, m }) => (
                <li key={x.id}>
                  <button type="button" className="press flex w-full items-center gap-3 rounded-[14px] bg-[var(--surface-solid)] px-3 py-2.5 text-left shadow-[var(--shadow-sm)]" style={levelVars(x.level)} onClick={() => navigate(missionPath(x.id))}>
                    <span className="min-w-0 flex-1 truncate font-display text-[13px] font-extrabold text-[var(--text-1)]"><span className="font-mono text-[10.5px] font-medium text-[var(--text-3)]">{x.id}</span> {x.title}</span>
                    <span className="font-mono text-[12px] tabular-nums text-[var(--text-2)]">{m.first!.score} → {m.perform?.best ?? m.first!.score}</span>
                    <Stars n={m.perform?.stars ?? 0} size="h-3.5 w-3.5" />
                    <span className="hidden text-[10.5px] text-[var(--text-3)] sm:inline">{m.perform ? TIER_LABEL[m.perform.tier].toLowerCase() : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
