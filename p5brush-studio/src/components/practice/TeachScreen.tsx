import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, Check, Lightbulb, PenLine, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TlTip } from '@/components/TlButton';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { levelVars, missionById, playedParts, type Mission, type Part } from '@/practice/curriculum';
import { demoMotion, labelAnchor, pressureVaries, teachSlides, type DemoStroke, type TeachSlide } from '@/practice/teach';
import { missionPath, sessionPath } from '@/practice/routes';
import { cn } from '@/lib/utils';
import { sfx } from '@/sound/sfx';

const PART_NAME: Record<Part, string> = { teach: 'Lesson', trainer: 'Trainer', guided: 'Guided piece', perform: 'Perform' };

/**
 * The lesson: slides docked beside the paper (a right column on wide screens, the
 * lower half on phones) while the engine draws each slide's demo strokes with the
 * real brush. A pen tip glides ahead of the ink at exactly the demo's pace; compare
 * slides draw the right way and the wrong way in turn, labelled on the paper; a
 * pressure trace in the panel shows the hand's weight along the stroke. The last
 * slide invites a try-out, unscored, then hands over to the first played part.
 */
export function TeachScreen() {
  const practice = useStudioState((s) => s.practice);
  if (!practice || practice.part !== 'teach' || !practice.missionId) return null;
  const mission = missionById(practice.missionId);
  if (!mission) return null;
  return <Slides key={mission.id} mission={mission} />;
}

/** The pen: a ring that travels the demo stroke on the paper with the demo's own pacing (pauses and flicks included). */
function PenTip({ d, z }: { d: DemoStroke; z: number }) {
  const m = demoMotion(d);
  const p0 = d.points[0];
  return (
    <circle className="pen-tip" cx={p0.x} cy={p0.y} r={7 / z} fill="#fff" stroke="var(--lvl)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" data-testid="pen-tip">
      <animateMotion begin={`${((d.delay ?? 0) / 1000).toFixed(2)}s`} dur={`${m.dur.toFixed(3)}s`} fill="freeze" path={m.path} keyPoints={m.keyPoints} keyTimes={m.keyTimes} calcMode="linear" />
    </circle>
  );
}

/** Pressure along the stroke as a small area chart, with a cursor that follows the pen. */
function PressureTrace({ d, live, tone }: { d: DemoStroke; live: boolean; tone: string }) {
  const W = 320, H = 44;
  const n = d.points.length;
  const cum: number[] = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(d.points[i].x - d.points[i - 1].x, d.points[i].y - d.points[i - 1].y));
  const L = cum[n - 1] || 1;
  const top = d.points.map((p, i) => `${((cum[i] / L) * W).toFixed(1)} ${(H - 4 - p.p * (H - 8)).toFixed(1)}`);
  const area = `M0 ${H}L${top.join('L')}L${W} ${H}Z`;
  const line = 'M' + top.join('L');
  const m = demoMotion(d);
  return (
    <div className="mt-3" data-testid="pressure-trace">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-display text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[var(--text-3)]">Pressure along the stroke</span>
        {d.label && <span className="truncate pl-2 text-[11px] font-semibold" style={{ color: tone }}>{d.label}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-11 w-full overflow-visible rounded-[8px] bg-[var(--low)]" aria-hidden preserveAspectRatio="none">
        <path d={area} fill={tone} opacity={0.18} />
        <path d={line} fill="none" stroke={tone} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {live && (
          <g>
            <line x1={0} x2={0} y1={0} y2={H} stroke="var(--text-1)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" opacity={0.7} />
            <animateMotion begin={`${((d.delay ?? 0) / 1000).toFixed(2)}s`} dur={`${m.dur.toFixed(3)}s`} fill="freeze" path={`M0 0L${W} 0`} keyPoints={m.keyPoints} keyTimes={m.keyTimes} calcMode="linear" />
          </g>
        )}
      </svg>
    </div>
  );
}

