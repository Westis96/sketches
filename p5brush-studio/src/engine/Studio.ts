/**
 * Studio — drives the real p5.brush 2.2.2 engine from pointer input.
 *
 *  - One WebGL2 canvas. p5.brush owns the compositing (spectral pigment mixing);
 *    StudioGL adds the paper texture, snapshots and a paper eraser.
 *  - Live preview: while the pointer is down the committed image is restored
 *    from a texture and the in-progress plot is re-stamped every frame with the
 *    same seed (brush.seed), so the stroke you see is the stroke you get on lift.
 *  - Strokes are vector records, so undo, paper changes, resize and the sketch
 *    export all replay deterministically.
 *
 * The class is framework-free; React subscribes through `subscribe/getState`.
 */
import * as brush from 'p5.brush/standalone';
import type { BrushParams } from 'p5.brush/standalone';
import { StudioGL, type Dab } from './StudioGL';
import { compileTip, checkTip } from './tipShim';
import {
  DEFAULT_SPEC, DEFAULT_TIP_SOURCE, clamp, clone, fmt, parseSpecCode, specCode, strokeSegments,
  type BrushRecord, type BrushSpec, type EraserRecord, type PaperName, type Point, type PressureMode,
  type StrokeRecord, type Tool,
} from './records';

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
}

export interface Hud {
  pointerType: string | null;
  pressure: number;
  tiltX: number;
  tiltY: number;
  stamps: number;
}

export interface StudioState {
  settings: Settings;
  hud: Hud;
  canUndo: boolean;
  canRedo: boolean;
  strokeCount: number;
  tipError: string | null;
  fatal: string | null;
}

export type Toast = (message: string) => void;

const CHECKPOINT_EVERY = 6;
const MAX_CHECKPOINTS = 4;
const POOL = 8;

interface Live {
  id: number;
  rect: DOMRect;
  rec: StrokeRecord;
  erasedUpTo: number;
}

export class Studio {
  private state: StudioState = {
    settings: {
      spec: clone(DEFAULT_SPEC),
      tipSource: DEFAULT_TIP_SOURCE,
      size: 1,
      color: '#1a1c23',
      paper: 'hotpress',
      tool: 'brush',
      eraserSize: 24,
      pressureMode: 'gaussian',
      forceSensitivity: 1.25,
      pencilOnly: false,
    },
    hud: { pointerType: null, pressure: 0, tiltX: 0, tiltY: 0, stamps: 0 },
    canUndo: false,
    canRedo: false,
    strokeCount: 0,
    tipError: null,
    fatal: null,
  };
  private listeners = new Set<() => void>();

  private canvas: HTMLCanvasElement | null = null;
  private sgl: StudioGL | null = null;
  private cssW = 0; private cssH = 0; private dpr = 1; private glW = 1; private glH = 1;

  private strokes: StrokeRecord[] = [];
  private redoStack: StrokeRecord[] = [];
  private checkpoints: Array<{ count: number; tex: WebGLTexture }> = [];

  private live: Live | null = null;
  private previewQueued = false;
  private hudQueued = false;
  private resizeTimer = 0;
  private detach: (() => void) | null = null;

  // One p5.brush brush per distinct tip source (the only thing that needs the
  // 500×500 rasterisation). p5.brush reads the params object by reference at
  // stroke time — the contract its own scaleBrushes() relies on — so the
  // per-stroke numbers are patched in place.
  private registry = new Map<string, { name: string; params: BrushParams; tick: number }>();
  private regTick = 0;

