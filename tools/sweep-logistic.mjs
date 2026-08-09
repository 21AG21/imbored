/* Onset-of-chaos check for the Boom & Bust (logistic map) sim.
 * Drives the game's window.__logistic seam in a headless browser: it scans the
 * growth rate r and finds where the Lyapunov exponent first turns positive —
 * the onset of chaos. For the logistic map that is the Feigenbaum accumulation
 * point r_inf = 3.569946..., and inside the chaos the period-3 window (near
 * r = 3.83) shows the exponent dipping back negative. This is what justifies
 * the marked onset and the period-3 shortcut button.
 *
 * Run:  node tools/sweep-logistic.mjs   (needs playwright-core; dev-only)
 */
import { chromium } from 'playwright-core';
const EXEC = process.env.CHROME_BIN || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const URL = 'file://' + process.cwd() + '/index.html';

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.Arcade, { timeout: 8000 });
await page.evaluate(() => { location.hash = '#g/logistic'; });
await page.waitForFunction(() => window.__logistic, { timeout: 8000 });

const lam = (r) => page.evaluate((r) => window.__logistic.lyapunov(r, 3000, 40000), r);
const per = (r) => page.evaluate((r) => window.__logistic.period(r, 16), r);

console.log('\n=== Boom & Bust / logistic map (onset of chaos r_inf = 3.56995) ===');
console.log('   r      lambda    cycle');
for (const r of [2.9, 3.2, 3.45, 3.55, 3.5699, 3.6, 3.7, 3.83, 3.9, 4.0]) {
  const l = await lam(r), p = await per(r);
  console.log('  ' + r.toFixed(4) + '   ' + l.toFixed(3).padStart(6) + '   ' + (p ? p + '-cycle' : 'chaos'));
}
// locate the zero crossing of lambda
let onset = null, prev = await lam(3.4);
for (let r = 3.40; r <= 3.62; r += 0.002) {
  const l = await lam(r);
  if (prev < 0 && l >= 0 && onset === null) onset = r;
  prev = l;
}
console.log('\nLyapunov exponent first turns positive near r = ' + (onset ? onset.toFixed(3) : '?') +
  '  (Feigenbaum accumulation r_inf = 3.56995)');
console.log('lambda(4.0) should be ~ln2 = 0.693:', (await lam(4.0)).toFixed(3));
await browser.close();
console.log('done.\n');
