/* Measured density sweep for the Fire Drill site-percolation sim.
 * Drives the game's window.__fire seam in a headless browser: at each density p
 * it runs many fresh grids to completion and reports the spanning probability
 * (fire reaches the far edge) and mean burned fraction. The spanning curve
 * crosses 0.5 at the finite-size percolation threshold — near the known
 * p_c = 0.5927 for the square lattice. This is what justifies the default.
 *
 * Run:  node tools/sweep-firedrill.mjs   (needs playwright-core; dev-only)
 */
import { chromium } from 'playwright-core';
const EXEC = process.env.CHROME_BIN || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const URL = 'file://' + process.cwd() + '/index.html';

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.Arcade, { timeout: 8000 });
await page.evaluate(() => { location.hash = '#g/firedrill'; });
await page.waitForFunction(() => window.__fire, { timeout: 8000 });
await page.evaluate(() => window.__fire.setRunning(false));

async function pointAt(p, trials) {
  return page.evaluate(({ p, trials }) => {
    let span = 0, burn = 0;
    for (let t = 0; t < trials; t++) {
      window.__fire.reset({ p });
      window.__fire.runToEnd();
      const s = window.__fire.stats();
      if (s.spanned) span++;
      burn += s.burnedFraction;
    }
    return { spanProb: span / trials, burn: burn / trials };
  }, { p, trials });
}

console.log('\n=== Fire Drill percolation sweep (90x90 grid, 40 trials/point) ===');
console.log('   p     span-prob   burned%   (known p_c = 0.5927)');
let lo = null, hi = null;
for (let i = 0; i <= 16; i++) {
  const p = 0.45 + (0.75 - 0.45) * i / 16;
  const r = await pointAt(p, 40);
  const bar = '#'.repeat(Math.round(r.spanProb * 20));
  console.log('  ' + p.toFixed(3) + '   ' + r.spanProb.toFixed(2).padStart(6) + '   ' +
    (Math.round(r.burn * 100) + '%').padStart(6) + '   ' + bar);
  if (r.spanProb < 0.5) lo = p;
  if (hi === null && r.spanProb >= 0.5) hi = p;
}
console.log('\nspanning probability crosses 0.5 between p=' + (lo || '?').toString().slice(0, 5) +
  ' and p=' + (hi || '?').toString().slice(0, 5) + '  (finite-size estimate of p_c).');
await browser.close();
console.log('done.\n');
