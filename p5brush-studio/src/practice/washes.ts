/**
 * The Sixteen Washes: sixteen small p5.brush studies, ported shape by shape from
 * the page they were painted on. Fills, washes, hatching and massing are shape
 * steps (the learner traces the outline and the shape lands); strokes are the
 * page's brushes. The page's random() is a seeded generator here and its flow
 * fields and hand wiggle are baked into the points, so every piece is the same
 * on every device. Coordinates are the page's (a 600×600 sheet around the
 * origin) placed in the middle of the 800×600 lesson box; full-bleed shapes are
 * stretched to the box edges.
 */
import type { Point, ShapeStyle } from '@/engine/records';
import type { Lesson, LessonStep } from './lessons';
import { frame, poly, spline, flat, type Profile, type XY } from './geometry';

// ---------------------------------------------------------------------------
// Deterministic randomness and noise
// ---------------------------------------------------------------------------
type Rng = () => number;
function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r: Rng, a: number, b: number) => a + (b - a) * r();
const TAU = Math.PI * 2;

/** Smooth 2D value noise in [0, 1] (the page's Perlin field, without p5). */
function noise2(x: number, y: number): number {
  const h = (i: number, j: number) => { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); };
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---------------------------------------------------------------------------
// Page space → lesson space
// ---------------------------------------------------------------------------
const OX = 400, OY = 300;
const A = ([x, y]: XY): XY => [OX + x, OY + y];
/** Points at or beyond the page's edge belong to the paper's edge. */
const bleed = ([x, y]: XY): XY => [Math.abs(x) >= 300 ? Math.sign(x) * 400 : x, Math.abs(y) >= 300 ? Math.sign(y) * 300 : y];
const clampBox = ([x, y]: XY): XY => [Math.max(0, Math.min(800, x)), Math.max(0, Math.min(600, y))];
const toBox = (pts: XY[], full = false): XY[] => pts.map((p) => clampBox(A(full ? bleed(p) : p)));
const r2 = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------
const fillSt = (color: string, opacity: number, bleedAmount: number, dir: 'in' | 'out', strength = 0.4, border = 0.4, scatter = true, curvature?: number): ShapeStyle =>
  ({ kind: 'fill', color, opacity, bleed: { amount: bleedAmount, dir }, texture: { strength, border, scatter }, ...(curvature ? { curvature } : {}) });
const washSt = (color: string, opacity: number): ShapeStyle => ({ kind: 'wash', color, opacity });