function Slides({ mission }: { mission: Mission }) {
  const studio = useStudio();
  const navigate = useNavigate();
  const view = useStudioState((s) => s.view);
  const demoOn = useStudioState((s) => s.demo);
  const slides = teachSlides(mission.id);
  const [i, setI] = useState(0);
  /** Which way the last slide change went, for the entrance direction. */
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  /** Demos of the current slide already on the paper. */
  const [played, setPlayed] = useState(0);
  /** Bumps on every play so the paper animations restart on a replay. */
  const [take, setTake] = useState(0);
  const run = useRef(0);
  const slide: TeachSlide = slides[i];
  const last = i === slides.length - 1;
  const nextPart = playedParts(mission)[0];

  // Each slide clears the paper and plays its demos in turn; a slide change or a
  // replay abandons the run in progress (interruptible, never queued).
  const play = useCallback(async (k: number) => {
    const id = ++run.current;
    studio.clearDemo();
    setPlayed(0);
    setTake((t) => t + 1);
    const demos = slides[k]?.demos ?? [];
    for (let d = 0; d < demos.length; d++) {
      // The pen lands after the demo's lead-in beat.
      window.setTimeout(() => { if (run.current === id) sfx.play('penDown'); }, demos[d].delay ?? 0);
      const ok = await studio.playDemo(demos[d]);
      if (run.current !== id) return;
      if (!ok) return;
      setPlayed(d + 1);
      if (demos[d].label && demos[d].good !== undefined) sfx.play(demos[d].good ? 'good' : 'bad');
    }
  }, [studio, slides]);
  useEffect(() => { void play(i); }, [i, play]);
  useEffect(() => () => { run.current++; studio.stopDemo(); }, [studio]);

  const finish = () => { studio.markTaught(mission.id); navigate(sessionPath(mission.id, nextPart)); };
  // Buttons already click; a keyboard slide change gets the page cue instead.
  const go = (k: number, viaKey = false) => { if (k === i) return; if (viaKey) sfx.play('slide'); setDir(k > i ? 'fwd' : 'back'); setI(Math.max(0, Math.min(slides.length - 1, k))); };
  const next = (viaKey = false) => (last ? finish() : go(i + 1, viaKey));
  const back = (viaKey = false) => go(i - 1, viaKey);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (['input', 'textarea', 'select'].includes(el.tagName?.toLowerCase()) || el.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(true); }
      else if (e.key.toLowerCase() === 'r') { e.preventDefault(); void play(i); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const z = view.zoom;
  const demos = slide.demos ?? [];
  const compare = demos.some((d) => d.good !== undefined);
  const shown = Math.min(demos.length, played + (demoOn ? 1 : 0));
  const current = demoOn && shown > 0 ? demos[shown - 1] : null;
  // The trace follows the stroke being drawn, then stays on the last one that showed pressure.
  const traced = current && pressureVaries(current) ? current : [...demos.slice(0, played)].reverse().find(pressureVaries) ?? null;
  const toneOf = (d: DemoStroke) => (d.good === true ? 'var(--success)' : d.good === false ? 'var(--danger)' : 'var(--lvl)');

  return (
    <div className="pointer-events-none fixed inset-0 z-30" style={levelVars(mission.level)} data-testid="teach-panel" data-slide={i}>
      {/* Labels and the pen on the paper, in world units */}
      <svg aria-hidden className="absolute inset-0 h-full w-full overflow-visible" data-testid="teach-labels">
        <g transform={`translate(${view.x} ${view.y}) scale(${z})`}>
          {demos.slice(0, shown).map((d, k) => {
            const a = labelAnchor(d);
            const tone = d.good === true ? 'var(--success)' : d.good === false ? 'var(--danger)' : 'var(--text-2)';
            return d.label ? (
              <text key={`${take}-${k}`} x={a.x} y={a.y} fontSize={14 / z} fontWeight={800} fontFamily="Nunito, system-ui, sans-serif" fill={tone} stroke="var(--paper)" strokeWidth={4 / z} paintOrder="stroke" strokeLinejoin="round" className="label-in" data-teach-label>
                {d.good === true ? '✓ ' : d.good === false ? '✗ ' : ''}{d.label}
              </text>
            ) : null;
          })}
          {current && <PenTip key={`${take}-${shown - 1}`} d={current} z={z} />}
        </g>
      </svg>

      {/* Close, top left over the paper */}
      <div className="safe-t safe-l pointer-events-auto absolute">
        <TlTip label="Back to the mission" side="bottom">
          <Button variant="ghost" size="icon" aria-label="Leave the lesson" onClick={() => navigate(missionPath(mission.id))} className="h-10 w-10 rounded-full bg-[var(--surface)] shadow-[var(--shadow-sm)]"><X /></Button>
        </TlTip>
      </div>

      {/* The slides */}
      <div
        className={cn(
          'pointer-events-auto fixed flex flex-col overflow-hidden bg-[var(--surface-solid)] shadow-[var(--shadow)]',
          'inset-x-0 bottom-0 max-h-[50%] rounded-t-[22px] max-md:enter-up',
          'md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[400px] md:rounded-none md:rounded-l-[22px] md:enter-right',
        )}
      >
        <div className="px-5 pb-3 pt-4 text-white" style={{ background: 'var(--lvl)' }}>
          <div className="sheet-grip mb-2 bg-white/40 md:hidden" />
          <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.08em] opacity-85">Lesson · Mission {mission.id}</div>
          <div className="truncate font-display text-[19px] font-extrabold leading-tight">{mission.title}</div>
          <div className="mt-2.5 flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={i + 1} aria-label="Slide">
            {slides.map((_, k) => (
              <span key={k} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/30">
                <span className="pill-fill block h-full rounded-full bg-white" style={{ transform: `scaleX(${k <= i ? 1 : 0})` }} />
              </span>
            ))}
          </div>
        </div>

        <div key={i} className={cn('tl-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4', dir === 'fwd' ? 'slide-fwd' : 'slide-back')}>
          <h2 className="font-display text-[20px] font-extrabold leading-tight text-[var(--text-1)]" data-testid="teach-title">{slide.title}</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-2)]">{slide.body}</p>
          {slide.cue && (
            <div className="mt-3 flex items-start gap-2 rounded-[12px] bg-[var(--low)] px-3 py-2" data-testid="teach-cue">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lvl)]" />
              <div>
                <div className="font-display text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[var(--lvl)]">Cue</div>
                <div className="font-display text-[14px] font-extrabold leading-snug text-[var(--text-1)]">{slide.cue}</div>
              </div>
            </div>
          )}
          {compare && (
            <ul className="mt-3 flex flex-col gap-1.5 text-[12.5px]">
              {demos.filter((d) => d.label).map((d) => {
                const k = demos.indexOf(d);
                const landed = k < played, drawing = k === shown - 1 && demoOn;
                return (
                  <li key={k} className={cn('flex items-center gap-2 transition-opacity duration-250 ease-out', landed || drawing ? 'opacity-100' : 'opacity-35')}>
                    <span key={landed ? `${take}-on` : 'off'} className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full text-white', landed && 'badge-pop', d.good === false ? 'bg-[var(--danger)]' : 'bg-[var(--success)]')}>
                      {d.good === false ? <X className="h-3 w-3" strokeWidth={3} /> : <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="text-[var(--text-1)]">{d.label}</span>
                    {drawing && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--lvl)] guide-start" aria-hidden />}
                  </li>
                );
              })}
            </ul>
          )}
          {traced && <PressureTrace key={`${take}-${demos.indexOf(traced)}`} d={traced} live={traced === current} tone={toneOf(traced)} />}
          {slide.tryIt && (
            <div className="mt-3 flex items-center gap-2 rounded-[12px] border-2 border-dashed border-[var(--hint-strong)] px-3 py-2 text-[12.5px] text-[var(--text-2)]" data-testid="teach-try">
              <PenLine className="h-4 w-4 shrink-0 text-[var(--lvl)]" />Draw on the paper. Nothing here is scored.
            </div>
          )}
        </div>

        <div className="safe-b flex shrink-0 items-center gap-2 border-t border-[var(--hint)] px-5 pb-4 pt-3">
          {demos.length > 0 && (
            <TlTip label="Play the demo again" kbd="R">
              <Button variant="duo-secondary" size="icon" className="h-11 w-11 shrink-0" aria-label="Replay" onClick={() => void play(i)} data-testid="teach-replay"><RotateCcw className="h-4 w-4" /></Button>
            </TlTip>
          )}
          {i > 0 && <Button variant="duo-secondary" size="icon" className="h-11 w-11 shrink-0" aria-label="Previous slide" onClick={() => back()} data-testid="teach-back"><ArrowLeft className="h-4 w-4" /></Button>}
          <Button variant="duo" className="min-w-0 flex-1" onClick={() => next()} data-testid="teach-next">
            <span className="truncate">{last ? `Try it · ${PART_NAME[nextPart]}` : 'Next'}</span>{last ? <PenLine className="h-4 w-4 shrink-0" /> : <ArrowRight className="h-4 w-4 shrink-0" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
