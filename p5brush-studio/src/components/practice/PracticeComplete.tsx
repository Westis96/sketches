import { useNavigate } from 'react-router';
import { ArrowRight, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Stars } from './Stars';
import { resultTone } from './PracticePanel';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { missionById, nextMission, partsOf } from '@/practice/curriculum';
import { missionDone } from '@/practice/progress';
import { learnPath, missionPath, sessionPath } from '@/practice/routes';
import { cn } from '@/lib/utils';

/**
 * The result card once a run is complete. Trainers and the warm-up summarise;
 * a guided run hands over to Perform; a Perform gets the critique: stars, the
 * costliest strokes (highlighted on the canvas), the dimension that cost the
 * most, and then-vs-now against the first Perform of this mission.
 */
export function PracticeComplete() {
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
  const again = () => studio.restartPractice();

  const heading = pr.part === 'warmup' ? 'Warm-up done' : pr.part === 'trainer' ? 'Drill done' : pr.part === 'guided' ? 'Guided run done' : 'Perform complete';
  const line = perform
    ? s.stars === 3 ? 'Beautiful control.' : s.stars === 2 ? 'Solid. A few strokes drifted.' : s.stars === 1 ? 'Finished. Once more with the guide, then again.' : 'Rough one. Back to the guided run, then try again.'
    : drill ? (s.clean >= pr.steps.length * 0.8 ? 'Clean. Ready for the piece.' : 'Warm. One more round would not hurt.')
    : s.score >= 85 ? 'You know this one. Perform it.' : s.score >= 65 ? 'Close. Perform it, or run it once more.' : 'Run it again with the full guide before you perform.';

  return (
    <Card className="enter-up pointer-events-auto w-[min(420px,calc(100vw-16px))] p-4 text-[12px]" data-testid="practice-complete" data-part={pr.part}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="tl-label mb-0">{heading}</div>
          <div className="truncate text-[15px] font-semibold text-[var(--text-1)]">{pr.title}</div>
        </div>
        {perform && <Stars n={s.stars} size="h-6 w-6" animate />}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-[28px] font-semibold tabular-nums leading-none text-[var(--text-1)]" data-testid="practice-score">{s.score}</span>
        <span className="text-[var(--text-3)]">/ 100</span>
        {drill && <span className="text-[11.5px] text-[var(--text-2)]"><span className="font-mono tabular-nums">{s.clean}</span> of {pr.steps.length} clean</span>}
        {perform && s.newBest && <Badge variant="accent" className="ml-1">New best</Badge>}
        {perform && s.firstScore !== undefined && !s.newBest && <span className="text-[11px] text-[var(--text-3)]">first try {s.firstScore}</span>}
      </div>
      <div className="mt-1 text-[12px] text-[var(--text-2)]">{line}</div>
      <div className="mt-2.5 flex h-2 gap-[2px]" aria-label="Score per stroke">
        {pr.steps.map((_, i) => <span key={i} className={cn('h-full flex-1 rounded-full', resultTone(pr.results[i]))} title={`Stroke ${i + 1}: ${pr.results[i] ?? 'skipped'}`} />)}
      </div>

      {perform && (s.costly.length > 0 || s.worstText) && (
        <div className="mt-3 rounded-[12px] bg-[var(--low)] p-2.5">
          {s.worstText && <div className="text-[11.5px] leading-snug text-[var(--text-1)]">{s.worstText}</div>}
          {s.costly.length > 0 && (
            <ul className={cn('space-y-1 text-[11.5px]', s.worstText && 'mt-2')} data-testid="critique">
              {s.costly.map((c) => (
                <li key={c.step} className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden />
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
        <div className="mt-3 grid grid-cols-2 gap-2" data-testid="then-vs-now">
          <figure className="m-0">
            <img src={s.firstThumb} alt="Your first Perform of this piece" className="w-full rounded-[10px] shadow-[var(--shadow-sm)]" />
            <figcaption className="mt-1 text-[10.5px] text-[var(--text-3)]">First try · {s.firstScore}</figcaption>
          </figure>
          <figure className="m-0">
            <img src={s.todayThumb} alt="Today's Perform" className="w-full rounded-[10px] shadow-[var(--shadow-sm)]" />
            <figcaption className="mt-1 text-[10.5px] text-[var(--text-3)]">Today · {s.score}</figcaption>
          </figure>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {pr.part === 'warmup' && (next
          ? <Button onClick={() => navigate(missionPath(next.id))}>Continue: {next.id} {next.title}<ArrowRight /></Button>
          : <Button onClick={() => navigate(learnPath())}>To the path<ArrowRight /></Button>)}
        {pr.part === 'trainer' && mission && (partsOf(mission).includes('guided')
          ? <Button onClick={() => navigate(sessionPath(mission.id, 'guided'))}>Next: Guided piece<ArrowRight /></Button>
          : next ? <Button onClick={() => navigate(missionPath(next.id))}>Next: {next.id} {next.title}<ArrowRight /></Button> : <Button onClick={() => navigate(learnPath())}>To the path<ArrowRight /></Button>)}
        {pr.part === 'guided' && mission && <Button onClick={() => navigate(sessionPath(mission.id, 'perform'))} data-testid="perform-now">Perform now<ArrowRight /></Button>}
        {perform && (next && next.id !== mission?.id
          ? <Button onClick={() => navigate(missionPath(next.id))}>Next: {next.id} {next.title}<ArrowRight /></Button>
          : <Button onClick={() => navigate(learnPath())}>To the path<ArrowRight /></Button>)}
        <Button variant="secondary" onClick={again}><RotateCcw />Again</Button>
        {!drill && (
          <Button variant="ghost" aria-pressed={pr.guide} onClick={() => studio.setPracticeGuide(!pr.guide)}>
            {pr.guide ? <EyeOff /> : <Eye />}{pr.guide ? 'Hide reference' : 'Compare'}
          </Button>
        )}
      </div>
      <Separator className="my-2" />
      <div className="flex items-center gap-1.5 text-[11px]">
        <Button variant="ghost" size="sm" onClick={() => navigate(pr.missionId ? missionPath(pr.missionId) : learnPath())}>Back</Button>
        <Button variant="ghost" size="sm" onClick={() => { studio.exitPractice(true); navigate('/'); }} title="Replaces the drawing you had open with this one">Keep this drawing</Button>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={studio.exportPNG}>Export PNG</Button>
      </div>
    </Card>
  );
}
