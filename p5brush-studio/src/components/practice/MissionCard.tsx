import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BookOpen, Check, ChevronRight, Dumbbell, Route as RouteIcon, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Stars } from './Stars';
import { useStudioState } from '@/hooks/useStudio';
import { BRUSH_TEMPLATES } from '@/engine/templates';
import { SKILLS, TIERS, TIER_LABEL, partsOf, type Mission, type Part, type Tier } from '@/practice/curriculum';
import { sessionPath } from '@/practice/routes';
import { cn } from '@/lib/utils';

const PART_LABEL: Record<Part, { name: string; blurb: string; icon: typeof Dumbbell }> = {
  teach: { name: 'Lesson', blurb: '2 min · the idea, shown in ink', icon: BookOpen },
  trainer: { name: 'Trainer', blurb: '60–90 s · every stroke scored', icon: Dumbbell },
  guided: { name: 'Guided piece', blurb: 'Full guide · practice, no stars', icon: RouteIcon },
  perform: { name: 'Perform', blurb: 'Less guide · this one counts', icon: Trophy },
};

/** One tier less help than the last guided run ended at; never past dots by default. */
function defaultTier(guidedTier: Tier | undefined): Tier {
  if (!guidedTier) return 'light';
  return TIERS[Math.min(TIERS.indexOf(guidedTier) + 1, 2)];
}

/** The bubble under a path node: what the mission teaches, its parts with bests, the tier, Start. */
export function MissionCard({ mission: x }: { mission: Mission }) {
  const navigate = useNavigate();
  const progress = useStudioState((s) => s.progress);
  const templatePreviews = useStudioState((s) => s.templatePreviews);
  const mp = progress.missions[x.id];
  const [tier, setTier] = useState<Tier>(() => defaultTier(mp?.guided?.tier));
  const parts = partsOf(x);
  const brush = BRUSH_TEMPLATES.find((t) => t.id === x.brush);
  const done: Record<Part, boolean> = { teach: !!mp?.taught, trainer: !!mp?.trainer, guided: !!mp?.guided, perform: !!mp?.perform };
  const nextPart = parts.find((p) => !done[p]) ?? parts[parts.length - 1];
  const start = (part: Part) => navigate(sessionPath(x.id, part, part === 'perform' ? tier : undefined));

  return (
    <div className="flex flex-col gap-3 p-4" data-testid="mission-sheet">
      <div>
        <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--lvl)]">Mission {x.id}</div>
        <div className="font-display text-[19px] font-extrabold leading-tight text-[var(--text-1)]">{x.title}</div>
        <p className="mt-1 text-[12.5px] leading-snug text-[var(--text-2)]">{x.about}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{SKILLS[x.skill].name}</Badge>
        <Badge variant="secondary" className="gap-1.5 pl-1">
          {brush && templatePreviews?.[brush.id] && <img src={templatePreviews[brush.id]} alt="" className="h-4 w-8 rounded-[3px] object-cover" />}
          {x.brushLabel ?? brush?.name ?? x.brush}
        </Badge>
      </div>

      <div className="flex flex-col gap-1.5">
        {parts.map((part) => {
          const meta = PART_LABEL[part];
          const Icon = meta.icon;
          const best = part === 'trainer' ? mp?.trainer : part === 'guided' ? mp?.guided : part === 'perform' ? mp?.perform : undefined;
          const isNext = part === nextPart;
          return (
            <button
              key={part}
              type="button"
              data-testid={`part-${part}`}
              onClick={() => start(part)}
              className={cn('press flex items-center gap-3 rounded-[12px] p-2 text-left outline-none ring-2 ring-inset ring-[var(--hint)] focus-visible:ring-[var(--lvl)]', isNext && 'ring-[var(--lvl)]')}
            >
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]', done[part] ? 'bg-[var(--lvl)] text-white' : 'bg-[var(--low)] text-[var(--text-2)]')}>
                {done[part] ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[13px] font-extrabold text-[var(--text-1)]">{meta.name}</span>
                <span className="block truncate text-[11px] text-[var(--text-3)]">{meta.blurb}</span>
              </span>
              <span className="shrink-0 text-right">
                {part === 'perform' && mp?.perform && <Stars n={mp.perform.stars} size="h-3 w-3" className="mb-0.5 justify-end" />}
                {best && <span className="block font-mono text-[11px] tabular-nums text-[var(--text-2)]">
                  {part === 'trainer' ? `${(best as { clean: number }).clean}/${(best as { reps: number }).reps} clean` : `best ${best.best}`}
                </span>}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-3)]" />
            </button>
          );
        })}
      </div>

      {parts.includes('perform') && (
        <div>
          <div className="mb-1 font-display text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--text-3)]">Perform with</div>
          <ToggleGroup type="single" value={tier} onValueChange={(v) => { if (v) setTier(v as Tier); }} className="grid grid-cols-4 gap-1">
            {TIERS.map((t) => <ToggleGroupItem key={t} value={t} size="sm" className="h-8 text-[11px] data-[pressed]:bg-[var(--lvl)] data-[pressed]:text-white" aria-label={TIER_LABEL[t]}>{TIER_LABEL[t].replace(' guide', '').replace(' only', '')}</ToggleGroupItem>)}
          </ToggleGroup>
          {mp?.perform?.byTier?.[tier] !== undefined && <p className="mt-1 text-[10.5px] text-[var(--text-3)]">Best at this tier: {mp.perform.byTier[tier]}</p>}
        </div>
      )}

      <Button variant="duo" className="w-full" onClick={() => start(nextPart)} data-testid="mission-start">
        {done[nextPart] ? (nextPart === 'teach' ? 'Read again' : 'Play again') : 'Start'} · {PART_LABEL[nextPart].name}
      </Button>
    </div>
  );
}
