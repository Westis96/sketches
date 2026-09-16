/**
 * Practice lessons: sample drawings the user traces step by step. Each step is
 * one reference stroke with the brush it was made with, in lesson space
 * (an 800×600 box that the studio places at the world origin and zooms to fit).
 * Lessons are built lazily and cached; the geometry is fully deterministic.
 */
import type { Point, ShapeStyle } from '@/engine/records';
import { BRUSH_TEMPLATES } from '@/engine/templates';
import { bell, circle, flat, frame, spline, taperIn, taperOut, type Profile, type XY } from './geometry';
import { WASHES } from './washes';

export interface LessonStep {
  /** Template id from BRUSH_TEMPLATES. */
  template: string;
  color: string;
  size: number;
  points: Point[];
  /** Coaching line for the step card; falls back to the previous step's hint. */
  hint?: string;
  /** Target speed in lesson units per ms (defaults to the scorer's unhurried pull). */
  speed?: number;
  /** A filled shape: the learner traces `points` as its outline and the shape lands on lift. */
  shape?: ShapeStyle;
  /** The shape's own polygon vertices (sparse: a rectangle is four points). p5.brush bleeds in proportion to edge length, so the reference keeps the page's vertices; defaults to a simplified `points`. */
  outline?: Point[];
}

export interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  difficulty: 1 | 2 | 3;
  build: () => LessonStep[];
  /** Polylines shown on the paper but never drawn: the subject of a negative-space piece. */
  overlay?: XY[][];
}

export const LESSON_BOX = { w: 800, h: 600 };

const step = (template: string, color: string, size: number, points: Point[], hint?: string): LessonStep => ({ template, color, size, points, hint });

// --- Warm-up: waves -----------------------------------------------------------
function buildWaves(): LessonStep[] {
  const wave = (y: number, amp: number, x0 = 90, x1 = 710): XY[] => [[x0, y], [x0 + (x1 - x0) * 0.25, y - amp], [(x0 + x1) / 2, y], [x0 + (x1 - x0) * 0.75, y + amp], [x1, y]];
  return [
    step('liner', '#1a1c23', 1.3, spline(wave(160, 60), 20, flat(0.6)), 'One smooth pull from left to right. Speed matters more than precision.'),
    step('graphite', '#4d4d4d', 1.0, spline(wave(260, 40), 20, flat(0.65)), 'The same wave in pencil, a little flatter. Same one motion.'),
    { ...step('liner', '#1a1c23', 1.3, spline(wave(370, 85), 20, flat(0.6)), 'Bigger and faster: this one comes from the shoulder, not the wrist.'), speed: 0.7 },
    step('graphite', '#4d4d4d', 1.0, spline([[90, 470], [170, 440], [250, 500], [330, 440], [410, 500], [490, 440], [570, 500], [650, 440], [710, 470]], 12, flat(0.65)), 'A quick zigzag. Keep the corners sharp.'),
    { ...step('liner', '#1a1c23', 1.3, spline([[90, 548], [400, 546], [710, 548]], 24, flat(0.6)), 'One flat pull to finish: a horizon under the waves.'), speed: 0.7 },
  ];
}

// --- Leaf ---------------------------------------------------------------------
function buildLeaf(): LessonStep[] {
  const R = frame(180, 480, -0.62);
  const len = 470, wid = 135;
  const out: LessonStep[] = [];
  for (const k of [0, -1, 1]) {
    const w = wid * (1 - Math.abs(k) * 0.45);
    out.push(step('wash', k === 0 ? '#4f8a48' : '#6fa15a', 0.62,
      spline([R(0, 0), R(len * 0.4, k * w * 0.62), R(len * 0.75, k * w * 0.55), R(len, 0)], 26, bell),
      k === 0 ? 'Loose watery fills first: a wide sweep from the stem to the tip.' : 'Two more sweeps, one along each side. Overlaps are fine.'));
  }
  for (const sgn of [-1, 1]) {
    out.push(step('liner', '#2a4a2c', 1.25,
      spline([R(0, 0), R(len * 0.38, sgn * wid * 0.6), R(len * 0.75, sgn * wid * 0.5), R(len, 0)], 26, bell),
      sgn < 0 ? 'Outline: start at the stem and draw one clean curve to the tip.' : 'The other edge, again from stem to tip.'));
  }
  out.push(step('nib', '#2f5a33', 0.55, spline([R(6, 0), R(len * 0.5, 3), R(len * 0.92, 0)], 22, taperOut), 'The midrib: press at the stem, lighten toward the tip.'));
  for (let v = 1; v <= 3; v++) {
    const x0 = len * (0.12 + v * 0.2);
    for (const sgn of [-1, 1]) {
      out.push(step('liner', '#3b6b3d', 0.7,
        spline([R(x0, 0), R(x0 + len * 0.14, sgn * wid * 0.28), R(x0 + len * 0.22, sgn * wid * 0.42)], 10, taperOut),
        v === 1 && sgn < 0 ? 'Side veins: short flicks away from the midrib.' : undefined));
    }
  }
  return out;
}

// --- Bamboo -------------------------------------------------------------------
function buildBamboo(): LessonStep[] {
  const node: Profile = (t) => 0.95 - 0.5 * Math.sin(t * Math.PI);
  const out: LessonStep[] = [];
  const stalk = (x: number, lean: number, segs: Array<[number, number]>, first?: string) => {
    segs.forEach(([y0, y1], i) => {
      const dx = (y: number) => x + (560 - y) * lean;
      out.push(step('bristle', '#2f5a33', 1.35, spline([[dx(y0), y0], [dx((y0 + y1) / 2) + 2, (y0 + y1) / 2], [dx(y1), y1]], 14, node), i === 0 ? first : undefined));
    });
  };
  stalk(230, 0.02, [[560, 410], [396, 240], [226, 70]], 'Bamboo: one segment per stroke, bottom to top. Press at both ends, light in between.');
  stalk(420, 0.08, [[560, 380], [366, 190]], 'A second, leaning stalk.');
  for (const [x, y] of [[233, 403], [236, 233], [434, 373]] as XY[]) {
    out.push(step('nib', '#1f3d24', 0.45, spline([[x - 24, y + 3], [x, y - 2], [x + 26, y + 3]], 10, bell), x === 233 && y === 403 ? 'Nodes: a short dark tick at each joint.' : undefined));
  }
  const leaf = (x: number, y: number, a: number, l: number, hint?: string) => {
    const R = frame(x, y, a);
    out.push(step('nib', '#3f6b3a', 0.95, spline([R(0, 0), R(l * 0.45, l * 0.06), R(l, 0)], 16, taperOut), hint));
  };
  leaf(236, 226, -0.55, 150, 'Leaves: press at the base and flick out fast, the tip should be a point.');
  leaf(236, 226, 0.25, 135);
  leaf(240, 236, 2.9, 120);
  leaf(444, 190, -0.9, 130);
  leaf(444, 190, -0.15, 145);
  leaf(448, 200, 2.6, 110);
  leaf(232, 66, -1.1, 105);
  leaf(232, 66, 0.1, 125);
  return out;
}

