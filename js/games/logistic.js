/* Boom & Bust — the logistic map, May's route to chaos (Robert May, 1974/76).
 *
 * One line of arithmetic runs a population: next = r · x · (1 − x), where x is
 * this year's stock as a fraction of the maximum and r is the growth rate.
 * Turn r up and the behaviour reorganises: a steady level, then a two-year
 * boom–bust cycle, then four years, eight, sixteen — the period keeps doubling,
 * faster each time — until at r ≈ 3.5699 the cycle length goes infinite and the
 * population never repeats. That is deterministic chaos from a one-liner. Inside
 * the chaos sit sudden windows of order (a clean three-year cycle near r ≈ 3.83).
 * The main view is the bifurcation diagram; the panel is the Lyapunov exponent,
 * which is negative wherever the map is periodic and turns positive exactly when
 * chaos begins — its zero crossing is the onset. The window.__logistic seam lets
 * a headless sweep confirm that crossing (tools/sweep-logistic.mjs).
 */
(function () {
  'use strict';
  const { h, clamp } = Engine;
  const W = 560, H = 560;
  const BIFH = 416;                    // bifurcation-diagram band height
  const ORBH = H - BIFH;               // live-orbit strip below it
  const RLO = 2.5, RHI = 4.0;
  const RCHAOS = 3.56995;              // onset of chaos (Feigenbaum accumulation)
  const R3 = 3.8284;                   // start of the period-3 window

  const map = (r, x) => r * x * (1 - x);

  /* Lyapunov exponent from a generic start (NOT x=0.5 — that lands on the
     critical orbit and collapses at r=4). Negative = periodic, positive = chaos. */
  function lyapunov(r, warm, n) {
    let x = 0.4, s = 0;
    for (let i = 0; i < warm; i++) x = map(r, x);
    for (let i = 0; i < n; i++) { s += Math.log(Math.max(1e-12, Math.abs(r * (1 - 2 * x)))); x = map(r, x); }
    return s / n;
  }
  /* shortest period p (<= maxP) the orbit settles into, or 0 for chaos/none */
  function periodOf(r, maxP) {
    let x = 0.4;
    for (let i = 0; i < 5000; i++) x = map(r, x);
    const seq = [x];
    for (let i = 0; i < maxP; i++) { x = map(r, x); seq.push(x); }
    for (let p = 1; p <= maxP; p++) if (Math.abs(seq[0] - seq[p]) < 1e-4) return p;
    return 0;
  }

  function mount(root, api) {
    const bagg = Engine.bag();
    let r = 3.2, xcur = 0.4, curP = 0, curL = 0, bestP = 0;
    const orbit = [];                    // recent x values for the live strip

    const cv = Engine.canvas(root, W, H, { maxHeight: '60vh' });
    const ctx = cv.ctx;
    const bif = document.createElement('canvas');   // cached bifurcation diagram
    bif.width = W; bif.height = BIFH;
    const bctx = bif.getContext('2d');
    let bifReady = false;
    let lam = null;                      // cached Lyapunov curve across the panel

    const plot = h('canvas', { class: 'fire-plot', width: 520, height: 200 });
    root.appendChild(h('div', { class: 'fire-panel' }, plot));
    const pctx = plot.getContext('2d');

    const pR = api.pill('r: 3.20');
    const pPeriod = api.pill('cycle: —');
    const pLam = api.pill('λ: —');
    const pRegime = api.pill('steady');

    const slider = h('input', { type: 'range', min: String(RLO), max: String(RHI), step: '0.001', value: '3.2', class: 'slider' });
    slider.addEventListener('input', () => setR(parseFloat(slider.value)));
    api.toolbar.appendChild(h('label', { class: 'sel-wrap' }, h('span', null, 'growth rate r'), slider));
    api.button('Onset of chaos', () => setR(RCHAOS));
    api.button('Period-3 window', () => setR(3.835));

    function setR(v) {
      r = clamp(v, RLO, RHI);
      slider.value = String(r);
      xcur = 0.4; orbit.length = 0;
      curP = periodOf(r, 16);
      curL = lyapunov(r, 1500, 6000);
      if (curP > bestP) { bestP = curP; api.submit(bestP); api.sfx.blip(440 + bestP * 20); }
      syncPills();
    }

    function syncPills() {
      pR.textContent = 'r: ' + r.toFixed(3);
      pPeriod.textContent = 'cycle: ' + (curP ? curP + '-year' : 'chaotic');
      pLam.textContent = 'λ: ' + curL.toFixed(3);
      const chaotic = curL > 0 && !curP;
      pRegime.textContent = curP === 1 ? 'steady' : curP ? 'period-' + curP : chaotic ? 'CHAOS' : 'edge';
      pRegime.className = 'pill ' + (chaotic ? 'warn' : curP ? 'good' : '');
      pPeriod.className = 'pill ' + (curP ? 'good' : 'warn');
    }

    /* build the bifurcation diagram once: for each r-column, iterate from a
       generic seed, discard the transient, then plot where the orbit lands */
    function buildBif() {
      const im = bctx.createImageData(W, BIFH);
      const d = im.data;
      for (let px = 0; px < W; px++) {
        const rr = RLO + (RHI - RLO) * px / (W - 1);
        let x = 0.4;
        for (let i = 0; i < 600; i++) x = map(rr, x);
        for (let i = 0; i < 320; i++) {
          x = map(rr, x);
          const py = Math.min(BIFH - 1, Math.max(0, Math.round((1 - x) * (BIFH - 1))));
          const o = (py * W + px) * 4;
          d[o] = Math.min(255, d[o] + 90);
          d[o + 1] = Math.min(255, d[o + 1] + 150);
          d[o + 2] = Math.min(255, d[o + 2] + 170);
          d[o + 3] = 255;
        }
      }
      bctx.putImageData(im, 0, 0);
      bifReady = true;
    }

    function buildLyap() {
      const w = plot.width, n = w - 40;
      lam = new Float64Array(n);
      for (let i = 0; i < n; i++) lam[i] = lyapunov(RLO + (RHI - RLO) * i / (n - 1), 800, 2500);
    }

    const RX = (rr, x0, wpix) => x0 + (rr - RLO) / (RHI - RLO) * wpix;

    function drawPanel() {
      const w = plot.width, hh = plot.height, mL = 30, mB = 22;
      pctx.fillStyle = '#0b0f16'; pctx.fillRect(0, 0, w, hh);
      const plw = w - mL - 8, plh = hh - mB - 8;
      const lamMin = -1.6, lamMax = 0.8;
      const Y = (l) => 8 + (lamMax - clamp(l, lamMin, lamMax)) / (lamMax - lamMin) * plh;
      const X = (rr) => RX(rr, mL, plw);
      /* zero line */
      pctx.strokeStyle = '#3a4658'; pctx.lineWidth = 1;
      pctx.beginPath(); pctx.moveTo(mL, Y(0)); pctx.lineTo(w - 8, Y(0)); pctx.stroke();
      pctx.fillStyle = '#6c7a90'; pctx.font = '10px Verdana, sans-serif';
      pctx.fillText('λ', 4, Y(0) - 3); pctx.fillText('0', 16, Y(0) + 3); pctx.fillText('r', w - 14, hh - 8);
      /* onset of chaos marker */
      pctx.strokeStyle = 'rgba(232,64,42,.8)'; pctx.setLineDash([4, 3]);
      pctx.beginPath(); pctx.moveTo(X(RCHAOS), 6); pctx.lineTo(X(RCHAOS), hh - mB); pctx.stroke();
      pctx.setLineDash([]);
      pctx.fillStyle = '#e8402a'; pctx.fillText('chaos ' + RCHAOS.toFixed(3), X(RCHAOS) - 64, hh - 10);
      /* the curve */
      if (lam) {
        pctx.strokeStyle = '#00a6b4'; pctx.lineWidth = 1.4; pctx.beginPath();
        for (let i = 0; i < lam.length; i++) {
          const rr = RLO + (RHI - RLO) * i / (lam.length - 1);
          const x = X(rr), y = Y(lam[i]);
          i ? pctx.lineTo(x, y) : pctx.moveTo(x, y);
        }
        pctx.stroke();
      }
      /* current r */
      pctx.strokeStyle = '#ffcb1f'; pctx.lineWidth = 1;
      pctx.beginPath(); pctx.moveTo(X(r), 6); pctx.lineTo(X(r), hh - mB); pctx.stroke();
    }

    function draw() {
      /* bifurcation diagram */
      ctx.fillStyle = '#0b0f16'; ctx.fillRect(0, 0, W, H);
      if (bifReady) ctx.drawImage(bif, 0, 0);
      else { ctx.fillStyle = '#6c7a90'; ctx.font = '13px Verdana'; ctx.fillText('measuring the map…', 20, 30); }
      /* current-r line + labels on the diagram */
      const xr = RX(r, 0, W - 1);
      ctx.strokeStyle = 'rgba(255,203,31,.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xr, 0); ctx.lineTo(xr, BIFH); ctx.stroke();
      ctx.fillStyle = '#e8402a';
      const xc = RX(RCHAOS, 0, W - 1);
      ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(232,64,42,.6)';
      ctx.beginPath(); ctx.moveTo(xc, 0); ctx.lineTo(xc, BIFH); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = '10px Verdana, sans-serif';
      ctx.fillText('onset of chaos', xc + 3, 12);
      ctx.fillStyle = '#8a8064';
      ctx.fillText('r = ' + RLO, 4, BIFH - 4); ctx.fillText('r = ' + RHI, W - 44, BIFH - 4);
      ctx.fillStyle = '#ded6c2'; ctx.fillText('population x', 4, 12);

      /* live orbit strip */
      ctx.fillStyle = '#141019'; ctx.fillRect(0, BIFH, W, ORBH);
      ctx.strokeStyle = '#2a2440'; ctx.beginPath(); ctx.moveTo(0, BIFH + 0.5); ctx.lineTo(W, BIFH + 0.5); ctx.stroke();
      const oy = (x) => BIFH + 8 + (1 - x) * (ORBH - 16);
      ctx.strokeStyle = '#6fcf2f'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i < orbit.length; i++) {
        const x = 6 + i / 140 * (W - 12), y = oy(orbit[i]);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = '#6fcf2f';
      for (let i = 0; i < orbit.length; i++) ctx.fillRect(6 + i / 140 * (W - 12) - 1, oy(orbit[i]) - 1, 2, 2);
      ctx.fillStyle = '#8a8064'; ctx.font = '10px Verdana, sans-serif';
      ctx.fillText('this year → next year (watch the cycle length)', 8, H - 6);

      drawPanel();
    }

    /* ---- test seam ---- */
    window.__logistic = {
      setR(v) { setR(v); },
      lyapunov(v, warm, n) { return lyapunov(v, warm || 2000, n || 20000); },
      period(v, maxP) { return periodOf(v, maxP || 16); },
      stats() { return { r: r, period: curP, lambda: curL }; }
    };
    bagg.add(() => { if (window.__logistic) delete window.__logistic; });

    setR(3.2);
    const t1 = setTimeout(buildBif, 40);
    const t2 = setTimeout(buildLyap, 60);
    bagg.add(() => { clearTimeout(t1); clearTimeout(t2); });
    api.status('One slider runs a whole population year by year. Drag "growth rate r" up: the numbers first hold steady, then bounce between a few values, then never settle. Your score is the longest repeating cycle you can land on.');

    bagg.add(Engine.loop(() => {
      /* advance the live orbit a few years per frame */
      for (let s = 0; s < 2; s++) { xcur = map(r, xcur); orbit.push(xcur); if (orbit.length > 141) orbit.shift(); }
      draw();
    }));

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'logistic',
    title: 'Boom & Bust',
    emoji: 'boom',
    cat: 'sim',
    order: 11,
    blurb: 'One line of arithmetic runs a population. Turn the growth-rate knob up and it goes from a steady level into doubling boom-bust cycles and then chaos, with small windows of order hidden in the mess.',
    scoreLabel: 'Deepest cycle',
    tags: ['logistic-map', 'chaos', 'bifurcation', 'dynamical-systems'],
    how: [
      'In one line: drag the "growth rate r" slider and watch the population go from steady, to a boom-bust cycle, to chaos. Landing on a longer exact cycle scores more.',
      'Nothing to steer here — you turn one knob (r) and read what the population does. The bottom strip is the population year by year; the big diagram maps every r at once.',
      'The rule is next = r × x × (1 − x): a population that grows when small and crashes when it overshoots. x is the stock from 0 to 1, and r is the growth rate you set.',
      'The main view is the bifurcation diagram: for each growth rate it marks the values the population settles into. One dot is a steady level, two dots mean it alternates high and low each year, and more dots mean a longer cycle.',
      'Raise r and the cycle length keeps doubling, 1, 2, 4, 8, 16, in ever-smaller steps that pile up at r ≈ 3.5699. Past there the population never repeats, which is deterministic chaos from a one-liner.',
      'The bottom strip replays the orbit year by year, so you can watch the cycle length directly: flat at low r, a two-beat higher up, then a jitter that never settles.',
      'The panel measures the Lyapunov exponent, the rate at which nearby populations pull apart. It is negative wherever the map is periodic and crosses zero right at the onset of chaos, which is marked.',
      'Hunt the windows: deep in the chaos the diagram clears into a tidy three-year cycle near r ≈ 3.83, with five- and six-year windows nearby. Your score is the longest exact cycle you can land on.'
    ],
    mount
  });
})();
