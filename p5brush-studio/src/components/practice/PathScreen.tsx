import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ChevronRight, Flame, Lock, Play, Timer, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Stars } from './Stars';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { BRUSH_TEMPLATES } from '@/engine/templates';
import { LEVELS, SKILLS, capstoneOf, isLocked, isPlayable, nextMission, partsOf, type Mission } from '@/practice/curriculum';
import { levelStars, missionDone, type Progress } from '@/practice/progress';
import { missionPath, progressPath, sessionPath, warmupPath } from '@/practice/routes';
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

/**
 * The Path: today's two chips, then the levels as rows of mission nodes. Missions
 * open in order inside a level; every level's first mission is open; pieces not
 * built yet show as "soon" so the shape of the course is visible from day one.
 */
export function PathScreen({ open, instant, hasChild, children }: { open: boolean; instant?: boolean; hasChild?: boolean; children?: React.ReactNode }) {
  const navigate = useNavigate();
  const studio = useStudio();
  const progress = useStudioState((s) => s.progress);
  const previews = useStudioState((s) => s.lessonPreviews);
  const templatePreviews = useStudioState((s) => s.templatePreviews);
  useEffect(() => { if (open) studio.ensureLessonPreviews(); }, [open, studio]);
  const next = nextMission((id) => missionDone(progress, id));
  const minutes = Math.round((progress.seconds ?? 0) / 60);

  return (
    <Dialog open={open} onOpenChange={(o, viaKeyboard) => { if (o) return; if (viaKeyboard && hasChild) return; /* the sheet on top owns Escape; Base UI stops the key at the document */ navigate('/'); }}>
      <DialogContent aria-label="Learn" instant={instant} className="tl-scroll flex max-h-[88vh] w-[min(840px,calc(100vw-24px))] flex-col overflow-y-auto p-0 max-sm:max-h-[calc(var(--tl-vh)*0.92)]" data-testid="path">
        <div className="sticky top-0 z-10 flex items-start gap-3 bg-[var(--surface)] px-4 pb-2 pt-4 max-sm:pt-0">
          <div className="flex-1">
            <DialogTitle className="text-[16px]">Learn</DialogTitle>
            <DialogDescription className="mt-0.5">Seven levels, one skill per mission: a short drill, a guided piece, then the piece for real.</DialogDescription>
          </div>
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate(progressPath())}>
            {minutes > 0 ? `${minutes} min` : 'Progress'}<ChevronRight />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={() => navigate('/')}><X /></Button>
        </div>

        {/* Today */}
        <div className="grid grid-cols-2 gap-2 px-4 pb-1 pt-1 max-sm:grid-cols-1">
          <button type="button" className="press flex items-center gap-3 rounded-[12px] bg-[var(--accent-soft)] p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" onClick={() => navigate(warmupPath())} data-testid="today-warmup">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--accent)] text-white"><Timer className="h-4 w-4" /></span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-[var(--accent-strong)]">Warm-up · 3 min</span>
              <span className="block truncate text-[11.5px] text-[var(--text-2)]">Lines, arcs, ellipses, waves. Confident pulls first.</span>
            </span>
          </button>
          {next ? (
            <button type="button" className="press flex items-center gap-3 rounded-[12px] bg-[var(--low)] p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" onClick={() => navigate(missionPath(next.id))} data-testid="today-continue">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--ink)] text-[var(--ink-fg)]"><Play className="h-4 w-4" /></span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-[var(--text-1)]">Continue · {next.id} {next.title}</span>
                <span className="block truncate text-[11.5px] text-[var(--text-2)]">{next.about}</span>
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-[12px] bg-[var(--low)] p-3 text-[12px] text-[var(--text-2)]"><Flame className="h-4 w-4 text-[var(--accent)]" />Every built mission is done. More pieces are coming.</div>
          )}
        </div>

        {/* Levels */}
        <div className="flex flex-col gap-1 px-2 pb-4 pt-2">
          {LEVELS.map((level) => {
            const playable = level.missions.filter((x) => isPlayable(x) && x.piece);
            const stars = levelStars(progress, playable.map((x) => x.id));
            const cap = capstoneOf(level);
            const levelDone = playable.length > 0 && playable.every((x) => missionDone(progress, x.id));
            return (
              <section key={level.n} className="rounded-[14px] px-2 py-2" data-testid={`level-${level.n}`}>
                <div className="flex items-center gap-3 px-1">
                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 font-mono text-[12px] font-semibold', levelDone ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--ink-fg)]' : 'border-[var(--ink)] text-[var(--text-1)]')}>{level.n}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-[var(--text-1)]">{level.theme}</div>
                    <div className="text-[11px] text-[var(--text-3)]">
                      {stars.possible > 0 ? <span className="font-mono tabular-nums">{stars.earned} / {stars.possible} ★</span> : 'Drill only'}
                      {level.missions.some((x) => !isPlayable(x)) && <span> · {level.missions.filter((x) => !isPlayable(x)).length} coming</span>}
                    </div>
                  </div>
                  {cap && !levelDone && !missionDone(progress, cap.id) && (
                    <Button variant="link" size="none" className="text-[11px]" onClick={() => navigate(sessionPath(cap.id, 'perform', 'light'))}>Test out: perform {cap.id}</Button>
                  )}
                </div>
                <div className="tl-scroll -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
                  {level.missions.map((x) => {
                    const st = nodeState(x, progress, next);
                    const mp = progress.missions[x.id];
                    const brush = BRUSH_TEMPLATES.find((t) => t.id === x.brush);
                    const thumb = x.piece ? previews?.[x.piece] : undefined;
                    const disabled = st === 'soon';
                    return (
                      <button
                        key={x.id}
                        type="button"
                        data-testid={`mission-${x.id}`}
                        data-state={st}
                        disabled={disabled}
                        aria-label={`${x.id} ${x.title}${st === 'locked' ? ', locked' : st === 'soon' ? ', coming soon' : ''}`}
                        onClick={() => {
                          if (st === 'locked') { const prev = level.missions[level.missions.indexOf(x) - 1]; toast(`Finish ${prev?.id ?? 'the previous mission'} first`); return; }
                          navigate(missionPath(x.id));
                        }}
                        className={cn(
                          'press group flex w-[156px] shrink-0 flex-col overflow-hidden rounded-[12px] text-left outline-none ring-1 ring-inset ring-[var(--hint)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                          st === 'next' && 'ring-2 ring-[var(--accent)]',
                          st === 'locked' && 'opacity-60',
                          disabled && 'opacity-45',
                        )}
                      >
                        <span className="relative block aspect-[4/3] w-full bg-[var(--surface-solid)]">
                          {thumb
                            ? <img src={thumb} alt="" draggable={false} className="h-full w-full object-cover" />
                            : x.piece && !x.planned
                              ? <span className="block h-full w-full animate-pulse bg-[var(--low)]" />
                              : <span className="flex h-full w-full items-center justify-center">{brush && templatePreviews?.[brush.id] ? <img src={templatePreviews[brush.id]} alt="" className="h-10 w-full object-cover opacity-80" /> : <span className="text-[11px] text-[var(--text-3)]">{x.kind === 'seeing' ? 'seeing' : 'drill'}</span>}</span>}
                          {st === 'locked' && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-3)]"><Lock className="h-3 w-3" /></span>}
                          {st === 'soon' && <Badge variant="secondary" className="absolute right-1.5 top-1.5">soon</Badge>}
                          {st === 'next' && <Badge variant="accent" className="absolute left-1.5 top-1.5">next</Badge>}
                        </span>
                        <span className="flex flex-1 flex-col gap-0.5 p-2">
                          <span className="truncate text-[12px] font-semibold text-[var(--text-1)]"><span className="font-mono text-[10.5px] font-medium text-[var(--text-3)]">{x.id}</span> {x.title}</span>
                          <span className="truncate text-[10.5px] text-[var(--text-3)]">{SKILLS[x.skill].name} · {x.brushLabel ?? brush?.name ?? x.brush}</span>
                          <span className="mt-1 flex items-center justify-between">
                            {x.piece ? <Stars n={mp?.perform?.stars ?? 0} size="h-3 w-3" /> : <span className="text-[10.5px] text-[var(--text-3)]">{partsOf(x).length === 1 ? 'drill' : ''}</span>}
                            <span className={cn('font-mono text-[10.5px] tabular-nums', mp?.perform ? 'text-[var(--text-2)]' : 'text-[var(--text-3)]')}>
                              {mp?.perform ? `best ${mp.perform.best}` : mp?.guided ? `guided ${mp.guided.best}` : mp?.trainer ? `drill ${mp.trainer.best}` : ''}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}