// --- Hills at dusk -------------------------------------------------------------
function buildDusk(): LessonStep[] {
  const out: LessonStep[] = [];
  const sky = ['#f7cf8a', '#f3a97a', '#e98289', '#c96d95'];
  sky.forEach((c, i) => {
    const y = 110 + i * 48;
    out.push(step('wash', c, 1.2, spline([[40, y], [400, y + (i % 2 ? 4 : -4)], [760, y]], 30, flat(0.65)), i === 0 ? 'Sky: wide flat bands, edge to edge. Keep the pressure even.' : undefined));
  });
  out.push(step('spray', '#ffd166', 1.4, circle(560, 232, 34, 32, 0, 1, flat(0.8)), 'The sun: a loose spray circle. Speed gives it a soft edge.'));
  out.push(step('spray', '#f4a261', 1.0, circle(560, 232, 20, 28, 1, 1, flat(0.7))));
  const hill = (pts: XY[], color: string, size: number, hint?: string) => {
    out.push(step('bristle', color, size, spline(pts, 22, flat(0.75)), hint));
    const fill = pts.map(([x, y]) => [x, y + 22] as XY);
    out.push(step('bristle', color, size, spline(fill, 22, flat(0.6))));
  };
  hill([[40, 372], [200, 322], [360, 356], [520, 306], [760, 350]], '#6d5b8a', 1.7, 'Far hills: a rolling line, then a second pass just below to fill.');
  hill([[40, 440], [240, 398], [430, 440], [620, 400], [760, 428]], '#4c6b5c', 1.7, 'Middle hills, a bit darker.');
  hill([[40, 520], [260, 480], [480, 522], [760, 486]], '#2f4b3f', 1.9, 'The near ridge, darkest and heaviest.');
  const bird = (x: number, y: number, hint?: string) => out.push(step('liner', '#3a2a3f', 0.9, spline([[x - 16, y - 2], [x - 8, y - 9], [x, y - 3], [x + 8, y - 9], [x + 16, y - 2]], 8, flat(0.55)), hint));
  bird(300, 190, 'Birds: tiny relaxed m-shapes.');
  bird(340, 170);
  bird(372, 200);
  for (let i = 0; i < 4; i++) {
    const x = 130 + i * 170 + (i % 2) * 40;
    out.push(step('graphite', '#1f3328', 1.1, spline([[x, 566], [x + 6, 540], [x + 16, 520]], 8, taperOut), i === 0 ? 'Grass: quick upward ticks along the bottom edge.' : undefined));
  }
  return out;
}

// --- Bloom ----------------------------------------------------------------------
function buildBloom(): LessonStep[] {
  const cx = 400, cy = 250;
  const out: LessonStep[] = [];
  const petal = (a: number, len: number, wid: number, i: number) => {
    const R = frame(cx, cy, a);
    out.push(step('wash', i % 2 ? '#f088b5' : '#ee7fae', 0.72,
      spline([R(24, 0), R(len * 0.35, wid * 0.05), R(len * 0.7, -wid * 0.05), R(len, 0)], 24, bell),
      i === 0 ? 'Petals: a soft wash from the centre outward, one per petal.' : undefined));
    for (const sgn of [-1, 1]) {
      out.push(step('chisel', '#d9528d', 0.34,
        spline([R(20, sgn * wid * 0.16), R(len * 0.4, sgn * wid * 0.62), R(len * 0.78, sgn * wid * 0.48), R(len + 4, 0)], 22, bell),
        i === 0 && sgn < 0 ? 'Now the petal edges with the chisel marker: centre to tip, both sides.' : undefined));
    }
  };
  for (let i = 0; i < 6; i++) petal(-Math.PI / 2 + (i * Math.PI) / 3, 170, 66, i);
  out.push(step('wash', '#e8a21c', 0.7, circle(cx, cy, 26, 36, 0.5, 1, flat(0.75)), 'The centre: a tight wash circle.'));
  out.push(step('spray', '#c97b12', 1.6, circle(cx, cy, 40, 40, 0, 1, flat(0.7)), 'Pollen: a spray ring around it.'));
  out.push(step('graphite', '#6b3f12', 1.5, circle(cx, cy, 48, 48, 0.3, 1, flat(0.7)), 'A dark graphite ring to frame the seeds.'));
  out.push(step('bristle', '#3f6b3a', 1.6, spline([[cx + 4, cy + 60], [cx - 6, cy + 160], [cx + 10, cy + 260], [cx + 2, cy + 340]], 30, taperIn), 'The stem: light at the flower, firm at the ground.'));
  const leaf = (bx: number, by: number, dir: number, len: number, wid: number, tilt: number, hint?: string) => {
    const R = (x: number, y: number): XY => [bx + (x * Math.cos(tilt) - y * Math.sin(tilt)) * dir, by + x * Math.sin(tilt) + y * Math.cos(tilt)];
    out.push(step('wash', '#5c9a50', 0.55, spline([R(0, 0), R(len * 0.4, 0), R(len, 0)], 20, bell), hint));
    out.push(step('liner', '#2a4a2c', 1.1, spline([R(0, 0), R(len * 0.38, -wid * 0.6), R(len * 0.75, -wid * 0.5), R(len, 0), R(len * 0.75, wid * 0.5), R(len * 0.38, wid * 0.6), R(0, 0)], 12, flat(0.6))));
  };
  leaf(cx + 2, cy + 190, -1, 140, 50, -0.35, 'Leaves: a green wash, then one continuous liner outline around it.');
  leaf(cx + 6, cy + 270, 1, 120, 44, -0.28);
  return out;
}

