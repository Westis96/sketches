import { useEffect } from 'react';
import { Star, X } from 'lucide-react';
import { useStudio, useStudioState } from '@/hooks/useStudio';
import { LESSONS, lessonSteps } from '@/practice/lessons';
import { cn } from '@/lib/utils';

export function Stars({ n, size = 'h-3.5 w-3.5', animate = false }: { n: number; size?: string; animate?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          className={cn(size, i < n ? 'fill-[#f2a541] text-[#f2a541]' : 'text-[var(--tl-hint-strong)]', animate && i < n && 'star-pop')}
          style={animate ? { animationDelay: `${0.15 + i * 0.18}s` } : undefined}
        />
      ))}
    </span>
  );
}

/** Centre modal listing the lessons with engine-rendered thumbnails and personal bests. */
export function PracticePicker({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const studio = useStudio();
  const previews = useStudioState((s) => s.lessonPreviews);
  const progress = useStudioState((s) => s.progress);
  const active = useStudioState((s) => s.practice?.lessonId ?? null);

  useEffect(() => { if (open) studio.ensureLessonPreviews(); }, [open, studio]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/25 p-3" onPointerDown={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}>
      <div role="dialog" aria-label="Practice lessons" className="tl-panel max-h-[88vh] w-[min(760px,100%)] overflow-y-auto p-4 tl-scroll" data-testid="practice-picker">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-[var(--tl-text-1)]">Practice</div>
            <div className="mt-0.5 text-[12px] text-[var(--tl-text-2)]">
              Trace a sample drawing stroke by stroke. Each step sets the brush for you; every stroke is scored on shape, size and direction.
            </div>
          </div>
          <button type="button" aria-label="Close" className="tl-opt h-8 w-8 px-0" onClick={() => onOpenChange(false)}><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LESSONS.map((l) => {
            const best = progress[l.id];
            const n = lessonSteps(l).length;
            return (
              <button
                key={l.id}
                type="button"
                data-testid={`lesson-${l.id}`}
                onClick={() => { studio.startPractice(l.id); onOpenChange(false); }}
                className={cn('group flex flex-col overflow-hidden rounded-[11px] text-left shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07)] transition-shadow hover:shadow-[inset_0_0_0_2px_var(--tl-selected)] focus-visible:shadow-[inset_0_0_0_2px_var(--tl-selected)] outline-none',
                  active === l.id && 'shadow-[inset_0_0_0_2px_var(--tl-selected)]')}
              >
                <span className="block aspect-[4/3] w-full bg-[#fffefa]">
                  {previews?.[l.id]
                    ? <img src={previews[l.id]} alt="" draggable={false} className="h-full w-full object-cover" />
                    : <span className="block h-full w-full animate-pulse bg-[var(--tl-low)]" />}
                </span>
                <span className="flex flex-1 flex-col gap-1 p-2.5">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12.5px] font-semibold text-[var(--tl-text-1)]">{l.title}</span>
                    <span className="flex shrink-0 items-center gap-[3px]" title={['Easy', 'Medium', 'Hard'][l.difficulty - 1]} aria-label={['Easy', 'Medium', 'Hard'][l.difficulty - 1]}>
                      {[1, 2, 3].map((k) => <span key={k} className={cn('h-1.5 w-1.5 rounded-full', k <= l.difficulty ? 'bg-[var(--tl-text-2)]' : 'bg-[var(--tl-hint-strong)]')} />)}
                    </span>
                  </span>
                  <span className="text-[11px] leading-snug text-[var(--tl-text-3)]">{l.subtitle} · {n} strokes</span>
                  <span className="mt-auto flex items-center justify-between pt-1 text-[11px]">
                    <Stars n={best?.stars ?? 0} />
                    <span className={cn('font-mono tabular-nums', best ? 'text-[var(--tl-text-2)]' : 'text-[var(--tl-text-3)]')}>{best ? `best ${best.best}` : 'not played'}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-[11px] text-[var(--tl-text-3)]">
          Your current drawing is kept safe and comes back when you leave the lesson. Undo reopens a step; Skip counts it as zero.
        </div>
      </div>
    </div>
  );
}
