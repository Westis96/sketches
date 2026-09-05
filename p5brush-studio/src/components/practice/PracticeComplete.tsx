import { ArrowRight, Eye, EyeOff, RotateCcw } from 'lucide-react';
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
    <div className="tl-panel pointer-events-auto w-[min(400px,calc(100vw-16px))] p-4 text-[12px]" data-testid="practice-complete">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--tl-text-3)]">Lesson complete</div>
          <div className="text-[15px] font-semibold text-[var(--tl-text-1)]">{lesson.title}</div>
        </div>
        <Stars n={stars} size="h-6 w-6" animate />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-[28px] font-semibold tabular-nums leading-none text-[var(--tl-text-1)]" data-testid="practice-score">{score}</span>
        <span className="text-[var(--tl-text-3)]">/ 100</span>
        {newBest && <span className="ml-1 rounded-full bg-[#e7f5ff] px-2 py-0.5 text-[11px] font-semibold text-[var(--tl-selected)]">New best</span>}
        {skipped > 0 && <span className="text-[11px] text-[var(--tl-text-3)]">{skipped} skipped</span>}
      </div>
      <div className="mt-1 text-[12px] text-[var(--tl-text-2)]">{line}</div>
      <div className="mt-2.5 flex h-2 gap-[2px]" aria-label="Score per step">
        {steps.map((_, i) => <span key={i} className={cn('h-full flex-1 rounded-full', resultTone(practice.results[i]))} title={`Step ${i + 1}: ${practice.results[i] ?? 'skipped'}`} />)}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {next
          ? <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-[var(--tl-selected)] px-3 font-medium text-white hover:bg-[#2a74d8]" onClick={() => studio.startPractice(next.id)}>Next: {next.title}<ArrowRight className="h-4 w-4" /></button>
          : <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-[var(--tl-selected)] px-3 font-medium text-white hover:bg-[#2a74d8]" onClick={onChooseLesson}>Choose a lesson<ArrowRight className="h-4 w-4" /></button>}
        <button type="button" className="tl-opt h-9 gap-1.5 px-3" onClick={() => studio.restartPractice()}><RotateCcw className="h-3.5 w-3.5" />Try again</button>
        <button type="button" className="tl-opt h-9 gap-1.5 px-3" aria-pressed={practice.guide} onClick={() => studio.setPracticeGuide(!practice.guide)}>
          {practice.guide ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{practice.guide ? 'Hide reference' : 'Compare'}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1.5 border-t border-[var(--tl-hint)] pt-2 text-[11px]">
        <button type="button" className="tl-opt h-8 px-2" onClick={() => studio.exitPractice(false)}>Back to my drawing</button>
        <button type="button" className="tl-opt h-8 px-2" onClick={() => studio.exitPractice(true)} title="Replaces the drawing you had open with this one">Keep this drawing</button>
        <button type="button" className="tl-opt ml-auto h-8 px-2" onClick={studio.exportPNG}>Export PNG</button>
      </div>
    </div>
  );
}
