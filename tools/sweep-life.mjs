/* Equilibrium-density check for the Game of Life sim.
 * Drives the game's window.__life seam in a headless browser: it fills the grid
 * with random noise and runs many generations, watching the living fraction
 * collapse from ~0.5 and settle. On a large field Conway's random soup relaxes
 * to a low density near 0.0287; on this finite torus it lands a little above
 * that, in the low 0.03s. It also checks a glider gun makes the population grow
 * without bound. This is what justifies the marked equilibrium line.
 *
 * Run:  node tools/sweep-life.mjs   (needs playwright-core; dev-only)
 */
import { chromium } from 'playwright-core';
const EXEC = process.env.CHROME_BIN || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const URL = 'file://' + process.cwd() + '/index.html';

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.Arcade, { timeout: 8000 });
await page.evaluate(() => { location.hash = '#g/life'; });
await page.waitForFunction(() => window.__life, { timeout: 8000 });
await page.evaluate(() => window.__life.setRunning(false));

console.log('\n=== Game of Life — random-soup equilibrium (known ~0.0287) ===');
console.log('  generation   density');
await page.evaluate(() => window.__life.randomize(0.5));
for (const g of [0, 200, 500, 1000, 1600, 2200]) {
  const d = await page.evaluate((g) => {
    while (window.__life.stats().gen < g) window.__life.step(1);
    return window.__life.stats().density;
  }, g);
  console.log('  ' + String(g).padStart(8) + '     ' + d.toFixed(4));
}

// glider gun grows without bound
const gun = await page.evaluate(() => {
  window.__life.reset(); window.__life.stamp('gun');
  const p0 = window.__life.stats().pop;
  window.__life.step(300);
  const p1 = window.__life.stats().pop;
  return { p0, p1 };
});
console.log('\nglider gun population: ' + gun.p0 + ' -> ' + gun.p1 + ' after 300 gens (grows without bound: ' + (gun.p1 > gun.p0 * 2) + ')');
await browser.close();
console.log('done.\n');
