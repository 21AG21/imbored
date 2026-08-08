/* Measured (f, k) sweep for the Gray-Scott reaction-diffusion sim.
 *
 * Loads the real arcade in a headless browser, drives the game's test seam
 * (window.__rd) to advance the actual simulation thousands of steps per (f, k)
 * point, and classifies each as uniform or patterned by the standard deviation
 * of B once it settles. It then re-checks each shipped preset and prints its
 * mean time-to-onset. The presets in js/games/reactdiff.js come from this table.
 *
 * Run:  NODE_PATH=<dir with playwright-core> node tools/sweep-reactdiff.mjs
 * (playwright-core is a dev-only dependency; it is not needed to run the site.)
 */
import { chromium } from 'playwright-core';

const EXEC = process.env.CHROME_BIN ||
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const URL = 'file://' + process.cwd() + '/index.html';

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.Arcade, { timeout: 8000 });
await page.evaluate(() => { location.hash = '#g/reactdiff'; });
await page.waitForFunction(() => window.__rd, { timeout: 8000 });
await page.evaluate(() => window.__rd.setRunning(false)); // only explicit steps advance

/* run one (f,k) point inside the page: reset, step, sample std(B) over time */
async function run(f, k, steps, sampleEvery) {
  return page.evaluate(({ f, k, steps, sampleEvery }) => {
    window.__rd.reset({ f, k, blobs: 7 });
    const samples = [];
    for (let s = 0; s < steps; s += sampleEvery) {
      window.__rd.step(sampleEvery);
      const st = window.__rd.stats();
      samples.push({ step: s + sampleEvery, std: st.stdB, cover: st.coverage, mean: st.meanB });
    }
    const last = samples[samples.length - 1];
    const finalStd = last.std;
    /* onset = when the pattern has SPREAD, not when the seed exists: first step
       where coverage reaches 90% of its final value (only meaningful if a
       pattern actually formed). The seed's own variance makes a std-based
       onset fire at step 1, which measures nothing. */
    let onset = -1;
    if (finalStd > 0.02 && last.cover > 0.02) {
      for (const p of samples) { if (p.cover >= 0.9 * last.cover) { onset = p.step; break; } }
    }
    return { finalStd, cover: last.cover, mean: last.mean, onset };
  }, { f, k, steps, sampleEvery });
}

function classify(r) {
  if (r.mean < 0.005 && r.cover < 0.01) return 'dead';   // B washed out, uniform A
  if (r.finalStd < 0.02) return 'uniform';
  return 'PATTERN';
}

/* ---- coarse map: is the interesting band really this narrow? ---- */
const fs = [0.014, 0.022, 0.030, 0.037, 0.045, 0.054, 0.062, 0.078];
const ks = [0.050, 0.055, 0.058, 0.060, 0.062, 0.065, 0.068];
console.log('\n=== coarse (f,k) sweep, 2500 steps, 64-sample, grid 144x112 ===');
process.stdout.write('  f \\ k  ');
for (const k of ks) process.stdout.write(String(k).padStart(7));
console.log();
for (const f of fs) {
  process.stdout.write(String(f).padStart(7) + '  ');
  for (const k of ks) {
    const r = await run(f, k, 2500, 250);
    const c = classify(r);
    process.stdout.write((c === 'PATTERN' ? '  #' + r.finalStd.toFixed(2).slice(1) : c === 'uniform' ? '  ...' : '  ---').padStart(7));
  }
  console.log();
}
console.log('  ( #.NN = patterned, std of B = .NN ;  ... = uniform ;  --- = washed out )');

/* ---- verify each shipped preset: class, final std/coverage, onset ---- */
const PRESETS = [
  { id: 'mitosis', f: 0.0367, k: 0.0649 },
  { id: 'coral', f: 0.0545, k: 0.0620 },
  { id: 'spots', f: 0.0300, k: 0.0620 },
  { id: 'worms', f: 0.0545, k: 0.0630 },
  { id: 'maze', f: 0.0290, k: 0.0570 },
  { id: 'holes', f: 0.0390, k: 0.0580 }
];
console.log('\n=== shipped presets (5000 steps; onset = step where coverage reaches 90% of final) ===');
console.log('  the sim runs 8 steps per animation frame, so ~480 steps/sec on screen.');
console.log('  preset     f       k       class     finalStd  coverage   onset   ~onscreen');
for (const p of PRESETS) {
  const r = await run(p.f, p.k, 5000, 100);
  console.log(
    '  ' + p.id.padEnd(9),
    String(p.f).padEnd(7), String(p.k).padEnd(7),
    classify(r).padEnd(9),
    r.finalStd.toFixed(3).padStart(7),
    (Math.round(r.cover * 100) + '%').padStart(9),
    (r.onset < 0 ? 'n/a' : r.onset).toString().padStart(8),
    (r.onset < 0 ? '' : (r.onset / 480).toFixed(1) + 's').padStart(9)
  );
}

await browser.close();
console.log('\ndone.\n');
