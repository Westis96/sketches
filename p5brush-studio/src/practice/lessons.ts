/**
 * Practice lessons: sample drawings the user traces step by step. Each step is
 * one reference stroke with the brush it was made with, in lesson space
 * (an 800×600 box that the studio places at the world origin and zooms to fit).
 * Lessons are built lazily and cached; the geometry is fully deterministic.
 */
import type { Point } from '@/engine/records';
import { BRUSH_TEMPLATES } from '@/engine/templates';
import { bell, circle, flat, frame, spline, taperIn, taperOut, type Profile, type XY } from './geometry';

export interface LessonStep {
  /** Template id from BRUSH_TEMPLATES. */
  template: string;
  color: string;
  size: number;
  points: Point[];
  /** Coaching line for the step card; falls back to the previous step's hint. */
  hint?: string;
}

export interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  difficulty: 1 | 2 | 3;
  build: () => LessonStep[];
}

export const LESSON_BOX = { w: 800, h: 600 };

const step = (template: string, color: string, size: number, points: Point[], hint?: string): LessonStep => ({ template, color, size, points, hint });

// --- Warm-up: waves -----------------------------------------------------------
function buildWaves(): LessonStep[] {
  const wave = (y: number, amp: number): XY[] => [[90, y], [250, y - amp], [400, y], [550, y + amp], [710, y]];
  return [
    step('liner', '#1a1c23', 1.3, spline(wave(180, 60), 20, flat(0.6)), 'One smooth pull from left to right. Speed matters more than precision.'),
    step('nib', '#2c3e8f', 0.55, spline(wave(280, 60), 20, bell), 'Same wave, now press harder in the middle and ease off at both ends.'),
    step('chisel', '#c9407c', 0.8, spline(wave(380, 60), 20, flat(0.7)), 'The chisel tip is angled: notice how the width changes with direction.'),
    step('graphite', '#4d4d4d', 1.0, spline([[90, 470], [170, 440], [250, 500], [330, 440], [410, 500], [490, 440], [570, 500], [650, 440], [710, 470]], 12, flat(0.65)), 'A quick zigzag. Keep the corners sharp.'),
    step('bristle', '#3f6b3a', 1.0, spline([[90, 545], [400, 540], [710, 545]], 30, taperOut), 'Start firm and lift off gently, so the bristles fade out.'),
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

export const LESSONS: Lesson[] = [
  { id: 'waves', title: 'Warm-up waves', subtitle: 'Five strokes, five brushes', difficulty: 1, build: buildWaves },
  { id: 'leaf', title: 'Leaf', subtitle: 'Wash, outline, veins', difficulty: 1, build: buildLeaf },
  { id: 'bamboo', title: 'Bamboo', subtitle: 'Pressure control with the bristle and nib', difficulty: 2, build: buildBamboo },
  { id: 'dusk', title: 'Hills at dusk', subtitle: 'Flat washes and layered ridges', difficulty: 2, build: buildDusk },
  { id: 'bloom', title: 'Bloom', subtitle: 'Petals, centre, stem and leaves', difficulty: 3, build: buildBloom },
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
