/**
 * Brush templates: ready-made `brush.add(...)` specs with custom tips.
 * Every template goes through the same engine path as the user's own brush;
 * tips use only deterministic drawing (no random) so previews and replays are
 * stable, and only shim/p5.Graphics methods so the p5 sketch export runs too.
 */
import { DEFAULT_SPEC, DEFAULT_TIP_SOURCE, type BrushSpec } from './records';
import type { FilterPatch } from './filters';

export interface BrushTemplate {
  id: string;
  name: string;
  /** Name used for brush.add() in exported code. */
  codeName: string;
  description: string;
  spec: BrushSpec;
  tipSource: string;
  /** Pencil behaviour that belongs to the brush: what the tip's rotation follows, and barrel roll. */
  pencil?: { nib?: 'stroke' | 'azimuth'; roll?: boolean };
  /** Input filter channels this brush prefers (applied over the defaults when the brush is picked). */
  filters?: FilterPatch;
}

export const BRUSH_TEMPLATES: BrushTemplate[] = [
  {
    id: 'chisel',
    name: 'Chisel marker',
    codeName: 'myBrush',
    description: 'Translucent dual-rect chisel, the original myBrush spec.',
    spec: DEFAULT_SPEC,
    tipSource: DEFAULT_TIP_SOURCE,
  },
  {
    id: 'liner',
    name: 'Fine liner',
    codeName: 'fineLiner',
    description: 'Dense round tip with tight spacing: a crisp ink line.',
    spec: {
      type: 'custom', weight: 6, scatter: 0.05, opacity: 60, spacing: 0.25, noise: 0.2,
      pressure: { mode: 'gaussian', curve: [0.3, 0.2], min_max: [1.05, 0.9] },
      rotate: 'none', markerTip: false,
    },
    tipSource:
`_m.fill(0);
_m.circle(0, 0, 60);`,
  },
  {
    id: 'graphite',
    name: 'Graphite pencil',
    codeName: 'graphite',
    description: 'A cluster of soft dots, scattered and rotated: grainy pencil.',
    spec: {
      type: 'custom', weight: 14, scatter: 0.6, opacity: 28, spacing: 0.5, noise: 0.8,
      pressure: { mode: 'gaussian', curve: [0.15, 0.3], min_max: [1.1, 0.85] },
      rotate: 'random', markerTip: false,
    },
    tipSource:
`for (let i = 0; i < 18; i++) {
  const a = i * 2.39996;
  const r = 4 + (i * 7) % 26;
  _m.fill(0, 120 + (i * 37) % 100);
  _m.circle(_m.cos(a) * r, _m.sin(a) * r, 5 + (i % 3) * 3);
}`,
  },
  {
    id: 'wash',
    name: 'Watercolor wash',
    codeName: 'watercolor',
    description: 'Large, very translucent discs that pool at the edges.',
    spec: {
      type: 'custom', weight: 70, scatter: 2.5, opacity: 6, spacing: 2, noise: 1,
      pressure: { mode: 'gaussian', curve: [0.4, 0.3], min_max: [0.8, 1.15] },
      rotate: 'random', markerTip: true,
    },
    tipSource:
`for (let i = 0; i < 6; i++) {
  _m.fill(0, 22);
  _m.circle(i * 3 - 8, 5 - i * 2, 90 - i * 12);
}`,
  },
  {
    id: 'nib',
    name: 'Calligraphy nib',
    codeName: 'broadNib',
    description: "Broad edge that turns with the pencil's lean and roll: thick and thin follow the hand.",
    spec: {
      type: 'custom', weight: 30, scatter: 0.05, opacity: 40, spacing: 0.3, noise: 0.2,
      pressure: { mode: 'gaussian', curve: [0.3, 0.2], min_max: [0.85, 1.05] },
      rotate: 'none', markerTip: false,
    },
    tipSource:
`_m.rotate(-0.6);
_m.fill(0);
_m.rect(-34, -4, 68, 8, 3);`,
    pencil: { nib: 'azimuth', roll: true },
    filters: { position: { mode: 'kalman', q: 0.005, r: 12 } },
  },
  {
    id: 'bristle',
    name: 'Dry bristle',
    codeName: 'dryBristle',
    description: 'Parallel bristle streaks that follow the stroke direction.',
    spec: {
      type: 'custom', weight: 36, scatter: 0.4, opacity: 14, spacing: 0.6, noise: 0.8,
      pressure: { mode: 'gaussian', curve: [0.25, 0.25], min_max: [1.0, 0.7] },
      rotate: 'natural', markerTip: false,
    },
    tipSource:
`for (let i = 0; i < 9; i++) {
  const y = -32 + i * 8 + (i % 2) * 2;
  _m.fill(0, 90 + (i * 53) % 120);
  _m.rect(-40 + (i % 3) * 6, y, 70 - (i % 4) * 10, 2.5 + (i % 2));
}`,
  },
  {
    id: 'brushpen',
    name: 'Brush pen',
    codeName: 'brushPen',
    description: 'Soft pointed tip with a wide force range: thin hairlines to full-bodied strokes.',
    spec: {
      type: 'custom', weight: 18, scatter: 0.1, opacity: 70, spacing: 0.15, noise: 0.1,
      pressure: { mode: 'gaussian', curve: [0.2, 0.3], min_max: [0.45, 1.3] },
      rotate: 'none', markerTip: false,
    },
    tipSource:
`for (let i = 0; i < 6; i++) {
  _m.fill(0, 70);
  _m.circle(0, 0, 64 - i * 9);
}`,
    filters: { pressure: { mode: 'kalman', q: 0.002, r: 0.005 } },
  },
  {
    id: 'flat',
    name: 'Flat shader',
    codeName: 'flatShader',
    description: 'Wide flat edge that turns with the pencil: lean for broad fills, roll for thin lines.',
    spec: {
      type: 'custom', weight: 36, scatter: 0.08, opacity: 26, spacing: 0.3, noise: 0.3,
      pressure: { mode: 'gaussian', curve: [0.3, 0.25], min_max: [0.9, 1.05] },
      rotate: 'none', markerTip: false,
    },
    tipSource:
`for (let i = 0; i < 5; i++) {
  _m.fill(0, 120 + i * 30);
  _m.rect(-42 + i * 3, -7 + i, 84 - i * 6, 14 - i * 2, 4);
}`,
    pencil: { nib: 'azimuth', roll: true },
    filters: { position: { mode: 'kalman', q: 0.005, r: 12 }, tilt: { mode: 'kalman', q: 1, r: 30 } },
  },
  {
    id: 'ballpoint',
    name: 'Ballpoint',
    codeName: 'ballpoint',
    description: 'Thin, dense and slightly skipping: handwriting and quick sketch lines.',
    spec: {
      type: 'custom', weight: 4, scatter: 0.03, opacity: 78, spacing: 0.15, noise: 0.35,
      pressure: { mode: 'gaussian', curve: [0.25, 0.2], min_max: [0.9, 1.05] },
      rotate: 'none', markerTip: false,
    },
    tipSource:
`_m.fill(0);
_m.circle(0, 0, 70);
_m.fill(0, 90);
_m.circle(0, 0, 90);`,
    filters: { position: { mode: 'kalman', q: 0.2, r: 2 } },
  },
  {
    id: 'charcoal',
    name: 'Charcoal stick',
    codeName: 'charcoalStick',
    description: 'Broken, grainy edge that follows the stroke: dark masses and soft smudged tone.',
    spec: {
      type: 'custom', weight: 40, scatter: 1.2, opacity: 22, spacing: 0.7, noise: 0.9,
      pressure: { mode: 'gaussian', curve: [0.2, 0.3], min_max: [1.05, 0.8] },
      rotate: 'natural', markerTip: false,
    },
    tipSource:
`for (let i = 0; i < 14; i++) {
  const x = -42 + i * 6;
  _m.fill(0, 60 + (i * 41) % 120);
  _m.rect(x, -10 + (i % 3) * 3, 5, 14 + (i % 2) * 6, 2);
}`,
    filters: { pressure: { mode: 'kalman', q: 0.0001, r: 0.03 } },
  },
  {
    id: 'spray',
    name: 'Spray stipple',
    codeName: 'sprayStipple',
    description: 'Sparse dots spread wide, for texture and shading.',
    spec: {
      type: 'custom', weight: 60, scatter: 3, opacity: 36, spacing: 3, noise: 1,
      pressure: { mode: 'gaussian', curve: [0.3, 0.3], min_max: [0.9, 1.1] },
      rotate: 'random', markerTip: false,
    },
    tipSource:
`for (let i = 0; i < 40; i++) {
  const a = i * 2.39996;
  const r = 48 * _m.sqrt((i + 0.5) / 40);
  _m.fill(0, 140 + (i * 29) % 100);
  _m.circle(_m.cos(a) * r, _m.sin(a) * r, 2.5 + (i % 3));
}`,
  },
];

/** The template whose spec and tip match exactly, if any. */
export function matchTemplate(spec: BrushSpec, tipSource: string): BrushTemplate | undefined {
  const key = JSON.stringify(spec);
  return BRUSH_TEMPLATES.find((t) => t.tipSource === tipSource && JSON.stringify(t.spec) === key);
}
