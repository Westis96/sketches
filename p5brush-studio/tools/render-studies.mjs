// Usage: build the app, serve dist on :8768 (npx http-server dist -p 8768 -s), then `node tools/render-studies.mjs [ids...]`.
// Renders Learn pieces through the engine exactly as a perfect run would draw them
// (stylus pressure from the reference points), one JPEG per piece in docs/gallery/.
// With no ids it renders the sixteen washes of Levels 7 and 8.
import { chromium } from 'playwright';
import fs from 'node:fs';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['fuji', 'lanterns', 'grove', 'persimmons', 'mandala', 'pond', 'harvest', 'seastar', 'poppies', 'ridge', 'vase', 'wheat', 'sun', 'winds', 'jelly', 'washleaf'];
const OUT = new URL('../docs/gallery/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 750 }, deviceScaleFactor: 1.5 });
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:8768/index.html#/sketch', { waitUntil: 'load' });
await page.waitForFunction(() => window.__studio && window.__studio.state.templatePreviews);
await page.evaluate(() => { window.__sfx?.setEnabled(false); localStorage.setItem('p5brush-studio:welcomed', '1'); });
await page.click('text=Start drawing').catch(() => {});
await page.addStyleTag({ content: '[data-sonner-toaster],aside,header,nav,footer,button{display:none !important}' });
for (const id of ids) {
  const n = await page.evaluate((id) => {
    const s = window.__studio; s.clear(); s.resetView(); s.setPressureMode('stylus'); s.setPaper('hotpress');
    const steps = s.practice.steps(id);
    // The 800×600 lesson box sits centred in the 1000×750 view.
    steps.forEach((st, i) => {
      const pts = st.points.map((p) => ({ x: p.x + 100, y: p.y + 75, p: p.p }));
      if (st.shape) { s.commitShape(st.shape, pts, 7000 + i); return; }
      s.applyTemplate(st.template); s.commit(pts, { color: st.color, size: st.size, seed: 500 + i, pressureMode: 'stylus', sensitivity: 1, input: 'pen' });
    });
    return steps.length;
  }, id);
  await page.waitForFunction(() => !window.__studio.isPainting(), null, { timeout: 300000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}${id}.jpg`, type: 'jpeg', quality: 88 });
  console.log(id, n, 'strokes ->', `docs/gallery/${id}.jpg`);
}
await browser.close();
