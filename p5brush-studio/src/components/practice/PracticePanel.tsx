import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Flame, Repeat, RotateCcw, SkipForward, Undo2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TlTip } from '@/components/TlButton';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { BRUSH_TEMPLATES } from '@/engine/templates';
import type { PracticeFeedback } from '@/engine/Studio';
import { TIERS, TIER_LABEL, type Tier } from '@/practice/curriculum';
import { stepHint } from '@/practice/lessons';
import { learnPath, missionPath } from '@/practice/routes';
import { cn } from '@/lib/utils';

export const resultTone = (r: number | null | undefined) =>
  r === null ? 'bg-[repeating-linear-gradient(45deg,#d9d5cd_0_3px,#eeeae2_3px_6px)]'
  : r === undefined ? 'bg-[var(--hint)]'
  : r >= 85 ? 'bg-[var(--success)]' : r >= 70 ? 'bg-[var(--accent)]' : r >= 50 ? 'bg-[var(--warning)]' : 'bg-[var(--danger)]';

const pct = (v: number) => (Number.isNaN(v) ? 0 : Math.round(v * 100));

/** Three-segment ring: shape, pressure, speed. A missing dimension is a gap. */
function Ring({ fb }: { fb: PracticeFeedback }) {
  const segs = [fb.dims.shape, fb.dims.pressure, fb.dims.speed];
  const stops: string[] = [];
  segs.forEach((v, i) => {
    const a = i * 120, b = a + 120;
    if (Number.isNaN(v)) { stops.push(`rgba(255,255,255,0.18) ${a}deg ${b}deg`); return; }
    const fill = a + 116 * Math.max(0.06, v);
    stops.push(`currentColor ${a}deg ${fill}deg`, `rgba(255,255,255,0.22) ${fill}deg ${b}deg`);
  });
  return <span aria-hidden className="h-4 w-4 shrink-0 rounded-full" style={{ background: `conic-gradient(from -90deg, ${stops.join(', ')})`, maskImage: 'radial-gradient(circle, transparent 42%, #000 44%)', WebkitMaskImage: 'radial-gradient(circle, transparent 42%, #000 44%)' }} title={`shape ${pct(fb.dims.shape)} · pressure ${Number.isNaN(fb.dims.pressure) ? '–' : pct(fb.dims.pressure)} · speed ${Number.isNaN(fb.dims.speed) ? '–' : pct(fb.dims.speed)}`} />;
}

const pillVariant = (fb: PracticeFeedback): 'danger' | 'success' | 'default' | 'warning' =>
  !fb.accepted ? 'danger' : fb.tip ? 'warning' : fb.score >= 85 ? 'success' : 'default';

/**
 * The step card while a session is active: what to draw, how far along, the
 * assist tier, and the feedback pill (bandwidth rule: it only instructs when a
 * dimension is out of band; Perform shows the number only).
 */
