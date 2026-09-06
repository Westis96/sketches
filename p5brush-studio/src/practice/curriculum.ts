/**
 * The curriculum: skills, levels, missions, trainers and the warm-up. A mission
 * teaches one skill with one brush in three parts (trainer → guided piece →
 * perform). Pieces are the traced drawings in `lessons.ts`; trainers are
 * generators that lay strokes out in a grid with fresh random positions every
 * run. Everything is declared here so the Path can show the whole shape of the
 * course, including missions whose piece is not built yet.
 */
import type React from 'react';
import type { Point } from '@/engine/records';
import { LESSONS, lessonById } from './lessons';
import { bell, flat, frame, spline, taperOut, type Profile, type XY } from './geometry';
import type { Dim } from './score';

export type SkillId = 'line' | 'confidence' | 'startstop' | 'pressure' | 'speed' | 'direction' | 'shape' | 'seeing' | 'repetition' | 'layering' | 'composition';
export const SKILLS: Record<SkillId, { name: string; blurb: string; dim: Dim }> = {
  line: { name: 'Line', blurb: 'A steady pull that lands where intended', dim: 'shape' },
  confidence: { name: 'Confidence', blurb: 'One pull, no hesitation, rehearsed first', dim: 'confidence' },
  startstop: { name: 'Start and stop', blurb: 'Tapering in and lifting off', dim: 'pressure' },
  pressure: { name: 'Pressure', blurb: 'Sustain, swell and fade along the stroke', dim: 'pressure' },
  speed: { name: 'Speed', blurb: 'Even speed; flick or pull on purpose', dim: 'speed' },
  direction: { name: 'Direction and angle', blurb: 'Stroke direction and pen lean change the mark', dim: 'direction' },
  shape: { name: 'Shape', blurb: 'Circles, ellipses, S-curves, loops that close', dim: 'shape' },
  seeing: { name: 'Seeing', blurb: 'The shape in front of you, not the symbol in your head', dim: 'shape' },
  repetition: { name: 'Repetition', blurb: 'Parallel strokes, hatching, even rhythm', dim: 'shape' },
  layering: { name: 'Layering', blurb: 'Order and overlap: light before dark', dim: 'pressure' },
  composition: { name: 'Composition', blurb: 'A whole piece with a brush you chose', dim: 'shape' },
};

export type Part = 'trainer' | 'guided' | 'perform';
export type Tier = 'full' | 'light' | 'dots' | 'blind';
export const TIERS: Tier[] = ['full', 'light', 'dots', 'blind'];
export const TIER_LABEL: Record<Tier, string> = { full: 'Full guide', light: 'Centreline', dots: 'Dots only', blind: 'Blind' };

export interface Mission {
  id: string;            // "1.2"
  level: number;
  title: string;         // skill in the user's words: "Curves and waves"
  skill: SkillId;
  brush: string;         // template id
  brushLabel?: string;   // when two brushes are used
  piece?: string;        // lesson id in LESSONS
  trainer?: string;      // trainer id
  about: string;         // one line
  kind: 'trace' | 'seeing' | 'free';
  /** The piece is not built yet: shown on the Path, not playable. */
  planned?: boolean;
}

export interface Level { n: number; theme: string; blurb: string; missions: Mission[] }
/** CSS variables of a level's colour and its bottom edge, for `style`. */
export const levelVars = (n: number) => ({ '--lvl': `var(--lvl-${n})`, '--lvl-deep': `var(--lvl-${n}-deep)` }) as React.CSSProperties;

const m = (id: string, title: string, skill: SkillId, brush: string, about: string, o: Partial<Mission> = {}): Mission =>
  ({ id, level: +id.split('.')[0], title, skill, brush, about, kind: 'trace', ...o });

