/**
 * The curriculum: skills, levels, missions, trainers and the warm-up. A mission
 * teaches one skill with one brush in three parts (trainer → guided piece →
 * perform). Pieces are the traced drawings in `lessons.ts`; trainers are
 * generators that lay strokes out in a grid with fresh random positions every
 * run. Everything is declared here so the Path can show the whole shape of the
 * course, including missions whose piece is not built yet.
 */
import type React from 'react';
import type { Point, ShapeStyle } from '@/engine/records';
import { LESSONS, lessonById } from './lessons';
import { bell, flat, frame, poly, spline, taperOut, type Profile, type XY } from './geometry';
import type { Dim } from './score';
import { hasLesson } from './teach';

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

/** The parts of a mission, in order: the lesson (slides + demos), the drill, the guided piece, the performance. */
export type Part = 'teach' | 'trainer' | 'guided' | 'perform';
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
  /** How a seeing mission changes the session: ink hidden until lift, a silhouette to paint around, a flipped reference, or a ten-second look. */
  seeing?: Seeing;
  /** The piece is not built yet: shown on the Path, not playable. */
  planned?: boolean;
}
export type Seeing = 'blind' | 'negative' | 'flipped' | 'memory';
/** How long the reference stays up in a memory mission. */
export const MEMORY_MS = 10000;

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
    m('3.1', 'Ellipses in planes', 'shape', 'graphite', 'Round, closed, and inside the box.', { trainer: 'ellipses', piece: 'pebbles' }),
    m('3.2', 'S-curves and spirals', 'shape', 'liner', 'Two bends in one motion.', { trainer: 'scurves', piece: 'vine' }),
    m('3.3', 'The angled tip', 'direction', 'chisel', 'The chisel changes width with direction. Use it.', { trainer: 'chiselangles', piece: 'ribbon' }),
    m('3.4', 'Turn the nib', 'direction', 'nib', 'Wide across its edge, thin along it. Turn the stroke, not the pen.', { trainer: 'nibangles', piece: 'feather' }),
    m('3.5', 'Outline over wash', 'layering', 'wash', 'Wet first, then one clean line around it.', { trainer: 'sweeps', piece: 'leaf', brushLabel: 'wash + liner' }),
  ] },
  { n: 4, theme: 'Seeing', blurb: 'Draw what is there, not what you know. None of this is tracing.', missions: [
    m('4.1', 'Blind contour', 'seeing', 'liner', 'The ink is hidden until you lift. Look at the subject, not the page.', { piece: 'hand', kind: 'seeing', seeing: 'blind' }),
    m('4.2', 'Negative space', 'seeing', 'wash', 'Paint the space around it. The chair appears on its own.', { piece: 'chair', kind: 'seeing', seeing: 'negative' }),
    m('4.3', 'Upside-down copy', 'seeing', 'graphite', 'The reference is flipped. Draw the lines you see, not the face you know.', { piece: 'portrait', kind: 'seeing', seeing: 'flipped' }),
    m('4.4', 'From memory', 'seeing', 'liner', 'Ten seconds to look. Then it is gone.', { piece: 'cup', kind: 'seeing', seeing: 'memory' }),
  ] },
  { n: 5, theme: 'Value and layering', blurb: 'Washes, order, soft edges and rhythm.', missions: [
    m('5.1', 'Flat bands', 'layering', 'wash', 'Edge to edge, even pressure, no stopping.', { trainer: 'bands', piece: 'seabands' }),
    m('5.2', 'Light before dark', 'layering', 'wash', 'Order matters: the pale wash goes down first.', { trainer: 'paledark', piece: 'stones' }),
    m('5.3', 'Spray and soft edges', 'speed', 'spray', 'Passes build the tone; rings build a glow.', { trainer: 'sprayrings', piece: 'moon' }),
    m('5.4', 'Hatching rhythm', 'repetition', 'ballpoint', 'Parallel, evenly spaced, same speed.', { trainer: 'hatching', piece: 'cube' }),
    m('5.5', 'Layered ridges', 'layering', 'bristle', 'Far to near, light to dark.', { trainer: 'ridges', piece: 'dusk' }),
  ] },
  { n: 6, theme: 'Compose', blurb: 'Whole pieces, your brush, a reference beside you.', missions: [
    m('6.1', 'Petals and centre', 'composition', 'wash', 'A flower from the centre out.', { trainer: 'petals', piece: 'bloom', brushLabel: 'wash + chisel' }),
    m('6.2', 'Living line', 'composition', 'brushpen', 'One line that thickens and thins as it moves.', { trainer: 'livinglines', piece: 'koi' }),
    m('6.3', 'From a reference', 'composition', 'liner', 'No guide. Your brush. Match the silhouette.', { piece: 'teacup', kind: 'free', planned: true }),
    m('6.4', 'Piece of the week', 'composition', 'liner', 'One piece for everyone, best score kept per week.', { planned: true }),
  ] },
  { n: 7, theme: 'Washes I', blurb: 'The Sixteen Washes, first eight: fills that bleed, flat washes, massed charcoal, and the page’s own pens.', missions: [
    m('7.1', 'Red Fuji', 'layering', 'pen', 'Sky, mountain, shadow and cloud as bleeding fills; the snow laid back in as paper-coloured wash; pen birds last.', { trainer: 'blobs', piece: 'fuji', brushLabel: 'fills + wash + pen' }),
    m('7.2', 'Lantern Night', 'layering', 'pen', 'A plum night, a rose horizon, and three lanterns: glow, body, highlight, hoops, cap, foot and tassel.', { trainer: 'glows', piece: 'lanterns', brushLabel: 'fills + wash + 2H + 2B' }),
    m('7.3', 'Bamboo', 'pressure', 'culm', 'Culms in square-ended segments with the flat tip; every leaf one thin-wide-point sweep of the blade.', { trainer: 'blades', piece: 'grove', brushLabel: 'culm + leaf + 2B' }),
    m('7.4', 'Six Persimmons', 'shape', 'softpencil', 'After Mu Qi: six rounds, each filled a different way, from massed charcoal to a bare outline.', { trainer: 'inks', piece: 'persimmons', brushLabel: 'charcoal + crayon + wash + 2B' }),
    m('7.5', 'Mandala', 'repetition', 'petal', 'Twelve folds of three petal strokes each, round a gold centre that bleeds.', { trainer: 'petalmarks', piece: 'mandala', brushLabel: 'petal + 2H' }),
    m('7.6', 'Koi Pond', 'composition', 'pen', 'Three koi as bleeding fills in a pale pond, with hard-pencil ripples that sway.', { trainer: 'blobs', piece: 'pond', brushLabel: 'fills + 2H' }),
    m('7.7', 'Harvest Moon', 'layering', 'pen', 'A near-flat indigo square, a moon that bleeds, four pen clouds.', { trainer: 'blobs', piece: 'harvest', brushLabel: 'fills + pen' }),
    m('7.8', 'Seabed Star', 'shape', 'cpencil', 'Five wedges of wash from the centre, veined in coloured pencil.', { trainer: 'wedges', piece: 'seastar', brushLabel: 'fills + cpencil + 2B' }),
  ] },
  { n: 8, theme: 'Washes II', blurb: 'The Sixteen Washes, second eight: poppies, ridges, a hatched vase, wheat, a sun, wind, a jellyfish and a leaf.', missions: [
    m('8.1', 'Poppies', 'composition', 'pen', 'Wobbling pen stems, then heads as red bleeds with a darker heart and a black wash centre.', { trainer: 'blobs', piece: 'poppies', brushLabel: 'pen + fills + wash' }),
    m('8.2', 'Ridge', 'layering', 'pen', 'Three jagged ridgelines, each a darker wash bleeding out over the last.', { trainer: 'ridgefills', piece: 'ridge', brushLabel: 'three fills' }),
    m('8.3', 'Marigold Vase', 'repetition', 'pen', 'A vase that hatches itself with a gradient, holding three marigolds on pencil stems.', { trainer: 'hatchfills', piece: 'vase', brushLabel: 'fill + rotring hatch + 2B' }),
    m('8.4', 'Wheat', 'repetition', 'softpencil', 'Fourteen soft-pencil stalks with a hand wobble, a spray head on each.', { trainer: 'stalks', piece: 'wheat', brushLabel: '2B + spray + charcoal' }),
    m('8.5', 'Sun', 'direction', 'softpencil', 'Two stacked warm bleeds and sixteen pencil rays.', { trainer: 'rays', piece: 'sun', brushLabel: 'fills + 2B' }),
    m('8.6', 'Trade Winds', 'line', 'hardpencil', 'Streaks released into a noise field, in two blues over a pale sky.', { trainer: 'streaks', piece: 'winds', brushLabel: 'fill + 2H + pen' }),
    m('8.7', 'Jellyfish', 'shape', 'pen', 'A lilac bell with rounded corners over a deeper dome, trailing pen tentacles.', { trainer: 'blobs', piece: 'jelly', brushLabel: 'fills + pen + 2H' }),
    m('8.8', 'Leaf', 'shape', 'cpencil', 'One leaf of green wash, a midrib and six pairs of pencil veins.', { trainer: 'ticks', piece: 'washleaf', brushLabel: 'fill + cpencil' }),
  ] },
];

