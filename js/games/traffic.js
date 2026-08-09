/* Rush Hour — the Nagel–Schreckenberg traffic model.
 *
 * A single-lane ring road of cells. Each car has an integer speed 0..vmax and
 * every tick the whole road updates at once by four rules (Nagel & Schreckenberg
 * 1992): accelerate (v -> min(v+1, vmax)); brake to the gap so you never hit the
 * car ahead (v -> min(v, gap)); dawdle — with probability p, v -> max(v-1, 0);
 * then move v cells. That single random brake is the whole story: below a
 * critical density the road runs at free flow, but past it a lone dawdle seeds a
 * jam that propagates backward as a wave while every car keeps obeying the rules.
 * Flux (cars past a point per tick) rises with density, peaks at the critical
 * density, then falls into the congested branch — the fundamental diagram of
 * traffic. The panel measures that diagram live, and the window.__traffic seam
 * lets a headless sweep find the peak (tools/sweep-traffic.mjs).
 */
(function () {
  'use strict';
  const { h, clamp } = Engine;
  const L = 196;                       // ring length in cells
  const HST = 260;                     // rows of space-time history
  const W = 560, H = 560;

  function mount(root, api) {
    const bagg = Engine.bag();
    let vmax = 5, pDawdle = 0.25, density = 0.14;
    let cars = [];                       // {x, v} in cyclic order
    let running = true;
    let flow = 0, meanV = 0, jam = 0;
    let peakFlow = 0;
    let ref = [];

    const cv = Engine.canvas(root, W, H, { maxHeight: '58vh' });
    const ctx = cv.ctx;
    const off = document.createElement('canvas');
    off.width = L; off.height = HST;
    const octx = off.getContext('2d');
    const stImg = octx.createImageData(L, HST);
    const stBuf = new Uint32Array(stImg.data.buffer);
    stBuf.fill(0xff100c08 >>> 0);        // dark asphalt

    const plot = h('canvas', { class: 'fire-plot', width: 520, height: 200 });
    root.appendChild(h('div', { class: 'fire-panel' }, plot));
    const pctx = plot.getContext('2d');

    const pDensity = api.pill('Density: 0.14');
    const pFlow = api.pill('Flow: 0.00');
    const pSpeed = api.pill('Mean v: 0.0');
    const pJam = api.pill('Stopped: 0%');

    const dSlider = h('input', { type: 'range', min: '0.02', max: '0.6', step: '0.005', value: '0.14', class: 'slider' });
    dSlider.addEventListener('input', () => { density = parseFloat(dSlider.value); reset(); });
    api.toolbar.appendChild(h('label', { class: 'sel-wrap' }, h('span', null, 'density'), dSlider));
    const pSlider = h('input', { type: 'range', min: '0', max: '0.6', step: '0.02', value: '0.25', class: 'slider' });
    pSlider.addEventListener('input', () => { pDawdle = parseFloat(pSlider.value); });
    api.toolbar.appendChild(h('label', { class: 'sel-wrap' }, h('span', null, 'dawdle p'), pSlider));
    api.select('Top speed', [3, 4, 5, 6].map((v) => ({ value: String(v), label: 'v_max ' + v })), '5', (v) => { vmax = +v; reset(); });
    api.button('Reset', reset);

    function reset() {
      const n = Math.max(1, Math.round(density * L));
      /* place n cars at distinct cells, kept in ascending (cyclic) order */
      const occ = new Set();
      while (occ.size < n) occ.add((Math.random() * L) | 0);
      cars = [...occ].sort((a, b) => a - b).map((x) => ({ x, v: (Math.random() * (vmax + 1)) | 0 }));
      peakFlow = 0;
      stBuf.fill(0xff100c08 >>> 0);
      syncPills();
      api.status('Set the density and watch. Below the critical density the road flows; above it, a single random tap of the brakes blossoms into a jam that crawls backwards through the pack.');
    }

    /* one synchronous Nagel–Schreckenberg update of the whole road */
    function step() {
      const n = cars.length;
      if (!n) { flow = 0; meanV = 0; jam = 0; return; }
      /* gaps from current positions (no overtaking: v<=gap keeps cyclic order) */
      for (let i = 0; i < n; i++) {
        const next = cars[(i + 1) % n];
        let gap = next.x - cars[i].x - 1;
        if (gap < 0) gap += L;           // wrap for the leading car
        let v = cars[i].v;
        if (v < vmax) v++;               // 1. accelerate
        if (v > gap) v = gap;            // 2. brake to the gap
        if (v > 0 && Math.random() < pDawdle) v--;  // 3. dawdle
        cars[i].v = v;
      }
      let sv = 0, stopped = 0;
      for (let i = 0; i < n; i++) {
        cars[i].x = (cars[i].x + cars[i].v) % L;   // 4. move
        sv += cars[i].v;
        if (cars[i].v === 0) stopped++;
      }
      meanV = sv / n;
      flow = sv / L;                     // flux = (1/L) Σ v  (cars per cell per tick)
      jam = stopped / n;
      if (flow > peakFlow) { peakFlow = flow; api.submit(Math.round(peakFlow * 1000)); }
    }

    function syncPills() {
      pDensity.textContent = 'Density: ' + density.toFixed(3);
      pFlow.textContent = 'Flow: ' + flow.toFixed(3);
      pSpeed.textContent = 'Mean v: ' + meanV.toFixed(1);
      pJam.textContent = 'Stopped: ' + Math.round(jam * 100) + '%';
      pJam.className = 'pill ' + (jam > 0.25 ? 'warn' : '');
      pFlow.className = 'pill ' + (flow > 0.28 ? 'good' : '');
    }

    /* colour a car by speed: red (stopped) -> amber -> green (free) */
    function carColor(v) {
      const f = clamp(v / vmax, 0, 1);
      const r = Math.round(232 - 150 * f), g = Math.round(70 + 150 * f), b = 42;
      return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;   // ABGR
    }

    function pushRow() {
      stBuf.copyWithin(L, 0);            // scroll history down by one row
      const base = 0;
      for (let x = 0; x < L; x++) stBuf[base + x] = 0xff100c08 >>> 0;  // fresh asphalt row
      for (const car of cars) stBuf[base + car.x] = carColor(car.v);
    }

    function drawPlot() {
      const w = plot.width, hh = plot.height, m = 26;
      pctx.clearRect(0, 0, w, hh);
      pctx.fillStyle = '#12100c'; pctx.fillRect(0, 0, w, hh);
      const maxQ = 0.6;
      const X = (d) => m + d / 0.6 * (w - m - 8);
      const Y = (q) => hh - m - q / maxQ * (hh - m - 8);
      pctx.strokeStyle = '#4a4436'; pctx.lineWidth = 1;
      pctx.beginPath(); pctx.moveTo(m, Y(0)); pctx.lineTo(w - 8, Y(0)); pctx.moveTo(m, Y(0)); pctx.lineTo(m, Y(maxQ)); pctx.stroke();
      pctx.fillStyle = '#8a8064'; pctx.font = '10px Verdana, sans-serif';
      pctx.fillText('flow', 2, 12); pctx.fillText('density', w - 54, hh - 8);
      /* measured fundamental diagram */
      if (ref.length) {
        let best = ref[0];
        pctx.strokeStyle = '#00a6b4'; pctx.lineWidth = 2; pctx.beginPath();
        ref.forEach((s, i) => { const x = X(s.d), y = Y(s.q); i ? pctx.lineTo(x, y) : pctx.moveTo(x, y); if (s.q > best.q) best = s; });
        pctx.stroke();
        /* critical density: the peak of the diagram */
        pctx.strokeStyle = 'rgba(232,64,42,.8)'; pctx.setLineDash([4, 3]);
        pctx.beginPath(); pctx.moveTo(X(best.d), Y(0)); pctx.lineTo(X(best.d), Y(maxQ)); pctx.stroke();
        pctx.setLineDash([]);
        pctx.fillStyle = '#e8402a'; pctx.fillText('peak ~' + best.d.toFixed(2), X(best.d) + 3, Y(maxQ) + 10);
      }
      /* live sample */
      pctx.fillStyle = '#ffcb1f';
      pctx.beginPath(); pctx.arc(X(density), Y(flow), 4, 0, 7); pctx.fill();
      pctx.fillStyle = '#fffdf3';
      pctx.beginPath(); pctx.moveTo(X(density), Y(0) + 2); pctx.lineTo(X(density) - 4, Y(0) + 9); pctx.lineTo(X(density) + 4, Y(0) + 9); pctx.fill();
    }

    function draw() {
      octx.putImageData(stImg, 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, L, HST, 0, 0, W, H);
      ctx.restore();
      /* label the live road at the top */
      ctx.fillStyle = 'rgba(20,16,12,.7)'; ctx.fillRect(0, 0, 96, 18);
      ctx.fillStyle = '#ded6c2'; ctx.font = '11px Verdana, sans-serif'; ctx.textBaseline = 'middle';
      ctx.fillText('now', 8, 9); ctx.fillText('▼ time', 44, 9);
      ctx.textBaseline = 'alphabetic';
      drawPlot();
    }

    /* a real sweep of the model to draw the fundamental diagram */
    function measureReference() {
      const out = [];
      for (let di = 1; di <= 30; di++) {
        const d = 0.6 * di / 30;
        const n = Math.max(1, Math.round(d * L));
        const occ = new Set();
        while (occ.size < n) occ.add((Math.random() * L) | 0);
        let cs = [...occ].sort((a, b) => a - b).map((x) => ({ x, v: 0 }));
        const doStep = () => {
          const m = cs.length;
          for (let i = 0; i < m; i++) {
            const nx = cs[(i + 1) % m];
            let gap = nx.x - cs[i].x - 1; if (gap < 0) gap += L;
            let v = cs[i].v; if (v < vmax) v++; if (v > gap) v = gap;
            if (v > 0 && Math.random() < pDawdle) v--; cs[i].v = v;
          }
          let sv = 0;
          for (let i = 0; i < m; i++) { cs[i].x = (cs[i].x + cs[i].v) % L; sv += cs[i].v; }
          return sv / L;
        };
        for (let w = 0; w < 120; w++) doStep();        // warm up
        let acc = 0;
        for (let w = 0; w < 120; w++) acc += doStep();
        out.push({ d, q: acc / 120 });
      }
      return out;
    }

    /* ---- test seam: lets a headless sweep find the peak of the diagram ---- */
    window.__traffic = {
      reset(opts) {
        if (opts) {
          if (opts.density != null) { density = opts.density; dSlider.value = String(density); }
          if (opts.p != null) { pDawdle = opts.p; pSlider.value = String(pDawdle); }
          if (opts.vmax != null) vmax = opts.vmax;
        }
        reset();
      },
      step(n) { for (let k = 0; k < (n || 1); k++) step(); },
      stats() { return { density: cars.length / L, flow: flow, meanV: meanV, jam: jam, cars: cars.length }; },
      setRunning(v) { running = !!v; }
    };
    bagg.add(() => { if (window.__traffic) delete window.__traffic; });

    reset();
    const refTimer = setTimeout(() => { ref = measureReference(); }, 60);
    bagg.add(() => clearTimeout(refTimer));
    bagg.add(Engine.loop(() => {
      if (running) { step(); pushRow(); }
      syncPills();
      draw();
    }));

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'traffic',
    title: 'Rush Hour',
    emoji: 'traffic',
    cat: 'sim',
    order: 9,
    blurb: 'A one-lane ring road where every driver follows the same four rules and jams still appear out of nowhere. Push the density up and watch a phantom traffic wave crawl backwards through the pack — then read the exact point where the road carries the most cars.',
    scoreLabel: 'Peak flow',
    tags: ['nagel-schreckenberg', 'phase-transition', 'traffic', 'emergence'],
    how: [
      'Cars sit on a single-lane loop. Each has a speed from 0 to v_max, and the whole road updates together every tick.',
      'The four rules, applied to every car at once: speed up by one; slow down so you never hit the car ahead; then with probability p tap the brakes for no reason; then move. That one random tap is the only noise in the system.',
      'At low density everyone reaches v_max and the road is empty stripes of fast traffic. Raise the density slider past the critical point and a single dawdle triggers a jam that spreads backward — a wave of stopped cars moving the wrong way while every driver keeps obeying the rules.',
      'The main view is a space-time diagram: the top line is the road right now, and each row below is one tick into the past. Jams show up as dark bands leaning backward through time.',
      'The side panel is the fundamental diagram — flow against density — measured live from the model. Flow climbs, peaks at the critical density (the dashed line), then collapses into gridlock. Your current state is the yellow dot.',
      'Your score is the highest flow you can sustain, which means parking the density right at that peak. More dawdling (higher p) makes the jams worse and the peak lower.'
    ],
    mount
  });
})();
