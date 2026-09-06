import { useEffect, type CSSProperties } from 'react';
import { Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { LESSONS, lessonSteps } from '@/practice/lessons';
import { cn } from '@/lib/utils';

export function Stars({ n, size = 'h-3.5 w-3.5', animate = false }: { n: number; size?: string; animate?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          className={cn(size, i < n ? 'fill-[var(--warning)] text-[var(--warning)]' : 'text-[var(--hint-strong)]', animate && i < n && 'star-pop')}
          style={animate ? { animationDelay: `${120 + i * 70}ms` } : undefined}
        />
      ))}
    </span>
  );
}

/** Centre modal listing the lessons with engine-rendered thumbnails and personal bests. */
export function PracticePicker({ open, instant, onOpenChange }: { open: boolean; instant?: boolean; onOpenChange: (o: boolean, viaKeyboard?: boolean) => void }) {
  const studio = useStudio();
  const previews = useStudioState((s) => s.lessonPreviews);
  const progress = useStudioState((s) => s.progress);
  const active = useStudioState((s) => s.practice?.lessonId ?? null);

  useEffect(() => { if (open) studio.ensureLessonPreviews(); }, [open, studio]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Practice lessons" instant={instant} className="tl-scroll max-h-[88vh] w-[min(760px,calc(100vw-24px))] overflow-y-auto p-4" data-testid="practice-picker">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <DialogTitle>Practice</DialogTitle>
            <DialogDescription className="mt-0.5">
              Trace a sample drawing stroke by stroke. Each step sets the brush for you; every stroke is scored on shape, size and direction.
            </DialogDescription>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={() => onOpenChange(false)}><X /></Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LESSONS.map((l, i) => {
            const best = progress[l.id];
            const n = lessonSteps(l).length;
            return (
              <button
                key={l.id}
                type="button"
                data-testid={`lesson-${l.id}`}
                onClick={() => { studio.startPractice(l.id); onOpenChange(false); }}
                style={{ '--enter-delay': `${i * 40}ms` } as CSSProperties}
                className={cn('press enter-up group flex flex-col overflow-hidden rounded-[12px] text-left outline-none ring-1 ring-inset ring-[var(--hint)] hover:ring-2 hover:ring-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                  active === l.id && 'ring-2 ring-[var(--accent)]')}
              >
                <span className="block aspect-[4/3] w-full bg-[var(--surface-solid)]">
                  {previews?.[l.id]
                    ? <img src={previews[l.id]} alt="" draggable={false} className="h-full w-full object-cover" />
                    : <span className="block h-full w-full animate-pulse bg-[var(--low)]" />}
                </span>
                <span className="flex flex-1 flex-col gap-1 p-2.5">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12.5px] font-semibold text-[var(--text-1)]">{l.title}</span>
                    <span className="flex shrink-0 items-center gap-[3px]" title={['Easy', 'Medium', 'Hard'][l.difficulty - 1]} aria-label={['Easy', 'Medium', 'Hard'][l.difficulty - 1]}>
                      {[1, 2, 3].map((k) => <span key={k} className={cn('h-1.5 w-1.5 rounded-full', k <= l.difficulty ? 'bg-[var(--text-2)]' : 'bg-[var(--hint-strong)]')} />)}
                    </span>
                  </span>
                  <span className="text-[11px] leading-snug text-[var(--text-3)]">{l.subtitle} · {n} strokes</span>
                  <span className="mt-auto flex items-center justify-between pt-1 text-[11px]">
                    <Stars n={best?.stars ?? 0} />
                    <span className={cn('font-mono tabular-nums', best ? 'text-[var(--text-2)]' : 'text-[var(--text-3)]')}>{best ? `best ${best.best}` : 'not played'}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-[11px] text-[var(--text-3)]">
          Your current drawing is kept safe and comes back when you leave the lesson. Undo reopens a step; Skip counts it as zero.
        </div>
      </DialogContent>
    </Dialog>
  );
}
