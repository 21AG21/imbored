/* Measured density sweep for the Rush Hour (Nagel–Schreckenberg) sim.
 * Drives the game's window.__traffic seam in a headless browser: at each
 * density it warms the ring road, then averages the flux (cars past a point per
 * tick) over many steps. The flux rises with density, peaks at the critical
 * density, then falls into the congested branch — the fundamental diagram. The
 * location of the peak is the model's own answer for where a road carries the
 * most cars; for v_max = 5, p = 0.25 it sits around density 0.10–0.16.
 *
 * Run:  node tools/sweep-traffic.mjs   (needs playwright-core; dev-only)
 */
import { chromium } from 'playwright-core';
const EXEC = process.env.CHROME_BIN || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const URL = 'file://' + process.cwd() + '/index.html';

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.Arcade, { timeout: 8000 });
await page.evaluate(() => { location.hash = '#g/traffic'; });
await page.waitForFunction(() => window.__traffic, { timeout: 8000 });
await page.evaluate(() => window.__traffic.setRunning(false));

async function pointAt(density, warm, samples) {
  return page.evaluate(({ density, warm, samples }) => {
    window.__traffic.reset({ density, p: 0.25, vmax: 5 });
    for (let i = 0; i < warm; i++) window.__traffic.step(1);
    let q = 0, v = 0;
    for (let i = 0; i < samples; i++) { window.__traffic.step(1); const s = window.__traffic.stats(); q += s.flow; v += s.meanV; }
    return { q: q / samples, v: v / samples };
  }, { density, warm, samples });
}

console.log('\n=== Rush Hour / Nagel–Schreckenberg fundamental diagram (v_max=5, p=0.25) ===');
console.log('  density   flow     mean-v');
let peakQ = -1, peakD = null;
for (let i = 1; i <= 24; i++) {
  const d = 0.6 * i / 24;
  const r = await pointAt(d, 150, 200);
  const bar = '#'.repeat(Math.round(r.q * 60));
  console.log('  ' + d.toFixed(3) + '    ' + r.q.toFixed(3) + '   ' + r.v.toFixed(2).padStart(5) + '   ' + bar);
  if (r.q > peakQ) { peakQ = r.q; peakD = d; }
}
console.log('\nflow peaks (' + peakQ.toFixed(3) + ' cars/cell/tick) at density ~ ' + peakD.toFixed(3) +
  '  — the critical density where the road carries the most cars.');
await browser.close();
console.log('done.\n');