/** A closed outline as a traced path (lesson units): round the polygon and back to the start. */
function closedPath(pts: XY[], per?: number): Point[] {
  const n = per ?? Math.max(2, Math.round(96 / pts.length));
  return poly([...pts, pts[0]], n, flat(0.6)).map((p) => ({ x: r2(p.x), y: r2(p.y), p: p.p }));
}
/** The preview colour of a shape's outline: the shape's own, unless it would vanish on the paper. */
function outlineColor(color: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const v = parseInt(m[1], 16), lum = (0.2126 * (v >> 16) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
  return lum > 0.86 ? '#b9a999' : color;
}
/** A shape step: traced as its outline, landing as the fill / wash / hatch / mass. `pts` in lesson units. */
const shapeStep = (style: ShapeStyle, pts: XY[], hint?: string, speed = 0.5): LessonStep =>
  ({ template: 'pen', color: outlineColor(style.color), size: 0.7, points: closedPath(pts), shape: style, hint, speed, outline: pts.map(([x, y]) => ({ x: r2(x), y: r2(y), p: 0.6 })) });
/** A brush stroke step from lesson-unit points. */
const strokeStep = (template: string, color: string, size: number, points: Point[], hint?: string, speed = 0.5): LessonStep =>
  ({ template, color, size, points, hint, speed });

// Page brushes → studio templates.
const PEN = 'pen', H2 = 'hardpencil', B2 = 'softpencil', CPENCIL = 'cpencil', CHARCOAL = 'charcoal', SPRAY = 'spray', PETAL = 'petal', CULM = 'culm', LEAF = 'blade';

// Pressure along the page's strokes (its brushes' envelopes), for the stylus mode the lessons draw in.
const even: Profile = flat(0.6);
const leafP: Profile = (t) => 0.08 + 0.72 * Math.sin(t * Math.PI);
const petalP: Profile = (t) => 0.35 + 0.6 * Math.sin(t * Math.PI);
const culmP: Profile = flat(0.62);

/** A straight page line as lesson points. */
const lineP = (x0: number, y0: number, x1: number, y1: number, prof: Profile = even, n = 14): Point[] => poly([A([x0, y0]), A([x1, y1])], n, prof);
/** A page spline (Catmull-Rom through the control points) as lesson points. */
const splineP = (ctrl: XY[], prof: Profile = even, steps = 12): Point[] => spline(ctrl.map(A), steps, prof);
/** A page circle as a polygon, with the loose roundness of brush.circle(x, y, r, wobble). */
function circleP(cx: number, cy: number, radius: number, wobble: number, r: Rng, n = 32): XY[] {
  const f1 = between(r, 0, TAU), f2 = between(r, 0, TAU), a0 = between(r, 0, TAU);
  const out: XY[] = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    const k = 1 + wobble * 0.2 * (0.6 * Math.sin(2 * a + f1) + 0.4 * Math.sin(3 * a + f2));
    out.push([cx + Math.cos(a) * radius * k, cy + Math.sin(a) * radius * k]);
  }
  return out;
}
/** The page's rect as a polygon (corner mode). */
const rectP = (x: number, y: number, w: number, h: number): XY[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
/** A hand's wobble along a path (the page's brush.wiggle): a smooth sideways drift. */
function wiggle(pts: Point[], amp: number, r: Rng): Point[] {
  const f1 = between(r, 0, TAU), f2 = between(r, 0, TAU), k1 = between(r, 0.5, 0.9), k2 = between(r, 1.6, 2.6);
  return pts.map((p, i, arr) => {
    const q = arr[Math.min(i + 1, arr.length - 1)], o = arr[Math.max(i - 1, 0)];
    const dx = q.x - o.x, dy = q.y - o.y, len = Math.hypot(dx, dy) || 1;
    const s = amp * 1.6 * (0.6 * Math.sin(i * k1 + f1) + 0.4 * Math.sin(i * k2 + f2));
    return { ...p, x: r2(p.x - (dy / len) * s), y: r2(p.y + (dx / len) * s) };
  });
}
/** The page's `waves` field: a slow sideways swell along the path. */
function waves(pts: Point[], amp = 6): Point[] {
  return pts.map((p, i, arr) => {
    const q = arr[Math.min(i + 1, arr.length - 1)], o = arr[Math.max(i - 1, 0)];
    const dx = q.x - o.x, dy = q.y - o.y, len = Math.hypot(dx, dy) || 1;
    const s = amp * Math.sin(p.y * 0.045 + p.x * 0.02);
    return { ...p, x: r2(p.x - (dy / len) * s), y: r2(p.y + (dx / len) * s) };
  });
}
/** A streak released into the page's `murmur` field (noise-driven headings), page units in, lesson points out. */
function flowLine(x0: number, y0: number, length: number, clip: number): Point[] {
  const out: Point[] = [];
  let x = x0, y = y0;
  const step = 4;
  for (let s = 0; s <= length; s += step) {
    if (Math.abs(x) > clip || Math.abs(y) > clip) break;
    out.push({ x: r2(OX + x), y: r2(OY + y), p: 0.6 });
    const a = (noise2((x + 300) * 0.011, (y + 300) * 0.011) * 540 - 90) * (Math.PI / 180);
    x += Math.cos(a) * step; y += Math.sin(a) * step;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 01 Red Fuji
// ---------------------------------------------------------------------------
function buildFuji(): LessonStep[] {
  const r = rng(101), out: LessonStep[] = [];
  out.push(shapeStep(fillSt('#9fc3d6', 100, 0.35, 'out', 0.45, 0.3, false), toBox(rectP(-330, -330, 660, 310), true), 'Sky first. Trace the box round the top of the paper and lift: the wash fills it and bleeds outward on its own.'));
  out.push(shapeStep(fillSt('#f1cbb1', 90, 0.4, 'out', 0.4, 0.3, false), toBox(rectP(-330, -120, 660, 230), true), 'The dawn band: a second box, lower and warmer, over the first.'));
  const peak: XY = [30, -150];
  out.push(shapeStep(fillSt('#b5452e', 200, 0.25, 'out', 0.6, 0.5), toBox([[-340, 240], [-200, 120], [-90, 10], [-30, -100], peak, [70, -110], [120, -40], [220, 90], [340, 240]], true), 'The mountain: its whole silhouette in one go, foot to peak to foot, corners where the slope changes. The red bleeds out over the sky.'));
  out.push(shapeStep(fillSt('#7a2a1a', 90, 0.35, 'in', 0.5, 0.4), toBox([[-340, 240], [-200, 120], [-60, 150], [90, 110], [220, 90], [340, 240]], true), 'The shadow: a darker wash over the lower half, bleeding inward this time.'));
  const cap: XY[] = [[-46, -70], [-30, -100], peak, [70, -110], [98, -70]];
  let down = true;
  for (let x = 98; x >= -46; x -= 11) { cap.push([x, (down ? -30 : -66) + between(r, -5, 5)]); down = !down; }
  out.push(shapeStep(washSt('#fcf8f2', 255), toBox(cap), 'The snow: paper-coloured wash laid back over the red. Up one side of the peak, down the other, then a zigzag of fingers reaching down the slope. Corners sharp.', 0.45));
  out.push(shapeStep(fillSt('#3d5a4a', 120, 0.2, 'in', 0.5, 0.4, false), toBox(rectP(-330, 205, 660, 140), true), 'The forest at the foot: one low box, dark green.'));
  for (let i = 0; i < 5; i++) {
    const cx = -280 + i * 140 + between(r, -20, 20), cy = 165 + between(r, -18, 18), rx = between(r, 75, 115), ry = between(r, 22, 34), pts: XY[] = [];
    for (let k = 0; k < 16; k++) { const a = (k * TAU) / 16; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry * (Math.sin(a) > 0 ? 0.55 : 1)]); }
    out.push(shapeStep(fillSt('#e6ecf0', 200, 0.45, 'out', 0.5, 0.4), toBox(pts, true), i === 0 ? 'A sea of cloud across the foot: five flat-bottomed ovals, each loosely round in one motion.' : undefined));
  }
  for (let i = 0; i < 5; i++) {
    const bx = -200 + i * 52 + between(r, -10, 10), by = -230 + between(r, 0, 80), w = between(r, 6, 11);
    out.push(strokeStep(PEN, '#3a2a24', 0.8, poly([A([bx - w, by]), A([bx, by + w * 0.5]), A([bx + w, by])], 6, even), i === 0 ? 'Birds: a pen tick down and up, one motion each, five of them in the sky.' : undefined, 0.6));
  }
  return out;
}

// ---------------------------------------------------------------------------
// 02 Lantern Night
// ---------------------------------------------------------------------------
function buildLanterns(): LessonStep[] {
  const r = rng(102), out: LessonStep[] = [];
  const lanterns: Array<[number, number, number]> = [[-230, -120, 34], [-90, 20, 44], [150, -30, 50]];
  out.push(shapeStep(fillSt('#2b2140', 225, 0.1, 'in', 0.3, 0.2, false), toBox(rectP(-330, -330, 660, 660), true), 'Night first: trace the edge of the whole paper. A plum wash fills it, hardly bleeding.'));
  out.push(shapeStep(fillSt('#8a4a5a', 95, 0.45, 'out', 0.45, 0.3, false), toBox(rectP(-340, 70, 680, 150), true), 'The horizon: a rose band low down, bleeding well outward into the night.'));
  out.push(shapeStep(washSt('#170f24', 230), toBox([[-340, 340], [-340, 210], [-180, 170], [-40, 200], [120, 150], [260, 190], [340, 160], [340, 340]], true), 'The hill: a flat dark wash, corners at each summit.'));
  for (let i = 0; i < 3; i++) {
    const x = between(r, -280, 280), y = between(r, -280, -40), s = 4.5;
    out.push(shapeStep(washSt('#f2e6c8', 190), toBox([[x - s, y], [x, y - s], [x + s, y], [x, y + s]]), i === 0 ? 'Three stars: tiny diamonds of pale wash.' : undefined, 0.4));
  }
  lanterns.forEach(([x, y, rad], i) => out.push(strokeStep(PEN, '#c9b899', 0.7, wiggle(lineP(x + between(r, -6, 6), -300, x, y - rad * 1.3, even, 30), 1.5, r), i === 0 ? 'Strings: a pen line down from the top of the paper to each lantern, wobbling like a hand.' : undefined, 0.6)));
  lanterns.forEach(([x, y, rad], i) => out.push(shapeStep(fillSt('#f2a544', 90, 0.55, 'out', 0.5, 0.3), toBox(circleP(x, y, rad * 1.9, 0.3, r)), i === 0 ? 'Glows: a loose round twice the lantern, bleeding far out.' : undefined)));
  const ell = (x: number, y: number, rad: number, sx: number, sy: number): XY[] => { const pts: XY[] = []; for (let k = 0; k < 24; k++) { const a = (k * TAU) / 24; pts.push([x + Math.cos(a) * rad * sx, y + Math.sin(a) * rad * 1.3 * sy]); } return pts; };
  lanterns.forEach(([x, y, rad], i) => out.push(shapeStep(fillSt('#f5b942', 215, 0.18, 'in', 0.45, 0.7), toBox(ell(x, y, rad, 1, 1)), i === 0 ? 'Bodies: a tall oval, bleeding inward so the edges darken.' : undefined)));
  lanterns.forEach(([x, y, rad], i) => out.push(shapeStep(washSt('#fde49a', 110), toBox(ell(x, y, rad, 0.42, 0.9)), i === 0 ? 'A paler oval inside each, flat wash: the light through the paper.' : undefined)));
  for (const [x, y, rad] of lanterns.slice(1)) {
    for (const t of [-0.5, 0, 0.5]) { const yy = y + t * rad * 1.3, w = rad * Math.sqrt(1 - t * t); out.push(strokeStep(H2, '#a8562a', 0.6, splineP([[x - w, yy], [x, yy + t * 6], [x + w, yy]]), t === -0.5 && x === lanterns[1][0] ? 'Bamboo hoops: hard pencil across the body, bowing away from the middle.' : undefined, 0.55)); }
  }
  lanterns.forEach(([x, y, rad], i) => out.push(strokeStep(B2, '#7a3a1a', 0.6, closedPath(toBox(ell(x, y, rad, 1, 1)), 4), i === 0 ? 'Outline each body once in soft pencil.' : undefined, 0.5)));
  lanterns.forEach(([x, y, rad], i) => { const top = y - rad * 1.3; out.push(shapeStep(washSt('#3a2a24', 230), toBox(rectP(x - rad * 0.42, top - 9, rad * 0.84, 10)), i === 0 ? 'Caps: a small dark box on top of each lantern.' : undefined, 0.4)); });
  lanterns.forEach(([x, y, rad], i) => { const foot = y + rad * 1.3; out.push(shapeStep(washSt('#3a2a24', 230), toBox(rectP(x - rad * 0.36, foot - 1, rad * 0.72, 9)), i === 0 ? 'And a foot under each.' : undefined, 0.4)); });
  lanterns.forEach(([x, y, rad], i) => {
    const foot = y + rad * 1.3;
    out.push(strokeStep(B2, '#b8321f', 1.0, lineP(x, foot + 8, x + between(r, -2, 2), foot + 26, even, 8), i === 0 ? 'Tassels: a red cord down from the foot, then a fringe.' : undefined, 0.6));
    out.push(strokeStep(B2, '#b8321f', 1.0, poly([A([x - 5 + between(r, -2, 2), foot + 44 + between(r, -4, 4)]), A([x, foot + 26]), A([x + 5 + between(r, -2, 2), foot + 44 + between(r, -4, 4)])], 8, even), undefined, 0.6));
  });
  return out;
}

// ---------------------------------------------------------------------------
// 03 Bamboo
// ---------------------------------------------------------------------------
function buildGrove(): LessonStep[] {
  const r = rng(103), out: LessonStep[] = [];
  const culm = (x0: number, y0: number, x1: number, y1: number, w: number, col: string, nodeCol: string, nodes: boolean, hint?: string) => {
    const n = 5, dx = (x1 - x0) / n, dy = (y1 - y0) / n, g = 0.06, joints: XY[] = [];
    for (let i = 0; i < n; i++) {
      const ax = x0 + dx * i, ay = y0 + dy * i, bx = ax + dx, by = ay + dy;
      out.push(strokeStep(CULM, col, w, lineP(ax + dx * g, ay + dy * g, bx - dx * g, by - dy * g, culmP, 16), i === 0 ? hint : undefined, 0.42));
      joints.push([bx, by]);
    }
    if (nodes) joints.slice(0, -1).forEach(([nx, ny], i) => out.push(strokeStep(B2, nodeCol, 1.3, lineP(nx - 10 * w, ny - 2, nx + 10 * w, ny + 2, even, 8), i === 0 ? 'Nodes: a short soft-pencil line across each joint.' : undefined, 0.55)));
    return joints;
  };
  const cluster = (fx: number, fy: number, tx: number, ty: number, n: number, col: string, w: number, base: number, hint?: string) => {
    out.push(strokeStep(B2, col, w * 0.9, lineP(fx, fy, tx, ty, even, 8), hint, 0.55));
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.34 + between(r, -0.08, 0.08), L = between(r, 85, 140);
      const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L, mx = (tx + ex) / 2 - Math.sin(a) * between(r, 4, 12), my = (ty + ey) / 2 + Math.cos(a) * between(r, 4, 12);
      out.push(strokeStep(LEAF, col, w, wiggle(splineP([[tx, ty], [mx, my], [ex, ey]], leafP, 8), 0.8, r), i === 0 && hint ? 'Leaves: the blade lands thin at the twig, swells, and lifts to a point.' : undefined, 0.55));
    }
  };
  const far = culm(20, 300, 70, -300, 0.45, '#c4cbc2', '#b3bab0', false, 'Far culm first, palest: the flat tip held across the stroke, one pull per segment, bottom to top, a gap at every node.');
  cluster(far[2][0], far[2][1], far[2][0] + 30, far[2][1] - 20, 3, '#c4cbc2', 0.6, 0.5, 'A twig off the joint, then the leaves.');
  const mid = culm(170, 300, 250, -300, 0.6, '#8a958a', '#6f7a6e', true, 'The middle culm, greyer and a little wider.');
  cluster(mid[1][0], mid[1][1], mid[1][0] - 26, mid[1][1] - 18, 5, '#8a958a', 0.75, Math.PI - 0.5, 'Its cluster leans the other way.');
  const near = culm(-140, 300, -80, -300, 1, '#3a4638', '#1e2620', true, 'The near culm: darkest and widest. Same even pressure the whole way.');
  cluster(near[1][0], near[1][1], near[1][0] + 34, near[1][1] - 22, 4, '#1f2a22', 1, 0.45, 'Near clusters: twig, then four or five blades fanning from its tip.');
  out.push(strokeStep(B2, '#2f3a2e', 1, splineP([[near[2][0], near[2][1]], [near[2][0] + 70, near[2][1] - 40], [near[2][0] + 150, near[2][1] - 60]]), 'A branch reaching out from the third joint.', 0.5));
  cluster(near[2][0] + 150, near[2][1] - 60, near[2][0] + 170, near[2][1] - 70, 5, '#1f2a22', 0.95, 0.35);
  return out;
}

