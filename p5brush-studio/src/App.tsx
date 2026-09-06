import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Studio } from '@/engine/Studio';
import { StudioContext, useStudio, useStudioState } from '@/hooks/useStudio';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QuickActions } from '@/components/QuickActions';
import { ToolDock } from '@/components/ToolDock';
import { StylePanel } from '@/components/StylePanel';
import { Hud } from '@/components/Hud';
import { HelpButton } from '@/components/HelpButton';
import { BrushCursor } from '@/components/BrushCursor';
import { PracticeGuide } from '@/components/practice/PracticeGuide';
import { PracticePanel } from '@/components/practice/PracticePanel';
import { PracticePicker } from '@/components/practice/PracticePicker';
import { PracticeComplete } from '@/components/practice/PracticeComplete';
import { WelcomeCard } from '@/components/WelcomeCard';

declare global {
  interface Window { __studio?: ReturnType<Studio['debug']> }
}

export default function App() {
  const [studio] = useState(() => new Studio((msg, opts) => toast(msg, opts)));
  return (
    <StudioContext.Provider value={studio}>
      <TooltipProvider delayDuration={250} skipDelayDuration={400}>
        <Shell />
        <Toaster
          position="bottom-center"
          offset={64}
          mobileOffset={76}
          duration={2200}
          toastOptions={{ className: 'rounded-[11px] border-0 shadow-[var(--tl-shadow)] text-[12px]' }}
        />
      </TooltipProvider>
    </StudioContext.Provider>
  );
}

function Shell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 720);
  const [helpOpen, setHelpOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const studio = useStudio();
  const fatal = useStudioState((s) => s.fatal);
  const practice = useStudioState((s) => s.practice);

  // Attach the engine to the canvas once it is mounted.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    studio.attach(canvas);
    setCanvasEl(canvas);
    window.__studio = studio.debug();
    return () => studio.dispose();
  }, [studio]);

  // A lesson sets the brush for you and needs the whole canvas: collapse the style
  // panel while one is open and bring it back afterwards.
  const panelBeforeLesson = useRef<boolean | null>(null);
  const inLesson = practice !== null;
  useEffect(() => {
    if (inLesson) {
      if (panelBeforeLesson.current === null) { panelBeforeLesson.current = panelOpen; setPanelOpen(false); }
    } else if (panelBeforeLesson.current !== null) {
      setPanelOpen(panelBeforeLesson.current);
      panelBeforeLesson.current = null;
    }
    // panelOpen is read only when a lesson starts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inLesson]);

  // Keyboard shortcuts (tldraw-like: D draws, ? shows shortcuts)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const tag = el.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable) return;
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) studio.redo(); else studio.undo(); return; }
      if ((e.metaKey || e.ctrlKey) && k === 'y') { e.preventDefault(); studio.redo(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (k === 'd' || k === 'b') studio.setTool('brush');
      else if (k === 'e') studio.setTool('eraser');
      else if (k === 't') studio.drawSampleStroke();
      else if (k === 'q') studio.setPencilOnly(!studio.settings.pencilOnly);
      else if (k === 'c') studio.clear();
      else if (k === 's') studio.exportPNG();
      else if (k === 'p') setPanelOpen((o) => !o);
      else if (k === 'l') setPracticeOpen((o) => !o);
      else if (k === 'n') studio.skipStep();
      else if (e.key === '?') setHelpOpen((o) => !o);
      else if (k === '[') studio.nudgeWeight(-1);
      else if (k === ']') studio.nudgeWeight(1);
      else if (k === '0') studio.resetView();
      else if (k === 'f') studio.zoomToFit();
      else if (e.key === '+' || e.key === '=') studio.zoomBy(1.25);
      else if (e.key === '-' || e.key === '_') studio.zoomBy(1 / 1.25);
      else if (k === 'escape') { if (studio.isDrawing()) studio.cancelStroke(); else { setHelpOpen(false); setPracticeOpen(false); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [studio]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Single WebGL2 canvas: paper texture + p5.brush strokes */}
      <div id="studio-desk" className="absolute inset-0 overflow-hidden bg-[#f4f4f2]">
        <canvas ref={canvasRef} id="ink-canvas" className="absolute inset-0 block h-full w-full cursor-none touch-none" />
        <PracticeGuide />
      </div>
      <BrushCursor canvas={canvasEl} />

      {/* Practice: step card top-centre (below the quick actions on phones), result card above the dock */}
      {practice?.status === 'active' && (
        <div className="pointer-events-none fixed left-2 right-2 top-[56px] z-30 md:left-1/2 md:right-auto md:top-2 md:w-[420px] md:-translate-x-1/2">
          <PracticePanel />
        </div>
      )}
      {!practice && (
        <div className="pointer-events-none fixed bottom-16 left-1/2 z-30 -translate-x-1/2">
          <WelcomeCard onTryLesson={() => setPracticeOpen(true)} />
        </div>
      )}
      {practice?.status === 'complete' && (
        <div className="pointer-events-none fixed bottom-16 left-1/2 z-30 -translate-x-1/2">
          <PracticeComplete onChooseLesson={() => setPracticeOpen(true)} />
        </div>
      )}
      <PracticePicker open={practiceOpen} onOpenChange={setPracticeOpen} />

      {/* Chrome: fixed layers that never take pointer events except on their own controls */}
      <div className="pointer-events-none fixed left-2 top-2 z-30 flex items-start gap-2">
        <QuickActions onPractice={() => setPracticeOpen(true)} />
      </div>
      <div className="pointer-events-none fixed right-2 top-2 z-30">
        <StylePanel open={panelOpen} />
      </div>
      <div className="pointer-events-none fixed bottom-2 left-1/2 z-30 -translate-x-1/2">
        <ToolDock panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((o) => !o)} onPractice={() => setPracticeOpen((o) => !o)} />
      </div>
      <div className="pointer-events-none fixed bottom-2 left-2 z-30">
        <Hud />
      </div>
      <div className="pointer-events-none fixed bottom-2 right-2 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          className="tl-panel-sm pointer-events-auto hidden h-9 items-center px-3 text-[11px] font-medium text-[var(--tl-text-2)] hover:bg-[var(--tl-low)] sm:inline-flex"
        >
          {panelOpen ? "Hide styles" : "Show styles"}<kbd className="tl-kbd-hint ml-2 rounded bg-[var(--tl-low)] px-1 font-mono text-[10px]">P</kbd>
        </button>
        <HelpButton open={helpOpen} onOpenChange={setHelpOpen} />
      </div>

      {fatal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f4f4f2]/95 p-6">
          <div className="tl-panel max-w-md space-y-2 p-6 text-[13px]">
            <div className="font-semibold text-[var(--tl-danger)]">p5.brush could not start</div>
            <div className="text-[var(--tl-text-2)]">{fatal}</div>
          </div>
        </div>
      )}
    </div>
  );
}