// --- Fence (1.1 Dot to dot) ------------------------------------------------------
function buildFence(): LessonStep[] {
  const out: LessonStep[] = [];
  for (let i = 0; i < 6; i++) {
    const x = 120 + i * 112;
    out.push({ ...step('liner', '#3a3128', 1.3, spline([[x, 175], [x + 1, 320], [x, 470]], 10, flat(0.62)), i === 0 ? 'Posts: one pull from top to bottom. Ghost it in the air first.' : undefined), speed: 0.7 });
  }
  out.push({ ...step('liner', '#3a3128', 1.3, spline([[80, 250], [400, 246], [720, 250]], 12, flat(0.62)), 'Rails: left to right, the same speed all the way across.'), speed: 0.75 });
  out.push({ ...step('liner', '#3a3128', 1.3, spline([[80, 400], [400, 404], [720, 400]], 12, flat(0.62))), speed: 0.75 });
  return out;
}

// --- Mountains (1.3 Corners) -----------------------------------------------------
function buildMountains(): LessonStep[] {
  const ridge = (pts: XY[], color: string, size: number, hint?: string): LessonStep => ({ ...step('graphite', color, size, polyPts(pts, 8, flat(0.65)), hint), speed: 0.5 });
  const out: LessonStep[] = [
    ridge([[60, 330], [170, 210], [260, 290], [380, 150], [500, 280], [610, 190], [740, 320]], '#8a8378', 0.9, 'The far ridge: stop at every peak, then change direction. Corners stay sharp.'),
    ridge([[60, 420], [200, 300], [320, 380], [450, 250], [580, 370], [740, 410]], '#5e5850', 1.05, 'The middle ridge, a little darker.'),
    ridge([[60, 500], [240, 400], [400, 470], [560, 380], [740, 490]], '#3b3630', 1.2, 'The near ridge, darkest and heaviest.'),
    { ...step('graphite', '#3b3630', 1.0, spline([[60, 540], [400, 542], [740, 540]], 12, flat(0.55)), 'The ground: one straight pull.'), speed: 0.7 },
  ];
  // snow: short ticks on the two tallest peaks
  for (const [x, y] of [[380, 150], [450, 250]] as XY[]) {
    out.push({ ...step('graphite', '#8a8378', 0.8, polyPts([[x - 22, y + 26], [x - 8, y + 18], [x + 8, y + 18], [x + 22, y + 26]], 6, flat(0.5)), x === 380 ? 'Snow lines: a small zigzag just under the peak.' : undefined), speed: 0.5 });
  }
  return out;
}

// --- Kite strings (1.4 Start at the dot) ------------------------------------------
function buildKites(): LessonStep[] {
  const out: LessonStep[] = [];
  const hand: XY = [400, 560];
  const kites: Array<[number, number, number]> = [[190, 180, 0.15], [420, 120, -0.1], [620, 220, 0.3]];
  kites.forEach(([cx, cy, tilt], i) => {
    const R = frame(cx, cy, tilt);
    const w = 52, h = 70;
    // The diamond starts at the top and is drawn clockwise: the arrow says which way.
    out.push({ ...step('liner', ['#c9407c', '#2c3e8f', '#d98b1f'][i], 1.2, spline([R(0, -h), R(w, 0), R(0, h), R(-w, 0), R(0, -h)], 10, flat(0.6)), i === 0 ? 'The kite: start at the dot and go the way the arrow points, all the way round.' : undefined), speed: 0.5 });
    const [bx, by] = R(0, h);
    out.push({ ...step('liner', '#3a3128', 0.9, spline([[bx, by], [(bx + hand[0]) / 2 + (i - 1) * 40, (by + hand[1]) / 2 + 30], hand], 14, flat(0.5)), i === 0 ? 'The string: from the kite down to the hand, not the other way.' : undefined), speed: 0.6 });
  });
  out.push({ ...step('liner', '#3a3128', 1.2, spline([[380, 560], [400, 548], [420, 560]], 6, flat(0.6)), 'The hand: a small cup at the bottom.'), speed: 0.45 });
  return out;
}

// --- Grass (2.1 Taper out) ----------------------------------------------------------
function buildGrass(): LessonStep[] {
  const out: LessonStep[] = [];
  const blades: Array<[number, number, number]> = [[90, 190, -26], [150, 150, 12], [215, 210, -8], [280, 130, 24], [340, 175, -18], [405, 145, 6], [470, 200, -28], [530, 120, 16], [590, 180, -4], [650, 140, 22], [705, 195, -14], [740, 160, 8]];
  blades.forEach(([x, h, lean], i) => {
    out.push({ ...step('bristle', i % 3 === 0 ? '#3f6b3a' : i % 3 === 1 ? '#4f8a48' : '#2f5a33', 1.0,
      spline([[x, 520], [x + lean * 0.35, 520 - h * 0.5], [x + lean, 520 - h]], 12, taperOut),
      i === 0 ? 'Blades: press at the root and lift as you flick up. The tip should vanish.' : undefined), speed: 0.65 });
  });
  out.push({ ...step('bristle', '#2f5a33', 1.2, spline([[60, 524], [400, 520], [740, 524]], 14, flat(0.6)), 'The ground: a steady line to sit them on.'), speed: 0.6 });
  return out;
}

