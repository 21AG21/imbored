/* Curie Point — the 2D Ising model of a ferromagnet.
 *
 * A square lattice of spins, each +1 or -1, on a torus (periodic edges). The
 * energy is E = -J Σ s_i s_j over nearest-neighbour pairs (J = 1, no external
 * field). We evolve it with the Metropolis rule: pick a spin, flip it if that
 * lowers the energy, otherwise flip it with probability exp(-ΔE / T). One rule,
 * everywhere. Below a critical temperature the lattice locks into one giant
 * magnetised domain; above it, thermal noise wins and the net magnetisation
 * collapses to zero. The thermodynamic-limit knife-edge is Onsager's exact
 * result for the square lattice, T_c = 2 / ln(1 + √2) ≈ 2.2692 (Onsager 1944);
 * on a finite lattice evolved by single-spin Metropolis the measured collapse
 * rounds off and sits a touch above it (critical slowing-down keeps the ordered
 * state sticky just past T_c), converging down toward the exact value with more
 * sweeps and more spins. The panel measures the magnetisation curve live from
 * the model, and the window.__ising seam lets a headless sweep locate the
 * transition (tools/sweep-ising.mjs).
 */
(function () {
  'use strict';
  const { h, clamp } = Engine;
  const N = 100;                       // 100x100 spins
  const W = 560, H = 560;
  const CELL = W / N;
  const TC = 2.2691853;                // exact Onsager critical temperature (J = k_B = 1)
  const TMIN = 1.0, TMAX = 3.6;

  function mount(root, api) {
    const bagg = Engine.bag();
    const spin = new Int8Array(N * N);
    let T = 2.27, running = true;
    let exp4 = 0, exp8 = 0;            // precomputed Metropolis acceptances for ΔE = 4, 8
    let magSum = 0;                     // running Σ spin, kept incrementally
    const win = [];                     // recent |m| samples at the current T (for susceptibility)
    let chi = 0, peakChi = 0;
    let ref = [];                       // measured magnetisation reference curve

    const cv = Engine.canvas(root, W, H, { maxHeight: '62vh' });
    const ctx = cv.ctx;
    const off = document.createElement('canvas');
    off.width = N; off.height = N;
    const octx = off.getContext('2d');
    const img = octx.createImageData(N, N);
    const buf = new Uint32Array(img.data.buffer);
    const UP = 0xff2a3ef4 >>> 0;        // ABGR little-endian: warm (up)
    const DN = 0xff40241a >>> 0;        // cool/dark (down)

    const plot = h('canvas', { class: 'fire-plot', width: 520, height: 200 });
    root.appendChild(h('div', { class: 'fire-panel' }, plot));
    const pctx = plot.getContext('2d');

    const pTemp = api.pill('T: 2.27');
    const pMag = api.pill('|M|: 0.00');
    const pChi = api.pill('χ: 0');
    const pPhase = api.pill('phase: —');

    const slider = h('input', { type: 'range', min: String(TMIN), max: String(TMAX), step: '0.01', value: '2.27', class: 'slider' });
    slider.addEventListener('input', () => { setTemp(parseFloat(slider.value)); });
    api.toolbar.appendChild(h('label', { class: 'sel-wrap' }, h('span', null, 'temperature'), slider));
    api.button('Randomize (hot)', () => init(false));
    api.button('Align (cold)', () => init(true));

    function setTemp(t) {
      T = t;
      exp4 = Math.exp(-4 / T);
      exp8 = Math.exp(-8 / T);
      win.length = 0; chi = 0;          // fluctuations must be re-measured after a change
      slider.value = String(t);
      syncPills();
    }

    function init(aligned) {
      magSum = 0;
      for (let i = 0; i < spin.length; i++) {
        const s = aligned ? 1 : (Math.random() < 0.5 ? 1 : -1);
        spin[i] = s; magSum += s;
      }
      win.length = 0; chi = 0; peakChi = 0;
      syncPills();
      api.status('Drag the temperature: cool it and the pixels snap into big matching patches, heat it and they boil. Find the flip point.');
    }

    /* one Metropolis sweep = N*N attempted flips, periodic boundaries */
    function sweep() {
      for (let k = 0; k < spin.length; k++) {
        const i = (Math.random() * spin.length) | 0;
        const x = i % N, y = (i / N) | 0;
        const l = x === 0 ? i + N - 1 : i - 1;
        const r = x === N - 1 ? i - N + 1 : i + 1;
        const u = y === 0 ? i + (N - 1) * N : i - N;
        const d = y === N - 1 ? i - (N - 1) * N : i + N;
        const s = spin[i];
        const nsum = spin[l] + spin[r] + spin[u] + spin[d];
        const dE = 2 * s * nsum;        // ΔE in {-8,-4,0,4,8}
        if (dE <= 0 || (dE === 4 ? Math.random() < exp4 : Math.random() < exp8)) {
          spin[i] = -s;
          magSum -= 2 * s;
        }
      }
    }

    function syncPills() {
      const m = magSum / spin.length;
      const am = Math.abs(m);
      pTemp.textContent = 'T: ' + T.toFixed(2);
      pMag.textContent = '|M|: ' + am.toFixed(2);
      pChi.textContent = 'χ: ' + Math.round(chi);
      const ordered = am > 0.5;
      pPhase.textContent = 'phase: ' + (ordered ? 'magnetised' : am > 0.2 ? 'critical' : 'disordered');
      pPhase.className = 'pill ' + (ordered ? 'warn' : '');
      pMag.className = 'pill ' + (ordered ? 'good' : '');
    }

    /* susceptibility χ = N² (⟨m²⟩ − ⟨|m|⟩²) / T, from a rolling window at fixed T */
    function measureChi() {
      const am = Math.abs(magSum / spin.length);
      win.push(am);
      if (win.length > 220) win.shift();
      if (win.length < 40) return;
      let s1 = 0, s2 = 0;
      for (const v of win) { s1 += v; s2 += v * v; }
      const mean = s1 / win.length, varr = Math.max(0, s2 / win.length - mean * mean);
      chi = spin.length * varr / T;
      if (win.length >= 120 && chi > peakChi) {
        peakChi = chi;
        api.submit(Math.round(peakChi));
        api.sfx.blip(620 + Math.min(600, peakChi));
      }
    }

    /* a real, quick sweep of the model to draw the magnetisation reference curve.
       Small lattice, warmed from the aligned state, so the ordered branch is clean. */
    function measureReference() {
      const n = 40, sp = new Int8Array(n * n);
      const out = [];
      for (let ti = 0; ti <= 26; ti++) {
        const t = TMIN + (TMAX - TMIN) * ti / 26;
        const e4 = Math.exp(-4 / t), e8 = Math.exp(-8 / t);
        for (let i = 0; i < sp.length; i++) sp[i] = 1;       // start cold each point
        let ms = sp.length;
        const doSweep = () => {
          for (let k = 0; k < sp.length; k++) {
            const i = (Math.random() * sp.length) | 0;
            const x = i % n, y = (i / n) | 0;
            const l = x === 0 ? i + n - 1 : i - 1;
            const r = x === n - 1 ? i - n + 1 : i + 1;
            const u = y === 0 ? i + (n - 1) * n : i - n;
            const d = y === n - 1 ? i - (n - 1) * n : i + n;
            const s = sp[i], nsum = sp[l] + sp[r] + sp[u] + sp[d], dE = 2 * s * nsum;
            if (dE <= 0 || (dE === 4 ? Math.random() < e4 : Math.random() < e8)) { sp[i] = -s; ms -= 2 * s; }
          }
        };
        for (let w = 0; w < 140; w++) doSweep();               // equilibrate
        let acc = 0;
        for (let w = 0; w < 80; w++) { doSweep(); acc += Math.abs(ms / sp.length); }
        out.push({ T: t, m: acc / 80 });
      }
      return out;
    }

    function drawPlot() {
      const w = plot.width, hh = plot.height, m = 26;
      pctx.clearRect(0, 0, w, hh);
      pctx.fillStyle = '#12100c'; pctx.fillRect(0, 0, w, hh);
      const X = (t) => m + (t - TMIN) / (TMAX - TMIN) * (w - m - 8);
      const Y = (v) => hh - m - v * (hh - m - 8);
      pctx.strokeStyle = '#4a4436'; pctx.lineWidth = 1;
      pctx.beginPath(); pctx.moveTo(m, Y(0)); pctx.lineTo(w - 8, Y(0)); pctx.moveTo(m, Y(0)); pctx.lineTo(m, Y(1)); pctx.stroke();
      pctx.fillStyle = '#8a8064'; pctx.font = '10px Verdana, sans-serif';
      pctx.fillText('|M|', 2, 12); pctx.fillText('temperature', w - 74, hh - 8);
      /* T_c line */
      pctx.strokeStyle = 'rgba(232,64,42,.8)'; pctx.setLineDash([4, 3]);
      pctx.beginPath(); pctx.moveTo(X(TC), Y(0)); pctx.lineTo(X(TC), Y(1)); pctx.stroke();
      pctx.setLineDash([]);
      pctx.fillStyle = '#e8402a'; pctx.fillText('T_c ' + TC.toFixed(3), X(TC) + 4, Y(1) + 10);
      /* measured magnetisation curve */
      if (ref.length) {
        pctx.strokeStyle = '#00a6b4'; pctx.lineWidth = 2; pctx.beginPath();
        ref.forEach((s, i) => { const x = X(s.T), y = Y(s.m); i ? pctx.lineTo(x, y) : pctx.moveTo(x, y); });
        pctx.stroke();
      }
      /* live sample: current (T, |m|) */
      const am = Math.abs(magSum / spin.length);
      pctx.fillStyle = '#ffcb1f';
      pctx.beginPath(); pctx.arc(X(T), Y(am), 4, 0, 7); pctx.fill();
      /* current T marker on axis */
      pctx.fillStyle = '#fffdf3';
      pctx.beginPath(); pctx.moveTo(X(T), Y(0) + 2); pctx.lineTo(X(T) - 4, Y(0) + 9); pctx.lineTo(X(T) + 4, Y(0) + 9); pctx.fill();
    }

    function draw() {
      for (let i = 0; i < spin.length; i++) buf[i] = spin[i] === 1 ? UP : DN;
      octx.putImageData(img, 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, N, N, 0, 0, W, H);
      ctx.restore();
      drawPlot();
    }

    /* ---- test seam: lets a headless sweep locate the transition ---- */
    window.__ising = {
      reset(opts) {
        if (opts && opts.T != null) setTemp(opts.T);
        init(opts && opts.cold !== false);   // default: start aligned (cold)
      },
      sweep(n) { for (let k = 0; k < (n || 1); k++) sweep(); },
      stats() {
        const m = magSum / spin.length, am = Math.abs(m);
        return { T: T, m: m, absM: am, chi: chi, size: spin.length };
      },
      setTemp(t) { setTemp(t); },
      setRunning(v) { running = !!v; }
    };
    bagg.add(() => { if (window.__ising) delete window.__ising; });

    setTemp(2.27);
    init(false);
    /* measure the reference curve just after first paint so the lattice is
       interactive instantly; drawPlot() already no-ops until it lands */
    const refTimer = setTimeout(() => { ref = measureReference(); }, 60);
    bagg.add(() => clearTimeout(refTimer));
    bagg.add(Engine.loop(() => {
      if (running) { sweep(); sweep(); }
      measureChi();
      syncPills();
      draw();
    }));

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'ising',
    title: 'Curie Point',
    emoji: 'ising',
    cat: 'sim',
    order: 8,
    blurb: 'A grid of magnetic spins run by one flip rule. Cool it and the sheet locks to a single colour; heat it past the Curie point Onsager fixed in 1944 and thermal noise pulls it apart.',
    scoreLabel: 'Peak susceptibility',
    tags: ['ising', 'phase-transition', 'magnetism', 'monte-carlo'],
    how: [
      'Every square is a tiny magnet pointing up or down. Neighbours prefer to match, and there is no outside field, so that agreement is the whole interaction.',
      'Spins flip by the Metropolis rule: a move that lowers energy is always taken, one that raises it is taken with probability exp(-ΔE / T). Temperature T sets how hard the noise pushes against the neighbours.',
      'Drag temperature down and the sheet magnetises: one colour takes the board and |M| climbs toward 1. Drag it up and the order dissolves to salt-and-pepper with |M| near 0.',
      'The Curie point is T_c ≈ 2.27. Sit there and domains churn at every size at once, which is criticality rather than a stall.',
      'The panel plots magnetisation against temperature, measured live from the model, with the exact T_c marked by the dashed line. On a finite lattice the curve rounds off and its drop sits a hair right of the line, which is real finite-size physics that shrinks as the lattice grows.',
      'Fluctuations (the susceptibility χ) peak sharply at the transition. Your score is the largest χ you can hold, so find the critical temperature and stay on it.'
    ],
    mount
  });
})();
