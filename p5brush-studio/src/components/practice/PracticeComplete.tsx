import { ArrowRight, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Stars } from './PracticePicker';
import { resultTone } from './PracticePanel';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { LESSONS, lessonById, lessonSteps } from '@/practice/lessons';
import { cn } from '@/lib/utils';

/** Bottom-centre result card once every step is done: stars, score, per-step bars and what to do next. */
export function PracticeComplete({ onChooseLesson }: { onChooseLesson: () => void }) {
  const studio = useStudio();
  const practice = useStudioState((s) => s.practice);
  if (!practice || practice.status !== 'complete' || !practice.summary) return null;
  const lesson = lessonById(practice.lessonId);
  if (!lesson) return null;
  const steps = lessonSteps(lesson);
  const { score, stars, newBest } = practice.summary;
  const idx = LESSONS.findIndex((l) => l.id === lesson.id);
  const next = LESSONS[idx + 1];
  const skipped = practice.results.filter((r) => r === null).length;
  const line = stars === 3 ? 'Beautiful control.' : stars === 2 ? 'Solid. A few strokes drifted.' : stars === 1 ? 'Finished. Try it again with the guide on.' : 'Rough one. Slow down and start each stroke at the dot.';

  return (
    <Card className="enter-up pointer-events-auto w-[min(400px,calc(100vw-16px))] p-4 text-[12px]" data-testid="practice-complete">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="tl-label mb-0">Lesson complete</div>
          <div className="text-[15px] font-semibold text-[var(--text-1)]">{lesson.title}</div>
        </div>
        <Stars n={stars} size="h-6 w-6" animate />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-[28px] font-semibold tabular-nums leading-none text-[var(--text-1)]" data-testid="practice-score">{score}</span>
        <span className="text-[var(--text-3)]">/ 100</span>
        {newBest && <Badge variant="accent" className="ml-1">New best</Badge>}
        {skipped > 0 && <span className="text-[11px] text-[var(--text-3)]">{skipped} skipped</span>}
      </div>
      <div className="mt-1 text-[12px] text-[var(--text-2)]">{line}</div>
      <div className="mt-2.5 flex h-2 gap-[2px]" aria-label="Score per step">
        {steps.map((_, i) => <span key={i} className={cn('h-full flex-1 rounded-full', resultTone(practice.results[i]))} title={`Step ${i + 1}: ${practice.results[i] ?? 'skipped'}`} />)}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {next
          ? <Button onClick={() => studio.startPractice(next.id)}>Next: {next.title}<ArrowRight /></Button>
          : <Button onClick={onChooseLesson}>Choose a lesson<ArrowRight /></Button>}
        <Button variant="secondary" onClick={() => studio.restartPractice()}><RotateCcw />Try again</Button>
        <Button variant="ghost" aria-pressed={practice.guide} onClick={() => studio.setPracticeGuide(!practice.guide)}>
          {practice.guide ? <EyeOff /> : <Eye />}{practice.guide ? 'Hide reference' : 'Compare'}
        </Button>
      </div>
      <Separator className="my-2" />
      <div className="flex items-center gap-1.5 text-[11px]">
        <Button variant="ghost" size="sm" onClick={() => studio.exitPractice(false)}>Back to my drawing</Button>
        <Button variant="ghost" size="sm" onClick={() => studio.exitPractice(true)} title="Replaces the drawing you had open with this one">Keep this drawing</Button>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={studio.exportPNG}>Export PNG</Button>
      </div>
    </Card>
  );
}
