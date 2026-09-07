/**
 * The teaching layer: what a mission is about, before anything is scored.
 *
 * Every playable mission opens with a short lesson: three to five slides, each
 * one idea. A slide can carry demo strokes that the engine draws on the paper
 * with the real brush at the real pace, and a compare slide draws the right way
 * and the wrong way one after the other so the learner sees the difference in
 * ink, not in words. The last slide invites them to try it, unscored, then the
 * trainer starts. The cue (one imperative sentence) is repeated in the session.
 *
 * Everything is in lesson units (the 800×600 box) and fully deterministic.
 */
import type { Point } from '@/engine/records';
import { bell, flat, frame, poly, spline, taperOut, type Profile, type XY } from './geometry';

export interface DemoStroke {
  /** Lesson units; when the points carry `t` (ms) that timeline is used as-is. */
  points: Point[];
  template: string;
  color: string;
  size: number;
  /** Lesson units per ms when the points carry no timeline. */
  speed?: number;
  /** A short label drawn beside the stroke on the paper. */
  label?: string;
  /** Compare slides: the right way (true) or the way it goes wrong (false). */
  good?: boolean;
  /** Beat before the stroke starts, ms. */
  delay?: number;
}

export interface TeachSlide {
  title: string;
  body: string;
  /** The physical cue: one imperative sentence. Shown as a chip, repeated in the session. */
  cue?: string;
  demos?: DemoStroke[];
  /** The learner is invited to draw on the paper; nothing is scored. */
  tryIt?: boolean;
}

// ---------------------------------------------------------------------------
// Stroke builders
// ---------------------------------------------------------------------------
const LINER = { template: 'liner', color: '#1a1c23', size: 1.3 };
const GRAPHITE = { template: 'graphite', color: '#4d4d4d', size: 1.0 };
const BRISTLE = { template: 'bristle', color: '#3f6b3a', size: 1.0 };
const NIB = { template: 'nib', color: '#2c3e8f', size: 0.6 };
const BAMBOO_NIB = { template: 'nib', color: '#2f5a33', size: 0.6 };
const WASH = { template: 'wash', color: '#4f8a48', size: 0.62 };
const OUTLINE = { template: 'liner', color: '#2a4a2c', size: 1.25 };
const RIDGE_FAR = { template: 'bristle', color: '#c0ccd8', size: 1.1 };
const RIDGE_NEAR = { template: 'bristle', color: '#2c3f52', size: 1.4 };
const PETAL = { template: 'wash', color: '#d86a8a', size: 0.62 };
const CENTRE = { template: 'chisel', color: '#a8285e', size: 1.15 };

/** Adds a timeline at a constant pace. */
function timed(pts: Point[], speed: number): Point[] {
  let t = 0;
  return pts.map((p, i) => {
    if (i > 0) { const q = pts[i - 1]; t += Math.hypot(p.x - q.x, p.y - q.y) / speed; }
    return { ...p, t: Math.round(t) };
  });
}
/** A timeline that slows into and pauses at the given point indices (corners). */
function paused(pts: Point[], speed: number, stops: number[], pauseMs: number): Point[] {
  let t = 0;
  return pts.map((p, i) => {
    if (i > 0) { const q = pts[i - 1]; t += Math.hypot(p.x - q.x, p.y - q.y) / speed; }
    if (stops.includes(i)) t += pauseMs;
    return { ...p, t: Math.round(t) };
  });
}
/** A timeline that speeds up along the stroke (a flick): `from` → `to` units per ms. */
function accelerating(pts: Point[], from: number, to: number): Point[] {
  let t = 0;
  const n = pts.length - 1;
  return pts.map((p, i) => {
    if (i > 0) { const q = pts[i - 1]; const v = from + (to - from) * (i / n); t += Math.hypot(p.x - q.x, p.y - q.y) / v; }
    return { ...p, t: Math.round(t) };
  });
}
/** Hesitation: a slow stroke with a wobble that grows and shrinks along it. */
function hesitant(pts: Point[], amp: number): Point[] {
  const n = pts.length - 1;
  return pts.map((p, i) => {
    const k = Math.sin((i / n) * Math.PI);
    return { ...p, x: p.x + Math.sin(i * 2.3) * amp * k, y: p.y + Math.cos(i * 1.7) * amp * k };
  });
}
/** The same stroke again over itself, nudged like a hand would. */
function over(pts: Point[], k: number): Point[] {
  const n = pts.length - 1;
  return pts.map((p, i) => ({ ...p, x: p.x + Math.sin(k * 1.9) * 1.5, y: p.y + (i / n) * k * 2.2 + Math.cos(k * 1.3) * 1.2 }));
}
const line = (x0: number, y0: number, x1: number, y1: number, prof: Profile = flat(0.6), n = 40): Point[] => poly([[x0, y0], [x1, y1]], n, prof);
const arc = (x0: number, y: number, x1: number, bulge: number, prof: Profile = flat(0.6)): Point[] =>
  spline([[x0, y], [(x0 + x1) / 2, y - bulge], [x1, y]], 20, prof);
const wave = (x0: number, y: number, x1: number, amp: number): Point[] => {
  const w = x1 - x0;
  return spline([[x0, y], [x0 + w * 0.25, y - amp], [x0 + w * 0.5, y], [x0 + w * 0.75, y + amp], [x1, y]], 12, flat(0.6));
};
const zigzagPts = (x0: number, y: number, x1: number, amp: number, n = 4): XY[] => {
  const out: XY[] = [];
  for (let i = 0; i <= n; i++) out.push([x0 + ((x1 - x0) * i) / n, y + (i % 2 ? -amp : amp)]);
  return out;
};

const D = (base: { template: string; color: string; size: number }, points: Point[], o: Partial<DemoStroke> = {}): DemoStroke => ({ ...base, points, ...o });
const CHISEL = { template: 'chisel', color: '#c9407c', size: 0.85 };
const BALLPOINT = { template: 'ballpoint', color: '#1a1c23', size: 1.0 };
const SPRAY = { template: 'spray', color: '#8f9db5', size: 1.6 };
const BRUSHPEN = { template: 'brushpen', color: '#d2452c', size: 0.95 };
const STONE_PALE = { template: 'wash', color: '#cdc2ae', size: 0.7 };
const STONE_DARK = { template: 'wash', color: '#8f8677', size: 0.6 };
/** A closed ellipse in one pass from the top; `wobble` makes it egg-shaped and lumpy. */
const ell = (cx: number, cy: number, rx: number, ry: number, rot = 0, wobble = 0, n = 44, prof: Profile = flat(0.6)): Point[] => {
  const R = frame(cx, cy, rot);
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; const k = 1 + wobble * (0.5 * Math.sin(3 * a) + 0.35 * Math.cos(a)); const [x, y] = R(Math.cos(a) * rx * k, Math.sin(a) * ry * k); out.push({ x, y, p: prof(i / n) }); }
  return out;
};
const spiral = (cx: number, cy: number, r0: number, turns: number, dir = 1): Point[] => {
  const n = Math.round(turns * 22), out: Point[] = [];
  for (let i = 0; i <= n; i++) { const a = (i / n) * turns * Math.PI * 2, r = r0 * (1 - (0.82 * i) / n); out.push({ x: cx + Math.cos(a * dir) * r, y: cy + Math.sin(a * dir) * r, p: 0.6 - (0.2 * i) / n }); }
  return out;
};
const living: Profile = (t) => 0.3 + 0.6 * Math.sin(t * Math.PI);


