import { Maximize2, Minus, Plus } from 'lucide-react';
import { TlTip } from '@/components/TlButton';
import { useStudio, useStudioState } from '@/hooks/useStudio';

/**
 * Bottom-left: zoom control (tldraw-style). Stylus telemetry appears only while
 * a pen is in use and only where there is room for it, so it never crowds the dock.
 */
export function Hud() {
  const studio = useStudio();
  const hud = useStudioState((s) => s.hud);
  const zoom = useStudioState((s) => s.view.zoom);
  const isPen = hud.pointerType === 'pen';

  return (
    <div className="flex items-center gap-2">
      <div className="tl-panel-sm pointer-events-auto hidden h-9 items-center px-1 text-[11px] font-medium text-[var(--tl-text-2)] sm:flex">
        <TlTip label="Zoom out" kbd="−"><button type="button" className="tl-opt h-7 w-7 px-0" onClick={() => studio.zoomBy(1 / 1.25)}><Minus className="h-3.5 w-3.5" /></button></TlTip>
        <TlTip label="Reset zoom to 100%" kbd="0">
          <button type="button" className="tl-opt h-7 min-w-[3.25rem] px-1 font-mono tabular-nums" onClick={() => studio.resetView()}>{Math.round(zoom * 100)}%</button>
        </TlTip>
        <TlTip label="Zoom in" kbd="+"><button type="button" className="tl-opt h-7 w-7 px-0" onClick={() => studio.zoomBy(1.25)}><Plus className="h-3.5 w-3.5" /></button></TlTip>
        <span className="tl-divider !h-5" />
        <TlTip label="Zoom to fit the drawing" kbd="F"><button type="button" className="tl-opt h-7 w-7 px-0" onClick={() => studio.zoomToFit()}><Maximize2 className="h-3.5 w-3.5" /></button></TlTip>
      </div>
      {isPen && (
        <div className="tl-panel-sm hidden h-9 items-center gap-2 px-2.5 text-[11px] font-medium text-[var(--tl-text-2)] lg:flex" aria-live="off">
          <span className="text-[var(--tl-selected)]">Pencil</span>
          <span className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--tl-hint-strong)]">
            <span className="block h-full bg-[var(--tl-selected)] transition-[width] duration-75" style={{ width: `${Math.round(Math.min(1, hud.pressure) * 100)}%` }} />
          </span>
          <span className="w-7 font-mono text-[10.5px] tabular-nums">{hud.pressure.toFixed(2)}</span>
          <span className="hidden font-mono text-[10.5px] tabular-nums text-[var(--tl-text-3)] 2xl:inline">tilt {Math.round(hud.tiltX)}°, {Math.round(hud.tiltY)}°</span>
        </div>
      )}
    </div>
  );
}