// --- Rain (2.2 Swell) -----------------------------------------------------------------
function buildRain(): LessonStep[] {
  const out: LessonStep[] = [];
  const drops: XY[] = [[120, 110], [250, 90], [380, 130], [510, 100], [640, 120], [180, 260], [320, 240], [460, 280], [600, 250], [700, 290]];
  drops.forEach(([x, y], i) => {
    out.push({ ...step('nib', '#2c3e8f', 0.6, spline([[x, y], [x - 14, y + 60], [x - 28, y + 120]], 10, bell), i === 0 ? 'A drop: light in, heavy in the middle, light out. One motion.' : undefined), speed: 0.55 });
  });
  out.push({ ...step('nib', '#2c3e8f', 0.6, spline([[140, 470], [300, 452], [500, 456], [660, 470]], 14, bell), 'The puddle edge: the same swell, stretched long.'), speed: 0.45 });
  out.push({ ...step('nib', '#2c3e8f', 0.6, spline([[200, 500], [400, 490], [600, 500]], 12, bell)), speed: 0.45 });
  return out;
}

// --- Reeds (2.4 Fade and lift) ----------------------------------------------------------
function buildReeds(): LessonStep[] {
  const out: LessonStep[] = [];
  const stems: Array<[number, number, number]> = [[170, 130, -12], [280, 90, 10], [400, 150, -6], [520, 100, 14], [640, 140, -10]];
  stems.forEach(([x, top, sway], i) => {
    out.push({ ...step('bristle', '#3f6b3a', 1.3, spline([[x, 560], [x - sway, 380], [x + sway * 1.4, top]], 16, taperOut), i === 0 ? 'A stem: firm at the water, fading to nothing at the tip.' : undefined), speed: 0.5 });
  });
  for (const [x, top, sway] of [stems[1], stems[3], stems[4]]) {
    out.push({ ...step('nib', '#5a4630', 0.7, spline([[x + sway * 1.4, top + 8], [x + sway * 1.4 + 3, top - 22], [x + sway * 1.4, top - 48]], 8, bell), x === stems[1][0] ? 'Seed heads: a short swell at three of the tips.' : undefined), speed: 0.4 });
  }
  out.push({ ...step('bristle', '#5e7f96', 1.2, spline([[60, 566], [400, 560], [740, 566]], 14, taperOut), 'The water: one long fade across the bottom.'), speed: 0.5 });
  return out;
}


// --- Level 3 and 5 pieces: built after the gallery studies -----------------------
/** A closed ellipse in one pass, `n` samples, starting at the top. */
function ellipsePts(cx: number, cy: number, rx: number, ry: number, rot = 0, n = 44, prof: Profile = flat(0.6)): Point[] {
  const R = frame(cx, cy, rot);
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; const [x, y] = R(Math.cos(a) * rx, Math.sin(a) * ry); out.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, p: prof(i / n) }); }
  return out;
}
/** Part of an ellipse, from angle a0 to a1 (radians, 0 = right). */
function arcPts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 16, prof: Profile = bell): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push({ x: Math.round((cx + Math.cos(a) * rx) * 100) / 100, y: Math.round((cy + Math.sin(a) * ry) * 100) / 100, p: prof(i / n) }); }
  return out;
}
/** Straight segments through the control points: corners stay corners. */
function polyPts(ctrl: XY[], per = 10, prof: Profile = flat(0.6)): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < ctrl.length - 1; i++) for (let k = 0; k < per; k++) { const t = k / per; out.push({ x: ctrl[i][0] + (ctrl[i + 1][0] - ctrl[i][0]) * t, y: ctrl[i][1] + (ctrl[i + 1][1] - ctrl[i][1]) * t, p: 0 }); }
  out.push({ x: ctrl[ctrl.length - 1][0], y: ctrl[ctrl.length - 1][1], p: 0 });
  out.forEach((q, i) => { q.p = prof(i / (out.length - 1)); });
  return out;
}

// 3.1 Pebbles: ellipses in planes
function buildPebbles(): LessonStep[] {
  const out: LessonStep[] = [];
  const ground = 486;
  out.push(step('graphite', '#8a847a', 0.9, spline([[40, ground], [400, ground - 4], [760, ground + 2]], 20, flat(0.5)), 'The ground: one light line, edge to edge.'));
  // Each pebble sits on the line: its centre is one short radius above it.
  const stones: Array<[number, number, number, number]> = [[150, 70, 40, 0.1], [300, 54, 32, -0.3], [440, 84, 52, 0.15], [590, 50, 30, 0.45], [700, 62, 42, -0.2]];
  const cy = (ry: number) => ground - ry - 2;
  stones.forEach(([x, rx, ry, rot], i) => out.push(step('graphite', '#4d4d4d', 1.0, ellipsePts(x, cy(ry), rx, ry, rot, 44, flat(0.6)), i === 0 ? 'A pebble is an ellipse: ghost it twice in the air, then one pass round, and close it where you began.' : i === 2 ? 'The big one. Same motion, bigger radius: it comes from the elbow, not the fingers.' : undefined)));
  out.push(step('graphite', '#3a3a3a', 1.2, arcPts(150, cy(40), 72, 42, 0.3, 2.6, 16, bell), 'The shadow side: a shorter, heavier arc along the lower right of each pebble.'));
  out.push(step('graphite', '#3a3a3a', 1.2, arcPts(440, cy(52), 86, 54, 0.2, 2.7, 18, bell)));
  out.push(step('graphite', '#3a3a3a', 1.1, arcPts(700, cy(42), 64, 44, 0.3, 2.5, 14, bell)));
  out.push(step('graphite', '#3a3a3a', 1.0, ellipsePts(260, 528, 40, 22, 0.1, 40, flat(0.65)), 'One small pebble in front: flatter, because you look down on it more.'));
  out.push(step('graphite', '#3a3a3a', 1.0, ellipsePts(560, 536, 36, 18, -0.2, 40, flat(0.65))));
  return out;
}

