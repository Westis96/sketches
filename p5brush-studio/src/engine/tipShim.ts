/**
 * p5-style tip surface shim.
 *
 * p5.brush (standalone) hands the custom-tip function a minimal 2D surface whose
 * fill() ignores alpha and whose rotate() is always radians. The Brush Maker
 * authors tips against a p5.Graphics, so we wrap the surface with a p5-like API:
 * fill(gray, alpha), fill(r, g, b, a), rectMode, shapes, push/pop…
 *
 * Angle units default to RADIANS: a p5.Graphics keeps its own angleMode even
 * when the sketch calls angleMode(DEGREES), so that is what real p5.brush output
 * uses. A tip can opt into degrees with `_m.angleMode("degrees")`.
 */

export interface TipTarget {
  drawingContext: CanvasRenderingContext2D;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const n255 = (v: number) => clamp(Math.round(v), 0, 255);

type ColorArgs = Array<number | string | number[]>;

function toCss(args: ColorArgs): string {
  let a: Array<number | string> = args as Array<number | string>;
  if (args.length === 1 && Array.isArray(args[0])) a = args[0] as number[];
  if (a.length === 0) return 'rgb(0,0,0)';
  if (typeof a[0] === 'string') return a[0];
  const n = a as number[];
  if (n.length === 1) return `rgb(${n255(n[0])},${n255(n[0])},${n255(n[0])})`;
  if (n.length === 2) return `rgba(${n255(n[0])},${n255(n[0])},${n255(n[0])},${clamp(n[1] / 255, 0, 1)})`;
  if (n.length === 3) return `rgb(${n255(n[0])},${n255(n[1])},${n255(n[2])})`;
  return `rgba(${n255(n[0])},${n255(n[1])},${n255(n[2])},${clamp(n[3] / 255, 0, 1)})`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TipShim = Record<string, any>;

export function createTipShim(surface: TipTarget): TipShim {
  const ctx = surface.drawingContext;
  const st = {
    fill: 'rgb(255,255,255)' as string | null,
    stroke: null as string | null,
    lineWidth: 1,
    degrees: false,
    rectMode: 'corner',
    ellipseMode: 'center',
    shape: null as number | null,
  };
  const stack: Array<typeof st> = [];
  const ang = (a: number) => (st.degrees ? (a * Math.PI) / 180 : a);

  function paint() {
    if (st.fill) { ctx.fillStyle = st.fill; ctx.fill(); }
    if (st.stroke) { ctx.strokeStyle = st.stroke; ctx.lineWidth = st.lineWidth; ctx.stroke(); }
  }
  function rectCoords(x: number, y: number, w: number, h: number): [number, number, number, number] {
    switch (st.rectMode) {
      case 'center': return [x - w / 2, y - h / 2, w, h];
      case 'radius': return [x - w, y - h, w * 2, h * 2];
      case 'corners': return [x, y, w - x, h - y];
      default: return [x, y, w, h];
    }
  }
  function ellipseCoords(x: number, y: number, w: number, h: number): [number, number, number, number] {
    switch (st.ellipseMode) {
      case 'corner': return [x + w / 2, y + h / 2, w, h];
      case 'radius': return [x, y, w * 2, h * 2];
      case 'corners': return [(x + w) / 2, (y + h) / 2, w - x, h - y];
      default: return [x, y, w, h];
    }
  }

  const m: TipShim = {
    PI: Math.PI, TWO_PI: Math.PI * 2, TAU: Math.PI * 2, HALF_PI: Math.PI / 2, QUARTER_PI: Math.PI / 4,
    CLOSE: 'close', DEGREES: 'degrees', RADIANS: 'radians',
    CENTER: 'center', CORNER: 'corner', CORNERS: 'corners', RADIUS: 'radius',
    OPEN: 'open', CHORD: 'chord', PIE: 'pie',
    width: 100, height: 100, drawingContext: ctx,
    push() { ctx.save(); stack.push({ ...st }); },
    pop() { ctx.restore(); const s = stack.pop(); if (s) Object.assign(st, s); },
    translate(x: number, y = 0) { ctx.translate(x, y); },
    rotate(a: number) { ctx.rotate(ang(a)); },
    scale(x: number, y = x) { ctx.scale(x, y); },
    shearX() {}, shearY() {},
    angleMode(mode: string) { st.degrees = mode === 'degrees'; },
    rectMode(mode: string) { st.rectMode = mode; },
    ellipseMode(mode: string) { st.ellipseMode = mode; },
    fill(...a: ColorArgs) { st.fill = toCss(a); },
    noFill() { st.fill = null; },
    stroke(...a: ColorArgs) { st.stroke = toCss(a); },
    noStroke() { st.stroke = null; },
    strokeWeight(w: number) { st.lineWidth = w; },
    strokeCap(c: string) { ctx.lineCap = c === 'square' ? 'butt' : c === 'project' ? 'square' : 'round'; },
    strokeJoin(j: CanvasLineJoin) { ctx.lineJoin = j || 'miter'; },
    color(...a: ColorArgs) { return toCss(a); },
    background(...a: ColorArgs) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = toCss(a); ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    },
    clear() {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
    },
    rect(x: number, y: number, w: number, h = w, r?: number) {
      const [rx, ry, rw, rh] = rectCoords(x, y, w, h);
      ctx.beginPath();
      if (r && ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, r); else ctx.rect(rx, ry, rw, rh);
      paint();
    },
    square(x: number, y: number, s: number, r?: number) { m.rect(x, y, s, s, r); },
    ellipse(x: number, y: number, w: number, h = w) {
      const [cx, cy, ew, eh] = ellipseCoords(x, y, w, h);
      ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(ew) / 2, Math.abs(eh) / 2, 0, 0, Math.PI * 2); paint();
    },
    circle(x: number, y: number, d: number) { m.ellipse(x, y, d, d); },
    arc(x: number, y: number, w: number, h: number, start: number, stop: number, mode?: string) {
      const [cx, cy, ew, eh] = ellipseCoords(x, y, w, h);
      ctx.beginPath();
      if (mode === 'pie') ctx.moveTo(cx, cy);
      ctx.ellipse(cx, cy, Math.abs(ew) / 2, Math.abs(eh) / 2, 0, ang(start), ang(stop));
      if (mode === 'pie' || mode === 'chord') ctx.closePath();
      paint();
    },
    line(x1: number, y1: number, x2: number, y2: number) {
      if (!st.stroke) return;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = st.stroke; ctx.lineWidth = st.lineWidth; ctx.stroke();
    },
    point(x: number, y: number) {
      if (!st.stroke) return;
      ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, st.lineWidth / 2), 0, Math.PI * 2);
      ctx.fillStyle = st.stroke; ctx.fill();
    },
    triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); paint();
    },
    quad(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); paint();
    },
    bezier(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.bezierCurveTo(x2, y2, x3, y3, x4, y4); paint();
    },
    beginShape() { ctx.beginPath(); st.shape = 0; },
    vertex(x: number, y: number) { if (st.shape) ctx.lineTo(x, y); else ctx.moveTo(x, y); st.shape = (st.shape || 0) + 1; },
    curveVertex(x: number, y: number) { m.vertex(x, y); },
    bezierVertex(x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) { ctx.bezierCurveTo(x2, y2, x3, y3, x4, y4); st.shape = (st.shape || 0) + 1; },
    quadraticVertex(cx: number, cy: number, x: number, y: number) { ctx.quadraticCurveTo(cx, cy, x, y); st.shape = (st.shape || 0) + 1; },
    endShape(mode?: string) { if (mode === 'close') ctx.closePath(); paint(); st.shape = null; },
    noSmooth() {}, smooth() {}, pixelDensity() { return 1; },
    random(a = 1, b?: number) { return b === undefined ? Math.random() * a : a + Math.random() * (b - a); },
    map(v: number, a: number, b: number, c: number, d: number) { return c + ((v - a) / (b - a)) * (d - c); },
    lerp(a: number, b: number, t: number) { return a + (b - a) * t; },
    radians(d: number) { return (d * Math.PI) / 180; },
    degrees(r: number) { return (r * 180) / Math.PI; },
    sin: Math.sin, cos: Math.cos, abs: Math.abs, min: Math.min, max: Math.max, sqrt: Math.sqrt, floor: Math.floor,
  };
  return m;
}

