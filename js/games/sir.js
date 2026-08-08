/* Sick Day — a spatial SIR epidemic (Kermack-McKendrick, on a lattice).
 *
 * Every desk is Susceptible, Infected, or Recovered. Each step an infected desk
 * infects each susceptible neighbour with probability beta and itself recovers
 * with probability gamma. One uniform rule. The basic reproduction number is
 * roughly R0 = (contacts * beta) / gamma: below the epidemic threshold the
 * cough fizzles in a corner; above it, it sweeps the floor into empty chairs.
 * The instrument is the textbook curve — the susceptible line falling, the
 * infected hump, the recovered line rising to the final attack rate. Desk
 * spacing (the empty fraction) and beta are your levers; the goal is to keep
 * the final size under a cap by pushing R0 back under 1.
 */
(function () {
  'use strict';
  const { h, clamp } = Engine;
  const W = 540, H = 540, L = 90;
  const CELL = W / L;
  const EMPTY = 0, S = 1, I = 2, R = 3;

  function mount(root, api) {
    const bagg = Engine.bag();
    let grid = new Uint8Array(L * L);
    let next = new Uint8Array(L * L);
    let beta = 0.10, gamma = 0.12, occ = 0.92;
    let running = false, tstep = 0, peakI = 0, occCount = 0;
    const series = [];   // {s,i,r} fractions per step

    const cv = Engine.canvas(root, W, H, { maxHeight: '60vh' });
    const ctx = cv.ctx;
    const plot = h('canvas', { class: 'fire-plot', width: 520, height: 200 });
    root.appendChild(h('div', { class: 'fire-panel' }, plot));
    const pctx = plot.getContext('2d');

    const pR0 = api.pill('R0 ~ 1.0');
    const pInf = api.pill('Infected: 0%');
    const pAttack = api.pill('Attack rate: 0%');

    const betaS = h('input', { type: 'range', min: '0.02', max: '0.5', step: '0.01', value: '0.10', class: 'slider' });
    const gammaS = h('input', { type: 'range', min: '0.04', max: '0.4', step: '0.01', value: '0.12', class: 'slider' });
    const occS = h('input', { type: 'range', min: '0.4', max: '1', step: '0.02', value: '0.92', class: 'slider' });
    betaS.addEventListener('input', () => { beta = parseFloat(betaS.value); syncPills(); });
    gammaS.addEventListener('input', () => { gamma = parseFloat(gammaS.value); syncPills(); });
    occS.addEventListener('input', () => { occ = parseFloat(occS.value); reset(); });
    api.toolbar.appendChild(h('label', { class: 'sel-wrap' }, h('span', null, 'spread beta'), betaS));
    api.toolbar.appendChild(h('label', { class: 'sel-wrap' }, h('span', null, 'recover gamma'), gammaS));
    api.toolbar.appendChild(h('label', { class: 'sel-wrap' }, h('span', null, 'occupancy'), occS));
    const runBtn = api.button('Run', () => { running = !running; runBtn.textContent = running ? 'Pause' : 'Run'; });
    api.button('Reset', reset);

    /* R0 = effective-contacts * beta / gamma. The effective contact number
       (3.3, not the raw 8 neighbours) is CALIBRATED so this crosses 1 at the
       lattice's measured epidemic threshold — see tools/sweep-sir.mjs. Without
       that calibration the readout would claim an epidemic where the model
       actually fizzles. */
    function r0() { return (occ * 3.3 * beta) / gamma; }

    function reset() {
      occCount = 0;
      for (let i = 0; i < grid.length; i++) { const o = Math.random() < occ; grid[i] = o ? S : EMPTY; if (o) occCount++; }
      /* seed a small cluster of infected near the centre */
      const c = ((L / 2) | 0) * L + ((L / 2) | 0);
      for (const j of [c, c + 1, c - 1, c + L, c - L]) if (grid[j] === S) grid[j] = I;
      running = false; runBtn.textContent = 'Run'; tstep = 0; peakI = 0;
      series.length = 0;
      api.status('Set the spread rate, recovery rate and how packed the desks are, then Run. The epidemic takes off or fizzles depending on whether R0 clears 1.');
      recordAndSync();
    }

    function counts() {
      let s = 0, i = 0, r = 0;
      for (let k = 0; k < grid.length; k++) { const v = grid[k]; if (v === S) s++; else if (v === I) i++; else if (v === R) r++; }
      return { s: s, i: i, r: r };
    }

    /* one synchronous SIR update over the whole lattice */
    function step() {
      next.set(grid);
      for (let y = 0; y < L; y++) {
        for (let x = 0; x < L; x++) {
          const idx = y * L + x, v = grid[idx];
          if (v === S) {
            let inf = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= L || ny >= L) continue;
              if (grid[ny * L + nx] === I) inf++;
            }
            if (inf && Math.random() < 1 - Math.pow(1 - beta, inf)) next[idx] = I;
          } else if (v === I) {
            if (Math.random() < gamma) next[idx] = R;
          }
        }
      }
      const t = grid; grid = next; next = t;
      tstep++;
    }

    function recordAndSync() {
      const c = counts();
      const tot = occCount || 1;
      series.push({ s: c.s / tot, i: c.i / tot, r: c.r / tot });
      if (c.i / tot > peakI) peakI = c.i / tot;
      pR0.textContent = 'R0 ~ ' + r0().toFixed(2);
      pR0.className = 'pill ' + (r0() > 1 ? 'warn' : 'good');
      pInf.textContent = 'Infected: ' + Math.round(c.i / tot * 100) + '%';
      pAttack.textContent = 'Attack rate: ' + Math.round(c.r / tot * 100) + '%';
      return c;
    }
    function syncPills() { pR0.textContent = 'R0 ~ ' + r0().toFixed(2); pR0.className = 'pill ' + (r0() > 1 ? 'warn' : 'good'); }

    function drawPlot() {
      const w = plot.width, hh = plot.height, m = 24;
      pctx.fillStyle = '#12100c'; pctx.fillRect(0, 0, w, hh);
      pctx.strokeStyle = '#4a4436'; pctx.lineWidth = 1;
      pctx.beginPath(); pctx.moveTo(m, hh - m); pctx.lineTo(w - 6, hh - m); pctx.moveTo(m, hh - m); pctx.lineTo(m, 8); pctx.stroke();
      pctx.fillStyle = '#8a8064'; pctx.font = '10px Verdana, sans-serif';
      pctx.fillText('fraction', 2, 12); pctx.fillText('time', w - 30, hh - 8);
      const n = series.length; if (n < 2) return;
      const X = (k) => m + k / (n - 1) * (w - m - 6);
      const Y = (f) => (hh - m) - f * (hh - m - 8);
      const lineOf = (key, col) => {
        pctx.strokeStyle = col; pctx.lineWidth = 2; pctx.beginPath();
        for (let k = 0; k < n; k++) { const x = X(k), y = Y(series[k][key]); k ? pctx.lineTo(x, y) : pctx.moveTo(x, y); }
        pctx.stroke();
      };
      lineOf('s', '#00a6b4');   // susceptible
      lineOf('r', '#a79e88');   // recovered
      lineOf('i', '#e8402a');   // infected hump
      pctx.fillStyle = '#e8402a'; pctx.fillText('infected', w - 120, 14);
      pctx.fillStyle = '#00a6b4'; pctx.fillText('S', w - 46, 14);
      pctx.fillStyle = '#a79e88'; pctx.fillText('R', w - 30, 14);
    }

    function draw() {
      ctx.fillStyle = '#141019'; ctx.fillRect(0, 0, W, H);
      for (let k = 0; k < grid.length; k++) {
        const v = grid[k];
        if (v === EMPTY) continue;
        ctx.fillStyle = v === S ? '#d9c9a0' : v === I ? '#e8402a' : '#6b6350';
        ctx.fillRect((k % L) * CELL, ((k / L) | 0) * CELL, CELL + 1, CELL + 1);
      }
      drawPlot();
    }

    window.__sir = {
      reset(opts) {
        if (opts) { if (opts.beta != null) { beta = opts.beta; betaS.value = String(beta); } if (opts.gamma != null) { gamma = opts.gamma; gammaS.value = String(gamma); } if (opts.occ != null) { occ = opts.occ; occS.value = String(occ); } }
        reset();
      },
      step() { step(); const c = counts(); return { s: c.s, i: c.i, r: c.r }; },
      runToEnd() {
        let guard = 0, pk = 0;
        while (guard++ < 5000) { const c = counts(); if (c.i > pk) pk = c.i; if (c.i === 0) break; step(); }
        const c = counts(); const tot = occCount || 1;
        return { finalSize: c.r / tot, peakI: pk / tot, duration: tstep };
      },
      stats() { const c = counts(); const tot = occCount || 1; return { S: c.s / tot, I: c.i / tot, R: c.r / tot, R0: r0() }; },
      setRunning(v) { running = !!v; }
    };
    bagg.add(() => { if (window.__sir) delete window.__sir; });

    reset();
    bagg.add(Engine.loop(() => {
      if (running) {
        const c = counts();
        if (c.i === 0) { running = false; runBtn.textContent = 'Run'; api.submit(Math.round((c.r / (occCount || 1)) * 100)); api.status('Burned out after ' + tstep + ' steps. Final attack rate ' + Math.round(c.r / (occCount || 1) * 100) + '%. Lower beta or thin the desks to push R0 under 1.'); }
        else { step(); recordAndSync(); }
      }
      draw();
    }));

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'sir',
    title: 'Sick Day',
    emoji: 'sir',
    cat: 'sim',
    order: 8,
    blurb: 'Someone coughs at the coffee machine. Whether it fizzles at three desks or empties the floor comes down to one number crossing one line — the real epidemic threshold, not a scare.',
    scoreLabel: 'Worst attack rate',
    tags: ['sir', 'epidemic', 'threshold', 'emergence'],
    how: [
      'Every desk is susceptible (paper), infected (red), or recovered (grey). Each step an infected desk infects susceptible neighbours with probability beta and recovers with probability gamma.',
      'R0, shown live, is beta times an effective contact number over gamma, calibrated so it crosses 1 at this lattice\'s measured threshold. Under 1 the outbreak dies out; over 1 it takes off. That crossing is the whole ballgame.',
      'Your levers are the spread rate, the recovery rate, and occupancy — thinning the desks is literally social distancing.',
      'The instrument is the classic curve: susceptible falling, the infected hump, recovered rising to the final attack rate.',
      'Try to keep the attack rate low by dragging R0 back under 1. Your score is the worst attack rate you trigger.'
    ],
    mount
  });
})();
