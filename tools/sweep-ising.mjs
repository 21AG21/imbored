/* Measured temperature sweep for the Curie Point (2D Ising) sim.
 * Drives the game's window.__ising seam in a headless browser: at each
 * temperature it equilibrates the 100x100 lattice, then averages |m| and the
 * fluctuation-based susceptibility over many sweeps. The magnetisation falls
 * off a cliff and the susceptibility peaks at the finite-size critical
 * temperature — near Onsager's exact T_c = 2/ln(1+√2) = 2.26919 for the square
 * lattice. This is what justifies the marked T_c and the default temperature.
 *
 * Run:  node tools/sweep-ising.mjs   (needs playwright-core; dev-only)
 */
import { chromium } from 'playwright-core';
const EXEC = process.env.CHROME_BIN || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const URL = 'file://' + process.cwd() + '/index.html';

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.Arcade, { timeout: 8000 });
await page.evaluate(() => { location.hash = '#g/ising'; });
await page.waitForFunction(() => window.__ising, { timeout: 8000 });
await page.evaluate(() => window.__ising.setRunning(false));  // we drive sweeps ourselves

async function pointAt(T, equil, samples) {
  return page.evaluate(({ T, equil, samples }) => {
    window.__ising.reset({ T, cold: true });   // start from the aligned branch
    for (let i = 0; i < equil; i++) window.__ising.sweep(1);
    let s1 = 0, s2 = 0;
    for (let i = 0; i < samples; i++) {
      window.__ising.sweep(1);
      const a = window.__ising.stats().absM;
      s1 += a; s2 += a * a;
    }
    const mean = s1 / samples, varr = Math.max(0, s2 / samples - mean * mean);
    const size = window.__ising.stats().size;
    return { m: mean, chi: size * varr / T };
  }, { T, equil, samples });
}

console.log('\n=== Curie Point / 2D Ising sweep (100x100 lattice) ===');
console.log('    T      |M|      chi        (exact T_c = 2.26919)');
let peakChi = -1, peakT = null, prevM = 1, dropT = null;
for (let i = 0; i <= 26; i++) {
  const T = 1.6 + (3.0 - 1.6) * i / 26;
  const r = await pointAt(T, 60, 80);
  const bar = '#'.repeat(Math.round(r.m * 24));
  console.log('  ' + T.toFixed(3) + '   ' + r.m.toFixed(3) + '   ' + Math.round(r.chi).toString().padStart(7) + '   ' + bar);
  if (r.chi > peakChi) { peakChi = r.chi; peakT = T; }
  if (dropT === null && prevM > 0.5 && r.m <= 0.5) dropT = T;
  prevM = r.m;
}
console.log('\nsusceptibility peaks near T = ' + (peakT || '?').toFixed(3) +
  '   |   |M| crosses 0.5 near T = ' + (dropT ? dropT.toFixed(3) : '?'));
console.log('(finite-size estimates of T_c; exact value is 2.26919)');
await browser.close();
console.log('done.\n');
