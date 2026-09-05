import { Eye, EyeOff, Flame, RotateCcw, SkipForward, Undo2, X } from 'lucide-react';
import { TlTip } from '@/components/TlButton';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { BRUSH_TEMPLATES } from '@/engine/templates';
import { lessonById, lessonSteps, stepHint } from '@/practice/lessons';
import { verdictFor } from '@/practice/score';
import { cn } from '@/lib/utils';

export const resultTone = (r: number | null | undefined) =>
  r === null ? 'bg-[repeating-linear-gradient(45deg,#d9d9d9_0_3px,#f0f0f0_3px_6px)]'
  : r === undefined ? 'bg-[var(--tl-hint)]'
  : r >= 85 ? 'bg-[#2fb344]' : r >= 65 ? 'bg-[var(--tl-selected)]' : r >= 35 ? 'bg-[#f2a541]' : 'bg-[#e03131]';

/** Top-centre step card while a lesson is active: progress, the brush in use, a hint, and the last score. */
export function PracticePanel() {
  const studio = useStudio();
  const practice = useStudioState((s) => s.practice);
  if (!practice || practice.status !== 'active') return null;
  const lesson = lessonById(practice.lessonId);
  if (!lesson) return null;
  const steps = lessonSteps(lesson);
  const st = steps[practice.step];
  const template = BRUSH_TEMPLATES.find((t) => t.id === st.template);
  const fb = practice.feedback;

  return (
    <div className="tl-panel pointer-events-auto relative w-full p-3 text-[12px] md:w-[420px]" data-testid="practice-panel">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-[var(--tl-text-1)]">{lesson.title}</div>
          <div className="text-[11px] text-[var(--tl-text-3)]">Step <span data-testid="practice-step">{practice.step + 1}</span> of {steps.length}</div>
        </div>
        {practice.streak >= 2 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1e6] px-2 py-0.5 text-[11px] font-semibold text-[#d9480f]" title="Consecutive steps at 80 or better">
            <Flame className="h-3.5 w-3.5" />×{practice.streak}
          </span>
        )}
        <TlTip label="Leave the lesson and return to your drawing" side="bottom">
          <button type="button" aria-label="Exit lesson" className="tl-opt h-8 w-8 px-0" onClick={() => studio.exitPractice(false)}><X className="h-4 w-4" /></button>
        </TlTip>
      </div>

      <div className="mt-2 flex h-1.5 gap-[2px]" aria-hidden>
        {steps.map((_, i) => (
          <span key={i} className={cn('h-full flex-1 rounded-full transition-colors', i === practice.step ? 'guide-pulse-bar bg-[var(--tl-selected)]/40' : resultTone(practice.results[i]))} />
        ))}
      </div>

      <div className="mt-2.5 flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]" style={{ background: st.color }} />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-[var(--tl-text-1)]">{template?.name ?? st.template} <span className="text-[var(--tl-text-3)]">· size {st.size}</span></div>
          <div className="text-[11.5px] leading-snug text-[var(--tl-text-2)]">{stepHint(steps, practice.step)}</div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-1">
        <TlTip label="Undo the last traced stroke" kbd="⌘Z" side="bottom">
          <button type="button" className="tl-opt gap-1 px-2" disabled={practice.step === 0} onClick={studio.undo}><Undo2 className="h-3.5 w-3.5" />Undo</button>
        </TlTip>
        <TlTip label="Skip this stroke (counts as 0)" kbd="N" side="bottom">
          <button type="button" className="tl-opt gap-1 px-2" onClick={() => studio.skipStep()}><SkipForward className="h-3.5 w-3.5" />Skip</button>
        </TlTip>
        <TlTip label={practice.guide ? 'Hide the remaining strokes (only the current one stays)' : 'Show the remaining strokes'} side="bottom">
          <button type="button" className="tl-opt w-8 px-0" aria-pressed={practice.guide} onClick={() => studio.setPracticeGuide(!practice.guide)}>
            {practice.guide ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
        </TlTip>
        <TlTip label="Start the lesson over" kbd="C" side="bottom">
          <button type="button" className="tl-opt w-8 px-0" onClick={() => studio.restartPractice()}><RotateCcw className="h-3.5 w-3.5" /></button>
        </TlTip>
        <div className="ml-auto">
          {fb && (
            <span
              key={fb.at}
              data-testid="practice-feedback"
              className={cn('feedback-pop inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-white',
                fb.accepted ? (fb.score >= 85 ? 'bg-[#2fb344]' : fb.score >= 65 ? 'bg-[var(--tl-selected)]' : 'bg-[#f2a541]') : 'bg-[#e03131]')}
            >
              {fb.accepted ? verdictFor(fb.score) : 'Try again'}
              <span className="font-mono tabular-nums">{fb.score}</span>
              {fb.reversed && <span className="font-normal opacity-90">· start at the dot</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
