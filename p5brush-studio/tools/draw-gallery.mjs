// Usage: build the app, serve dist on :8768 (npx http-server dist -p 8768 -s), then `node tools/draw-gallery.mjs`.
// Renders a gallery of drawings through the studio engine, each built the way the
// lessons teach: superimposed lines, one-motion curves, corners as full stops,
// strokes pulled from the dot, tapers and swells, wash before line, far to near.
// Second pass: every piece has a value structure (pale far, dark near), a focal
// point, and marks that follow the form.
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = new URL('../docs/gallery/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 750 }, deviceScaleFactor: 1.5 });
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:8768/index.html#/sketch', { waitUntil: 'load' });
await page.waitForFunction(() => window.__studio && window.__studio.state.templatePreviews);
await page.evaluate(() => { window.__sfx?.setEnabled(false); });
await page.addStyleTag({ content: '[data-sonner-toaster]{display:none !important}' });

await page.evaluate(() => {
  const s = window.__studio;
  const W = 1000, H = 750;
  const G = (window.__gallery = {});
  // --- pressure profiles --------------------------------------------------------
  const bell = (t) => 0.5 + 0.4 * Math.sin(t * Math.PI);
  const taperOut = (t) => 0.85 - 0.55 * t;
  const taperIn = (t) => 0.3 + 0.55 * t;
  const flat = (p) => () => p;
  const thin = (t) => 0.3 + 0.6 * Math.sin(t * Math.PI);
  const node = (t) => 0.95 - 0.5 * Math.sin(t * Math.PI);
  // --- geometry -----------------------------------------------------------------
  const spline = (ctrl, steps = 24, prof = bell) => {
    const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]];
    const out = [];
    for (let i = 1; i < P.length - 2; i++) {
      const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
      for (let k = 0; k < steps; k++) {
        const t = k / steps, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          y: 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
          p: 0,
        });
      }
    }
    out.push({ x: ctrl[ctrl.length - 1][0], y: ctrl[ctrl.length - 1][1], p: 0 });
    out.forEach((q, i) => (q.p = prof(i / (out.length - 1))));
    return out;
  };
  const poly = (ctrl, per = 12, prof = flat(0.6)) => {
    const out = [];
    for (let i = 0; i < ctrl.length - 1; i++) for (let k = 0; k < per; k++) { const t = k / per; out.push({ x: ctrl[i][0] + (ctrl[i + 1][0] - ctrl[i][0]) * t, y: ctrl[i][1] + (ctrl[i + 1][1] - ctrl[i][1]) * t, p: 0 }); }
    out.push({ x: ctrl[ctrl.length - 1][0], y: ctrl[ctrl.length - 1][1], p: 0 });
    out.forEach((q, i) => (q.p = prof(i / (out.length - 1))));
    return out;
  };
  const line = (x0, y0, x1, y1, prof = flat(0.6), n = 30) => poly([[x0, y0], [x1, y1]], n, prof);
  const over = (pts, k) => { const n = pts.length - 1; return pts.map((p, i) => ({ ...p, x: p.x + Math.sin(k * 1.9) * 1.2, y: p.y + (i / n) * k * 1.8 + Math.cos(k * 1.3) * 1.0 })); };
  const circle = (cx, cy, r, n = 40, off = 0, prof = flat(0.6)) => { const o = []; for (let i = 0; i <= n; i++) { const a = off + (i / n) * Math.PI * 2; o.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, p: prof(i / n) }); } return o; };
  const arc = (cx, cy, rx, ry, a0, a1, n = 20, prof = flat(0.6)) => { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; o.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, p: prof(i / n) }); } return o; };
  const ellipse = (cx, cy, rx, ry, rot = 0, n = 44, prof = flat(0.6)) => { const o = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; const x = Math.cos(a) * rx, y = Math.sin(a) * ry; o.push({ x: cx + x * Math.cos(rot) - y * Math.sin(rot), y: cy + x * Math.sin(rot) + y * Math.cos(rot), p: prof(i / n) }); } return o; };
  let seed = 1;
  const rnd = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
  const between = (lo, hi) => lo + (hi - lo) * rnd();
  const lerp = (a, b, t) => a + (b - a) * t;
  // --- the pen ------------------------------------------------------------------
  const stroke = (template, color, size, pts) => { s.applyTemplate(template); s.commit(pts, { color, size, seed: 1000 + seed++ }); };
  const fresh = (paper) => { s.clear(); s.resetView(); if (paper) s.setPaper(paper); };
  // Flat wash bands across the paper, top to bottom, with a slight tilt each (5.1).
  const bands = (y0, y1, n, colors, size = 1.7, p = 0.5) => { for (let i = 0; i < n; i++) { const y = lerp(y0, y1, i / Math.max(1, n - 1)); stroke('wash', colors[i % colors.length], size, line(-60, y + (i % 2) * 4, W + 60, y - (i % 2) * 4, flat(p), 30)); } };
  // A soft disc built from wash rings (the moon, the sun, a head).
  const disc = (cx, cy, r, color, size = 0.9, step = 9) => { for (let rr = step; rr <= r; rr += step) stroke('wash', color, size, circle(cx, cy, rr, 36, rr)); };
  // A leaf: washes first, one outline per side, then the veins (3.5).
  const leaf = (bx, by, len, wid, tilt, dir, fill = ['#4f8a48', '#6fa15a'], ink = '#2a4a2c', veins = true) => {
    const R = (x, y) => [bx + (x * Math.cos(tilt) - y * Math.sin(tilt)) * dir, by + x * Math.sin(tilt) + y * Math.cos(tilt)];
    for (const k of [0, -1, 1, -0.5, 0.5]) { const w = wid * (1 - Math.abs(k) * 0.45); stroke('wash', Math.abs(k) >= 1 ? fill[1] : fill[0], 0.65, spline([R(0, 0), R(len * 0.4, k * w * 0.62), R(len * 0.75, k * w * 0.55), R(len, 0)], 28, bell)); }
    stroke('wash', '#3f7a3c', 0.45, spline([R(len * 0.1, 0), R(len * 0.5, 3), R(len * 0.9, 0)], 20, bell));
    for (const sgn of [-1, 1]) stroke('liner', ink, 1.15, spline([R(0, 0), R(len * 0.38, sgn * wid * 0.6), R(len * 0.75, sgn * wid * 0.5), R(len, 0)], 30, bell));
    stroke('nib', ink, 0.5, spline([R(6, 0), R(len * 0.5, 2), R(len * 0.92, 0)], 24, taperOut));
    if (veins) for (let v = 1; v <= 5; v++) { const x0 = len * (0.1 + v * 0.14); for (const sgn of [-1, 1]) stroke('liner', '#3b6b3d', 0.65, spline([R(x0, 0), R(x0 + len * 0.12, sgn * wid * 0.28), R(x0 + len * 0.2, sgn * wid * 0.44)], 10, taperOut)); }
  };
  // A grass flick: press at the root, lift into the air (2.1).
  const blade = (x, y, h, lean, color, size = 1.0) => stroke('bristle', color, size, spline([[x, y], [x + lean * 0.4, y - h * 0.55], [x + lean, y - h]], 12, taperOut));

  // 1 ─ Fence
  G.fence = () => {
    fresh('washi');
    bands(40, 300, 6, ['#d3e0ec', '#dde7ef', '#e6edf2'], 1.9, 0.5);
    disc(830, 130, 54, '#f3dfae', 0.9, 9);
    // distant trees: far and pale
    for (let i = 0; i < 11; i++) { const x = 20 + i * 96 + between(-20, 20), r = between(26, 44), y = 318 - r * 0.6; for (let k = 0; k < 4; k++) stroke('spray', k % 2 ? '#b9c7a8' : '#aebda0', 2.0, circle(x + between(-10, 10), y + between(-8, 8), r * between(0.6, 1), 30, k)); stroke('liner', '#9aa38c', 0.7, line(x, y + r * 0.6, x + 2, 336, flat(0.5), 10)); }
    bands(340, 640, 8, ['#d9e1b3', '#cdd89f', '#c2cf8f'], 1.8, 0.55);
    // a path from the corner to the horizon
    for (let k = 0; k < 3; k++) stroke('wash', k ? '#e8e2ca' : '#efe9d4', 1.4 - k * 0.3, spline([[80 + k * 40, 760], [220 + k * 30, 620], [430 + k * 10, 480], [560, 380], [640, 340]], 24, (t) => 0.7 - 0.45 * t));
    // the fence, running into the distance
    const posts = [];
    for (let i = 0; i < 7; i++) { const t = i / 6; posts.push({ x: lerp(110, 900, t), base: lerp(650, 420, Math.pow(t, 0.85)), h: lerp(330, 150, t), w: lerp(1.6, 0.9, t) }); }
    for (const p of posts) {
      const base = line(p.x, p.base - p.h, p.x + 2, p.base, flat(0.7), 36);
      stroke('bristle', '#7a5a3a', p.w * 1.1, line(p.x + 1, p.base - p.h + 6, p.x + 3, p.base, flat(0.6), 30));
      for (let k = 0; k < 3; k++) stroke('liner', '#4a3626', p.w, over(base, k));
      stroke('charcoal', '#6b7452', 1.2, line(p.x - 14 * p.w, p.base + 4, p.x + 30 * p.w, p.base + 8, flat(0.45), 10));
      for (let h = 0; h < 5; h++) stroke('ballpoint', '#5a4632', 0.8, line(p.x - 3, p.base - p.h + 20 + h * (p.h / 5.5), p.x + 5, p.base - p.h + 24 + h * (p.h / 5.5), flat(0.5), 6));
    }
    for (const f of [0.22, 0.58]) {
      const pts = posts.map((p) => [p.x, p.base - p.h * (1 - f)]);
      const rail = spline(pts, 10, flat(0.65));
      for (let k = 0; k < 3; k++) stroke('liner', '#4a3626', 1.3, over(rail, k));
    }
    // grass: shorter far away, taller and darker in front
    for (let i = 0; i < 160; i++) { const t = rnd(); const y = lerp(420, 745, t * t), x = between(-10, 1010); const h = lerp(14, 90, t) * between(0.7, 1.2); blade(x, y, h, between(-30, 30) * (0.4 + t), t > 0.6 ? (i % 2 ? '#4f7a33' : '#5f8f3d') : '#8fae6a', lerp(0.7, 1.2, t)); }
    for (let i = 0; i < 6; i++) { const x = between(40, 300), y = between(690, 745); blade(x, y, between(90, 130), between(-10, 30), '#3f6b2f', 1.1); stroke('bristle', '#8a7a4a', 1.0, spline([[x + 12, y - 118], [x + 14, y - 134], [x + 16, y - 150]], 8, (t) => 0.9 - 0.5 * t)); }
    for (let i = 0; i < 5; i++) stroke('liner', '#2a2a2a', 0.8, poly([[560 + i * 30, 120 + (i % 2) * 10 + i * 4], [572 + i * 30, 112 + (i % 2) * 10 + i * 4], [584 + i * 30, 120 + (i % 2) * 10 + i * 4]], 6, flat(0.55)));
  };

  // 2 ─ Sea and moon
  G.sea = () => {
    fresh('hotpress');
    bands(20, 290, 7, ['#dfe7ee', '#d5dfe8', '#cad6e2'], 2.0, 0.5);
    const mx = 720, my = 140;
    for (let rr = 70; rr <= 100; rr += 15) stroke('wash', '#f4ecd6', 1.0, circle(mx, my, rr, 40, rr));
    disc(mx, my, 54, '#f2e4b8', 0.9, 8);
    for (let r = 6; r <= 60; r += 8) stroke('spray', r < 40 ? '#e6d29a' : '#d2bd82', 2.0, circle(mx, my, r, 40, r * 0.3));
    stroke('liner', '#5e7d9a', 0.7, spline([[-20, 300], [250, 299], [500, 301], [750, 299], [1020, 300]], 12, flat(0.5)));
    // the reflection, broken into swells that widen toward us
    for (let i = 0; i < 16; i++) { const y = 318 + i * i * 1.4 + i * 8, w = 14 + i * 4, x = mx + between(-12, 12) * (1 + i * 0.1); stroke('wash', i < 6 ? '#e3d3a0' : '#d6c184', 0.45 + i * 0.02, spline([[x - w, y], [x, y - 2], [x + w, y]], 8, bell)); }
    // waves: one motion each, phase drifting, far thin and pale, near thick and dark
    for (let i = 0; i < 12; i++) {
      const t = i / 11, y = 312 + t * t * 330 + t * 40, amp = 4 + t * 34, phase = between(0, 1), n = 6 + Math.round(t * 3);
      const ctrl = []; for (let k = 0; k <= n; k++) ctrl.push([-40 + ((W + 80) * k) / n, y + Math.sin(k * Math.PI + phase * 6) * amp * 0.5]);
      const color = t < 0.3 ? '#7f9bb4' : t < 0.65 ? '#3d6386' : '#1f3d5c';
      stroke(t < 0.3 ? 'nib' : 'liner', color, t < 0.3 ? 0.5 : 0.9 + t * 0.6, spline(ctrl, 14, flat(0.45 + t * 0.2)));
      if (t > 0.4) stroke('liner', color, 0.7, spline(ctrl.map(([x, yy]) => [x + 30, yy + 10 + t * 8]), 14, flat(0.35)));
    }
    for (let i = 0; i < 22; i++) { const t = rnd(); const x = between(40, 960), y = lerp(420, 700, t * t); stroke('nib', '#1d3a5a', 0.5 + t * 0.4, spline([[x, y], [x + 22 + t * 20, y - 6 - t * 6], [x + 50 + t * 40, y + 2]], 10, bell)); }
    // a boat, small against all that water
    const bx = 300, by = 430;
    stroke('charcoal', '#2b3a4c', 1.3, poly([[bx - 34, by], [bx + 40, by], [bx + 30, by + 14], [bx - 26, by + 14], [bx - 34, by]], 8, flat(0.8)));
    for (let k = 0; k < 3; k++) stroke('charcoal', '#2b3a4c', 1.2, line(bx - 30 + k * 2, by + 4 + k * 4, bx + 34 - k * 3, by + 4 + k * 4, flat(0.7), 10));
    stroke('liner', '#2b3a4c', 1.0, line(bx + 4, by, bx + 4, by - 70, flat(0.6), 14));
    for (let k = 0; k < 5; k++) stroke('flat', '#3a4656', 1.0, line(bx + 6, by - 66 + k * 12, bx + 6 + 8 + k * 7, by - 60 + k * 12, flat(0.6), 8));
    stroke('liner', '#2b3a4c', 0.9, poly([[bx + 4, by - 70], [bx + 40, by - 6], [bx + 4, by - 6]], 8, flat(0.6)));
    for (let i = 0; i < 6; i++) stroke('charcoal', i < 3 ? '#1f3d5c' : '#162e47', 1.5, spline([[-20, 672 + i * 14], [250, 660 + i * 14 + (i % 2) * 6], [520, 680 + i * 14], [800, 664 + i * 14], [1020, 678 + i * 14]], 16, flat(0.5 + i * 0.05)));
  };

  // 3 ─ Three ridges
  G.mountains = () => {
    fresh('bristol');
    bands(30, 260, 5, ['#f0e8d8', '#f3ede1'], 2.0, 0.4);
    disc(720, 180, 60, '#eccb84', 0.9, 10);
    stroke('graphite', '#c9a24a', 1.2, ellipse(720, 180, 66, 62, 0.2, 48, flat(0.5)));
    // three ridges, far to near; each flank hatched along its slope on the shadow side
    const ridges = [
      { pts: [[-20, 420], [130, 300], [250, 380], [400, 240], [520, 350], [640, 290], [780, 400], [900, 330], [1020, 410]], color: '#b3bcc8', size: 0.9, passes: 1, hatch: 3, hatchColor: '#c4ccd6' },
      { pts: [[-20, 500], [110, 400], [260, 470], [430, 340], [560, 450], [700, 380], [830, 480], [1020, 430]], color: '#7e8c9e', size: 1.2, passes: 2, hatch: 6, hatchColor: '#97a4b4' },
      { pts: [[-20, 600], [90, 520], [230, 580], [380, 470], [500, 560], [660, 500], [790, 600], [1020, 540]], color: '#2f3a48', size: 1.5, passes: 3, hatch: 12, hatchColor: '#3a4656' },
    ];
    ridges.forEach((r, ri) => {
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [a, b] = [r.pts[i], r.pts[i + 1]];
        const down = b[1] > a[1]; // a descending flank faces right: the shadow side
        if (!down && ri < 2) continue;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let k = 1; k <= r.hatch; k++) {
          const t = k / (r.hatch + 1), x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t);
          const L = (down ? 1 : 0.6) * lerp(40, 110, ri / 2) * (0.6 + 0.4 * Math.sin(t * Math.PI));
          const dx = (b[0] - a[0]) / len, dy = (b[1] - a[1]) / len;
          const tool = ri === 2 ? 'charcoal' : 'graphite';
          stroke(tool, r.hatchColor, ri === 2 ? 1.5 : 0.9, spline([[x, y], [x + dx * L * 0.5 + 4, y + Math.abs(dy) * L * 0.5 + L * 0.3], [x + dx * L * 0.7 + 8, y + L * 0.9]], 10, taperOut));
        }
      }
      for (let k = 0; k < r.passes; k++) stroke('graphite', r.color, r.size, over(poly(r.pts, 14, flat(0.65)), k));
    });
    // the near mass, then trees along its crest
    {
      const P = ridges[2].pts;
      const ridgeY = (x) => { for (let i = 0; i < P.length - 1; i++) if (x >= P[i][0] && x <= P[i + 1][0]) return lerp(P[i][1], P[i + 1][1], (x - P[i][0]) / (P[i + 1][0] - P[i][0])); return P[P.length - 1][1]; };
      const slope = (x) => { for (let i = 0; i < P.length - 1; i++) if (x >= P[i][0] && x <= P[i + 1][0]) return (P[i + 1][1] - P[i][1]) / (P[i + 1][0] - P[i][0]); return 0; };
      for (let i = 0; i < 260; i++) {
        const x = between(-20, 1020), top = ridgeY(x); const depth = between(0, 1); const y = lerp(top + 6, H + 20, depth * depth);
        if (y > H + 10) continue;
        const L = between(40, 110), k = slope(x) * 0.6, dark = depth < 0.35 ? '#4a5768' : depth < 0.7 ? '#3a4656' : '#252d3a';
        stroke('charcoal', dark, 1.6, spline([[x - L / 2, y - k * L / 2], [x, y + 3], [x + L / 2, y + k * L / 2]], 8, flat(0.45 + depth * 0.4)));
      }
      for (let i = 0; i < 5; i++) stroke('charcoal', '#1f2733', 1.5, spline([[-20, 700 + i * 12], [400, 694 + i * 12], [1020, 702 + i * 12]], 12, flat(0.65)));
    }
    const crest = poly(ridges[2].pts, 6, flat(0.5));
    for (let i = 0; i < crest.length; i += 2) { const q = crest[i]; if (rnd() < 0.35) continue; stroke('bristle', '#2a3442', 0.9, spline([[q.x, q.y + 4], [q.x + between(-2, 2), q.y - 10], [q.x + between(-3, 3), q.y - between(16, 30)]], 6, taperOut)); }
    for (let i = 0; i < 7; i++) { const x = 150 + i * 44, y = 150 + Math.sin(i * 0.9) * 16 + i * 3; stroke('liner', '#2a2a2a', 0.8, poly([[x, y + 6], [x + 9, y], [x + 18, y + 6]], 6, flat(0.5))); }
  };

  // 4 ─ Kites
  G.kites = () => {
    fresh('hotpress');
    bands(30, 420, 9, ['#cfe0ef', '#d9e6f1', '#e3edf4'], 2.0, 0.5);
    // hills, far pale to near dark
    for (const [y, color, size] of [[520, '#cfdcae', 1.9], [590, '#b9cd90', 1.9], [660, '#9fba74', 2.0]]) for (let k = 0; k < 4; k++) stroke('wash', color, size, spline([[-40, y + 20 + k * 22], [250, y - 10 + k * 22], [520, y + 24 + k * 22], [800, y - 6 + k * 22], [1040, y + 18 + k * 22]], 20, flat(0.55)));
    const hand = [360, 700];
    const kite = (cx, cy, w, h, color, fill, fill2) => {
      const d = [[cx, cy - h], [cx + w, cy], [cx, cy + h * 1.4], [cx - w, cy]];
      for (let k = -2; k <= 2; k++) { const f = k / 2; stroke('wash', k % 2 ? fill2 : fill, 0.8, spline([[cx - w * (1 - Math.abs(f) * 0.9) + 4, cy + f * h * 0.6], [cx, cy + f * h * 0.7], [cx + w * (1 - Math.abs(f) * 0.9) - 4, cy + f * h * 0.6]], 12, flat(0.6))); }
      for (let k = 0; k < 2; k++) stroke('chisel', color, 1.0, over(poly([...d, d[0]], 12, flat(0.75)), k));
      stroke('liner', '#1a1c23', 0.9, poly([d[0], d[2]], 10, flat(0.5)));
      stroke('liner', '#1a1c23', 0.9, poly([d[3], d[1]], 10, flat(0.5)));
      const tail = spline([[cx, cy + h * 1.4], [cx - 22, cy + h * 1.4 + 60], [cx + 16, cy + h * 1.4 + 120], [(cx + hand[0]) / 2 - 24, (cy + h * 1.4 + hand[1]) / 2], [hand[0], hand[1]]], 18, flat(0.5));
      stroke('liner', '#1a1c23', 1.0, tail);
      for (let i = 1; i <= 4; i++) { const q = tail[Math.round((i / 10) * (tail.length - 1))]; for (const sgn of [-1, 1]) stroke('chisel', color, 0.7, poly([[q.x, q.y], [q.x + sgn * 12, q.y - 7], [q.x + sgn * 12, q.y + 7], [q.x, q.y]], 5, flat(0.8))); }
    };
    kite(230, 230, 46, 48, '#c9407c', '#f4bfd4', '#eea3c2');
    kite(540, 150, 60, 64, '#2c6fb5', '#c2d8ee', '#a9c8e6');
    kite(760, 320, 38, 40, '#e0a020', '#f7e1a8', '#f2d283');
    // clouds: spray, faint
    for (const [x, y, r] of [[120, 120, 40], [420, 90, 34], [880, 200, 44]]) for (let k = 0; k < 6; k++) stroke('spray', '#eef2f5', 2.4, circle(x + k * r * 0.5 - r, y + Math.sin(k) * 8, r * between(0.6, 1), 28, k));
    // grass on the near hill
    for (let i = 0; i < 90; i++) { const x = between(-10, 1010), y = between(660, 748); blade(x, y, between(20, 60), between(-20, 20), i % 3 ? '#5f8f3d' : '#4f7a33', between(0.8, 1.1)); }
    // the person: a silhouette, arm up to the string
    disc(hand[0] - 30, hand[1] - 92, 14, '#3a3a3a', 0.6, 5);
    stroke('charcoal', '#3a3a3a', 1.6, poly([[hand[0] - 30, hand[1] - 76], [hand[0] - 34, hand[1] - 20]], 10, flat(0.85)));
    stroke('charcoal', '#3a3a3a', 1.4, poly([[hand[0] - 32, hand[1] - 66], [hand[0] - 4, hand[1] - 4]], 8, flat(0.8)));
    stroke('charcoal', '#3a3a3a', 1.3, poly([[hand[0] - 32, hand[1] - 62], [hand[0] - 52, hand[1] - 30]], 8, flat(0.75)));
    for (const sgn of [-1, 1]) stroke('charcoal', '#3a3a3a', 1.5, poly([[hand[0] - 34, hand[1] - 22], [hand[0] - 34 + sgn * 12, hand[1] + 30]], 8, flat(0.85)));
  };

  // 5 ─ Reeds in rain
  G.reeds = () => {
    fresh('washi');
    bands(20, 520, 9, ['#dde2e6', '#e4e8eb', '#d6dce1'], 2.0, 0.45);
    // far reeds: pale, thin, short
    for (let i = 0; i < 9; i++) { const x = 40 + i * 110 + between(-20, 20), top = between(360, 430); stroke('bristle', '#a9c19a', 0.9, spline([[x, 560], [x + 12, 480], [x + 30, top]], 14, taperOut)); }
    bands(560, 750, 6, ['#b7cbd8', '#a9c0cf', '#9db6c7'], 2.0, 0.5);
    const reeds = [[150, 0.14, 150], [230, 0.22, 200], [300, 0.08, 120], [500, 0.24, 170], [570, 0.16, 110], [690, 0.3, 190], [760, 0.2, 130], [850, 0.1, 220]];
    // reflections first, under the water line
    for (const [x, sway, top] of reeds) for (let k = 0; k < 2; k++) stroke('bristle', k ? '#8fae8a' : '#9fb89a', 1.0, spline([[x + k * 6, 566], [x + sway * 40 + k * 4, 640], [x + sway * 90, 700 - top * 0.25]], 12, taperOut));
    for (let i = 0; i < 18; i++) { const x = between(20, 980), y = between(580, 740); stroke('liner', '#8aa4b8', 0.7, spline([[x - 34, y], [x, y - 3], [x + 34, y]], 8, (t) => 0.25 + 0.3 * Math.sin(t * Math.PI))); }
    // the reeds: press once at the water, lift all the way to the tip
    for (const [x, sway, top] of reeds) {
      stroke('bristle', '#3f6b3a', 1.3, spline([[x, 580], [x + sway * 90, 580 - (580 - top) * 0.5], [x + sway * 260, top]], 22, taperOut));
      stroke('bristle', '#2f5a33', 0.8, spline([[x + 3, 580], [x + sway * 90 + 3, 580 - (580 - top) * 0.5], [x + sway * 250, top + 20]], 22, taperOut));
      for (let k = 0; k < 2; k++) { const y0 = between(320, 480); const t = (580 - y0) / (580 - top); const bx = x + sway * 260 * t * t + sway * 90 * 2 * t * (1 - t); const dir = k ? 1 : -1; stroke('bristle', '#4f8a48', 0.85, spline([[bx, y0], [bx + dir * 34, y0 - 28], [bx + dir * 76, y0 - 46]], 10, taperOut)); }
      if (sway > 0.12) { const tx = x + sway * 260, ty = top; for (let k = 0; k < 2; k++) stroke('bristle', '#5a4630', 1.5, line(tx + k * 2, ty + 18, tx + k * 2 + 2, ty - 26, flat(0.95), 10)); stroke('nib', '#5a4630', 0.5, line(tx + 2, ty - 26, tx + 3, ty - 44, taperOut, 6)); }
    }
    for (let i = 0; i < 40; i++) { const x = 20 + i * 24 + between(-8, 8); blade(x, 585, between(20, 50), between(-14, 14), i % 2 ? '#5b7f3a' : '#6f9448', between(0.8, 1.1)); }
    for (let i = 0; i < 70; i++) { const x = between(20, 980), y = between(20, 520); stroke('liner', '#5f6f9a', 0.6, spline([[x, y], [x - 4, y + 18], [x - 8, y + 38]], 8, (t) => 0.15 + 0.5 * Math.sin(Math.min(1, t * 1.15) * Math.PI))); }
  };

  // 6 ─ Bamboo
  G.bamboo = () => {
    fresh('hotpress');
    for (let i = 0; i < 4; i++) stroke('wash', '#e6ecdc', 1.9, line(140 + i * 110, -20, 70 + i * 110, H + 20, flat(0.45), 30));
    const stalk = (x0, lean, segs, size, color, y0 = 700) => {
      let y = y0, x = x0;
      for (let i = 0; i < segs; i++) { const len = 118 + i * 10, nx = x + lean * len; stroke('nib', color, size, line(x, y, nx, y - len, node, 26)); stroke('nib', color, size, line(nx - 16, y - len - 4, nx + 18, y - len - 8, flat(0.95), 8)); y -= len + 8; x = nx; }
    };
    const cluster = (bx, by, dir, colors, size = 0.9, n = 5) => { for (let k = 0; k < n; k++) { const a = dir + (k - (n - 1) / 2) * 0.32, L = between(70, 125); stroke('brushpen', colors[k % colors.length], size, spline([[bx, by], [bx + Math.cos(a) * L * 0.5, by + Math.sin(a) * L * 0.5 + 6], [bx + Math.cos(a) * L, by + Math.sin(a) * L + 14]], 12, thin)); } };
    // far culms, pale
    stalk(180, 0.05, 5, 0.5, '#b4c7ab'); stalk(720, -0.04, 5, 0.45, '#b4c7ab'); stalk(820, 0.02, 4, 0.5, '#c0d0b8', 640);
    cluster(200, 380, -0.5, ['#b4c7ab', '#c0d0b8'], 0.7, 4); cluster(705, 300, 2.8, ['#b4c7ab'], 0.7, 4); cluster(830, 460, -0.3, ['#c0d0b8'], 0.7, 3);
    // near culms
    stalk(320, 0.04, 5, 0.85, '#2f5a33'); stalk(450, -0.03, 4, 0.75, '#3d6b3a'); stalk(580, 0.06, 5, 0.95, '#24462a');
    const greens = ['#2f5a33', '#4f8a48', '#24462a'];
    cluster(342, 330, -0.4, greens); cluster(438, 470, 2.9, greens, 0.95, 6); cluster(612, 260, -0.2, greens, 1.0, 6); cluster(572, 520, 3.1, greens); cluster(492, 200, -1.0, greens, 0.9, 5); cluster(330, 560, 2.6, ['#24462a', '#2f5a33'], 0.9, 4); cluster(620, 640, -0.5, greens, 0.9, 4);
    // ground: a rock and a few pencil marks
    for (let k = 0; k < 4; k++) stroke('charcoal', '#5a5e58', 1.5, spline([[420 + k * 6, 712 - k * 8], [470, 690 - k * 6], [530 - k * 8, 714 - k * 4]], 12, flat(0.5 + k * 0.08)));
    for (let i = 0; i < 8; i++) stroke('graphite', '#8a847a', 0.9, line(200 + i * 80, 718 + (i % 2) * 6, 250 + i * 80, 722 + (i % 2) * 6, flat(0.4), 8));
    stroke('chisel', '#b5451b', 0.9, poly([[830, 620], [870, 620], [870, 660], [830, 660], [830, 620]], 8, flat(0.9)));
    stroke('chisel', '#b5451b', 0.5, poly([[842, 632], [858, 648]], 6, flat(0.8)));
  };

  // 7 ─ Three leaves
  G.leaf = () => {
    fresh('washi');
    // soft shadows first, offset down and right
    for (const [x, y, len, wid, tilt] of [[250, 575, 520, 150, -0.62], [660, 655, 300, 90, -1.25], [140, 300, 210, 64, -0.2]]) for (let k = 0; k < 3; k++) stroke('spray', '#cfcabd', 2.4, spline([[x + 14, y + 14], [x + 14 + Math.cos(tilt) * len * 0.5 - Math.sin(tilt) * (k - 1) * wid * 0.3, y + 14 + Math.sin(tilt) * len * 0.5 + Math.cos(tilt) * (k - 1) * wid * 0.3], [x + 14 + Math.cos(tilt) * len, y + 14 + Math.sin(tilt) * len]], 14, flat(0.35)));
    leaf(230, 560, 520, 150, -0.62, 1);
    leaf(640, 640, 300, 90, -1.25, 1, ['#5f9450', '#7fb065']);
    leaf(120, 290, 210, 64, -0.2, 1, ['#4f8a48', '#6fa15a']);
    stroke('bristle', '#6b5a3c', 1.2, spline([[230, 560], [190, 620], [150, 700]], 14, taperIn));
    stroke('bristle', '#6b5a3c', 1.0, spline([[640, 640], [660, 690], [700, 730]], 12, taperIn));
    stroke('bristle', '#6b5a3c', 0.9, spline([[120, 290], [90, 320], [60, 330]], 10, taperIn));
    // two berries: wash discs, then one liner ring each (wash before line)
    for (const [x, y] of [[560, 200], [598, 226]]) { disc(x, y, 16, '#b5451b', 0.6, 5); stroke('liner', '#7f2f11', 0.9, circle(x, y, 17, 30, 1, flat(0.5))); stroke('nib', '#f6f2ea', 0.4, spline([[x - 7, y - 7], [x - 4, y - 9], [x - 1, y - 7]], 6, bell)); }
    stroke('liner', '#6b5a3c', 0.8, spline([[560, 184], [575, 160], [600, 150]], 10, flat(0.5)));
    stroke('liner', '#6b5a3c', 0.8, spline([[598, 210], [592, 175], [600, 150]], 10, flat(0.5)));
  };

  // 8 ─ Sunflowers
  G.sunflower = () => {
    fresh('washi');
    bands(560, 750, 6, ['#d9e1b3', '#cdd89f', '#c2cf8f'], 1.9, 0.5);
    const flower = (cx, cy, R, petals, size, pale) => {
      const y1 = pale ? '#f5d789' : '#f3c451', y2 = pale ? '#efc86a' : '#e6a52e', edge = pale ? '#d9ad55' : '#c98d2a';
      for (let i = 0; i < petals; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / petals + (i % 2) * 0.09, L = R * (1 + (i % 2) * 0.14), w = R * 0.3;
        const P = (x, y) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)];
        for (const k of [0, -0.5, 0.5, -1, 1, -0.75, 0.75]) stroke('wash', Math.abs(k) > 0.8 ? y2 : y1, size * 1.15, spline([P(R * 0.25, k * 5), P(L * 0.45, k * w * 0.55), P(L * 0.8, k * w * 0.36), P(L - Math.abs(k) * 12, 0)], 22, (t) => 0.55 + 0.4 * Math.sin(t * Math.PI)));
        stroke('wash', edge, size * 0.6, spline([P(R * 0.3, 0), P(L * 0.5, 2), P(L * 0.9, 0)], 16, bell));
        stroke('graphite', edge, 0.7, spline([P(R * 0.35, 0), P(R * 0.35 + L * 0.2, 1), P(R * 0.35 + L * 0.34, 0)], 8, taperOut));
      }
      const disk = R * 0.42;
      disc(cx, cy, disk, pale ? '#8a5a2a' : '#6b3f12', 0.9, 8);
      for (let rr = 12; rr <= disk; rr += 12) stroke('wash', '#4a2c12', 0.8, arc(cx, cy, rr, rr, 0.2, Math.PI + 0.6, 24, flat(0.6)));
      for (let i = 0; i < 26 * disk / 30; i++) { const a = i * 2.39996, r = 5 + Math.sqrt(i) * (disk / 8); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; stroke('chisel', i % 3 ? '#4a2c12' : '#7a4a1a', 0.45, line(x - 3, y - 2, x + 4, y + 3, flat(0.9), 5)); }
      stroke('graphite', '#4a2c12', 1.1, circle(cx, cy, disk + 4, 48, 0.3, flat(0.55)));
      stroke('charcoal', '#3a2210', 1.2, arc(cx, cy, disk + 2, disk + 2, 0.3, 2.2, 20, flat(0.5)));
    };
    // the far flower first, smaller and paler; its stem
    stroke('bristle', '#6f9448', 1.3, spline([[770, 350], [760, 480], [772, 620], [764, 720]], 30, (t) => 0.6 + 0.3 * t));
    flower(770, 260, 92, 14, 0.8, true);
    leaf(766, 520, 110, 40, -0.5, -1, ['#6f9448', '#8fae6a'], '#3b6b3d', false);
    // the near flower
    stroke('bristle', '#3f6b3a', 2.1, spline([[430, 420], [420, 560], [436, 690], [428, 760]], 36, (t) => 0.7 + 0.25 * t));
    stroke('bristle', '#2f5a33', 1.2, spline([[436, 424], [426, 560], [442, 690], [434, 760]], 36, (t) => 0.5 + 0.3 * t));
    flower(430, 300, 150, 16, 0.95, false);
    leaf(426, 560, 190, 62, -0.45, -1);
    leaf(438, 640, 170, 56, -0.35, 1);
    for (let i = 0; i < 60; i++) { const x = between(-10, 1010), y = between(690, 748); blade(x, y, between(20, 60), between(-20, 20), i % 3 ? '#5f8f3d' : '#4f7a33', between(0.8, 1.1)); }
  };

  // 9 ─ Three forms: a cube, a sphere, a cylinder; light from the upper left
  G.cube = () => {
    fresh('bristol');
    const ink = '#1a1c23';
    const hatchQuad = (p0, p1, p2, p3, n, dbl) => {
      for (let i = 1; i < n; i++) { const t = i / n; const a = [lerp(p0[0], p1[0], t), lerp(p0[1], p1[1], t)], b = [lerp(p3[0], p2[0], t), lerp(p3[1], p2[1], t)]; stroke('ballpoint', ink, 1.0, line(a[0], a[1], b[0], b[1], flat(0.55), 16)); }
      if (dbl) for (let i = 1; i < n; i++) { const t = i / n; const a = [lerp(p0[0], p3[0], t), lerp(p0[1], p3[1], t)], b = [lerp(p1[0], p2[0], t), lerp(p1[1], p2[1], t)]; stroke('ballpoint', ink, 1.0, line(a[0], a[1], b[0], b[1], flat(0.55), 16)); }
    };
    const edge = (p, q, passes = 2) => { const base = poly([p, q], 14, flat(0.65)); for (let k = 0; k < passes; k++) stroke('liner', ink, 1.2, over(base, k)); };
    // cube
    const A = [150, 300], B = [330, 275], C = [380, 365], D = [200, 395], E = [150, 480], F = [380, 545], Hh = [200, 575];
    edge(A, B); edge(B, C); edge(C, D); edge(D, A); edge(A, E); edge(D, Hh); edge(C, F); edge(E, Hh); edge(Hh, F);
    hatchQuad(D, C, F, Hh, 12, true);
    hatchQuad(A, D, Hh, E, 7, false);
    hatchQuad(A, B, C, D, 4, false);
    // sphere: one closed motion for the outline, then contour hatching that wraps the shadow side
    const sx = 560, sy = 450, sr = 95;
    stroke('liner', ink, 1.2, circle(sx, sy, sr, 64, -2.2, flat(0.65)));
    for (let i = 0; i < 9; i++) { const t = i / 8; const ry = sr * (0.25 + t * 0.75); stroke('ballpoint', ink, 1.0, arc(sx, sy, sr * 0.98, ry, 0.35 - t * 0.2, Math.PI * 0.95 + t * 0.3, 26, (u) => 0.25 + 0.4 * Math.sin(u * Math.PI))); }
    for (let i = 0; i < 6; i++) { const t = i / 5; stroke('ballpoint', ink, 1.0, arc(sx, sy, sr * 0.97, sr * 0.97, 0.9 - t * 0.55, 2.1 + t * 0.4, 20, (u) => 0.2 + 0.4 * Math.sin(u * Math.PI))); }
    // cylinder: an ellipse on top, straight sides, vertical hatching that darkens toward the right
    const cx = 800, cy = 320, rx = 80, ry = 26, ch = 230;
    stroke('liner', ink, 1.2, ellipse(cx, cy, rx, ry, 0, 48, flat(0.65)));
    edge([cx - rx, cy], [cx - rx, cy + ch]); edge([cx + rx, cy], [cx + rx, cy + ch]);
    stroke('liner', ink, 1.2, arc(cx, cy + ch, rx, ry, 0, Math.PI, 30, flat(0.65)));
    for (let i = 0; i < 18; i++) { const t = i / 17; const x = cx - rx + 8 + t * (2 * rx - 16); const dark = Math.max(0, t - 0.35) / 0.65; if (rnd() > 0.25 + dark) continue; stroke('ballpoint', ink, 1.0, line(x, cy + ry * Math.sqrt(Math.max(0, 1 - Math.pow((x - cx) / rx, 2))) + 2, x, cy + ch + ry * Math.sqrt(Math.max(0, 1 - Math.pow((x - cx) / rx, 2))) - 2, flat(0.35 + dark * 0.35), 16)); }
    // cast shadows to the right, hatched flat
    const shadow = (x0, y0, w, n) => { for (let i = 0; i < n; i++) stroke('ballpoint', ink, 1.0, line(x0 + i * 12, y0 + i * 2, x0 + w + i * 12, y0 - 4 + i * 2, flat(0.4), 14)); };
    shadow(230, 585, 220, 10); shadow(600, 550, 200, 9); shadow(880, 560, 120, 8);
    stroke('graphite', '#8a847a', 1.0, line(60, 640, 960, 640, flat(0.5), 30));
  };
});

const pieces = ['fence', 'sea', 'mountains', 'kites', 'reeds', 'bamboo', 'leaf', 'sunflower', 'cube'];
for (const name of pieces) {
  const t0 = Date.now();
  const n = await page.evaluate(async (k) => {
    window.__gallery[k]();
    const s = window.__studio;
    s.flushPaint();
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
    s.flushPaint(); s.gl.blitCommitted();
    return s.strokes().length;
  }, name);
  const png = await page.evaluate(() => { window.__studio.gl.blitCommitted(); return document.querySelector('#ink-canvas').toDataURL('image/png'); });
  const jpg = await page.evaluate(() => { window.__studio.gl.blitCommitted(); return document.querySelector('#ink-canvas').toDataURL('image/jpeg', 0.86); });
  fs.writeFileSync(`${OUT}${name}.png`, Buffer.from(png.split(',')[1], 'base64'));
  fs.writeFileSync(`${OUT}${name}.jpg`, Buffer.from(jpg.split(',')[1], 'base64'));
  console.log(name, JSON.stringify({ strokes: n, ms: Date.now() - t0, kb: Math.round(fs.statSync(`${OUT}${name}.jpg`).size / 1024) }));
}
await browser.close();