// ---------------------------------------------------------------------------
// 04 Six Persimmons
// ---------------------------------------------------------------------------
function buildPersimmons(): LessonStep[] {
  const r = rng(104), out: LessonStep[] = [];
  const fruits: Array<[number, number, number]> = [[-225, 30, 48], [-135, 40, 56], [-40, 22, 52], [55, 45, 60], [150, 30, 46], [235, 50, 42]];
  const shape = (x: number, y: number, rad: number): XY[] => { const pts: XY[] = []; for (let k = 0; k < 28; k++) { const a = (k * TAU) / 28; pts.push([x + Math.cos(a) * rad * (1 + between(r, -0.02, 0.02)), y + Math.sin(a) * rad * 0.9]); } return pts; };
  const styles: Array<[ShapeStyle | null, string]> = [
    [{ kind: 'mass', color: '#2a2420', opacity: 255, mass: { brush: 'charcoal', precision: 0.5, strength: 1, gradient: 0.2, outline: true } }, 'Six fruits, six inks. The first is massed charcoal: trace the round and it scribbles itself full.'],
    [fillSt('#2a2420', 200, 0.15, 'in', 0.6, 0.6), 'The second is a dark fill bleeding inward.'],
    [{ kind: 'mass', color: '#4a4340', opacity: 255, mass: { brush: 'crayon', precision: 0.7, strength: 0.7, gradient: 0.4 } }, 'The third: massed crayon, greyer and looser.'],
    [washSt('#6b625c', 110), 'The fourth: a flat grey wash.'],
    [null, 'The fifth is only an outline: soft pencil, once round.'],
    [fillSt('#c9582a', 150, 0.3, 'out', 0.6, 0.5), 'The sixth, persimmon orange, bleeding outward.'],
  ];
  fruits.forEach(([x, y, rad], i) => {
    const pts = toBox(shape(x, y, rad));
    const [st, hint] = styles[i];
    out.push(st ? shapeStep(st, pts, hint, 0.45) : strokeStep(B2, '#2a2420', 1.1, closedPath(pts, 4), hint, 0.5));
  });
  fruits.forEach(([x, y, rad], i) => {
    const top = y - rad * 0.9;
    out.push(strokeStep(B2, '#2a2420', 1.6, lineP(x, top + 3, x + between(r, -3, 3), top - 13, even, 6), i === 0 ? 'Stems: a short heavy pencil tick up from each fruit.' : undefined, 0.55));
    const c: XY = [x, top + 4];
    const tips: XY[] = [-1.1, -0.5, 0.5, 1.1].map((a) => [x + Math.sin(a) * 15, top + 10 - Math.cos(a) * 9]);
    out.push(strokeStep(B2, '#2a2420', 1.6, poly([tips[0], c, tips[1], c, tips[2], c, tips[3]].map(A), 5, even), i === 0 ? 'The calyx: four leaves out from the stem, drawn as one zigzag through the centre.' : undefined, 0.55));
  });
  out.push(shapeStep(washSt('#b8321f', 210), toBox(rectP(228, 200, 26, 26)), 'The seal: a small red square in the corner.', 0.4));
  out.push(strokeStep(PEN, '#fcf8f2', 0.8, lineP(234, 206, 248, 220, even, 6), 'Two paper-coloured pen strokes cross it.', 0.6));
  out.push(strokeStep(PEN, '#fcf8f2', 0.8, lineP(248, 206, 234, 220, even, 6), undefined, 0.6));
  return out;
}