export const MISSIONS: Mission[] = LEVELS.flatMap((l) => l.missions);
export const missionById = (id: string) => MISSIONS.find((x) => x.id === id);
export const missionForPiece = (pieceId: string) => MISSIONS.find((x) => x.piece === pieceId);
export const levelOf = (mission: Mission) => LEVELS.find((l) => l.n === mission.level)!;
export const capstoneOf = (level: Level) => [...level.missions].reverse().find((x) => x.piece && !x.planned) ?? null;
/** A mission the user can start today: not planned, and its piece (if any) exists. */
export const isPlayable = (x: Mission) => !x.planned && (!x.piece || !!lessonById(x.piece)) && (!!x.trainer || !!x.piece);
/** The parts a mission has, in order; the lesson comes first when the mission has one. */
export const partsOf = (x: Mission): Part[] => {
  const play: Part[] = x.piece ? (x.trainer ? ['trainer', 'guided', 'perform'] : ['guided', 'perform']) : ['trainer'];
  return hasLesson(x.id) ? ['teach', ...play] : play;
};
/** The parts that are played (scored), without the lesson. */
export const playedParts = (x: Mission): Part[] => partsOf(x).filter((p) => p !== 'teach');

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
  /** A filled shape: the rep is traced as its outline. */
  shape?: ShapeStyle;
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
  /** Superimposed reps: each generated stroke is drawn this many times over itself (Drawabox's superimposed lines). */
  group?: number;
  /** Hint for the repeats inside a group. */
  againHint?: string;
  /** Colour per repeat inside a group (the layering drill: pale, then dark over it). */
  colors?: string[];
  /** Shape drills: the style each rep lands as, cycling by rep index (null = the rep stays a stroke). */
  shapes?: Array<ShapeStyle | null>;
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
const scurveIn = (c: Cell, r: Rng, prof: Profile = flat(0.6)): Point[] => {
  const h = c.h * 0.85, w = Math.min(c.w * 0.5, h * 0.45) * between(r, 0.7, 1);
  const x = c.x + c.w / 2, y0 = c.y + (c.h - h) / 2;
  const s = r() < 0.5 ? 1 : -1;
  return spline([[x, y0], [x + w * s, y0 + h * 0.3], [x - w * s, y0 + h * 0.7], [x, y0 + h]], 12, prof);
};
const circleIn = (c: Cell, r: Rng): Point[] => {
  const rad = Math.min(c.w, c.h) * between(r, 0.26, 0.4), cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  const out: Point[] = [];
  const n = 40;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; out.push({ x: Math.round((cx + Math.cos(a) * rad) * 100) / 100, y: Math.round((cy + Math.sin(a) * rad) * 100) / 100, p: 0.6 }); }
  return out;
};
/** A petal sweep: from a point near the cell's foot, out and up, swelling then lifting to nothing. */
const petalIn = (c: Cell, r: Rng): Point[] => {
  const len = Math.min(c.w, c.h) * between(r, 0.7, 0.9);
  const a = between(r, -1.15, -0.45) - Math.PI / 4;
  const R = frame(c.x + c.w / 2, c.y + c.h / 2, a);
  const bulge = len * between(r, 0.1, 0.2);
  return spline([R(-len / 2, 0), R(0, bulge), R(len / 2, 0)], 16, petal);
};
/** A fill style for shape drills. */
const FILL = (color: string, opacity: number, amount: number, dir: 'in' | 'out', strength: number, border: number): ShapeStyle => ({ kind: 'fill', color, opacity, bleed: { amount, dir }, texture: { strength, border } });
/** Weight through the middle, lifting away to nothing at the tip. */
const petal: Profile = (t) => 0.3 + 0.65 * Math.sin(t * Math.PI) * (1 - 0.35 * t);
/** Thin in, weight through the body, thin out: the living line. */
const living: Profile = (t) => 0.3 + 0.6 * Math.sin(t * Math.PI);
const hatchIn = (c: Cell, r: Rng): Point[] => lineIn(c, r, 0.25, flat(0.55));
/** Land thin, swell, lift to a point: a leaf blade. */
const blade: Profile = (t) => 0.1 + 0.85 * Math.sin(t * Math.PI);
/** A short grain tick: from the cell's centre out and up, at a steady angle. */
const tickIn = (c: Cell, r: Rng): Point[] => {
  const len = Math.min(c.w, c.h) * between(r, 0.45, 0.6);
  const a = -Math.PI / 2 + (r() < 0.5 ? -0.62 : 0.62) + between(r, -0.08, 0.08);
  const x0 = c.x + c.w / 2 - Math.cos(a) * len * 0.5, y0 = c.y + c.h / 2 - Math.sin(a) * len * 0.5;
  return spline([[x0, y0], [x0 + Math.cos(a) * len * 0.5, y0 + Math.sin(a) * len * 0.5], [x0 + Math.cos(a) * len, y0 + Math.sin(a) * len]], 8, taperOut);
};
/** One ray of eight: from the cell's centre outward at the i-th eighth of the circle. */
const rayIn = (c: Cell, r: Rng, i: number): Point[] => {
  const len = Math.min(c.w, c.h) * between(r, 0.36, 0.44);
  const a = -Math.PI / 2 + (i % 8) * (Math.PI / 4);
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  return spline([[cx, cy], [cx + Math.cos(a) * len * 0.5, cy + Math.sin(a) * len * 0.5], [cx + Math.cos(a) * len, cy + Math.sin(a) * len]], 10, flat(0.6));
};
/** A closed loose round, traced back to its start: the outline of a fill. */
const blobIn = (c: Cell, r: Rng, wobble = 0.3, squash = 0.85): Point[] => {
  const rad = Math.min(c.w, c.h) * between(r, 0.3, 0.4), cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  const f1 = between(r, 0, Math.PI * 2), f2 = between(r, 0, Math.PI * 2), a0 = between(r, 0, Math.PI * 2), sq = between(r, squash, 1);
  const n = 36, out: Point[] = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI * 2; const k = 1 + wobble * 0.2 * (0.6 * Math.sin(2 * a + f1) + 0.4 * Math.sin(3 * a + f2)); out.push({ x: Math.round((cx + Math.cos(a) * rad * k) * 100) / 100, y: Math.round((cy + Math.sin(a) * rad * k * sq) * 100) / 100, p: 0.6 }); }
  return out;
};
/** A long triangle from a point near the cell's foot, traced round and back: one petal of the seabed star. */
const wedgeIn = (c: Cell, r: Rng): Point[] => {
  const cx = c.x + c.w / 2, base = c.y + c.h * 0.9, h = c.h * between(r, 0.7, 0.8), hw = Math.min(c.w * 0.3, h * 0.36);
  const tilt = between(r, -0.25, 0.25);
  const R = frame(cx, base, tilt);
  return poly([R(0, 0), R(-hw, -h), R(hw, -h), R(0, 0)], 14, flat(0.6));
};
/** A jagged ridge: along a broken crest, down the side and back along the foot. */
const ridgeIn = (c: Cell, r: Rng): Point[] => {
  const x0 = c.x + c.w * 0.08, x1 = c.x + c.w * 0.92, foot = c.y + c.h * 0.92, base = c.y + c.h * between(r, 0.45, 0.6), amp = c.h * 0.3;
  const ctrl: XY[] = [[x0, foot]];
  const n = 8;
  for (let i = 0; i <= n; i++) ctrl.push([x0 + ((x1 - x0) * i) / n, base - between(r, 0, amp)]);
  ctrl.push([x1, foot], [x0, foot]);
  return poly(ctrl, 5, flat(0.6));
};
/** A wheat stalk: up from the cell's foot with a hand's wobble. */
const stalkIn = (c: Cell, r: Rng): Point[] => {
  const x0 = c.x + c.w / 2 + between(r, -c.w * 0.15, c.w * 0.15), x1 = x0 + between(r, -c.w * 0.12, c.w * 0.12);
  const pts = poly([[x0, c.y + c.h * 0.95], [x1, c.y + c.h * between(r, 0.05, 0.25)]], 24, flat(0.6));
  const f1 = between(r, 0, 6), f2 = between(r, 0, 6);
  return pts.map((p: Point, i: number) => ({ ...p, x: Math.round((p.x + 4.8 * (0.6 * Math.sin(i * 0.7 + f1) + 0.4 * Math.sin(i * 2.1 + f2))) * 100) / 100 }));
};