export const LEVELS: Level[] = [
  { n: 0, theme: 'Hold the pen', blurb: 'Three strokes to meet the brush.', missions: [
    m('0.1', 'Three strokes', 'line', 'liner', 'Pull a line, draw a curve, press and release. Three minutes.', { trainer: 'hold' }),
  ] },
  { n: 1, theme: 'Lines', blurb: 'Straight, curved, cornered, and always from the dot.', missions: [
    m('1.1', 'Dot to dot', 'confidence', 'liner', 'Two dots, one pull. Ghost it in the air first.', { trainer: 'lines', piece: 'fence' }),
    m('1.2', 'Curves and waves', 'line', 'liner', 'One smooth arc, then a wave without stopping.', { trainer: 'curves', piece: 'waves' }),
    m('1.3', 'Corners', 'line', 'graphite', 'Stop, change direction, go. Corners stay sharp.', { trainer: 'corners', piece: 'mountains' }),
    m('1.4', 'Start at the dot', 'direction', 'liner', 'Every stroke has a beginning. Go the way the arrow points.', { trainer: 'directions', piece: 'kites' }),
  ] },
  { n: 2, theme: 'Pressure', blurb: 'Taper, swell, thick and thin, fade.', missions: [
    m('2.1', 'Taper out', 'startstop', 'bristle', 'Press at the root, lift as you go: the bristles fade.', { trainer: 'taper', piece: 'grass' }),
    m('2.2', 'Swell', 'pressure', 'nib', 'Light in, heavy in the middle, light out.', { trainer: 'swell', piece: 'rain' }),
    m('2.3', 'Thick and thin', 'pressure', 'nib', 'The nib is a pressure instrument. Press at both ends, ease off between.', { trainer: 'thickthin', piece: 'bamboo' }),
    m('2.4', 'Fade and lift', 'startstop', 'bristle', 'A long stroke that disappears at the tip.', { trainer: 'fade', piece: 'reeds' }),
  ] },
  { n: 3, theme: 'Shape and direction', blurb: 'Ellipses, S-curves, and what the tip does when you turn it.', missions: [
    m('3.1', 'Ellipses in planes', 'shape', 'graphite', 'Round, closed, and inside the box.', { trainer: 'ellipses', piece: 'pebbles', planned: true }),
    m('3.2', 'S-curves and spirals', 'shape', 'liner', 'Two bends in one motion.', { trainer: 'scurves', piece: 'vine', planned: true }),
    m('3.3', 'The angled tip', 'direction', 'chisel', 'The chisel changes width with direction. Use it.', { trainer: 'chiselangles', piece: 'ribbon', planned: true }),
    m('3.4', 'Lean and roll', 'direction', 'nib', 'Barrel roll and tilt turn the nib.', { trainer: 'curves', piece: 'feather', planned: true }),
    m('3.5', 'Outline over wash', 'layering', 'wash', 'Wet first, then one clean line around it.', { trainer: 'curves', piece: 'leaf', brushLabel: 'wash + liner' }),
  ] },
  { n: 4, theme: 'Seeing', blurb: 'Draw what is there, not what you know. None of this is tracing.', missions: [
    m('4.1', 'Blind contour', 'seeing', 'liner', 'The ink is hidden until you lift. Look at the subject, not the page.', { piece: 'hand', kind: 'seeing', planned: true }),
    m('4.2', 'Negative space', 'seeing', 'wash', 'Paint the space around it.', { piece: 'chair', kind: 'seeing', planned: true }),
    m('4.3', 'Upside-down copy', 'seeing', 'graphite', 'The reference is flipped. Draw the lines you see.', { piece: 'portrait', kind: 'seeing', planned: true }),
    m('4.4', 'From memory', 'seeing', 'liner', 'Ten seconds to look. Then it is gone.', { piece: 'cup', kind: 'seeing', planned: true }),
  ] },
  { n: 5, theme: 'Value and layering', blurb: 'Washes, order, soft edges and rhythm.', missions: [
    m('5.1', 'Flat bands', 'layering', 'wash', 'Edge to edge, even pressure, no stopping.', { trainer: 'bands', piece: 'seabands', planned: true }),
    m('5.2', 'Light before dark', 'layering', 'wash', 'Order matters: the pale wash goes down first.', { trainer: 'bands', piece: 'stones', planned: true }),
    m('5.3', 'Spray and soft edges', 'speed', 'spray', 'Speed gives the spray its edge.', { trainer: 'ellipses', piece: 'moon', planned: true }),
    m('5.4', 'Hatching rhythm', 'repetition', 'ballpoint', 'Parallel, evenly spaced, same speed.', { trainer: 'hatching', piece: 'cube', planned: true }),
    m('5.5', 'Layered ridges', 'layering', 'bristle', 'Far to near, light to dark.', { trainer: 'curves', piece: 'dusk' }),
  ] },
  { n: 6, theme: 'Compose', blurb: 'Whole pieces, your brush, a reference beside you.', missions: [
    m('6.1', 'Petals and centre', 'composition', 'wash', 'A flower from the centre out.', { trainer: 'curves', piece: 'bloom', brushLabel: 'wash + chisel' }),
    m('6.2', 'Living line', 'composition', 'brushpen', 'One line that thickens and thins as it moves.', { trainer: 'scurves', piece: 'koi', planned: true }),
    m('6.3', 'From a reference', 'composition', 'liner', 'No guide. Your brush. Match the silhouette.', { piece: 'teacup', kind: 'free', planned: true }),
    m('6.4', 'Piece of the week', 'composition', 'liner', 'One piece for everyone, best score kept per week.', { planned: true }),
  ] },
];

