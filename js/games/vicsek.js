/* The Herd — the Vicsek model (1995), the founding flocking phase transition.
 *
 * A crowd of self-propelled dots, each moving at constant speed and, every step,
 * turning to the average heading of everyone within a short radius — plus a dose
 * of random noise. One rule. Below a critical noise the whole crowd spontaneously
 * commits to a single direction with no leader; above it, they mill uselessly.
 * The order parameter phi (mean of the unit velocities) is 0 for a milling crowd
 * and 1 for perfect lockstep. The instrument is phi versus noise, measured live
 * from the model. Default noise sits just inside the ordered side.
 */
(function () {
  'use strict';
  const { h, rand } = Engine;
  const W = 560, H = 560, LB = 100, N = 340, R = 5.0, V0 = 1.0;
  const SCALE = W / LB;

  function mount(root, api) {
    const bagg = Engine.bag();
    const x = new Float32Array(N), y = new Float32Array(N), th = new Float32Array(N), nth = new Float32Array(N);
    let eta = 1.2, running = true;
    const samples = [];
    let ref = [];

    const cv = Engine.canvas(root, W, H, { maxHeight: '62vh' });
    const ctx = cv.ctx;
    const plot = h('canvas', { class: 'fire-plot', width: 520, height: 200 });
    root.appendChild(h('div', { class: 'fire-panel' }, plot));
    const pctx = plot.getContext('2d');

    const pEta = api.pill('Noise: 1.20');
    const pPhi = api.pill('Alignment: 0.00');

    const slider = h('input', { type: 'range', min: '0', max: '5', step: '0.05', value: '1.2', class: 'slider' });
    slider.addEventListener('input', () => { eta = parseFloat(slider.value); pEta.textContent = 'Noise: ' + eta.toFixed(2); });
    api.toolbar.appendChild(h('label', { class: 'sel-wrap' }, h('span', null, 'noise'), slider));
    const runBtn = api.button('Pause', () => { running = !running; runBtn.textContent = running ? 'Pause' : 'Run'; });
    api.button('Reset', reset);

    function reset() {
      for (let i = 0; i < N; i++) { x[i] = Math.random() * LB; y[i] = Math.random() * LB; th[i] = rand(-Math.PI, Math.PI); }
      api.status('Lower the noise and watch a milling crowd snap into one shared heading with nobody in charge. Raise it and the flock dissolves.');
      syncPills();
    }

    function wrap(v) { return v < 0 ? v + LB : v >= LB ? v - LB : v; }

    function step() {
      for (let i = 0; i < N; i++) {
        let sc = 0, ss = 0;
        for (let j = 0; j < N; j++) {
          let dx = x[j] - x[i], dy = y[j] - y[i];
          if (dx > LB / 2) dx -= LB; else if (dx < -LB / 2) dx += LB;
          if (dy > LB / 2) dy -= LB; else if (dy < -LB / 2) dy += LB;
          if (dx * dx + dy * dy <= R * R) { sc += Math.cos(th[j]); ss += Math.sin(th[j]); }
        }
        nth[i] = Math.atan2(ss, sc) + rand(-eta / 2, eta / 2);
      }
      for (let i = 0; i < N; i++) { th[i] = nth[i]; x[i] = wrap(x[i] + V0 * Math.cos(th[i])); y[i] = wrap(y[i] + V0 * Math.sin(th[i])); }
    }

    function phi() {
      let sc = 0, ss = 0;
      for (let i = 0; i < N; i++) { sc += Math.cos(th[i]); ss += Math.sin(th[i]); }
      return Math.hypot(sc, ss) / N;
    }

    function syncPills() { pEta.textContent = 'Noise: ' + eta.toFixed(2); const ph = phi(); pPhi.textContent = 'Alignment: ' + ph.toFixed(2); pPhi.className = 'pill ' + (ph > 0.5 ? 'good' : 'warn'); }

    /* measured reference: settle at each noise, record alignment (smaller flock) */
    function measureReference() {
      const n = 160, xr = new Float32Array(n), yr = new Float32Array(n), tr = new Float32Array(n), ntr = new Float32Array(n), out = [];
      for (let ei = 0; ei <= 18; ei++) {
        const et = 5 * ei / 18;
        for (let i = 0; i < n; i++) { xr[i] = Math.random() * LB; yr[i] = Math.random() * LB; tr[i] = rand(-Math.PI, Math.PI); }
        for (let s = 0; s < 60; s++) {
          for (let i = 0; i < n; i++) {
            let sc = 0, ss = 0;
            for (let j = 0; j < n; j++) {
              let dx = xr[j] - xr[i], dy = yr[j] - yr[i];
              if (dx > LB / 2) dx -= LB; else if (dx < -LB / 2) dx += LB;
              if (dy > LB / 2) dy -= LB; else if (dy < -LB / 2) dy += LB;
              if (dx * dx + dy * dy <= R * R) { sc += Math.cos(tr[j]); ss += Math.sin(tr[j]); }
            }
            ntr[i] = Math.atan2(ss, sc) + rand(-et / 2, et / 2);
          }
          for (let i = 0; i < n; i++) { tr[i] = ntr[i]; xr[i] = wrap(xr[i] + V0 * Math.cos(tr[i])); yr[i] = wrap(yr[i] + V0 * Math.sin(tr[i])); }
        }
        let sc = 0, ss = 0; for (let i = 0; i < n; i++) { sc += Math.cos(tr[i]); ss += Math.sin(tr[i]); }
        out.push({ eta: et, phi: Math.hypot(sc, ss) / n });
      }
      return out;
    }

    function drawPlot() {
      const w = plot.width, hh = plot.height, m = 26;
      pctx.fillStyle = '#12100c'; pctx.fillRect(0, 0, w, hh);
      const X = (e) => m + e / 5 * (w - m - 8);
      const Y = (f) => hh - m - f * (hh - m - 8);
      pctx.strokeStyle = '#4a4436'; pctx.lineWidth = 1;
      pctx.beginPath(); pctx.moveTo(m, Y(0)); pctx.lineTo(w - 8, Y(0)); pctx.moveTo(m, Y(0)); pctx.lineTo(m, Y(1)); pctx.stroke();
      pctx.fillStyle = '#8a8064'; pctx.font = '10px Verdana, sans-serif';
      pctx.fillText('alignment', 2, 12); pctx.fillText('noise', w - 40, hh - 8);
      if (ref.length) { pctx.strokeStyle = '#6fcf2f'; pctx.lineWidth = 2; pctx.beginPath(); ref.forEach((s, i) => { const px = X(s.eta), py = Y(s.phi); i ? pctx.lineTo(px, py) : pctx.moveTo(px, py); }); pctx.stroke(); }
      for (const s of samples) { pctx.fillStyle = '#e8402a'; pctx.beginPath(); pctx.arc(X(s.eta), Y(s.phi), 3, 0, 7); pctx.fill(); }
      pctx.fillStyle = '#fffdf3'; pctx.beginPath(); pctx.moveTo(X(eta), Y(0) + 2); pctx.lineTo(X(eta) - 4, Y(0) + 9); pctx.lineTo(X(eta) + 4, Y(0) + 9); pctx.fill();
    }

    function draw() {
      ctx.fillStyle = '#0f1420'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < N; i++) {
        const px = x[i] * SCALE, py = y[i] * SCALE, a = th[i];
        const hue = ((a + Math.PI) / (2 * Math.PI) * 360) | 0;
        ctx.fillStyle = 'hsl(' + hue + ',75%,62%)';
        ctx.beginPath();
        ctx.moveTo(px + Math.cos(a) * 5, py + Math.sin(a) * 5);
        ctx.lineTo(px + Math.cos(a + 2.5) * 3, py + Math.sin(a + 2.5) * 3);
        ctx.lineTo(px + Math.cos(a - 2.5) * 3, py + Math.sin(a - 2.5) * 3);
        ctx.fill();
      }
      drawPlot();
    }

    window.__vicsek = {
      reset(opts) { if (opts && opts.eta != null) { eta = opts.eta; slider.value = String(eta); } reset(); },
      step() { step(); return phi(); },
      settle(steps) { for (let s = 0; s < (steps || 120); s++) step(); return phi(); },
      stats() { return { phi: phi(), eta: eta }; },
      setRunning(v) { running = !!v; }
    };
    bagg.add(() => { if (window.__vicsek) delete window.__vicsek; });

    ref = measureReference();
    reset();
    bagg.add(Engine.loop(() => {
      if (running) { step(); if ((Math.random() * 30 | 0) === 0) { const ph = phi(); samples.push({ eta: eta, phi: ph }); if (samples.length > 60) samples.shift(); api.submit(Math.round(ph * 100)); } }
      syncPills();
      draw();
    }));

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'vicsek',
    title: 'The Herd',
    emoji: 'vicsek',
    cat: 'sim',
    order: 10,
    blurb: 'A few hundred dots, each just steering toward the average heading of its neighbours plus a little randomness. Turn the randomness down and a directionless swarm suddenly moves as one, leaderless. The original model of flocking.',
    scoreLabel: 'Best alignment',
    tags: ['vicsek', 'flocking', 'phase-transition', 'emergence'],
    how: [
      'Every dot moves at the same speed and, each step, turns to the average heading of the dots within a short radius, plus some random jitter.',
      'The noise slider is that jitter. There is no leader and no goal — alignment is entirely emergent.',
      'The order parameter, "alignment", is 0 when the crowd mills in all directions and 1 when it moves in perfect lockstep.',
      'The instrument plots alignment against noise, measured live. Below a critical noise the flock locks in; above it, it falls apart. The change is sharp.',
      'Your score is the best alignment you sustain. The interesting play is right around the transition.'
    ],
    mount
  });
})();
