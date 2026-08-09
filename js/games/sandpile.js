/* In-Box — the Bak-Tang-Wiesenfeld sandpile (1987), self-organized criticality.
 *
 * Memos pile on desks. A desk holding four topples, shedding one memo to each
 * orthogonal neighbour — which can push them over too, in a reply-all cascade.
 * Grains that fall off the edge are lost. There is no dial to tune: drop memos
 * at random and the pile drives ITSELF to the critical point, where avalanche
 * sizes have no typical scale — sometimes one desk, sometimes the whole floor,
 * and everything between, following a power law. The instrument is the avalanche
 * size distribution on log-log axes; criticality shows up as a straight line.
 * The anti-lesson: you cannot calm it. There is no stable regime to reach.
 */
(function () {
  'use strict';
  const { h } = Engine;
  const W = 540, H = 540, L = 90;
  const CELL = W / L;

  function mount(root, api) {
    const bagg = Engine.bag();
    const height = new Uint8Array(L * L);
    const flash = new Float32Array(L * L);
    let running = true, grains = 0, avalanches = 0, biggest = 0;
    const hist = {};   // avalanche size -> count

    const cv = Engine.canvas(root, W, H, { maxHeight: '60vh' });
    const ctx = cv.ctx;
    const plot = h('canvas', { class: 'fire-plot', width: 520, height: 200 });
    root.appendChild(h('div', { class: 'fire-panel' }, plot));
    const pctx = plot.getContext('2d');

    const pGrains = api.pill('Memos dropped: 0');
    const pAval = api.pill('Avalanches: 0');
    const pBig = api.pill('Biggest: 0');

    const runBtn = api.button('Pause', () => { running = !running; runBtn.textContent = running ? 'Pause' : 'Run'; });
    api.button('Reset', reset);

    function reset() {
      height.fill(0); flash.fill(0);
      grains = 0; avalanches = 0; biggest = 0;
      for (const k in hist) delete hist[k];
      api.status('Memos drop on random desks. A desk with four topples onto its neighbours, which can set off a chain. Click to drop one yourself.');
      syncPills();
    }

    /* drop one grain at idx and let the whole avalanche resolve; return its size */
    function drop(idx) {
      height[idx]++;
      grains++;
      let size = 0;
      const stack = [];
      if (height[idx] >= 4) stack.push(idx);
      while (stack.length) {
        const i = stack.pop();
        if (height[i] < 4) continue;
        const times = (height[i] / 4) | 0;
        height[i] -= times * 4;
        size += times;
        flash[i] = 1;
        const x = i % L, y = (i / L) | 0;
        if (x > 0) { height[i - 1] += times; if (height[i - 1] >= 4) stack.push(i - 1); }
        if (x < L - 1) { height[i + 1] += times; if (height[i + 1] >= 4) stack.push(i + 1); }
        if (y > 0) { height[i - L] += times; if (height[i - L] >= 4) stack.push(i - L); }
        if (y < L - 1) { height[i + L] += times; if (height[i + L] >= 4) stack.push(i + L); }
        /* grains off the edge are lost — the dissipation that makes SOC work */
      }
      if (size > 0) { avalanches++; hist[size] = (hist[size] || 0) + 1; if (size > biggest) biggest = size; }
      return size;
    }

    function syncPills() {
      pGrains.textContent = 'Memos dropped: ' + grains;
      pAval.textContent = 'Avalanches: ' + avalanches;
      pBig.textContent = 'Biggest: ' + biggest;
    }

    function drawPlot() {
      const w = plot.width, hh = plot.height, m = 28;
      pctx.fillStyle = '#12100c'; pctx.fillRect(0, 0, w, hh);
      pctx.strokeStyle = '#4a4436'; pctx.lineWidth = 1;
      pctx.beginPath(); pctx.moveTo(m, hh - m); pctx.lineTo(w - 6, hh - m); pctx.moveTo(m, hh - m); pctx.lineTo(m, 8); pctx.stroke();
      pctx.fillStyle = '#8a8064'; pctx.font = '10px Verdana, sans-serif';
      pctx.fillText('log count', 2, 12); pctx.fillText('log avalanche size', w - 118, hh - 8);
      /* logarithmic bins */
      const sizes = Object.keys(hist);
      if (sizes.length < 2) return;
      const maxLog = Math.log10(biggest) || 1;
      const NB = 22;
      const bins = new Array(NB).fill(0);
      for (const s of sizes) { const b = Math.min(NB - 1, Math.floor(Math.log10(+s) / maxLog * (NB - 1))); bins[b] += hist[s]; }
      let maxC = 1; for (const c of bins) if (c > maxC) maxC = c;
      const X = (b) => m + b / (NB - 1) * (w - m - 6);
      const Y = (c) => (hh - m) - (Math.log10(c) / (Math.log10(maxC) || 1)) * (hh - m - 8);
      pctx.strokeStyle = '#ffcb1f'; pctx.lineWidth = 2; pctx.beginPath();
      let started = false;
      for (let b = 0; b < NB; b++) { if (bins[b] <= 0) continue; const x = X(b), y = Y(bins[b]); started ? pctx.lineTo(x, y) : pctx.moveTo(x, y); started = true; }
      pctx.stroke();
      pctx.fillStyle = '#e8402a';
      for (let b = 0; b < NB; b++) { if (bins[b] <= 0) continue; pctx.beginPath(); pctx.arc(X(b), Y(bins[b]), 2.5, 0, 7); pctx.fill(); }
      pctx.fillStyle = '#8a8064'; pctx.fillText('a straight line here = criticality', m + 6, 22);
    }

    function draw() {
      ctx.fillStyle = '#141019'; ctx.fillRect(0, 0, W, H);
      const shades = ['#1b2430', '#2d5f6b', '#c7a637', '#e8402a'];
      for (let i = 0; i < height.length; i++) {
        const hgt = height[i];
        if (hgt === 0 && flash[i] <= 0) continue;
        if (flash[i] > 0) { ctx.fillStyle = 'rgba(255,253,243,' + (0.25 + 0.6 * flash[i]) + ')'; flash[i] -= 0.12; }
        else ctx.fillStyle = shades[hgt] || '#e8402a';
        ctx.fillRect((i % L) * CELL, ((i / L) | 0) * CELL, CELL + 1, CELL + 1);
      }
      drawPlot();
    }

    bagg.listen(cv.el, 'pointerdown', (e) => {
      const p = cv.pos(e);
      const gx = Math.floor(p.x / W * L), gy = Math.floor(p.y / H * L);
      if (gx >= 0 && gy >= 0 && gx < L && gy < L) { drop(gy * L + gx); syncPills(); }
    });

    window.__sandpile = {
      reset() { reset(); },
      drop() { const s = drop((Math.random() * L * L) | 0); syncPills(); return s; },
      dropN(n) { for (let k = 0; k < (n || 1); k++) drop((Math.random() * L * L) | 0); syncPills(); },
      stats() { return { grains: grains, avalanches: avalanches, biggest: biggest, distinctSizes: Object.keys(hist).length }; },
      setRunning(v) { running = !!v; }
    };
    bagg.add(() => { if (window.__sandpile) delete window.__sandpile; });

    reset();
    bagg.add(Engine.loop(() => {
      if (running) { for (let k = 0; k < 4; k++) drop((Math.random() * L * L) | 0); syncPills(); if (grains % 200 === 0) api.submit(biggest); }
      draw();
    }));

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'sandpile',
    title: 'In-Box',
    emoji: 'sandpile',
    cat: 'sim',
    order: 9,
    blurb: 'Memos land on desks; a desk holding four spills onto its neighbours and can set off a reply-all cascade. Left alone, the pile drives itself to the edge of chaos.',
    scoreLabel: 'Biggest avalanche',
    tags: ['sandpile', 'self-organized-criticality', 'power-law', 'emergence'],
    how: [
      'Memos drop on random desks. A desk holding four topples, sending one to each side neighbour. Memos off the edge are lost.',
      'A topple can push neighbours over too, so one memo can trigger an avalanche of any size. Click a desk to drop one yourself.',
      'There is no setting to change. Left alone, the pile drives itself to criticality, where avalanches have no typical size.',
      'The plot is the avalanche-size distribution on log-log axes. A straight line is the power law of self-organized criticality.',
      'You cannot calm it down; there is no stable state to reach. Your score is the biggest avalanche you have seen.'
    ],
    mount
  });
})();
