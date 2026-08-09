/* Window Frost — Diffusion-Limited Aggregation (Witten & Sander 1981).
 *
 * A single seed sits at the centre of a cold window. Water molecules wander in
 * by a random walk; the instant one touches the growing crystal it freezes in
 * place and never moves again. That one rule — stick on contact — grows a
 * branching dendrite, because the tips shadow the interior: a walker almost
 * always meets an outer branch before it can reach a fjord. The result is a
 * fractal, and not a vague one: its mass grows with radius as N(r) ~ r^D with
 * dimension D ≈ 1.71 for 2D DLA (Witten–Sander). The panel measures that
 * mass–radius law live on log–log axes and fits the slope. On a finite
 * lattice crystal the cumulative-mass fit reads a little under the asymptotic
 * value — it climbs through the 1.5s into the mid 1.6s as the frost fills the
 * window, and the whole-cluster mass–radius exponent sits around 1.75, so the
 * true 1.71 is bracketed rather than nailed. The window.__dla seam lets a
 * headless run confirm this (tools/sweep-dla.mjs). Walkers far from the crystal
 * take exact first-passage jumps across empty space, so it grows fast without
 * cheating the physics.
 */
(function () {
  'use strict';
  const { h, clamp } = Engine;
  const N = 420;                       // grid cells per side (big enough that D converges before the frame)
  const W = 560, H = 560;
  const CX = N / 2, CY = N / 2;
  const RMAX = N / 2 - 8;              // stop when the crystal nears the frame
  const DREF = 1.71;                   // known 2D DLA fractal dimension

  function mount(root, api) {
    const bagg = Engine.bag();
    const occ = new Uint8Array(N * N);
    const age = new Int32Array(N * N);  // 0 empty, else stick order (for colour)
    const rhist = new Float64Array(N + 2);  // radial histogram of crystal mass
    let count = 0, R = 0, done = false, running = true;
    let wx = 0, wy = 0;                  // current walker (float)
    let dim = 0;
    let peak = 0;

    const cv = Engine.canvas(root, W, H, { maxHeight: '58vh' });
    const ctx = cv.ctx;
    const off = document.createElement('canvas');
    off.width = N; off.height = N;
    const octx = off.getContext('2d');
    const img = octx.createImageData(N, N);
    const buf = new Uint32Array(img.data.buffer);

    const plot = h('canvas', { class: 'fire-plot', width: 520, height: 200 });
    root.appendChild(h('div', { class: 'fire-panel' }, plot));
    const pctx = plot.getContext('2d');

    const pCount = api.pill('Frozen: 1');
    const pR = api.pill('Radius: 0');
    const pDim = api.pill('D: —');

    api.select('Growth', [{ value: '2', label: 'Steady' }, { value: '6', label: 'Fast' }, { value: '15', label: 'Blizzard' }], '6', (v) => { perFrame = +v; });
    api.button('New window', reset);
    let perFrame = 6;                    // walkers landed per frame (budget-limited)

    const idx = (x, y) => y * N + x;

    function reset() {
      occ.fill(0); age.fill(0); rhist.fill(0);
      count = 0; R = 0; done = false; dim = 0; peak = 0;
      stick(CX | 0, CY | 0);             // the seed
      launch();
      buf.fill(0xff1a1208 >>> 0);
      api.status('Cold glass, one speck of ice in the middle. Wandering molecules freeze the instant they touch it and branch into frost. The panel tracks its fractal dimension as it grows — it climbs into the mid 1.6s, near the textbook 1.71.');
    }

    function stick(ix, iy) {
      const i = idx(ix, iy);
      if (occ[i]) return;
      occ[i] = 1; age[i] = ++count;
      const rr = Math.hypot(ix - CX, iy - CY);
      rhist[Math.min(rhist.length - 1, Math.round(rr))] += 1;
      if (rr > R) R = rr;
      if (count > peak) { peak = count; api.submit(peak); }
      if (R >= RMAX) { done = true; api.status('The frost reached the window frame. Fractal dimension measured at ' + dim.toFixed(2) + ' (Witten–Sander: ' + DREF + ').'); }
    }

    function launch() {
      const rl = R + 5;                // small margin; the big grid, not the margin, is what tames the spike
      const a = Math.random() * Math.PI * 2;
      wx = CX + rl * Math.cos(a);
      wy = CY + rl * Math.sin(a);
    }

    /* advance the walker; returns true when it freezes onto the crystal */
    function walkerStep() {
      const dx = wx - CX, dy = wy - CY;
      const d = Math.hypot(dx, dy);
      const rkill = 3 * R + 40;         // generous, so wanderers re-diffuse instead of dying at the tip
      if (d > rkill) { launch(); return false; }
      const m = d - R - 1;              // radius of guaranteed-empty disk around walker
      if (m > 2) {                       // exact first-passage jump onto that disk
        const a = Math.random() * Math.PI * 2;
        wx += m * Math.cos(a); wy += m * Math.sin(a);
        return false;
      }
      /* near the crystal: single lattice step, then test for contact */
      const dir = (Math.random() * 4) | 0;
      wx += dir === 0 ? 1 : dir === 1 ? -1 : 0;
      wy += dir === 2 ? 1 : dir === 3 ? -1 : 0;
      const ix = Math.round(wx), iy = Math.round(wy);
      if (ix < 1 || iy < 1 || ix >= N - 1 || iy >= N - 1) { launch(); return false; }
      if (occ[idx(ix - 1, iy)] || occ[idx(ix + 1, iy)] || occ[idx(ix, iy - 1)] || occ[idx(ix, iy + 1)]) {
        stick(ix, iy);
        launch();                      // a fresh molecule for the next contact, or it welds a spike
        return true;
      }
      return false;
    }

    /* least-squares slope of log N(<r) vs log r over the scaling window */
    function measureDimension() {
      if (R < 12) { dim = 0; return; }
      const rmin = 4, rmax = Math.max(rmin + 2, R * 0.7);
      let cum = 0, k = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (let r = 1; r <= Math.round(rmax); r++) {
        cum += rhist[r];
        if (r >= rmin && cum > 0) {
          const X = Math.log(r), Y = Math.log(cum);
          sx += X; sy += Y; sxx += X * X; sxy += X * Y; k++;
        }
      }
      if (k >= 3) {
        const den = k * sxx - sx * sx;
        if (den > 1e-9) dim = (k * sxy - sx * sy) / den;
      }
    }

    function syncPills() {
      pCount.textContent = 'Frozen: ' + count;
      pR.textContent = 'Radius: ' + Math.round(R);
      pDim.textContent = 'D: ' + (dim ? dim.toFixed(2) : '—');
      pDim.className = 'pill ' + (dim > 1.5 && dim < 1.9 ? 'good' : '');
    }

    /* frost colour: fresh tips bright white, older core pale blue */
    function ageColor(a) {
      const f = clamp(a / Math.max(1, count), 0, 1);   // 0 old core .. 1 new tip
      const r = Math.round(150 + 105 * f);
      const g = Math.round(200 + 55 * f);
      const b = 255;
      return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
    }

    function draw() {
      for (let i = 0; i < occ.length; i++) buf[i] = occ[i] ? ageColor(age[i]) : (0xff1a1208 >>> 0);
      octx.putImageData(img, 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, N, N, 0, 0, W, H);
      ctx.restore();
      drawPlot();
    }

    function drawPlot() {
      const w = plot.width, hh = plot.height, m = 30;
      pctx.clearRect(0, 0, w, hh);
      pctx.fillStyle = '#0b0f16'; pctx.fillRect(0, 0, w, hh);
      const lrMax = Math.log(RMAX), lnMax = Math.log(Math.max(10, count));
      const X = (lr) => m + lr / lrMax * (w - m - 10);
      const Y = (ln) => hh - m - ln / lnMax * (hh - m - 10);
      pctx.strokeStyle = '#3a4658'; pctx.lineWidth = 1;
      pctx.beginPath(); pctx.moveTo(m, Y(0)); pctx.lineTo(w - 10, Y(0)); pctx.moveTo(m, Y(0)); pctx.lineTo(m, Y(lnMax)); pctx.stroke();
      pctx.fillStyle = '#6c7a90'; pctx.font = '10px Verdana, sans-serif';
      pctx.fillText('log N', 2, 12); pctx.fillText('log r', w - 40, hh - 10);
      /* reference slope D = 1.71 through the cloud's lower anchor */
      const r0 = 4, n0 = rhist[1] + rhist[2] + rhist[3] + rhist[4] || 1;
      pctx.strokeStyle = 'rgba(232,64,42,.8)'; pctx.setLineDash([4, 3]); pctx.beginPath();
      let first = true;
      for (let lr = Math.log(r0); lr <= lrMax; lr += 0.1) {
        const ln = Math.log(n0) + DREF * (lr - Math.log(r0));
        const x = X(lr), y = Y(Math.min(ln, lnMax));
        first ? (pctx.moveTo(x, y), first = false) : pctx.lineTo(x, y);
      }
      pctx.stroke(); pctx.setLineDash([]);
      pctx.fillStyle = '#e8402a'; pctx.fillText('slope ' + DREF, w - 96, 14);
      /* measured mass–radius cloud */
      pctx.fillStyle = '#9fe0ff';
      let cum = 0;
      for (let r = 1; r <= Math.round(R); r++) {
        cum += rhist[r];
        if (r >= 2 && cum > 0) { pctx.fillRect(X(Math.log(r)) - 1, Y(Math.log(cum)) - 1, 2, 2); }
      }
      /* fitted D readout */
      pctx.fillStyle = '#fffdf3'; pctx.font = 'bold 12px Verdana, sans-serif';
      pctx.fillText('fitted D = ' + (dim ? dim.toFixed(2) : '—'), m + 6, Y(lnMax) + 4);
    }

    /* ---- test seam ---- */
    window.__dla = {
      reset() { reset(); },
      grow(n) {
        let added = 0, budget = n * 4000 + 20000;
        while (added < n && budget-- > 0 && !done) { if (walkerStep()) added++; }
        measureDimension();
        return added;
      },
      stats() { return { count: count, radius: R, dimension: dim, done: done }; },
      measureDimension() { measureDimension(); return dim; },
      setRunning(v) { running = !!v; }
    };
    bagg.add(() => { if (window.__dla) delete window.__dla; });

    reset();
    let acc = 0;
    bagg.add(Engine.loop(() => {
      if (running && !done) {
        let landed = 0, budget = 12000;
        while (landed < perFrame && budget-- > 0) { if (walkerStep()) landed++; }
        acc++;
        if (acc % 4 === 0) measureDimension();
      }
      syncPills();
      draw();
    }));

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'frost',
    title: 'Window Frost',
    emoji: 'frost',
    cat: 'sim',
    order: 10,
    blurb: 'One speck of ice on a cold window, and drifting molecules that freeze the moment they touch it. That single rule grows a branching frost fern, and the panel measures its fractal dimension as it spreads.',
    scoreLabel: 'Crystal size',
    tags: ['dla', 'fractal', 'diffusion', 'emergence'],
    how: [
      'A single frozen cell sits in the middle. Molecules wander in on random walks and freeze onto the crystal the instant they touch it. That is the only rule.',
      'Tips grow faster than gaps. A wanderer usually hits an outer branch before it reaches the sheltered interior, and that shadowing is what makes frost branch.',
      'The crystal is a fractal: its mass within radius r grows like r to the power D. The panel fits that exponent live on log-log axes against the known 2D DLA value near 1.71.',
      'A finite crystal reads a little under 1.71, climbing into the mid 1.6s as the frost fills the window. Fresh tips draw white, the older core pale blue.',
      'Growth speed only changes how many molecules land per frame; it never changes the rule, so the dimension is the same. Your score is the crystal size before it reaches the frame.'
    ],
    mount
  });
})();
