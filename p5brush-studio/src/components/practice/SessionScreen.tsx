import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Flame, Repeat, RotateCcw, SkipForward, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { TlTip } from '@/components/TlButton';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { BRUSH_TEMPLATES } from '@/engine/templates';
import type { PracticeFeedback } from '@/engine/Studio';
import { TIERS, TIER_LABEL, levelVars, missionById, type Tier } from '@/practice/curriculum';
import { stepHint } from '@/practice/lessons';
import { learnPath, missionPath } from '@/practice/routes';
import { cn } from '@/lib/utils';

const pct = (v: number) => (Number.isNaN(v) ? 0 : Math.round(v * 100));

/** Three-segment ring: shape, pressure, speed. A missing dimension is a gap. */
function Ring({ fb }: { fb: PracticeFeedback }) {
  const segs = [fb.dims.shape, fb.dims.pressure, fb.dims.speed];
  const stops: string[] = [];
  segs.forEach((v, i) => {
    const a = i * 120, b = a + 120;
    if (Number.isNaN(v)) { stops.push(`rgba(255,255,255,0.18) ${a}deg ${b}deg`); return; }
    const fill = a + 116 * Math.max(0.06, v);
    stops.push(`currentColor ${a}deg ${fill}deg`, `rgba(255,255,255,0.25) ${fill}deg ${b}deg`);
  });
  return <span aria-hidden className="h-5 w-5 shrink-0 rounded-full" style={{ background: `conic-gradient(from -90deg, ${stops.join(', ')})`, maskImage: 'radial-gradient(circle, transparent 40%, #000 42%)', WebkitMaskImage: 'radial-gradient(circle, transparent 40%, #000 42%)' }} title={`shape ${pct(fb.dims.shape)} · pressure ${Number.isNaN(fb.dims.pressure) ? '–' : pct(fb.dims.pressure)} · speed ${Number.isNaN(fb.dims.speed) ? '–' : pct(fb.dims.speed)}`} />;
}

const FEEDBACK_MS = 2200;

/**
 * The feedback bar: a colour first, then the word. Green in band, amber with an
 * instruction, red for a miss; Perform stays neutral with the number only. It slides
 * up when a stroke is scored and away after two seconds; a new stroke retargets it.
 */
function FeedbackBar({ fb, perform }: { fb: PracticeFeedback | null; perform: boolean }) {
  const [shown, setShown] = useState<PracticeFeedback | null>(null);
  useEffect(() => {
    if (!fb) return;
    setShown(fb);
    const t = window.setTimeout(() => setShown((cur) => (cur === fb ? null : cur)), FEEDBACK_MS);
    return () => window.clearTimeout(t);
  }, [fb]);
  const f = shown ?? fb;
  const tone = !f ? 'neutral' : !f.accepted ? 'danger' : perform ? 'neutral' : f.tip ? 'warning' : 'success';
  const bg = tone === 'danger' ? 'var(--danger)' : tone === 'warning' ? 'var(--warning)' : tone === 'success' ? 'var(--success)' : 'var(--ink)';
  const text = !f ? '' : perform ? (f.accepted ? (f.score >= 85 ? 'Great' : 'Counted') : 'Try again') : f.tip ? f.tip.text : (f.praise ?? '');
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="practice-feedback"
      data-hidden={shown ? undefined : 'true'}
      data-tone={tone}
      className="feedback-bar flex min-h-[56px] w-full items-center gap-3 rounded-[16px] px-4 py-2.5 text-white shadow-[var(--shadow)] sm:w-auto sm:min-w-[260px] sm:max-w-[440px]"
      style={{ background: bg }}
    >
      {f && !perform && <Ring fb={f} />}
      <span className="min-w-0 flex-1 truncate font-display text-[15px] font-extrabold leading-tight">
        {text}
        {f?.looped && <span className="ml-1 text-[12px] font-bold opacity-80">· loop</span>}
      </span>
      {f && <span className="font-mono text-[15px] font-medium tabular-nums">{f.score}</span>}
    </div>
  );
}

/** Tiny picture of what each tier shows: a road, a line, two dots. */
function TierGlyph({ tier, active }: { tier: Tier; active: boolean }) {
  const c = active ? 'var(--lvl)' : 'var(--text-3)';
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden>
      {tier === 'full' && <path d="M3 11 C 8 3, 16 13, 21 5" fill="none" stroke={c} strokeOpacity={0.25} strokeWidth={5} strokeLinecap="round" />}
      {tier !== 'dots' && <path d="M3 11 C 8 3, 16 13, 21 5" fill="none" stroke={c} strokeWidth={1.4} strokeDasharray="2.5 2" />}
      <circle cx={3} cy={11} r={1.8} fill={c} />
      {tier === 'dots' && <circle cx={21} cy={5} r={1.8} fill="none" stroke={c} strokeWidth={1.2} />}
    </svg>
  );
}

/**
 * Session chrome: one stroke at a time. A top bar (close, a fat progress bar in the
 * level's colour, the streak), the instruction in the display face, the canvas, and
 * along the bottom the quiet controls and the feedback bar. Nothing else.
 */
