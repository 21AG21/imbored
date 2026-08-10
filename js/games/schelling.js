/* Seating Chart — Schelling's segregation model (1971).
 *
 * A floor of two teams plus some empty desks. Each person is content only if at
 * least a fraction T of their occupied neighbours share their team; the content
 * stay put, the discontented get up and take a random empty desk. One rule, run
 * to equilibrium. The lesson nobody wants: even a mild preference — around a
 * third — curdles a well-mixed floor into hard single-team blocks. Push the
 * preference too high (past ~0.75) and it JAMS: nobody can ever settle, and the
 * floor stays churned. The instrument is the segregation-index-vs-tolerance
 * curve, measured live from the model, with its peak marked.
 */
(function () {
  'use strict';
  const { h, clamp, shuffle } = Engine;
  const W = 560, H = 560, L = 62;
  const CELL = W / L;
  const EMPTY = 0, A = 1, B = 2;

  function mount(root, api) {
    const bagg = Engine.bag();
    const grid = new Int8Array(L * L);
    let T = 0.35, emptyFrac = 0.08, running = false, rounds = 0;
    const samples = [];      // {T, seg} settled points the player produced
    let ref = [];            // measured reference curve

    const cv = Engine.canvas(root, W, H, { maxHeight: '62vh' });
    const ctx = cv.ctx;
    const plot = h('canvas', { class: 'fire-plot', width: 520, height: 200 });
    root.appendChild(h('div', { class: 'fire-panel' }, plot));
    const pctx = plot.getContext('2d');

    const pTol = api.pill('Preference: 0.35');
    const pSeg = api.pill('Segregation: 0%');
    const pUnhappy = api.pill('Unsettled: 0%');

    const slider = h('input', { type: 'range', min: '0', max: '0.85', step: '0.01', value: '0.35', class: 'slider' });
    slider.addEventListener('input', () => { T = parseFloat(slider.value); pTol.textContent = 'Preference: ' + T.toFixed(2); });
    api.toolbar.appendChild(h('label', { class: 'sel-wrap' }, h('span', null, 'preference'), slider));
    const runBtn = api.button('Run', () => { running = !running; runBtn.textContent = running ? 'Pause' : 'Run'; });
    api.button('Reshuffle', () => fill());

    function fill() {
      for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < emptyFrac ? EMPTY : (Math.random() < 0.5 ? A : B);
      rounds = 0;
      running = false; runBtn.textContent = 'Run';
      api.status('Set how picky everyone is, hit Run, and watch the neighbourhood sort itself into blocks.');
      syncPills();
    }

    /* fraction of a cell's occupied neighbours that share its team */
    function sameFrac(i) {
      const x = i % L, y = (i / L) | 0, me = grid[i];
      let same = 0, occ = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= L || ny >= L) continue;
        const v = grid[ny * L + nx];
        if (v === EMPTY) continue;
        occ++;
        if (v === me) same++;
      }
      return occ === 0 ? 1 : same / occ;   // isolated agents are content
    }

    /* one relocation round; returns how many people moved */
    function step() {
      const unhappy = [], empties = [];
      for (let i = 0; i < grid.length; i++) {
        if (grid[i] === EMPTY) empties.push(i);
        else if (sameFrac(i) < T) unhappy.push(i);
      }
      shuffle(empties);
      let ei = 0, moved = 0;
      for (const i of shuffle(unhappy)) {
        if (ei >= empties.length) break;
        const dest = empties[ei++];
        grid[dest] = grid[i];
        grid[i] = EMPTY;
        empties.push(i);           // the vacated cell becomes available later
        moved++;
      }
      rounds++;
      return moved;
    }

    function stats() {
      let seg = 0, occ = 0, unhappy = 0;
      for (let i = 0; i < grid.length; i++) {
        if (grid[i] === EMPTY) continue;
        occ++;
        const f = sameFrac(i);
        seg += f;
        if (f < T) unhappy++;
      }
      return { seg: occ ? seg / occ : 0, unhappy: occ ? unhappy / occ : 0, occ: occ };
    }

    function syncPills() {
      const s = stats();
      pTol.textContent = 'Preference: ' + T.toFixed(2);
      pSeg.textContent = 'Segregation: ' + Math.round(s.seg * 100) + '%';
      pUnhappy.textContent = 'Unsettled: ' + Math.round(s.unhappy * 100) + '%';
      pUnhappy.className = 'pill ' + (s.unhappy > 0.15 ? 'warn' : '');
    }

    /* measured reference curve on a small grid: settle at each T, record seg */
    function measureReference() {
      const S = 34, g = new Int8Array(S * S), out = [];
      const sf = (i) => {
        const x = i % S, y = (i / S) | 0, me = g[i]; let same = 0, occ = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
          const v = g[ny * S + nx]; if (v === EMPTY) continue; occ++; if (v === me) same++;
        }
        return occ === 0 ? 1 : same / occ;
      };
      for (let ti = 0; ti <= 20; ti++) {
        const tt = 0.85 * ti / 20;
        for (let i = 0; i < g.length; i++) g[i] = Math.random() < 0.08 ? 0 : (Math.random() < 0.5 ? A : B);
        for (let round = 0; round < 60; round++) {
          const un = [], em = [];
          for (let i = 0; i < g.length; i++) { if (g[i] === 0) em.push(i); else if (sf(i) < tt) un.push(i); }
          if (!un.length) break;
          let ei = 0;
          for (let q = em.length - 1; q > 0; q--) { const r = (Math.random() * (q + 1)) | 0; const t = em[q]; em[q] = em[r]; em[r] = t; }
          for (const i of un) { if (ei >= em.length) break; const d = em[ei++]; g[d] = g[i]; g[i] = 0; em.push(i); }
        }
        let seg = 0, occ = 0;
        for (let i = 0; i < g.length; i++) { if (g[i] === 0) continue; occ++; seg += sf(i); }
        out.push({ T: tt, seg: occ ? seg / occ : 0 });
      }
      return out;
    }

    function drawPlot() {
      const w = plot.width, hh = plot.height, m = 26;
      pctx.fillStyle = '#12100c'; pctx.fillRect(0, 0, w, hh);
      const X = (t) => m + t / 0.85 * (w - m - 8);
      const Y = (s) => hh - m - s * (hh - m - 8);
      pctx.strokeStyle = '#4a4436'; pctx.lineWidth = 1;
      pctx.beginPath(); pctx.moveTo(m, Y(0)); pctx.lineTo(w - 8, Y(0)); pctx.moveTo(m, Y(0)); pctx.lineTo(m, Y(1)); pctx.stroke();
      pctx.fillStyle = '#f2ede0'; pctx.font = '10px Verdana, sans-serif';
      pctx.fillText('segregation', 2, 12); pctx.fillText('preference T', w - 78, hh - 8);
      /* mixed baseline ~0.5 */
      pctx.strokeStyle = 'rgba(0,166,180,.6)'; pctx.setLineDash([3, 3]);
      pctx.beginPath(); pctx.moveTo(m, Y(0.5)); pctx.lineTo(w - 8, Y(0.5)); pctx.stroke(); pctx.setLineDash([]);
      pctx.fillStyle = '#00a6b4'; pctx.fillText('well-mixed 50%', m + 4, Y(0.5) - 3);
      if (ref.length) {
        pctx.strokeStyle = '#ffcb1f'; pctx.lineWidth = 2; pctx.beginPath();
        ref.forEach((s, i) => { const x = X(s.T), y = Y(s.seg); i ? pctx.lineTo(x, y) : pctx.moveTo(x, y); });
        pctx.stroke();
      }
      for (const s of samples) { pctx.fillStyle = '#f2ede0'; pctx.beginPath(); pctx.arc(X(s.T), Y(s.seg), 3, 0, 7); pctx.fill(); }
      pctx.fillStyle = '#fffdf3'; pctx.beginPath(); pctx.moveTo(X(T), Y(0) + 2); pctx.lineTo(X(T) - 4, Y(0) + 9); pctx.lineTo(X(T) + 4, Y(0) + 9); pctx.fill();
    }

    function draw() {
      ctx.fillStyle = '#141019'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < grid.length; i++) {
        const v = grid[i];
        if (v === EMPTY) continue;
        ctx.fillStyle = v === A ? '#00a6b4' : '#e8402a';
        ctx.fillRect((i % L) * CELL, ((i / L) | 0) * CELL, CELL + 1, CELL + 1);
      }
      drawPlot();
    }

    window.__schelling = {
      reset(opts) { if (opts && opts.T != null) T = opts.T; if (opts && opts.empty != null) emptyFrac = opts.empty; fill(); },
      step() { return { moved: step() }; },
      settle(maxRounds) { let r = 0; while (r++ < (maxRounds || 200)) { if (step() === 0) break; } return stats(); },
      stats() { return stats(); },
      setRunning(v) { running = !!v; }
    };
    bagg.add(() => { if (window.__schelling) delete window.__schelling; });

    fill();
    const rt = setTimeout(() => { ref = measureReference(); }, 60);   // defer the heavy sweep so the field paints first
    bagg.add(() => clearTimeout(rt));
    bagg.add(Engine.loop(() => {
      if (running) {
        const moved = step();
        if (moved === 0) {
          running = false; runBtn.textContent = 'Run';
          const s = stats();
          samples.push({ T: T, seg: s.seg });
          api.submit(Math.round(s.seg * 100));
          api.sfx.good();
          api.status('Settled after ' + rounds + ' rounds at ' + Math.round(s.seg * 100) + '% same-team neighbours. Slide the preference and Run again to trace the curve.');
        }
      }
      syncPills();
      draw();
    }));

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'schelling',
    title: 'Seating Chart',
    emoji: 'schelling',
    cat: 'sim',
    order: 7,
    blurb: 'Two teams on a floor of desks, each person wanting some fraction of same-team neighbors. Even a mild preference sorts a mixed floor into hard blocks. A famous, uncomfortable little model.',
    scoreLabel: 'Peak segregation',
    tags: ['schelling', 'segregation', 'phase-transition', 'emergence'],
    how: [
      'Teal and red are the two teams; dark squares are empty desks. A person is content when at least a fraction T of their occupied neighbors share their team.',
      'Set the preference T with the slider, then Run. Discontented people move to a random empty desk; content people stay.',
      'The panel plots settled segregation against preference, measured live, next to the 50% you would get from pure chance.',
      'Even a preference around a third drives segregation well past 50%. Nobody wanted a sorted floor and it sorts anyway.',
      'Push it past about 0.75 and it never settles: too fussy to ever be happy, so the floor stays churned and segregation falls.'
    ],
    mount
  });
})();