// 3.2 Vine: S-curves and spirals
function buildVine(): LessonStep[] {
  const out: LessonStep[] = [];
  const stem: XY[] = [[110, 530], [230, 470], [330, 360], [400, 260], [500, 190], [620, 150], [700, 90]];
  out.push(step('liner', '#2a4a2c', 1.3, spline(stem, 16, flat(0.6)), 'The stem: bends both ways in one motion. Do not stop where it changes direction.'));
  const spiral = (x: number, y: number, r0: number, turns: number, dir: number, hint?: string) => {
    const pts: Point[] = [];
    const n = Math.round(turns * 22);
    for (let i = 0; i <= n; i++) { const a = (i / n) * turns * Math.PI * 2; const r = r0 * (1 - (0.82 * i) / n); pts.push({ x: Math.round((x + Math.cos(a * dir) * r) * 100) / 100, y: Math.round((y + Math.sin(a * dir) * r) * 100) / 100, p: 0.6 - (0.2 * i) / n }); }
    out.push(step('liner', '#2a4a2c', 1.1, pts, hint));
  };
  spiral(300, 300, 46, 1.6, 1, 'Tendrils: a spiral tightens at an even rate. Keep the speed steady and let the radius shrink.');
  spiral(560, 250, 40, 1.5, -1);
  spiral(190, 440, 34, 1.4, 1);
  const leaf = (x: number, y: number, a: number, l: number, hint?: string) => {
    const R = frame(x, y, a);
    out.push(step('liner', '#3b6b3d', 1.15, spline([R(0, 0), R(l * 0.4, l * 0.26), R(l, 0), R(l * 0.45, -l * 0.24), R(0, 0)], 12, flat(0.6)), hint));
  };
  leaf(230, 470, -1.9, 110, 'Leaves: one loop, out along one edge and back along the other, closed where it started.');
  leaf(330, 360, 0.7, 100);
  leaf(400, 260, -2.2, 96);
  leaf(500, 190, 0.5, 104);
  leaf(620, 150, -2.4, 88);
  leaf(700, 90, 0.3, 80);
  return out;
}

// 3.3 Ribbon: the angled tip
function buildRibbon(): LessonStep[] {
  const out: LessonStep[] = [];
  const c = '#c9407c';
  out.push(step('chisel', c, 0.85, spline([[90, 160], [220, 300], [300, 420], [340, 520]], 18, flat(0.7)), 'Down and across: the chisel edge is broad on this diagonal. Pull it in one motion.'));
  out.push(step('chisel', c, 0.85, spline([[340, 520], [420, 470], [470, 380], [480, 300]], 18, flat(0.7)), 'Now up: the same tip turns thin. Feel the width change as you curve.'));
  out.push(step('chisel', c, 0.85, spline([[480, 300], [520, 200], [600, 150], [700, 170]], 18, flat(0.7)), 'The top curl, broad again.'));
  out.push(step('chisel', c, 0.85, spline([[700, 170], [740, 240], [700, 330], [620, 380]], 18, flat(0.7)), 'And back down, thin to broad.'));
  out.push(step('chisel', c, 0.85, spline([[620, 380], [560, 460], [540, 540]], 14, flat(0.65)), 'The tail: let it trail off.'));
  out.push(step('chisel', '#a8285e', 0.6, spline([[300, 420], [330, 360], [300, 300], [260, 340], [300, 420]], 14, flat(0.7)), 'A bow loop: one closed motion, the width turning as you go round.'));
  out.push(step('chisel', '#a8285e', 0.6, spline([[340, 520], [400, 560], [440, 620], [380, 600], [340, 520]], 14, flat(0.7))));
  return out;
}

// 5.1 Sea bands: flat bands
function buildSeabands(): LessonStep[] {
  const out: LessonStep[] = [];
  const sky = ['#e3ebf1', '#d6e1ea', '#c8d7e3'];
  sky.forEach((c, i) => out.push(step('wash', c, 1.3, spline([[30, 90 + i * 46], [400, 90 + i * 46 + (i % 2 ? 3 : -3)], [770, 90 + i * 46]], 30, flat(0.6)), i === 0 ? 'Sky: edge to edge, one even pressure, no stopping. Start past the left edge and finish past the right.' : undefined)));
  out.push(step('wash', '#f2e4b8', 0.8, circle(600, 150, 36, 36, 0, 1, flat(0.7)), 'The sun: a loose wash circle, one pass.'));
  out.push(step('wash', '#f2e4b8', 0.8, circle(600, 150, 20, 30, 1, 1, flat(0.7))));
  out.push(step('liner', '#5e7d9a', 0.8, spline([[30, 262], [400, 260], [770, 262]], 20, flat(0.5)), 'The horizon: one thin, level line.'));
  const sea = ['#a9c0d2', '#8fabc3', '#7898b3', '#6487a4', '#527794', '#446887'];
  sea.forEach((c, i) => out.push(step('wash', c, 1.35, spline([[30, 292 + i * 50], [400, 292 + i * 50 + (i % 2 ? 4 : -4)], [770, 292 + i * 50]], 30, flat(0.6 + i * 0.04)), i === 0 ? 'The sea: each band a little darker as it comes toward you. Same motion every time.' : undefined)));
  return out;
}

// 5.2 Stones: light before dark
function buildStones(): LessonStep[] {
  const out: LessonStep[] = [];
  const stone = (x: number, y: number, rx: number, ry: number, first: boolean) => {
    const R = frame(x, y, 0);
    out.push(step('wash', '#cdc2ae', 0.7, spline([R(-rx * 0.9, -ry * 0.1), R(-rx * 0.3, -ry * 0.75), R(rx * 0.4, -ry * 0.7), R(rx * 0.9, 0)], 24, bell), first ? 'Pale first: the lightest wash goes down before anything darker can.' : undefined));
    out.push(step('wash', '#bdb09a', 0.7, spline([R(-rx * 0.9, ry * 0.1), R(-rx * 0.2, ry * 0.8), R(rx * 0.5, ry * 0.7), R(rx * 0.9, 0)], 24, bell)));
    out.push(step('wash', '#8f8677', 0.55, spline([R(rx * 0.1, ry * 0.85), R(rx * 0.6, ry * 0.6), R(rx * 0.9, 0)], 16, bell), first ? 'Now the shadow side: one darker sweep along the lower right. It could never go under the pale one later.' : undefined));
    out.push(step('liner', '#5a524a', 1.1, ellipsePts(x, y, rx, ry, 0, 48, flat(0.55)), first ? 'Last, one line around it: slow, once.' : undefined));
  };
  stone(400, 470, 150, 62, true);
  stone(396, 372, 118, 48, false);
  stone(402, 296, 86, 36, false);
  stone(398, 238, 54, 24, false);
  out.push(step('graphite', '#8a847a', 1.0, spline([[120, 540], [400, 536], [680, 542]], 20, flat(0.5)), 'The ground line, last of all.'));
  return out;
}

