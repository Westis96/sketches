import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Check, Dumbbell, Eye, Lock } from 'lucide-react';
import { Popover as BasePopover } from '@base-ui-components/react/popover';
import { LearnNav } from './LearnNav';
import { MissionCard } from './MissionCard';
import { Stars } from './Stars';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { LEVELS, capstoneOf, isLocked, isPlayable, levelVars, missionById, nextMission, type Mission } from '@/practice/curriculum';
import { levelStars, missionDone, type Progress } from '@/practice/progress';
import { learnPath, missionPath, sessionPath } from '@/practice/routes';
import { cn } from '@/lib/utils';

type NodeState = 'next' | 'done' | 'open' | 'locked' | 'soon';

function nodeState(x: Mission, progress: Progress, next: Mission | null): NodeState {
  const done = (id: string) => missionDone(progress, id);
  if (!isPlayable(x)) return 'soon';
  if (done(x.id)) return 'done';
  if (next && next.id === x.id) return 'next';
  if (isLocked(x, done)) return 'locked';
  return 'open';
}

/** Horizontal offsets that wind the path left and right, Duolingo style. */
const ZIG = [0, 44, 70, 44, 0, -44, -70, -44];

/**
 * The Learn home: a vertical winding path, one node per mission, a colour banner
 * per level. The next node carries a bobbing START bubble; tapping any playable
 * node opens the mission bubble beneath it (driven by the /learn/:mission route).
 */
