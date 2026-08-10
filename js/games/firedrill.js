/* Fire Drill — 2D site percolation.
 *
 * Fill a grid: each desk holds flammable paper independently with probability p.
 * Light every occupied desk in the top row and let fire spread to orthogonally
 * adjacent occupied desks — one uniform rule, no special cases. Below a critical
 * density the fire dies in a corner; above it, it rips clear across. The knife-
 * edge is the site-percolation threshold p_c ~ 0.5927 for the square lattice
 * (Stauffer & Aharony) — the default is parked right on it so the transition is
 * visible. The reference curve on the panel is measured live from the model, and
 * the window.__fire seam lets a headless sweep bisect to p_c (tools/sweep-firedrill.mjs).
 */
(function () {
  'use strict';
  const { h, clamp } = Engine;
  const W = 560, H = 560, N = 90;               // 90x90 desks
  const PC = 0.5927;                            // known critical density
  const CELL = W / N;
  const EMPTY = 0, TREE = 1, FIRE = 2, BURNT = 3;

  function mount(root, api) {
    const bagg = Engine.bag();
    const grid = new Uint8Array(N * N);
    let frontier = [];
    let p = 0.60, trees = 0, burnt = 0, running = false, spanned = false, done = false, peak = 0;
    const samples = [];                          // {p, burned} the player has ignited
    let ref = [];                                // measured reference curve

    const cv = Engine.canvas(root, W, H, { maxHeight: '62vh' });
    const ctx = cv.ctx;
    const plot = h('canvas', { class: 'fire-plot', width: 520, height: 200 });
    root.appendChild(h('div', { class: 'fire-panel' }, plot));
    const pctx = plot.getContext('2d');

    const pDensity = api.pill('Density p: 0.60');
    const pBurn = api.pill('Burned: 0%');
    const pSpan = api.pill('Spanned: no');

    const slider = h('input', { type: 'range', min: '0.30', max: '0.85', step: '0.005', value: '0.60', class: 'slider' });
    slider.addEventListener('input', () => { p = parseFloat(slider.value); regen(); });
    api.toolbar.appendChild(h('label', { class: 'sel-wrap' }, h('span', null, 'density'), slider));
    const igniteBtn = api.button('Ignite', ignite);
    api.button('Reset', regen);

    function regen() {
      for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < p ? TREE : EMPTY;
      trees = 0;
      for (let i = 0; i < grid.length; i++) if (grid[i] === TREE) trees++;
      frontier = []; burnt = 0; running = false; spanned = false; done = false;
      igniteBtn.disabled = false;
      syncPills();
      api.status('Set the paper density and hit Ignite. Below about ' + PC + ' the fire fizzles; above it, it sweeps the floor.');
    }

    function ignite() {
      if (done || frontier.length) return;
      for (let x = 0; x < N; x++) if (grid[x] === TREE) { grid[x] = FIRE; frontier.push(x); }
      running = true;
      igniteBtn.disabled = true;
      if (!frontier.length) finish();
    }

    /* one BFS layer of the fire; the ONLY rule in the model */
    function stepBurn() {
      const next = [];
      for (let k = 0; k < frontier.length; k++) {
        const i = frontier[k];
        const x = i % N, y = (i / N) | 0;
        if (y === N - 1) spanned = true;
        const nb = [x > 0 ? i - 1 : -1, x < N - 1 ? i + 1 : -1, y > 0 ? i - N : -1, y < N - 1 ? i + N : -1];
        for (let d = 0; d < 4; d++) {
          const j = nb[d];
          if (j >= 0 && grid[j] === TREE) { grid[j] = FIRE; next.push(j); }
        }
        grid[i] = BURNT; burnt++;
      }
      frontier = next;
      return frontier.length > 0;
    }

    function runToEnd() { while (frontier.length) stepBurn(); if (running) finish(); }

    function finish() {
      running = false; done = true;
      const frac = trees ? burnt / trees : 0;
      samples.push({ p, burned: frac });
      if (frac > peak) { peak = frac; api.submit(Math.round(peak * 100)); }
      syncPills();
      api.status('Burned ' + Math.round(frac * 100) + '% of the paper. ' +
        (spanned ? 'The fire reached the far wall.' : 'It stopped short — under the threshold, it cannot cross.'));
    }

    function syncPills() {
      const frac = trees ? burnt / trees : 0;
      pDensity.textContent = 'Density p: ' + p.toFixed(3);
      pBurn.textContent = 'Burned: ' + Math.round(frac * 100) + '%';
      pSpan.textContent = 'Spanned: ' + (spanned ? 'yes' : 'no');
      pSpan.className = 'pill ' + (spanned ? 'warn' : '');
    }

    /* a quick, real sweep of the model to draw the reference S-curve */
    function measureReference() {
      const g = new Uint8Array(40 * 40);
      const out = [];
      for (let pi = 0; pi <= 24; pi++) {
        const pp = 0.30 + (0.85 - 0.30) * pi / 24;
        let acc = 0;
        for (let t = 0; t < 4; t++) {
          for (let i = 0; i < g.length; i++) g[i] = Math.random() < pp ? 1 : 0;
          let tr = 0; for (let i = 0; i < g.length; i++) if (g[i] === 1) tr++;
          let fr = [];
          for (let x = 0; x < 40; x++) if (g[x] === 1) { g[x] = 2; fr.push(x); }
          let bt = 0;
          while (fr.length) {
            const nx = [];
            for (const i of fr) {
              const x = i % 40, y = (i / 40) | 0;
              const nb = [x > 0 ? i - 1 : -1, x < 39 ? i + 1 : -1, y > 0 ? i - 40 : -1, y < 39 ? i + 40 : -1];
              for (const j of nb) if (j >= 0 && g[j] === 1) { g[j] = 2; nx.push(j); }
              g[i] = 3; bt++;
            }
            fr = nx;
          }
          acc += tr ? bt / tr : 0;
        }
        out.push({ p: pp, burned: acc / 4 });
      }
      return out;
    }

    function drawPlot() {
      const doc = Arcade.docMode();
      const w = plot.width, hh = plot.height, m = 26;
      pctx.clearRect(0, 0, w, hh);
      pctx.fillStyle = doc ? Engine.docPaper() : '#12100c'; pctx.fillRect(0, 0, w, hh);
      const X = (pp) => m + (pp - 0.30) / (0.85 - 0.30) * (w - m - 8);
      const Y = (f) => hh - m - f * (hh - m - 8);
      /* axes */
      pctx.strokeStyle = doc ? Engine.docInk() : '#4a4436'; pctx.lineWidth = 1;
      pctx.beginPath(); pctx.moveTo(m, Y(0)); pctx.lineTo(w - 8, Y(0)); pctx.moveTo(m, Y(0)); pctx.lineTo(m, Y(1)); pctx.stroke();
      pctx.fillStyle = doc ? Engine.docInk() : '#f2ede0'; pctx.font = '10px Verdana, sans-serif';
      pctx.fillText('burned', 2, 12); pctx.fillText('density p', w - 62, hh - 8);
      /* p_c line */
      pctx.strokeStyle = doc ? Engine.docInk() : 'rgba(232,64,42,.8)'; pctx.setLineDash([4, 3]);
      pctx.beginPath(); pctx.moveTo(X(PC), Y(0)); pctx.lineTo(X(PC), Y(1)); pctx.stroke();
      pctx.setLineDash([]);
      pctx.fillStyle = doc ? Engine.docInk() : '#f2ede0'; pctx.fillText('p_c ' + PC, X(PC) + 3, Y(1) + 10);
      /* reference curve — ink, dotted, so it reads apart from the dashed p_c line without a second grey */
      if (ref.length) {
        pctx.strokeStyle = doc ? Engine.docInk() : '#00a6b4'; pctx.lineWidth = 2;
        if (doc) pctx.setLineDash([1, 3]);
        pctx.beginPath();
        ref.forEach((s, i) => { const x = X(s.p), y = Y(s.burned); i ? pctx.lineTo(x, y) : pctx.moveTo(x, y); });
        pctx.stroke(); pctx.setLineDash([]);
      }
      /* your samples */
      for (const s of samples) {
        pctx.fillStyle = doc ? Engine.docInk() : '#ffcb1f';
        pctx.beginPath(); pctx.arc(X(s.p), Y(s.burned), 3, 0, 7); pctx.fill();
      }
      /* current p marker */
      pctx.fillStyle = doc ? Engine.docInk() : '#fffdf3';
      pctx.beginPath(); pctx.moveTo(X(p), Y(0) + 2); pctx.lineTo(X(p) - 4, Y(0) + 9); pctx.lineTo(X(p) + 4, Y(0) + 9); pctx.fill();
    }

    function draw() {
      const doc = Arcade.docMode();
      for (let i = 0; i < grid.length; i++) {
        const s = grid[i];
        const x = (i % N) * CELL, y = ((i / N) | 0) * CELL;
        if (doc) {
          /* a dense grid is far too fine for a per-cell outline — that many
             thin lines packed together reads as a grey mesh from a
             distance. Blank paper for standing/unburned, ink only for
             what's notable. */
          if (s === FIRE) { ctx.fillStyle = Engine.docInk(); ctx.fillRect(x, y, CELL + 1, CELL + 1); }
          else if (s === BURNT) {                  // burned out: a small ink mark on blank paper
            ctx.fillStyle = Engine.docInk();
            ctx.beginPath(); ctx.arc(x + CELL / 2, y + CELL / 2, CELL * 0.26, 0, 7); ctx.fill();
          }
        } else {
          ctx.fillStyle = s === EMPTY ? '#141019' : s === TREE ? '#d9c9a0' : s === FIRE ? '#ff5a2a' : '#4a4038';
          ctx.fillRect(x, y, CELL + 1, CELL + 1);
        }
      }
      drawPlot();
    }

    /* ---- test seam: lets a headless sweep bisect to p_c ---- */
    window.__fire = {
      reset(opts) { if (opts && opts.p != null) { p = opts.p; slider.value = String(p); } regen(); },
      ignite() { ignite(); },
      runToEnd() { if (!frontier.length && !done) ignite(); runToEnd(); },
      stats() { return { trees: trees, burned: burnt, burnedFraction: trees ? burnt / trees : 0, spanned: spanned }; },
      setRunning(v) { running = !!v; }
    };
    bagg.add(() => { if (window.__fire) delete window.__fire; });

    ref = measureReference();
    regen();
    bagg.add(Engine.loop(() => {
      if (running && frontier.length) { for (let s = 0; s < 3; s++) if (frontier.length) stepBurn(); if (!frontier.length) finish(); }
      syncPills();
      draw();
    }));

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'firedrill',
    title: 'Fire Drill',
    emoji: 'firedrill',
    cat: 'sim',
    order: 6,
    blurb: 'Pick a paper density with the slider, then ignite the top row. There is a sharp threshold where a small corner fire turns into one that crosses the whole floor.',
    scoreLabel: 'Biggest burn',
    lightBoard: true,   // doc mode draws its own paper/ink palette above; the blanket invert would only flip it back
    tags: ['percolation', 'phase-transition', 'emergence'],
    how: [
      'Set the density slider, then press Ignite to light every papered desk in the top row.',
      'Fire spreads to any papered desk sharing an edge with a burning one. One rule, applied everywhere.',
      'Below the critical density the fire dies in a corner. Above it, the fire crosses the whole floor, and the switch is sharp.',
      'The panel plots burned fraction against density and marks the threshold p_c at 0.5927. Each run you ignite drops a yellow dot.',
      'Your score is the largest burn fraction you set off. Play near the threshold to push it.'
    ],
    mount
  });
})();
