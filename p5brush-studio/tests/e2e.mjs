/**
 * End-to-end regression suite for the studio, run against the production build.
 *
 *   npm run build && npm test
 *
 * Requires Playwright's Chromium (`npx playwright install chromium`). Rendering
 * runs on SwiftShader (software WebGL2), so the checks are about behaviour and
 * determinism, not pixel-exact colours.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(2);
}

// --- tiny static server -----------------------------------------------------
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(dist, url === '/' ? 'index.html' : url);
  if (!file.startsWith(dist) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

// --- harness ----------------------------------------------------------------
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort()); // no fonts/CDNs in CI

const studio = (fn, ...args) => page.evaluate(([src, a]) => new Function('s', 'a', `return (${src})(s, ...a)`)(window.__studio, a), [fn.toString(), args]);
const checksum = () => page.evaluate(() => {
  const c = document.getElementById('ink-canvas');
  const gl = c.getContext('webgl2');
  const px = new Uint8Array(c.width * c.height * 4);
  gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let h = 0, ink = 0;
  for (let i = 0; i < px.length; i += 4) { h = (h * 31 + px[i]) >>> 0; ink += 255 - px[i]; }
  return { h, ink };
});
const drag = async (pts) => {
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(x, y, { steps: 3 });
  await page.mouse.up();
};

try {
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__studio && window.__studio.strokes().length >= 1, null, { timeout: 20000 });
  await page.waitForTimeout(200);
  check('boots and draws the sample stroke', (await studio((s) => s.strokes().length)) === 1);

  // First visit: the welcome card shows once and stays dismissed.
  const welcomeShown = (await page.locator('[data-testid=welcome]').count()) === 1;
  if (welcomeShown) await page.locator('text=Start drawing').click({ timeout: 2000 });
  await page.waitForTimeout(100);
  const welcomeGone = (await page.locator('[data-testid=welcome]').count()) === 0;
  const welcomedFlag = await page.evaluate(() => localStorage.getItem('p5brush-studio:welcomed'));
  check('welcome card shows on first visit and dismisses for good', welcomeShown && welcomeGone && welcomedFlag === '1');

  // Drawing with the mouse commits a stroke.
  const blank = await checksum();
  await drag([[200, 600], [400, 560], [600, 620], [800, 580]]);
  await page.waitForTimeout(100);
  const drawn = await checksum();
  check('mouse stroke commits and adds ink', (await studio((s) => s.strokes().length)) === 2 && drawn.ink > blank.ink);

  // Undo / redo are pixel-deterministic.
  await studio((s) => s.undo());
  const undone = await checksum();
  await studio((s) => s.redo());
  const redone = await checksum();
  check('undo changes pixels', undone.h !== drawn.h);
  check('redo reproduces identical pixels', redone.h === drawn.h);
  const drawnRec = await studio((s) => { const r = s.history()[s.history().length - 1]; return { chunks: r.chunks, n: r.points.length }; });
  check('a hand-drawn stroke records its live chunks', Array.isArray(drawnRec.chunks) && drawnRec.chunks.length >= 2 && drawnRec.chunks[drawnRec.chunks.length - 1] === drawnRec.n, JSON.stringify(drawnRec));
  // The pixels on screen at lift are the committed pixels: a full rebuild changes nothing.
  await studio((s) => s.rebuildAll());
  check('rebuilding a hand-drawn stroke reproduces the lifted pixels', (await checksum()).h === drawn.h);
  const drawnZoom = await studio((s) => s.history()[s.history().length - 1].zoom);
  check('a hand-drawn stroke remembers the zoom it was drawn at', drawnZoom === 1);

  // Clear resets the drawing and its history; Undo right after brings it back.
  await studio((s) => s.clear());
  const cleared = await studio((s) => ({ visible: s.strokes().length, history: s.history().length, canUndo: s.state.canUndo, canRedo: s.state.canRedo }));
  await studio((s) => s.saveNow());
  const savedAfterClear = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).strokes.length, await studio((s) => s.saveKey));
  check('clear empties the drawing, the history and the autosave', cleared.visible === 0 && cleared.history === 0 && !cleared.canRedo && savedAfterClear === 0, JSON.stringify(cleared));
  await studio((s) => s.undo());
  check('undo restores strokes after clear', (await studio((s) => s.strokes().length)) === 2 && (await checksum()).h === drawn.h);
  await studio((s) => s.clear());
  await studio((s) => s.commit([{ x: 100, y: 100, p: 0.5 }, { x: 200, y: 120, p: 0.5 }], { seed: 5 }));
  await studio((s) => s.undo());
  check('a new stroke after clear forfeits the restore', (await studio((s) => s.history().length)) === 0);
  await studio((s) => s.commit([{ x: 200, y: 600, p: 0.5 }, { x: 400, y: 560, p: 0.6 }, { x: 600, y: 620, p: 0.5 }, { x: 800, y: 580, p: 0.5 }], { seed: 6 }));
  await studio((s) => s.commit([{ x: 100, y: 200, p: 0.5 }, { x: 300, y: 220, p: 0.5 }], { seed: 7 }));

  // Escape cancels a live stroke.
  const before = await studio((s) => s.history().length);
  await page.mouse.move(300, 300); await page.mouse.down(); await page.mouse.move(500, 320, { steps: 4 });
  await page.keyboard.press('Escape');
  await page.mouse.move(600, 330); await page.mouse.up();
  check('escape cancels the stroke in progress', (await studio((s) => s.history().length)) === before);

  // Templates render previews and produce different ink.
  await page.waitForFunction(() => window.__studio.state.templatePreviews, null, { timeout: 20000 });
  const previewCount = await studio((s) => Object.keys(s.state.templatePreviews).length);
  check('template previews rendered', previewCount === (await studio((s) => s.templates.length)), `${previewCount}`);
  const inks = {};
  for (const id of await studio((s) => s.templates)) {
    await studio((s, id) => s.applyTemplate(id), id);
    const pts = []; for (let i = 0; i <= 60; i++) pts.push({ x: 150 + i * 8, y: 420 + Math.sin(i / 8) * 50, p: 0.5 });
    const b0 = (await checksum()).ink;
    await studio((s, pts) => s.commit(pts, { seed: 7 }), pts);
    inks[id] = (await checksum()).ink - b0;
    await studio((s) => s.undo());
  }
  check('every template lays down ink', Object.values(inks).every((v) => v > 0), JSON.stringify(inks));
  check('templates differ from each other', new Set(Object.values(inks)).size === Object.keys(inks).length);
  await studio((s) => s.applyTemplate('chisel'));

  // Zoom: strokes are world-space, drawing at zoom 2 maps back through the camera,
  // and returning to the original view reproduces the exact pixels.
  const atOne = await checksum();
  await studio((s) => s.zoomBy(2, 600, 400));
  await page.waitForTimeout(100);
  check('zoom updates the camera', Math.abs((await studio((s) => s.view().zoom)) - 2) < 1e-9);
  await drag([[500, 300], [700, 330]]);
  const rec = await studio((s) => s.history()[s.history().length - 1]);
  const w = await studio((s) => s.toWorld(500, 300));
  check('stroke drawn at zoom 2 is stored in world units', Math.abs(rec.points[0].x - w.x) < 0.02 && Math.abs(rec.points[0].y - w.y) < 0.02);
  await studio((s) => s.undo());
  await studio((s) => s.zoomBy(0.5, 600, 400));
  await page.waitForTimeout(100);
  const backToOne = await checksum();
  // Strokes that start off-screen (left/above) must still render when zoomed in.
  await studio((s) => s.commit(Array.from({ length: 60 }, (_, i) => ({ x: 100 + i * 13, y: 200, p: 0.6 })), { seed: 3 }));
  await studio((s) => { s.resetView(); s.zoomBy(4, 400, 200); });
  const zoomedInk = await page.evaluate(() => {
    const c = document.getElementById('ink-canvas'); const gl = c.getContext('webgl2');
    const px = new Uint8Array(160 * 160 * 4); gl.readPixels(320, c.height - 280, 160, 160, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let ink = 0; for (let i = 0; i < px.length; i += 4) ink += 255 - px[i]; return ink;
  });
  await studio((s) => s.resetView());
  const baseInk = await page.evaluate(() => {
    const c = document.getElementById('ink-canvas'); const gl = c.getContext('webgl2');
    const px = new Uint8Array(40 * 40 * 4); gl.readPixels(380, c.height - 220, 40, 40, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let ink = 0; for (let i = 0; i < px.length; i += 4) ink += 255 - px[i]; return ink;
  });
  check('a stroke that starts off-screen still renders when zoomed in', zoomedInk > baseInk * 8, `zoomed ${zoomedInk} vs base ${baseInk} (x16 area)`);
  await studio((s) => s.undo()); // leave the earlier strokes in place for the checks below

  check('zoom in then out re-renders identically', backToOne.h === atOne.h);

  // Large rebuilds are spread over frames and end up identical to a synchronous one.
  for (let i = 0; i < 16; i++) await studio((s, i) => s.commit([{ x: 120 + i * 40, y: 620, p: 0.5 }, { x: 140 + i * 40, y: 650, p: 0.6 }], { seed: 300 + i }), i);
  const spread = await studio((s) => { s.zoomBy(1.1); return s.isPainting(); });
  await page.waitForFunction(() => !window.__studio.isPainting(), null, { timeout: 30000 });
  const progressive = await checksum();
  await studio((s) => s.rebuildAll());
  check('large rebuilds are spread over frames and match a synchronous rebuild', spread === true && (await checksum()).h === progressive.h);
  // While a zoom rebuild is in flight the previous image stays on screen (transformed), not blank paper.
  const midZoom = await studio((s) => { s.zoomBy(1.15); const painting = s.isPainting(); return painting; });
  const midInk = await checksum();
  await page.waitForFunction(() => !window.__studio.isPainting(), null, { timeout: 30000 });
  check('a zoom rebuild keeps the previous drawing visible while it runs', midZoom === true && midInk.ink > blank.ink * 0.5, `ink ${midInk.ink} vs blank ${blank.ink}`);
  await studio((s) => { s.zoomBy(1 / 1.15); s.flushPaint(); });
  await studio((s) => { s.zoomBy(1 / 1.1); s.flushPaint(); });

  // Panning at the same zoom shifts the image and renders only the exposed strips.
  const beforePan = await checksum();
  const grabRed0 = () => page.evaluate(() => { const c = document.getElementById('ink-canvas'); const gl = c.getContext('webgl2'); const px = new Uint8Array(c.width * c.height * 4); gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px); const out = new Array(px.length / 4); for (let i = 0; i < out.length; i++) out[i] = px[i * 4]; return out; });
  const beforePanPx0 = await grabRed0();
  await studio((s) => s.resetPerf());
  await studio((s) => s.pan(37, 22));
  const panPainted = await studio((s) => s.perf().paintStrokes);
  const total = await studio((s) => s.strokes().length);
  const grabRed = () => page.evaluate(() => { const c = document.getElementById('ink-canvas'); const gl = c.getContext('webgl2'); const px = new Uint8Array(c.width * c.height * 4); gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px); const out = new Array(px.length / 4); for (let i = 0; i < out.length; i++) out[i] = px[i * 4]; return out; });
  const nearlySame = (a, b) => { let n = 0, maxd = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d) { n++; if (d > maxd) maxd = d; } } return { ok: n < 64 && maxd <= 2, n, maxd }; };
  const beforePanPx = beforePanPx0;
  const pannedPx = await grabRed();
  await studio((s) => s.rebuildAll());
  const rebuiltPx = await grabRed();
  const same1 = nearlySame(pannedPx, rebuiltPx);
  check('a pan renders only strokes touching the exposed strips', panPainted < total, `${panPainted} of ${total}`);
  check('a pan equals a full rebuild at the new view (to rounding)', same1.ok, JSON.stringify(same1));
  await studio((s) => s.pan(-37, -22));
  const same2 = nearlySame(await grabRed(), beforePanPx);
  check('panning there and back restores the pixels (to rounding)', same2.ok, JSON.stringify(same2));
  void beforePan;
  for (let i = 0; i < 16; i++) await studio((s) => s.undo());
  await studio((s) => s.zoomToFit());
  check('zoom to fit changes the view', (await studio((s) => s.view().zoom)) !== 1 || (await studio((s) => s.view().x)) !== 0);
  await studio((s) => s.resetView());

  // Autosave survives a reload with the paper and view.
  await studio((s) => s.setPaper('washi'));
  await studio((s) => s.zoomBy(1.5, 100, 100));
  await studio((s) => s.saveNow());
  const saved = await studio((s) => ({ n: s.strokes().length, paper: s.state.settings.paper, zoom: s.view().zoom }));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__studio);
  await page.waitForTimeout(500);
  const restored = await studio((s) => ({ n: s.strokes().length, paper: s.state.settings.paper, zoom: s.view().zoom }));
  check('reload restores strokes, paper and zoom', restored.n === saved.n && restored.paper === 'washi' && Math.abs(restored.zoom - saved.zoom) < 1e-9, JSON.stringify({ saved, restored }));

  // Viewport culling: off-screen strokes are skipped, visible pixels are unchanged.
  await studio((s) => s.clear());
  await studio((s) => s.commit([{ x: 100, y: 100, p: 0.5 }, { x: 400, y: 120, p: 0.5 }], { seed: 11 }));
  await studio((s) => s.commit([{ x: 3000, y: 3000, p: 0.5 }, { x: 3300, y: 3050, p: 0.5 }], { seed: 12 }));
  await studio((s) => s.commit([{ x: -2000, y: 400, p: 0.5 }, { x: -1700, y: 380, p: 0.5 }], { seed: 13 }));
  await studio((s) => { s.setCulling(true); s.rebuildAll(); });
  const culledPixels = await checksum();
  const culledCount = await studio((s) => s.lastCulled());
  await studio((s) => { s.setCulling(false); s.rebuildAll(); });
  const uncalledPixels = await checksum();
  await studio((s) => s.setCulling(true));
  check('culling skips off-screen strokes', culledCount === 2, `culled ${culledCount}`);
  check('culling leaves visible pixels identical', culledPixels.h === uncalledPixels.h);

  // Pen point merging: sub-pixel 240 Hz samples fold into the previous point.
  await studio((s) => s.clear());
  const penEvents = await page.evaluate(() => {
    const c = document.getElementById('ink-canvas');
    const ev = (type, x, y, pressure) => new PointerEvent(type, { pointerId: 7, pointerType: 'pen', clientX: x, clientY: y, button: 0, buttons: 1, pressure, bubbles: true, cancelable: true });
    c.dispatchEvent(ev('pointerdown', 300, 300, 0.4));
    let n = 1;
    for (let i = 1; i <= 200; i++) { window.dispatchEvent(ev('pointermove', 300 + i * 0.3, 300 + Math.sin(i / 10) * 0.2, 0.4 + (i % 5) * 0.1)); n++; }
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'pen', clientX: 360, clientY: 300, button: 0, buttons: 0, bubbles: true, cancelable: true }));
    return n;
  });
  await page.waitForTimeout(50);
  const penRec = await studio((s) => s.history()[s.history().length - 1]);
  check('pen samples closer than a pixel are merged', penRec.input === 'pen' && penRec.points.length < penEvents / 2 && penRec.points.length > 10, `${penRec.points.length} points from ${penEvents} events`);
  check('merged points keep the higher pressure', penRec.points.some((p) => p.p >= 0.8));

  // Simulated pressure for mouse/finger input: slow = heavy, fast = light.
  const simPts = [];
  for (let i = 0; i <= 40; i++) simPts.push({ x: 100 + i * 2, y: 500, p: 0.5 });      // slow (2 px steps)
  for (let i = 1; i <= 20; i++) simPts.push({ x: 180 + i * 20, y: 500, p: 0.5 });     // fast (20 px steps)
  const sim = await studio((s, pts) => s.conditioned({ tool: 'brush', spec: s.state.settings.spec, tipSource: s.state.settings.tipSource, size: 1, color: '#000', pressureMode: 'stylus', sensitivity: 1.25, seed: 1, points: pts, input: 'mouse' }), simPts);
  const slowP = sim.slice(5, 35).reduce((a, p) => a + p.p, 0) / 30;
  const fastP = sim.slice(-10).reduce((a, p) => a + p.p, 0) / 10;
  check('simulated pressure: slow strokes are heavier than fast ones', slowP > fastP + 0.1 && sim.every((p) => p.p >= 0.25 && p.p <= 0.75), `slow ${slowP.toFixed(2)} fast ${fastP.toFixed(2)}`);

  // Start smoothing: a tight cluster of early samples is dropped and pen pressure is eased in.
  const hook = [{ x: 200, y: 200, p: 1 }, { x: 201, y: 201, p: 1 }, { x: 202, y: 200, p: 1 }, { x: 201, y: 199, p: 1 }];
  for (let i = 1; i <= 30; i++) hook.push({ x: 200 + i * 5, y: 200, p: 0.3 });
  const cond = await studio((s, pts) => s.conditioned({ tool: 'brush', spec: s.state.settings.spec, tipSource: s.state.settings.tipSource, size: 1, color: '#000', pressureMode: 'both', sensitivity: 1.25, seed: 1, points: pts, input: 'pen' }), hook);
  check('start jitter within one stroke width is dropped', cond.length === hook.length - 3, `${cond.length} of ${hook.length}`);
  check('pen pressure tracks the device within a few samples', cond[0].p < 0.9 && cond[6].p < 0.35 && Math.abs(cond[cond.length - 1].p - 0.3) < 0.02, `start ${cond[0].p.toFixed(2)} at6 ${cond[6].p.toFixed(2)} end ${cond[cond.length - 1].p.toFixed(2)}`);
  const lightDown = await studio((s, pts) => s.conditioned({ tool: 'brush', spec: s.state.settings.spec, tipSource: s.state.settings.tipSource, size: 1, color: '#000', pressureMode: 'both', sensitivity: 1.25, seed: 1, points: pts, input: 'pen' }), [{ x: 0, y: 0, p: 0.02 }, { x: 30, y: 0, p: 0.6 }, { x: 60, y: 0, p: 0.6 }, { x: 90, y: 0, p: 0.6 }]);
  check('a pen-down sample without pressure borrows from the next', lightDown[0].p >= 0.25 && lightDown[3].p > 0.5, `first ${lightDown[0].p} fourth ${lightDown[3].p}`);
  const legacy = await studio((s, pts) => s.conditioned({ tool: 'brush', spec: s.state.settings.spec, tipSource: s.state.settings.tipSource, size: 1, color: '#000', pressureMode: 'both', sensitivity: 1.25, seed: 1, points: pts }), hook);
  check('records without an input kind are left untouched', legacy.length === hook.length && legacy[0].p === 1);

  // Sketch export covers the visible strokes.
  await studio((s) => s.clear());
  await studio((s) => s.commit([{ x: 100, y: 100, p: 0.5 }, { x: 400, y: 120, p: 0.5 }], { seed: 21 }));
  await studio((s) => s.commit([{ x: 100, y: 300, p: 0.5 }, { x: 400, y: 320, p: 0.5 }], { seed: 22 }));
  const sketch = await studio((s) => s.sketchCode());
  check('sketch export contains brush.add and strokes', /brush\.add\(/.test(sketch) && (sketch.match(/beginStroke/g) || []).length === 2);

  // --- Practice (tracing lessons) --------------------------------------------
  const freeBefore = await studio((s) => ({ n: s.history().length, zoom: s.view().zoom, size: s.state.settings.size, tip: s.state.settings.tipSource }));
  await studio((s) => s.practice.start('waves'));
  const lessonSteps = await studio((s) => s.practice.steps('waves'));
  let pr = await studio((s) => s.state.practice);
  check('lesson opens on an empty canvas at step 1', pr && pr.step === 0 && pr.status === 'active' && (await studio((s) => s.history().length)) === 0);
  const brush0 = await studio((s) => ({ size: s.state.settings.size, color: s.state.settings.color }));
  check('each step sets the brush, size and colour', brush0.size === lessonSteps[0].size && brush0.color === lessonSteps[0].color, JSON.stringify(brush0));
  check('guide shows the current stroke and the remaining ghosts',
    (await page.locator('[data-guide=current]').count()) === 1 && (await page.locator('[data-guide=ghost]').count()) === lessonSteps.length - 1);

  // Step 1 traced with real pointer events along the reference.
  const lv = await studio((s) => s.view());
  const toScreen = (p) => [p.x * lv.zoom + lv.x, p.y * lv.zoom + lv.y];
  const ref0 = lessonSteps[0].points;
  await page.mouse.move(...toScreen(ref0[0]));
  await page.mouse.down();
  for (let i = 1; i < ref0.length; i += 2) { const [x, y] = toScreen(ref0[i]); await page.mouse.move(x + Math.sin(i) * 2, y + Math.cos(i) * 2); }
  await page.mouse.move(...toScreen(ref0[ref0.length - 1]));
  await page.mouse.up();
  await page.waitForTimeout(150);
  pr = await studio((s) => s.state.practice);
  check('a clean trace scores high and advances', pr.step === 1 && pr.feedback?.accepted && pr.feedback.score >= 90, `score ${pr.feedback?.score}`);

  await studio((s, pts) => s.commit(pts), [...lessonSteps[1].points].reverse());
  pr = await studio((s) => s.state.practice);
  check('a reversed stroke is accepted but flagged and penalised', pr.step === 2 && pr.feedback.reversed && pr.feedback.score >= 60 && pr.feedback.score < 95, `score ${pr.feedback.score}`);

  const nBefore = await studio((s) => s.history().length);
  await studio((s) => s.commit([{ x: 60, y: 590, p: 0.5 }, { x: 740, y: 20, p: 0.5 }]));
  pr = await studio((s) => s.state.practice);
  check('a stroke far from the reference is rejected and removed', pr.step === 2 && pr.feedback.accepted === false && (await studio((s) => s.history().length)) === nBefore, `score ${pr.feedback.score}`);

  await studio((s) => s.practice.skip());
  const afterSkip = await studio((s) => s.state.practice);
  await studio((s) => s.undo());
  pr = await studio((s) => s.state.practice);
  check('skip counts as zero and undo reopens the step', afterSkip.step === 3 && afterSkip.results[2] === null && pr.step === 2 && pr.results.length === 2);

  for (let i = 2; i < lessonSteps.length; i++) await studio((s, pts) => s.commit(pts), lessonSteps[i].points);
  pr = await studio((s) => s.state.practice);
  const savedProgress = await page.evaluate(() => JSON.parse(localStorage.getItem('p5brush-studio:practice:v1') || 'null'));
  check('finishing every step completes the lesson with stars and a saved best',
    pr.status === 'complete' && pr.summary?.stars === 3 && pr.summary.newBest && savedProgress?.waves?.best === pr.summary.score, JSON.stringify(pr.summary));
  check('finished lesson shows the whole reference for comparing', (await page.locator('[data-guide=ghost]').count()) === lessonSteps.length);
  const savedDoc = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).strokes.length, await studio((s) => s.saveKey));
  check('autosave keeps the free drawing while a lesson is open', savedDoc === freeBefore.n, `${savedDoc} vs ${freeBefore.n}`);

  await studio((s) => s.practice.exit(false));
  const freeAfter = await studio((s) => ({ n: s.history().length, zoom: s.view().zoom, size: s.state.settings.size, tip: s.state.settings.tipSource, practice: s.state.practice }));
  check('leaving a lesson restores the drawing, brush and view',
    freeAfter.practice === null && freeAfter.n === freeBefore.n && freeAfter.size === freeBefore.size && freeAfter.tip === freeBefore.tip && Math.abs(freeAfter.zoom - freeBefore.zoom) < 1e-9,
    JSON.stringify({ freeBefore, freeAfter: { ...freeAfter, practice: undefined } }));

  await studio((s) => s.practice.start('leaf'));
  const leafSteps = await studio((s) => s.practice.steps('leaf'));
  await studio((s, pts) => s.commit(pts), leafSteps[0].points);
  await studio((s) => s.practice.exit(true));
  const kept = await studio((s) => ({ n: s.history().length, practice: s.state.practice }));
  check('keeping the traced drawing replaces the document', kept.practice === null && kept.n === 1);

  // Render self-test: all four ways of drawing the same line agree on this renderer.
  // (The self-test measures the middle of the viewport, so this stroke stays clear of it.)
  await drag([[200, 440], [400, 470], [600, 440]]);
  const diag = await studio((s) => s.diagnostics());
  const t = diag.tests;
  check('render self-test: one-shot and chunked agree', Math.abs(t.oneShot - t.chunked) < 20 && t.oneShot < t.paper - 20, JSON.stringify(t));

  // Chunks of a hand-drawn stroke share one engine mask, so the darkness along a
  // straight line replayed in many chunks is flat: no lighter plate at any boundary.
  // (The first columns are the start rise of the live pressure envelope.)
  const seam = await studio((s) => {
    const y = 400, x0 = 300, x1 = 900, pts = [];
    for (let i = 0; i <= 120; i++) pts.push({ ...s.toWorld(x0 + (x1 - x0) * i / 120, y), p: 0.6 });
    s.clear(); s.applyTemplate('chisel'); s.commit(pts);
    const rec = s.history()[0]; s.undo();
    const chunks = []; for (let i = 10; i < pts.length; i += 7) chunks.push(i); chunks.push(pts.length);
    s.gl.blitPaper(); s.gl.render({ ...rec, chunks });
    const cols = []; for (let x = x0 + 120; x < x1 - 30; x += 6) cols.push(s.gl.meanRed(x, y - 4, 6, 8));
    s.gl.blitCommitted();
    let jump = 0; for (let i = 1; i < cols.length; i++) jump = Math.max(jump, Math.abs(cols[i] - cols[i - 1]));
    return { chunks: chunks.length, min: Math.min(...cols), max: Math.max(...cols), jump };
  });
  check('chunk boundaries leave no bands along a stroke', seam.chunks > 10 && seam.jump <= 8 && seam.max - seam.min <= 12 && seam.max < 240, JSON.stringify(seam));

  // WebKit delivers each coalesced pen batch twice; repeats must not enter the path.
  await page.evaluate(() => { PointerEvent.prototype.getCoalescedEvents = function () { return this.__coalesced || []; }; });
  const dupRec = await page.evaluate(async () => {
    const c = document.getElementById('ink-canvas');
    const mk = (type, x, y, p) => new PointerEvent(type, { pointerType: 'pen', pointerId: 9, isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y, pressure: p, buttons: 1 });
    c.dispatchEvent(mk('pointerdown', 300, 500, 0.3));
    let x = 300;
    for (let batch = 0; batch < 20; batch++) {
      const group = []; for (let i = 0; i < 4; i++) { x += 3; group.push(mk('pointermove', x, 500 + Math.sin(x / 20) * 10, 0.3 + batch * 0.01)); }
      for (let rep = 0; rep < 2; rep++) { const ev = mk('pointermove', x, 500 + Math.sin(x / 20) * 10, 0.3 + batch * 0.01); ev.__coalesced = group; window.dispatchEvent(ev); }
      await new Promise((r) => requestAnimationFrame(r));
    }
    window.dispatchEvent(mk('pointerup', x, 500, 0.3));
    await new Promise((r) => setTimeout(r, 100));
    const r = window.__studio.history()[window.__studio.history().length - 1];
    let back = 0; for (let i = 1; i < r.points.length; i++) if (r.points[i].x < r.points[i - 1].x) back++;
    return { n: r.points.length, back };
  });
  check('duplicate coalesced pen batches are dropped, the path never doubles back', dupRec.back === 0 && dupRec.n > 60 && dupRec.n <= 81, JSON.stringify(dupRec));
  await studio((s) => s.undo());
  check('diagnostics describe the last hand-drawn stroke', diag.stroke && diag.stroke.input === 'mouse' && diag.stroke.chunks >= 1, diag.summary);

  check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
} catch (err) {
  console.error(err);
  failures++;
} finally {
  await browser.close();
  server.close();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