// ---------------------------------------------------------------------------
// 05 Mandala
// ---------------------------------------------------------------------------
function buildMandala(): LessonStep[] {
  const r = rng(105), out: LessonStep[] = [];
  for (let k = 0; k < 12; k++) {
    const R = frame(OX, OY, (k * TAU) / 12);
    const P = (pts: XY[], prof: Profile, steps = 10) => spline(pts.map(([x, y]) => R(x, y)), steps, prof);
    out.push(strokeStep(PETAL, '#9c4732', 1, P([[34, 0], [86, 0], [138, 0]], petalP), k === 0 ? 'Twelve folds. Each starts with one petal stroke straight out from the centre: the oval tip turns with the stroke.' : undefined, 0.5));
    out.push(strokeStep(PETAL, '#d75f4c', 0.7, P([[40, -12], [92, -30], [132, -10]], petalP), k === 0 ? 'A lighter, curved petal beside it.' : undefined, 0.5));
    out.push(strokeStep(PETAL, '#e0b13f', 0.5, P([[50, 8], [75, 14], [100, 20]], petalP, 8), k === 0 ? 'And a short gold dash below. Then the next fold, one twelfth round.' : undefined, 0.55));
  }
  out.push(shapeStep(fillSt('#e0b13f', 190, 0.25, 'out', 0.55, 0.5), toBox(circleP(0, 0, 26, 0.3, r)), 'The centre: a gold round that bleeds out under the petals.'));
  out.push(strokeStep(H2, '#5e3225', 0.6, closedPath(toBox(circleP(0, 0, 152, 0.15, r, 48)), 3), 'The ring: hard pencil, once round the whole rosette at an even speed.', 0.55));
  return out;
}

