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
const RIDGE_FAR = { template: 'bristle', color: '#8fa7bd', size: 1.2 };
const RIDGE_NEAR = { template: 'bristle', color: '#3c5468', size: 1.2 };
const PETAL = { template: 'wash', color: '#d86a8a', size: 0.62 };
const CENTRE = { template: 'chisel', color: '#c9407c', size: 0.8 };

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
        D(LINER, timed(over(line(120, 400, 680, 400), 1), 0.3), { good: false, delay: 250 }),
        D(LINER, timed(over(line(120, 400, 680, 396), 2), 0.3), { good: false, delay: 200 }),
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
      body: 'Say "one" at every corner, pen down, before you move again. The pencil darkens slightly where you stop; that is right, it is how a drawn corner looks.',
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

  '3.5': [
    {
      title: 'Wet first, line after',
      body: 'The wash is translucent and the line is not. Ink over a wash sits crisp on top; a wash over ink softens and greys the line. The order cannot be swapped afterwards.',
      demos: [
        D(WASH, timed(spline([[110, 300], [250, 180], [360, 300]], 18, bell), 0.45), { label: 'wash, then line', good: true }),
        D(OUTLINE, timed(spline([[110, 300], [250, 165], [360, 300]], 18, bell), 0.4), { good: true, delay: 500 }),
        D(OUTLINE, timed(spline([[440, 300], [580, 165], [690, 300]], 18, bell), 0.4), { label: 'line, then wash', good: false, delay: 600 }),
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
      body: 'Lay a wash and line it here. Then the arcs trainer, and the leaf.',
      tryIt: true,
    },
  ],

  '5.5': [
    {
      title: 'Far to near, light to dark',
      body: 'Distant hills are pale and flat; near ones are dark and detailed. Paint the farthest ridge first, so each nearer ridge covers the foot of the one behind it.',
      demos: [
        D(RIDGE_FAR, timed(spline([[60, 300], [220, 230], [400, 270], [580, 210], [740, 260]], 16, bell), 0.45), { label: 'far: pale, first' }),
        D({ ...RIDGE_NEAR, color: '#607a91' }, timed(spline([[60, 380], [200, 320], [380, 360], [600, 300], [740, 350]], 16, bell), 0.45), { delay: 400 }),
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
        D(CENTRE, timed(line(384, 292, 416, 300, flat(0.9), 8), 0.35), { delay: 500 }),
        D(CENTRE, timed(line(390, 310, 412, 286, flat(0.9), 8), 0.35), { delay: 200 }),
        D(CENTRE, timed(line(386, 304, 418, 312, flat(0.9), 8), 0.35), { delay: 200 }),
      ],
    },
    {
      title: 'Your turn',
      body: 'Sweep a few petals from one point here. Then the arcs trainer, and the bloom.',
      tryIt: true,
    },
  ],
};

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
/** Where each stroke's label goes: just above its first point, or below when that is near the top. */
export const labelAnchor = (d: DemoStroke): { x: number; y: number } => {
  const p = d.points[0];
  return { x: p.x, y: p.y < 60 ? p.y + 34 : p.y - 26 };
};

// The frame helper is re-exported for lesson authors who compose slides elsewhere.
export { frame };
