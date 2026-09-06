import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, ChevronRight, Dumbbell, Route as RouteIcon, Trophy, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Stars } from './Stars';
import { useStudioState } from '@/hooks/useStudio';
import { BRUSH_TEMPLATES } from '@/engine/templates';
import { SKILLS, TIERS, TIER_LABEL, missionById, partsOf, type Part, type Tier } from '@/practice/curriculum';
import { learnPath, sessionPath } from '@/practice/routes';
import { cn } from '@/lib/utils';

const PART_LABEL: Record<Part, { name: string; blurb: string; icon: typeof Dumbbell }> = {
  trainer: { name: 'Trainer', blurb: '60–90 s · scored every stroke', icon: Dumbbell },
  guided: { name: 'Guided piece', blurb: 'The full guide. Practice, not scored for stars', icon: RouteIcon },
  perform: { name: 'Perform', blurb: 'Less guide. This one counts', icon: Trophy },
};

/** One tier less help than the last guided run ended at; never past dots by default. */
function defaultTier(guidedTier: Tier | undefined): Tier {
  if (!guidedTier) return 'light';
  return TIERS[Math.min(TIERS.indexOf(guidedTier) + 1, 2)];
}

/** The mission sheet: what it teaches, its three parts with bests, and Start. */
export function MissionSheet({ missionId, open, instant }: { missionId: string; open: boolean; instant?: boolean }) {
  const navigate = useNavigate();
  const progress = useStudioState((s) => s.progress);
  const templatePreviews = useStudioState((s) => s.templatePreviews);
  const x = missionById(missionId);
  const mp = progress.missions[missionId];
  const [tier, setTier] = useState<Tier>(() => defaultTier(mp?.guided?.tier));
  if (!x) return null;
  const parts = partsOf(x);
  const brush = BRUSH_TEMPLATES.find((t) => t.id === x.brush);
  const done: Record<Part, boolean> = { trainer: !!mp?.trainer, guided: !!mp?.guided, perform: !!mp?.perform };
  const nextPart = parts.find((p) => !done[p]) ?? parts[parts.length - 1];
  const start = (part: Part) => navigate(sessionPath(x.id, part, part === 'perform' ? tier : undefined));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) navigate(learnPath()); }}>
      <DialogContent aria-label={`${x.id} ${x.title}`} instant={instant} className="w-[min(440px,calc(100vw-24px))] p-4" data-testid="mission-sheet">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[11px] font-medium text-[var(--text-3)]">Mission {x.id}</div>
            <DialogTitle className="text-[17px]">{x.title}</DialogTitle>
            <DialogDescription className="mt-1">{x.about}</DialogDescription>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={() => navigate(learnPath())}><X /></Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="accent">{SKILLS[x.skill].name}</Badge>
          <Badge variant="secondary" className="gap-1.5 pl-1">
            {brush && templatePreviews?.[brush.id] && <img src={templatePreviews[brush.id]} alt="" className="h-4 w-8 rounded-[3px] object-cover" />}
            {x.brushLabel ?? brush?.name ?? x.brush}
          </Badge>
          {x.piece && <Badge variant="outline">{x.kind === 'seeing' ? 'seeing' : 'piece'}</Badge>}
        </div>

        <div className="mt-3 flex flex-col gap-1.5">
          {parts.map((part) => {
            const meta = PART_LABEL[part];
            const Icon = meta.icon;
            const best = part === 'trainer' ? mp?.trainer : part === 'guided' ? mp?.guided : mp?.perform;
            const isNext = part === nextPart;
            return (
              <button
                key={part}
                type="button"
                data-testid={`part-${part}`}
                onClick={() => start(part)}
                className={cn('press flex items-center gap-3 rounded-[12px] p-2.5 text-left outline-none ring-1 ring-inset ring-[var(--hint)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]', isNext && 'bg-[var(--accent-soft)] ring-[var(--accent)]/40')}
              >
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]', done[part] ? 'bg-[var(--ink)] text-[var(--ink-fg)]' : 'bg-[var(--low)] text-[var(--text-2)]')}>
                  {done[part] ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold text-[var(--text-1)]">{meta.name}</span>
                  <span className="block truncate text-[11px] text-[var(--text-3)]">{meta.blurb}</span>
                </span>
                <span className="shrink-0 text-right">
                  {part === 'perform' && mp?.perform && <Stars n={mp.perform.stars} size="h-3 w-3" className="mb-0.5 justify-end" />}
                  {best && <span className="block font-mono text-[11px] tabular-nums text-[var(--text-2)]">
                    {part === 'trainer' ? `${(best as { clean: number }).clean} of ${(best as { reps: number }).reps} clean` : `best ${best.best}`}
                    {part === 'perform' && mp?.perform?.byTier?.[tier] !== undefined && <span className="text-[var(--text-3)]"> · {TIER_LABEL[tier].toLowerCase()} {mp.perform.byTier[tier]}</span>}
                  </span>}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-3)]" />
              </button>
            );
          })}
        </div>

        {parts.includes('perform') && (
          <div className="mt-3">
            <div className="tl-label mb-1">Perform with</div>
            <ToggleGroup type="single" value={tier} onValueChange={(v) => { if (v) setTier(v as Tier); }} className="grid grid-cols-4 gap-1">
              {TIERS.map((t) => <ToggleGroupItem key={t} value={t} size="sm" className="h-8 text-[11px]" aria-label={TIER_LABEL[t]}>{TIER_LABEL[t].replace(' guide', '').replace(' only', '')}</ToggleGroupItem>)}
            </ToggleGroup>
            <p className="mt-1 text-[10.5px] leading-snug text-[var(--text-3)]">Less guide, same stars to win. Your best is kept per tier.</p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-1.5">
          <Button onClick={() => start(nextPart)} data-testid="mission-start">{done[nextPart] ? 'Play again' : 'Start'}: {PART_LABEL[nextPart].name}<ChevronRight /></Button>
          <Button variant="ghost" onClick={() => navigate(learnPath())}>Back</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