// 5.3 Moon: spray and soft edges
function buildMoon(): LessonStep[] {
  const out: LessonStep[] = [];
  const cx = 520, cy = 210;
  out.push(step('spray', '#8f9db5', 2.0, spline([[40, 120], [400, 112], [760, 122]], 30, flat(0.6)), 'Night sky: one spray pass per band, edge to edge. One pass stays soft.'));
  out.push(step('spray', '#8f9db5', 2.0, spline([[40, 260], [400, 268], [760, 258]], 30, flat(0.6))));
  out.push(step('spray', '#8f9db5', 2.0, spline([[40, 400], [400, 392], [760, 402]], 30, flat(0.6))));
  out.push(step('spray', '#c9b56a', 1.8, circle(cx, cy, 96, 40, 0, 1, flat(0.5)), 'The halo: a wide loose ring, one pass, wide and light.'));
  out.push(step('spray', '#c9a94a', 1.7, circle(cx, cy, 60, 36, 0.5, 1, flat(0.85)), 'The moon: three circles, darkest first, lightest last.'));
  out.push(step('spray', '#d9bd63', 1.5, circle(cx, cy, 44, 32, 1, 1, flat(0.85))));
  out.push(step('spray', '#e8d08a', 1.3, circle(cx, cy, 28, 28, 1.5, 1, flat(0.85))));
  out.push(step('charcoal', '#2a2f3a', 1.5, spline([[180, 590], [176, 480], [190, 380], [186, 300]], 20, taperOut), 'The tree: charcoal, heavy at the trunk, lifting as it rises.'));
  out.push(step('charcoal', '#2a2f3a', 1.1, spline([[186, 420], [240, 360], [300, 330]], 12, taperOut), 'Branches: each one a quick lift off the trunk.'));
  out.push(step('charcoal', '#2a2f3a', 1.1, spline([[188, 360], [130, 300], [100, 250]], 12, taperOut)));
  out.push(step('charcoal', '#2a2f3a', 1.0, spline([[186, 300], [220, 240], [250, 200]], 12, taperOut)));
  out.push(step('charcoal', '#2a2f3a', 1.0, spline([[187, 310], [150, 260], [140, 200]], 12, taperOut)));
  out.push(step('charcoal', '#2a2f3a', 1.4, spline([[40, 592], [400, 586], [760, 594]], 24, flat(0.6)), 'The ground: one dark band along the bottom.'));
  return out;
}

// 5.4 Cube: hatching rhythm
function buildCube(): LessonStep[] {
  const out: LessonStep[] = [];
  const A: XY = [260, 170], B: XY = [500, 140], C: XY = [560, 250], D: XY = [320, 280], E: XY = [260, 400], F: XY = [560, 480], Hh: XY = [320, 510];
  const edge = (p: XY, q: XY, hint?: string) => out.push(step('ballpoint', '#1a1c23', 1.1, polyPts([p, q], 14, flat(0.65)), hint));
  edge(A, B, 'The edges first: one pull each, and a full stop at every corner.');
  edge(B, C); edge(C, D); edge(D, A); edge(A, E); edge(D, Hh); edge(C, F); edge(E, Hh); edge(Hh, F);
  const hatch = (p0: XY, p1: XY, p2: XY, p3: XY, n: number, hint?: string) => {
    for (let i = 1; i < n; i++) { const t = i / n; const a: XY = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t], b: XY = [p3[0] + (p2[0] - p3[0]) * t, p3[1] + (p2[1] - p3[1]) * t]; out.push(step('ballpoint', '#1a1c23', 1.0, polyPts([a, b], 12, flat(0.55)), i === 1 ? hint : undefined)); }
  };
  hatch(D, C, F, Hh, 9, 'The dark face: parallel lines, evenly spaced, same speed. Look at where the line ends, not at the pen.');
  hatch(C, F, Hh, D, 6, 'Darker means another direction: cross the dark face with a second set, not harder pressure.');
  hatch(A, D, Hh, E, 5, 'The side face: fewer lines, same rhythm.');
  hatch(A, B, C, D, 3, 'The top, lightest: two lines only.');
  out.push(step('graphite', '#8a847a', 1.0, spline([[80, 540], [400, 536], [720, 542]], 20, flat(0.5)), 'The ground line.'));
  return out;
}

// 6.2 Koi: the living line
function buildKoi(): LessonStep[] {
  const out: LessonStep[] = [];
  const c = '#d2452c';
  const living: Profile = (t) => 0.3 + 0.6 * Math.sin(t * Math.PI);
  out.push({ ...step('brushpen', c, 0.95, spline([[170, 300], [300, 230], [460, 240], [600, 300], [700, 340]], 20, living), 'The back: one living line, thin as you start, weight through the body, thin again at the tail.'), speed: 0.5 });
  out.push({ ...step('brushpen', c, 0.95, spline([[170, 300], [280, 360], [440, 380], [590, 350], [700, 340]], 20, living), 'The belly: the same line mirrored. Start at the nose again.'), speed: 0.5 });
  out.push({ ...step('brushpen', c, 0.85, spline([[700, 340], [760, 260], [790, 200]], 12, (t) => 0.7 - 0.5 * t), 'The tail: two flicks that lift to nothing.'), speed: 0.7 });
  out.push({ ...step('brushpen', c, 0.85, spline([[700, 340], [770, 400], [800, 470]], 12, (t) => 0.7 - 0.5 * t)), speed: 0.7 });
  out.push({ ...step('brushpen', c, 0.7, spline([[400, 236], [430, 180], [500, 170]], 10, (t) => 0.65 - 0.45 * t), 'Fins: short living strokes off the body.'), speed: 0.6 });
  out.push({ ...step('brushpen', c, 0.7, spline([[330, 355], [300, 420], [330, 460]], 10, (t) => 0.65 - 0.45 * t)), speed: 0.6 });
  out.push({ ...step('brushpen', c, 0.7, spline([[470, 376], [500, 430], [560, 450]], 10, (t) => 0.65 - 0.45 * t)), speed: 0.6 });
  out.push(step('brushpen', '#1a1c23', 0.7, spline([[230, 284], [238, 280], [242, 288]], 6, flat(0.95)), 'The eye: one heavy dab.'));
  out.push(step('liner', '#7fa0b8', 0.9, arcPts(440, 320, 300, 150, 3.5, 5.9, 20, flat(0.4)), 'Water: two thin arcs around it, barely pressing.'));
  out.push(step('liner', '#7fa0b8', 0.9, arcPts(440, 320, 340, 190, 0.4, 2.7, 20, flat(0.4))));
  return out;
}


