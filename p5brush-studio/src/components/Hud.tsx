import { Badge } from '@/components/ui/badge';
import { useStudioState } from '@/hooks/useStudio';
import { cn } from '@/lib/utils';

/** Live stylus telemetry. Updates are batched to one per animation frame by the engine. */
export function Hud() {
  const hud = useStudioState((s) => s.hud);
  const isPen = hud.pointerType === 'pen';
  const label = hud.pointerType ? (isPen ? 'APPLE PENCIL' : hud.pointerType.toUpperCase()) : 'READY';

  return (
    <aside className="pointer-events-none fixed bottom-3 left-3 z-30 sm:left-6">
      <div className="paper-pill flex items-center gap-3 rounded-2xl p-2 font-mono text-xs text-slate-700 sm:p-2.5">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold', isPen ? 'border-indigo-200 bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700')}>
            {label}
          </Badge>
          <span className="text-[10px] text-slate-500">Force:</span>
          <div className="h-2 w-16 overflow-hidden rounded-full border border-slate-300 bg-slate-200">
            <div className="h-full bg-indigo-600" style={{ width: `${Math.round(Math.min(1, hud.pressure) * 100)}%` }} />
          </div>
          <span className="w-8 text-[10px] font-semibold text-slate-900">{hud.pressure.toFixed(2)}</span>
        </div>
        <div className="hidden items-center gap-2 border-l border-slate-200 pl-2 text-[10px] text-slate-500 sm:flex">
          <span>Tilt:</span>
          <span className="font-medium text-slate-800">{Math.round(hud.tiltX)}°, {Math.round(hud.tiltY)}°</span>
        </div>
        <div className="hidden items-center gap-2 border-l border-slate-200 pl-2 text-[10px] text-slate-500 sm:flex">
          <span>Stamps:</span>
          <span className="font-medium text-slate-800" data-testid="hud-stamps">{hud.stamps}</span>
        </div>
      </div>
    </aside>
  );
}
