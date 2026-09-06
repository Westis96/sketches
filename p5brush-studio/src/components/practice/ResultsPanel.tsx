import { useNavigate } from 'react-router';
import { ArrowRight, BookOpen, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Stars } from './Stars';
import { resultTone } from './tone';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { levelVars, missionById, nextMission, partsOf } from '@/practice/curriculum';
import { missionDone } from '@/practice/progress';
import { DIM_NAME } from '@/practice/score';
import { hasLesson } from '@/practice/teach';
import { learnPath, missionPath, sessionPath, sketchPath } from '@/practice/routes';
import { cn } from '@/lib/utils';

function Tile({ label, value, delay, className }: { label: string; value: React.ReactNode; delay: number; className?: string }) {
  return (
    <div className={cn('tile-in overflow-hidden rounded-[14px] border-2 border-[var(--lvl)]', className)} style={{ '--enter-delay': `${delay}ms` } as React.CSSProperties}>
      <div className="px-2 py-1 text-center font-display text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-white" style={{ background: 'var(--lvl)' }}>{label}</div>
      <div className="bg-[var(--surface-solid)] px-2 py-2 text-center font-display text-[20px] font-extrabold tabular-nums text-[var(--text-1)]">{value}</div>
    </div>
  );
}

/**
 * The results panel, docked so the drawing stays visible: a bottom sheet on phones,
 * a right column on wide screens. A colour band with the heading and stars, stat
 * tiles arriving one after another, the critique, then-vs-now, and a fat Continue.
 */
