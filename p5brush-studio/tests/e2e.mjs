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

  // Clear is undoable.
  await studio((s) => s.clear());
  check('clear empties the visible drawing', (await studio((s) => s.strokes().length)) === 0);
  await studio((s) => s.undo());
  check('undo restores strokes after clear', (await studio((s) => s.strokes().length)) === 2);

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
  check('zoom in then out re-renders identically', backToOne.h === atOne.h);
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
  check('pen pressure at the start is eased, not the raw spike', cond[0].p < 0.9 && cond[cond.length - 1].p < 0.45, `start ${cond[0].p.toFixed(2)} end ${cond[cond.length - 1].p.toFixed(2)}`);
  const legacy = await studio((s, pts) => s.conditioned({ tool: 'brush', spec: s.state.settings.spec, tipSource: s.state.settings.tipSource, size: 1, color: '#000', pressureMode: 'both', sensitivity: 1.25, seed: 1, points: pts }), hook);
  check('records without an input kind are left untouched', legacy.length === hook.length && legacy[0].p === 1);

  // Sketch export covers the visible strokes.
  await studio((s) => s.clear());
  await studio((s) => s.commit([{ x: 100, y: 100, p: 0.5 }, { x: 400, y: 120, p: 0.5 }], { seed: 21 }));
  await studio((s) => s.commit([{ x: 100, y: 300, p: 0.5 }, { x: 400, y: 320, p: 0.5 }], { seed: 22 }));
  const sketch = await studio((s) => s.sketchCode());
  check('sketch export contains brush.add and strokes', /brush\.add\(/.test(sketch) && (sketch.match(/beginStroke/g) || []).length === 2);

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