export const MISSIONS: Mission[] = LEVELS.flatMap((l) => l.missions);
export const missionById = (id: string) => MISSIONS.find((x) => x.id === id);
export const missionForPiece = (pieceId: string) => MISSIONS.find((x) => x.piece === pieceId);
export const levelOf = (mission: Mission) => LEVELS.find((l) => l.n === mission.level)!;
export const capstoneOf = (level: Level) => [...level.missions].reverse().find((x) => x.piece && !x.planned) ?? null;
/** A mission the user can start today: not planned, and its piece (if any) exists. */
export const isPlayable = (x: Mission) => !x.planned && (!x.piece || !!lessonById(x.piece)) && (!!x.trainer || !!x.piece);
/** The parts a mission has, in order. */
export const partsOf = (x: Mission): Part[] => x.piece ? (x.trainer ? ['trainer', 'guided', 'perform'] : ['guided', 'perform']) : ['trainer'];

// ---------------------------------------------------------------------------
// Trainers: generated drills
// ---------------------------------------------------------------------------
export interface TrainerRep {
  points: Point[];
  template: string;
  color: string;
  size: number;
  /** Target speed in lesson units per ms. */
  speed: number;
  hint?: string;
}
export interface Trainer {
  id: string;
  title: string;
  hint: string;
  reps: number;
  /** Where the guide starts for this drill. */
  tier: Tier;
  /** The dimension the drill is about (weighted at half the score). */
  focus: Dim;
  template: string;
  color: string;
  size: number;
  speed: number;
  /** Builds one rep inside a cell (x, y, w, h) of the lesson box. */
  gen: (cell: Cell, rng: Rng, i: number) => Point[];
}
export interface Cell { x: number; y: number; w: number; h: number }
export type Rng = () => number;

/** Deterministic rng (mulberry32) so a run can be replayed from its seed. */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BOX = { w: 800, h: 600 };
const between = (r: Rng, a: number, b: number) => a + (b - a) * r();

/** Cells for `n` reps that tile the box, roughly square, with a margin. */
export function cellsFor(n: number, margin = 22): Cell[] {
  const cols = Math.max(1, Math.round(Math.sqrt((n * BOX.w) / BOX.h)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const w = (BOX.w - margin * 2) / cols, h = (BOX.h - margin * 2) / rows;
  const out: Cell[] = [];
  for (let i = 0; i < n; i++) out.push({ x: margin + (i % cols) * w + 6, y: margin + Math.floor(i / cols) * h + 6, w: w - 12, h: h - 12 });
  return out;
}

const lineIn = (c: Cell, r: Rng, angleSpread: number, prof: Profile = flat(0.6)): Point[] => {
  const a = between(r, -angleSpread, angleSpread);
  const len = Math.min(c.w, c.h) * between(r, 0.7, 0.95);
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  const R = frame(cx, cy, a);
  return spline([R(-len / 2, 0), R(0, 0), R(len / 2, 0)], 12, prof);
};
const curveIn = (c: Cell, r: Rng, prof: Profile = flat(0.6)): Point[] => {
  const len = Math.min(c.w, c.h) * between(r, 0.75, 0.95);
  const bulge = len * between(r, 0.18, 0.32) * (r() < 0.5 ? -1 : 1);
  const a = between(r, -0.5, 0.5);
  const R = frame(c.x + c.w / 2, c.y + c.h / 2, a);
  return spline([R(-len / 2, 0), R(0, bulge), R(len / 2, 0)], 14, prof);
};
const waveIn = (c: Cell, r: Rng, prof: Profile = flat(0.6)): Point[] => {
  const w = c.w * 0.9, amp = Math.min(c.h * 0.22, w * 0.18) * between(r, 0.7, 1);
  const x0 = c.x + (c.w - w) / 2, y = c.y + c.h / 2;
  const s = r() < 0.5 ? 1 : -1;
  return spline([[x0, y], [x0 + w * 0.25, y - amp * s], [x0 + w * 0.5, y], [x0 + w * 0.75, y + amp * s], [x0 + w, y]], 10, prof);
};
const zigzagIn = (c: Cell, r: Rng): Point[] => {
  const w = c.w * 0.9, amp = Math.min(c.h * 0.28, 60) * between(r, 0.7, 1);
  const x0 = c.x + (c.w - w) / 2, y = c.y + c.h / 2;
  const pts: XY[] = [];
  const n = 4;
  for (let i = 0; i <= n; i++) pts.push([x0 + (w * i) / n, y + (i % 2 ? -amp : amp)]);
  return spline(pts, 8, flat(0.65));
};
const ellipseIn = (c: Cell, r: Rng): Point[] => {
  const rx = Math.min(c.w, c.h) * between(r, 0.28, 0.42), ry = rx * between(r, 0.45, 0.95);
  const rot = between(r, -0.6, 0.6), cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  const R = frame(cx, cy, rot);
  const out: Point[] = [];
  const n = 40;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; const [x, y] = R(Math.cos(a) * rx, Math.sin(a) * ry); out.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, p: 0.6 }); }
  return out;
};
const scurveIn = (c: Cell, r: Rng): Point[] => {
  const h = c.h * 0.85, w = Math.min(c.w * 0.5, h * 0.45) * between(r, 0.7, 1);
  const x = c.x + c.w / 2, y0 = c.y + (c.h - h) / 2;
  const s = r() < 0.5 ? 1 : -1;
  return spline([[x, y0], [x + w * s, y0 + h * 0.3], [x - w * s, y0 + h * 0.7], [x, y0 + h]], 12, flat(0.6));
};
const hatchIn = (c: Cell, r: Rng): Point[] => lineIn(c, r, 0.25, flat(0.55));

