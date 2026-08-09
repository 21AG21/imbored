/* Turf War — spatial rock-paper-scissors (cyclic dominance).
 *
 * Three species tile a grid: red beats green, green beats blue, blue beats red,
 * round and round with no overall winner. Neighbours interact by three moves —
 * eat your prey (it dies, leaving a gap), breed into a neighbouring gap, or
 * shuffle places with a neighbour. Left to it, the grid does something lovely on
 * its own: it stops being noise and organises into rotating spiral waves, and
 * all three species survive forever. That is the real point — the exact same
 * three rules with no space (a well-mixed beaker) collapse to a single winner,
 * but spatial structure keeps all three alive. The mixing slider changes how
 * coarse the pattern is; the panel tracks the three populations chasing each
 * other round the cycle. (This is emergent pattern formation, not a tuned
 * threshold — see Kerr et al. 2002 and Reichenbach et al. 2007.)
 */
(function () {
  'use strict';
  const { h, clamp } = Engine;
  const N = 150, W = 560, H = 560;

  function mount(root, api) {
    const bagg = Engine.bag();
    let grid = new Uint8Array(N * N);
    let mix = 1.2, running = true, speed = 1, gen = 0;
    let coStreak = 0, coPeak = 0;
    const hist = [];                      // {a,b,c} fractions over time

    const cv = Engine.canvas(root, W, H, { maxHeight: '58vh' });
    const ctx = cv.ctx;
    const off = document.createElement('canvas'); off.width = N; off.height = N;
    const octx = off.getContext('2d');
    const img = octx.createImageData(N, N);
    const buf = new Uint32Array(img.data.buffer);
    const COL = [0xff140f19 >>> 0, 0xff2a40e8 >>> 0, 0xff2fcf6f >>> 0, 0xffd67f2a >>> 0]; // empty, red, green, blue (ABGR)

    const plot = h('canvas', { class: 'fire-plot', width: 520, height: 200 });
    root.appendChild(h('div', { class: 'fire-panel' }, plot));
    const pctx = plot.getContext('2d');

    const pGen = api.pill('Gen 0');
    const pSpecies = api.pill('3 alive');
    const pCoexist = api.pill('Coexisting 0');

    const slider = h('input', { type: 'range', min: '0', max: '8', step: '0.1', value: '1.2', class: 'slider' });
    slider.addEventListener('input', () => { mix = parseFloat(slider.value); });
    api.toolbar.appendChild(h('label', { class: 'sel-wrap' }, h('span', null, 'mixing'), slider));
    const btnRun = api.button('Pause', () => { running = !running; btnRun.textContent = running ? 'Pause' : 'Play'; });
    const btnSpeed = api.button('Speed 1×', () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; btnSpeed.textContent = 'Speed ' + speed + '×'; });
    api.button('Reseed', reset);

    function reset() {
      for (let i = 0; i < grid.length; i++) grid[i] = 1 + ((Math.random() * 3) | 0);
      gen = 0; coStreak = 0; hist.length = 0;
      api.status('Random noise, three species. Press play and watch it curdle into rotating spirals — and notice all three hang on. Slide mixing up to smear the pattern coarser.');
    }

    const idx = (x, y) => ((y + N) % N) * N + ((x + N) % N);
    const beats = (a, b) => b === (a % 3) + 1;   // 1>2>3>1

    function step() {
      const inter = grid.length;
      for (let k = 0; k < inter; k++) {
        const x = (Math.random() * N) | 0, y = (Math.random() * N) | 0, i = y * N + x;
        const d = (Math.random() * 4) | 0;
        const j = d === 0 ? idx(x + 1, y) : d === 1 ? idx(x - 1, y) : d === 2 ? idx(x, y + 1) : idx(x, y - 1);
        const a = grid[i], b = grid[j], r = Math.random() * (2 + mix);
        if (r < 1) { if (a && b && a !== b) { if (beats(a, b)) grid[j] = 0; else if (beats(b, a)) grid[i] = 0; } }
        else if (r < 2) { if (a && !b) grid[j] = a; else if (!a && b) grid[i] = b; }
        else { grid[i] = b; grid[j] = a; }
      }
      gen++;
      const c = [0, 0, 0, 0];
      for (let i = 0; i < grid.length; i++) c[grid[i]]++;
      const T = grid.length;
      hist.push({ a: c[1] / T, b: c[2] / T, c: c[3] / T });
      if (hist.length > 520) hist.shift();
      const alive = (c[1] > 0) + (c[2] > 0) + (c[3] > 0);
      if (alive === 3) { coStreak++; if (coStreak > coPeak) { coPeak = coStreak; api.submit(coPeak); } } else coStreak = 0;
      pGen.textContent = 'Gen ' + gen;
      pSpecies.textContent = alive + ' alive';
      pSpecies.className = 'pill ' + (alive === 3 ? 'good' : 'warn');
      pCoexist.textContent = 'Coexisting ' + coStreak;
    }

    function draw() {
      for (let i = 0; i < grid.length; i++) buf[i] = COL[grid[i]];
      octx.putImageData(img, 0, 0);
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, N, N, 0, 0, W, H);
      ctx.restore();
      drawPlot();
    }

    function drawPlot() {
      const w = plot.width, hh = plot.height, m = 26;
      pctx.fillStyle = '#0b0f16'; pctx.fillRect(0, 0, w, hh);
      const X = (i) => m + i / 520 * (w - m - 8), Y = (v) => hh - 20 - clamp(v, 0, 0.6) / 0.6 * (hh - 30);
      pctx.strokeStyle = '#3a4658'; pctx.lineWidth = 1;
      pctx.beginPath(); pctx.moveTo(m, Y(0)); pctx.lineTo(w - 8, Y(0)); pctx.stroke();
      pctx.fillStyle = '#6c7a90'; pctx.font = '10px Verdana, sans-serif';
      pctx.fillText('population', 2, 12); pctx.fillText('time', w - 30, hh - 6);
      const cols = ['#e8402a', '#6fcf2f', '#2a7fd6'], keys = ['a', 'b', 'c'];
      for (let s = 0; s < 3; s++) {
        pctx.strokeStyle = cols[s]; pctx.lineWidth = 1.5; pctx.beginPath();
        hist.forEach((p, i) => { const x = X(i), y = Y(p[keys[s]]); i ? pctx.lineTo(x, y) : pctx.moveTo(x, y); });
        pctx.stroke();
      }
    }

    /* ---- test seam ---- */
    window.__turf = {
      reset() { reset(); },
      step(n) { for (let k = 0; k < (n || 1); k++) step(); },
      setMix(v) { mix = v; slider.value = String(v); },
      stats() {
        const c = [0, 0, 0, 0]; for (let i = 0; i < grid.length; i++) c[grid[i]]++;
        const T = grid.length;
        return { gen, frac: [c[1] / T, c[2] / T, c[3] / T], alive: (c[1] > 0) + (c[2] > 0) + (c[3] > 0), coStreak, clustering: clustering() };
      },
      setRunning(v) { running = !!v; }
    };
    function clustering() { let same = 0, tot = 0; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const a = grid[y * N + x]; if (!a) continue; const b = grid[idx(x + 1, y)]; if (b) { tot++; if (a === b) same++; } } return tot ? same / tot : 0; }
    bagg.add(() => { if (window.__turf) delete window.__turf; });

    reset();
    bagg.add(Engine.loop(() => { if (running) for (let s = 0; s < speed; s++) step(); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'turf',
    title: 'Turf War',
    emoji: 'turf',
    cat: 'sim',
    order: 13,
    blurb: 'Rock-paper-scissors played across a whole grid, each colour eating the one it beats. Left running, the noise organises into rotating spiral waves where all three colours survive.',
    scoreLabel: 'Coexistence streak',
    tags: ['cyclic-dominance', 'spirals', 'emergence', 'ecology'],
    how: [
      'Every cell is red, green, blue, or empty. The colours run in a loop where red beats green, green beats blue, and blue beats red.',
      'Neighbouring cells interact one pair at a time. A predator clears its prey to an empty gap, a colour breeds into a touching gap, or two neighbours swap places.',
      'Start it running and the random speckle turns into slowly rotating spiral arms. That self-made structure is what keeps all three colours alive.',
      'Well-mixed with no grid, the same rules collapse to one survivor. Space is what saves the other two, a real result from bacterial ecology.',
      'The mixing slider smears the spirals into coarser blobs, and the panel plots the three populations chasing one another round the loop. Your score is the longest run with all three alive.'
    ],
    mount
  });
})();