// ---------------------------------------------------------------------------
// 06 Koi Pond
// ---------------------------------------------------------------------------
function buildPond(): LessonStep[] {
  const r = rng(106), out: LessonStep[] = [];
  out.push(shapeStep(fillSt('#b9cfdc', 100, 0.35, 'out', 0.5, 0.4), toBox(circleP(0, 0, 160, 0.3, r, 40)), 'The pond: one big loose round of pale blue, bleeding outward.'));
  const fish = (x: number, y: number, ang: number, col: string, hint?: string) => {
    const R = frame(x, y, ang);
    const L = 40, W = 15, pts: XY[] = [];
    for (let a = -0.85 * Math.PI; a <= 0.85 * Math.PI; a += Math.PI / 10) pts.push(R(Math.cos(a) * L, Math.sin(a) * W));
    pts.push(R(-L - 16, 14), R(-L - 6, 0), R(-L - 16, -14));
    out.push(shapeStep(fillSt(col, 150, 0.4, 'out', 0.55, 0.5), toBox(pts), hint));
  };
  fish(-45, -30, 0.5, '#e8792f', 'A koi: round the body from the nose, into the notch of the tail and back. It bleeds out into the water.');
  fish(40, 20, -2.4, '#d94f3a');
  fish(20, -75, 2.9, '#e8792f');
  const spots: Array<[number, number, number]> = [[-45, -30, 0.5], [40, 20, -2.4], [20, -75, 2.9]];
  spots.forEach(([x, y, ang], i) => { const R = frame(x, y, ang); const [sx, sy] = R(between(r, -10, 15), between(r, -5, 5)); out.push(shapeStep(fillSt('#9c2f1f', 130, 0.2, 'in', 0.5, 0.5), toBox(circleP(sx, sy, 7, 0.5, r, 16)), i === 0 ? 'A darker spot on each back, small and bleeding in.' : undefined, 0.4)); });
  for (let i = 0; i < 5; i++) {
    const cx = between(r, -60, 60), cy = between(r, -60, 60), rad = between(r, 30, 90);
    out.push(strokeStep(H2, '#6e8fa0', 0.7, waves(closedPath(toBox(circleP(cx, cy, rad, 0.4, r, 28)), 3)), i === 0 ? 'Ripples: hard-pencil rings that wobble with the water, once round each.' : undefined, 0.55));
  }
  return out;
}

// ---------------------------------------------------------------------------
// 07 Harvest Moon
// ---------------------------------------------------------------------------
function buildHarvest(): LessonStep[] {
  const r = rng(107), out: LessonStep[] = [];
  out.push(shapeStep(fillSt('#22304f', 210, 0.08, 'in', 0.35, 0.2, false), toBox(rectP(-165, -165, 330, 330)), 'The night: a square of indigo, almost flat, hardly bleeding. Trace the four sides and lift.'));
  out.push(shapeStep(fillSt('#f2d88e', 230, 0.28, 'out', 0.55, 0.6), toBox(circleP(25, -35, 68, 0.25, r)), 'The moon: a loose round, yellow bleeding out into the blue.'));
  for (let i = 0; i < 4; i++) {
    const y = between(r, 20, 140);
    out.push(strokeStep(PEN, '#3d4f78', 0.8, splineP([[-160 + between(r, 0, 30), y], [-40, y + between(r, -10, 10)], [60, y + between(r, -14, 14)], [160 - between(r, 0, 30), y]]), i === 0 ? 'Clouds: four long pen lines drifting across the lower half, each one slow pull.' : undefined, 0.5));
  }
  return out;
}