const T = (t: Omit<Trainer, 'gen'> & { gen: Trainer['gen'] }): Trainer => t;
export const TRAINERS: Record<string, Trainer> = {
  hold: T({ id: 'hold', title: 'Three strokes', hint: 'A line, a curve, then press and release. Nothing to get right yet.', reps: 3, tier: 'light', focus: 'shape', template: 'liner', color: '#1a1c23', size: 1.3, speed: 0.45,
    gen: (c, r, i) => (i === 0 ? lineIn(c, r, 0.2) : i === 1 ? curveIn(c, r) : lineIn(c, r, 0.2, bell)) }),
  lines: T({ id: 'lines', title: 'Dot to dot', hint: 'Two dots. Ghost the line in the air twice, then one pull.', reps: 10, tier: 'dots', focus: 'confidence', template: 'liner', color: '#1a1c23', size: 1.3, speed: 0.7,
    gen: (c, r) => lineIn(c, r, 0.9) }),
  curves: T({ id: 'curves', title: 'Arcs', hint: 'One smooth arc from dot to dot. Let the elbow do it.', reps: 8, tier: 'light', focus: 'shape', template: 'liner', color: '#1a1c23', size: 1.3, speed: 0.5,
    gen: (c, r) => curveIn(c, r) }),
  corners: T({ id: 'corners', title: 'Zigzags', hint: 'Stop at each corner, then go. The corners stay sharp.', reps: 8, tier: 'light', focus: 'shape', template: 'graphite', color: '#4d4d4d', size: 1.0, speed: 0.5,
    gen: (c, r) => zigzagIn(c, r) }),
  directions: T({ id: 'directions', title: 'Every which way', hint: 'Start at the dot and go the way the arrow points.', reps: 10, tier: 'dots', focus: 'direction', template: 'liner', color: '#1a1c23', size: 1.3, speed: 0.65,
    gen: (c, r) => lineIn(c, r, Math.PI) }),
  taper: T({ id: 'taper', title: 'Taper out', hint: 'Press at the start and lift as you go, so the end disappears.', reps: 10, tier: 'light', focus: 'pressure', template: 'bristle', color: '#3f6b3a', size: 1.0, speed: 0.6,
    gen: (c, r) => lineIn(c, r, 0.6, taperOut) }),
  swell: T({ id: 'swell', title: 'Swell', hint: 'Light in, heavy in the middle, light out.', reps: 8, tier: 'light', focus: 'pressure', template: 'nib', color: '#2c3e8f', size: 0.6, speed: 0.4,
    gen: (c, r) => lineIn(c, r, 0.9, bell) }),
  thickthin: T({ id: 'thickthin', title: 'Thick and thin', hint: 'Heavy at both ends, light between: a bamboo segment.', reps: 8, tier: 'light', focus: 'pressure', template: 'nib', color: '#2f5a33', size: 0.6, speed: 0.45,
    gen: (c, r) => lineIn(c, r, 0.4, (t) => 0.95 - 0.5 * Math.sin(t * Math.PI)) }),
  fade: T({ id: 'fade', title: 'Fade and lift', hint: 'A long pull that fades to nothing at the tip.', reps: 8, tier: 'light', focus: 'pressure', template: 'bristle', color: '#3f6b3a', size: 1.2, speed: 0.5,
    gen: (c, r) => curveIn(c, r, taperOut) }),
  ellipses: T({ id: 'ellipses', title: 'Ellipses', hint: 'Round it twice in the air, then one pass. Close the loop.', reps: 10, tier: 'light', focus: 'shape', template: 'graphite', color: '#4d4d4d', size: 1.0, speed: 0.45,
    gen: (c, r) => ellipseIn(c, r) }),
  scurves: T({ id: 'scurves', title: 'S-curves', hint: 'Two bends in one motion.', reps: 8, tier: 'light', focus: 'shape', template: 'liner', color: '#1a1c23', size: 1.3, speed: 0.45,
    gen: (c, r) => scurveIn(c, r) }),
  chiselangles: T({ id: 'chiselangles', title: 'Angled tip', hint: 'Same stroke, different directions: watch the width change.', reps: 8, tier: 'light', focus: 'shape', template: 'chisel', color: '#c9407c', size: 0.8, speed: 0.5,
    gen: (c, r) => lineIn(c, r, Math.PI) }),
  bands: T({ id: 'bands', title: 'Flat bands', hint: 'Edge to edge, even pressure, no stopping.', reps: 6, tier: 'light', focus: 'pressure', template: 'wash', color: '#7aa6c2', size: 1.2, speed: 0.4,
    gen: (c, r) => lineIn(c, r, 0.08, flat(0.65)) }),
  hatching: T({ id: 'hatching', title: 'Hatching', hint: 'Short parallel lines, same spacing, same speed.', reps: 12, tier: 'dots', focus: 'shape', template: 'ballpoint', color: '#1a1c23', size: 1.0, speed: 0.7,
    gen: (c, r) => hatchIn(c, r) }),
  waves: T({ id: 'waves', title: 'Waves', hint: 'A wave without stopping.', reps: 6, tier: 'light', focus: 'shape', template: 'liner', color: '#1a1c23', size: 1.3, speed: 0.45,
    gen: (c, r) => waveIn(c, r) }),
};

