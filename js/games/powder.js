/* Powder — a falling-sand sandbox. Drop materials and let simple per-cell rules
 * do the rest: sand piles at its angle of repose, water finds its level, oil
 * floats on the water, fire eats paper and oil, and a splash of water puts it
 * out with a puff of smoke. No goal, no score to chase but the biggest mess —
 * just a toy that behaves. Every material follows one tiny local rule; the
 * pouring, flowing and burning are all emergent. */
(function () {
  'use strict';
  const { h, clamp, randInt } = Engine;
  const N = 160;                        // cells per side
  const W = 560, H = 560;
  const CELL = W / N;

  const EMPTY = 0, WALL = 1, SAND = 2, WATER = 3, OIL = 4, FIRE = 5, PAPER = 6, SMOKE = 7,
    STONE = 8, PLANT = 9, ACID = 10, LAVA = 11, ICE = 12;
  const MATS = [
    { id: SAND, label: 'Sand' }, { id: WATER, label: 'Water' }, { id: OIL, label: 'Oil' },
    { id: LAVA, label: 'Lava' }, { id: ACID, label: 'Acid' }, { id: FIRE, label: 'Fire' },
    { id: PLANT, label: 'Plant' }, { id: ICE, label: 'Ice' }, { id: PAPER, label: 'Paper' },
    { id: STONE, label: 'Stone' }, { id: WALL, label: 'Wall' }, { id: EMPTY, label: 'Eraser' }
  ];
  /* density decides who sinks through whom */
  const DEN = { [SAND]: 5, [LAVA]: 4, [WATER]: 3, [ACID]: 2.6, [OIL]: 1 };
  const isLiquid = (e) => e === WATER || e === OIL || e === ACID || e === LAVA;
  const den = (e) => DEN[e] || 0;
  const SOLID = new Set([WALL, PAPER, STONE, PLANT, ICE]);   /* placeable, overwrites, does not fall */

  function mount(root, api) {
    const bagg = Engine.bag();
    const grid = new Uint8Array(N * N);
    const life = new Uint8Array(N * N);   // countdown for fire/smoke
    const moved = new Uint8Array(N * N);
    const tint = new Uint8Array(N * N);   // static per-cell shade for texture
    for (let i = 0; i < tint.length; i++) tint[i] = randInt(0, 24);
    let mat = SAND, brush = 4, running = true, frame = 0;

    const cv = Engine.canvas(root, W, H, { maxHeight: '60vh' });
    const ctx = cv.ctx;
    const off = document.createElement('canvas');
    off.width = N; off.height = N;
    const octx = off.getContext('2d');
    const img = octx.createImageData(N, N);
    const buf = new Uint32Array(img.data.buffer);

    const pMat = api.pill('Sand');
    const pCount = api.pill('Filled: 0%');

    api.select('Material', MATS.map((m) => ({ value: String(m.id), label: m.label })), String(SAND), (v) => {
      mat = +v; pMat.textContent = MATS.find((m) => m.id === mat).label;
    });
    api.select('Brush', [{ value: '2', label: 'Fine' }, { value: '4', label: 'Medium' }, { value: '8', label: 'Fat' }], '4', (v) => { brush = +v; });
    const btnRun = api.button('Pause', () => { running = !running; btnRun.textContent = running ? 'Pause' : 'Play'; });
    api.button('Reset tray', () => setupWalls());
    api.button('Clear', () => { grid.fill(0); life.fill(0); });

    function setupWalls() {
      grid.fill(0); life.fill(0);
      for (let x = 0; x < N; x++) grid[(N - 1) * N + x] = WALL;         // floor
      for (let y = 0; y < N; y++) { grid[y * N] = WALL; grid[y * N + N - 1] = WALL; }  // sides
      api.status('Bordered tray ready. Pick a material and paint in the box; try oil on water, then set it on fire.');
    }

    const idx = (x, y) => y * N + x;
    function swap(i, j) { const g = grid[i]; grid[i] = grid[j]; grid[j] = g; const l = life[i]; life[i] = life[j]; life[j] = l; moved[i] = moved[j] = 1; }
    function set(i, e, lf) { grid[i] = e; life[i] = lf || 0; }

    /* a falling grain/liquid: straight down, then diagonals; liquids also creep sideways */
    function fall(i, x, y, spread) {
      const self = grid[i];
      const dl = idx(x, y + 1);
      if (y + 1 < N && sink(dl, self)) { swap(i, dl); return true; }
      const dirs = Math.random() < 0.5 ? [-1, 1] : [1, -1];
      for (const dx of dirs) {
        if (x + dx < 0 || x + dx >= N || y + 1 >= N) continue;
        const d = idx(x + dx, y + 1);
        if (sink(d, self)) { swap(i, d); return true; }
      }
      if (spread) for (const dx of dirs) {
        if (x + dx < 0 || x + dx >= N) continue;
        const s = idx(x + dx, y);
        if (grid[s] === EMPTY) { swap(i, s); return true; }
      }
      return false;
    }
    function sink(dest, self) { const d = grid[dest]; return d === EMPTY || (isLiquid(d) && den(d) < den(self)) || (self === SAND && isLiquid(d)); }

    function neigh4(x, y) { return [x > 0 ? idx(x - 1, y) : -1, x < N - 1 ? idx(x + 1, y) : -1, y > 0 ? idx(x, y - 1) : -1, y < N - 1 ? idx(x, y + 1) : -1]; }

    function stepFire(i, x, y) {
      const nb = neigh4(x, y);
      for (const j of nb) { if (j >= 0 && grid[j] === WATER) { set(i, EMPTY, 0); return; } }  // doused
      for (const j of nb) {
        if (j < 0) continue;
        if (grid[j] === PAPER && Math.random() < 0.28) set(j, FIRE, randInt(26, 50));
        else if (grid[j] === PLANT && Math.random() < 0.32) set(j, FIRE, randInt(22, 44));
        else if (grid[j] === OIL && Math.random() < 0.16) set(j, FIRE, randInt(30, 60));
        else if (grid[j] === ICE && Math.random() < 0.25) set(j, WATER, 0);
      }
      if (life[i] <= 1) { set(i, Math.random() < 0.5 ? SMOKE : EMPTY, 22); return; }
      life[i]--;
      /* flames lick upward */
      if (y > 0 && grid[idx(x, y - 1)] === EMPTY && Math.random() < 0.25) swap(i, idx(x, y - 1));
    }

    function stepSmoke(i, x, y) {
      if (life[i] <= 1) { set(i, EMPTY, 0); return; }
      life[i]--;
      const up = y > 0 ? idx(x, y - 1) : -1;
      if (up >= 0 && grid[up] === EMPTY) { swap(i, up); return; }
      const dx = Math.random() < 0.5 ? -1 : 1;
      if (x + dx >= 0 && x + dx < N && y > 0 && grid[idx(x + dx, y - 1)] === EMPTY) swap(i, idx(x + dx, y - 1));
    }

    /* four-neighbour helper */
    function nb4(x, y) { return [x > 0 ? idx(x - 1, y) : -1, x < N - 1 ? idx(x + 1, y) : -1, y > 0 ? idx(x, y - 1) : -1, y < N - 1 ? idx(x, y + 1) : -1]; }

    function reactLava(i, x, y) {
      for (const j of nb4(x, y)) {
        if (j < 0) continue;
        const g = grid[j];
        if (g === WATER) { set(i, STONE, 0); set(j, SMOKE, 20); return; }   // quenched into stone + steam
        if ((g === PAPER || g === OIL || g === PLANT) && Math.random() < 0.5) set(j, FIRE, randInt(30, 60));
        if (g === ICE) set(j, WATER, 0);
      }
      if (Math.random() < 0.12 && y > 0 && grid[idx(x, y - 1)] === EMPTY) set(idx(x, y - 1), SMOKE, 14);  // heat shimmer
    }
    function reactAcid(i, x, y) {
      for (const j of nb4(x, y)) {
        if (j < 0) continue;
        const g = grid[j];
        if (g === WATER && Math.random() < 0.2) { set(i, WATER, 0); return; }   // diluted
        if ((g === SAND || g === PLANT || g === PAPER || g === STONE || g === ICE) && Math.random() < 0.3) {
          set(j, EMPTY, 0);
          if (Math.random() < 0.5) { set(i, EMPTY, 0); return; }   // acid used up
        }
      }
    }
    function reactPlant(i, x, y) {
      let water = false;
      for (const j of nb4(x, y)) if (j >= 0 && grid[j] === WATER) water = true;
      if (water && Math.random() < 0.06) {
        const empties = nb4(x, y).filter((j) => j >= 0 && grid[j] === EMPTY);
        if (empties.length) set(empties[(Math.random() * empties.length) | 0], PLANT, 0);
      }
    }
    function reactIce(i, x, y) {
      for (const j of nb4(x, y)) if (j >= 0 && (grid[j] === FIRE || grid[j] === LAVA)) { set(i, WATER, 0); return; }
    }

    function step() {
      moved.fill(0);
      /* falling materials: bottom-up so a grain settles in one pass */
      for (let y = N - 1; y >= 0; y--) {
        const ltr = (frame + y) & 1;
        for (let k = 0; k < N; k++) {
          const x = ltr ? k : N - 1 - k;
          const i = idx(x, y);
          if (moved[i]) continue;
          const e = grid[i];
          if (e === SAND) fall(i, x, y, false);
          else if (isLiquid(e)) fall(i, x, y, true);
        }
      }
      /* chemistry pass — runs before fire moves so heat-driven reactions
       * (ice melting, lava quenching) see the flame that's next to them */
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = idx(x, y), e = grid[i];
        if (e === LAVA) reactLava(i, x, y);
        else if (e === ACID) reactAcid(i, x, y);
        else if (e === PLANT) reactPlant(i, x, y);
        else if (e === ICE) reactIce(i, x, y);
      }
      /* fire + smoke: top-down so a rising cell isn't stepped twice */
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = idx(x, y);
        if (moved[i]) continue;
        if (grid[i] === FIRE) stepFire(i, x, y);
        else if (grid[i] === SMOKE) stepSmoke(i, x, y);
      }
      frame++;
    }

    function color(e, i) {
      const t = tint[i];
      switch (e) {
        case WALL: return 0xff5b5650 >>> 0;
        case SAND: return (0xff3aa6d9 + t) >>> 0;                       // warm sand (ABGR)
        case WATER: return (0xffd08a3a - (t << 16)) >>> 0;              // blue
        case OIL: return (0xff2a3a4a + t) >>> 0;                        // dark brown
        case PAPER: return 0xffd0e2e8 >>> 0;
        case FIRE: { const f = (frame + i) & 3; return f === 0 ? 0xff2a8fff >>> 0 : f === 1 ? 0xff3affff >>> 0 : 0xff2a4aff >>> 0; }
        case SMOKE: return (0xff4a4a4a + (t << 16)) >>> 0;
        case STONE: return (0xff6e7478 + t) >>> 0;                       // grey
        case PLANT: return (0xff2aa03a - (t << 8)) >>> 0;                // green
        case ACID: return (0xff3cf096 - (t << 8)) >>> 0;                 // acid green
        case LAVA: { const f = (frame * 3 + i) & 7; return f < 3 ? 0xff1e5aff >>> 0 : f < 6 ? 0xff2a7aff >>> 0 : 0xff3a9aff >>> 0; }  // glowing orange
        case ICE: return (0xfff0dcb4 - t) >>> 0;                         // pale blue
        default: return 0xff14100a >>> 0;
      }
    }

    function draw() {
      for (let i = 0; i < grid.length; i++) buf[i] = color(grid[i], i);
      octx.putImageData(img, 0, 0);
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, N, N, 0, 0, W, H);
      ctx.restore();
      let filled = 0; for (let i = 0; i < grid.length; i++) if (grid[i] !== EMPTY && grid[i] !== SMOKE) filled++;
      pCount.textContent = 'Filled: ' + Math.round(filled / grid.length * 100) + '%';
    }

    /* paint the selected material in a disk under the pointer */
    let painting = false;
    function paintAt(e) {
      const p = cv.pos(e);
      const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
      for (let dy = -brush; dy <= brush; dy++) for (let dx = -brush; dx <= brush; dx++) {
        if (dx * dx + dy * dy > brush * brush) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= N || y >= N) continue;
        const i = idx(x, y);
        if (mat === EMPTY) { set(i, EMPTY, 0); continue; }
        /* liquids/gas/fire paint sparsely so you pour rather than dump a block */
        if ((isLiquid(mat) || mat === FIRE) && Math.random() < 0.4) continue;
        const lf = mat === FIRE ? randInt(26, 50) : mat === LAVA ? randInt(60, 120) : 0;
        if (grid[i] === EMPTY || SOLID.has(mat)) set(i, mat, lf);
        else if (isLiquid(mat) || mat === FIRE || mat === SAND) set(i, mat, lf);
      }
    }
    bagg.listen(cv.el, 'pointerdown', (e) => { painting = true; paintAt(e); try { if (cv.el.setPointerCapture) cv.el.setPointerCapture(e.pointerId); } catch (err) { /* */ } });
    bagg.listen(cv.el, 'pointermove', (e) => { if (painting) paintAt(e); });
    bagg.listen(cv.el, 'pointerup', () => { painting = false; });

    /* ---- test seam ---- */
    window.__powder = {
      clear() { grid.fill(0); life.fill(0); },
      set(x, y, e, lf) { if (x >= 0 && y >= 0 && x < N && y < N) set(idx(x, y), e, lf || 0); },
      get(x, y) { return grid[idx(x, y)]; },
      step(n) { for (let k = 0; k < (n || 1); k++) step(); },
      count(e) { let c = 0; for (let i = 0; i < grid.length; i++) if (grid[i] === e) c++; return c; },
      consts() { return { EMPTY, WALL, SAND, WATER, OIL, FIRE, PAPER, SMOKE, STONE, PLANT, ACID, LAVA, ICE, N }; },
      setRunning(v) { running = !!v; }
    };
    bagg.add(() => { if (window.__powder) delete window.__powder; });

    setupWalls();
    api.status('A sandbox with rules: sand piles, water levels off, oil floats, fire spreads through paper and oil, water snuffs it. Pick a material and draw.');
    bagg.add(Engine.loop(() => {
      if (running) { step(); step(); }
      draw();
    }));

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'powder',
    title: 'Powder',
    emoji: 'powder',
    cat: 'goofy',
    order: 40,
    blurb: 'A falling-sand toy with a dozen materials and no point except the mess. Sand piles, water levels off, oil floats, lava sets fire to everything and hardens to stone when it hits water, acid eats through solids, plants creep along water, and ice melts by the flames. Draw and watch the rules collide.',
    scoreLabel: 'Messes made',
    tags: ['falling-sand', 'sandbox', 'toy', 'physics'],
    how: [
      'Pick a material and paint it into the tray by clicking and dragging. Bigger brushes pour faster; the Eraser clears cells.',
      'The classics: sand tumbles and piles, water spreads and settles flat, oil floats on top of water, and fire chews through paper (and plants and oil) then fades to smoke. Water snuffs fire on contact.',
      'Lava flows, sets fire to anything flammable, melts ice, and — the good bit — freezes into solid stone the instant it touches water, hissing off a puff of steam.',
      'Acid eats through sand, stone, paper, plants and ice, using itself up as it goes, and water dilutes it back to plain water.',
      'Plants creep into empty space wherever they touch water, so a seed by a puddle slowly overgrows — until a stray spark takes the whole vine. Ice melts to water near any heat.',
      'No score, no winning — it is a toy. Try lava pouring onto a lake, an acid drip through a stone wall, or a garden you then set alight. Clear starts fresh; Pause freezes the frame.'
    ],
    mount
  });
})();