// ---------------------------------------------------------------------------
// 08 Seabed Star
// ---------------------------------------------------------------------------
function buildSeastar(): LessonStep[] {
  const r = rng(108), out: LessonStep[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i * TAU) / 5 - 0.3;
    out.push(shapeStep(fillSt('#ef9a80', 150, 0.42, 'out', 0.62, 0.4), toBox([[Math.cos(a) * 22, Math.sin(a) * 22], [Math.cos(a - 0.36) * 158, Math.sin(a - 0.36) * 158], [Math.cos(a + 0.36) * 158, Math.sin(a + 0.36) * 158]]), i === 0 ? 'Five petals from the centre out: each a long triangle, traced in one go. The wash bleeds far past the edges.' : undefined));
  }
  for (let i = 0; i < 5; i++) {
    const a = (i * TAU) / 5 - 0.3;
    out.push(shapeStep(fillSt('#d75f4c', 120, 0.3, 'in', 0.5, 0.5), toBox([[Math.cos(a) * 14, Math.sin(a) * 14], [Math.cos(a - 0.2) * 84, Math.sin(a - 0.2) * 84], [Math.cos(a + 0.2) * 84, Math.sin(a + 0.2) * 84]]), i === 0 ? 'A deeper, narrower triangle inside each, bleeding inward.' : undefined));
  }
  for (let i = 0; i < 5; i++) {
    const a = (i * TAU) / 5 - 0.3;
    out.push(strokeStep(CPENCIL, '#9c4732', 1.0, splineP([[Math.cos(a) * 20, Math.sin(a) * 20], [Math.cos(a) * 92, Math.sin(a) * 92], [Math.cos(a) * 150, Math.sin(a) * 150]]), i === 0 ? 'A coloured-pencil vein down the middle of each petal.' : undefined, 0.55));
  }
  for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; out.push(strokeStep(B2, '#5e3225', 0.8, lineP(0, 0, Math.cos(a) * 36, Math.sin(a) * 36 - 6, even, 8), i === 0 ? 'Short soft-pencil lines out from the centre.' : undefined, 0.6)); }
  out.push(shapeStep(fillSt('#e0b13f', 180, 0.16, 'out', 0.4, 0.4), toBox(circleP(0, -4, 17, 1, r, 20)), 'The centre: a small gold round.', 0.4));
  return out;
}

// ---------------------------------------------------------------------------
// 09 Poppies
// ---------------------------------------------------------------------------
function buildPoppies(): LessonStep[] {
  const r = rng(109), out: LessonStep[] = [];
  const heads: XY[] = [];
  for (let i = 0; i < 5; i++) {
    const x = -130 + i * 65 + between(r, -15, 15), y = between(r, -125, -20);
    out.push(strokeStep(PEN, '#4f6b3a', 1.0, wiggle(splineP([[x + between(r, -20, 20), 170], [x + between(r, -10, 10), 60], [x, y]], even, 14), 2, r), i === 0 ? 'Stems first: a pen line up from the ground to where each head will be, wobbling like a hand.' : undefined, 0.5));
    heads.push([x, y]);
  }
  const rads = heads.map(() => between(r, 22, 32));
  heads.forEach(([x, y], i) => out.push(shapeStep(fillSt('#d8402c', 150, 0.42, 'out', 0.6, 0.5), toBox(circleP(x, y, rads[i], 0.6, r, 24)), i === 0 ? 'Heads: a loose red round on each stem, bleeding well out.' : undefined)));
  heads.forEach(([x, y], i) => out.push(shapeStep(fillSt('#a8261a', 110, 0.25, 'in', 0.5, 0.6), toBox(circleP(x + between(r, -4, 4), y + between(r, -4, 4), rads[i] * 0.55, 0.7, r, 20)), i === 0 ? 'Depth: a smaller darker round inside each, bleeding in.' : undefined)));
  heads.forEach(([x, y], i) => out.push(shapeStep(washSt('#2a1f1a', 220), toBox(circleP(x, y, 6, 0.4, r, 14)), i === 0 ? 'The centre: a tiny flat black wash.' : undefined, 0.4)));
  return out;
}

// ---------------------------------------------------------------------------
// 10 Ridge
// ---------------------------------------------------------------------------
function buildRidge(): LessonStep[] {
  const r = rng(110), out: LessonStep[] = [];
  const ridge = (base: number, amp: number, col: string, op: number, bl: number, hint: string) => {
    const pts: XY[] = [[-175, 175]];
    for (let x = -175; x <= 175; x += 25) pts.push([x, base - between(r, 0, amp)]);
    pts.push([175, 175]);
    out.push(shapeStep(fillSt(col, op, bl, 'out', 0.55, 0.45), toBox(pts), hint, 0.45));
  };
  ridge(-40, 90, '#b7c6d6', 110, 0.3, 'Three ridgelines, back to front. The far one first, palest: along the jagged crest from left to right, down the side, back along the bottom.');
  ridge(20, 80, '#6f8aa6', 130, 0.25, 'The middle ridge, darker, bleeding out over the first.');
  ridge(80, 60, '#2f4a63', 150, 0.2, 'The near ridge, darkest, lowest.');
  return out;
}