  constructor(private toast: Toast = () => {}) {}

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
  }
  get settings() { return this.state.settings; }

  private syncHistory() {
    this.emit({ canUndo: this.strokes.length > 0, canRedo: this.redoStack.length > 0, strokeCount: this.strokes.length });
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

    const onDown = (e: PointerEvent) => this.onPointerDown(e);
    const onMove = (e: PointerEvent) => this.onPointerMove(e);
    const onUp = (e: PointerEvent) => this.onPointerUp(e);
    const prevent = (e: Event) => e.preventDefault();
    const onResize = () => this.onResize();
    const onLost = (e: Event) => { e.preventDefault(); this.emit({ fatal: 'WebGL context lost. Reload the page to continue.' }); };

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
    this.detach = () => {
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
    };

    this.resize(true);
    if (!this.sampleQueued) {
      this.sampleQueued = true;
      setTimeout(() => this.drawSampleStroke(), 120);
    }
  }
  private sampleQueued = false;

  dispose() {
    this.detach?.();
    this.detach = null;
    clearTimeout(this.resizeTimer);
  }

  // ---------------------------------------------------------------------------
  // Brush registration
  // ---------------------------------------------------------------------------
  private ensureRegistered(rec: BrushRecord): string {
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
    params.weight = sp.weight; params.scatter = sp.scatter; params.opacity = sp.opacity;
    params.spacing = sp.spacing; params.noise = clamp(sp.noise, 0, 1);
    params.rotate = sp.rotate; params.markerTip = sp.markerTip;
    params.pressure = { type: 'gaussian', mode: 'gaussian', curve: sp.pressure.curve, min_max: sp.pressure.min_max };
    return entry.name;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  /** Stamps a brush record on top of whatever is in the framebuffer. Returns stamp count. */
  private renderBrushStroke(rec: BrushRecord): number {
    const name = this.ensureRegistered(rec);
    const { origin, segs, endA, endP, stamps } = strokeSegments(rec);
    const plot = new brush.Plot('curve');
    for (const s of segs) plot.addSegment(s.a, s.len, s.p, true);
    plot.endPlot(endA, endP, true);
    brush.seed(rec.seed);
    brush.push();
    brush.translate(-this.glW / 2, -this.glH / 2); // p5.brush origin is the canvas centre
    brush.scale(this.dpr);                         // work in CSS pixels
    brush.set(name, rec.color, rec.size);
    plot.draw(origin.x, origin.y, 1);
    brush.pop();
    brush.render();
    return stamps;
  }

  /** Eraser dabs (device px) for the record's points from index `from` on. */
  private eraserDabs(rec: EraserRecord, from: number): Dab[] {
    const dabs: Dab[] = [];
    const dpr = this.dpr;
    const r = (rec.size / 2) * dpr;
    const step = Math.max(0.75, rec.size * 0.12);
    const pts = rec.points;
    if (from === 0) dabs.push({ x: pts[0].x * dpr, y: pts[0].y * dpr, r });
    for (let i = Math.max(1, from); i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        dabs.push({ x: (a.x + (b.x - a.x) * t) * dpr, y: (a.y + (b.y - a.y) * t) * dpr, r });
      }
    }
    return dabs;
  }

  private renderRecord(rec: StrokeRecord) {
    if (rec.tool === 'eraser') this.sgl!.eraseDabs(this.eraserDabs(rec, 0));
    else this.renderBrushStroke(rec);
  }

  /** Restores `baseTex`, draws `records` on top, and stores the result as committed. */
  private paint(baseTex: WebGLTexture, records: StrokeRecord[]) {
    const sgl = this.sgl!;
    sgl.blit(baseTex);
    for (const rec of records) this.renderRecord(rec);
    sgl.snapshot(sgl.committedTex);
  }

  /** Drops checkpoints taken after `count` strokes. */
  private truncateCheckpoints(count: number) {
    while (this.checkpoints.length && this.checkpoints[this.checkpoints.length - 1].count > count) {
      this.sgl!.deleteTexture(this.checkpoints.pop()!.tex);
    }
  }

  /** Rebuilds the committed image for the current stroke list from the newest usable checkpoint. */
  private rebuild() {
    const n = this.strokes.length;
    this.truncateCheckpoints(n);
    const cp = this.checkpoints[this.checkpoints.length - 1];
    if (cp) this.paint(cp.tex, this.strokes.slice(cp.count));
    else this.paint(this.sgl!.paperTex, this.strokes);
  }

  /** Appends a record whose pixels are already in the framebuffer. */
  private pushRecord(rec: StrokeRecord, clearRedo = true) {
    const sgl = this.sgl!;
    sgl.snapshot(sgl.committedTex);
    this.strokes.push(rec);
    if (clearRedo) this.redoStack = [];
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
    this.sgl!.blit(this.sgl!.committedTex);
    this.renderRecord(rec);
    this.pushRecord(rec, clearRedo);
  }

  undo = () => {
    if (!this.strokes.length) { this.toast('Nothing to undo'); return; }
    this.redoStack.push(this.strokes.pop()!);
    this.rebuild();
    this.syncHistory();
  };

  redo = () => {
    const rec = this.redoStack.pop();
    if (!rec) return;
    this.commitRecord(rec, false);
  };

  clear = () => {
    this.strokes = []; this.redoStack = [];
    this.rebuild();
    this.syncHistory();
    this.toast('White paper pristine');
  };

  // ---------------------------------------------------------------------------
  // Paper + sizing
  // ---------------------------------------------------------------------------
  private renderPaper() {
    const { glW, glH, dpr, cssW, cssH } = this;
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
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() + Math.random() - 1) * amp; // triangular noise
      d[i] = clamp(conf.bg[0] + n, 0, 255);
      d[i + 1] = clamp(conf.bg[1] + n, 0, 255);
      d[i + 2] = clamp(conf.bg[2] + n * 0.9, 0, 255);
      d[i + 3] = 255;
    }
    gctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = ctx.createPattern(g, 'repeat')!;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.restore();

    const vg = ctx.createRadialGradient(glW / 2, glH / 2, Math.min(glW, glH) * 0.35, glW / 2, glH / 2, Math.hypot(glW, glH) * 0.6);
    vg.addColorStop(0, 'rgba(120,100,70,0)');
    vg.addColorStop(1, 'rgba(120,100,70,0.06)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, glW, glH);
    ctx.lineWidth = dpr;
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(180,170,155,${0.12 - i * 0.025})`;
      ctx.strokeRect(i * dpr + 0.5, i * dpr + 0.5, glW - i * 2 * dpr - 1, glH - i * 2 * dpr - 1);
    }
    this.sgl!.uploadPaper(c);
  }

  /** Paper changed: checkpoints embed the old paper, so replay everything. */
  private repaintPaper() {
    this.renderPaper();
    this.truncateCheckpoints(-1);
    this.rebuild();
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
    this.resizeTimer = window.setTimeout(() => { if (!this.live) this.resize(); }, 150);
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  private pointFromEvent(e: PointerEvent, rect: DOMRect): Point {
    let p = e.pressure;
    if (!(p > 0)) p = e.pointerType === 'pen' ? 0.02 : 0.5;
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, p };
  }

  /** A record captures everything needed to replay the stroke deterministically. */
  private newRecord(tool: Tool, firstPt: Point): StrokeRecord {
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
    };
  }

  private onPointerDown(e: PointerEvent) {
    if (e.target !== this.canvas || this.live) return;
    if (this.settings.pencilOnly && e.pointerType !== 'pen') { this.toast('Pencil-only mode: touch ignored'); return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); // also suppresses the focus change, so commit any focused editor by hand
    (document.activeElement as HTMLElement | null)?.blur?.();
    try { this.canvas!.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const rect = this.canvas!.getBoundingClientRect();
    const rec = this.newRecord(this.settings.tool, this.pointFromEvent(e, rect));
    this.live = { id: e.pointerId, rect, rec, erasedUpTo: 0 };
    this.updateHud(e);
    this.schedulePreview();
  }

  private onPointerMove(e: PointerEvent) {
    const live = this.live;
    if (!live || e.pointerId !== live.id) return;
    e.preventDefault();
    this.updateHud(e);
    const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    const list = coalesced.length ? coalesced : [e];
    const pts = live.rec.points;
    for (const ev of list) {
      const pt = this.pointFromEvent(ev, live.rect);
      const last = pts[pts.length - 1];
      if (Math.abs(pt.x - last.x) < 0.15 && Math.abs(pt.y - last.y) < 0.15) { last.p = pt.p; continue; }
      pts.push(pt);
    }
    this.schedulePreview();
  }

  private onPointerUp(e: PointerEvent) {
    const live = this.live;
    if (!live || e.pointerId !== live.id) return;
    e.preventDefault();
    // Points that arrived after the last preview frame are not on screen yet;
    // once the preview is current the framebuffer *is* the committed result.
    if (this.previewQueued) this.renderPreview();
    this.live = null;
    this.emit({ hud: { ...this.state.hud, pressure: 0 } });
    this.pushRecord(live.rec);
  }

  private schedulePreview() {
    if (this.previewQueued) return;
    this.previewQueued = true;
    requestAnimationFrame(() => this.renderPreview());
  }

  /** Live view: brush strokes are re-stamped from the committed image (seeded, so
   *  stable); eraser dabs are applied incrementally since they are cumulative. */
  private renderPreview() {
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
    this.sgl!.blit(this.sgl!.committedTex);
    const stamps = this.renderBrushStroke(rec);
    if (stamps !== this.state.hud.stamps) this.queueHud({ stamps });
  }

  private pendingHud: Partial<Hud> = {};
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
    if (!this.sgl) return;
    if (this.settings.tool !== 'brush') this.setTool('brush');
    const cx = this.cssW / 2, cy = this.cssH / 2;
    const rx = Math.min(this.cssW * 0.32, 260), ry = Math.min(this.cssH * 0.22, 120);
    const points: Point[] = [];
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, a = t * Math.PI * 2;
      points.push({ x: cx + Math.sin(a) * rx, y: cy + Math.sin(a * 2) * ry, p: 0.5 + 0.4 * Math.sin(a * 3) ** 2 });
    }
    this.commitPoints(points);
    this.toast('p5.brush sample stroke (lemniscate)');
  };

  /** Commits a brush stroke from a list of CSS-pixel points (also used by tests). */
  commitPoints(points: Point[], overrides: Partial<BrushRecord> = {}): BrushRecord {
    const rec = { ...(this.newRecord('brush', points[0]) as BrushRecord), ...overrides, points };
    this.commitRecord(rec);
    this.queueHud({ stamps: strokeSegments(rec).stamps });
    return rec;
  }

  exportPNG = () => {
    const sgl = this.sgl, canvas = this.canvas;
    if (!sgl || !canvas) return;
    sgl.blit(sgl.committedTex); // a stale preview could be up
    canvas.toBlob((blob) => {
      if (!blob) { this.toast('Export failed'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `p5brush-studio-${Date.now()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      this.toast(`Exported ${this.glW}×${this.glH} PNG`);
    }, 'image/png');
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
  setPencilOnly(pencilOnly: boolean) { this.set({ pencilOnly }); }
  setTool(tool: Tool) { this.set({ tool }); }
  setPaper(paper: PaperName) {
    this.set({ paper });
    if (this.sgl) this.repaintPaper();
  }
  nudgeWeight(delta: number) { this.setSpec({ weight: clamp(this.settings.spec.weight + delta, 1, 80) }); }

  /** Validates and applies a tip body; returns false (and records the error) if it does not compile. */
  setTipSource(tipSource: string): boolean {
    try {
      checkTip(tipSource);
      this.set({ tipSource });
      this.emit({ tipError: null });
      return true;
    } catch (err) {
      this.emit({ tipError: (err as Error).message });
      return false;
    }
  }

  resetDefaults() {
    this.set({ spec: clone(DEFAULT_SPEC), tipSource: DEFAULT_TIP_SOURCE, size: 1 });
    this.emit({ tipError: null });
    this.toast('myBrush defaults restored');
  }

  /** Applies a pasted brush.add(...) snippet. Throws with a readable message on failure. */
  applySpecCode(text: string): string {
    const parsed = parseSpecCode(text);
    this.set({ spec: parsed.spec, tipSource: parsed.tipSource });
    this.emit({ tipError: null });
    return parsed.name;
  }

  specCode(name = 'myBrush') { return specCode(this.settings.spec, this.settings.tipSource, name); }

  /** A complete p5.js sketch that replays the drawing with p5.brush. */
  sketchCode(): string {
    const conf = paperPresets[this.settings.paper];
    const lines = [
      '// p5.js + p5.brush 2.2.2 — exported from p5.brush Realtime Studio',
      '// <script src="https://cdn.jsdelivr.net/npm/p5@1.11.3/lib/p5.min.js"></script>',
      '// <script src="https://cdn.jsdelivr.net/npm/p5.brush@2.2.2/dist/p5.brush.js"></script>',
      '',
      'function setup() {',
      `  createCanvas(${Math.round(this.cssW)}, ${Math.round(this.cssH)}, WEBGL);`,
      `  pixelDensity(${this.dpr});`,
      '  angleMode(DEGREES);',
      '  noLoop();',
      '}',
      '',
      'function draw() {',
      `  background("rgb(${conf.bg.join(', ')})");`,
      '  translate(-width / 2, -height / 2);',
    ];
    const names = new Map<string, string>();
    for (const rec of this.strokes) {
      if (rec.tool !== 'brush') { lines.push('  // (eraser stroke omitted)'); continue; }
      const key = JSON.stringify(rec.spec) + '|' + rec.tipSource;
      let name = names.get(key);
      if (!name) {
        name = 'studioBrush' + names.size;
        names.set(key, name);
        lines.push('  ' + specCode(rec.spec, rec.tipSource, name).replace(/\n/g, '\n  '));
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
      strokes: () => this.strokes,
      commit: (points: Point[], overrides?: Partial<BrushRecord>) => this.commitPoints(points, overrides),
      undo: this.undo, redo: this.redo, clear: this.clear, sample: this.drawSampleStroke,
      sketchCode: () => this.sketchCode(), specCode: () => this.specCode(),
      setPaper: (p: PaperName) => this.setPaper(p), setPressureMode: (m: PressureMode) => this.setPressureMode(m),
      setTipSource: (s: string) => this.setTipSource(s), applySpecCode: (t: string) => this.applySpecCode(t),
      rebuildAll: () => this.repaintPaper(),
    };
  }
}