// ---------------------------------------------------------------------------
// Slides per mission
// ---------------------------------------------------------------------------
export const TEACH: Record<string, TeachSlide[]> = {
  '0.1': [
    {
      title: 'Draw from the shoulder',
      body: 'Fingers make short, wobbly marks. The wrist makes a fan. Long, straight and smooth comes from the elbow and the shoulder, with the wrist locked.',
      cue: 'Lock the wrist. Move the arm.',
      demos: [D(LINER, timed(line(120, 300, 680, 300), 0.7), { label: 'from the shoulder' })],
    },
    {
      title: 'This is a brush, not a pencil',
      body: 'The mark answers to how hard you press and how fast you move. The same line drawn lightly and heavily is two different lines. Every lesson from here on is about that.',
      demos: [
        D(LINER, timed(line(120, 210, 680, 210, flat(0.25)), 0.6), { label: 'light' }),
        D(LINER, timed(line(120, 330, 680, 330, flat(0.9)), 0.6), { label: 'heavy', delay: 400 }),
        D(LINER, timed(arc(120, 470, 680, 90, bell), 0.5), { label: 'press, then ease off', delay: 400 }),
      ],
    },
    {
      title: 'Ghost it, then commit',
      body: 'Before the pen lands, trace the stroke in the air two or three times. The motion is rehearsed; the mark is a copy of it. Then land, pull, lift.',
      cue: 'Rehearse in the air. Land. One pull.',
      demos: [D(LINER, timed(arc(140, 360, 660, 140), 0.55), { delay: 900 })],
    },
    {
      title: 'Your turn',
      body: 'Draw a few lines and a curve on the paper here. Nothing is scored. Feel the difference between pressing and floating, then start the three strokes.',
      tryIt: true,
    },
  ],

  '1.1': [
    {
      title: 'A confident line is a straight line',
      body: 'Hesitation is visible: the pen slows, the hand steers, the line wobbles. A line pulled in one motion is straight because there was no time to correct it.',
      demos: [
        D(LINER, timed(line(120, 220, 680, 220), 0.75), { label: 'one pull', good: true }),
        D(LINER, timed(hesitant(line(120, 400, 680, 400, flat(0.6), 60), 5), 0.16), { label: 'steered', good: false, delay: 400 }),
      ],
    },
    {
      title: 'Look at the end dot, not the pen',
      body: 'Place the pen on the first dot. Move your eyes to the second dot and keep them there. Ghost the motion twice in the air, then pull the line to where you are looking.',
      cue: 'Eyes on the end dot. Ghost twice. Pull.',
      demos: [D(LINER, timed(line(140, 480, 660, 140), 0.75), { delay: 900 })],
    },
    {
      title: 'A miss is finished',
      body: 'If the line lands off the dot, leave it. Going back over a line to fix it turns one clean miss into a hairy, obvious one. Confidence is the skill; accuracy follows it.',
      demos: [
        D(LINER, timed(line(120, 220, 680, 232), 0.75), { label: 'missed by a little, left alone', good: true }),
        D(LINER, timed(line(120, 400, 680, 412), 0.75), { label: 'missed, then corrected', good: false, delay: 500 }),
        D(LINER, timed(over(line(140, 402, 690, 400), 3), 0.3), { good: false, delay: 250 }),
        D(LINER, timed(over(line(160, 404, 700, 394), 6), 0.3), { good: false, delay: 200 }),
      ],
    },
    {
      title: 'Superimposed lines',
      body: 'The drill: one line, then the same line again over the top, eight times. Fraying at the end is fine, it means you moved with confidence. Fraying at the start means the pen was not placed before it moved.',
      cue: 'Place the pen. Then move.',
      demos: [0, 1, 2, 3, 4, 5].map((k) => D(LINER, timed(over(line(120, 320, 680, 320), k), 0.75), { delay: k === 0 ? 300 : 150 })),
    },
    {
      title: 'Your turn',
      body: 'Draw a few dot-to-dot lines here, ghosting each one first. Then the trainer: three lines, each drawn four times over itself.',
      tryIt: true,
    },
  ],

  '1.2': [
    {
      title: 'A curve is one motion',
      body: 'A curve pushed out in short pieces shows every join as a flat spot or a kink. A curve swung from the elbow in one go is round all the way, because the arm is a compass.',
      demos: [
        D(LINER, timed(arc(120, 240, 680, 120), 0.55), { label: 'one swing', good: true }),
        D(LINER, timed(poly([[120, 460], [230, 405], [340, 372], [450, 362], [560, 378], [680, 440]], 6, flat(0.6)), 0.22), { label: 'pushed out in pieces', good: false, delay: 500 }),
      ],
    },
    {
      title: 'Speed keeps it round',
      body: 'Slow down on a curve and the hand starts steering, so the arc flattens. Keep an even, unhurried pace from the first dot to the last and let the elbow set the radius.',
      cue: 'Even pace. Elbow, not fingers.',
      demos: [D(LINER, timed(arc(140, 400, 660, 200), 0.55), { delay: 700 })],
    },
    {
      title: 'Waves: look one crest ahead',
      body: 'A wave is a chain of curves that never stops. While you draw one crest, look at the next. Keep the crests the same height and the pace the same through the whole line.',
      demos: [D(LINER, timed(wave(100, 300, 700, 70), 0.5), { delay: 500 })],
    },
    {
      title: 'Your turn',
      body: 'Swing a few arcs and one long wave here. Then the trainer: eight arcs from dot to dot.',
      tryIt: true,
    },
  ],

  '1.3': [
    {
      title: 'A corner is a full stop',
      body: 'Round a corner without stopping and it comes out as a bend. A sharp corner is three moves: drive in, stop completely, leave in the new direction.',
      demos: [
        D(GRAPHITE, paused(poly(zigzagPts(120, 210, 680, 55), 10, flat(0.65)), 0.5, [10, 20, 30], 140), { label: 'stop at each corner', good: true }),
        D(GRAPHITE, timed(spline(zigzagPts(120, 410, 680, 55), 10, flat(0.65)), 0.5), { label: 'rounded on the way through', good: false, delay: 500 }),
      ],
    },
    {
      title: 'Count one at the corner',
      body: 'Say "one" at every corner, pen down, before you move again. The stop is what makes the corner: leave a beat early and the pencil rounds it for you.',
      cue: 'Drive in. Stop. New direction.',
      demos: [D(GRAPHITE, paused(poly(zigzagPts(120, 300, 680, 90, 4), 10, flat(0.65)), 0.5, [10, 20, 30], 160), { delay: 700 })],
    },
    {
      title: 'Mountains',
      body: 'A ridge line is a row of corners: a straight pull up to the peak, a stop, a straight pull down. Long straight sides read as rock; wobbly ones read as a doodle.',
      demos: [D(GRAPHITE, paused(poly([[80, 480], [220, 260], [330, 380], [470, 180], [600, 360], [720, 300]], 10, flat(0.65)), 0.5, [10, 20, 30, 40], 140), { delay: 500 })],
    },
    {
      title: 'Your turn',
      body: 'Draw a zigzag or two here, stopping dead at each corner. Then the trainer.',
      tryIt: true,
    },
  ],

  '1.4': [
    {
      title: 'Every stroke has a direction',
      body: 'A brush mark is not the same drawn the other way. Where you start is heavier and where you lift is lighter, so the direction shows in the ink. The dot marks where to start; the arrow shows the way.',
      demos: [
        D(BRISTLE, timed(line(120, 220, 680, 220, taperOut), 0.6), { label: 'left to right', good: true }),
        D(BRISTLE, timed(line(680, 400, 120, 400, taperOut), 0.6), { label: 'same line, right to left', good: false, delay: 500 }),
      ],
    },
    {
      title: 'Pull, do not push',
      body: 'Strokes pulled toward you or across your body are steadier than strokes pushed away. When a stroke goes the wrong way for your hand, turn the tablet, not your wrist.',
      cue: 'Start at the dot. Pull toward you.',
      demos: [D(LINER, timed(line(400, 120, 400, 500), 0.7), { delay: 700 })],
    },
    {
      title: 'Kite strings',
      body: 'Each string starts at the kite and pulls down to the hand. Same stroke, four directions: the drill asks for every angle, and the score checks you began at the dot.',
      demos: [
        D(LINER, timed(line(200, 140, 330, 480), 0.65)),
        D(LINER, timed(line(600, 140, 470, 480), 0.65), { delay: 300 }),
        D(LINER, timed(line(400, 120, 400, 480), 0.65), { delay: 300 }),
      ],
    },
    {
      title: 'Your turn',
      body: 'Draw lines in a few directions here, always starting at a dot you picked first. Then the trainer.',
      tryIt: true,
    },
  ],

  '2.1': [
    {
      title: 'Pressure is width and ink',
      body: 'The bristle brush spreads under weight and thins as you lift. A stroke that starts heavy and ends light tapers to a point: it is the whole mark of grass, hair, fur and leaves.',
      demos: [
        D(BRISTLE, timed(line(120, 220, 680, 220, taperOut), 0.6), { label: 'press, then lift', good: true }),
        D(BRISTLE, timed(line(120, 400, 680, 400, flat(0.7)), 0.6), { label: 'same pressure all the way', good: false, delay: 500 }),
      ],
    },
    {
      title: 'The last third is the lift',
      body: 'Press at the root. Start easing off as soon as you are moving, and let the pen leave the surface while it is still travelling. The stroke should finish in the air.',
      cue: 'Press at the root. Lift through the stroke. Finish in the air.',
      demos: [D(BRISTLE, timed(arc(140, 420, 660, 120, taperOut), 0.55), { delay: 700 })],
    },
    {
      title: 'Blades of grass',
      body: 'A blade starts at the ground, heavy, and flicks up and out. Speed up as you lift: the flick is what makes the tip sharp.',
      demos: [
        D(BRISTLE, accelerating(spline([[220, 520], [235, 380], [275, 250]], 14, taperOut), 0.35, 0.9)),
        D(BRISTLE, accelerating(spline([[400, 520], [405, 360], [430, 200]], 14, taperOut), 0.35, 0.9), { delay: 250 }),
        D(BRISTLE, accelerating(spline([[580, 520], [560, 390], [520, 260]], 14, taperOut), 0.35, 0.9), { delay: 250 }),
      ],
    },
    {
      title: 'Your turn',
      body: 'Flick a few blades here: heavy at the base, lifting into the air. Then the trainer.',
      tryIt: true,
    },
  ],

  '2.2': [
    {
      title: 'The nib opens under pressure',
      body: 'A steel nib splits when you press, so the line gets wide, and closes again when you ease off. Light in, heavy in the middle, light out: a swell.',
      demos: [
        D(NIB, timed(line(120, 220, 680, 220, bell), 0.45), { label: 'light, heavy, light', good: true }),
        D(NIB, timed(line(120, 400, 680, 400, flat(0.55)), 0.45), { label: 'no change', good: false, delay: 500 }),
      ],
    },
    {
      title: 'Gradual, not sudden',
      body: 'The pressure change spreads over the whole stroke. Think "in, PRESS, out" as three equal parts, and keep the speed even so only the weight is changing.',
      cue: 'In, press, out. Even speed.',
      demos: [D(NIB, timed(arc(140, 400, 660, 160, bell), 0.45), { delay: 700 })],
    },
    {
      title: 'Raindrops',
      body: 'A drop is a short swell drawn downward, heaviest near the bottom. Short strokes need the same three parts as long ones, only faster.',
      demos: [
        D(NIB, timed(spline([[250, 180], [254, 260], [258, 330]], 10, (t) => 0.25 + 0.7 * Math.sin(Math.min(1, t * 1.15) * Math.PI)), 0.4)),
        D(NIB, timed(spline([[400, 240], [404, 320], [408, 390]], 10, (t) => 0.25 + 0.7 * Math.sin(Math.min(1, t * 1.15) * Math.PI)), 0.4), { delay: 250 }),
        D(NIB, timed(spline([[550, 200], [554, 280], [558, 350]], 10, (t) => 0.25 + 0.7 * Math.sin(Math.min(1, t * 1.15) * Math.PI)), 0.4), { delay: 250 }),
      ],
    },
    {
      title: 'Your turn',
      body: 'Draw a few swells here, long and short. Then the trainer.',
      tryIt: true,
    },
  ],

  '2.3': [
    {
      title: 'Thick at the joints, thin between',
      body: 'A bamboo segment is drawn in one stroke: press at the bottom node, ease off through the middle, press again at the top node. The stroke breathes out and in.',
      demos: [
        D(BAMBOO_NIB, timed(line(300, 500, 310, 140, (t) => 0.95 - 0.5 * Math.sin(t * Math.PI)), 0.45), { label: 'press, ease, press', good: true }),
        D(BAMBOO_NIB, timed(line(520, 500, 530, 140, flat(0.8)), 0.45), { label: 'heavy all the way', good: false, delay: 500 }),
      ],
    },
    {
      title: 'Only the pressure changes',
      body: 'Keep one even speed from node to node. If you slow down where you press, the ink pools and the segment looks lumpy. The weight is in the hand, not in the pace.',
      cue: 'Heavy, light, heavy. One speed.',
      demos: [D(BAMBOO_NIB, timed(line(400, 520, 412, 120, (t) => 0.95 - 0.5 * Math.sin(t * Math.PI)), 0.45), { delay: 700 })],
    },
    {
      title: 'The node',
      body: 'Where two segments meet, a short heavy tick across the stem marks the joint. Short, firm, and done.',
      demos: [
        D(BAMBOO_NIB, timed(line(400, 520, 408, 330, (t) => 0.95 - 0.5 * Math.sin(t * Math.PI)), 0.45)),
        D(BAMBOO_NIB, timed(line(408, 318, 416, 130, (t) => 0.95 - 0.5 * Math.sin(t * Math.PI)), 0.45), { delay: 250 }),
        D(BAMBOO_NIB, timed(line(388, 326, 430, 322, flat(0.95), 10), 0.4), { delay: 300 }),
      ],
    },
    {
      title: 'Your turn',
      body: 'Draw a segment or two here, pressing at both ends. Then the trainer.',
      tryIt: true,
    },
  ],

  '2.4': [
    {
      title: 'A long fade',
      body: 'A fade is a taper spread over the whole stroke. The lift begins the moment you start moving and is not finished until the tip, where the pen leaves the paper still travelling.',
      demos: [
        D({ ...BRISTLE, size: 1.2 }, timed(arc(100, 440, 700, 200, taperOut), 0.5), { label: 'lifting the whole way', good: true }),
        D({ ...BRISTLE, size: 1.2 }, timed(arc(100, 560, 700, 200, (t) => (t < 0.8 ? 0.85 : 0.85 - (t - 0.8) * 3)), 0.5), { label: 'heavy, then a sudden lift', good: false, delay: 500 }),
      ],
    },
    {
      title: 'Start lifting at once',
      body: 'Most fades fail because the lift starts too late. Press only at the very first moment, then begin easing off immediately, and keep easing until nothing is left.',
      cue: 'Press once. Then lift, all the way to the tip.',
      demos: [D({ ...BRISTLE, size: 1.2 }, timed(spline([[120, 520], [300, 330], [520, 200], [700, 140]], 20, taperOut), 0.5), { delay: 700 })],
    },
    {
      title: 'Reeds',
      body: 'Reeds are long fades that bend slightly, all leaning the same way in the wind. Each one starts in the water, heavy, and disappears at its tip.',
      demos: [
        D({ ...BRISTLE, size: 1.2 }, timed(spline([[220, 560], [240, 380], [300, 180]], 18, taperOut), 0.5)),
        D({ ...BRISTLE, size: 1.2 }, timed(spline([[380, 560], [400, 360], [470, 140]], 18, taperOut), 0.5), { delay: 250 }),
        D({ ...BRISTLE, size: 1.2 }, timed(spline([[540, 560], [560, 400], [620, 220]], 18, taperOut), 0.5), { delay: 250 }),
      ],
    },
    {
      title: 'Your turn',
      body: 'Draw two or three long fades here. Then the trainer.',
      tryIt: true,
    },
  ],

  '3.1': [
    {
      title: 'An ellipse is a circle seen at an angle',
      body: 'Its two halves mirror each other and it closes where it began. Draw it in pieces and it turns into an egg with corners; swing it in one pass from the elbow and it stays round.',
      demos: [
        D(GRAPHITE, timed(ell(260, 300, 130, 80, 0.1), 0.5), { label: 'one pass, closed', good: true }),
        D(GRAPHITE, timed(ell(580, 300, 130, 80, 0.1, 0.18), 0.28), { label: 'pushed round in pieces', good: false, delay: 500 }),
      ],
    },
    {
      title: 'Ghost it, then go round once',
      body: 'Round it in the air two or three times over the spot, at speed. When the motion feels smooth, lower the pen without slowing and make one pass, ending on the point you started.',
      cue: 'Ghost twice. One pass. Close it.',
      demos: [D(GRAPHITE, timed(ell(400, 300, 170, 100, -0.15), 0.5), { delay: 900 })],
    },
    {
      title: 'The plane decides how flat it is',
      body: 'A pebble on the ground is a circle you look down on. The farther away, the more edge-on and the narrower the ellipse; the closer, the rounder. Same motion, different squash.',
      demos: [
        D(GRAPHITE, timed(ell(400, 170, 110, 26), 0.5), { label: 'far: nearly edge-on' }),
        D(GRAPHITE, timed(ell(400, 300, 120, 52), 0.5), { delay: 300 }),
        D(GRAPHITE, timed(ell(400, 460, 130, 90), 0.5), { label: 'near: almost round', delay: 300 }),
      ],
    },
    { title: 'Your turn', body: 'Round a few ellipses here, ghosting each one first. Then the trainer.', tryIt: true },
  ],

  '3.2': [
    {
      title: 'Two bends, one motion',
      body: 'An S-curve is not two arcs joined; the join always shows as a kink. It is a single swing whose direction reverses in the middle without the pen slowing down.',
      demos: [
        D(LINER, timed(spline([[160, 480], [270, 380], [380, 320], [480, 250], [620, 140]], 20, flat(0.6)), 0.5), { label: 'one swing', good: true }),
        D(LINER, paused(spline([[160, 560], [280, 470], [390, 430]], 12, flat(0.6)).concat(spline([[390, 430], [500, 340], [620, 240]], 12, flat(0.6))), 0.5, [12], 260), { label: 'two arcs with a stop', good: false, delay: 500 }),
      ],
    },
    {
      title: 'A spiral is a curve that tightens evenly',
      body: 'Keep the speed steady and let the radius shrink a little with every turn. If the pen speeds up, the spiral collapses; if the radius jumps, it stops looking like a spiral.',
      cue: 'Steady speed. Shrink the radius, never the pace.',
      demos: [D(LINER, timed(spiral(400, 310, 150, 2.2), 0.45), { delay: 700 })],
    },
    {
      title: 'A leaf is one loop',
      body: 'Out along one edge, round the tip, back along the other, and close it where it started. Two S-curves back to back, drawn as one.',
      demos: [D(LINER, timed(spline([[220, 380], [360, 250], [560, 220], [420, 330], [220, 380]], 14, flat(0.6)), 0.5), { delay: 500 })],
    },
    { title: 'Your turn', body: 'Swing a few S-curves and one spiral here. Then the trainer.', tryIt: true },
  ],

  '3.3': [
    {
      title: 'The chisel is a flat edge',
      body: 'Pull it across its edge and the mark is broad; pull it along its edge and the mark is a hairline. Nothing about your pressure changed. Only the direction did.',
      demos: [
        D(CHISEL, timed(line(160, 200, 640, 200), 0.55), { label: 'across the edge: broad', good: true }),
        D(CHISEL, timed(line(400, 280, 400, 540), 0.55), { label: 'along the edge: thin', delay: 500 }),
      ],
    },
    {
      title: 'A curve goes through both',
      body: 'Take the tip round a bend and the mark swells and thins on its own, thick where you cross the edge, thin where you run along it. That is the whole trick of a ribbon.',
      cue: 'Same pressure. Let the direction do the width.',
      demos: [D(CHISEL, timed(spline([[140, 420], [280, 220], [430, 200], [520, 380], [680, 200]], 20, flat(0.7)), 0.5), { delay: 700 })],
    },
    { title: 'Your turn', body: 'Pull the chisel in a few directions here, then round a bend. Then the trainer.', tryIt: true },
  ],

  '5.1': [
    {
      title: 'Edge to edge at one pressure',
      body: 'A flat band is a single wash stroke that keeps the same weight the whole way across. Press harder anywhere and the water pools into a dark blot; ease off and the band thins and breaks.',
      demos: [
        D(WASH, timed(line(-40, 210, 840, 210, flat(0.6), 40), 0.5), { label: 'even all the way', good: true }),
        D(WASH, timed(line(-40, 380, 840, 380, (t) => 0.4 + 0.45 * Math.abs(Math.sin(t * 7)), 40), 0.5), { label: 'pressure wandering', good: false, delay: 500 }),
      ],
    },
    {
      title: 'Start before the edge, finish after it',
      body: 'Begin the stroke off the paper and let it run out past the far side, so the band has no hesitant start and no fat stop. The edges of the paper crop it clean.',
      cue: 'Start past the edge. One weight. Run off the other side.',
      demos: [D(WASH, timed(line(-60, 300, 860, 300, flat(0.6), 40), 0.5), { delay: 700 })],
    },
    { title: 'Your turn', body: 'Lay three bands here, each a little darker than the one above. Then the trainer.', tryIt: true },
  ],

  '5.2': [
    {
      title: 'Light before dark',
      body: 'Wash is transparent: a pale layer over a dark one changes nothing, but a dark layer over a pale one reads as shadow. So the order is fixed. The palest wash goes down first, every time.',
      demos: [
        D(STONE_PALE, timed(spline([[110, 280], [180, 200], [300, 200], [370, 280]], 20, bell), 0.45), { label: 'pale first, dark on top', good: true }),
        D(STONE_DARK, timed(spline([[250, 330], [320, 290], [370, 280]], 12, bell), 0.45), { good: true, delay: 500 }),
        D(STONE_DARK, timed(spline([[580, 330], [650, 290], [700, 280]], 12, bell), 0.45), { label: 'dark first, pale on top', good: false, delay: 600 }),
        D(STONE_PALE, timed(spline([[440, 280], [510, 200], [630, 200], [700, 280]], 20, bell), 0.45), { good: false, delay: 500 }),
      ],
    },
    {
      title: 'Plan the order before the pen lands',
      body: 'Farthest and lightest first, nearest and darkest last, and the line last of all. A stone is two pale sweeps, one dark sweep on the shadow side, then a single slow outline.',
      cue: 'Pale. Pale. Dark. Then the line.',
      demos: [
        D(STONE_PALE, timed(spline([[250, 320], [320, 240], [480, 240], [550, 320]], 20, bell), 0.45)),
        D(STONE_PALE, timed(spline([[250, 340], [320, 410], [480, 400], [550, 330]], 20, bell), 0.45), { delay: 300 }),
        D(STONE_DARK, timed(spline([[420, 400], [500, 380], [550, 330]], 12, bell), 0.45), { delay: 300 }),
        D({ template: 'liner', color: '#5a524a', size: 1.1 }, timed(ell(400, 328, 150, 80, 0, 0, 48, flat(0.55)), 0.4), { delay: 500 }),
      ],
    },
    { title: 'Your turn', body: 'Paint one stone here in that order. Then the trainer.', tryIt: true },
  ],

  '5.3': [
    {
      title: 'Passes build the tone',
      body: 'Spray puts down scattered dots, so one pass is a haze you can see the paper through. Go over the same band again and the dots pile up into a solid mark. The number of passes sets the tone; the edge stays soft either way.',
      demos: [
        D(SPRAY, timed(line(120, 200, 680, 200, flat(0.6), 30), 0.7), { label: 'one pass: a haze', good: true }),
        D(SPRAY, timed(line(120, 400, 680, 400, flat(0.6), 30), 0.7), { label: 'three passes: solid', delay: 500 }),
        D(SPRAY, timed(line(680, 404, 120, 402, flat(0.6), 30), 0.7), { delay: 150 }),
        D(SPRAY, timed(line(120, 398, 680, 400, flat(0.6), 30), 0.7), { delay: 150 }),
      ],
    },
    {
      title: 'Build a glow in rings',
      body: 'A moon is not one filled circle. It is a wide loose ring for the halo, then smaller rings inside it, each denser than the last, so the centre is solid and the edge fades into the sky.',
      cue: 'Wide and loose first. Smaller and denser inside.',
      demos: [
        D({ ...SPRAY, color: '#c9b56a', size: 1.8 }, timed(ell(400, 300, 130, 130), 0.8)),
        D({ ...SPRAY, color: '#d9bd63', size: 1.3 }, timed(ell(400, 300, 80, 80), 0.6), { delay: 300 }),
        D({ ...SPRAY, color: '#e8d08a', size: 1.0 }, timed(ell(400, 300, 42, 42), 0.45), { delay: 300 }),
        D({ ...SPRAY, color: '#e8d08a', size: 1.0 }, timed(ell(400, 300, 38, 38), 0.45), { delay: 150 }),
      ],
    },
    { title: 'Your turn', body: 'Spray one band once and another three times here, then a moon in rings. Then the drill.', tryIt: true },
  ],

  '5.4': [
    {
      title: 'Parallel, evenly spaced, same speed',
      body: 'Hatching is tone made of rhythm. Lines that keep one angle, one gap and one speed read as a flat grey; lines that wander in angle or spacing read as scribble, however carefully each was drawn.',
      demos: [
        ...[0, 1, 2, 3, 4, 5].map((k) => D(BALLPOINT, timed(line(150 + k * 30, 300, 230 + k * 30, 160, flat(0.55), 12), 0.7), { label: k === 0 ? 'one angle, one gap' : undefined, good: true, delay: k === 0 ? 0 : 120 })),
        ...[0, 1, 2, 3, 4, 5].map((k) => D(BALLPOINT, timed(line(470 + k * 30 + [0, 6, -4, 9, -2, 5][k], 300, 550 + k * 30 + [0, -6, 8, 2, -9, 4][k], 160 + [0, 10, -8, 4, 12, -6][k], flat(0.55), 12), 0.7), { label: k === 0 ? 'angle and gap drifting' : undefined, good: false, delay: k === 0 ? 500 : 120 })),
      ],
    },
    {
      title: 'Darker means another direction, not harder',
      body: 'To deepen a tone, lay a second set of lines across the first at a new angle. Pressing harder or scribbling back and forth kills the rhythm; a second direction keeps it.',
      cue: 'Look at where the line ends, not at the pen.',
      demos: [
        ...[0, 1, 2, 3, 4, 5, 6].map((k) => D(BALLPOINT, timed(line(280 + k * 30, 480, 360 + k * 30, 340, flat(0.55), 12), 0.7), { delay: k === 0 ? 300 : 110 })),
        ...[0, 1, 2, 3, 4].map((k) => D(BALLPOINT, timed(line(290, 360 + k * 26, 540, 340 + k * 26, flat(0.55), 14), 0.7), { delay: k === 0 ? 500 : 110 })),
      ],
    },
    { title: 'Your turn', body: 'Hatch a patch here, then cross it. Then the trainer.', tryIt: true },
  ],

  '6.2': [
    {
      title: 'A dead line and a living one',
      body: 'A line at one pressure is a wire: it describes an edge and nothing else. A line that comes in thin, carries weight through the middle and leaves thin again has a body; it describes a form.',
      demos: [
        D(BRUSHPEN, timed(spline([[130, 230], [280, 160], [460, 170], [620, 240], [700, 280]], 20, living), 0.5), { label: 'thin, weight, thin', good: true }),
        D(BRUSHPEN, timed(spline([[130, 430], [280, 360], [460, 370], [620, 440], [700, 480]], 20, flat(0.6)), 0.5), { label: 'one pressure', good: false, delay: 500 }),
      ],
    },
    {
      title: 'The weight sits where the form is',
      body: 'On a fish the belly is round and the nose and tail are fine, so the line is heaviest through the middle and fades at both ends. Decide where the weight goes before the pen lands.',
      cue: 'Thin in. Weight through the body. Thin out.',
      demos: [
        D(BRUSHPEN, timed(spline([[170, 300], [300, 230], [460, 240], [600, 300], [700, 340]], 20, living), 0.5), { delay: 700 }),
        D(BRUSHPEN, timed(spline([[170, 300], [280, 360], [440, 380], [590, 350], [700, 340]], 20, living), 0.5), { delay: 400 }),
        D({ ...BRUSHPEN, size: 0.85 }, timed(spline([[700, 340], [760, 260], [790, 200]], 12, (t) => 0.7 - 0.5 * t), 0.7), { delay: 300 }),
        D({ ...BRUSHPEN, size: 0.85 }, timed(spline([[700, 340], [770, 400], [800, 470]], 12, (t) => 0.7 - 0.5 * t), 0.7), { delay: 200 }),
      ],
    },
    { title: 'Your turn', body: 'Draw two or three living lines here, weight in the middle. Then the trainer.', tryIt: true },
  ],


  '3.4': [
    {
      title: 'The nib has two widths',
      body: 'A calligraphy nib is a flat edge. Pull across that edge and the line is wide; pull along it and the line is a hair. The pen never turns in your hand: the direction of the stroke does the turning.',
      demos: [
        D(NIB, timed(line(150, 300, 650, 300, flat(0.7)), 0.5), { label: 'across the edge: wide', good: true }),
        D(NIB, timed(line(400, 120, 400, 480, flat(0.7)), 0.5), { label: 'along the edge: thin', good: true, delay: 500 }),
      ],
    },
    {
      title: 'A curve turns through both',
      body: 'One curved stroke passes through every direction, so it swells and thins on its own. Watch where it goes wide: those are the parts running across the edge.',
      cue: 'Hold the pen still. Turn the stroke.',
      demos: [D(NIB, timed(ell(400, 300, 190, 120, 0.3), 0.5), { delay: 600 })],
    },
    {
      title: 'A feather',
      body: 'The shaft is one long pull. The barbs leave it at two angles, so one side of the feather comes out wide and the other thin, from the same pen at the same pressure.',
      demos: [
        D({ ...NIB, size: 0.75 }, timed(spline([[200, 480], [330, 360], [470, 240], [600, 120]], 22, bell), 0.5), { delay: 300 }),
        D(NIB, timed(spline([[330, 360], [300, 300], [270, 260]], 8, taperOut), 0.6), { delay: 300 }),
        D(NIB, timed(spline([[330, 360], [400, 330], [450, 325]], 8, taperOut), 0.6), { delay: 150 }),
        D(NIB, timed(spline([[420, 285], [390, 225], [365, 190]], 8, taperOut), 0.6), { delay: 150 }),
        D(NIB, timed(spline([[420, 285], [490, 255], [540, 250]], 8, taperOut), 0.6), { delay: 150 }),
      ],
    },
    { title: 'Your turn', body: 'Draw the same short stroke in six directions here and watch the width change. Then the drill.', tryIt: true },
  ],

  '4.1': [
    {
      title: 'Draw what you see, not what you know',
      body: 'Ask for a hand and most people draw the symbol: a mitten with five sausages. A blind contour breaks the habit. Your eye crawls along the real edge and the pen copies its movement, slowly, without ever looking at the paper.',
      demos: [
        D(LINER, timed(spline([[250, 470], [236, 400], [210, 350], [186, 300], [212, 288], [246, 330], [276, 370]], 14, flat(0.6)), 0.3), { label: 'the edge, followed', good: true }),
        D(LINER, timed(spline([[520, 470], [520, 300], [560, 300], [560, 470]], 6, flat(0.6)), 0.6), { label: 'the symbol', good: false, delay: 500 }),
      ],
    },
    {
      title: 'The ink hides until you lift',
      body: 'On paper you would be tempted to peek. Here the ink stays hidden while the pen moves and appears when you lift, so there is nothing to look at but the subject. The line will be strange. That is the point.',
      cue: 'Eyes on the edge. Pen at eye speed. Lift, then look.',
      demos: [D(LINER, timed(spline([[276, 370], [262, 260], [268, 160], [296, 160], [308, 260], [314, 370]], 14, flat(0.6)), 0.3), { delay: 600 })],
    },
    { title: 'Your turn', body: 'Look at your own hand and draw its outline here without looking down. Then the piece.', tryIt: true },
  ],

  '4.2': [
    {
      title: 'The shape of the space',
      body: 'The eye names objects and ignores the gaps between them. The gaps have exact shapes too, and they are easier to see because they have no names. Paint the gaps and the object appears without being drawn.',
      demos: [
        D(WASH, timed(line(130, 90, 130, 510, flat(0.65), 24), 0.4), { label: 'the space', delay: 200 }),
        D(WASH, timed(line(195, 90, 195, 510, flat(0.65), 24), 0.4), { delay: 200 }),
        D(WASH, timed(line(260, 90, 260, 510, flat(0.65), 24), 0.4), { label: 'stops at the chair', delay: 200 }),
        D(WASH, timed(line(540, 90, 540, 510, flat(0.65), 24), 0.4), { delay: 300 }),
        D(WASH, timed(line(605, 90, 605, 510, flat(0.65), 24), 0.4), { delay: 200 }),
        D(WASH, timed(line(670, 90, 670, 510, flat(0.65), 24), 0.4), { delay: 200 }),
      ],
    },
    {
      title: 'Edge to edge, and stop',
      body: 'Each band is a flat wash from the top of the paper to the bottom, or to the chair. The dashed outline is the chair: never paint across it. Where you stop is the drawing.',
      cue: 'Paint the gap. Stop at the wood.',
      demos: [D(WASH, timed(line(360, 80, 440, 80, flat(0.65), 16), 0.4), { delay: 600 })],
    },
    { title: 'Your turn', body: 'Paint a few bands here and leave a shape unpainted in the middle. Then the piece.', tryIt: true },
  ],

  '4.3': [
    {
      title: 'Upside down, the face goes away',
      body: 'Turn a drawing upside down and the brain stops recognising a nose, a lip, an eye. What is left is lines: this one bends here, that one is this far from the edge. Copying lines is easy. Copying a face is hard because you draw the one you know.',
      demos: [
        D(GRAPHITE, timed(spline([[430, 480], [428, 420], [432, 360], [450, 300], [434, 280]], 14, flat(0.65)), 0.4), { label: 'a line with two bends', delay: 200 }),
        D(GRAPHITE, timed(spline([[434, 280], [428, 250], [434, 230], [420, 210], [424, 180], [408, 150], [380, 135]], 14, flat(0.65)), 0.4), { delay: 300 }),
      ],
    },
    {
      title: 'Measure, do not name',
      body: 'For each line ask only two things: where does it start, and how does it bend on the way. Compare it with the line next to it and with the edge of the paper. Do not turn it the right way up in your head until the last line is down.',
      cue: 'Where does it start. How does it bend.',
      demos: [D(GRAPHITE, timed(spline([[400, 480], [330, 505], [260, 480], [220, 400], [225, 310], [250, 240], [280, 180], [300, 130]], 16, flat(0.65)), 0.4), { delay: 600 })],
    },
    { title: 'Your turn', body: 'Copy the two lines above here, upside down, without deciding what they are. Then the piece.', tryIt: true },
  ],

  '4.4': [
    {
      title: 'Look for ten seconds',
      body: 'A drawing from memory is a test of how you looked. Most people look for two seconds and remember a word: cup. Ten seconds of real looking remembers proportions: how wide the rim is against the height, where the handle joins, how the sides lean.',
      demos: [
        D(LINER, timed(ell(400, 200, 150, 45), 0.45), { label: 'rim: how wide against the height', delay: 200 }),
        D(LINER, timed(spline([[250, 200], [254, 310], [262, 420]], 10, flat(0.6)), 0.5), { delay: 200 }),
        D(LINER, timed(spline([[550, 200], [546, 310], [538, 420]], 10, flat(0.6)), 0.5), { delay: 150 }),
        D(LINER, timed(spline([[550, 240], [640, 250], [660, 330], [600, 400], [540, 395]], 16, flat(0.6)), 0.45), { label: 'handle: where it joins', delay: 300 }),
      ],
    },
    {
      title: 'Then it is gone',
      body: 'In the piece the cup stays on the paper for ten seconds, then disappears. Two dots mark each stroke\'s start and end; the shape between them is yours to remember. Say the proportions to yourself while you look: rim, sides, base, handle.',
      cue: 'Ten seconds. Name the proportions. Then draw.',
    },
    { title: 'Your turn', body: 'Look at the cup above once more, then draw it here from memory. Then the piece.', tryIt: true },
  ],

  '3.5': [
    {
      title: 'Wet first, line after',
      body: 'The wash is translucent and the line is not. Ink over a wash sits crisp on top; a wash over ink softens and greys the line. The order cannot be swapped afterwards.',
      demos: [
        D(WASH, timed(spline([[110, 300], [250, 180], [360, 300]], 18, bell), 0.45), { label: 'wash, then line', good: true }),
        D(OUTLINE, timed(spline([[110, 300], [250, 165], [360, 300]], 18, bell), 0.4), { good: true, delay: 500 }),
        D({ ...OUTLINE, color: '#75857a' }, timed(spline([[440, 300], [580, 165], [690, 300]], 18, bell), 0.4), { label: 'line, then wash', good: false, delay: 600 }),
        D(WASH, timed(spline([[440, 300], [580, 180], [690, 300]], 18, bell), 0.45), { good: false, delay: 500 }),
      ],
    },
    {
      title: 'Overlaps are the point',
      body: 'Where two washes cross, the colour doubles. Do not avoid overlaps; place them where the leaf is darkest, along the middle.',
      demos: [
        D(WASH, timed(spline([[160, 460], [340, 300], [520, 250], [660, 200]], 20, bell), 0.45)),
        D(WASH, timed(spline([[160, 460], [360, 380], [540, 290], [660, 200]], 20, bell), 0.45), { delay: 300 }),
        D(WASH, timed(spline([[160, 460], [320, 250], [500, 210], [660, 200]], 20, bell), 0.45), { delay: 300 }),
      ],
    },
    {
      title: 'One clean outline',
      body: 'The outline is one slow, even pull around the wet shape. Slower than a line drill: you are following an edge, and the liner rewards a steady pace.',
      cue: 'Wash loose. Line slow and once.',
      demos: [
        D(WASH, timed(spline([[160, 460], [340, 300], [520, 250], [660, 200]], 20, bell), 0.45)),
        D(OUTLINE, timed(spline([[160, 462], [330, 290], [520, 235], [660, 200]], 24, bell), 0.32), { delay: 500 }),
      ],
    },
    {
      title: 'Your turn',
      body: 'Lay a wash and line it here. Then the sweeps drill, and the leaf.',
      tryIt: true,
    },
  ],

  '5.5': [
    {
      title: 'Far to near, light to dark',
      body: 'Distant hills are pale and flat; near ones are dark and detailed. Paint the farthest ridge first, so each nearer ridge covers the foot of the one behind it.',
      demos: [
        D(RIDGE_FAR, timed(spline([[60, 300], [220, 230], [400, 270], [580, 210], [740, 260]], 16, bell), 0.45), { label: 'far: pale, first' }),
        D({ ...RIDGE_NEAR, color: '#7d93a8', size: 1.25 }, timed(spline([[60, 380], [200, 320], [380, 360], [600, 300], [740, 350]], 16, bell), 0.45), { label: 'middle', delay: 400 }),
        D(RIDGE_NEAR, timed(spline([[60, 470], [240, 410], [420, 450], [620, 400], [740, 440]], 16, bell), 0.45), { label: 'near: dark, last', delay: 400 }),
      ],
    },
    {
      title: 'A ridge is a swell',
      body: 'Each ridge is one long stroke: light at the left edge, heavy through the body, light again at the right. The bristle drybrushes at the ends, which reads as haze.',
      cue: 'Farthest first. Light in, heavy through, light out.',
      demos: [D(RIDGE_NEAR, timed(spline([[60, 400], [240, 330], [420, 380], [620, 320], [740, 370]], 16, bell), 0.45), { delay: 700 })],
    },
    {
      title: 'Your turn',
      body: 'Paint three ridges here, far to near. Then the piece.',
      tryIt: true,
    },
  ],

  '6.1': [
    {
      title: 'From the centre out',
      body: 'A flower is built from its centre. Mark where the centre will be, then every petal starts there and sweeps outward, so they all radiate from one point.',
      demos: [
        D(PETAL, timed(spline([[400, 300], [430, 200], [410, 120]], 16, bell), 0.45), { label: 'each petal starts at the centre' }),
        D(PETAL, timed(spline([[400, 300], [520, 240], [590, 200]], 16, bell), 0.45), { delay: 250 }),
        D(PETAL, timed(spline([[400, 300], [500, 400], [560, 450]], 16, bell), 0.45), { delay: 250 }),
        D(PETAL, timed(spline([[400, 300], [300, 400], [240, 450]], 16, bell), 0.45), { delay: 250 }),
        D(PETAL, timed(spline([[400, 300], [280, 240], [210, 200]], 16, bell), 0.45), { delay: 250 }),
      ],
    },
    {
      title: 'One sweep per petal',
      body: 'A petal is a wash stroke that swells in the middle and lifts at the tip. Do not go back over it: a second pass darkens it and the petal loses its edge.',
      cue: 'Start at the centre. Swell. Lift at the tip.',
      demos: [D(PETAL, timed(spline([[400, 320], [470, 180], [450, 90]], 18, bell), 0.45), { delay: 600 })],
    },
    {
      title: 'The centre comes last',
      body: 'Short, thick chisel marks over the middle, on top of the petals. The chisel is a flat tip: the marks are wide across and thin along, so keep them short.',
      demos: [
        D(PETAL, timed(spline([[400, 300], [430, 200], [410, 120]], 16, bell), 0.45)),
        D(PETAL, timed(spline([[400, 300], [520, 240], [590, 200]], 16, bell), 0.45), { delay: 200 }),
        D(PETAL, timed(spline([[400, 300], [280, 240], [210, 200]], 16, bell), 0.45), { delay: 200 }),
        D(CENTRE, timed(line(372, 290, 428, 302, flat(0.9), 10), 0.35), { label: 'the centre, last', delay: 500 }),
        D(CENTRE, timed(line(384, 322, 416, 278, flat(0.9), 10), 0.35), { delay: 200 }),
        D(CENTRE, timed(line(374, 312, 426, 288, flat(0.9), 10), 0.35), { delay: 200 }),
        D(CENTRE, timed(line(378, 284, 422, 316, flat(0.9), 10), 0.35), { delay: 200 }),
      ],
    },
    {
      title: 'Your turn',
      body: 'Sweep a few petals from one point here. Then the petals drill, and the bloom.',
      tryIt: true,
    },
  ],
};

