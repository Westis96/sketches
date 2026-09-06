/**
 * Studio — drives the real p5.brush 2.2.2 engine from pointer input.
 *
 *  - One WebGL2 canvas. p5.brush owns the compositing (spectral pigment mixing);
 *    StudioGL adds the paper texture, snapshots and a paper eraser.
 *  - Live preview: while the pointer is down the committed image is restored
 *    from a texture and the in-progress plot is re-stamped every frame with the
 *    same seed (brush.seed), so the stroke you see is the stroke you get on lift.
 *  - Strokes are vector records, so undo, paper changes, resize, autosave and
 *    the sketch export all replay deterministically. Clear is a record too.
 *
 * The class is framework-free; React subscribes through `subscribe/getState`.
 */
import * as brush from 'p5.brush/standalone';
import type { BrushParams } from 'p5.brush/standalone';
import { StudioGL, type Dab } from './StudioGL';
import { compileTip, checkTip, tipExtent } from './tipShim';
import {
  CHUNK_MIN_RAW, DEFAULT_SPEC, DEFAULT_TIP_SOURCE, SAVE_VERSION, boundsIntersect, chunkPoints, chunkSpec, clamp, clone, conditionPoints,
  deserializeRecords, fmt, liveEnvelope, parseSpecCode, recordBounds, serializeRecords, specCode, strokeSegments, visibleRecords,
  type BrushRecord, type BrushSpec, type EraserRecord, type InputKind, type PaperName, type Point, type PressureMode,
  type StrokeRecord, type Tool,
} from './records';
import { BRUSH_TEMPLATES, matchTemplate, type BrushTemplate } from './templates';
import { LESSONS, LESSON_BOX, lessonById, lessonSteps, stepWidth, type Lesson, type LessonStep } from '@/practice/lessons';
import { pathLength } from '@/practice/geometry';
import { PASS_SCORE, scoreTrace, starsFor } from '@/practice/score';
import { loadProgress, recordRun, saveProgress, type Progress } from '@/practice/progress';

export const paperPresets: Record<PaperName, { bg: [number, number, number]; grain: number; label: string }> = {
  hotpress: { bg: [255, 254, 250], grain: 2.2, label: 'Hot Press Fine Art' },
  washi: { bg: [250, 247, 240], grain: 3.8, label: 'Warm Japanese Washi' },
  bristol: { bg: [255, 255, 255], grain: 1.0, label: 'Smooth Bristol Pure White' },
};

export interface Settings {
  spec: BrushSpec;
  tipSource: string;
  size: number;              // brush.set(name, color, size) → strokeWeight
  color: string;
  paper: PaperName;
  tool: Tool;
  eraserSize: number;
  pressureMode: PressureMode;
  forceSensitivity: number;
  pencilOnly: boolean;
  /** Auto-enable pencilOnly the first time an Apple Pencil is seen (off once set by hand). */
  pencilAuto: boolean;
}

export interface Hud {
  pointerType: string | null;
  pressure: number;
  tiltX: number;
  tiltY: number;
  stamps: number;
}

/** Camera: screen (CSS px) = world * zoom + pan. World units are CSS px at zoom 1. */
export interface View { x: number; y: number; zoom: number }
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 8;

export interface PracticeFeedback { step: number; score: number; reversed: boolean; accepted: boolean; at: number }
export interface PracticeSummary { score: number; stars: number; newBest: boolean }
export interface PracticeState {
  lessonId: string;
  /** Index of the step being traced; equals the step count once complete. */
  step: number;
  /** Per finished step: score, or null when skipped. */
  results: Array<number | null>;
  status: 'active' | 'complete';
  /** Show the remaining reference strokes on the canvas. */
  guide: boolean;
  feedback: PracticeFeedback | null;
  /** Consecutive steps scored 80 or better. */
  streak: number;
  summary: PracticeSummary | null;
}

export interface StudioState {
  settings: Settings;
  hud: Hud;
  canUndo: boolean;
  canRedo: boolean;
  strokeCount: number;       // visible strokes (after the last clear)
  tipExtent: number;         // ink extent of the current tip, fraction of the 100-unit space
  tipError: string | null;
  fatal: string | null;
  /** Template id → PNG data URL of a stroke rendered by the engine; null until generated. */
  templatePreviews: Record<string, string> | null;
  view: View;
  /** Tracing lesson in progress, or null in free drawing. */
  practice: PracticeState | null;
  /** Lesson id → engine-rendered PNG data URL; null until requested. */
  lessonPreviews: Record<string, string> | null;
  progress: Progress;
  /** First visit with nothing saved: show the welcome card until dismissed. */
  firstRun: boolean;
}

export interface ToastOptions { action?: { label: string; onClick: () => void }; duration?: number }
export type Toast = (message: string, opts?: ToastOptions) => void;

const CHECKPOINT_EVERY = 8;
const MAX_CHECKPOINTS = 2;
/** Canvas snapshots kept around the most recent strokes so undo/redo of those is a texture swap. */
const MAX_STEP_SNAPS = 2;
/** Live chunks are stamped at most this often; fewer chunks make replays cheaper. */
const MIN_CHUNK_INTERVAL_MS = 15;
/** Rebuilds with more strokes than this are spread over frames so the UI never freezes. */
const PROGRESSIVE_MIN_STROKES = 12;
const PROGRESSIVE_BUDGET_MS = 9;
const POOL = 8;
const SAVE_KEY = `p5brush-studio:v${SAVE_VERSION}`;
const SAVE_DEBOUNCE_MS = 700;
const WELCOME_KEY = 'p5brush-studio:welcomed';

const DEFAULT_SETTINGS: Settings = {
  spec: DEFAULT_SPEC,
  tipSource: DEFAULT_TIP_SOURCE,
  size: 1,
  color: '#1a1c23',
  paper: 'hotpress',
  tool: 'brush',
  eraserSize: 24,
  pressureMode: 'gaussian',
  forceSensitivity: 1.25,
  pencilOnly: false,
  pencilAuto: true,
};

interface Live {
  id: number;
  pointerType: string;
  rect: DOMRect;
  rec: BrushRecord | EraserRecord;
  erasedUpTo: number;
  /** World position at which a point was last *recorded* (not merged), for pen/finger thinning. */
  lastRecorded: Point;
  /** Chunked brush stroke: conditioned length reached, path length stamped, chunk count, last chunk time. */
  condLen: number;
  stampedLen: number;
  chunk: number;
  lastChunkAt: number;
}

const round = (v: number, d: number) => Math.round(v * d) / d;

/** Extra shaping applied to plot pressures while stamping: `env(s)` at path length `s` from `s0`. */
interface StrokeShape { s0: number; env: (s: number) => number }


export class Studio {
  private state: StudioState = {
    settings: clone(DEFAULT_SETTINGS),
    hud: { pointerType: null, pressure: 0, tiltX: 0, tiltY: 0, stamps: 0 },
    canUndo: false,
    canRedo: false,
    strokeCount: 0,
    tipExtent: 0.5,
    tipError: null,
    fatal: null,
    templatePreviews: null,
    view: { x: 0, y: 0, zoom: 1 },
    practice: null,
    lessonPreviews: null,
    progress: loadProgress(),
    firstRun: false,
  };
  private listeners = new Set<() => void>();

  private canvas: HTMLCanvasElement | null = null;
  private sgl: StudioGL | null = null;
  private cssW = 0; private cssH = 0; private dpr = 1; private glW = 1; private glH = 1;

  private strokes: StrokeRecord[] = [];
  private redoStack: StrokeRecord[] = [];
  private checkpoints: Array<{ count: number; tex: WebGLTexture }> = [];
  /** Canvas as it was with `count` strokes, kept for the most recent strokes: undo swaps it in. */
  private undoSnaps: Array<{ count: number; tex: WebGLTexture }> = [];
  /** Canvas after an undone stroke, so redo of it is a swap too. */
  private redoSnaps: Array<{ count: number; tex: WebGLTexture }> = [];
  private texPool: WebGLTexture[] = [];
  /** Progressive rebuild in flight (large drawings after a view or paper change). */
  private pending: { records: StrokeRecord[]; index: number; scratch: WebGLTexture; raf: number } | null = null;

  private live: Live | null = null;
  private previewQueued = false;
  private hudQueued = false;
  private pendingHud: Partial<Hud> = {};
  private resizeTimer = 0;
  private saveTimer = 0;
  private saveWarned = false;
  private restored = false;
  private sampleQueued = false;
  private detach: (() => void) | null = null;
  private extentCache = new Map<string, number>();
  /**
   * Exact mirror of the canvas, kept current whenever the engine renders on it.
   * p5.brush composites each stroke against a copy of the canvas region under
   * it, which it takes from the default framebuffer with blitFramebuffer; on
   * WebKit that copy came back blank for small regions and hand-drawn strokes
   * rendered solid black on iPad. The engine's source copy is therefore served
   * from this texture instead (see the build-time transform in vite.config.ts),
   * and the live preview restores chunk regions from it too.
   */
  private mirrorTex: WebGLTexture | null = null;
  private mirrorReady = false;

  /** Whole-canvas refresh of the mirror; call after any non-engine write to the canvas the engine may read. */
  private refreshMirror() {
    const sgl = this.sgl!;
    this.mirrorTex ??= sgl.createTexture();
    sgl.snapshot(this.mirrorTex);
    this.mirrorReady = true;
  }
  private refreshMirrorRegion(r: { x: number; y: number; w: number; h: number }) {
    if (!this.mirrorReady) { this.refreshMirror(); return; }
    this.sgl!.snapshotRegion(this.mirrorTex!, r.x, r.y, r.w, r.h);
  }
  /** Engine hook: draws the mirror into the engine's bound source framebuffer instead of a canvas readback. */
  private blitSource = (gl: WebGL2RenderingContext, x0: number, y0: number, x1: number, y1: number): boolean => {
    if (!this.sgl || gl !== this.sgl.gl || !this.mirrorReady || !this.mirrorTex) return false;
    this.sgl.drawIntoBound(this.mirrorTex, x0, y0, x1, y1);
    return true;
  };
  /** Rolling cost counters (ms), read through the debug hook. */
  private perf = { previewMs: 0, previewFrames: 0, chunkMs: 0, chunks: 0, restoreMs: 0, stampMs: 0, snapMs: 0, plotMs: 0, compositeMs: 0, rebuildMs: 0, rebuilds: 0, paintStrokes: 0 };
  /** The user's drawing while a lesson occupies the canvas. */
  private practiceBackup: { strokes: StrokeRecord[]; redo: StrokeRecord[]; settings: Settings; view: View } | null = null;
  private lessonPreviewsQueued = false;