export function LearnHome({ selectedId, instant }: { selectedId: string | null; instant?: boolean }) {
  const navigate = useNavigate();
  const studio = useStudio();
  const progress = useStudioState((s) => s.progress);
  const previews = useStudioState((s) => s.lessonPreviews);
  const templatePreviews = useStudioState((s) => s.templatePreviews);
  // Ask again once the engine is attached (template previews appear then): this page
  // can mount before the canvas does.
  useEffect(() => { studio.ensureLessonPreviews(); }, [studio, templatePreviews]);
  const next = nextMission((id) => missionDone(progress, id));
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const scrolled = useRef(false);
  // First paint: bring the next node into view, without motion.
  useEffect(() => {
    if (scrolled.current || !next) return;
    scrolled.current = true;
    nodeRefs.current.get(next.id)?.scrollIntoView({ block: 'center' });
  }, [next]);
  const selected = selectedId ? missionById(selectedId) ?? null : null;
  let index = 0;

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto overscroll-contain bg-[var(--paper)]" data-testid="path">
      <LearnNav active="learn" />
      <div className="mx-auto max-w-[560px] px-4 pb-40 pt-2">
        {LEVELS.map((level) => {
          const playable = level.missions.filter((x) => isPlayable(x) && x.piece);
          const stars = levelStars(progress, playable.map((x) => x.id));
          const cap = capstoneOf(level);
          const levelDone = playable.length > 0 && playable.every((x) => missionDone(progress, x.id));
          const canJump = cap && !levelDone && !missionDone(progress, cap.id) && next?.level !== level.n;
          return (
            <section key={level.n} style={levelVars(level.n)} data-testid={`level-${level.n}`} className="mt-4">
              <header className="relative flex items-center gap-3 rounded-[18px] px-4 py-3 text-white" style={{ background: 'var(--lvl)', boxShadow: '0 4px 0 var(--lvl-deep)' }}>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.08em] opacity-85">Level {level.n} · {stars.possible > 0 ? `${stars.earned} / ${stars.possible} ★` : 'drill'}</div>
                  <div className="font-display text-[19px] font-extrabold leading-tight">{level.theme}</div>
                  <div className="mt-0.5 text-[12px] leading-snug opacity-90">{level.blurb}</div>
                </div>
                {canJump && (
                  <button type="button" className="duo-btn h-9 shrink-0 bg-white/15 px-3 text-[11px] text-white ring-2 ring-inset ring-white/60" style={{ '--duo-edge': 'rgba(0,0,0,0.25)', boxShadow: '0 3px 0 rgba(0,0,0,0.25)' } as React.CSSProperties} onClick={() => navigate(sessionPath(cap.id, 'perform', 'light'))}>
                    Jump here?
                  </button>
                )}
              </header>

              <ol className="relative mx-auto flex w-[260px] flex-col items-center gap-7 pb-7 pt-16">
                {level.missions.map((x) => {
                  const i = index++;
                  const st = nodeState(x, progress, next);
                  const mp = progress.missions[x.id];
                  const thumb = x.piece ? previews?.[x.piece] : undefined;
                  const big = st === 'next';
                  const size = big ? 84 : 70;
                  const colored = st === 'done' || st === 'next';
                  const edge = colored ? 'var(--lvl-deep)' : st === 'soon' ? 'transparent' : 'var(--hint-strong)';
                  const bg = colored ? 'var(--lvl)' : st === 'soon' ? 'transparent' : st === 'locked' ? 'var(--hint)' : 'var(--surface-solid)';
                  const label = `${x.id} ${x.title}`;
                  return (
                    <li key={x.id} className="relative flex flex-col items-center" style={{ transform: `translateX(${ZIG[i % ZIG.length]}px)` }}>
                      {st === 'next' && (
                        <button
                          type="button"
                          data-testid="today-continue"
                          onClick={() => navigate(missionPath(x.id))}
                          className="start-bubble absolute -top-11 left-1/2 z-[1] rounded-[12px] bg-[var(--surface-solid)] px-3.5 py-1.5 font-display text-[12.5px] font-extrabold uppercase tracking-[0.1em] text-[var(--lvl)] shadow-[var(--shadow-sm)] ring-2 ring-inset ring-[var(--hint)] outline-none focus-visible:ring-[var(--lvl)]"
                        >
                          Start
                          <span aria-hidden className="absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[2px] bg-[var(--surface-solid)] shadow-[2px_2px_0_0_var(--hint)]" />
                        </button>
                      )}
                      <button
                        ref={(el) => { if (el) nodeRefs.current.set(x.id, el); else nodeRefs.current.delete(x.id); }}
                        type="button"
                        data-testid={`mission-${x.id}`}
                        data-state={st}
                        disabled={st === 'soon'}
                        aria-label={`${label}${st === 'locked' ? ', locked' : st === 'soon' ? ', coming soon' : ''}`}
                        aria-expanded={selectedId === x.id}
                        onClick={() => {
                          if (st === 'locked') { const prev = level.missions[level.missions.indexOf(x) - 1]; toast(`Finish ${prev?.id ?? 'the previous mission'} first`); return; }
                          navigate(selectedId === x.id ? learnPath() : missionPath(x.id));
                        }}
                        className={cn('node', st === 'soon' && 'border-[3px] border-dashed border-[var(--hint-strong)]', st === 'locked' && 'cursor-not-allowed')}
                        style={{ width: size, height: size, background: bg, boxShadow: st === 'soon' ? 'none' : `0 6px 0 ${edge}`, '--node-edge': edge } as React.CSSProperties}
                      >
                        {thumb && st !== 'soon' ? (
                          <span className={cn('block overflow-hidden rounded-full bg-white ring-[3px] ring-white/90', st === 'locked' && 'opacity-50 grayscale')} style={{ width: size - 16, height: size - 16 }}>
                            <img src={thumb} alt="" draggable={false} className="h-full w-full scale-[1.35] object-cover" />
                          </span>
                        ) : x.piece && st !== 'soon' ? (
                          <span className="block animate-pulse rounded-full bg-white/60" style={{ width: size - 16, height: size - 16 }} />
                        ) : (
                          <span className={cn(colored ? 'text-white' : 'text-[var(--text-3)]')}>
                            {x.kind === 'seeing' ? <Eye className="h-7 w-7" /> : st === 'locked' ? <Lock className="h-6 w-6" /> : <Dumbbell className="h-7 w-7" />}
                          </span>
                        )}
                        {st === 'done' && <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-[var(--surface-solid)] text-[var(--lvl)] shadow-[var(--shadow-sm)]"><Check className="h-3.5 w-3.5" strokeWidth={3.5} /></span>}
                        {st === 'locked' && thumb && <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-[var(--surface-solid)] text-[var(--text-3)] shadow-[var(--shadow-sm)]"><Lock className="h-3 w-3" /></span>}
                      </button>
                      <span className={cn('mt-2 max-w-[150px] text-center font-display text-[12px] font-bold leading-tight', st === 'soon' || st === 'locked' ? 'text-[var(--text-3)]' : 'text-[var(--text-1)]')}>
                        {x.title}
                        {st === 'soon' && <span className="block font-mono text-[10px] font-medium text-[var(--text-3)]">soon</span>}
                      </span>
                      {st === 'done' && x.piece && <Stars n={mp?.perform?.stars ?? 0} size="h-3.5 w-3.5" className="mt-1" />}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>

      {/* The mission bubble, anchored to its node and driven by the route */}
      <BasePopover.Root open={!!selected} onOpenChange={(o) => { if (!o) navigate(learnPath()); }}>
        <BasePopover.Portal>
          <BasePopover.Positioner anchor={() => (selected ? nodeRefs.current.get(selected.id) ?? null : null)} side="bottom" align="center" sideOffset={14} collisionPadding={12} className="z-50 outline-none">
            <BasePopover.Popup
              data-instant={instant || undefined}
              style={selected ? levelVars(selected.level) : undefined}
              className="ui-surface w-[min(360px,calc(100vw-24px))] origin-[var(--transform-origin)] rounded-[18px] outline-none transition-[opacity,transform] duration-200 ease-out data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 motion-reduce:data-[ending-style]:scale-100 motion-reduce:data-[starting-style]:scale-100"
            >
              <BasePopover.Arrow className="data-[side=bottom]:-top-[7px] data-[side=top]:-bottom-[7px] data-[side=top]:rotate-180">
                <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden><path d="M0 8 L8 0 L16 8" fill="var(--surface-solid)" /></svg>
              </BasePopover.Arrow>
              {selected && <MissionCard key={selected.id} mission={selected} />}
            </BasePopover.Popup>
          </BasePopover.Positioner>
        </BasePopover.Portal>
      </BasePopover.Root>
    </div>
  );
}
