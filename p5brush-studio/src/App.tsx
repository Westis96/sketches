import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Studio } from '@/engine/Studio';
import { StudioContext, useStudio, useStudioState } from '@/hooks/useStudio';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toolbar } from '@/components/Toolbar';
import { Hud } from '@/components/Hud';
import { BrushPanel } from '@/components/BrushPanel';
import { cn } from '@/lib/utils';

declare global {
  interface Window { __studio?: ReturnType<Studio['debug']> }
}

export default function App() {
  const [studio] = useState(() => new Studio((msg) => toast(msg)));
  return (
    <StudioContext.Provider value={studio}>
      <TooltipProvider delayDuration={300}>
        <Shell />
        <Toaster position="bottom-center" richColors closeButton={false} duration={2400} />
      </TooltipProvider>
    </StudioContext.Provider>
  );
}

function Shell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 700);
  const studio = useStudio();
  const tool = useStudioState((s) => s.settings.tool);
  const fatal = useStudioState((s) => s.fatal);

  // Attach the engine to the canvas once it is mounted.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    studio.attach(canvas);
    window.__studio = studio.debug();
    return () => studio.dispose();
  }, [studio]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement).isContentEditable) return;
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) studio.redo(); else studio.undo(); return; }
      if ((e.metaKey || e.ctrlKey) && k === 'y') { e.preventDefault(); studio.redo(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (k === 'b') studio.setTool('brush');
      else if (k === 'e') studio.setTool('eraser');
      else if (k === 't') studio.drawSampleStroke();
      else if (k === 'c') studio.clear();
      else if (k === 's') studio.exportPNG();
      else if (k === 'p') setPanelOpen((o) => !o);
      else if (k === '[') studio.nudgeWeight(-1);
      else if (k === ']') studio.nudgeWeight(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [studio]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Single WebGL2 canvas: paper texture + p5.brush strokes */}
      <div id="studio-desk" className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_40%,#f0ece3_0%,#d8d2c4_100%)]">
        <canvas
          ref={canvasRef}
          id="ink-canvas"
          className={cn('absolute inset-0 block h-full w-full touch-none', tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair')}
        />
      </div>

      <Toolbar panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((o) => !o)} />
      <Hud />
      <BrushPanel open={panelOpen} />

      {fatal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#dcd7ce]/95 p-6">
          <div className="paper-card max-w-md space-y-2 p-6 text-sm">
            <div className="font-bold text-rose-700">p5.brush could not start</div>
            <div className="text-muted-foreground">{fatal}</div>
          </div>
        </div>
      )}
    </div>
  );
}