  // Camera. `committedView` is the view the committed texture was rendered at.
  private view: View = { x: 0, y: 0, zoom: 1 };
  private committedView: View = { x: 0, y: 0, zoom: 1 };
  private gesture: {
    touches: Map<number, { x: number; y: number }>;
    start: Map<number, { x: number; y: number }>;
    startView: View;
    maxFingers: number;
    startedAt: number;
    moved: number;
    mode: 'touch' | 'mouse';
  } | null = null;
  private viewPreviewQueued = false;
  private wheelTimer = 0;
  private spaceHeld = false;

  // One p5.brush brush per distinct tip source (the only thing that needs the
  // 500×500 rasterisation). p5.brush reads the params object by reference at
  // stroke time — the contract its own scaleBrushes() relies on — so the
  // per-stroke numbers are patched in place.
  private registry = new Map<string, { name: string; params: BrushParams; tick: number }>();
  private regTick = 0;

  constructor(private toast: Toast = () => {}) {
    this.restoreSaved();
    this.state.tipExtent = this.extentFor(this.state.settings.tipSource);
  }

  // ---------------------------------------------------------------------------
  // Store
  // ---------------------------------------------------------------------------
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getState = () => this.state;

  private emit(patch: Partial<StudioState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }
  private set(patch: Partial<Settings>) {
    this.emit({ settings: { ...this.state.settings, ...patch } });
    this.scheduleSave();
    if (patch.tipSource !== undefined || patch.spec !== undefined) this.warmBrush();
  }

  /** Registers (rasterises) the current tip ahead of the first stroke that needs it. */
  private warmBrush() {
    if (!this.sgl || this.live) return;
    try { this.ensureRegistered({ spec: this.settings.spec, tipSource: this.settings.tipSource } as BrushRecord, this.view.zoom); } catch { /* invalid tip: reported by setTipSource */ }
  }
  get settings() { return this.state.settings; }
  isDrawing() { return this.live !== null; }