/** Builds the reps of a trainer for a run seed. */
export function trainerReps(t: Trainer, seed: number): TrainerRep[] {
  const r = rng(seed);
  const cells = cellsFor(t.reps);
  return cells.map((c, i) => ({ points: t.gen(c, r, i), template: t.template, color: t.color, size: t.size, speed: t.speed, hint: i === 0 ? t.hint : undefined }));
}

/** The warm-up: the Han / Drawabox set, three to five minutes. */
export const WARMUP: Array<{ trainer: string; reps: number }> = [
  { trainer: 'lines', reps: 8 }, { trainer: 'curves', reps: 6 }, { trainer: 'ellipses', reps: 6 }, { trainer: 'waves', reps: 4 },
];
export function warmupReps(seed: number): TrainerRep[] {
  const total = WARMUP.reduce((a, w) => a + w.reps, 0);
  const cells = cellsFor(total);
  const r = rng(seed);
  const out: TrainerRep[] = [];
  let k = 0;
  for (const w of WARMUP) {
    const t = TRAINERS[w.trainer];
    for (let i = 0; i < w.reps; i++, k++) out.push({ points: t.gen(cells[k], r, i), template: t.template, color: t.color, size: t.size, speed: t.speed, hint: i === 0 ? `${t.title}: ${t.hint}` : undefined });
  }
  return out;
}

/** Levels the user should see as "in progress" first: the first level with an unplayed playable mission. */
export function nextMission(done: (id: string) => boolean): Mission | null {
  for (const l of LEVELS) for (const x of l.missions) if (isPlayable(x) && !done(x.id)) return x;
  return null;
}

/** Missions open in order inside a level; the first of each level is always open. */
export function isLocked(x: Mission, done: (id: string) => boolean): boolean {
  const lvl = levelOf(x);
  const i = lvl.missions.indexOf(x);
  for (let k = 0; k < i; k++) { const prev = lvl.missions[k]; if (isPlayable(prev) && !done(prev.id)) return true; }
  return false;
}

export { LESSONS };