// ---------------------------------------------------------------------------
// 11 Marigold Vase
// ---------------------------------------------------------------------------
function buildVase(): LessonStep[] {
  const r = rng(111), out: LessonStep[] = [];
  const half: XY[] = [[18, -60], [14, -42], [34, -10], [54, 40], [52, 90], [38, 130], [30, 160]];
  const pts: XY[] = [...half, ...half.slice().reverse().map(([x, y]) => [-x, y] as XY)];
  out.push(shapeStep(fillSt('#e8dcc8', 110, 0.12, 'in', 0.4, 0.3, false), toBox(pts), 'The vase: down one side, across the foot, up the other. A pale fill, hardly bleeding.', 0.45));
  out.push(shapeStep({ kind: 'hatch', color: '#2b3a55', opacity: 255, hatch: { dist: 5, angle: 60, brush: 'rotring', weight: 0.8, gradient: 0.6, rand: 0.1, continuous: true } }, toBox(pts), 'Trace the vase again: this time it hatches itself, dense on one side and thinning toward the light.', 0.45));
  const heads: XY[] = [[-52, -140], [0, -160], [48, -132]];
  heads.forEach(([hx, hy], i) => out.push(strokeStep(B2, '#4f6b3a', 0.9, splineP([[between(r, -8, 8), -60], [hx * 0.5, -100 + between(r, -10, 10)], [hx, hy]]), i === 0 ? 'Stems: soft pencil from the neck up to each head.' : undefined, 0.5)));
  heads.forEach(([hx, hy], i) => out.push(shapeStep(fillSt('#e0b13f', 170, 0.3, 'out', 0.6, 0.5), toBox(circleP(hx, hy, 22, 0.6, r, 20)), i === 0 ? 'Marigolds: a gold round bleeding out.' : undefined)));
  heads.forEach(([hx, hy], i) => out.push(shapeStep(fillSt('#d75f4c', 120, 0.2, 'in', 0.5, 0.5), toBox(circleP(hx, hy, 11, 0.6, r, 16)), i === 0 ? 'A red heart inside each, bleeding in.' : undefined, 0.4)));
  return out;
}

// ---------------------------------------------------------------------------
// 12 Wheat
// ---------------------------------------------------------------------------
function buildWheat(): LessonStep[] {
  const r = rng(112), out: LessonStep[] = [];
  const tops: XY[] = [];
  for (let x = -150; x <= 150; x += 17) {
    const h = between(r, 90, 180), tx = x + between(r, -12, 12), ty = 160 - h;
    out.push(strokeStep(B2, '#b07a2a', 1.3, wiggle(lineP(x + between(r, -3, 3), 160, tx, ty, even, 24), 3, r), x === -150 ? 'Stalks: soft pencil from the ground up, each with a hand wobble, eighteen of them.' : undefined, 0.55));
    tops.push([tx, ty]);
  }
  tops.forEach(([tx, ty], i) => out.push(strokeStep(SPRAY, '#a8702a', 1.4, wiggle(lineP(tx, ty, tx + between(r, -6, 6), ty - 22, even, 8), 3, r), i === 0 ? 'Heads: a short spray stroke up from the top of each stalk.' : undefined, 0.5)));
  out.push(strokeStep(CHARCOAL, '#7a4e1a', 0.6, lineP(-165, 162, 165, 160, even, 20), 'The ground: one charcoal line under it all.', 0.5));
  return out;
}

// ---------------------------------------------------------------------------
// 13 Sun
// ---------------------------------------------------------------------------
function buildSun(): LessonStep[] {
  const r = rng(113), out: LessonStep[] = [];
  out.push(shapeStep(fillSt('#ef7a4c', 110, 0.45, 'out', 0.6, 0.5), toBox(circleP(0, 0, 95, 0.5, r, 32)), 'The halo: a big loose round, bleeding far out.'));
  out.push(shapeStep(fillSt('#f0b13f', 180, 0.3, 'out', 0.55, 0.5), toBox(circleP(0, 0, 58, 0.3, r, 28)), 'The disc: a smaller gold round on top of it.'));
  for (let i = 0; i < 16; i++) {
    const a = (i * TAU) / 16 + between(r, -0.05, 0.05), r0 = 112, r1 = r0 + between(r, 20, 55);
    out.push(strokeStep(B2, '#9c4732', 0.9, lineP(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1, even, 8), i === 0 ? 'Rays: soft pencil, outward from just beyond the halo, sixteen round the circle.' : undefined, 0.6));
  }
  return out;
}

