/* Game of Life — Conway's cellular automaton (John Conway, 1970).
 *
 * A grid of cells, each alive or dead, on a torus. Every generation each cell
 * looks at its eight neighbours and follows one rule with no exceptions: a live
 * cell stays alive with two or three live neighbours (otherwise it dies of
 * loneliness or crowding), and a dead cell springs to life with exactly three.
 * From that single line come gliders that walk, guns that fire them forever,
 * and the whole emergent zoo. It is also honestly measurable: seed the grid
 * with random noise and the population collapses and settles to a low density
 * of a few percent — the accepted large-field figure is about 0.0287, and on
 * this finite 150x150 torus it typically settles a touch higher, around three
 * to four and a half percent (finite size and long-lived oscillators lift it).
 * The panel plots the population live with the 0.0287 reference marked, and the
 * window.__life seam lets a headless run confirm the settling (tools/sweep-life.mjs).
 */
(function () {
  'use strict';
  const { h, clamp } = Engine;
  const N = 150;                       // cells per side (torus)
  const W = 560, H = 560;
  const EQ = 0.0287;                   // accepted random-soup equilibrium density

  /* named patterns, as [x,y] offsets from a placement origin */
  const PATTERNS = {
    glider: [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
    ship: [[1, 0], [4, 0], [0, 1], [0, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3]],
    pulsar: [[2, 0], [3, 0], [4, 0], [8, 0], [9, 0], [10, 0], [0, 2], [5, 2], [7, 2], [12, 2],
      [0, 3], [5, 3], [7, 3], [12, 3], [0, 4], [5, 4], [7, 4], [12, 4], [2, 5], [3, 5], [4, 5], [8, 5], [9, 5], [10, 5],
      [2, 7], [3, 7], [4, 7], [8, 7], [9, 7], [10, 7], [0, 8], [5, 8], [7, 8], [12, 8], [0, 9], [5, 9], [7, 9], [12, 9],
      [0, 10], [5, 10], [7, 10], [12, 10], [2, 12], [3, 12], [4, 12], [8, 12], [9, 12], [10, 12]],
    gun: [[0, 4], [0, 5], [1, 4], [1, 5], [10, 4], [10, 5], [10, 6], [11, 3], [11, 7], [12, 2], [12, 8], [13, 2], [13, 8],
      [14, 5], [15, 3], [15, 7], [16, 4], [16, 5], [16, 6], [17, 5], [20, 2], [20, 3], [20, 4], [21, 2], [21, 3], [21, 4],
      [22, 1], [22, 5], [24, 0], [24, 1], [24, 5], [24, 6], [34, 2], [34, 3], [35, 2], [35, 3]],
    rpent: [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]]
  };

  function mount(root, api) {
    const bagg = Engine.bag();
    let grid = new Uint8Array(N * N);
    let next = new Uint8Array(N * N);
    let pop = 0, gen = 0, running = true, speed = 3, peak = 0;
    const hist = [];                     // population over time for the plot

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

    const pGen = api.pill('Gen 0');
    const pPop = api.pill('Alive 0');
    const pDens = api.pill('Density 0.0%');

    const btnRun = api.button('Pause', toggleRun);
    api.button('Step', () => { stepOnce(); draw(); });
    api.button('Random', () => randomize(0.32));
    api.button('Clear', clearGrid);
    api.select('Speed', [{ value: '1', label: 'Slow' }, { value: '3', label: 'Normal' }, { value: '8', label: 'Fast' }], '3', (v) => { speed = +v; });
    api.select('Drop a pattern', [
      { value: '', label: 'choose…' },
      { value: 'glider', label: 'Glider' },
      { value: 'ship', label: 'Spaceship' },
      { value: 'pulsar', label: 'Pulsar' },
      { value: 'gun', label: 'Glider gun' },
      { value: 'rpent', label: 'R-pentomino' }
    ], '', (v) => { if (v) stamp(v); });

    const cell = W / N;

    function countPop() { let s = 0; for (let i = 0; i < grid.length; i++) s += grid[i]; pop = s; }

    function clearGrid() {
      grid.fill(0); gen = 0; hist.length = 0; countPop(); peak = 0;
      api.status('Click and drag to draw living cells, then press Play and watch them breed and die. Try the pattern buttons.');
      syncPills(); draw();
    }
    function randomize(p) {
      for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < p ? 1 : 0;
      gen = 0; hist.length = 0; countPop(); peak = pop; api.submit(peak);
      running = true; btnRun.textContent = 'Pause';
      api.status('Random soup at ' + Math.round(p * 100) + '%. Watch the crowd crash and settle to a low equilibrium of a few percent, near the marked 0.0287.');
      syncPills(); draw();
    }
    function stamp(name) {
      const pat = PATTERNS[name];
      let maxX = 0, maxY = 0;
      for (const [x, y] of pat) { if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
      const ox = name === 'gun' ? 6 : Math.floor((N - maxX) / 2);
      const oy = name === 'gun' ? 6 : Math.floor((N - maxY) / 2);
      grid.fill(0);
      for (const [x, y] of pat) grid[((oy + y) % N) * N + ((ox + x) % N)] = 1;
      gen = 0; hist.length = 0; countPop(); peak = pop; api.submit(peak);
      api.sfx.blip(700);
      api.status('Dropped a ' + name + '. Press play and watch what one rule does with it.');
      syncPills(); draw();
    }

    /* one generation: the only rule in the model, applied everywhere, toroidal */
    function stepOnce() {
      for (let y = 0; y < N; y++) {
        const yu = (y === 0 ? N - 1 : y - 1) * N, yd = (y === N - 1 ? 0 : y + 1) * N, yc = y * N;
        for (let x = 0; x < N; x++) {
          const xl = x === 0 ? N - 1 : x - 1, xr = x === N - 1 ? 0 : x + 1;
          const n = grid[yu + xl] + grid[yu + x] + grid[yu + xr] +
            grid[yc + xl] + grid[yc + xr] +
            grid[yd + xl] + grid[yd + x] + grid[yd + xr];
          const c = grid[yc + x];
          next[yc + x] = (c ? (n === 2 || n === 3) : (n === 3)) ? 1 : 0;
        }
      }
      const t = grid; grid = next; next = t;
      gen++;
      countPop();
      if (pop > peak) { peak = pop; api.submit(peak); }
      hist.push(pop); if (hist.length > 520) hist.shift();
    }

    function toggleRun() { running = !running; btnRun.textContent = running ? 'Pause' : 'Play'; }

    function syncPills() {
      pGen.textContent = 'Gen ' + gen;
      pPop.textContent = 'Alive ' + pop;
      const d = pop / grid.length;
      pDens.textContent = 'Density ' + (d * 100).toFixed(1) + '%';
      pDens.className = 'pill ' + (Math.abs(d - EQ) < 0.008 && gen > 200 ? 'good' : '');
    }

    function draw() {
      const ON = 0xff8fe86f >>> 0, OFF = 0xff141019 >>> 0;   // ABGR
      for (let i = 0; i < grid.length; i++) buf[i] = grid[i] ? ON : OFF;
      octx.putImageData(img, 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, N, N, 0, 0, W, H);
      ctx.restore();
      drawPlot();
    }

    function drawPlot() {
      const w = plot.width, hh = plot.height, m = 30;
      pctx.fillStyle = '#0b0f16'; pctx.fillRect(0, 0, w, hh);
      let hi = grid.length * 0.06;
      for (const v of hist) if (v > hi) hi = v;
      const X = (i) => m + i / 520 * (w - m - 8);
      const Y = (v) => hh - 22 - clamp(v / hi, 0, 1) * (hh - 30);
      pctx.strokeStyle = '#3a4658'; pctx.lineWidth = 1;
      pctx.beginPath(); pctx.moveTo(m, Y(0)); pctx.lineTo(w - 8, Y(0)); pctx.moveTo(m, Y(0)); pctx.lineTo(m, Y(hi)); pctx.stroke();
      pctx.fillStyle = '#f2ede0'; pctx.font = '10px Verdana, sans-serif';
      pctx.fillText('alive', 2, 12); pctx.fillText('time', w - 30, hh - 6);
      /* equilibrium density line */
      const eq = grid.length * EQ;
      if (eq <= hi) {
        pctx.strokeStyle = 'rgba(232,64,42,.8)'; pctx.setLineDash([4, 3]);
        pctx.beginPath(); pctx.moveTo(m, Y(eq)); pctx.lineTo(w - 8, Y(eq)); pctx.stroke(); pctx.setLineDash([]);
        pctx.fillStyle = '#f2ede0'; pctx.fillText('~2.9% equilibrium', w - 118, Y(eq) - 4);
      }
      /* population curve */
      if (hist.length > 1) {
        pctx.strokeStyle = '#6fcf2f'; pctx.lineWidth = 1.5; pctx.beginPath();
        hist.forEach((v, i) => { const x = X(i), y = Y(v); i ? pctx.lineTo(x, y) : pctx.moveTo(x, y); });
        pctx.stroke();
      }
    }

    /* ---- drawing with the pointer ---- */
    let painting = false, paintVal = 1;
    function cellAt(e) {
      const p = cv.pos(e);
      const x = clamp(Math.floor(p.x / cell), 0, N - 1), y = clamp(Math.floor(p.y / cell), 0, N - 1);
      return y * N + x;
    }
    bagg.listen(cv.el, 'pointerdown', (e) => {
      const i = cellAt(e); paintVal = grid[i] ? 0 : 1; grid[i] = paintVal; painting = true;
      api.sfx.click();
      countPop(); syncPills(); draw();
      try { if (cv.el.setPointerCapture) cv.el.setPointerCapture(e.pointerId); } catch (err) { /* no active pointer; harmless */ }
    });
    bagg.listen(cv.el, 'pointermove', (e) => {
      if (!painting) return;
      grid[cellAt(e)] = paintVal; countPop(); draw();
    });
    bagg.listen(cv.el, 'pointerup', () => { painting = false; syncPills(); });

    /* ---- test seam ---- */
    window.__life = {
      reset() { clearGrid(); },
      randomize(p) { randomize(p == null ? 0.5 : p); },
      step(n) { for (let k = 0; k < (n || 1); k++) stepOnce(); },
      setCell(x, y, v) { grid[((y % N) + N) % N * N + (((x % N) + N) % N)] = v ? 1 : 0; countPop(); },
      stamp(name) { stamp(name); },
      stats() { return { pop: pop, gen: gen, density: pop / grid.length }; },
      setRunning(v) { running = !!v; }
    };
    bagg.add(() => { if (window.__life) delete window.__life; });

    clearGrid();
    running = false; btnRun.textContent = 'Play';
    bagg.add(Engine.loop(() => {
      if (running) for (let s = 0; s < speed; s++) stepOnce();
      syncPills(); draw();
    }));

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'life',
    title: 'Game of Life',
    emoji: 'life',
    cat: 'sim',
    order: 12,
    blurb: 'Conway\'s cellular automaton on a 150-cell torus. Each step, cells live or die by one rule about their neighbours, and gliders, oscillators, and glider guns emerge. Draw a colony, drop a preset, or scatter noise and watch it settle.',
    scoreLabel: 'Peak population',
    tags: ['conway', 'cellular-automaton', 'emergence', 'gliders'],
    how: [
      'Each step, every cell updates at once: a live cell stays alive with two or three live neighbours, and a dead cell comes alive with exactly three.',
      'Click and drag on the grid to draw cells. Click a live cell to erase it, then press play.',
      'Drop a preset from the menu. A glider crawls diagonally, a pulsar beats every three steps, an R-pentomino churns for over a thousand steps, and a glider gun makes gliders without end.',
      'Hit Random to fill the grid with noise. The population crashes and settles near a few percent, plotted against the marked 0.0287 equilibrium (this finite grid settles a little above it).',
      'Your score is the highest population reached. A running glider gun keeps adding cells, so it has no ceiling.'
    ],
    mount
  });
})();