// --- 3.4 Feather: the nib's width follows the stroke's direction ------------------
function buildFeather(): LessonStep[] {
  const out: LessonStep[] = [];
  const c = '#2c3e8f';
  const a: XY = [150, 530], b: XY = [660, 100];
  const shaft = (t: number): XY => [a[0] + (b[0] - a[0]) * t + Math.sin(t * Math.PI) * 28, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 18];
  out.push({ ...step('nib', c, 0.8, spline([shaft(0), shaft(0.25), shaft(0.5), shaft(0.75), shaft(1)], 28, bell), 'The shaft: one long pull from the quill to the tip. Where it runs along the nib\'s edge it goes thin, across it goes wide.'), speed: 0.5 });
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  for (let i = 0; i < 6; i++) {
    const t = 0.22 + i * 0.13;
    const [sx, sy] = shaft(t);
    const len = 118 - i * 12;
    for (const side of [-1, 1]) {
      const th = ang + side * (1.15 - i * 0.06);
      const tip: XY = [sx + Math.cos(th) * len, sy + Math.sin(th) * len];
      const mid: XY = [sx + Math.cos(th) * len * 0.5 + Math.cos(ang) * 14, sy + Math.sin(th) * len * 0.5 + Math.sin(ang) * 14];
      out.push({ ...step('nib', c, 0.6, spline([[sx, sy], mid, tip], 10, taperOut), i === 0 && side === -1 ? 'Barbs: short pulls away from the shaft, angled toward the tip. Each side leaves the nib at a different angle, so one side comes out wide and the other thin.' : i === 3 && side === -1 ? 'Keep the pen still in your hand. Only the direction of the stroke changes.' : undefined), speed: 0.65 });
    }
  }
  return out;
}

// --- 4.1 Hand: a blind contour ----------------------------------------------------
function buildHand(): LessonStep[] {
  const c = '#3a3128';
  const s = (pts: XY[], hint?: string): LessonStep => ({ ...step('liner', c, 1.1, spline(pts, 14, flat(0.6)), hint), speed: 0.35 });
  return [
    s([[300, 560], [286, 470], [252, 410], [215, 350], [242, 334], [282, 380], [316, 420]], 'The thumb: start at the wrist and follow the edge with your eye. The pen goes where your eye goes, at the same slow speed.'),
    s([[316, 420], [300, 300], [305, 180], [332, 180], [346, 300], [352, 410]], 'The index finger: up one side, round the tip, down the other. Do not look at the paper.'),
    s([[352, 410], [360, 280], [370, 150], [396, 150], [401, 280], [401, 405]], 'The middle finger, the longest.'),
    s([[401, 405], [410, 290], [420, 175], [446, 178], [451, 290], [451, 410]], 'The ring finger.'),
    s([[451, 410], [466, 320], [480, 240], [503, 250], [501, 330], [495, 430]], 'The little finger, shorter and set lower.'),
    s([[495, 430], [506, 500], [500, 560]], 'Down the outside of the palm to the wrist.'),
    s([[300, 560], [400, 567], [500, 560]], 'The wrist closes it. Now lift, and look.'),
  ];
}

// --- 4.2 Chair: negative space ----------------------------------------------------
const CHAIR: XY[][] = [
  [[330, 120], [470, 120], [470, 330], [330, 330], [330, 120]],
  [[300, 330], [500, 330], [500, 370], [300, 370], [300, 330]],
  [[310, 370], [310, 520]], [[490, 370], [490, 520]],
];
function buildChair(): LessonStep[] {
  const c = '#4b6a8a';
  const band = (pts: XY[], hint?: string): LessonStep => ({ ...step('wash', c, 1.0, spline(pts, 16, flat(0.65)), hint), speed: 0.4 });
  return [
    band([[110, 70], [112, 300], [110, 540]], 'Paint the space, not the chair. Down the left: a flat band from top to bottom.'),
    band([[175, 70], [173, 300], [175, 540]]),
    band([[240, 70], [242, 300], [240, 540]], 'Right up against the chair: the band stops where the wood begins.'),
    band([[300, 85], [400, 84], [500, 85]], 'Above the back: the sky between the two uprights.'),
    band([[560, 70], [558, 300], [560, 540]], 'The right side, the same three bands.'),
    band([[625, 70], [627, 300], [625, 540]]),
    band([[690, 70], [688, 300], [690, 540]]),
    band([[325, 450], [400, 452], [475, 450]], 'Under the seat, between the legs: a short band.'),
    band([[325, 505], [400, 503], [475, 505]]),
    band([[60, 562], [400, 560], [740, 562]], 'The floor. The chair is the paper you never touched.'),
  ];
}