export function ResultsPanel() {
  const studio = useStudio();
  const navigate = useNavigate();
  const practice = useStudioState((s) => s.practice);
  const progress = useStudioState((s) => s.progress);
  if (!practice || practice.status !== 'complete' || !practice.summary) return null;
  const pr = practice;
  const s = practice.summary;
  const mission = pr.missionId ? missionById(pr.missionId) : null;
  const next = nextMission((id) => missionDone(progress, id));
  const perform = pr.part === 'perform';
  const drill = pr.part === 'trainer' || pr.part === 'warmup';
  const level = mission?.level ?? 0;

  const heading = pr.part === 'warmup' ? 'Warmed up' : pr.part === 'trainer' ? 'Drill done' : pr.part === 'guided' ? 'Guided run done' : s.stars === 3 ? 'Perfect run' : s.stars >= 1 ? 'Perform complete' : 'Run complete';
  const line = perform
    ? s.stars === 3 ? 'Beautiful control.' : s.stars === 2 ? 'Solid. A few strokes drifted.' : s.stars === 1 ? 'Finished. Once more with the guide, then again.' : 'Rough one. Back to the guided run, then try again.'
    : drill ? (s.clean >= pr.steps.length * 0.8 ? 'Clean. Ready for the piece.' : 'Warm. One more round would not hurt.')
    : s.score >= 85 ? 'You know this one. Perform it.' : s.score >= 65 ? 'Close. Perform it, or run it once more.' : 'Run it again with the full guide before you perform.';

  // The one thing to do next.
  let primary: { label: string; to: () => void };
  if (pr.part === 'warmup') primary = next ? { label: `Continue · ${next.id} ${next.title}`, to: () => navigate(missionPath(next.id)) } : { label: 'To the path', to: () => navigate(learnPath()) };
  else if (pr.part === 'trainer' && mission && partsOf(mission).includes('guided')) primary = { label: 'Next · Guided piece', to: () => navigate(sessionPath(mission.id, 'guided')) };
  else if (pr.part === 'guided' && mission) primary = { label: 'Perform now', to: () => navigate(sessionPath(mission.id, 'perform')) };
  else if (next && next.id !== mission?.id) primary = { label: `Next · ${next.id} ${next.title}`, to: () => navigate(missionPath(next.id)) };
  else primary = { label: 'To the path', to: () => navigate(learnPath()) };

  return (
    <div
      className={cn(
        'pointer-events-auto fixed z-40 flex flex-col overflow-hidden bg-[var(--surface-solid)] shadow-[var(--shadow)]',
        'inset-x-0 bottom-0 max-h-[68%] rounded-t-[22px] max-sm:enter-up',
        'md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[400px] md:rounded-none md:rounded-l-[22px] md:enter-up',
      )}
      style={levelVars(level)}
      data-testid="practice-complete"
      data-part={pr.part}
    >
      <div className="px-5 pb-4 pt-5 text-white" style={{ background: 'var(--lvl)' }}>
        <div className="sheet-grip mb-3 bg-white/40 md:hidden" />
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.08em] opacity-85">{heading}</div>
            <div className="truncate font-display text-[22px] font-extrabold leading-tight">{pr.title}</div>
            <div className="mt-1 text-[12.5px] opacity-90">{line}</div>
          </div>
          {perform && <Stars n={s.stars} size="h-7 w-7" animate className="[&_svg]:drop-shadow" />}
        </div>
      </div>

      <div className="tl-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Score" value={<span data-testid="practice-score">{s.score}</span>} delay={0} />
          {drill
            ? <Tile label="Clean" value={`${s.clean}/${pr.steps.length}`} delay={80} />
            : <Tile label={perform ? 'Stars' : 'Clean'} value={perform ? `${s.stars}/3` : `${s.clean}/${pr.steps.length}`} delay={80} />}
          {drill && s.focus
            ? <Tile label={DIM_NAME[s.focus.dim]} value={<span data-testid="focus-mean">{s.focus.mean}%</span>} delay={160} />
            : <Tile label={perform && s.newBest ? 'New best' : perform && s.firstScore !== undefined ? 'First try' : 'Strokes'} value={perform && s.newBest ? '★' : perform && s.firstScore !== undefined ? s.firstScore : pr.steps.length} delay={160} />}
        </div>

        <div className="mt-3 flex h-2 gap-[2px]" aria-label="Score per stroke">
          {pr.steps.map((_, i) => <span key={i} className={cn('h-full flex-1 rounded-full', resultTone(pr.results[i]))} title={`Stroke ${i + 1}: ${pr.results[i] ?? 'skipped'}`} />)}
        </div>

        {perform && (s.costly.length > 0 || s.worstText) && (
          <div className="tile-in mt-3 rounded-[14px] bg-[var(--low)] p-3" style={{ '--enter-delay': '260ms' } as React.CSSProperties}>
            {s.worstText && <div className="text-[12px] leading-snug text-[var(--text-1)]">{s.worstText}</div>}
            {s.costly.length > 0 && (
              <ul className={cn('space-y-1 text-[12px]', s.worstText && 'mt-2')} data-testid="critique">
                {s.costly.map((c) => (
                  <li key={c.step} className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--lvl)' }} aria-hidden />
                    <span className="text-[var(--text-2)]">Stroke {c.step + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[var(--text-1)]">{c.tip ? c.tip.text : c.score === 0 && pr.results[c.step] === null ? 'Skipped' : 'Off the line'}</span>
                    <span className="font-mono tabular-nums text-[var(--text-3)]">{c.score}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {perform && s.firstThumb && s.todayThumb && (
          <div className="tile-in mt-3 grid grid-cols-2 gap-2" data-testid="then-vs-now" style={{ '--enter-delay': '340ms' } as React.CSSProperties}>
            <figure className="m-0">
              <img src={s.firstThumb} alt="Your first Perform of this piece" className="w-full rounded-[12px] shadow-[var(--shadow-sm)]" />
              <figcaption className="mt-1 font-display text-[11px] font-bold text-[var(--text-3)]">First try · {s.firstScore}</figcaption>
            </figure>
            <figure className="m-0">
              <img src={s.todayThumb} alt="Today's Perform" className="w-full rounded-[12px] shadow-[var(--shadow-sm)]" />
              <figcaption className="mt-1 font-display text-[11px] font-bold text-[var(--text-3)]">Today · {s.score}</figcaption>
            </figure>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
          {!drill && (
            <Button variant="ghost" size="sm" aria-pressed={pr.guide} onClick={() => studio.setPracticeGuide(!pr.guide)}>
              {pr.guide ? <EyeOff /> : <Eye />}{pr.guide ? 'Hide reference' : 'Compare with the reference'}
            </Button>
          )}
          {mission && hasLesson(mission.id) && <Button variant="ghost" size="sm" onClick={() => navigate(sessionPath(mission.id, 'teach'))} data-testid="results-lesson"><BookOpen />Reread the lesson</Button>}
          <Button variant="ghost" size="sm" onClick={() => { studio.exitPractice(true); navigate(sketchPath()); }} title="Replaces the drawing you had open with this one">Keep this drawing</Button>
          <Button variant="ghost" size="sm" onClick={studio.exportPNG}>Export PNG</Button>
        </div>
      </div>

      <div className="safe-b flex shrink-0 gap-2 border-t border-[var(--hint)] px-5 pb-4 pt-3">
        <Button variant="duo-secondary" className="shrink-0" onClick={() => studio.restartPractice()} aria-label="Again"><RotateCcw className="h-4 w-4" />Again</Button>
        <Button variant="duo" className="min-w-0 flex-1" onClick={primary.to} data-testid={pr.part === 'guided' ? 'perform-now' : 'results-continue'}><span className="truncate">{primary.label}</span><ArrowRight className="h-4 w-4 shrink-0" /></Button>
      </div>
    </div>
  );
}
