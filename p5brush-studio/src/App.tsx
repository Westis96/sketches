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
import { SessionScreen } from '@/components/practice/SessionScreen';
import { TeachScreen } from '@/components/practice/TeachScreen';
import { ResultsPanel } from '@/components/practice/ResultsPanel';
import { LearnHome } from '@/components/practice/LearnHome';
import { ProgressPage } from '@/components/practice/ProgressPage';
import { WelcomeCard } from '@/components/WelcomeCard';
import { PencilLab } from '@/components/PencilLab';
import { InputFilters } from '@/components/InputFilters';
import { PENCIL_LAB } from '@/lab';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useSfx } from '@/hooks/useSfx';
import { sfx } from '@/sound/sfx';
import { learnPath, missionPath, parseRoute, routeKey, sessionPath, sketchPath, warmupPath, type Route } from '@/practice/routes';
import { FlaskConical, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Kbd } from '@/components/ui/kbd';

declare global {
  interface Window { __studio?: ReturnType<Studio['debug']>; __sfx?: typeof sfx }
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

/** The course is the home; the studio is a mode. Returning users land where they were last. */
type Mode = 'learn' | 'session' | 'progress' | 'sketch';
const MODE_KEY = 'p5brush-studio:mode';
const modeOf = (r: Route): Mode =>
  r.kind === 'session' || r.kind === 'warmup' ? 'session' : r.kind === 'progress' ? 'progress' : r.kind === 'studio' ? 'sketch' : 'learn';

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
  useSfx(studio);
  const location = useLocation();
  const navigate = useNavigate();
  const route = useMemo(() => parseRoute(location.pathname, location.search), [location.pathname, location.search]);
  const key = routeKey(route);
  const routeRef = useRef(route);
  routeRef.current = route;
  const mode = modeOf(route);

  // "/" is a redirect: the course on a first visit, otherwise wherever the user was last.
  useEffect(() => {
    if (route.kind !== 'root') return;
    let last: string | null = null;
    try { last = localStorage.getItem(MODE_KEY); } catch { /* ignore */ }
    navigate(last === 'sketch' ? sketchPath() : learnPath(), { replace: true });
  }, [route.kind, navigate]);
  useEffect(() => {
    if (mode !== 'learn' && mode !== 'sketch') return;
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
  }, [mode]);

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
    window.__sfx = sfx;
    return () => studio.dispose();
  }, [studio]);

  // The route names the run that should exist; the engine owns it. Start or end
  // runs as the route changes, and bounce back to the bubble if a run can't start.
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

  // The welcome card would sit under the style panel on an iPad in portrait: collapse
  // the panel while it is up and bring it back afterwards.
  const panelBefore = useRef<boolean | null>(null);
  useEffect(() => {
    if (firstRun) {
      if (panelBefore.current === null) { panelBefore.current = panelOpen; setPanelOpen(false); }
    } else if (panelBefore.current !== null) {
      setPanelOpen(panelBefore.current);
      panelBefore.current = null;
    }
    // panelOpen is read only when the card appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstRun]);

  // Keyboard shortcuts (tldraw-like: D draws, ? shows shortcuts)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const tag = el.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable) return;
      const k = e.key.toLowerCase();
      const r = routeRef.current;
      const m = modeOf(r);
      if ((e.metaKey || e.ctrlKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) studio.redo(); else studio.undo(); return; }
      if ((e.metaKey || e.ctrlKey) && k === 'y') { e.preventDefault(); studio.redo(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (k === 'l') { setViaKey(true); navigate(m === 'sketch' ? learnPath() : sketchPath()); return; }
      if (k === 'escape') {
        if (studio.isDrawing()) { studio.cancelStroke(); return; }
        setViaKey(true);
        setHelpOpen(false);
        studio.dismissWelcome();
        // Open dialogs and popovers own Escape themselves (Base UI stops the key at the
        // document, so it never reaches this listener while one is open).
        if (r.kind === 'session') navigate(missionPath(r.missionId));
        else if (r.kind === 'warmup') navigate(learnPath());
        return;
      }
      if (m === 'session') { if (k === 'n') studio.skipStep(); else if (k === 'c') studio.restartPractice(); return; }
      if (m !== 'sketch') return;
      if (k === 'd' || k === 'b') studio.setTool('brush');
      else if (k === 'e') studio.setTool('eraser');
      else if (k === 't') studio.drawSampleStroke();
      else if (k === 'q') studio.setPencilOnly(!studio.settings.pencilOnly);
      else if (k === 'c') studio.clear();
      else if (k === 's') studio.exportPNG();
      else if (k === 'p') { setViaKey(true); setPanelOpen((o) => !o); }
      else if (k === 'k' && PENCIL_LAB) setLabOpen((o) => !o);
      else if (e.key === '?') { setViaKey(true); setHelpOpen((o) => !o); }
      else if (k === '[') studio.nudgeWeight(-1);
      else if (k === ']') studio.nudgeWeight(1);
      else if (k === '0') studio.resetView();
      else if (k === 'f') studio.zoomToFit();
      else if (e.key === '+' || e.key === '=') studio.zoomBy(1.25);
      else if (e.key === '-' || e.key === '_') studio.zoomBy(1 / 1.25);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [studio, navigate, setLabOpen]);

  const goLearn = () => { setViaKey(false); navigate(learnPath()); };
  const sketch = mode === 'sketch';

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Single WebGL2 canvas: paper texture + p5.brush strokes. The shell is fixed to the
          viewport rather than sized through the document, so it always fills the frame.
          The canvas stays mounted in every mode (it renders the thumbnails); Learn and
          Progress cover it. */}
      <div id="studio-desk" className="absolute inset-0 overflow-hidden bg-[var(--paper)]">
        <canvas ref={canvasRef} id="ink-canvas" className="absolute inset-0 block h-full w-full cursor-none touch-none" />
        <PracticeGuide />
      </div>
      {sketch && <BrushCursor canvas={canvasEl} />}

      {/* Session: focused chrome, then the docked results */}
      {mode === 'session' && practice?.status === 'active' && (practice.part === 'teach' ? <TeachScreen /> : <SessionScreen />)}
      {mode === 'session' && practice?.status === 'complete' && <ResultsPanel />}

      {/* Learn and Progress: full pages over the canvas */}
      {mode === 'learn' && <LearnHome selectedId={route.kind === 'mission' ? route.missionId : null} instant={viaKey} />}
      {mode === 'progress' && <ProgressPage />}

      {/* Sketch: the studio chrome */}
      {sketch && (
        <>
          <div className="pointer-events-none fixed bottom-[calc(3.5rem+max(0.5rem,env(safe-area-inset-bottom)))] left-1/2 z-30 -translate-x-1/2">
            <WelcomeCard onTryLesson={goLearn} />
          </div>
          <div className="safe-l safe-t pointer-events-none fixed z-30 flex items-start gap-2">
            <QuickActions onPractice={goLearn} onHelp={() => { setViaKey(false); setHelpOpen(true); }} />
          </div>
          {PENCIL_LAB && (labOpen ? (
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
            <ToolDock panelOpen={panelOpen} onTogglePanel={() => { setViaKey(false); setPanelOpen((o) => !o); }} onPractice={goLearn} />
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
        </>
      )}

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
