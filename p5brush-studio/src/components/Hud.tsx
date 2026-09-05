import { useStudioState } from '@/hooks/useStudio';
import { cn } from '@/lib/utils';

/** Bottom-left telemetry pill (pointer type, force, stamp count). Batched per frame by the engine. */
export function Hud() {
  const hud = useStudioState((s) => s.hud);
  const isPen = hud.pointerType === 'pen';
  const label = hud.pointerType ? (isPen ? 'Pencil' : hud.pointerType) : 'Ready';

  return (
    <div className="tl-panel-sm pointer-events-auto flex h-9 items-center gap-3 px-3 text-[11px] font-medium text-[var(--tl-text-2)]">
      <span className={cn('capitalize', isPen ? 'text-[var(--tl-selected)]' : 'text-[var(--tl-text-1)]')}>{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="text-[var(--tl-text-3)]">Force</span>
        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--tl-hint-strong)]">
          <span className="block h-full bg-[var(--tl-selected)]" style={{ width: `${Math.round(Math.min(1, hud.pressure) * 100)}%` }} />
        </span>
        <span className="w-7 font-mono text-[10.5px] tabular-nums">{hud.pressure.toFixed(2)}</span>
      </span>
      <span className="hidden items-center gap-1.5 sm:flex">
        <span className="text-[var(--tl-text-3)]">Tilt</span>
        <span className="font-mono text-[10.5px] tabular-nums">{Math.round(hud.tiltX)}°, {Math.round(hud.tiltY)}°</span>
      </span>
      <span className="hidden items-center gap-1.5 sm:flex">
        <span className="text-[var(--tl-text-3)]">Stamps</span>
        <span className="font-mono text-[10.5px] tabular-nums" data-testid="hud-stamps">{hud.stamps}</span>
      </span>
    </div>
  );
}
