import { Eye, EyeOff, Flame, RotateCcw, SkipForward, Undo2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TlTip } from '@/components/TlButton';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { BRUSH_TEMPLATES } from '@/engine/templates';
import { lessonById, lessonSteps, stepHint } from '@/practice/lessons';
import { verdictFor } from '@/practice/score';
import { cn } from '@/lib/utils';

export const resultTone = (r: number | null | undefined) =>
  r === null ? 'bg-[repeating-linear-gradient(45deg,#d9d5cd_0_3px,#eeeae2_3px_6px)]'
  : r === undefined ? 'bg-[var(--hint)]'
  : r >= 85 ? 'bg-[var(--success)]' : r >= 65 ? 'bg-[var(--accent)]' : r >= 35 ? 'bg-[var(--warning)]' : 'bg-[var(--danger)]';

const feedbackVariant = (accepted: boolean, score: number): 'danger' | 'success' | 'default' | 'warning' => (!accepted ? 'danger' : score >= 85 ? 'success' : score >= 65 ? 'default' : 'warning');

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
    <Card className="enter-up pointer-events-auto relative w-full p-3 text-[12px] short:p-2.5" data-testid="practice-panel">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-[var(--text-1)]">{lesson.title}</div>
          <div className="text-[11px] text-[var(--text-3)]">Step <span data-testid="practice-step">{practice.step + 1}</span> of {steps.length}</div>
        </div>
        {practice.streak >= 2 && (
          <Badge variant="warning" title="Consecutive steps at 80 or better"><Flame className="h-3 w-3" />×{practice.streak}</Badge>
        )}
        <TlTip label="Leave the lesson and return to your drawing" side="bottom">
          <Button variant="ghost" size="icon" aria-label="Exit lesson" onClick={() => studio.exitPractice(false)}><X /></Button>
        </TlTip>
      </div>

      <div className="mt-2 flex h-1.5 gap-[2px]" aria-hidden>
        {steps.map((_, i) => (
          <span key={i} className={cn('h-full flex-1 rounded-full transition-colors', i === practice.step ? 'guide-pulse-bar bg-[var(--accent)]/40' : resultTone(practice.results[i]))} />
        ))}
      </div>

      <div className="mt-2.5 flex items-start gap-2.5 short:mt-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] short:h-5 short:w-5" style={{ background: st.color }} />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-[var(--text-1)]">{template?.name ?? st.template} <span className="text-[var(--text-3)]">· size {st.size}</span></div>
          <div className="text-[11.5px] leading-snug text-[var(--text-2)] short:line-clamp-2">{stepHint(steps, practice.step)}</div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-1 short:mt-1.5">
        <TlTip label="Undo the last traced stroke" kbd="⌘Z" side="bottom">
          <Button variant="ghost" size="sm" disabled={practice.step === 0} onClick={studio.undo}><Undo2 />Undo</Button>
        </TlTip>
        <TlTip label="Skip this stroke (counts as 0)" kbd="N" side="bottom">
          <Button variant="ghost" size="sm" onClick={() => studio.skipStep()}><SkipForward />Skip</Button>
        </TlTip>
        <TlTip label={practice.guide ? 'Hide the remaining strokes (only the current one stays)' : 'Show the remaining strokes'} side="bottom">
          <Button variant="ghost" size="icon" aria-pressed={practice.guide} active={practice.guide} onClick={() => studio.setPracticeGuide(!practice.guide)}>
            {practice.guide ? <Eye /> : <EyeOff />}
          </Button>
        </TlTip>
        <TlTip label="Start the lesson over" kbd="C" side="bottom">
          <Button variant="ghost" size="icon" onClick={() => studio.restartPractice()}><RotateCcw /></Button>
        </TlTip>
        <div className="ml-auto">
          {fb && (
            <Badge key={fb.at} data-testid="practice-feedback" variant={feedbackVariant(fb.accepted, fb.score)} className="feedback-pop px-2.5 py-1 text-[11.5px]">
              {fb.accepted ? verdictFor(fb.score) : 'Try again'}
              <span className="font-mono tabular-nums">{fb.score}</span>
              {fb.reversed && <span className="font-normal opacity-90">· start at the dot</span>}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
