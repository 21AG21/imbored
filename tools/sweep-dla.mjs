/* Fractal-dimension check for the Window Frost (DLA) sim.
 * Drives the game's window.__dla seam in a headless browser: it grows a large
 * aggregate, then reads the dimension the model fits from its own mass–radius
 * law N(r) ~ r^D. For 2D lattice diffusion-limited aggregation the accepted
 * value is D ≈ 1.71 (Witten & Sander 1981); a well-grown cluster here should
 * land in roughly 1.6–1.8, tightening toward 1.71 as it grows. This is what
 * justifies the reference slope drawn on the panel.
 *
 * Run:  node tools/sweep-dla.mjs   (needs playwright-core; dev-only)
 */
import { chromium } from 'playwright-core';
const EXEC = process.env.CHROME_BIN || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const URL = 'file://' + process.cwd() + '/index.html';

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.Arcade, { timeout: 8000 });
await page.evaluate(() => { location.hash = '#g/frost'; });
await page.waitForFunction(() => window.__dla, { timeout: 8000 });
await page.evaluate(() => window.__dla.setRunning(false));

console.log('\n=== Window Frost / DLA fractal dimension (known D = 1.71) ===');
console.log('  particles   radius    fitted D');
await page.evaluate(() => window.__dla.reset());
for (const target of [500, 1000, 2000, 3500, 5500, 8000]) {
  await page.evaluate((target) => {
    while (window.__dla.stats().count < target && !window.__dla.stats().done) window.__dla.grow(200);
  }, target);
  const s = await page.evaluate(() => window.__dla.stats());
  console.log('  ' + String(s.count).padStart(7) + '   ' + s.radius.toFixed(1).padStart(6) + '     ' + s.dimension.toFixed(3));
  if (s.done) break;
}
const fin = await page.evaluate(() => window.__dla.stats());
console.log('\nfinal fitted dimension D = ' + fin.dimension.toFixed(3) + '   (Witten–Sander: 1.71)');
await browser.close();
console.log('done.\n');
