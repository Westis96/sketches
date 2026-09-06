import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, Check, Lightbulb, PenLine, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TlTip } from '@/components/TlButton';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { levelVars, missionById, playedParts, type Mission, type Part } from '@/practice/curriculum';
import { labelAnchor, teachSlides, type TeachSlide } from '@/practice/teach';
import { missionPath, sessionPath } from '@/practice/routes';
import { cn } from '@/lib/utils';

const PART_NAME: Record<Part, string> = { teach: 'Lesson', trainer: 'Trainer', guided: 'Guided piece', perform: 'Perform' };

/**
 * The lesson: slides docked beside the paper (a right column on wide screens, the
 * lower half on phones) while the engine draws each slide's demo strokes with the
 * real brush. Compare slides draw the right way and the wrong way in turn, labelled
 * on the paper. The last slide invites a try-out, unscored, then hands over to the
 * first played part.
 */
export function TeachScreen() {
  const practice = useStudioState((s) => s.practice);
  if (!practice || practice.part !== 'teach' || !practice.missionId) return null;
  const mission = missionById(practice.missionId);
  if (!mission) return null;
  return <Slides key={mission.id} mission={mission} />;
}

function Slides({ mission }: { mission: Mission }) {
  const studio = useStudio();
  const navigate = useNavigate();
  const view = useStudioState((s) => s.view);
  const demoOn = useStudioState((s) => s.demo);
  const slides = teachSlides(mission.id);
  const [i, setI] = useState(0);
  /** Demos of the current slide already on the paper. */
  const [played, setPlayed] = useState(0);
  const run = useRef(0);
  const slide: TeachSlide = slides[i];
  const last = i === slides.length - 1;
  const nextPart = playedParts(mission)[0];

  // Each slide clears the paper and plays its demos in turn; a slide change or a
  // replay abandons the run in progress.
  const play = useCallback(async (k: number) => {
    const id = ++run.current;
    studio.clearDemo();
    setPlayed(0);
    const demos = slides[k]?.demos ?? [];
    for (let d = 0; d < demos.length; d++) {
      const ok = await studio.playDemo(demos[d]);
      if (run.current !== id) return;
      if (!ok) return;
      setPlayed(d + 1);
    }
  }, [studio, slides]);
  useEffect(() => { void play(i); }, [i, play]);
  useEffect(() => () => { run.current++; studio.stopDemo(); }, [studio]);

  const finish = () => { studio.markTaught(mission.id); navigate(sessionPath(mission.id, nextPart)); };
  const next = () => (last ? finish() : setI((n) => Math.min(slides.length - 1, n + 1)));
  const back = () => setI((n) => Math.max(0, n - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (['input', 'textarea', 'select'].includes(el.tagName?.toLowerCase()) || el.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
      else if (e.key.toLowerCase() === 'r') { e.preventDefault(); void play(i); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const z = view.zoom;
  const demos = slide.demos ?? [];
  const compare = demos.some((d) => d.good !== undefined);
  const shown = Math.min(demos.length, played + (demoOn ? 1 : 0));

  return (
    <div className="pointer-events-none fixed inset-0 z-30" style={levelVars(mission.level)} data-testid="teach-panel" data-slide={i}>
      {/* Labels on the paper, in world units */}
      <svg aria-hidden className="absolute inset-0 h-full w-full overflow-visible" data-testid="teach-labels">
        <g transform={`translate(${view.x} ${view.y}) scale(${z})`}>
          {demos.slice(0, shown).map((d, k) => {
            const cur = k === shown - 1 && demoOn;
            const a = labelAnchor(d);
            const tone = d.good === true ? 'var(--success)' : d.good === false ? 'var(--danger)' : 'var(--text-2)';
            return (
              <g key={k}>
                {cur && <circle cx={d.points[0].x} cy={d.points[0].y} r={7 / z} fill="var(--accent)" stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" className="guide-start" />}
                {d.label && (
                  <text x={a.x} y={a.y} fontSize={14 / z} fontWeight={800} fontFamily="Nunito, system-ui, sans-serif" fill={tone} stroke="var(--paper)" strokeWidth={4 / z} paintOrder="stroke" strokeLinejoin="round" className="tile-in" data-teach-label>
                    {d.good === true ? '✓ ' : d.good === false ? '✗ ' : ''}{d.label}
                  </text>
                )}
              </g>
            );
          })}
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
          'inset-x-0 bottom-0 max-h-[50%] rounded-t-[22px]',
          'md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[400px] md:rounded-none md:rounded-l-[22px]',
        )}
      >
        <div className="px-5 pb-3 pt-4 text-white" style={{ background: 'var(--lvl)' }}>
          <div className="sheet-grip mb-2 bg-white/40 md:hidden" />
          <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.08em] opacity-85">Lesson · Mission {mission.id}</div>
          <div className="truncate font-display text-[19px] font-extrabold leading-tight">{mission.title}</div>
          <div className="mt-2.5 flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={i + 1} aria-label="Slide">
            {slides.map((_, k) => <span key={k} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-250 ease-out', k <= i ? 'bg-white' : 'bg-white/30')} />)}
          </div>
        </div>

        <div key={i} className="tl-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4 enter-up">
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
            <ul className="mt-3 flex flex-col gap-1 text-[12.5px]">
              {demos.filter((d) => d.label).map((d, k) => (
                <li key={k} className={cn('flex items-center gap-2 transition-opacity duration-250', demos.indexOf(d) < shown ? 'opacity-100' : 'opacity-35')}>
                  <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full text-white', d.good === false ? 'bg-[var(--danger)]' : 'bg-[var(--success)]')}>
                    {d.good === false ? <X className="h-3 w-3" strokeWidth={3} /> : <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className="text-[var(--text-1)]">{d.label}</span>
                </li>
              ))}
            </ul>
          )}
          {slide.tryIt && (
            <div className="mt-3 flex items-center gap-2 rounded-[12px] border-2 border-dashed border-[var(--hint-strong)] px-3 py-2 text-[12.5px] text-[var(--text-2)]" data-testid="teach-try">
              <PenLine className="h-4 w-4 shrink-0 text-[var(--lvl)]" />Draw on the paper. Nothing here is scored.
            </div>
          )}
        </div>

        <div className="safe-b flex shrink-0 items-center gap-2 border-t border-[var(--hint)] px-5 pb-4 pt-3">
          {demos.length > 0 && (
            <TlTip label="Play the demo again" kbd="R">
              <Button variant="duo-secondary" size="icon" className="h-11 w-11 shrink-0" aria-label="Replay" onClick={() => void play(i)} disabled={demoOn} data-testid="teach-replay"><RotateCcw className="h-4 w-4" /></Button>
            </TlTip>
          )}
          {i > 0 && <Button variant="duo-secondary" size="icon" className="h-11 w-11 shrink-0" aria-label="Previous slide" onClick={back} data-testid="teach-back"><ArrowLeft className="h-4 w-4" /></Button>}
          <Button variant="duo" className="min-w-0 flex-1" onClick={next} data-testid="teach-next">
            <span className="truncate">{last ? `Try it · ${PART_NAME[nextPart]}` : 'Next'}</span><ArrowRight className="h-4 w-4 shrink-0" />
          </Button>
        </div>
      </div>
    </div>
  );
}