/** The demo's points with their timeline (ms from pen-down), whether authored or at its constant pace. */
export function demoTimed(d: DemoStroke): Point[] {
  return d.points[0]?.t !== undefined ? d.points : timed(d.points, d.speed ?? 0.45);
}
/** Whether a demo is about pressure: its profile moves enough to show. */
export function pressureVaries(d: DemoStroke): boolean {
  let lo = 1, hi = 0;
  for (const p of d.points) { if (p.p < lo) lo = p.p; if (p.p > hi) hi = p.p; }
  return hi - lo >= 0.15;
}
/**
 * SMIL pacing for a demo: the motion path (relative to the first point), the
 * cumulative-length keyPoints and the time keyTimes, so a marker can travel the
 * stroke at exactly the demo's pace, pauses and flicks included.
 */
export function demoMotion(d: DemoStroke): { path: string; keyPoints: string; keyTimes: string; dur: number; hpath: string } {
  const pts = demoTimed(d);
  const T = Math.max(1, pts[pts.length - 1].t ?? 1);
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const L = cum[cum.length - 1] || 1;
  const kp: string[] = [], kt: string[] = [], rel: string[] = [];
  let lastT = -1;
  const x0 = pts[0].x, y0 = pts[0].y;
  pts.forEach((p, i) => {
    let t = (p.t ?? 0) / T;
    if (t <= lastT) t = Math.min(1, lastT + 1e-4); // strictly increasing, as SMIL wants
    if (i === pts.length - 1) t = 1;
    lastT = t;
    kp.push((cum[i] / L).toFixed(4)); kt.push(t.toFixed(4));
    rel.push(`${(p.x - x0).toFixed(1)} ${(p.y - y0).toFixed(1)}`);
  });
  return { path: 'M' + rel.join('L'), keyPoints: kp.join(';'), keyTimes: kt.join(';'), dur: T / 1000, hpath: 'M0 0L1 0' };
}

