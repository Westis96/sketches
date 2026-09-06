import { useEffect, useMemo, useRef, useState } from 'react';
import { RouterProvider, createHashRouter, useLocation, useNavigate } from 'react-router';
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
import { PracticeComplete } from '@/components/practice/PracticeComplete';
import { PathScreen } from '@/components/practice/PathScreen';
import { MissionSheet } from '@/components/practice/MissionSheet';
import { ProgressScreen } from '@/components/practice/ProgressScreen';
import { WelcomeCard } from '@/components/WelcomeCard';
import { PencilLab } from '@/components/PencilLab';
import { InputFilters } from '@/components/InputFilters';
import { PENCIL_LAB } from '@/lab';
import { usePersistedState } from '@/hooks/usePersistedState';
import { learnPath, missionPath, parseRoute, routeKey, sessionPath, warmupPath } from '@/practice/routes';
import { FlaskConical, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Kbd } from '@/components/ui/kbd';

declare global {
  interface Window { __studio?: ReturnType<Studio['debug']> }
}

/**
 * Hash routes: the app ships as a single HTML file and as a static build with no
 * server rewrites, so paths live in the fragment and the back button works
 * everywhere. See src/practice/routes.ts for the map.
 */
const router = createHashRouter([{ path: '*', element: <Shell /> }]);

export default function App() {
  const [studio] = useState(() => new Studio((msg, opts) => toast(msg, opts)));
  return (
    <StudioContext.Provider value={studio}>
      <TooltipProvider delayDuration={250} skipDelayDuration={400}>
        <RouterProvider router={router} />
        <StudioToaster />
      </TooltipProvider>
    </StudioContext.Provider>
  );
}

/** Toasts sit above the dock; while the welcome card occupies that spot they move above it. */
function StudioToaster() {
  const firstRun = useStudioState((s) => s.firstRun);
  return (
    <Toaster
      position="bottom-center"
      offset={firstRun ? 312 : 64}
      mobileOffset={firstRun ? 324 : 76}
      duration={2200}
      toastOptions={{ className: 'rounded-[11px] border-0 shadow-[var(--shadow)] text-[12px]' }}
    />
  );
}