const T = (t: Omit<Trainer, 'gen'> & { gen: Trainer['gen'] }): Trainer => t;
export const TRAINERS: Record<string, Trainer> = {
  hold: T({ id: 'hold', title: 'Three strokes', hint: 'A line, a curve, then press and release. Nothing to get right yet.', reps: 3, tier: 'light', focus: 'shape', template: 'liner', color: '#1a1c23', size: 1.3, speed: 0.45,
    gen: (c, r, i) => (i === 0 ? lineIn(c, r, 0.2) : i === 1 ? curveIn(c, r) : lineIn(c, r, 0.2, bell)) }),
  lines: T({ id: 'lines', title: 'Superimposed lines', hint: 'Two dots. Ghost the line in the air twice, then one pull.', reps: 12, group: 4, againHint: 'Same line again, over the first. Place the pen, then move.', tier: 'dots', focus: 'confidence', template: 'liner', color: '#1a1c23', size: 1.3, speed: 0.7,
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
  nibangles: T({ id: 'nibangles', title: 'Nib angles', hint: 'Same stroke, different directions: the nib decides the width.', reps: 8, tier: 'light', focus: 'direction', template: 'nib', color: '#2c3e8f', size: 0.6, speed: 0.5,
    gen: (c, r) => lineIn(c, r, Math.PI) }),
  chiselangles: T({ id: 'chiselangles', title: 'Angled tip', hint: 'Same stroke, different directions: watch the width change.', reps: 8, tier: 'light', focus: 'shape', template: 'chisel', color: '#c9407c', size: 0.8, speed: 0.5,
    gen: (c, r) => lineIn(c, r, Math.PI) }),
  bands: T({ id: 'bands', title: 'Flat bands', hint: 'Edge to edge, even pressure, no stopping.', reps: 6, tier: 'light', focus: 'pressure', template: 'wash', color: '#7aa6c2', size: 1.2, speed: 0.4,
    gen: (c, r) => lineIn(c, r, 0.08, flat(0.65)) }),
  hatching: T({ id: 'hatching', title: 'Hatching', hint: 'Short parallel lines, same spacing, same speed.', reps: 12, tier: 'dots', focus: 'shape', template: 'ballpoint', color: '#1a1c23', size: 1.0, speed: 0.7,
    gen: (c, r) => hatchIn(c, r) }),
  waves: T({ id: 'waves', title: 'Waves', hint: 'A wave without stopping.', reps: 6, tier: 'light', focus: 'shape', template: 'liner', color: '#1a1c23', size: 1.3, speed: 0.45,
    gen: (c, r) => waveIn(c, r) }),
  sweeps: T({ id: 'sweeps', title: 'Wash sweeps', hint: 'One loose sweep at one weight. Do not go back over it.', reps: 6, tier: 'light', focus: 'confidence', template: 'wash', color: '#5d9a52', size: 0.7, speed: 0.4,
    gen: (c, r) => curveIn(c, r, flat(0.65)) }),
  paledark: T({ id: 'paledark', title: 'Pale, then dark', hint: 'Pale first: one flat band.', reps: 8, group: 2, againHint: 'Now the dark one over it. Same band, same weight.', tier: 'light', focus: 'pressure', template: 'wash', color: '#d9d2c5', colors: ['#d9d2c5', '#8f8677'], size: 1.1, speed: 0.4,
    gen: (c, r) => lineIn(c, r, 0.08, flat(0.65)) }),
  sprayrings: T({ id: 'sprayrings', title: 'Spray rings', hint: 'One loose ring, round in one pass. Wide and light.', reps: 6, tier: 'light', focus: 'shape', template: 'spray', color: '#8f9db5', size: 1.5, speed: 0.6,
    gen: (c, r) => circleIn(c, r) }),
  ridges: T({ id: 'ridges', title: 'Ridges', hint: 'One long ridge: light in, heavy through, light out.', reps: 6, tier: 'light', focus: 'pressure', template: 'bristle', color: '#4a6178', size: 1.4, speed: 0.45,
    gen: (c, r) => waveIn(c, r, bell) }),
  petals: T({ id: 'petals', title: 'Petals', hint: 'One sweep per petal: swell in the middle, lift at the tip.', reps: 8, tier: 'light', focus: 'pressure', template: 'wash', color: '#d86a8a', size: 0.65, speed: 0.45,
    gen: (c, r) => petalIn(c, r) }),
  blades: T({ id: 'blades', title: 'Leaf blades', hint: 'Land thin, swell through the middle, lift to a point.', reps: 8, tier: 'light', focus: 'pressure', template: 'blade', color: '#2f5a33', size: 0.8, speed: 0.55,
    gen: (c, r) => curveIn(c, r, blade) }),
  petalmarks: T({ id: 'petalmarks', title: 'Petal sweeps', hint: 'From the centre out: swell, then lift at the rim.', reps: 8, tier: 'light', focus: 'pressure', template: 'petal', color: '#d8402e', size: 0.95, speed: 0.45,
    gen: (c, r) => petalIn(c, r) }),
  ticks: T({ id: 'ticks', title: 'Grain ticks', hint: 'Short and quick, pressing at the start: same length, same angle, every time.', reps: 12, tier: 'dots', focus: 'shape', template: 'cpencil', color: '#c4922c', size: 1.15, speed: 0.65,
    gen: (c, r) => tickIn(c, r) }),
  rays: T({ id: 'rays', title: 'Eight rays', hint: 'Start at the dot and pull outward. Each rep is the next eighth of the circle.', reps: 8, tier: 'dots', focus: 'direction', template: 'softpencil', color: '#9c4732', size: 0.9, speed: 0.6,
    gen: (c, r, i) => rayIn(c, r, i) }),
  blobs: T({ id: 'blobs', title: 'Bleeding fills', hint: 'Trace the round in one go, back to where you started, and lift. The wash fills it and bleeds outward.', reps: 6, tier: 'light', focus: 'shape', template: 'pen', color: '#b5452e', size: 0.7, speed: 0.5,
    gen: (c, r) => blobIn(c, r), shapes: [FILL('#b5452e', 200, 0.25, 'out', 0.6, 0.5), FILL('#9fc3d6', 100, 0.35, 'out', 0.45, 0.3), FILL('#e8792f', 150, 0.4, 'out', 0.55, 0.5)] }),
  glows: T({ id: 'glows', title: 'Glow and body', hint: 'A loose round that bleeds far out: the glow. Then a tighter one that bleeds inward: the body.', reps: 6, tier: 'light', focus: 'shape', template: 'pen', color: '#f2a544', size: 0.7, speed: 0.5,
    gen: (c, r, i) => blobIn(c, r, i % 2 ? 0.1 : 0.3, i % 2 ? 0.7 : 0.9), shapes: [FILL('#f2a544', 90, 0.55, 'out', 0.5, 0.3), FILL('#f5b942', 215, 0.18, 'in', 0.45, 0.7)] }),
  inks: T({ id: 'inks', title: 'Six inks', hint: 'The same round six ways: massed charcoal, a dark fill, crayon, a flat wash, a pencil outline, an orange bleed.', reps: 6, tier: 'light', focus: 'shape', template: 'softpencil', color: '#2a2420', size: 1.1, speed: 0.45,
    gen: (c, r) => blobIn(c, r, 0.1, 0.9), shapes: [{ kind: 'mass', color: '#2a2420', opacity: 255, mass: { brush: 'charcoal', precision: 0.5, strength: 1, gradient: 0.2, outline: true } }, FILL('#2a2420', 200, 0.15, 'in', 0.6, 0.6), { kind: 'mass', color: '#4a4340', opacity: 255, mass: { brush: 'crayon', precision: 0.7, strength: 0.7, gradient: 0.4 } }, { kind: 'wash', color: '#6b625c', opacity: 110 }, null, FILL('#c9582a', 150, 0.3, 'out', 0.6, 0.5)] }),
  wedges: T({ id: 'wedges', title: 'Petal wedges', hint: 'A long triangle from the point: up one side, across the top, back down. It fills and bleeds.', reps: 6, tier: 'light', focus: 'shape', template: 'pen', color: '#ef9a80', size: 0.7, speed: 0.5,
    gen: (c, r) => wedgeIn(c, r), shapes: [FILL('#ef9a80', 150, 0.42, 'out', 0.62, 0.4), FILL('#d75f4c', 120, 0.3, 'in', 0.5, 0.5)] }),
  ridgefills: T({ id: 'ridgefills', title: 'Ridges', hint: 'Along the broken crest, corners sharp, down the side and back along the foot.', reps: 4, tier: 'light', focus: 'shape', template: 'pen', color: '#6f8aa6', size: 0.7, speed: 0.45,
    gen: (c, r) => ridgeIn(c, r), shapes: [FILL('#b7c6d6', 110, 0.3, 'out', 0.55, 0.45), FILL('#6f8aa6', 130, 0.25, 'out', 0.55, 0.45), FILL('#2f4a63', 150, 0.2, 'out', 0.55, 0.45)] }),
  hatchfills: T({ id: 'hatchfills', title: 'Hatched shapes', hint: 'Trace the shape once round. It hatches itself, dense on one side and thinning toward the light.', reps: 4, tier: 'light', focus: 'shape', template: 'pen', color: '#2b3a55', size: 0.7, speed: 0.45,
    gen: (c, r) => blobIn(c, r, 0.2, 0.7), shapes: [{ kind: 'hatch', color: '#2b3a55', opacity: 255, hatch: { dist: 5, angle: 60, brush: 'rotring', weight: 0.8, gradient: 0.6, rand: 0.1, continuous: true } }] }),
  stalks: T({ id: 'stalks', title: 'Wobbly stalks', hint: 'Soft pencil from the ground up. Let the hand wobble; do not fight it.', reps: 8, tier: 'light', focus: 'shape', template: 'softpencil', color: '#b07a2a', size: 1.3, speed: 0.55,
    gen: (c, r) => stalkIn(c, r) }),
  streaks: T({ id: 'streaks', title: 'Wind streaks', hint: 'A slow S-curve that follows the wind. Even speed all the way.', reps: 8, tier: 'light', focus: 'shape', template: 'hardpencil', color: '#7fa6bd', size: 1.1, speed: 0.5,
    gen: (c, r) => scurveIn(c, r, flat(0.6)) }),
  livinglines: T({ id: 'livinglines', title: 'Living lines', hint: 'Thin in, weight through the body, thin out.', reps: 8, tier: 'light', focus: 'pressure', template: 'brushpen', color: '#8b2d1c', size: 0.9, speed: 0.45,
    gen: (c, r) => scurveIn(c, r, living) }),
};

/** Builds the reps of a trainer for a run seed. A grouped trainer lays out reps / group strokes and repeats each. */
export function trainerReps(t: Trainer, seed: number): TrainerRep[] {
  const r = rng(seed);
  const group = Math.max(1, t.group ?? 1);
  const cells = cellsFor(Math.ceil(t.reps / group));
  const out: TrainerRep[] = [];
  cells.forEach((c, i) => {
    const points = t.gen(c, r, i);
    for (let k = 0; k < group && out.length < t.reps; k++) {
      const shape = t.shapes ? t.shapes[i % t.shapes.length] ?? undefined : undefined;
      out.push({ points, template: t.template, color: shape?.color ?? t.colors?.[k % t.colors.length] ?? t.color, size: t.size, speed: t.speed, hint: i === 0 && k === 0 ? t.hint : k === 1 && i === 0 ? t.againHint : k === 0 ? t.hint : undefined, shape });
    }
  });
  return out;
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
export function nextMission(done: (id: string) => boolean, after?: string | null): Mission | null {
  const open = MISSIONS.filter((x) => isPlayable(x) && !done(x.id));
  if (after) {
    const k = MISSIONS.findIndex((x) => x.id === after);
    const onward = open.find((x) => MISSIONS.indexOf(x) > k);
    if (onward) return onward;
  }
  return open[0] ?? null;
}

/** Missions open in order inside a level; the first of each level is always open. */
export function isLocked(x: Mission, done: (id: string) => boolean): boolean {
  const lvl = levelOf(x);
  const i = lvl.missions.indexOf(x);
  for (let k = 0; k < i; k++) { const prev = lvl.missions[k]; if (isPlayable(prev) && !done(prev.id)) return true; }
  return false;
}

export { LESSONS };
