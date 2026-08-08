/* Measured threshold sweep for the Sick Day (spatial SIR) sim, and the source
 * of its R0 calibration. Drives window.__sir: at each spread rate beta (fixed
 * gamma, occupancy) it runs the epidemic to burnout many times and reports the
 * mean final attack rate. The attack rate takes off sharply as the epidemic
 * threshold is crossed; the sim's displayed R0 uses an effective contact number
 * (3.3) chosen so R0=1 lands at that measured takeoff rather than at the naive
 * 8-neighbour value, which would overstate spread.
 *
 * Run:  node tools/sweep-sir.mjs   (needs playwright-core; dev-only)
 */
import { chromium } from 'playwright-core';
const EXEC = process.env.CHROME_BIN || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const URL = 'file://' + process.cwd() + '/index.html';
const GAMMA = 0.12, OCC = 0.92, CEFF = 3.3;

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.Arcade, { timeout: 8000 });
await page.evaluate(() => { location.hash = '#g/sir'; });
await page.waitForFunction(() => window.__sir, { timeout: 8000 });
await page.evaluate(() => window.__sir.setRunning(false));

console.log('\n=== Sick Day SIR threshold sweep (gamma=' + GAMMA + ', occupancy=' + OCC + ', 6 trials/point) ===');
console.log('  beta   R0(calib)   attack-rate');
for (let i = 0; i <= 14; i++) {
  const beta = 0.02 + (0.30 - 0.02) * i / 14;
  const attack = await page.evaluate(({ beta, GAMMA, OCC }) => {
    let acc = 0;
    for (let t = 0; t < 6; t++) { window.__sir.reset({ beta, gamma: GAMMA, occ: OCC }); acc += window.__sir.runToEnd().finalSize; }
    return acc / 6;
  }, { beta, GAMMA, OCC });
  const R0 = OCC * CEFF * beta / GAMMA;
  const bar = '#'.repeat(Math.round(attack * 24));
  console.log('  ' + beta.toFixed(3) + '   ' + R0.toFixed(2).padStart(6) + '     ' + (Math.round(attack * 100) + '%').padStart(5) + '  ' + bar);
}
console.log('\nThe attack rate takes off where R0(calib) passes 1 — which is the point of the calibration.');
await browser.close();
console.log('done.\n');