  private syncHistory() {
    const pr = this.state.practice;
    this.emit({
      canUndo: pr ? pr.status === 'active' && pr.step > 0 : this.strokes.length > 0,
      canRedo: pr ? false : this.redoStack.length > 0,
      strokeCount: visibleRecords(this.strokes).length,
    });
    this.scheduleSave();
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------
  private restoreSaved() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const doc = JSON.parse(raw) as { v?: number; settings?: Partial<Settings>; strokes?: unknown };
      if (doc?.v !== SAVE_VERSION) return;
      const s = doc.settings ?? {};
      const settings: Settings = {
        ...clone(DEFAULT_SETTINGS),
        ...s,
        spec: { ...clone(DEFAULT_SPEC), ...(s.spec ?? {}) },
        tool: 'brush',
      };
      try { checkTip(settings.tipSource); } catch { settings.tipSource = DEFAULT_TIP_SOURCE; }
      this.state = { ...this.state, settings };
      const v = (doc as { view?: View }).view;
      if (v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.zoom)) {
        this.view = { x: v.x, y: v.y, zoom: clamp(v.zoom, MIN_ZOOM, MAX_ZOOM) };
        this.committedView = { ...this.view };
        this.state = { ...this.state, view: { ...this.view } };
      }
      this.strokes = deserializeRecords(doc.strokes);
      this.restored = this.strokes.length > 0;
    } catch {
      /* corrupt or unavailable storage: start fresh */
    }
  }

  private scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveNow(), SAVE_DEBOUNCE_MS);
  }

  private saveNow() {
    clearTimeout(this.saveTimer);
    try {
      // A lesson never overwrites the user's drawing: while one is open the backup is what gets saved.
      const b = this.practiceBackup;
      const doc = b
        ? { v: SAVE_VERSION, settings: b.settings, view: b.view, strokes: serializeRecords(b.strokes) }
        : { v: SAVE_VERSION, settings: this.settings, view: this.view, strokes: serializeRecords(this.strokes) };
      localStorage.setItem(SAVE_KEY, JSON.stringify(doc));
    } catch {
      if (!this.saveWarned) {
        this.saveWarned = true;
        this.toast('Autosave paused: the drawing no longer fits in browser storage', { duration: 5000 });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  attach(canvas: HTMLCanvasElement) {
    // React StrictMode mounts twice: keep GL resources when re-attaching to the same canvas.
    if (this.canvas !== canvas || !this.sgl) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, depth: false, stencil: false });
      if (!gl) { this.emit({ fatal: 'WebGL2 is required (p5.brush renders its stamps and spectral blending on the GPU).' }); return; }
      try {
        this.sgl = new StudioGL(gl);
      } catch (err) {
        this.emit({ fatal: 'Could not compile the studio shaders: ' + (err as Error).message });
        return;
      }
    }

    (globalThis as unknown as { __p5brushBlitSource?: unknown }).__p5brushBlitSource = this.blitSource;
    const onDown = (e: PointerEvent) => this.onPointerDown(e);
    const onMove = (e: PointerEvent) => this.onPointerMove(e);
    const onUp = (e: PointerEvent) => this.onPointerUp(e);
    const prevent = (e: Event) => e.preventDefault();
    const onResize = () => this.onResize();
    const onLost = (e: Event) => { e.preventDefault(); this.emit({ fatal: 'WebGL context lost. Reload the page to continue.' }); };
    const onHide = () => { if (document.visibilityState === 'hidden') this.saveNow(); };
    const onWheel = (e: WheelEvent) => this.onWheel(e);
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement).tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      this.spaceHeld = e.type === 'keydown';
      if (e.type === 'keydown' && !e.repeat) e.preventDefault();
    };

    canvas.addEventListener('pointerdown', onDown, { passive: false });
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { passive: false });
    window.addEventListener('pointercancel', onUp, { passive: false });
    canvas.addEventListener('touchstart', prevent, { passive: false });
    canvas.addEventListener('touchmove', prevent, { passive: false });
    canvas.addEventListener('contextmenu', prevent);
    canvas.addEventListener('webglcontextlost', onLost);
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('gesturestart', prevent, { passive: false }); // Safari page pinch
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    this.detach = () => {
      const g = globalThis as unknown as { __p5brushBlitSource?: unknown };
      if (g.__p5brushBlitSource === this.blitSource) delete g.__p5brushBlitSource;
      canvas.removeEventListener('wheel', onWheel);
      document.removeEventListener('gesturestart', prevent);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('touchstart', prevent);
      canvas.removeEventListener('touchmove', prevent);
      canvas.removeEventListener('contextmenu', prevent);
      canvas.removeEventListener('webglcontextlost', onLost);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };

    this.resize(true);
    this.syncHistory();
    setTimeout(() => { try { this.renderTemplatePreviews(); } catch (err) { console.warn('[studio] template previews failed', err); } }, 500);
    if (!this.sampleQueued) {
      this.sampleQueued = true;
      if (this.restored) {
        try { localStorage.setItem(WELCOME_KEY, '1'); } catch { /* ignore */ } // returning users never need the card
        this.toast(`Restored your drawing (${visibleRecords(this.strokes).length} strokes)`);
      } else {
        setTimeout(() => this.drawSampleStroke(), 120);
        let welcomed = false;
        try { welcomed = localStorage.getItem(WELCOME_KEY) === '1'; } catch { /* ignore */ }
        if (!welcomed) this.emit({ firstRun: true });
      }
    }
  }

  dispose() {
    this.detach?.();
    this.detach = null;
    clearTimeout(this.resizeTimer);
    this.saveNow();
  }

  // ---------------------------------------------------------------------------
  // Brush registration
  // ---------------------------------------------------------------------------
  private ensureRegistered(rec: BrushRecord, zoom = 1): string {
    let entry = this.registry.get(rec.tipSource);
    if (!entry) {
      let name = 'studio-' + this.registry.size;
      if (this.registry.size >= POOL) {
        let oldestKey: string | null = null;
        for (const [k, e] of this.registry) if (oldestKey === null || e.tick < this.registry.get(oldestKey)!.tick) oldestKey = k;
        name = this.registry.get(oldestKey!)!.name;
        this.registry.delete(oldestKey!);
      }
      const params: BrushParams = { ...clone(rec.spec), tip: compileTip(rec.tipSource) };
      brush.add(name, params);
      entry = { name, params, tick: 0 };
      this.registry.set(rec.tipSource, entry);
    }
    entry.tick = ++this.regTick;
    const { params } = entry, sp = rec.spec;
    // Zoom scales weight, scatter and spacing exactly like p5.brush's scaleBrushes(),
    // so stamp count, seed sequence and alpha are identical at every zoom level.
    params.weight = sp.weight * zoom; params.scatter = sp.scatter * zoom; params.opacity = sp.opacity;
    params.spacing = sp.spacing * zoom; params.noise = clamp(sp.noise, 0, 1);
    params.rotate = sp.rotate; params.markerTip = sp.markerTip;
    params.pressure = { type: 'gaussian', mode: 'gaussian', curve: sp.pressure.curve, min_max: sp.pressure.min_max };
    return entry.name;
  }

  private extentFor(tipSource: string): number {
    let v = this.extentCache.get(tipSource);
    if (v === undefined) { v = tipExtent(tipSource); this.extentCache.set(tipSource, v); }
    return v;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  /** Stamps a brush record on top of whatever is in the framebuffer. Returns stamp count. */
  private renderBrushStroke(rec: BrushRecord): number {
    if (rec.chunks) return this.renderChunked(rec);
    const stamps = this.stampRecord(rec, this.glW, this.glH, this.dpr, this.committedView);
    this.refreshMirrorRegion(this.chunkRegion(rec, rec.points));
    return stamps;
  }

  /**
   * p5.brush carries a small amount of state from one stroke into the next: the
   * pressure cache consulted by the start-of-stroke marker tip is only reset
   * after that tip is drawn, and the first stroke after brush.load() sees cold
   * blend framebuffers. Both make a stroke's first stamps depend on what was
   * rendered before it, which would let live strokes drift from their replays.
   * Rendering a fixed, invisible (opacity 0) priming stroke before every real
   * render puts the engine in the same state each time.
   */
  private static readonly PRIME_SPEC: BrushSpec = { ...DEFAULT_SPEC, opacity: 0, weight: 4, spacing: 1, noise: 0, markerTip: false };
  private primeEngine(glW: number, glH: number, dpr: number) {
    const cx = glW / dpr / 2, cy = glH / dpr / 2;
    const rec: BrushRecord = {
      tool: 'brush', spec: Studio.PRIME_SPEC, tipSource: DEFAULT_TIP_SOURCE, size: 1, color: '#000000',
      pressureMode: 'gaussian', sensitivity: 1, seed: 1,
      points: [{ x: cx - 4, y: cy, p: 0.5 }, { x: cx + 4, y: cy, p: 0.5 }],
    };
    this.stampRaw(rec, glW, glH, dpr, { x: 0, y: 0, zoom: 1 });
  }

  /**
   * Engine call for one record on the currently loaded p5.brush target.
   * Geometry is resampled in world space (zoom-independent), then mapped to
   * screen space; the brush itself is scaled by zoom in ensureRegistered().
   */
  private stampRecord(rec: BrushRecord, glW: number, glH: number, dpr: number, view: View, shape?: StrokeShape): number {
    this.primeEngine(glW, glH, dpr);
    return this.stampRaw(rec, glW, glH, dpr, view, shape);
  }

  private stampRaw(rec: BrushRecord, glW: number, glH: number, dpr: number, view: View, shape?: StrokeShape): number {
    const name = this.ensureRegistered(rec, view.zoom);
    const { origin, segs, endA, endP, stamps } = strokeSegments(rec);
    const plot = new brush.Plot('curve');
    let s0 = shape?.s0 ?? 0;
    for (const s of segs) {
      plot.addSegment(s.a, s.len * view.zoom, shape ? s.p * shape.env(s0) : s.p, true);
      s0 += s.len;
    }
    plot.endPlot(endA, shape ? endP * shape.env(s0) : endP, true);
    brush.seed(rec.seed);
    brush.push();
    brush.translate(-glW / 2, -glH / 2); // p5.brush origin is the canvas centre
    brush.scale(dpr);                    // work in CSS (screen) pixels
    brush.set(name, rec.color, rec.size);
    const t0 = performance.now();
    plot.draw(origin.x * view.zoom + view.x, origin.y * view.zoom + view.y, 1);
    brush.pop();
    const t1 = performance.now();
    brush.render();
    this.perf.plotMs += t1 - t0; this.perf.compositeMs += performance.now() - t1;
    return stamps;
  }

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------
  /** Template matching the current spec + tip exactly, if any. */
  activeTemplate(): BrushTemplate | undefined {
    return matchTemplate(this.settings.spec, this.settings.tipSource);
  }

  applyTemplate(id: string) {
    const t = BRUSH_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    this.set({ spec: clone(t.spec), tipSource: t.tipSource, size: 1, tool: 'brush' });
    this.emit({ tipError: null, tipExtent: this.extentFor(t.tipSource) });
    this.toast(`Brush: ${t.name}`, { duration: 1200 });
  }

  /**
   * Renders one short stroke per template with the real engine on an offscreen
   * canvas. p5.brush has a single active target, so the main canvas is
   * re-loaded afterwards; the committed image lives in a texture and is untouched.
   */
  private renderTemplatePreviews() {
    if (this.state.templatePreviews || !this.canvas || this.live) return;
    const W = 240, H = 80;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const points: Point[] = [];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      points.push({ x: round(22 + t * (W - 44), 100), y: round(H / 2 + Math.sin(t * Math.PI * 2) * 16 - (t - 0.5) * 10, 100), p: round(0.5 + 0.35 * Math.sin(t * Math.PI), 1000) });
    }
    const out: Record<string, string> = {};
    this.renderOffscreen(c, (clearPaper) => {
      for (const t of BRUSH_TEMPLATES) {
        clearPaper();
        const rec: BrushRecord = { tool: 'brush', spec: clone(t.spec), tipSource: t.tipSource, size: 1, color: '#1a1c23', pressureMode: 'gaussian', sensitivity: 1.25, seed: 20240611, points };
        this.stampRecord(rec, W, H, 1, { x: 0, y: 0, zoom: 1 });
        out[t.id] = c.toDataURL('image/png');
      }
    });
    this.emit({ templatePreviews: out });
  }

  /**
   * Runs `draw` with p5.brush loaded on an offscreen canvas, then re-loads the
   * main canvas. `clearPaper` clears through the offscreen canvas's own context
   * rather than brush.clear(): right after a load() the engine's mask
   * framebuffers still belong to the previous context (they are rebuilt lazily
   * on the first stroke), and brush.clear() would try to bind them.
   */
  private renderOffscreen(c: HTMLCanvasElement, draw: (clearPaper: () => void) => void) {
    const bg = paperPresets[this.settings.paper].bg;
    const pgl = c.getContext('webgl2')!;
    const clearPaper = () => {
      pgl.bindFramebuffer(pgl.FRAMEBUFFER, null);
      pgl.disable(pgl.SCISSOR_TEST);
      pgl.clearColor(bg[0] / 255, bg[1] / 255, bg[2] / 255, 1);
      pgl.clear(pgl.COLOR_BUFFER_BIT | pgl.DEPTH_BUFFER_BIT);
    };
    try {
      brush.load(c);
      brush.noFill(); brush.noHatch(); brush.noField();
      draw(clearPaper);
    } finally {
      brush.load(this.canvas!);
      brush.noFill(); brush.noHatch(); brush.noField();
    }
  }

  /** Engine-rendered thumbnails of every lesson, one lesson per frame; no-op once done. */
  ensureLessonPreviews() {
    if (this.state.lessonPreviews || this.lessonPreviewsQueued || !this.canvas) return;
    this.lessonPreviewsQueued = true;
    const W = 320, H = 240;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const zoom = Math.min(W / (LESSON_BOX.w + 40), H / (LESSON_BOX.h + 40));
    const view: View = { zoom, x: (W - LESSON_BOX.w * zoom) / 2, y: (H - LESSON_BOX.h * zoom) / 2 };
    const out: Record<string, string> = {};
    const queue = [...LESSONS];
    const next = () => {
      const lesson = queue.shift();
      if (!lesson) { this.lessonPreviewsQueued = false; this.emit({ lessonPreviews: out }); return; }
      if (this.live) { requestAnimationFrame(next); return; } // never steal the engine mid-stroke
      try {
        this.renderOffscreen(c, (clearPaper) => {
          clearPaper();
          lessonSteps(lesson).forEach((st, i) => this.stampRecord(this.stepRecord(st, i), W, H, 1, view));
          out[lesson.id] = c.toDataURL('image/png');
        });
      } catch (err) {
        console.warn('[studio] lesson preview failed', lesson.id, err);
      }
      requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  }

  // ---------------------------------------------------------------------------
  // Practice (tracing lessons)
  // ---------------------------------------------------------------------------
  /** Reference stroke of a lesson step as a brush record (world units = lesson units). */
  private stepRecord(st: LessonStep, i: number): BrushRecord {
    const t = BRUSH_TEMPLATES.find((x) => x.id === st.template) ?? BRUSH_TEMPLATES[0];
    return {
      tool: 'brush', spec: clone(t.spec), tipSource: t.tipSource, size: st.size, color: st.color,
      pressureMode: 'gaussian', sensitivity: 1.25, seed: 7000 + i, points: st.points,
    };
  }

  private practiceLesson(): { lesson: Lesson; steps: LessonStep[] } | null {
    const pr = this.state.practice;
    const lesson = pr && lessonById(pr.lessonId);
    return lesson ? { lesson, steps: lessonSteps(lesson) } : null;
  }

  /** Opens a lesson: the current drawing is set aside (and still autosaved) until the lesson is left. */
  startPractice(id: string) {
    const lesson = lessonById(id);
    if (!lesson || !this.sgl) return;
    if (this.live) this.cancelStroke(true);
    this.dismissWelcome();
    if (!this.practiceBackup) {
      this.practiceBackup = { strokes: this.strokes, redo: this.redoStack, settings: clone(this.settings), view: { ...this.view } };
    }
    this.strokes = [];
    this.redoStack = [];
    this.emit({ practice: { lessonId: id, step: 0, results: [], status: 'active', guide: this.state.practice?.guide ?? true, feedback: null, streak: 0, summary: null } });
    this.frameLesson();
    this.syncHistory();
    this.practiceApplyBrush(0);
    this.toast(`${lesson.title}: trace the glowing stroke`, { duration: 2500 });
  }

  /** Fits the lesson box in the viewport, leaving room for the step card at the top. */
  private frameLesson() {
    const { w, h } = LESSON_BOX;
    // The step card sits top-centre on tablets and desktops (~180px tall) and below
    // the quick actions on phones; the dock takes the bottom.
    const top = this.cssW >= 768 ? 200 : 228, bottom = 72, side = 24;
    const zoom = clamp(Math.min((this.cssW - side * 2) / w, (this.cssH - top - bottom) / h), MIN_ZOOM, MAX_ZOOM);
    this.setViewLive({ zoom, x: this.cssW / 2 - (w / 2) * zoom, y: top + (this.cssH - top - bottom) / 2 - (h / 2) * zoom });
    this.committedView = { ...this.view };
    this.repaintPaper();
  }

  /** Leaves the lesson. `keep` keeps the traced drawing as the document instead of restoring the previous one. */
  exitPractice(keep = false) {
    if (!this.state.practice) return;
    if (this.live) this.cancelStroke(true);
    const b = this.practiceBackup;
    this.practiceBackup = null;
    this.emit({ practice: null });
    if (b) {
      if (!keep) {
        this.strokes = b.strokes;
        this.redoStack = b.redo;
        this.setViewLive(b.view);
        this.committedView = { ...this.view };
        this.repaintPaper();
      } else {
        this.redoStack = [];
      }
      this.set({ ...b.settings, tool: 'brush' });
      this.emit({ tipError: null, tipExtent: this.extentFor(b.settings.tipSource) });
    }
    this.syncHistory();
    this.saveNow();
  }

  /** Starts the open lesson over. */
  restartPractice() {
    const pr = this.state.practice;
    if (!pr) return;
    if (this.live) this.cancelStroke(true);
    this.strokes = [];
    this.redoStack = [];
    this.repaintPaper();
    this.emit({ practice: { ...pr, step: 0, results: [], status: 'active', feedback: null, streak: 0, summary: null } });
    this.syncHistory();
    this.practiceApplyBrush(0);
  }

  setPracticeGuide(guide: boolean) {
    const pr = this.state.practice;
    if (pr) this.emit({ practice: { ...pr, guide } });
  }

  /** Sets the brush, colour and size the reference stroke was made with. */
  private practiceApplyBrush(i: number) {
    const ctx = this.practiceLesson();
    const st = ctx?.steps[i];
    if (!st) return;
    const t = BRUSH_TEMPLATES.find((x) => x.id === st.template);
    if (!t) return;
    this.set({ spec: clone(t.spec), tipSource: t.tipSource, size: st.size, color: st.color, tool: 'brush' });
    this.emit({ tipError: null, tipExtent: this.extentFor(t.tipSource) });
  }

  private dropLastStroke() {
    this.strokes.pop();
    this.rebuild();
  }

  /** Scores the stroke just committed against the current step and advances or rejects it. */
  private practiceEvaluate(rec: StrokeRecord) {
    const pr = this.state.practice, ctx = this.practiceLesson();
    if (!pr || !ctx || pr.status !== 'active') return;
    if (rec.tool !== 'brush') { this.dropLastStroke(); this.syncHistory(); this.toast('Lessons are traced with the brush'); return; }
    const st = ctx.steps[pr.step];
    const tol = Math.max(10, stepWidth(st) * 0.6 + 4);
    if (rec.points.length < 2 || pathLength(rec.points) < tol) {
      this.dropLastStroke();
      this.syncHistory();
      return; // a tap: nothing to score
    }
    const res = scoreTrace(rec.points, st.points, tol);
    const accepted = res.score >= PASS_SCORE;
    const feedback: PracticeFeedback = { step: pr.step, score: res.score, reversed: res.reversed, accepted, at: Date.now() };
    if (!accepted) {
      this.dropLastStroke();
      this.emit({ practice: { ...pr, feedback, streak: 0 } });
      this.syncHistory();
      return;
    }
    this.advancePractice(res.score, feedback);
  }

  /** Leaves the current step open and moves on. */
  skipStep() {
    const pr = this.state.practice;
    if (pr?.status === 'active') this.advancePractice(null, null);
  }

  private advancePractice(score: number | null, feedback: PracticeFeedback | null) {
    const pr = this.state.practice, ctx = this.practiceLesson();
    if (!pr || !ctx) return;
    const results = [...pr.results];
    results[pr.step] = score;
    const step = pr.step + 1;
    const streak = score !== null && score >= 80 ? pr.streak + 1 : 0;
    if (step >= ctx.steps.length) {
      const total = results.reduce<number>((a, r) => a + (r ?? 0), 0) / ctx.steps.length;
      const finalScore = Math.round(total);
      const stars = starsFor(finalScore);
      const { progress, newBest } = recordRun(this.state.progress, ctx.lesson.id, finalScore, stars);
      saveProgress(progress);
      this.emit({ progress, practice: { ...pr, results, step, streak, feedback, status: 'complete', summary: { score: finalScore, stars, newBest } } });
      this.syncHistory();
      return;
    }
    this.emit({ practice: { ...pr, results, step, streak, feedback } });
    this.syncHistory();
    this.practiceApplyBrush(step);
  }

  /** Undo inside a lesson: removes the last traced stroke and reopens its step. */
  private practiceBack() {
    const pr = this.state.practice;
    if (!pr || pr.status !== 'active') return;
    if (pr.step === 0) { this.toast('Nothing to undo'); return; }
    const prev = pr.step - 1;
    const results = pr.results.slice(0, prev);
    if (pr.results[prev] !== null && this.strokes.length) this.dropLastStroke();
    this.emit({ practice: { ...pr, step: prev, results, feedback: null, streak: 0 } });
    this.syncHistory();
    this.practiceApplyBrush(prev);
  }

  /** Eraser dabs (device px) for the record's points from index `from` on. */
  private eraserDabs(rec: EraserRecord, from: number): Dab[] {
    const dabs: Dab[] = [];
    const { dpr } = this, v = this.committedView;
    const sx = (x: number) => (x * v.zoom + v.x) * dpr, sy = (y: number) => (y * v.zoom + v.y) * dpr;
    const r = (rec.size / 2) * v.zoom * dpr;
    const step = Math.max(0.75, rec.size * 0.12);
    const pts = rec.points;
    if (from === 0) dabs.push({ x: sx(pts[0].x), y: sy(pts[0].y), r });
    for (let i = Math.max(1, from); i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        dabs.push({ x: sx(a.x + (b.x - a.x) * t), y: sy(a.y + (b.y - a.y) * t), r });
      }
    }
    return dabs;
  }

  private renderRecord(rec: StrokeRecord) {
    if (rec.tool === 'clear') { this.sgl!.blit(this.sgl!.paperTex); this.refreshMirror(); }
    else if (rec.tool === 'eraser') { this.sgl!.eraseDabs(this.eraserDabs(rec, 0)); this.refreshMirror(); }
    else this.renderBrushStroke(rec);
  }

  private cullingEnabled = true;
  /** Records skipped by culling during the last paint (for tests and tuning). */
  private lastCulled = 0;

  /** World-space rectangle currently visible at the committed view. */
  private visibleWorldBounds() {
    const v = this.committedView;
    return { minX: -v.x / v.zoom, minY: -v.y / v.zoom, maxX: (this.cssW - v.x) / v.zoom, maxY: (this.cssH - v.y) / v.zoom };
  }

  /**
   * Restores `baseTex`, draws `records` on top, and stores the result as committed.
   * Records whose padded bounds miss the viewport are skipped: they cannot touch a
   * visible pixel, and off-screen strokes dominate the cost of large drawings.
   */
  private takeTexture(): WebGLTexture { return this.texPool.pop() ?? this.sgl!.createTexture(); }
  private releaseTexture(tex: WebGLTexture) { this.texPool.push(tex); }
  private dropSnaps(list: Array<{ count: number; tex: WebGLTexture }>) {
    for (const s of list) this.releaseTexture(s.tex);
    list.length = 0;
  }

  /** Finishes a progressive rebuild synchronously (before anything else touches the canvas). */
  private flushPaint() {
    const p = this.pending;
    if (!p) return;
    cancelAnimationFrame(p.raf);
    this.sgl!.blit(p.scratch);
    this.refreshMirror();
    while (p.index < p.records.length) this.paintOne(p.records[p.index++]);
    this.finishProgressive(p);
  }

  private cancelPaint() {
    const p = this.pending;
    if (!p) return;
    cancelAnimationFrame(p.raf);
    this.releaseTexture(p.scratch);
    this.pending = null;
  }

  private finishProgressive(p: NonNullable<typeof this.pending>) {
    const sgl = this.sgl!;
    sgl.snapshot(sgl.committedTex);
    this.releaseTexture(p.scratch);
    this.pending = null;
  }

  private paintOne(rec: StrokeRecord) {
    if (this.cullingEnabled && rec.tool !== 'clear' && !boundsIntersect(recordBounds(rec), this.visibleWorldBounds())) { this.lastCulled++; return; }
    this.renderRecord(rec);
    this.perf.paintStrokes++;
  }

  /**
   * Like paint(), spread over frames with a time budget. Each step starts by
   * blitting the state reached so far back into the drawing buffer (the engine
   * reads the canvas back while compositing, and on WebKit that read is only
   * reliable for content drawn in the same frame) and ends with a snapshot.
   */
  private paintProgressive(baseTex: WebGLTexture, records: StrokeRecord[]) {
    this.cancelPaint();
    const sgl = this.sgl!;
    const scratch = this.takeTexture();
    sgl.blit(baseTex);
    sgl.snapshot(scratch);
    this.lastCulled = 0;
    const p = { records, index: 0, scratch, raf: 0 };
    this.pending = p;
    const step = () => {
      if (this.pending !== p) return;
      const t0 = performance.now();
      sgl.blit(scratch);
      this.refreshMirror();
      while (p.index < p.records.length && performance.now() - t0 < PROGRESSIVE_BUDGET_MS) this.paintOne(p.records[p.index++]);
      sgl.snapshot(scratch);
      this.perf.rebuildMs += performance.now() - t0;
      if (p.index >= p.records.length) { this.finishProgressive(p); this.perf.rebuilds++; }
      else p.raf = requestAnimationFrame(step);
    };
    step();
  }

  private paint(baseTex: WebGLTexture, records: StrokeRecord[]) {
    const t0 = performance.now();
    try { this.paintInner(baseTex, records); } finally { this.perf.rebuildMs += performance.now() - t0; this.perf.rebuilds++; }
  }

  private paintInner(baseTex: WebGLTexture, records: StrokeRecord[]) {
    this.cancelPaint();
    const sgl = this.sgl!;
    sgl.blit(baseTex);
    this.refreshMirror();
    this.lastCulled = 0;
    for (const rec of records) this.paintOne(rec);
    sgl.snapshot(sgl.committedTex);
  }

  /** Drops checkpoints taken after `count` strokes. */
  private truncateCheckpoints(count: number) {
    while (this.checkpoints.length && this.checkpoints[this.checkpoints.length - 1].count > count) {
      this.sgl!.deleteTexture(this.checkpoints.pop()!.tex);
    }
  }

  /** Rebuilds the committed image for the current stroke list from the newest usable checkpoint. */
  private rebuild(progressive = false) {
    const n = this.strokes.length;
    this.truncateCheckpoints(n);
    this.undoSnaps = this.undoSnaps.filter((s) => s.count < n || (this.releaseTexture(s.tex), false));
    const cp = this.checkpoints[this.checkpoints.length - 1];
    const base = cp ? cp.tex : this.sgl!.paperTex;
    const records = cp ? this.strokes.slice(cp.count) : this.strokes;
    if (progressive && records.length > PROGRESSIVE_MIN_STROKES) this.paintProgressive(base, records);
    else this.paint(base, records);
  }

  /** Appends a record whose pixels are already in the framebuffer. */
  private pushRecord(rec: StrokeRecord, clearRedo = true) {
    const sgl = this.sgl!;
    // The old committed texture *is* the state before this stroke: keep the handle
    // for an instant undo instead of copying anything.
    this.undoSnaps.push({ count: this.strokes.length, tex: sgl.committedTex });
    while (this.undoSnaps.length > MAX_STEP_SNAPS) this.releaseTexture(this.undoSnaps.shift()!.tex);
    sgl.committedTex = this.takeTexture();
    sgl.snapshot(sgl.committedTex);
    this.strokes.push(rec);
    if (clearRedo) { this.redoStack = []; this.dropSnaps(this.redoSnaps); }
    const n = this.strokes.length;
    if (n % CHECKPOINT_EVERY === 0) {
      const tex = sgl.createTexture();
      sgl.snapshot(tex);
      this.checkpoints.push({ count: n, tex });
      while (this.checkpoints.length > MAX_CHECKPOINTS) sgl.deleteTexture(this.checkpoints.shift()!.tex);
    }
    this.syncHistory();
  }

  private commitRecord(rec: StrokeRecord, clearRedo = true) {
    this.flushPaint();
    this.sgl!.blit(this.sgl!.committedTex);
    this.refreshMirror();
    this.renderRecord(rec);
    this.pushRecord(rec, clearRedo);
  }

  undo = () => {
    if (this.live) this.cancelStroke();
    if (this.state.practice) { this.practiceBack(); return; }
    if (!this.strokes.length) { this.toast('Nothing to undo'); return; }
    this.flushPaint();
    this.redoStack.push(this.strokes.pop()!);
    const n = this.strokes.length, sgl = this.sgl!;
    const snap = this.undoSnaps.length && this.undoSnaps[this.undoSnaps.length - 1].count === n ? this.undoSnaps.pop()! : null;
    if (snap) {
      // Instant: the state before the stroke is a texture we still hold; the current
      // one becomes the redo state.
      this.redoSnaps.push({ count: n + 1, tex: sgl.committedTex });
      while (this.redoSnaps.length > MAX_STEP_SNAPS) this.releaseTexture(this.redoSnaps.shift()!.tex);
      sgl.committedTex = snap.tex;
      sgl.blit(sgl.committedTex);
      this.truncateCheckpoints(n);
    } else {
      this.rebuild();
    }
    this.syncHistory();
  };

  redo = () => {
    if (this.state.practice) return;
    const rec = this.redoStack.pop();
    if (!rec) return;
    const n = this.strokes.length, sgl = this.sgl!;
    const snap = this.redoSnaps.length && this.redoSnaps[this.redoSnaps.length - 1].count === n + 1 ? this.redoSnaps.pop()! : null;
    if (snap) {
      this.flushPaint();
      this.undoSnaps.push({ count: n, tex: sgl.committedTex });
      while (this.undoSnaps.length > MAX_STEP_SNAPS) this.releaseTexture(this.undoSnaps.shift()!.tex);
      sgl.committedTex = snap.tex;
      sgl.blit(sgl.committedTex);
      this.strokes.push(rec);
      this.syncHistory();
      return;
    }
    this.commitRecord(rec, false);
  };

  dismissWelcome() {
    if (!this.state.firstRun) return;
    this.emit({ firstRun: false });
    try { localStorage.setItem(WELCOME_KEY, '1'); } catch { /* ignore */ }
  }

  /** Clears the paper as an undoable history entry. */
  clear = () => {
    if (this.live) this.cancelStroke();
    if (this.state.practice) { this.restartPractice(); return; }
    if (visibleRecords(this.strokes).length === 0) { this.toast('The paper is already blank'); return; }
    this.commitRecord({ tool: 'clear' });
    this.toast('Canvas cleared', { action: { label: 'Undo', onClick: this.undo } });
  };

  /** Discards the stroke in progress (Escape, or a second finger turning it into a gesture). */
  cancelStroke = (quiet = false) => {
    if (!this.live) return;
    this.live = null;
    this.previewQueued = false;
    this.sgl!.blit(this.sgl!.committedTex);
    this.queueHud({ pressure: 0 });
    if (!quiet) this.toast('Stroke cancelled');
  };

  // ---------------------------------------------------------------------------
  // Paper + sizing
  // ---------------------------------------------------------------------------
  /** Seeded paper grain, anchored to world space so it scrolls and scales with the drawing. */
  private renderPaper() {
    const { glW, glH, dpr, cssW, cssH } = this;
    const v = this.committedView;
    const conf = paperPresets[this.settings.paper];
    const c = document.createElement('canvas');
    c.width = glW; c.height = glH;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = `rgb(${conf.bg[0]}, ${conf.bg[1]}, ${conf.bg[2]})`;
    ctx.fillRect(0, 0, glW, glH);

    const grainSize = 256;
    const g = document.createElement('canvas');
    g.width = g.height = grainSize;
    const gctx = g.getContext('2d')!;
    const img = gctx.createImageData(grainSize, grainSize);
    const d = img.data;
    const amp = conf.grain * 7;
    let seed = 0x9e3779b9 ^ conf.grain * 1000; // deterministic per paper
    const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), seed | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < d.length; i += 4) {
      const n = (rnd() + rnd() - 1) * amp; // triangular noise
      d[i] = clamp(conf.bg[0] + n, 0, 255);
      d[i + 1] = clamp(conf.bg[1] + n, 0, 255);
      d[i + 2] = clamp(conf.bg[2] + n * 0.9, 0, 255);
      d[i + 3] = 255;
    }
    gctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.scale(dpr, dpr);
    // The pattern origin follows the transform, so translating by the pan anchors
    // the grain to the world; it keeps its paper-sized scale at any zoom.
    ctx.translate(v.x, v.y);
    ctx.fillStyle = ctx.createPattern(g, 'repeat')!;
    ctx.fillRect(-v.x, -v.y, cssW, cssH);
    ctx.restore();
    this.sgl!.uploadPaper(c);
  }

  /** Paper or view changed: checkpoints embed the old paper/view, so replay everything. */
  private repaintPaper() {
    this.renderPaper();
    this.truncateCheckpoints(-1);
    this.dropSnaps(this.undoSnaps);
    this.dropSnaps(this.redoSnaps);
    this.rebuild(true);
  }

  private resize(force = false) {
    const canvas = this.canvas!;
    const desk = canvas.parentElement!;
    const nextW = desk.clientWidth || window.innerWidth;
    const nextH = desk.clientHeight || window.innerHeight;
    const nextDpr = Math.min(2, window.devicePixelRatio || 1);
    if (!force && nextW === this.cssW && nextH === this.cssH && nextDpr === this.dpr) return; // e.g. iOS keyboard viewport events
    this.cssW = nextW; this.cssH = nextH; this.dpr = nextDpr;
    this.glW = Math.max(1, Math.round(nextW * nextDpr));
    this.glH = Math.max(1, Math.round(nextH * nextDpr));
    canvas.width = this.glW; canvas.height = this.glH;
    canvas.style.width = nextW + 'px'; canvas.style.height = nextH + 'px';
    this.sgl!.setSize(this.glW, this.glH);
    brush.load(canvas);      // (re)registers the target with its new size
    brush.noFill(); brush.noHatch(); brush.noField();
    this.repaintPaper();
  }

  private onResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => { if (!this.live && !this.gesture) this.resize(); }, 150);
  }

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------
  get currentView(): View { return this.view; }

  toWorld(sx: number, sy: number): { x: number; y: number } {
    const v = this.view;
    return { x: (sx - v.x) / v.zoom, y: (sy - v.y) / v.zoom };
  }

  /** Sets the camera during an interaction: cheap transformed preview of the committed image. */
  private setViewLive(next: View) {
    this.view = { x: next.x, y: next.y, zoom: clamp(next.zoom, MIN_ZOOM, MAX_ZOOM) };
    this.emit({ view: { ...this.view } });
    if (this.viewPreviewQueued) return;
    this.viewPreviewQueued = true;
    requestAnimationFrame(() => {
      this.viewPreviewQueued = false;
      const sgl = this.sgl;
      if (!sgl) return;
      const v = this.view, c = this.committedView, dpr = this.dpr;
      const k = v.zoom / c.zoom;
      const bg = paperPresets[this.settings.paper].bg;
      sgl.clearColor(bg[0], bg[1], bg[2]);
      sgl.blitRect(sgl.committedTex, (v.x - c.x * k) * dpr, (v.y - c.y * k) * dpr, this.glW * k, this.glH * k);
    });
  }

  /** Interaction ended: re-render the drawing exactly at the new view. */
  private commitView() {
    const v = this.view, c = this.committedView;
    if (v.x === c.x && v.y === c.y && v.zoom === c.zoom) return;
    this.committedView = { ...v };
    this.repaintPaper();
    this.scheduleSave();
  }

  /** Zooms by `factor` around a screen point (defaults to the viewport centre). */
  zoomBy(factor: number, cx = this.cssW / 2, cy = this.cssH / 2) {
    const v = this.view;
    const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const k = zoom / v.zoom;
    this.setViewLive({ zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k });
    this.commitView();
  }

  setZoom(zoom: number) { this.zoomBy(zoom / this.view.zoom); }

  resetView() {
    this.setViewLive({ x: 0, y: 0, zoom: 1 });
    this.commitView();
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    if (this.live) return;
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.cssH : 1;
    const dx = e.deltaX * scale, dy = e.deltaY * scale;
    const rect = this.canvas!.getBoundingClientRect();
    const v = this.view;
    if (e.ctrlKey || e.metaKey) {
      // Trackpad pinch arrives as ctrl+wheel; zoom around the cursor.
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const zoom = clamp(v.zoom * Math.exp(-dy * 0.01), MIN_ZOOM, MAX_ZOOM);
      const k = zoom / v.zoom;
      this.setViewLive({ zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k });
    } else {
      this.setViewLive({ ...v, x: v.x - dx, y: v.y - dy });
    }
    clearTimeout(this.wheelTimer);
    this.wheelTimer = window.setTimeout(() => this.commitView(), 160);
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  private pointFromEvent(e: PointerEvent, rect: DOMRect): Point {
    let p = e.pressure;
    if (!(p > 0)) p = e.pointerType === 'pen' ? 0.02 : 0.5;
    // rect is the on-screen box; if the page is scaled (an embedding frame, iOS
    // zoom) it differs from the CSS size the camera works in.
    const kx = rect.width ? this.cssW / rect.width : 1, ky = rect.height ? this.cssH / rect.height : 1;
    const w = this.toWorld((e.clientX - rect.left) * kx, (e.clientY - rect.top) * ky);
    // Quantise at capture so autosaved replays are identical to the live stroke.
    return { x: round(w.x, 100), y: round(w.y, 100), p: round(p, 1000) };
  }

  /** A record captures everything needed to replay the stroke deterministically. */
  private newRecord(tool: Tool, firstPt: Point, input: InputKind = 'mouse'): BrushRecord | EraserRecord {
    const s = this.settings;
    if (tool === 'eraser') return { tool, size: s.eraserSize, points: [firstPt] };
    const spec = clone(s.spec);
    // 'stylus' mode disables the simulated envelope so only plot pressure remains.
    if (s.pressureMode === 'stylus') spec.pressure = { mode: 'gaussian', curve: [0, 0], min_max: [1, 1] };
    return {
      tool,
      spec,
      tipSource: s.tipSource,
      size: s.size,
      color: s.color,
      pressureMode: s.pressureMode,
      sensitivity: s.forceSensitivity,
      seed: (Math.random() * 2147483647) | 0,
      points: [firstPt],
      input,
    };
  }

  private screenPoint(e: PointerEvent) {
    const rect = this.canvas!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // -- gestures (fingers, middle mouse, space-drag) --------------------------
  private beginGesture(e: PointerEvent, mode: 'touch' | 'mouse') {
    const pt = this.screenPoint(e);
    this.gesture = {
      touches: new Map([[e.pointerId, pt]]),
      start: new Map([[e.pointerId, pt]]),
      startView: { ...this.view },
      maxFingers: 1,
      startedAt: performance.now(),
      moved: 0,
      mode,
    };
  }

  /** Re-anchors the gesture to the current fingers (called when a finger is added or removed). */
  private rebaseGesture() {
    const g = this.gesture!;
    g.start = new Map(g.touches);
    g.startView = { ...this.view };
  }

  private updateGesture() {
    const g = this.gesture!;
    const ids = [...g.start.keys()].filter((id) => g.touches.has(id));
    if (ids.length === 0) return;
    const s0 = g.start.get(ids[0])!, c0 = g.touches.get(ids[0])!;
    if (ids.length === 1) {
      this.setViewLive({ ...g.startView, x: g.startView.x + (c0.x - s0.x), y: g.startView.y + (c0.y - s0.y) });
      return;
    }
    const s1 = g.start.get(ids[1])!, c1 = g.touches.get(ids[1])!;
    const d0 = Math.hypot(s1.x - s0.x, s1.y - s0.y) || 1;
    const d1 = Math.hypot(c1.x - c0.x, c1.y - c0.y) || 1;
    const zoom = clamp(g.startView.zoom * (d1 / d0), MIN_ZOOM, MAX_ZOOM);
    const k = zoom / g.startView.zoom;
    const m0 = { x: (s0.x + s1.x) / 2, y: (s0.y + s1.y) / 2 };
    const m1 = { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2 };
    // Keep the world point under the initial midpoint under the current midpoint.
    this.setViewLive({ zoom, x: m1.x - (m0.x - g.startView.x) * k, y: m1.y - (m0.y - g.startView.y) * k });
  }

  private endGesture() {
    const g = this.gesture;
    if (!g) return;
    this.gesture = null;
    const dt = performance.now() - g.startedAt;
    const isTap = g.mode === 'touch' && dt < 300 && g.moved < 12;
    if (isTap && g.maxFingers === 2) { this.setViewLive(g.startView); this.commitView(); this.undo(); return; }
    if (isTap && g.maxFingers >= 3) { this.setViewLive(g.startView); this.commitView(); this.redo(); return; }
    this.commitView();
  }

  private onPointerDown(e: PointerEvent) {
    if (e.target !== this.canvas) return;
    const isTouch = e.pointerType === 'touch';
    const pt = this.screenPoint(e);
    if (isTouch) this.activeTouches.set(e.pointerId, pt);

    // Apple Pencil detected: fingers become navigation unless the user chose otherwise.
    if (e.pointerType === 'pen' && this.settings.pencilAuto && !this.settings.pencilOnly) {
      this.set({ pencilOnly: true });
      this.toast('Apple Pencil detected: fingers now pan and zoom, two-finger tap undoes', { duration: 4000 });
    }

    // A gesture is under way: further fingers join it, anything else is ignored.
    if (this.gesture) {
      if (isTouch && this.gesture.mode === 'touch') {
        e.preventDefault();
        this.gesture.touches.set(e.pointerId, pt);
        this.gesture.maxFingers = Math.max(this.gesture.maxFingers, this.gesture.touches.size);
        this.rebaseGesture();
      }
      return;
    }

    if (this.live) {
      // Pencil drawing: a finger is a resting palm. Ignore it.
      if (this.live.pointerType === 'pen' || !isTouch) { if (isTouch) e.preventDefault(); return; }
      // Finger drawing + second finger: it was a gesture all along (Procreate behaviour).
      e.preventDefault();
      this.cancelStroke(true);
      this.beginGesture(e, 'touch');
      const g = this.gesture!;
      for (const [id, p] of this.activeTouches) g.touches.set(id, p);
      g.start = new Map(g.touches);
      g.maxFingers = g.touches.size;
      return;
    }

    // Navigation: a finger when pencil-only, the middle button, or space-drag.
    const navigate = (isTouch && this.settings.pencilOnly) || (e.pointerType === 'mouse' && (e.button === 1 || (e.button === 0 && this.spaceHeld)));
    if (navigate) {
      e.preventDefault();
      this.beginGesture(e, isTouch ? 'touch' : 'mouse');
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    this.flushPaint();
    e.preventDefault(); // also suppresses the focus change, so commit any focused editor by hand
    (document.activeElement as HTMLElement | null)?.blur?.();
    try { this.canvas!.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const rect = this.canvas!.getBoundingClientRect();
    const input: InputKind = e.pointerType === 'pen' ? 'pen' : e.pointerType === 'touch' ? 'touch' : 'mouse';
    const first = this.pointFromEvent(e, rect);
    if (this.state.firstRun) this.dismissWelcome(); // drawing is the best dismissal
    const rec = this.newRecord(this.settings.tool, first, input);
    if (rec.tool === 'brush') rec.zoom = this.view.zoom;
    this.live = { id: e.pointerId, pointerType: e.pointerType, rect, rec, erasedUpTo: 0, lastRecorded: { ...first }, condLen: 0, stampedLen: 0, chunk: 0, lastChunkAt: 0 };
    this.updateHud(e);
    this.schedulePreview();
  }
  private activeTouches = new Map<number, { x: number; y: number }>();

  private onPointerMove(e: PointerEvent) {
    const g = this.gesture;
    if (g && g.touches.has(e.pointerId)) {
      e.preventDefault();
      const pt = this.screenPoint(e);
      const prev = g.touches.get(e.pointerId)!;
      g.moved += Math.hypot(pt.x - prev.x, pt.y - prev.y);
      g.touches.set(e.pointerId, pt);
      if (e.pointerType === 'touch') this.activeTouches.set(e.pointerId, pt);
      this.updateGesture();
      return;
    }
    if (e.pointerType === 'touch' && this.activeTouches.has(e.pointerId)) this.activeTouches.set(e.pointerId, this.screenPoint(e));
    const live = this.live;
    if (!live || e.pointerId !== live.id) return;
    e.preventDefault();
    this.updateHud(e);
    const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    const list = coalesced.length ? coalesced : [e];
    live.rect = this.canvas!.getBoundingClientRect();
    const pts = live.rec.points;
    // Pen and finger samples arrive at up to 240 Hz; like tldraw, only record a new
    // point once the pointer has moved a screen pixel, otherwise fold the sample into
    // the last point (moving it, keeping the higher pressure). Mouse keeps every move.
    const minDist = live.pointerType === 'mouse' ? 0.15 : 1 / this.view.zoom;
    for (const ev of list) {
      const pt = this.pointFromEvent(ev, live.rect);
      const last = pts[pts.length - 1];
      if (Math.hypot(pt.x - live.lastRecorded.x, pt.y - live.lastRecorded.y) < minDist) {
        // Fold into the last point: it follows the pointer, but the reference for the
        // next distance check stays where a point was last recorded.
        if (pts.length > 1) { last.x = pt.x; last.y = pt.y; }
        last.p = Math.max(last.p, pt.p);
        continue;
      }
      pts.push(pt);
      live.lastRecorded = { ...pt };
    }
    this.schedulePreview();
  }

  private onPointerUp(e: PointerEvent) {
    this.activeTouches.delete(e.pointerId);
    const g = this.gesture;
    if (g && g.touches.has(e.pointerId)) {
      e.preventDefault();
      g.touches.delete(e.pointerId);
      if (g.touches.size === 0) this.endGesture();
      else this.rebaseGesture();
      return;
    }
    const live = this.live;
    if (!live || e.pointerId !== live.id) return;
    e.preventDefault();
    this.live = null;
    this.previewQueued = false;
    this.queueHud({ pressure: 0 });
    if (live.rec.tool === 'brush') {
      // Stamp whatever is left as the last chunk. Nothing is re-rendered on lift:
      // the chunk boundaries are recorded, so every replay repeats exactly this.
      this.stampNextChunk(live, live.rec.points.length, true);
    } else if (live.rec.points.length > live.erasedUpTo) {
      this.sgl!.eraseDabs(this.eraserDabs(live.rec, live.erasedUpTo));
    }
    this.pushRecord(live.rec);
    if (this.state.practice?.status === 'active') this.practiceEvaluate(live.rec);
  }

  private schedulePreview() {
    if (this.previewQueued) return;
    this.previewQueued = true;
    requestAnimationFrame(() => this.renderPreview());
  }

  /**
   * Live view. Eraser dabs are cumulative and applied as they arrive. Brush
   * strokes are stamped incrementally too: each frame only the segment since the
   * last frame is rendered, so the cost per frame stays constant however long
   * the stroke gets (re-stamping the whole stroke made the ink trail further
   * behind the pencil the longer one drew). Per-stroke effects that would leave
   * seams between chunks are disabled (marker tips, the per-stroke alpha noise,
   * the engine's length-relative pressure envelope); a fixed-length start rise
   * stands in for the envelope until the exact render on lift.
   */
  private renderPreview() {
    const t0 = performance.now();
    try { this.renderPreviewInner(); } finally { this.perf.previewMs += performance.now() - t0; this.perf.previewFrames++; }
  }

  private renderPreviewInner() {
    this.previewQueued = false;
    const live = this.live;
    if (!live) return;
    const { rec } = live;
    if (rec.tool === 'eraser') {
      if (rec.points.length > live.erasedUpTo) {
        this.sgl!.eraseDabs(this.eraserDabs(rec, live.erasedUpTo));
        live.erasedUpTo = rec.points.length;
      }
      return;
    }
    // Conditioning's early decisions are final once a few raw samples exist, and
    // the newest raw point may still move (pen samples merge into it), so chunks
    // stop one point short of it. A tap is stamped on lift.
    if (rec.points.length < CHUNK_MIN_RAW) return;
    if (live.chunk > 0 && performance.now() - live.lastChunkAt < MIN_CHUNK_INTERVAL_MS) { this.schedulePreview(); return; }
    this.stampNextChunk(live, rec.points.length - 1, false);
  }

  /**
   * Stamps the chunk covering raw points up to `upto` and records the boundary
   * on the stroke. Returns false when there is nothing (or too little) to stamp:
   * the engine places round(length / spacing) stamps per plot, so a chunk much
   * shorter than a few stamp steps would lose density to rounding.
   */
  private stampNextChunk(live: Live, upto: number, final: boolean): boolean {
    const rec = live.rec as BrushRecord;
    const g = chunkPoints(rec, upto, live.condLen, final);
    if (!g) return false;
    const len = pathLength(g.pts);
    if (!final && len < rec.spec.spacing * 3) return false;
    const sgl = this.sgl!;
    const t0 = performance.now();
    if (live.chunk === 0) {
      // First chunk: start from the committed image, whole canvas once per stroke.
      sgl.blit(sgl.committedTex);
      this.refreshMirror();
      this.stampChunk(rec, g.pts, live.chunk, live.stampedLen);
    } else {
      // Later chunks: restore only the region the chunk can touch from the mirror
      // (guards the canvas against stale content between frames) and stamp.
      const r = this.chunkRegion(rec, g.pts);
      const a = performance.now();
      sgl.blitRegion(this.mirrorTex!, r.x, r.y, r.w, r.h);
      const b = performance.now();
      this.stampChunk(rec, g.pts, live.chunk, live.stampedLen);
      this.perf.restoreMs += b - a; this.perf.stampMs += performance.now() - b;
    }
    live.lastChunkAt = performance.now();
    this.perf.chunkMs += performance.now() - t0; this.perf.chunks++;
    (rec.chunks ??= []).push(upto);
    live.condLen = g.condLen;
    live.stampedLen += len;
    live.chunk++;
    return true;
  }

  /**
   * Device-pixel rectangle a chunk's stamps and the engine's composite of them can
   * reach: the chunk's points padded by the full tip footprint, scatter and the
   * engine's own dirty-rect padding. Must cover the engine's readback region.
   */
  private chunkRegion(rec: BrushRecord, pts: Point[]) {
    const v = this.committedView, dpr = this.dpr;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      const sx = p.x * v.zoom + v.x, sy = p.y * v.zoom + v.y;
      if (sx < minX) minX = sx; if (sx > maxX) maxX = sx;
      if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
    }
    const maxP = Math.max(1, rec.spec.pressure.min_max[0], rec.spec.pressure.min_max[1]);
    const pad = (rec.spec.weight * rec.size * maxP * 1.5 + rec.spec.scatter * rec.size * 3 + 12) * v.zoom + 8;
    return { x: (minX - pad) * dpr, y: (minY - pad) * dpr, w: (maxX - minX + 2 * pad) * dpr, h: (maxY - minY + 2 * pad) * dpr };
  }

  /** One chunk of a hand-drawn stroke: seeded per chunk, per-stroke effects off, envelope folded into the plot. */
  private stampChunk(rec: BrushRecord, pts: Point[], index: number, s0: number): number {
    if (index === 0) this.primeEngine(this.glW, this.glH, this.dpr);
    const chunk: BrushRecord = { ...rec, points: pts, input: undefined, chunks: undefined, seed: rec.seed + 1 + index, spec: chunkSpec(rec.spec) };
    const stamps = this.stampRaw(chunk, this.glW, this.glH, this.dpr, this.committedView, { s0, env: liveEnvelope(rec.spec.pressure) });
    // The next chunk (or stroke) composites against the mirror: keep it current.
    const t = performance.now();
    this.refreshMirrorRegion(this.chunkRegion(rec, pts));
    this.perf.snapMs += performance.now() - t;
    return stamps;
  }

  /**
   * Replays a hand-drawn stroke. At the zoom it was drawn at, the same chunks
   * with the same seeds: pixel-identical to what was on screen at lift. At any
   * other zoom the picture is necessarily different (stamps are rescaled), so
   * the stroke is stamped as one chunk-style pass instead, which costs one
   * engine render rather than one per chunk and keeps zoomed rebuilds fast.
   */
  private renderChunked(rec: BrushRecord): number {
    let condLen = 0, s0 = 0, stamps = 0;
    const chunks = rec.chunks!;
    const drawnZoom = rec.zoom ?? 1;
    if (chunks.length > 1 && Math.abs(drawnZoom - this.committedView.zoom) > 1e-9) {
      const g = chunkPoints(rec, rec.points.length, 0, true);
      return g ? this.stampChunk(rec, g.pts, 0, 0) : 0;
    }
    chunks.forEach((upto, i) => {
      const g = chunkPoints(rec, upto, condLen, i === chunks.length - 1);
      if (!g) return;
      stamps += this.stampChunk(rec, g.pts, i, s0);
      condLen = g.condLen;
      s0 += pathLength(g.pts);
    });
    return stamps;
  }

  private queueHud(patch: Partial<Hud>) {
    Object.assign(this.pendingHud, patch);
    if (this.hudQueued) return;
    this.hudQueued = true;
    requestAnimationFrame(() => {
      this.hudQueued = false;
      this.emit({ hud: { ...this.state.hud, ...this.pendingHud } });
      this.pendingHud = {};
    });
  }

  private updateHud(e: PointerEvent) {
    this.queueHud({
      pointerType: e.pointerType || 'pointer',
      pressure: e.pressure > 0 ? e.pressure : 0,
      tiltX: e.tiltX || 0,
      tiltY: e.tiltY || 0,
    });
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  /** Draws a lemniscate through the exact same pipeline as a pointer stroke. */
  drawSampleStroke = () => {
    if (!this.sgl || this.state.practice) return;
    if (this.settings.tool !== 'brush') this.setTool('brush');
    const c = this.toWorld(this.cssW / 2, this.cssH / 2), z = this.view.zoom;
    const rx = Math.min(this.cssW * 0.32, 260) / z, ry = Math.min(this.cssH * 0.22, 120) / z;
    const points: Point[] = [];
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, a = t * Math.PI * 2;
      points.push({ x: round(c.x + Math.sin(a) * rx, 100), y: round(c.y + Math.sin(a * 2) * ry, 100), p: round(0.5 + 0.4 * Math.sin(a * 3) ** 2, 1000) });
    }
    this.commitPoints(points);
  };

  /** Commits a brush stroke from a list of CSS-pixel points (also used by tests). */
  commitPoints(points: Point[], overrides: Partial<BrushRecord> = {}): BrushRecord {
    const rec = { ...(this.newRecord('brush', points[0]) as BrushRecord), ...overrides, points };
    this.commitRecord(rec);
    this.queueHud({ stamps: strokeSegments(rec).stamps });
    if (this.state.practice?.status === 'active') this.practiceEvaluate(rec);
    return rec;
  }

  /** Exports a PNG: native share sheet on touch devices when available, download otherwise. */
  exportPNG = async () => {
    const sgl = this.sgl, canvas = this.canvas;
    if (!sgl || !canvas) return;
    this.flushPaint();
    sgl.blit(sgl.committedTex); // a stale preview could be up
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) { this.toast('Export failed'); return; }
    const name = `p5brush-studio-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    if (coarse && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'p5.brush drawing' }); return; }
      catch (err) { if ((err as Error).name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    this.toast(`Exported ${this.glW}×${this.glH} PNG`);
  };

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  setSpec(patch: Partial<BrushSpec>) { this.set({ spec: { ...this.settings.spec, ...patch } }); }
  setPressure(patch: Partial<BrushSpec['pressure']>) {
    this.setSpec({ pressure: { ...this.settings.spec.pressure, ...patch } });
  }
  setSize(size: number) { this.set({ size }); }
  setColor(color: string) { this.set({ color, tool: 'brush' }); }
  setEraserSize(eraserSize: number) { this.set({ eraserSize }); }
  setPressureMode(pressureMode: PressureMode) { this.set({ pressureMode }); }
  setForceSensitivity(forceSensitivity: number) { this.set({ forceSensitivity }); }
  setPencilOnly(pencilOnly: boolean) {
    this.set({ pencilOnly, pencilAuto: false });
    this.toast(pencilOnly ? 'Pencil only: fingers pan and zoom, the Pencil draws' : 'Fingers draw too (two fingers still pan and zoom)');
  }
  setTool(tool: Tool) { this.set({ tool }); }
  setPaper(paper: PaperName) {
    this.set({ paper });
    if (this.sgl) this.repaintPaper();
  }
  nudgeWeight(delta: number) {
    const weight = clamp(this.settings.spec.weight + delta, 1, 80);
    this.setSpec({ weight });
    this.toast(`Weight ${weight} px`, { duration: 900 });
  }

  /** Validates and applies a tip body; returns false (and records the error) if it does not compile. */
  setTipSource(tipSource: string): boolean {
    try {
      checkTip(tipSource);
      this.set({ tipSource });
      this.emit({ tipError: null, tipExtent: this.extentFor(tipSource) });
      return true;
    } catch (err) {
      this.emit({ tipError: (err as Error).message });
      return false;
    }
  }

  resetDefaults() {
    this.set({ spec: clone(DEFAULT_SPEC), tipSource: DEFAULT_TIP_SOURCE, size: 1 });
    this.emit({ tipError: null, tipExtent: this.extentFor(DEFAULT_TIP_SOURCE) });
    this.toast('myBrush defaults restored');
  }

  /** Applies a pasted brush.add(...) snippet. Throws with a readable message on failure. */
  applySpecCode(text: string): string {
    const parsed = parseSpecCode(text);
    this.set({ spec: parsed.spec, tipSource: parsed.tipSource });
    this.emit({ tipError: null, tipExtent: this.extentFor(parsed.tipSource) });
    return parsed.name;
  }

  specCode(name = this.activeTemplate()?.codeName ?? 'myBrush') { return specCode(this.settings.spec, this.settings.tipSource, name); }

  /** World-space bounds of the visible strokes, or null when empty. */
  drawingBounds(): { x: number; y: number; w: number; h: number } | null {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const rec of visibleRecords(this.strokes)) {
      if (rec.tool === 'clear') continue;
      const pad = rec.tool === 'eraser' ? rec.size / 2 : rec.spec.weight * rec.size;
      for (const p of rec.points) {
        if (p.x - pad < minX) minX = p.x - pad; if (p.x + pad > maxX) maxX = p.x + pad;
        if (p.y - pad < minY) minY = p.y - pad; if (p.y + pad > maxY) maxY = p.y + pad;
      }
    }
    return Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
  }

  /** Frames the whole drawing in the viewport. */
  zoomToFit() {
    const b = this.drawingBounds();
    if (!b) { this.resetView(); return; }
    const zoom = clamp(Math.min(this.cssW / (b.w + 80), this.cssH / (b.h + 80), 4), MIN_ZOOM, MAX_ZOOM);
    this.setViewLive({ zoom, x: this.cssW / 2 - (b.x + b.w / 2) * zoom, y: this.cssH / 2 - (b.y + b.h / 2) * zoom });
    this.commitView();
  }

  /** A complete p5.js sketch that replays the visible drawing with p5.brush. */
  sketchCode(): string {
    const conf = paperPresets[this.settings.paper];
    const b = this.drawingBounds() ?? { x: 0, y: 0, w: this.cssW, h: this.cssH };
    const margin = 40;
    const ox = Math.round(b.x - margin), oy = Math.round(b.y - margin);
    const lines = [
      '// p5.js + p5.brush 2.2.2 — exported from p5.brush Realtime Studio',
      '// <script src="https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js"></script>',
      '// <script src="https://cdn.jsdelivr.net/npm/p5.brush@2.2.2/dist/p5.brush.js"></script>',
      '',
      'function setup() {',
      `  createCanvas(${Math.round(b.w + margin * 2)}, ${Math.round(b.h + margin * 2)}, WEBGL);`,
      `  pixelDensity(${this.dpr});`,
      '  angleMode(DEGREES);',
      '  noLoop();',
      '}',
      '',
      'function draw() {',
      `  background("rgb(${conf.bg.join(', ')})");`,
      `  translate(-width / 2 - ${ox}, -height / 2 - ${oy});`,
    ];
    const names = new Map<string, string>();
    for (const rec of visibleRecords(this.strokes)) {
      if (rec.tool !== 'brush') { lines.push('  // (eraser stroke omitted)'); continue; }
      const key = JSON.stringify(rec.spec) + '|' + rec.tipSource;
      let name = names.get(key);
      if (!name) {
        name = 'studioBrush' + names.size;
        names.set(key, name);
        lines.push('  ' + specCode(rec.spec, rec.tipSource, name).replace(/\n/g, '\n  '));
      }
      if (rec.chunks) {
        // Hand-drawn: the same chunks, seeds and envelope as on the canvas.
        const liveKey = key + '|live';
        let liveName = names.get(liveKey);
        if (!liveName) {
          liveName = name + 'Live';
          names.set(liveKey, liveName);
          lines.push('  ' + specCode(chunkSpec(rec.spec), rec.tipSource, liveName).replace(/\n/g, '\n  '));
        }
        const env = liveEnvelope(rec.spec.pressure);
        let condLen = 0, s0 = 0;
        rec.chunks.forEach((upto, i) => {
          const g = chunkPoints(rec, upto, condLen, i === rec.chunks!.length - 1);
          if (!g) return;
          const { origin, segs, endA, endP } = strokeSegments({ ...rec, points: g.pts, input: undefined });
          lines.push(`  randomSeed(${rec.seed + 1 + i});`);
          lines.push(`  brush.set("${liveName}", "${rec.color}", ${fmt(rec.size)});`);
          lines.push(`  brush.beginStroke("curve", ${fmt(origin.x)}, ${fmt(origin.y)});`);
          let s = s0;
          for (const seg of segs) { lines.push(`  brush.move(${fmt(seg.a)}, ${fmt(seg.len)}, ${fmt(seg.p * env(s))});`); s += seg.len; }
          lines.push(`  brush.endStroke(${fmt(endA)}, ${fmt(endP * env(s))});`);
          condLen = g.condLen;
          s0 += pathLength(g.pts);
        });
        continue;
      }
      const { origin, segs, endA, endP } = strokeSegments(rec);
      lines.push(`  randomSeed(${rec.seed});`);
      lines.push(`  brush.set("${name}", "${rec.color}", ${fmt(rec.size)});`);
      lines.push(`  brush.beginStroke("curve", ${fmt(origin.x)}, ${fmt(origin.y)});`);
      for (const s of segs) lines.push(`  brush.move(${fmt(s.a)}, ${fmt(s.len)}, ${fmt(s.p)});`);
      lines.push(`  brush.endStroke(${fmt(endA)}, ${fmt(endP)});`);
    }
    lines.push('}');
    return lines.join('\n');
  }

  /** Exposed for the headless test harness. */
  debug() {
    const studio = this;
    return {
      get state() { return studio.state; },
      strokes: () => visibleRecords(this.strokes),
      history: () => this.strokes,
      commit: (points: Point[], overrides?: Partial<BrushRecord>) => this.commitPoints(points, overrides),
      undo: this.undo, redo: this.redo, clear: this.clear, sample: this.drawSampleStroke, cancel: this.cancelStroke,
      sketchCode: () => this.sketchCode(), specCode: () => this.specCode(),
      setPaper: (p: PaperName) => this.setPaper(p), setPressureMode: (m: PressureMode) => this.setPressureMode(m),
      setTipSource: (s: string) => this.setTipSource(s), applySpecCode: (t: string) => this.applySpecCode(t),
      applyTemplate: (id: string) => this.applyTemplate(id), templates: BRUSH_TEMPLATES.map((t) => t.id),
      rebuildAll: () => { this.repaintPaper(); this.flushPaint(); }, flushPaint: () => this.flushPaint(), isPainting: () => this.pending !== null, saveNow: () => this.saveNow(), saveKey: SAVE_KEY,
      setCulling: (on: boolean) => { this.cullingEnabled = on; },
      lastCulled: () => this.lastCulled,
      perf: () => ({ ...this.perf }),
      resetPerf: () => { for (const k of Object.keys(this.perf) as Array<keyof typeof this.perf>) this.perf[k] = 0; },
      conditioned: (rec: BrushRecord) => conditionPoints(rec),
      practice: {
        start: (id: string) => this.startPractice(id), exit: (keep?: boolean) => this.exitPractice(keep),
        skip: () => this.skipStep(), restart: () => this.restartPractice(), guide: (on: boolean) => this.setPracticeGuide(on),
        previews: () => this.ensureLessonPreviews(),
        lessons: LESSONS.map((l) => l.id),
        steps: (id: string) => lessonSteps(lessonById(id)!).map((st) => ({ template: st.template, color: st.color, size: st.size, points: st.points })),
        score: (user: Point[], ref: Point[], tol: number) => scoreTrace(user, ref, tol),
      },
      // low-level primitives for determinism experiments
      gl: {
        blitCommitted: () => this.sgl!.blit(this.sgl!.committedTex),
        blitPaper: () => this.sgl!.blit(this.sgl!.paperTex),
        snapshotCommitted: () => this.sgl!.snapshot(this.sgl!.committedTex),
        render: (rec: BrushRecord) => this.renderBrushStroke(rec),
        prime: () => this.primeEngine(this.glW, this.glH, this.dpr),
      },
      view: () => this.view, zoomBy: (f: number, cx?: number, cy?: number) => this.zoomBy(f, cx, cy), resetView: () => this.resetView(), zoomToFit: () => this.zoomToFit(),
      toWorld: (x: number, y: number) => this.toWorld(x, y),
    };
  }
}