export function SessionScreen() {
  const studio = useStudio();
  const navigate = useNavigate();
  const practice = useStudioState((s) => s.practice);
  const [leaving, setLeaving] = useState(false);
  if (!practice || practice.status !== 'active') return null;
  const pr = practice;
  const st = pr.steps[pr.step];
  const template = BRUSH_TEMPLATES.find((t) => t.id === st.template);
  const perform = pr.part === 'perform';
  const drill = pr.part === 'trainer' || pr.part === 'warmup';
  const level = pr.missionId ? missionById(pr.missionId)?.level ?? 0 : 0;
  const back = pr.missionId ? missionPath(pr.missionId) : learnPath();
  const progressPct = (pr.step / pr.steps.length) * 100;
  const leave = () => { if (perform && pr.step > 0) { setLeaving(true); return; } navigate(back); };

  return (
    <div className="pointer-events-none fixed inset-0 z-30" style={levelVars(level)} data-testid="practice-panel" data-part={pr.part}>
      {/* Top: close, progress, streak, then the instruction */}
      <div className="safe-t pointer-events-auto absolute left-0 right-0 px-3">
        <div className="mx-auto flex max-w-[760px] items-center gap-3">
          <TlTip label={perform ? 'Leave: this run is lost' : 'Leave the session'} side="bottom">
            <Button variant="ghost" size="icon" aria-label="Leave" onClick={leave} className="h-10 w-10 shrink-0 rounded-full bg-[var(--surface)] shadow-[var(--shadow-sm)]"><X /></Button>
          </TlTip>
          <div className="relative h-[14px] flex-1 overflow-hidden rounded-full bg-[var(--hint-strong)]" role="progressbar" aria-valuemin={0} aria-valuemax={pr.steps.length} aria-valuenow={pr.step} aria-label="Strokes done">
            <div className="bar-fill relative h-full rounded-full" style={{ width: `${Math.max(progressPct, pr.step > 0 ? 6 : 0)}%`, background: 'var(--lvl)' }}>
              <span aria-hidden className="absolute left-2 right-2 top-[3px] h-[3px] rounded-full bg-white/30" />
            </div>
          </div>
          {pr.streak >= 2 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 font-display text-[12.5px] font-extrabold text-[var(--warning)] shadow-[var(--shadow-sm)]" title="Consecutive strokes at 80 or better"><Flame className="h-3.5 w-3.5 fill-current" />{pr.streak}</span>
          )}
        </div>
        <div className="mx-auto mt-2.5 max-w-[760px] rounded-[16px] bg-[var(--surface)] px-4 py-2.5 shadow-[var(--shadow-sm)] backdrop-blur-md">
          <div className="font-display text-[17px] font-extrabold leading-tight text-[var(--text-1)] sm:text-[19px]">{stepHint(pr.steps, pr.step)}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-2)]">
            <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]" style={{ background: st.color }} />{template?.name ?? st.template} · size {st.size}</span>
            <span className="font-mono text-[11px] tabular-nums text-[var(--text-3)]">{pr.title} · {pr.subtitle} · {drill ? 'rep' : 'stroke'} <span data-testid="practice-step">{pr.step + 1}</span>/{pr.steps.length}{perform ? ` · ${TIER_LABEL[pr.tier].toLowerCase()}` : ''}</span>
            {!perform && (
              <span className="inline-flex items-center gap-0.5 rounded-[8px] bg-[var(--low)] p-0.5" role="radiogroup" aria-label="Guide">
                {TIERS.slice(0, 3).map((t) => (
                  <TlTip key={t} label={TIER_LABEL[t]} side="bottom">
                    <button type="button" role="radio" aria-checked={pr.tier === t} aria-label={TIER_LABEL[t]} onClick={() => studio.setPracticeTier(t)} className={cn('press h-6 w-6 rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--lvl)]', pr.tier === t ? 'bg-[var(--surface-solid)] shadow-[var(--shadow-sm)]' : 'hover:bg-[var(--hint)]')}>
                      <TierGlyph tier={t} active={pr.tier === t} />
                    </button>
                  </TlTip>
                ))}
              </span>
            )}
            {pr.note && <span className="font-medium text-[var(--lvl)]" data-testid="practice-note">{pr.note}</span>}
          </div>
        </div>
      </div>

      {/* Bottom: quiet controls left, the feedback bar right (full width on phones) */}
      <div className="safe-b pointer-events-auto absolute left-0 right-0 px-3">
        <div className="mx-auto flex max-w-[760px] flex-col items-stretch gap-2 sm:flex-row sm:items-end">
          <Card size="sm" className="flex w-fit items-center gap-0.5 p-1">
            <TlTip label="Undo the last stroke" kbd="⌘Z"><Button variant="ghost" size="sm" disabled={pr.step === 0} onClick={studio.undo}><Undo2 />Undo</Button></TlTip>
            {!perform && <TlTip label="Skip this stroke (counts as 0)" kbd="N"><Button variant="ghost" size="sm" onClick={() => studio.skipStep()}><SkipForward />Skip</Button></TlTip>}
            {pr.loopOffer && <Button variant="secondary" size="sm" onClick={() => studio.loopStep()} data-testid="loop" className="text-[var(--lvl)]"><Repeat />Loop ×3</Button>}
            <TlTip label="Start over" kbd="C"><Button variant="ghost" size="icon" onClick={() => studio.restartPractice()}><RotateCcw /></Button></TlTip>
          </Card>
          <div className="sm:ml-auto"><FeedbackBar fb={pr.feedback} perform={perform} /></div>
        </div>
      </div>

      <Dialog open={leaving} onOpenChange={(o) => setLeaving(o)}>
        <DialogContent aria-label="Leave this Perform?" className="w-[min(380px,calc(100vw-24px))] p-5">
          <DialogTitle className="font-display text-[19px] font-extrabold">Leave this Perform?</DialogTitle>
          <DialogDescription className="mt-1">You've drawn {pr.step} of {pr.steps.length} strokes. Leaving now means this run won't count.</DialogDescription>
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="duo" onClick={() => setLeaving(false)}>Keep going</Button>
            <Button variant="duo-secondary" onClick={() => navigate(back)}>Leave</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