/** Compiles a tip body (statements on `_m`, as written in the Brush Maker). */
export function compileTip(source: string): (surface: TipTarget) => void {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function('_m', source) as (m: TipShim) => void;
  return (surface) => fn(createTipShim(surface));
}

/** Throws if the tip source does not run on a scratch 2D surface. */
export function checkTip(source: string): void {
  compileTip(source)({ drawingContext: document.createElement('canvas').getContext('2d')! });
}

// Angle units are expressed *in* the tip source, as a leading angleMode() line,
// so a spec round-trips through copy/paste and the p5 sketch export unchanged.
export const ANGLE_LINE = '_m.angleMode("degrees");';
export const tipUsesDegrees = (src: string) => /^\s*_m\.angleMode\s*\(\s*(["'])degrees\1/i.test(src);
export function setTipDegrees(src: string, degrees: boolean): string {
  const lines = src.split('\n');
  if (lines.length && /^\s*_m\.angleMode\s*\(/.test(lines[0])) lines.shift();
  if (degrees) lines.unshift(ANGLE_LINE);
  return lines.join('\n');
}

/**
 * Largest extent of the tip's ink as a fraction of the 100-unit tip space
 * (e.g. 0.35 for a shape spanning 35 units), measured on a small raster.
 * Used to size the on-canvas brush cursor to the visible mark, not the
 * nominal footprint.
 */
export function tipExtent(source: string): number {
  const N = 64;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, N, N);
  ctx.save();
  ctx.translate(N / 2, N / 2);
  ctx.scale(N / 100, N / 100);
  try { compileTip(source)({ drawingContext: ctx }); } catch { ctx.restore(); return 0.5; }
  ctx.restore();
  const d = ctx.getImageData(0, 0, N, N).data;
  let minX = N, minY = N, maxX = -1, maxY = -1;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    if ((d[i] + d[i + 1] + d[i + 2]) / 3 < 235) { // dark → ink
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return 0.5;
  const ext = Math.max(maxX - minX + 1, maxY - minY + 1) / N;
  // Extent measured from the centre matters for a centred ring: use the farthest ink pixel.
  const far = Math.max(Math.abs(minX - N / 2), Math.abs(maxX + 1 - N / 2), Math.abs(minY - N / 2), Math.abs(maxY + 1 - N / 2)) / (N / 2);
  return Math.max(ext, Math.min(far, 1.5));
}
