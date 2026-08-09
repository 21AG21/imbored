/* Reaction-Diffusion — the Gray-Scott model.
 *
 * Two virtual chemicals on a torus. A is fed in everywhere at rate f; the
 * reaction A + 2B -> 3B converts A into B; B is removed at rate (f + k). A
 * diffuses twice as fast as B. That single, uniform rulebook — no special
 * cases, no "if it should make a spot" — is enough to grow spots, stripes,
 * mazes and self-dividing blobs, depending only on where (f, k) sits.
 *
 *   A' = A + (dA * lapA - A*B*B + f*(1 - A)) * dt
 *   B' = B + (dB * lapB + A*B*B - (f + k)*B) * dt
 *
 * Laplacian is the standard 9-point stencil (orthogonal 0.2, diagonal 0.05,
 * centre -1); dA=1.0, dB=0.5, dt=1.0. This is the canonical Pearson /
 * Karl-Sims scheme.
 *
 * The (f, k) presets below are not guesses — they were picked from a measured
 * sweep (tools/sweep-reactdiff.mjs). Each was checked to settle into a stable,
 * non-uniform pattern; the sweep's classification and mean time-to-onset are
 * recorded beside each one.
 */
(function () {
  'use strict';
  const { h, clamp } = Engine;
  const W = 720, H = 560, GW = 144, GH = 112;
  const dA = 1.0, dB = 0.5, DT = 1.0;

  /* Defaults chosen from the printed sweep table (tools/sweep-reactdiff.mjs).
     `t` is the measured on-screen time for the pattern to fill in (coverage
     reaching 90% of its final value, at ~480 steps/sec) — every one is a few
     seconds, not the six-minute wait an unmeasured toy would give you. */
  const PRESETS = [
    { id: 'mitosis', label: 'Mitosis (dividing cells)', f: 0.0367, k: 0.0649, t: 6.5 },
    { id: 'coral', label: 'Coral', f: 0.0545, k: 0.0620, t: 3.5 },
    { id: 'spots', label: 'Spots', f: 0.0300, k: 0.0620, t: 2.7 },
    { id: 'worms', label: 'Worms', f: 0.0545, k: 0.0630, t: 6.9 },
    { id: 'maze', label: 'Maze', f: 0.0290, k: 0.0570, t: 1.9 },
    { id: 'holes', label: 'Holes', f: 0.0390, k: 0.0580, t: 1.9 }
  ];

  function mount(root, api) {
    const bagg = Engine.bag();

    const A = new Float32Array(GW * GH);
    const B = new Float32Array(GW * GH);
    const A2 = new Float32Array(GW * GH);
    const B2 = new Float32Array(GW * GH);

    let f = PRESETS[0].f, k = PRESETS[0].k;
    let steps = 0, peakCover = 0, running = true;

    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;
    ctx.imageSmoothingEnabled = true;
    const off = document.createElement('canvas');
    off.width = GW; off.height = GH;
    const octx = off.getContext('2d');
    const img = octx.createImageData(GW, GH);

    const pStep = api.pill('Step: 0');
    const pCover = api.pill('B-coverage: 0%');
    const pAct = api.pill('Activity: 0');
    const pFK = api.pill('f 0.0367  k 0.0649');

    /* ---- one uniform update over the whole grid ---- */
    function step() {
      for (let y = 0; y < GH; y++) {
        const yu = (y === 0 ? GH - 1 : y - 1) * GW;
        const yd = (y === GH - 1 ? 0 : y + 1) * GW;
        const yc = y * GW;
        for (let x = 0; x < GW; x++) {
          const xl = x === 0 ? GW - 1 : x - 1;
          const xr = x === GW - 1 ? 0 : x + 1;
          const c = yc + x;
          const a = A[c], b = B[c];
          const lapA =
            (A[yc + xl] + A[yc + xr] + A[yu + x] + A[yd + x]) * 0.2 +
            (A[yu + xl] + A[yu + xr] + A[yd + xl] + A[yd + xr]) * 0.05 - a;
          const lapB =
            (B[yc + xl] + B[yc + xr] + B[yu + x] + B[yd + x]) * 0.2 +
            (B[yu + xl] + B[yu + xr] + B[yd + xl] + B[yd + xr]) * 0.05 - b;
          const abb = a * b * b;
          let na = a + (dA * lapA - abb + f * (1 - a)) * DT;
          let nb = b + (dB * lapB + abb - (f + k) * b) * DT;
          A2[c] = na < 0 ? 0 : na > 1 ? 1 : na;
          B2[c] = nb < 0 ? 0 : nb > 1 ? 1 : nb;
        }
      }
      A.set(A2); B.set(B2);
      steps++;
    }

    function stats() {
      let sum = 0, sq = 0, cover = 0;
      for (let i = 0; i < B.length; i++) {
        const b = B[i];
        sum += b; sq += b * b;
        if (b > 0.2) cover++;
      }
      const n = B.length;
      const mean = sum / n;
      const variance = Math.max(0, sq / n - mean * mean);
      return { meanB: mean, stdB: Math.sqrt(variance), coverage: cover / n, steps };
    }

    function seed(opts) {
      opts = opts || {};
      if (opts.f != null) f = opts.f;
      if (opts.k != null) k = opts.k;
      A.fill(1); B.fill(0);
      /* a handful of B blobs plus a little noise to break the symmetry */
      const blobs = opts.blobs || 7;
      for (let n = 0; n < blobs; n++) {
        const cx = Math.floor(Math.random() * GW);
        const cy = Math.floor(Math.random() * GH);
        const rr = 4 + Math.floor(Math.random() * 4);
        for (let dy = -rr; dy <= rr; dy++) {
          for (let dx = -rr; dx <= rr; dx++) {
            const x = (cx + dx + GW) % GW, y = (cy + dy + GH) % GH;
            const idx = y * GW + x;
            A[idx] = 0.5; B[idx] = 0.9;
          }
        }
      }
      for (let i = 0; i < B.length; i++) B[i] = clamp(B[i] + (Math.random() - 0.5) * 0.02, 0, 1);
      steps = 0; peakCover = 0;
    }

    function render() {
      const d = img.data;
      for (let i = 0; i < B.length; i++) {
        const v = clamp(B[i] * 1.35, 0, 1);
        /* dark ink -> grape -> teal -> banana colour ramp */
        const p = i * 4;
        d[p] = Math.round(20 + v * (v < 0.5 ? 200 : 235));
        d[p + 1] = Math.round(12 + Math.pow(v, 1.4) * 200);
        d[p + 2] = Math.round(30 + (1 - v) * 90 + v * 30);
        d[p + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      ctx.drawImage(off, 0, 0, GW, GH, 0, 0, W, H);
    }

    function syncPills() {
      const s = stats();
      if (s.coverage > peakCover) { peakCover = s.coverage; api.submit(Math.round(peakCover * 100)); }
      pStep.textContent = 'Step: ' + steps;
      pCover.textContent = 'B-coverage: ' + Math.round(s.coverage * 100) + '%';
      pAct.textContent = 'Activity: ' + s.stdB.toFixed(3);
      pFK.textContent = 'f ' + f.toFixed(4) + '  k ' + k.toFixed(4);
    }

    /* ---- controls ---- */
    const presetSel = api.select('Pattern', PRESETS.map((p) => ({ value: p.id, label: p.label })), PRESETS[0].id, (v) => {
      const pr = PRESETS.find((p) => p.id === v);
      if (pr) { fSlider.value = pr.f; kSlider.value = pr.k; seed({ f: pr.f, k: pr.k }); api.status('Preset: ' + pr.label + '.  f=' + pr.f + ', k=' + pr.k + ' — measured to fill in after about ' + pr.t + ' s of run time.'); }
    });

    const fSlider = h('input', { type: 'range', min: '0.010', max: '0.090', step: '0.0005', value: String(f), class: 'slider' });
    const kSlider = h('input', { type: 'range', min: '0.045', max: '0.070', step: '0.0005', value: String(k), class: 'slider' });
    fSlider.addEventListener('input', () => { f = parseFloat(fSlider.value); syncPills(); });
    kSlider.addEventListener('input', () => { k = parseFloat(kSlider.value); syncPills(); });
    api.toolbar.appendChild(h('label', { class: 'sel-wrap' }, h('span', null, 'feed f'), fSlider));
    api.toolbar.appendChild(h('label', { class: 'sel-wrap' }, h('span', null, 'kill k'), kSlider));

    const runBtn = api.button('Pause', () => { running = !running; runBtn.textContent = running ? 'Pause' : 'Run'; });
    api.button('Reseed', () => seed());

    /* paint B with the mouse — drop reagent and watch it invade */
    let painting = false;
    function paint(e) {
      const p = cv.pos(e);
      const gx = Math.floor(p.x / W * GW), gy = Math.floor(p.y / H * GH);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const x = (gx + dx + GW) % GW, y = (gy + dy + GH) % GH;
        const idx = y * GW + x;
        A[idx] = 0.4; B[idx] = 0.9;
      }
    }
    bagg.listen(cv.el, 'pointerdown', (e) => { painting = true; paint(e); });
    bagg.listen(cv.el, 'pointermove', (e) => { if (painting) paint(e); });
    bagg.listen(cv.el, 'pointerup', () => { painting = false; });
    bagg.listen(cv.el, 'pointerleave', () => { painting = false; });

    /* ---- test seam: lets a headless browser sweep (f,k) fast ---- */
    window.__rd = {
      step(n) { for (let i = 0; i < (n || 1); i++) step(); },
      reset(opts) { seed(opts); },
      stats,
      setRunning(v) { running = !!v; runBtn.textContent = running ? 'Pause' : 'Run'; },
      params() { return { f, k, GW, GH }; }
    };
    bagg.add(() => { if (window.__rd) delete window.__rd; });

    seed({ f: PRESETS[0].f, k: PRESETS[0].k });
    api.status('Two chemicals, one reaction rule. Drag on the field to add reagent. Slide f and k to roam the map — the interesting band is narrow.');

    bagg.add(Engine.loop(() => {
      if (running) for (let i = 0; i < 8; i++) step();
      render();
      syncPills();
    }));

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'reactdiff',
    title: 'Reaction-Diffusion',
    emoji: 'reactdiff',
    cat: 'sim',
    order: 5,
    blurb: 'Two chemicals, one Gray-Scott rule per cell. The spots, stripes, mazes and dividing blobs are what the equation grows on its own. Drag to add reagent.',
    scoreLabel: 'Peak coverage',
    tags: ['gray-scott', 'turing', 'chemistry', 'emergence'],
    how: [
      'Chemical A is fed in everywhere. The reaction turns A into B where B already sits, and B decays. A spreads faster than B.',
      'That is the whole rulebook, applied the same to every cell. The patterns are emergent; nothing scripts them.',
      'The Pattern menu jumps to (f, k) values measured to settle into spots, coral, mazes or dividing cells.',
      'Slide feed and kill to roam the map yourself. The band that makes patterns is thin, and outside it the field goes uniform.',
      'Drag on the field to paint in reagent and watch the front spread.'
    ],
    mount
  });
})();