export function PracticePanel() {
  const studio = useStudio();
  const navigate = useNavigate();
  const practice = useStudioState((s) => s.practice);
  const [confirmLeave, setConfirmLeave] = useState(false);
  if (!practice || practice.status !== 'active') return null;
  const pr = practice;
  const st = pr.steps[pr.step];
  const template = BRUSH_TEMPLATES.find((t) => t.id === st.template);
  const fb = pr.feedback;
  const perform = pr.part === 'perform';
  const drill = pr.part === 'trainer' || pr.part === 'warmup';
  const back = pr.missionId ? missionPath(pr.missionId) : learnPath();
  const leave = () => { if (perform && pr.step > 0 && !confirmLeave) { setConfirmLeave(true); return; } navigate(back); };

  return (
    <Card className="enter-up pointer-events-auto relative w-full p-3 text-[12px] short:p-2.5" data-testid="practice-panel" data-part={pr.part}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-[var(--text-1)]">{pr.title}</div>
          <div className="text-[11px] text-[var(--text-3)]">
            {pr.subtitle} · {drill ? 'Rep' : 'Stroke'} <span data-testid="practice-step">{pr.step + 1}</span> of {pr.steps.length}
            {perform && <span> · {TIER_LABEL[pr.tier].toLowerCase()}</span>}
          </div>
        </div>
        {pr.streak >= 2 && (
          <Badge variant="warning" title="Consecutive strokes at 80 or better"><Flame className="h-3 w-3" />×{pr.streak}</Badge>
        )}
        <TlTip label={perform ? 'Leave: this run is lost' : 'Leave the session'} side="bottom">
          <Button variant="ghost" size="icon" aria-label="Leave" onClick={leave}><X /></Button>
        </TlTip>
      </div>

      {confirmLeave && (
        <div className="mt-2 flex items-center gap-2 rounded-[10px] bg-[var(--accent-soft)] px-2.5 py-2 text-[11.5px] text-[var(--accent-strong)]">
          <span className="flex-1">Leave now? This Perform won't count.</span>
          <Button size="xs" variant="danger" onClick={() => navigate(back)}>Leave</Button>
          <Button size="xs" variant="ghost" onClick={() => setConfirmLeave(false)}>Stay</Button>
        </div>
      )}

      <div className="mt-2 flex h-1.5 gap-[2px]" aria-hidden>
        {pr.steps.map((_, i) => (
          <span key={i} className={cn('h-full flex-1 rounded-full transition-colors', i === pr.step ? 'guide-pulse-bar bg-[var(--accent)]/40' : resultTone(pr.results[i]))} />
        ))}
      </div>

      <div className="mt-2.5 flex items-start gap-2.5 short:mt-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] short:h-5 short:w-5" style={{ background: st.color }} />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-[var(--text-1)]">{template?.name ?? st.template} <span className="text-[var(--text-3)]">· size {st.size}</span></div>
          <div className="text-[11.5px] leading-snug text-[var(--text-2)] short:line-clamp-2">{stepHint(pr.steps, pr.step)}</div>
        </div>
      </div>

      {pr.note && <div className="mt-1.5 text-[11px] text-[var(--accent-strong)]" data-testid="practice-note">{pr.note}</div>}

      <div className="mt-2.5 flex flex-wrap items-center gap-1 short:mt-1.5">
        <TlTip label="Undo the last stroke" kbd="⌘Z" side="bottom">
          <Button variant="ghost" size="sm" disabled={pr.step === 0} onClick={studio.undo}><Undo2 />Undo</Button>
        </TlTip>
        {!perform && (
          <TlTip label="Skip this stroke (counts as 0)" kbd="N" side="bottom">
            <Button variant="ghost" size="sm" onClick={() => studio.skipStep()}><SkipForward />Skip</Button>
          </TlTip>
        )}
        {pr.loopOffer && (
          <Button variant="secondary" size="sm" onClick={() => studio.loopStep()} data-testid="loop"><Repeat />Loop ×3</Button>
        )}
        {!perform && (
          <span className="ml-0.5 inline-flex items-center gap-0.5 rounded-[8px] bg-[var(--low)] p-0.5" role="radiogroup" aria-label="Guide">
            {TIERS.slice(0, 3).map((t: Tier) => (
              <TlTip key={t} label={TIER_LABEL[t]} side="bottom">
                <button
                  type="button"
                  role="radio"
                  aria-checked={pr.tier === t}
                  aria-label={TIER_LABEL[t]}
                  onClick={() => studio.setPracticeTier(t)}
                  className={cn('press h-6 w-6 rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]', pr.tier === t ? 'bg-[var(--surface)] shadow-[var(--shadow-sm)]' : 'hover:bg-[var(--hint)]')}
                >
                  <TierGlyph tier={t} active={pr.tier === t} />
                </button>
              </TlTip>
            ))}
          </span>
        )}
        <TlTip label="Start over" kbd="C" side="bottom">
          <Button variant="ghost" size="icon" onClick={() => studio.restartPractice()}><RotateCcw /></Button>
        </TlTip>
        <div className="ml-auto">
          {fb && (
            <Badge key={fb.at} data-testid="practice-feedback" variant={pillVariant(fb)} className="feedback-pop max-w-[240px] gap-1.5 px-2 py-1 text-[11.5px]">
              {!perform && <Ring fb={fb} />}
              <span className="truncate">
                {perform ? (fb.accepted ? '' : 'Try again') : fb.tip ? fb.tip.text : fb.praise}
                {fb.looped && <span className="font-normal opacity-90"> · loop</span>}
              </span>
              <span className="font-mono tabular-nums">{fb.score}</span>
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Tiny picture of what each tier shows: a road, a line, two dots. */
function TierGlyph({ tier, active }: { tier: Tier; active: boolean }) {
  const c = active ? 'var(--accent)' : 'var(--text-3)';
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6" aria-hidden>
      {tier === 'full' && <path d="M3 11 C 8 3, 16 13, 21 5" fill="none" stroke={c} strokeOpacity={0.25} strokeWidth={5} strokeLinecap="round" />}
      {tier !== 'dots' && <path d="M3 11 C 8 3, 16 13, 21 5" fill="none" stroke={c} strokeWidth={1.4} strokeDasharray="2.5 2" />}
      <circle cx={3} cy={11} r={1.8} fill={c} />
      {tier === 'dots' && <circle cx={21} cy={5} r={1.8} fill="none" stroke={c} strokeWidth={1.2} />}
    </svg>
  );
}
