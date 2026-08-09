/* Slow Clap — the Kuramoto model (1975) of coupled oscillators.
 *
 * A room of clappers, each with their own natural rhythm, each nudging its phase
 * toward the crowd's average. Below a critical coupling the applause is a wash of
 * noise; turn the coupling up past one exact point and it collapses into a single
 * synchronized slow clap — a real, documented instance of this model (rhythmic
 * applause, Neda et al., Nature 2000). The order parameter r runs 0 (incoherent)
 * to 1 (locked). Mean-field dynamics: dtheta_i = omega_i + K r sin(psi - theta_i).
 * Critical coupling for a normal spread of rhythms is K_c ~ 1.6 sigma. The
 * instrument is r versus coupling K, measured live.
 */
(function () {
  'use strict';
  const { h } = Engine;
  const W = 560, H = 560, N = 220, DT = 0.05, SIGMA = 1.0;
  const CX = W / 2, CY = H / 2 - 30, RC = 190;

  function gauss() { const u1 = Math.random() || 1e-9, u2 = Math.random(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); }

  function mount(root, api) {
    const bagg = Engine.bag();
    const th = new Float32Array(N), om = new Float32Array(N);
    let K = 2.2, running = true, locked = false;
    const samples = [];
    let ref = [];

    const cv = Engine.canvas(root, W, H, { maxHeight: '62vh' });
    const ctx = cv.ctx;
    const plot = h('canvas', { class: 'fire-plot', width: 520, height: 200 });
    root.appendChild(h('div', { class: 'fire-panel' }, plot));
    const pctx = plot.getContext('2d');

    const pK = api.pill('Coupling K: 2.20');
    const pR = api.pill('Sync r: 0.00');

    const slider = h('input', { type: 'range', min: '0', max: '4', step: '0.05', value: '2.2', class: 'slider' });
    slider.addEventListener('input', () => { K = parseFloat(slider.value); pK.textContent = 'Coupling K: ' + K.toFixed(2); });
    api.toolbar.appendChild(h('label', { class: 'sel-wrap' }, h('span', null, 'coupling'), slider));
    const runBtn = api.button('Pause', () => { running = !running; runBtn.textContent = running ? 'Pause' : 'Run'; });
    api.button('Reset', reset);

    function reset() {
      for (let i = 0; i < N; i++) { th[i] = Math.random() * 2 * Math.PI; om[i] = gauss() * SIGMA; }
      locked = false;
      api.status('Raise the coupling slider until every dot blinks in sync.');
      syncPills();
    }

    function order() { let sc = 0, ss = 0; for (let i = 0; i < N; i++) { sc += Math.cos(th[i]); ss += Math.sin(th[i]); } return { r: Math.hypot(sc, ss) / N, psi: Math.atan2(ss, sc) }; }

    function step() {
      const o = order();
      for (let i = 0; i < N; i++) th[i] += (om[i] + K * o.r * Math.sin(o.psi - th[i])) * DT;
      return o.r;
    }

    function syncPills() {
      pK.textContent = 'Coupling K: ' + K.toFixed(2);
      const r = order().r;
      pR.textContent = 'Sync r: ' + r.toFixed(2);
      pR.className = 'pill ' + (r > 0.5 ? 'good' : 'warn');
      if (r > 0.9 && !locked) { locked = true; api.sfx.great(); }
      else if (r < 0.85 && locked) { locked = false; }
    }

    function measureReference() {
      const n = 160, tr = new Float32Array(n), or = new Float32Array(n), out = [];
      for (let ki = 0; ki <= 20; ki++) {
        const kk = 4 * ki / 20;
        for (let i = 0; i < n; i++) { tr[i] = Math.random() * 2 * Math.PI; or[i] = gauss() * SIGMA; }
        for (let s = 0; s < 300; s++) {
          let sc = 0, ss = 0; for (let i = 0; i < n; i++) { sc += Math.cos(tr[i]); ss += Math.sin(tr[i]); }
          const r = Math.hypot(sc, ss) / n, psi = Math.atan2(ss, sc);
          for (let i = 0; i < n; i++) tr[i] += (or[i] + kk * r * Math.sin(psi - tr[i])) * DT;
        }
        let sc = 0, ss = 0; for (let i = 0; i < n; i++) { sc += Math.cos(tr[i]); ss += Math.sin(tr[i]); }
        out.push({ K: kk, r: Math.hypot(sc, ss) / n });
      }
      return out;
    }

    function drawPlot() {
      const w = plot.width, hh = plot.height, m = 26;
      pctx.fillStyle = '#12100c'; pctx.fillRect(0, 0, w, hh);
      const X = (k) => m + k / 4 * (w - m - 8);
      const Y = (f) => hh - m - f * (hh - m - 8);
      pctx.strokeStyle = '#4a4436'; pctx.lineWidth = 1;
      pctx.beginPath(); pctx.moveTo(m, Y(0)); pctx.lineTo(w - 8, Y(0)); pctx.moveTo(m, Y(0)); pctx.lineTo(m, Y(1)); pctx.stroke();
      pctx.fillStyle = '#8a8064'; pctx.font = '10px Verdana, sans-serif';
      pctx.fillText('sync r', 2, 12); pctx.fillText('coupling K', w - 60, hh - 8);
      const kc = 1.6 * SIGMA;
      pctx.strokeStyle = 'rgba(232,64,42,.7)'; pctx.setLineDash([4, 3]); pctx.beginPath(); pctx.moveTo(X(kc), Y(0)); pctx.lineTo(X(kc), Y(1)); pctx.stroke(); pctx.setLineDash([]);
      pctx.fillStyle = '#e8402a'; pctx.fillText('K_c~' + kc.toFixed(1), X(kc) + 3, Y(1) + 10);
      if (ref.length) { pctx.strokeStyle = '#ffcb1f'; pctx.lineWidth = 2; pctx.beginPath(); ref.forEach((s, i) => { const px = X(s.K), py = Y(s.r); i ? pctx.lineTo(px, py) : pctx.moveTo(px, py); }); pctx.stroke(); }
      for (const s of samples) { pctx.fillStyle = '#6fcf2f'; pctx.beginPath(); pctx.arc(X(s.K), Y(s.r), 3, 0, 7); pctx.fill(); }
      pctx.fillStyle = '#fffdf3'; pctx.beginPath(); pctx.moveTo(X(K), Y(0) + 2); pctx.lineTo(X(K) - 4, Y(0) + 9); pctx.lineTo(X(K) + 4, Y(0) + 9); pctx.fill();
    }

    function draw() {
      ctx.fillStyle = '#12101a'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#332b3f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(CX, CY, RC, 0, 7); ctx.stroke();
      for (let i = 0; i < N; i++) {
        const a = th[i];
        const hue = Math.max(0, Math.min(240, 120 + om[i] * 60)) | 0;
        ctx.fillStyle = 'hsl(' + hue + ',70%,60%)';
        ctx.beginPath(); ctx.arc(CX + Math.cos(a) * RC, CY + Math.sin(a) * RC, 3.2, 0, 7); ctx.fill();
      }
      const o = order();
      ctx.strokeStyle = '#fffdf3'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(CX + Math.cos(o.psi) * RC * o.r, CY + Math.sin(o.psi) * RC * o.r); ctx.stroke();
      ctx.fillStyle = '#fffdf3'; ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('r = ' + o.r.toFixed(2), CX, CY + 6); ctx.textAlign = 'left';
      drawPlot();
    }

    window.__kuramoto = {
      reset(opts) { if (opts && opts.K != null) { K = opts.K; slider.value = String(K); } reset(); },
      step() { return step(); },
      settle(steps) { for (let s = 0; s < (steps || 400); s++) step(); return order().r; },
      stats() { return { r: order().r, K: K }; },
      setRunning(v) { running = !!v; }
    };
    bagg.add(() => { if (window.__kuramoto) delete window.__kuramoto; });

    reset();
    const rt = setTimeout(() => { ref = measureReference(); }, 60);   // defer the heavy sweep so the field paints first
    bagg.add(() => clearTimeout(rt));
    bagg.add(Engine.loop(() => {
      if (running) { step(); if ((Math.random() * 30 | 0) === 0) { const r = order().r; samples.push({ K: K, r: r }); if (samples.length > 60) samples.shift(); api.submit(Math.round(r * 100)); } }
      syncPills();
      draw();
    }));

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'kuramoto',
    title: 'Slow Clap',
    emoji: 'kuramoto',
    cat: 'sim',
    order: 11,
    blurb: 'A room of people clapping at their own pace, each nudging toward the room average. Below a critical coupling it stays a wash of noise; above it the whole crowd locks into one slow clap. Real applause does this.',
    scoreLabel: 'Best sync',
    tags: ['kuramoto', 'synchronization', 'phase-transition', 'emergence'],
    how: [
      'Each dot on the ring is a clapper at its own rhythm, shown by its color. Each step it nudges toward the crowd average.',
      'The coupling slider sets how hard everyone listens to the room. The white arrow is the order parameter r, meaning how synchronized the crowd is.',
      'Below the critical coupling the dots smear around the ring (r near 0). Above it they clump and move together (r near 1).',
      'The panel plots sync against coupling, measured live, with the critical coupling K_c marked. The onset is sharp.',
      'Your score is the best sync you reach. Rhythmic applause is a documented example of this transition.'
    ],
    mount
  });
})();