// --- 4.3 Portrait line, upside down -----------------------------------------------
function buildPortrait(): LessonStep[] {
  const c = '#3a3a3a';
  const flip = (pts: XY[]): XY[] => pts.map(([x, y]) => [800 - x, 600 - y]);
  const s = (pts: XY[], hint?: string): LessonStep => ({ ...step('graphite', c, 1.0, spline(flip(pts), 14, flat(0.65)), hint), speed: 0.4 });
  return [
    s([[400, 120], [380, 180], [372, 240], [368, 280], [350, 330], [366, 350]], 'Start with the line at the bottom right and copy its bends exactly. Do not name what it is.'),
    s([[366, 350], [372, 375], [366, 395], [380, 412], [376, 440], [392, 470], [420, 485]], 'The next line: two small bumps and a longer curve. Just shapes.'),
    s([[420, 485], [430, 530], [440, 580]], 'A short, nearly straight line.'),
    s([[400, 120], [470, 95], [540, 120], [580, 200], [575, 290], [550, 360], [520, 420], [500, 470]], 'The big curve. Check how far it is from the edge of the paper, not what it means.'),
    s([[505, 290], [525, 270], [540, 300], [525, 345], [505, 340]], 'A small loop, open on one side.'),
    s([[390, 245], [445, 238]], 'Two short lines that sit inside the big curve.'),
    s([[400, 275], [420, 265], [440, 275]]),
    s([[430, 140], [480, 150], [530, 200]], 'The last line. Then turn it the right way up in your head.'),
  ];
}

// --- 4.4 Cup, from memory ----------------------------------------------------------
function buildCup(): LessonStep[] {
  const c = '#3a3128';
  return [
    { ...step('liner', c, 1.2, ellipsePts(400, 200, 150, 45, 0, 44, flat(0.6)), 'The rim: an ellipse, one pass.'), speed: 0.45 },
    { ...step('liner', c, 1.2, spline([[250, 200], [254, 310], [262, 420]], 10, flat(0.6)), 'The left side, leaning in a little.'), speed: 0.5 },
    { ...step('liner', c, 1.2, spline([[550, 200], [546, 310], [538, 420]], 10, flat(0.6)), 'The right side, the same lean.'), speed: 0.5 },
    { ...step('liner', c, 1.2, arcPts(400, 420, 138, 40, 0, Math.PI, 18, flat(0.6)), 'The base: the bottom half of a flatter ellipse.'), speed: 0.45 },
    { ...step('liner', c, 1.2, spline([[550, 240], [640, 250], [660, 330], [600, 400], [540, 395]], 16, flat(0.6)), 'The handle: a hook off the right side.'), speed: 0.45 },
  ];
}

export const LESSONS: Lesson[] = [
  { id: 'fence', title: 'Fence', subtitle: 'Posts and rails', difficulty: 1, build: buildFence },
  { id: 'waves', title: 'Warm-up waves', subtitle: 'Five strokes, one motion each', difficulty: 1, build: buildWaves },
  { id: 'mountains', title: 'Mountains', subtitle: 'Three ridges, sharp corners', difficulty: 1, build: buildMountains },
  { id: 'kites', title: 'Kite strings', subtitle: 'Start at the dot', difficulty: 1, build: buildKites },
  { id: 'grass', title: 'Grass', subtitle: 'Twelve tapering blades', difficulty: 1, build: buildGrass },
  { id: 'rain', title: 'Rain', subtitle: 'Swelling drops', difficulty: 2, build: buildRain },
  { id: 'leaf', title: 'Leaf', subtitle: 'Wash, outline, veins', difficulty: 1, build: buildLeaf },
  { id: 'bamboo', title: 'Bamboo', subtitle: 'Pressure control with the bristle and nib', difficulty: 2, build: buildBamboo },
  { id: 'reeds', title: 'Reeds', subtitle: 'Long fades', difficulty: 2, build: buildReeds },
  { id: 'dusk', title: 'Hills at dusk', subtitle: 'Flat washes and layered ridges', difficulty: 2, build: buildDusk },
  { id: 'bloom', title: 'Bloom', subtitle: 'Petals, centre, stem and leaves', difficulty: 3, build: buildBloom },
  { id: 'pebbles', title: 'Pebbles', subtitle: 'Ellipses on a plane', difficulty: 2, build: buildPebbles },
  { id: 'vine', title: 'Vine', subtitle: 'S-curves, spirals and loops', difficulty: 2, build: buildVine },
  { id: 'ribbon', title: 'Ribbon', subtitle: 'The chisel edge turning', difficulty: 2, build: buildRibbon },
  { id: 'seabands', title: 'Sea bands', subtitle: 'Nine flat washes and a sun', difficulty: 1, build: buildSeabands },
  { id: 'stones', title: 'Stones', subtitle: 'Pale first, dark after, line last', difficulty: 2, build: buildStones },
  { id: 'moon', title: 'Moon', subtitle: 'Spray, a halo, a charcoal tree', difficulty: 2, build: buildMoon },
  { id: 'cube', title: 'Cube', subtitle: 'Nine edges and three hatched faces', difficulty: 2, build: buildCube },
  { id: 'feather', title: 'Feather', subtitle: 'The nib turned by direction', difficulty: 2, build: buildFeather },
  { id: 'hand', title: 'Hand', subtitle: 'A blind contour', difficulty: 2, build: buildHand },
  { id: 'chair', title: 'Chair', subtitle: 'Painted from the space around it', difficulty: 2, build: buildChair, overlay: CHAIR },
  { id: 'portrait', title: 'Portrait line', subtitle: 'Copied upside down', difficulty: 2, build: buildPortrait },
  { id: 'cup', title: 'Cup', subtitle: 'Drawn from memory', difficulty: 2, build: buildCup },
  { id: 'koi', title: 'Koi', subtitle: 'Ten living lines', difficulty: 3, build: buildKoi },
  ...WASHES,
];

const cache = new Map<string, LessonStep[]>();
export function lessonSteps(lesson: Lesson): LessonStep[] {
  let steps = cache.get(lesson.id);
  if (!steps) { steps = lesson.build(); cache.set(lesson.id, steps); }
  return steps;
}
export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);

/** Visible width of a step's brush in lesson units (for guides and tolerance). */
export function stepWidth(s: LessonStep): number {
  const t = BRUSH_TEMPLATES.find((x) => x.id === s.template);
  const weight = t?.spec.weight ?? 20;
  return Math.max(3, Math.min(48, weight * s.size * 0.5));
}

/** Hint shown for step i: its own, or the closest earlier one. */
export function stepHint(steps: LessonStep[], i: number): string {
  for (let k = i; k >= 0; k--) if (steps[k].hint) return steps[k].hint!;
  return 'Trace the highlighted stroke.';
}