/** Whether a mission has a lesson. */
export const hasLesson = (missionId: string) => !!TEACH[missionId];
export const teachSlides = (missionId: string): TeachSlide[] => TEACH[missionId] ?? [];
/** The lesson's cue: the last cue in its slides, repeated inside the session. */
export function teachCue(missionId: string): string | null {
  const slides = TEACH[missionId];
  if (!slides) return null;
  for (let i = slides.length - 1; i >= 0; i--) if (slides[i].cue) return slides[i].cue!;
  return null;
}
/**
 * Where each labelled demo's caption sits: centred above the stroke's extent, kept
 * inside the paper (a band that starts off the edge is still captioned over the part
 * you can see), moved below the stroke when the top is out of room, and pushed down
 * when it would land on an earlier caption.
 */
export function labelAnchors(demos: DemoStroke[]): Array<{ x: number; y: number } | null> {
  const W = 800, H = 600;
  const boxes: Array<{ minX: number; minY: number; maxX: number; maxY: number }> = [];
  const placed: Array<{ x: number; y: number }> = [];
  return demos.map((d) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of d.points) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const box = { minX, minY, maxX, maxY };
    const earlier = boxes.slice();
    boxes.push(box);
    if (!d.label) return null;
    const x = Math.min(W - 120, Math.max(120, (Math.max(minX, 0) + Math.min(maxX, W)) / 2));
    const above = minY - 18, below = Math.min(H - 12, maxY + 30);
    // A spot is taken when an earlier caption sits there or an earlier stroke runs through it.
    const taken = (y: number) =>
      placed.some((q) => Math.abs(q.y - y) < 22 && Math.abs(q.x - x) < 270) ||
      earlier.some((b) => y > b.minY - 8 && y < b.maxY + 8 && Math.abs(x - (b.minX + b.maxX) / 2) < (b.maxX - b.minX) / 2 + 90);
    let y = above >= 28 && !taken(above) ? above : below;
    for (let guard = 0; guard < 4 && taken(y); guard++) y += 24;
    placed.push({ x, y });
    return { x, y };
  });
}

// The frame helper is re-exported for lesson authors who compose slides elsewhere.
export { frame };