function Shell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 720);
  const [helpOpen, setHelpOpen] = useState(false);
  const studio = useStudio();
  const fatal = useStudioState((s) => s.fatal);
  const practice = useStudioState((s) => s.practice);
  const firstRun = useStudioState((s) => s.firstRun);
  const [labOpen, setLabOpen] = usePersistedState('p5brush-studio:lab:open', true);
  const location = useLocation();
  const navigate = useNavigate();
  const route = useMemo(() => parseRoute(location.pathname, location.search), [location.pathname, location.search]);
  const key = routeKey(route);
  const routeRef = useRef(route);
  routeRef.current = route;

  // Panels toggled from the keyboard (P, L, ?, Esc) change with no motion: those
  // actions repeat hundreds of times a day. The flag clears itself once the
  // transition would have ended, so the next pointer-driven toggle animates again.
  const [viaKey, setViaKey] = useState(false);
  useEffect(() => {
    if (!viaKey) return;
    const t = window.setTimeout(() => setViaKey(false), 350);
    return () => window.clearTimeout(t);
  }, [viaKey]);

  // Attach the engine to the canvas once it is mounted.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    studio.attach(canvas);
    setCanvasEl(canvas);
    window.__studio = studio.debug();
    return () => studio.dispose();
  }, [studio]);

  // The route names the run that should exist; the engine owns it. Start or end
  // runs as the route changes, and bounce back to the sheet if a run can't start.
  useEffect(() => {
    const pr = studio.getState().practice;
    if (route.kind === 'session') {
      if (!pr || pr.missionId !== route.missionId || pr.part !== route.part) {
        studio.startMission(route.missionId, route.part, { tier: route.tier });
        if (!studio.getState().practice) navigate(missionPath(route.missionId), { replace: true });
      }
    } else if (route.kind === 'warmup') {
      if (!pr || pr.part !== 'warmup') studio.startWarmup();
    } else if (pr) {
      studio.exitPractice(false);
    }
    // key captures everything about the route that matters here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, studio]);

  // A session started from the engine (a debug hook, the legacy entry point) gets
  // its URL; the other direction is handled above.
  useEffect(() => {
    if (!practice) return;
    const r = routeRef.current;
    if (practice.part === 'warmup') { if (r.kind !== 'warmup') navigate(warmupPath(), { replace: true }); return; }
    if (practice.missionId && (r.kind !== 'session' || r.missionId !== practice.missionId || r.part !== practice.part)) {
      navigate(sessionPath(practice.missionId, practice.part as Exclude<typeof practice.part, 'warmup'>, practice.tierLocked ? practice.tier : undefined), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice?.missionId, practice?.part, practice?.status === 'active']);

  // A lesson sets the brush for you and needs the whole canvas, and the welcome
  // card would sit under the panel on an iPad in portrait: collapse the style
  // panel while either is up and bring it back afterwards.
  const panelBeforeLesson = useRef<boolean | null>(null);
  const inLesson = practice !== null || firstRun;
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
      const r = routeRef.current;
      if ((e.metaKey || e.ctrlKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) studio.redo(); else studio.undo(); return; }
      if ((e.metaKey || e.ctrlKey) && k === 'y') { e.preventDefault(); studio.redo(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (k === 'd' || k === 'b') studio.setTool('brush');
      else if (k === 'e') studio.setTool('eraser');
      else if (k === 't') studio.drawSampleStroke();
      else if (k === 'q') studio.setPencilOnly(!studio.settings.pencilOnly);
      else if (k === 'c') studio.clear();
      else if (k === 's') studio.exportPNG();
      else if (k === 'p') { setViaKey(true); setPanelOpen((o) => !o); }
      else if (k === 'l') { setViaKey(true); navigate(r.kind === 'studio' ? learnPath() : '/'); }
      else if (k === 'k' && PENCIL_LAB) setLabOpen((o) => !o);
      else if (k === 'n') studio.skipStep();
      else if (e.key === '?') { setViaKey(true); setHelpOpen((o) => !o); }
      else if (k === '[') studio.nudgeWeight(-1);
      else if (k === ']') studio.nudgeWeight(1);
      else if (k === '0') studio.resetView();
      else if (k === 'f') studio.zoomToFit();
      else if (e.key === '+' || e.key === '=') studio.zoomBy(1.25);
      else if (e.key === '-' || e.key === '_') studio.zoomBy(1 / 1.25);
      else if (k === 'escape') {
        if (studio.isDrawing()) { studio.cancelStroke(); return; }
        setViaKey(true);
        setHelpOpen(false);
        studio.dismissWelcome();
        // Open dialogs own Escape themselves (Base UI stops the key at the document, so it
        // never reaches this listener while one is open); sessions have no dialog.
        if (r.kind === 'session') navigate(missionPath(r.missionId));
        else if (r.kind === 'warmup') navigate(learnPath());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [studio, navigate, setLabOpen]);

  const goLearn = () => { setViaKey(false); navigate(learnPath()); };
  const pathOpen = route.kind === 'learn' || route.kind === 'mission';

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Single WebGL2 canvas: paper texture + p5.brush strokes. The shell is fixed to the
          viewport rather than sized through the document, so it always fills the frame. */}
      <div id="studio-desk" className="absolute inset-0 overflow-hidden bg-[var(--paper)]">
        <canvas ref={canvasRef} id="ink-canvas" className="absolute inset-0 block h-full w-full cursor-none touch-none" />
        <PracticeGuide />
      </div>
      <BrushCursor canvas={canvasEl} />

      {/* Practice: step card top-centre (below the quick actions on phones), result card above the dock */}
      {practice?.status === 'active' && (
        <div className="practice-slot pointer-events-none">
          <PracticePanel />
        </div>
      )}
      {!practice && (
        <div className="pointer-events-none fixed bottom-[calc(3.5rem+max(0.5rem,env(safe-area-inset-bottom)))] left-1/2 z-30 -translate-x-1/2">
          <WelcomeCard onTryLesson={goLearn} />
        </div>
      )}
      {practice?.status === 'complete' && (
        <div className="pointer-events-none fixed bottom-[calc(3.5rem+max(0.5rem,env(safe-area-inset-bottom)))] left-1/2 z-30 -translate-x-1/2 lg:left-auto lg:right-2 lg:translate-x-0">
          <PracticeComplete />
        </div>
      )}

      {/* Sheets driven by the route */}
      <PathScreen open={pathOpen} instant={viaKey} hasChild={route.kind === 'mission'}>
        {route.kind === 'mission' && <MissionSheet key={route.missionId} missionId={route.missionId} open instant={viaKey} />}
      </PathScreen>
      <ProgressScreen open={route.kind === 'progress'} instant={viaKey} />

      {/* Chrome: fixed layers that never take pointer events except on their own controls */}
      <div className="safe-l safe-t pointer-events-none fixed z-30 flex items-start gap-2">
        <QuickActions onPractice={goLearn} onHelp={() => { setViaKey(false); setHelpOpen(true); }} />
      </div>
      {PENCIL_LAB && !practice && (labOpen ? (
        <div className="safe-l pointer-events-none fixed top-14 z-30 flex max-h-[calc(100%-120px)] flex-col gap-2 overflow-y-auto overscroll-contain pr-1" data-testid="lab-column">
          <div className="pointer-events-auto flex items-center justify-between px-1 text-[11px] font-medium text-[var(--text-3)]">
            <span>Lab</span>
            <Button variant="ghost" size="icon-xs" aria-label="Hide the lab panels (K)" title="Hide the lab panels (K)" onClick={() => setLabOpen(false)}><PanelLeftClose /></Button>
          </div>
          <InputFilters />
          <PencilLab defaultOpen={false} />
        </div>
      ) : (
        <div className="safe-l pointer-events-none fixed top-14 z-30">
          <Card size="sm" className="pointer-events-auto">
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2.5 text-[11px]" onClick={() => setLabOpen(true)} data-testid="lab-show">
              <FlaskConical className="text-[var(--accent-strong)]" />Lab<Kbd>K</Kbd>
            </Button>
          </Card>
        </div>
      ))}
      {/* Style panel: a floating column top-right; on phones a bottom sheet under the dock */}
      <div className="pointer-events-none fixed z-20 max-sm:inset-x-0 max-sm:bottom-0 sm:safe-r sm:safe-t sm:z-30">
        <StylePanel open={panelOpen} instant={viaKey} onOpenChange={(o) => { setViaKey(false); setPanelOpen(o); }} />
      </div>
      <div className="safe-b pointer-events-none fixed left-1/2 z-30 -translate-x-1/2">
        <ToolDock panelOpen={panelOpen} onTogglePanel={() => { setViaKey(false); setPanelOpen((o) => !o); }} onPractice={() => { setViaKey(false); navigate(route.kind === 'studio' ? learnPath() : '/'); }} />
      </div>
      <div className="safe-b safe-l pointer-events-none fixed z-30">
        <Hud />
      </div>
      <div className="safe-b safe-r pointer-events-none fixed z-30 flex items-center gap-2">
        <Card size="sm" className="pointer-events-auto hidden sm:block">
          <Button variant="ghost" size="sm" className="h-9 gap-2 px-3 text-[11px]" onClick={() => { setViaKey(false); setPanelOpen((o) => !o); }}>
            {panelOpen ? 'Hide styles' : 'Show styles'}<Kbd>P</Kbd>
          </Button>
        </Card>
        <HelpButton open={helpOpen} instant={viaKey} onOpenChange={(o, key) => { if (key) setViaKey(true); setHelpOpen(o); }} />
      </div>

      {fatal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--paper)]/95 p-6">
          <Card className="max-w-md space-y-2 p-6 text-[13px]">
            <div className="font-semibold text-[var(--danger)]">p5.brush could not start</div>
            <div className="text-[var(--text-2)]">{fatal}</div>
          </Card>
        </div>
      )}
    </div>
  );
}
