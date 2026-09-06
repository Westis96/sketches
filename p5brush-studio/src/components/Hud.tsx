import { Maximize2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TlTip } from '@/components/TlButton';
import { useStudio, useStudioState } from '@/hooks/useStudio';

/**
 * Bottom-left: zoom control. Stylus telemetry appears only while a pen is in use
 * and only where there is room for it, so it never crowds the dock.
 */
export function Hud() {
  const studio = useStudio();
  const hud = useStudioState((s) => s.hud);
  const zoom = useStudioState((s) => s.view.zoom);
  const isPen = hud.pointerType === 'pen';

  return (
    <div className="flex items-center gap-2">
      <Card size="sm" className="pointer-events-auto hidden h-9 items-center px-1 text-[11px] font-medium text-[var(--text-2)] sm:flex">
        <TlTip label="Zoom out" kbd="−"><Button variant="ghost" size="icon-sm" onClick={() => studio.zoomBy(1 / 1.25)}><Minus /></Button></TlTip>
        <TlTip label="Reset zoom to 100%" kbd="0">
          <Button variant="ghost" size="sm" className="min-w-[3.25rem] px-1 font-mono tabular-nums" onClick={() => studio.resetView()}>{Math.round(zoom * 100)}%</Button>
        </TlTip>
        <TlTip label="Zoom in" kbd="+"><Button variant="ghost" size="icon-sm" onClick={() => studio.zoomBy(1.25)}><Plus /></Button></TlTip>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <TlTip label="Zoom to fit the drawing" kbd="F"><Button variant="ghost" size="icon-sm" onClick={() => studio.zoomToFit()}><Maximize2 /></Button></TlTip>
      </Card>
      {isPen && (
        <Card size="sm" className="pointer-events-auto hidden h-9 items-center gap-2 px-2.5 text-[11px] font-medium text-[var(--text-2)] lg:flex" aria-live="off">
          <span className="text-[var(--accent-strong)]">Pencil</span>
          <span className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--hint-strong)]">
            <span className="block h-full bg-[var(--accent)]" style={{ width: `${Math.round(Math.min(1, hud.pressure) * 100)}%` }} />
          </span>
          <span className="w-7 font-mono text-[10.5px] tabular-nums">{hud.pressure.toFixed(2)}</span>
          <span className="hidden font-mono text-[10.5px] tabular-nums text-[var(--text-3)] 2xl:inline">tilt {Math.round(hud.tiltX)}°, {Math.round(hud.tiltY)}°</span>
        </Card>
      )}
    </div>
  );
}