// ---------------------------------------------------------------------------
// 14 Trade Winds
// ---------------------------------------------------------------------------
function buildWinds(): LessonStep[] {
  const r = rng(114), out: LessonStep[] = [];
  out.push(shapeStep(fillSt('#dfe6ec', 110, 0.25, 'out', 0.45, 0.35, false), toBox(rectP(-155, -155, 310, 310)), 'The sky: a pale square, bleeding a little.'));
  let n = 0;
  for (let i = 0; i < 60 && n < 14; i++) {
    const pts = flowLine(between(r, -150, 150), between(r, -150, 150), between(r, 110, 200), 165);
    if (pts.length < 16) continue;
    out.push(strokeStep(H2, '#7fa6bd', 1.1, pts, n === 0 ? 'Breeze: hard-pencil streaks that follow the wind. Each one is a slow curve; follow its bends.' : undefined, 0.5)); n++;
  }
  n = 0;
  for (let i = 0; i < 60 && n < 10; i++) {
    const pts = flowLine(between(r, -150, 150), between(r, -150, 150), between(r, 80, 160), 165);
    if (pts.length < 14) continue;
    out.push(strokeStep(PEN, '#2f4a63', 1.0, pts, n === 0 ? 'Gusts: shorter pen streaks over them, darker.' : undefined, 0.5)); n++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 15 Jellyfish
// ---------------------------------------------------------------------------
function buildJelly(): LessonStep[] {
  const r = rng(115), out: LessonStep[] = [];
  const cy = -55, bell: XY[] = [];
  for (let a = Math.PI; a <= TAU + 0.01; a += Math.PI / 8) bell.push([Math.cos(a) * 78, cy + Math.sin(a) * 62]);
  for (let k = 1; k <= 4; k++) { const x = 78 - k * 39; bell.push([x, cy + (k % 2 ? 14 : 4)]); }
  out.push(shapeStep(fillSt('#d99bb0', 150, 0.35, 'out', 0.6, 0.5, true, 0.7), toBox(bell), 'The bell: over the dome from left to right, then back along the scalloped rim. The fill rounds the corners and bleeds out.', 0.45));
  out.push(shapeStep(fillSt('#b76e8f', 100, 0.2, 'in', 0.5, 0.6), toBox(circleP(0, cy - 8, 36, 0.4, r, 20)), 'A deeper round inside the dome, bleeding in.'));
  for (let i = 0; i < 7; i++) {
    const x = -55 + i * 18 + between(r, -4, 4);
    out.push(strokeStep(PEN, '#8a5a7a', 1.0, waves(splineP([[x, cy + 10], [x + between(r, -12, 12), cy + 80], [x + between(r, -25, 25), cy + between(r, 150, 215)]], even, 14), 5), i === 0 ? 'Tentacles: pen lines trailing down from the rim, swaying as they fall.' : undefined, 0.5));
  }
  for (let i = 0; i < 4; i++) out.push(strokeStep(H2, '#9fb3c8', 0.6, closedPath(toBox(circleP(between(r, -140, 140), between(r, -150, 150), between(r, 5, 10), 0.5, r, 12)), 3), i === 0 ? 'Bubbles: small hard-pencil rings, once round.' : undefined, 0.5));
  return out;
}

// ---------------------------------------------------------------------------
// 16 Leaf
// ---------------------------------------------------------------------------
function buildWashLeaf(): LessonStep[] {
  const out: LessonStep[] = [];
  const rot = -0.5, L = 150, Wd = 62;
  const P = (t: number, side: number): XY => { const x = -L + 2 * L * t, y = side * Math.sin(Math.PI * t) * Wd * (1 - 0.3 * t); return [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)]; };
  const pts: XY[] = [];
  for (let i = 0; i <= 20; i++) pts.push(P(i / 20, 1));
  for (let i = 19; i > 0; i--) pts.push(P(i / 20, -1));
  out.push(shapeStep(fillSt('#5d7a3c', 150, 0.3, 'out', 0.6, 0.5), toBox(pts), 'The leaf: from the stem, round one edge to the tip and back along the other. Green wash, bleeding out.', 0.45));
  out.push(strokeStep(CPENCIL, '#2f3f1e', 0.8, splineP([P(0, 0), P(0.5, 0.05), P(1, 0)]), 'The midrib: coloured pencil, stem to tip.', 0.5));
  for (let k = 1; k <= 6; k++) {
    const t = k / 7.5, a = P(t, 0), b = P(t + 0.1, 0.75), c = P(t + 0.1, -0.75);
    out.push(strokeStep(CPENCIL, '#2f3f1e', 0.8, lineP(a[0], a[1], b[0], b[1], even, 8), k === 1 ? 'Veins: six pairs off the midrib, each a short pull toward the edge.' : undefined, 0.6));
    out.push(strokeStep(CPENCIL, '#2f3f1e', 0.8, lineP(a[0], a[1], c[0], c[1], even, 8), undefined, 0.6));
  }
  return out;
}

export const WASHES: Lesson[] = [
  { id: 'fuji', title: 'Red Fuji', subtitle: 'Washes, wash negative space, pen', difficulty: 2, build: buildFuji },
  { id: 'lanterns', title: 'Lantern Night', subtitle: 'Textured fill, 2H hoops, wash, pen', difficulty: 3, build: buildLanterns },
  { id: 'grove', title: 'Bamboo', subtitle: 'Culm and leaf brushes, 2B', difficulty: 3, build: buildGrove },
  { id: 'persimmons', title: 'Six Persimmons', subtitle: 'Charcoal mass, crayon mass, wash, 2B', difficulty: 2, build: buildPersimmons },
  { id: 'mandala', title: 'Mandala', subtitle: 'Petal brush, 2H', difficulty: 3, build: buildMandala },
  { id: 'pond', title: 'Koi Pond', subtitle: '2H, orange bleed, waves', difficulty: 2, build: buildPond },
  { id: 'harvest', title: 'Harvest Moon', subtitle: 'Pen, flat wash', difficulty: 1, build: buildHarvest },
  { id: 'seastar', title: 'Seabed Star', subtitle: 'Coloured pencil, 2B, wash', difficulty: 2, build: buildSeastar },
  { id: 'poppies', title: 'Poppies', subtitle: 'Pen, red bleed, wash', difficulty: 2, build: buildPoppies },
  { id: 'ridge', title: 'Ridge', subtitle: 'Three washes', difficulty: 1, build: buildRidge },
  { id: 'vase', title: 'Marigold Vase', subtitle: 'Rotring gradient hatch, 2B', difficulty: 2, build: buildVase },
  { id: 'wheat', title: 'Wheat', subtitle: '2B, spray, hand wiggle', difficulty: 2, build: buildWheat },
  { id: 'sun', title: 'Sun', subtitle: '2B, outward bleed', difficulty: 1, build: buildSun },
  { id: 'winds', title: 'Trade Winds', subtitle: 'Pen, 2H, noise field', difficulty: 2, build: buildWinds },
  { id: 'jelly', title: 'Jellyfish', subtitle: 'Pen, 2H, waves', difficulty: 2, build: buildJelly },
  { id: 'washleaf', title: 'Leaf', subtitle: 'Coloured pencil, green wash', difficulty: 1, build: buildWashLeaf },
];
