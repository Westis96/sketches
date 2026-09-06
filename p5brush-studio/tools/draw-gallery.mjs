// Usage: build the app, serve dist on :8768 (npx http-server dist -p 8768 -s), then `node tools/draw-gallery.mjs`.
// Renders a gallery of drawings through the studio engine, each built the way the
// lessons teach: superimposed lines, one-motion curves, corners as full stops,
// strokes pulled from the dot, tapers and swells, wash before line, far to near.
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = new URL('../docs/gallery/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 750 } });
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:8768/index.html#/sketch', { waitUntil: 'load' });
await page.waitForFunction(() => window.__studio && window.__studio.state.templatePreviews);
await page.evaluate(() => { window.__sfx?.setEnabled(false); window.__studio.dismissWelcome?.(); });
await page.addStyleTag({ content: '[data-sonner-toaster]{display:none !important}' });

// Everything below runs in the page: helpers first, then one function per piece.
await page.evaluate(() => {
  const s = window.__studio;
  const W = 1000, H = 750;
  const G = (window.__gallery = {});
  // --- geometry ---------------------------------------------------------------
  const bell = (t) => 0.5 + 0.4 * Math.sin(t * Math.PI);
  const taperOut = (t) => 0.85 - 0.55 * t;
  const taperIn = (t) => 0.3 + 0.55 * t;
  const flat = (p) => () => p;
  const thin = (t) => 0.3 + 0.6 * Math.sin(t * Math.PI); // thin-thick-thin (a brush-pen leaf)
  const node = (t) => 0.95 - 0.5 * Math.sin(t * Math.PI); // heavy-light-heavy (a bamboo segment)
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
  // Straight segments through the control points: corners stay corners.
  const poly = (ctrl, per = 12, prof = flat(0.6)) => {
    const out = [];
    for (let i = 0; i < ctrl.length - 1; i++) for (let k = 0; k < per; k++) { const t = k / per; out.push({ x: ctrl[i][0] + (ctrl[i + 1][0] - ctrl[i][0]) * t, y: ctrl[i][1] + (ctrl[i + 1][1] - ctrl[i][1]) * t, p: 0 }); }
    out.push({ x: ctrl[ctrl.length - 1][0], y: ctrl[ctrl.length - 1][1], p: 0 });
    out.forEach((q, i) => (q.p = prof(i / (out.length - 1))));
    return out;
  };
  const line = (x0, y0, x1, y1, prof = flat(0.6), n = 30) => poly([[x0, y0], [x1, y1]], n, prof);
  // The same stroke again over itself, nudged like a hand would (superimposed lines).
  const over = (pts, k) => { const n = pts.length - 1; return pts.map((p, i) => ({ ...p, x: p.x + Math.sin(k * 1.9) * 1.2, y: p.y + (i / n) * k * 1.8 + Math.cos(k * 1.3) * 1.0 })); };
  const circle = (cx, cy, r, n = 40, off = 0, prof = flat(0.6)) => { const o = []; for (let i = 0; i <= n; i++) { const a = off + (i / n) * Math.PI * 2; o.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, p: prof(i / n) }); } return o; };
  const ellipse = (cx, cy, rx, ry, rot = 0, n = 44, prof = flat(0.6)) => { const o = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; const x = Math.cos(a) * rx, y = Math.sin(a) * ry; o.push({ x: cx + x * Math.cos(rot) - y * Math.sin(rot), y: cy + x * Math.sin(rot) + y * Math.cos(rot), p: prof(i / n) }); } return o; };
  let seed = 1;
  const rnd = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
  const between = (lo, hi) => lo + (hi - lo) * rnd();
  // --- the pen ----------------------------------------------------------------
  const stroke = (template, color, size, pts) => { s.applyTemplate(template); s.commit(pts, { color, size, seed: 1000 + seed++ }); };
  const fresh = (paper) => { s.clear(); s.resetView(); if (paper) s.setPaper(paper); };

  // 1 ─ Fence: superimposed lines (1.1), flat wash bands (5.1), grass flicks (2.1), hatching (5.4)
  G.fence = () => {
    fresh('washi');
    for (let i = 0; i < 4; i++) stroke('wash', '#cfdcea', 1.6, line(-40, 90 + i * 70, W + 40, 96 + i * 70 + (i % 2) * 6, flat(0.45), 30));
    for (let i = 0; i < 3; i++) stroke('wash', i === 1 ? '#c1cf93' : '#cdd9a3', 1.4, line(-40, 560 + i * 44, W + 40, 552 + i * 44, flat(0.55), 30));
    const posts = [140, 300, 460, 620, 780];
    for (const x of posts) { const base = line(x, 300 + between(-6, 6), x + 3, 600, flat(0.7), 36); for (let k = 0; k < 3; k++) stroke('liner', '#3b2f22', 1.4, over(base, k)); }
    for (const y of [360, 470]) { const base = line(120, y, 810, y + 14, flat(0.65), 60); for (let k = 0; k < 3; k++) stroke('liner', '#3b2f22', 1.3, over(base, k)); }
    for (const x of posts) for (let h = 0; h < 6; h++) stroke('ballpoint', '#5a4632', 0.9, line(x - 4, 330 + h * 44, x + 6, 336 + h * 44, flat(0.5), 6));
    for (let i = 0; i < 46; i++) { const x = 60 + i * 20 + between(-6, 6), h = between(40, 95), lean = between(-25, 25); stroke('bristle', i % 3 ? '#5b7f3a' : '#6f9448', between(0.8, 1.2), spline([[x, 640], [x + lean * 0.4, 640 - h * 0.55], [x + lean, 640 - h]], 12, taperOut)); }
    for (let i = 0; i < 5; i++) stroke('liner', '#2a2a2a', 0.8, poly([[700 + i * 34, 150 + (i % 2) * 8], [712 + i * 34, 142 + (i % 2) * 8], [724 + i * 34, 150 + (i % 2) * 8]], 6, flat(0.55)));
  };

  // 2 ─ Sea and moon: one-motion waves (1.2), swells (2.2), spray stipple (5.3), near is dark (5.5)
  G.sea = () => {
    fresh('hotpress');
    const mx = 760, my = 150;
    for (let r = 10; r <= 56; r += 9) stroke('wash', '#f4e9c6', 0.8, circle(mx, my, r, 36, r));
    for (let r = 6; r <= 62; r += 8) stroke('spray', r < 40 ? '#e9d79e' : '#d6c184', 2.2, circle(mx, my, r, 40, r * 0.3));
    for (let i = 0; i < 9; i++) {
      const y = 300 + i * i * 4.6 + i * 14, amp = 6 + i * 6, x0 = -30 - i * 10, x1 = W + 30;
      const n = 6, ctrl = []; for (let k = 0; k <= n; k++) ctrl.push([x0 + ((x1 - x0) * k) / n, y + (k % 2 ? -amp : amp) * 0.5]);
      const far = i < 3;
      stroke(far ? 'nib' : 'liner', far ? '#6f8fae' : i < 6 ? '#3d6386' : '#22405f', far ? 0.5 : 1.0 + i * 0.05, spline(ctrl, 14, flat(far ? 0.45 : 0.6)));
    }
    for (let i = 0; i < 16; i++) { const x = between(60, 940), y = between(470, 700); stroke('nib', '#1d3a5a', 0.6, spline([[x, y], [x + 26, y - 8], [x + 56, y + 2]], 10, bell)); }
    for (let i = 0; i < 4; i++) stroke('charcoal', '#22405f', 1.4, spline([[-20, 690 + i * 16], [250, 676 + i * 16], [520, 696 + i * 16], [800, 680 + i * 16], [1020, 694 + i * 16]], 16, flat(0.55)));
    for (let i = 0; i < 6; i++) stroke('spray', '#e9d79e', 1.4, line(mx - 40 + i * 14, 330 + i * 60, mx - 20 + i * 14, 350 + i * 60, flat(0.3), 6));
  };

  // 3 ─ Mountains: corners are full stops (1.3), far pale first, near dark last (5.5), an ellipse sun (3.1)
  G.mountains = () => {
    fresh('bristol');
    stroke('graphite', '#c9a24a', 1.3, ellipse(720, 200, 62, 58, 0.2, 48, flat(0.5)));
    stroke('graphite', '#c9a24a', 0.9, ellipse(720, 200, 50, 47, -0.3, 44, flat(0.4)));
    const ridge = (pts, color, size, n = 2) => { for (let k = 0; k < n; k++) stroke('graphite', color, size, over(poly(pts, 14, flat(0.6)), k)); };
    ridge([[-20, 420], [130, 300], [250, 380], [400, 240], [520, 350], [640, 290], [780, 400], [900, 330], [1020, 410]], '#a9b3c1', 1.0, 1);
    ridge([[-20, 500], [110, 400], [260, 470], [430, 340], [560, 450], [700, 380], [830, 480], [1020, 430]], '#7a889a', 1.2, 2);
    ridge([[-20, 600], [90, 520], [230, 580], [380, 470], [500, 560], [660, 500], [790, 600], [1020, 540]], '#3a4656', 1.4, 3);
    const near = [[-20, 600], [90, 520], [230, 580], [380, 470], [500, 560], [660, 500], [790, 600], [1020, 540]];
    for (let i = 1; i <= 9; i++) stroke('charcoal', i < 4 ? '#4a5768' : '#3a4656', 1.6, spline(near.map(([x, y]) => [x, Math.min(H + 20, y + i * 22 - (i % 2) * 5)]), 14, flat(0.42 + Math.min(i, 5) * 0.06)));
    for (let i = 0; i < 6; i++) stroke('charcoal', '#2e3846', 1.3, spline([[-20, 700 + i * 12], [400, 694 + i * 12], [1020, 702 + i * 12]], 12, flat(0.6)));
    for (let i = 0; i < 7; i++) { const x = 160 + i * 42, y = 170 + Math.sin(i) * 14; stroke('liner', '#2a2a2a', 0.8, poly([[x, y + 6], [x + 9, y], [x + 18, y + 6]], 6, flat(0.5))); }
  };

  // 4 ─ Kites: start at the dot, pull toward you (1.4); corners with stops (1.3); the flat shader fills (3.3)
  G.kites = () => {
    fresh('hotpress');
    for (let i = 0; i < 5; i++) stroke('wash', '#d5e3f0', 1.7, line(-40, 60 + i * 60, W + 40, 70 + i * 60 + (i % 2) * 8, flat(0.45), 30));
    const hand = [330, 720];
    const kite = (cx, cy, w, h, color, fill) => {
      for (let k = -2; k <= 2; k++) stroke('flat', fill, 1.1, spline([[cx - w * 0.9 + Math.abs(k) * 6, cy + k * h * 0.16], [cx, cy + k * h * 0.24], [cx + w * 0.9 - Math.abs(k) * 6, cy + k * h * 0.16]], 12, flat(0.55)));
      stroke('chisel', color, 1.0, poly([[cx, cy - h], [cx + w, cy], [cx, cy + h * 1.4], [cx - w, cy], [cx, cy - h]], 12, flat(0.7)));
      stroke('liner', '#1a1c23', 0.9, poly([[cx, cy - h], [cx, cy + h * 1.4]], 10, flat(0.5)));
      stroke('liner', '#1a1c23', 0.9, poly([[cx - w, cy], [cx + w, cy]], 10, flat(0.5)));
      const tail = spline([[cx, cy + h * 1.4], [cx - 20, cy + h * 1.4 + 50], [cx + 14, cy + h * 1.4 + 100], [(cx + hand[0]) / 2 - 20, (cy + h * 1.4 + hand[1]) / 2], [hand[0], hand[1]]], 16, flat(0.5));
      stroke('liner', '#1a1c23', 1.0, tail);
      for (let i = 1; i <= 4; i++) { const q = tail[Math.round((i / 9) * (tail.length - 1))]; stroke('nib', color, 0.6, spline([[q.x - 12, q.y - 4], [q.x, q.y + 2], [q.x + 12, q.y - 6]], 8, bell)); }
    };
    kite(250, 220, 44, 46, '#c9407c', '#f0b7cf');
    kite(520, 160, 52, 56, '#2c6fb5', '#b8d1ec');
    kite(720, 300, 40, 42, '#e0a020', '#f5dea3');
    for (let i = 0; i < 5; i++) stroke('graphite', '#6f8b4e', 1.2, spline([[-20, 700 + i * 12], [300, 660 + i * 12], [650, 690 + i * 12], [1020, 680 + i * 12]], 20, flat(0.5)));
    stroke('graphite', '#4a3b2c', 1.0, spline([[hand[0] - 10, hand[1] + 6], [hand[0] - 2, hand[1] - 14], [hand[0] + 10, hand[1] - 4], [hand[0] + 6, hand[1] + 12]], 10, flat(0.6)));
  };

  // 5 ─ Reeds and rain: press at the root and lift (2.1), long fades (2.4), short swells (2.2)
  G.reeds = () => {
    fresh('washi');
    for (let i = 0; i < 4; i++) stroke('wash', i % 2 ? '#a9c4d6' : '#bcd1df', 1.6, line(-40, 560 + i * 40, W + 40, 552 + i * 40, flat(0.5), 30));
    stroke('bristle', '#5e7f96', 1.3, spline([[-20, 566], [400, 558], [1020, 566]], 20, taperOut));
    const reeds = [[180, 0.15], [260, 0.22], [330, 0.1], [520, 0.25], [590, 0.18], [700, 0.3], [770, 0.2], [860, 0.12]];
    for (const [x, sway] of reeds) {
      const top = between(150, 260);
      stroke('bristle', '#3f6b3a', 1.2, spline([[x, 580], [x + sway * 90, 580 - (580 - top) * 0.5], [x + sway * 260, top]], 20, taperOut));
      if (rnd() < 0.6) stroke('nib', '#5a4630', 0.7, spline([[x + sway * 260, top + 6], [x + sway * 262, top - 18], [x + sway * 264, top - 40]], 8, bell));
      for (let k = 0; k < 2; k++) { const y0 = between(320, 480); const t = (580 - y0) / (580 - top); const bx = x + sway * 260 * t * t + sway * 90 * 2 * t * (1 - t); const dir = k ? 1 : -1; stroke('bristle', '#4f8a48', 0.8, spline([[bx, y0], [bx + dir * 30, y0 - 26], [bx + dir * 70, y0 - 44]], 10, taperOut)); }
    }
    for (let i = 0; i < 34; i++) { const x = 40 + i * 28 + between(-8, 8); stroke('bristle', '#5b7f3a', between(0.8, 1.1), spline([[x, 590], [x + between(-8, 8), 560], [x + between(-20, 20), 530]], 8, taperOut)); }
    for (let i = 0; i < 44; i++) { const x = between(20, 980), y = between(30, 430); stroke('liner', '#4d5f9f', 0.7, spline([[x, y], [x - 3, y + 16], [x - 6, y + 34]], 8, (t) => 0.2 + 0.6 * Math.sin(Math.min(1, t * 1.15) * Math.PI))); }
  };

  // 6 ─ Bamboo: heavy at the joints, light between (2.3); leaves are thin-thick-thin brush-pen pulls (6.2)
  G.bamboo = () => {
    fresh('hotpress');
    for (let i = 0; i < 3; i++) stroke('wash', '#e6ecdc', 1.8, line(120 + i * 120, -20, 60 + i * 120, H + 20, flat(0.45), 30));
    const stalk = (x0, lean, segs, size, color) => {
      let y = 700, x = x0;
      for (let i = 0; i < segs; i++) {
        const len = 120 + i * 10, nx = x + lean * len;
        stroke('nib', color, size, line(x, y, nx, y - len, node, 26));
        stroke('nib', color, size, line(nx - 16, y - len - 4, nx + 18, y - len - 8, flat(0.95), 8));
        y -= len + 8; x = nx;
      }
      return [x, y];
    };
    const leafCluster = (bx, by, dir) => { for (let k = 0; k < 5; k++) { const a = dir + (k - 2) * 0.35, L = between(70, 120); stroke('brushpen', k % 2 ? '#2f5a33' : '#4f8a48', 0.9, spline([[bx, by], [bx + Math.cos(a) * L * 0.5, by + Math.sin(a) * L * 0.5 + 6], [bx + Math.cos(a) * L, by + Math.sin(a) * L + 14]], 12, thin)); } };
    stalk(300, 0.04, 5, 0.75, '#2f5a33');
    stalk(430, -0.03, 4, 0.85, '#2f5a33');
    stalk(560, 0.06, 5, 0.6, '#4f8a48');
    leafCluster(322, 330, -0.4); leafCluster(418, 470, 2.9); leafCluster(590, 260, -0.2); leafCluster(552, 520, 3.1); leafCluster(470, 200, -1.0);
    stroke('chisel', '#b5451b', 0.9, poly([[830, 620], [870, 620], [870, 660], [830, 660], [830, 620]], 8, flat(0.9)));
    stroke('chisel', '#b5451b', 0.5, poly([[842, 632], [858, 648]], 6, flat(0.8)));
  };

  // 7 ─ Leaf: wet first, one slow line after (3.5); overlaps go darkest along the middle
  G.leaf = () => {
    fresh('washi');
    const leaf = (bx, by, len, wid, tilt, dir) => {
      const R = (x, y) => [bx + (x * Math.cos(tilt) - y * Math.sin(tilt)) * dir, by + x * Math.sin(tilt) + y * Math.cos(tilt)];
      for (const k of [0, -1, 1, -0.5, 0.5]) { const w = wid * (1 - Math.abs(k) * 0.45); stroke('wash', Math.abs(k) >= 1 ? '#6fa15a' : '#4f8a48', 0.65, spline([R(0, 0), R(len * 0.4, k * w * 0.62), R(len * 0.75, k * w * 0.55), R(len, 0)], 28, bell)); }
      for (const sgn of [-1, 1]) stroke('liner', '#2a4a2c', 1.25, spline([R(0, 0), R(len * 0.38, sgn * wid * 0.6), R(len * 0.75, sgn * wid * 0.5), R(len, 0)], 30, bell));
      stroke('nib', '#2f5a33', 0.6, spline([R(6, 0), R(len * 0.5, 2), R(len * 0.92, 0)], 24, taperOut));
      for (let v = 1; v <= 5; v++) { const x0 = len * (0.12 + v * 0.14); for (const sgn of [-1, 1]) stroke('liner', '#3b6b3d', 0.7, spline([R(x0, 0), R(x0 + len * 0.12, sgn * wid * 0.28), R(x0 + len * 0.2, sgn * wid * 0.44)], 10, taperOut)); }
    };
    leaf(230, 560, 520, 150, -0.62, 1);
    leaf(640, 640, 300, 90, -1.25, 1);
    stroke('bristle', '#6b5a3c', 1.2, spline([[230, 560], [190, 620], [150, 700]], 14, taperIn));
  };

  // 8 ─ Sunflower: from the centre out (6.1), one sweep per petal, the centre comes last
  G.sunflower = () => {
    fresh('hotpress');
    const cx = 500, cy = 330;
    stroke('bristle', '#3f6b3a', 1.9, spline([[cx + 6, cy + 90], [cx - 6, cy + 260], [cx + 10, cy + 420], [cx, cy + 560]], 36, (t) => 0.7 + 0.25 * t));
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 14 + (i % 2) * 0.1, L = 160 + (i % 2) * 24, w = 52;
      const R = (x, y) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)];
      for (const k of [0, -0.6, 0.6, -1, 1]) stroke('wash', Math.abs(k) > 0.8 ? '#e9ad2f' : '#f2c14e', 0.9, spline([R(40, k * 4), R(L * 0.45, k * w * 0.5), R(L * 0.8, k * w * 0.34), R(L - Math.abs(k) * 10, 0)], 22, bell));
      stroke('graphite', '#c98d2a', 0.7, spline([R(70, 0), R(L * 0.6, 1), R(L - 14, 0)], 12, taperOut));
    }
    for (let r = 10; r <= 60; r += 10) stroke('wash', '#6b3f12', 0.9, circle(cx, cy, r, 36, r));
    for (let r = 14; r <= 56; r += 14) stroke('wash', '#4a2c12', 0.8, circle(cx, cy, r, 36, r * 1.7));
    for (let i = 0; i < 70; i++) { const a = i * 2.39996, r = 6 + Math.sqrt(i) * 7; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; stroke('chisel', i % 3 ? '#4a2c12' : '#7a4a1a', 0.5, line(x - 4, y - 2, x + 5, y + 3, flat(0.9), 5)); }
    stroke('graphite', '#4a2c12', 1.2, circle(cx, cy, 66, 48, 0.3, flat(0.6)));
    const leaf = (bx, by, len, wid, tilt, dir) => { const R = (x, y) => [bx + (x * Math.cos(tilt) - y * Math.sin(tilt)) * dir, by + x * Math.sin(tilt) + y * Math.cos(tilt)]; for (const k of [0, -1, 1]) stroke('wash', k ? '#6fa15a' : '#4f8a48', 0.6, spline([R(0, 0), R(len * 0.4, k * wid * 0.6), R(len * 0.75, k * wid * 0.5), R(len, 0)], 24, bell)); for (const sgn of [-1, 1]) stroke('liner', '#2a4a2c', 1.1, spline([R(0, 0), R(len * 0.38, sgn * wid * 0.6), R(len * 0.75, sgn * wid * 0.5), R(len, 0)], 24, bell)); stroke('nib', '#2f5a33', 0.5, spline([R(4, 0), R(len * 0.5, 2), R(len * 0.9, 0)], 16, taperOut)); };
    leaf(cx - 4, cy + 300, 170, 56, -0.4, -1);
    leaf(cx + 6, cy + 400, 150, 50, -0.3, 1);
  };

  // 9 ─ Hatched cube: parallel, evenly spaced, same speed (5.4); corners as full stops (1.3)
  G.cube = () => {
    fresh('bristol');
    const A = [340, 250], B = [560, 220], C = [620, 330], D = [400, 360], E = [340, 470], F = [560, 440], Gp = [620, 550], Hh = [400, 580];
    const edge = (p, q) => { const base = poly([p, q], 14, flat(0.65)); for (let k = 0; k < 2; k++) stroke('liner', '#1a1c23', 1.2, over(base, k)); };
    edge(A, B); edge(B, C); edge(C, D); edge(D, A); edge(A, E); edge(D, Hh); edge(C, Gp); edge(E, Hh); edge(Hh, Gp);
    const hatch = (p0, p1, p2, p3, n, color, dbl) => {
      // lines from edge p0→p1 to edge p3→p2, evenly spaced
      for (let i = 1; i < n; i++) { const t = i / n; const a = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t], b = [p3[0] + (p2[0] - p3[0]) * t, p3[1] + (p2[1] - p3[1]) * t]; stroke('ballpoint', color, 1.0, line(a[0], a[1], b[0], b[1], flat(0.55), 16)); }
      if (dbl) for (let i = 1; i < n; i++) { const t = i / n; const a = [p0[0] + (p3[0] - p0[0]) * t, p0[1] + (p3[1] - p0[1]) * t], b = [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t]; stroke('ballpoint', color, 1.0, line(a[0], a[1], b[0], b[1], flat(0.55), 16)); }
    };
    hatch(D, C, Gp, Hh, 14, '#1a1c23', true);   // front-right face, cross-hatched (dark)
    hatch(A, D, Hh, E, 9, '#1a1c23', false);    // left face, single hatch (mid)
    hatch(A, B, C, D, 5, '#1a1c23', false);     // top, sparse (light)
    for (let i = 0; i < 12; i++) stroke('ballpoint', '#1a1c23', 1.0, line(400 + i * 22, 600 + i * 3, 700 + i * 22, 590 + i * 3, flat(0.45), 14));
    stroke('graphite', '#8a847a', 1.0, line(120, 640, 880, 640, flat(0.5), 30));
  };
});

const pieces = ['fence', 'sea', 'mountains', 'kites', 'reeds', 'bamboo', 'leaf', 'sunflower', 'cube'];
const out = {};
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
  const jpg = await page.evaluate(() => { window.__studio.gl.blitCommitted(); return document.querySelector('#ink-canvas').toDataURL('image/jpeg', 0.88); });
  fs.writeFileSync(`${OUT}${name}.png`, Buffer.from(png.split(',')[1], 'base64'));
  fs.writeFileSync(`${OUT}${name}.jpg`, Buffer.from(jpg.split(',')[1], 'base64'));
  out[name] = { strokes: n, ms: Date.now() - t0, kb: Math.round(fs.statSync(`${OUT}${name}.png`).size / 1024) };
  console.log(name, JSON.stringify(out[name]));
}
await browser.close();
