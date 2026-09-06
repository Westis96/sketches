import { useNavigate } from 'react-router';
import { BarChart3, GraduationCap, PenLine, Star, Timer } from 'lucide-react';
import { useStudioState } from '@/hooks/useStudio';
import { MISSIONS } from '@/practice/curriculum';
import { learnPath, progressPath, sketchPath, warmupPath } from '@/practice/routes';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'learn', label: 'Learn', icon: GraduationCap, to: learnPath() },
  { key: 'sketch', label: 'Sketch', icon: PenLine, to: sketchPath() },
  { key: 'progress', label: 'Progress', icon: BarChart3, to: progressPath() },
] as const;

/** Header of the Learn and Progress pages: the three modes, the warm-up, and two numbers. */
export function LearnNav({ active }: { active: 'learn' | 'progress' }) {
  const navigate = useNavigate();
  const progress = useStudioState((s) => s.progress);
  const stars = MISSIONS.reduce((a, x) => a + (progress.missions[x.id]?.perform?.stars ?? 0), 0);
  const minutes = Math.round((progress.seconds ?? 0) / 60);
  return (
    <div className="safe-t sticky top-0 z-10 bg-[var(--paper)]/85 px-3 pb-2 pt-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-[560px] items-center gap-2">
        <nav className="inline-flex items-center gap-0.5 rounded-full bg-[var(--low)] p-1" aria-label="Mode">
          {TABS.map((t) => {
            const on = t.key === active;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => navigate(t.to)}
                className={cn('press inline-flex h-9 items-center gap-1.5 rounded-full px-3 font-display text-[13px] font-extrabold outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]', on ? 'bg-[var(--surface-solid)] text-[var(--text-1)] shadow-[var(--shadow-sm)]' : 'text-[var(--text-2)] hover:text-[var(--text-1)]')}
              >
                <Icon className="h-4 w-4" /><span className={cn(!on && 'max-sm:hidden')}>{t.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 font-display text-[12.5px] font-extrabold text-[var(--text-2)]">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-solid)] px-2.5 py-1.5 shadow-[var(--shadow-sm)]" title="Stars earned"><Star className="h-3.5 w-3.5 fill-[var(--warning)] text-[var(--warning)]" /><span className="tabular-nums">{stars}</span></span>
          <span className="hidden items-center gap-1 rounded-full bg-[var(--surface-solid)] px-2.5 py-1.5 shadow-[var(--shadow-sm)] sm:inline-flex" title="Minutes practised"><Timer className="h-3.5 w-3.5 text-[var(--accent)]" /><span className="tabular-nums">{minutes}</span> min</span>
          <button type="button" data-testid="today-warmup" onClick={() => navigate(warmupPath())} className="duo-btn duo-secondary h-9 px-3 text-[11.5px] normal-case tracking-normal" style={{ '--lvl': 'var(--accent)' } as React.CSSProperties}>
            <Timer className="h-3.5 w-3.5 text-[var(--accent)]" />Warm-up
          </button>
        </div>
      </div>
    </div>
  );
}
