/* Gridlock. Twelve intersections, one rush hour, one very stressed player. */
(function () {
  'use strict';
  const { h, clamp, rand, randInt, pick } = Engine;

  const W = 960, H = 560;
  const ROWS = 3, COLS = 4;
  const X0 = 150, DX = 220;
  const Y0 = 120, DY = 170;
  const OFF = 70;                 // how far off-canvas roads run
  const LANE = 9;                 // lane offset from road centre
  const ROAD = 38;                // road width
  const HALF_INT = 24;            // half intersection, for stop lines
  const CAR_L = 21, CAR_W = 11;
  const VMAX = 92;                // px/s
  const ACC = 140, DEC = 320;
  const FOLLOW = 30;              // desired bumper gap

  const COLORS = ['#ff5c8f', '#38e1ff', '#9dff5c', '#ffc043', '#c08cff', '#ff8f4d', '#59f0d0', '#f0f4ff'];

  const nodeX = (c) => X0 + c * DX;
  const nodeY = (r) => Y0 + r * DY;

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;
    const dm = api.dm;

    const pDelivered = api.pill('Through: 0');
    const pWave = api.pill('Wave 1');
    const pJam = api.pill('Jammed: 0');
    const meterWrap = h('div', { class: 'panel', style: { width: 'min(560px,100%)' } },
      h('h4', null, 'Commuter rage'),
      h('div', { class: 'meter' }, h('i', { style: { width: '0%' } })));
    root.appendChild(meterWrap);
    const meter = meterWrap.querySelector('i');

    let lights, cars, delivered, rage, wave, waveT, spawnT, over, elapsed, autoMode, prefill;

    function reset() {
      lights = [];
      for (let r = 0; r < ROWS; r++) {
        lights.push([]);
        for (let c = 0; c < COLS; c++) {
          lights[r].push({ phase: (r + c) % 2 ? 'NS' : 'EW', t: rand(0, 6), red: 0, pending: null, flash: 0 });
        }
      }
      cars = [];
      delivered = 0; rage = 0; wave = 1; waveT = 0; spawnT = 0.2; elapsed = 0;
      over = false; autoMode = true;

      /* run the sim forward a little so you arrive to a city already in motion */
      prefill = true;
      for (let i = 0; i < 420; i++) update(1 / 30);
      prefill = false;
      delivered = 0; rage = 0; wave = 1; waveT = 0; elapsed = 0;

      api.status('Click any intersection to flip its lights. Green light = that direction goes.');
      banner.style.display = 'none';
      sync();
    }

    /* ---------- route building ---------- */
    function buildPath() {
      const sides = ['W', 'E', 'N', 'S'];
      const inSide = pick(sides);
      let outSide = pick(sides.filter((s) => s !== inSide));

      let sr, sc, er, ec;
      if (inSide === 'W') { sr = randInt(0, ROWS - 1); sc = 0; }
      else if (inSide === 'E') { sr = randInt(0, ROWS - 1); sc = COLS - 1; }
      else if (inSide === 'N') { sr = 0; sc = randInt(0, COLS - 1); }
      else { sr = ROWS - 1; sc = randInt(0, COLS - 1); }

      if (outSide === 'W') { er = randInt(0, ROWS - 1); ec = 0; }
      else if (outSide === 'E') { er = randInt(0, ROWS - 1); ec = COLS - 1; }
      else if (outSide === 'N') { er = 0; ec = randInt(0, COLS - 1); }
      else { er = ROWS - 1; ec = randInt(0, COLS - 1); }

      const horizIn = inSide === 'W' || inSide === 'E';
      const horizOut = outSide === 'W' || outSide === 'E';
      const nodes = [];
      const push = (r, c) => {
        const last = nodes[nodes.length - 1];
        if (!last || last[0] !== r || last[1] !== c) nodes.push([r, c]);
      };
      const runH = (r, from, to) => { const st = to > from ? 1 : -1; for (let c = from; ; c += st) { push(r, c); if (c === to) break; } };
      const runV = (c, from, to) => { const st = to > from ? 1 : -1; for (let r = from; ; r += st) { push(r, c); if (r === to) break; } };

      if (horizIn && horizOut) {
        const mid = randInt(0, COLS - 1);
        runH(sr, sc, mid); runV(mid, sr, er); runH(er, mid, ec);
      } else if (horizIn && !horizOut) {
        runH(sr, sc, ec); runV(ec, sr, er);
      } else if (!horizIn && !horizOut) {
        const mid = randInt(0, ROWS - 1);
        runV(sc, sr, mid); runH(mid, sc, ec); runV(ec, mid, er);
      } else {
        runV(sc, sr, er); runH(er, sc, ec);
      }

      const pts = nodes.map(([r, c]) => ({ x: nodeX(c), y: nodeY(r), r, c }));
      const first = pts[0], last = pts[pts.length - 1];
      const entry = inSide === 'W' ? { x: -OFF, y: first.y } : inSide === 'E' ? { x: W + OFF, y: first.y }
        : inSide === 'N' ? { x: first.x, y: -OFF } : { x: first.x, y: H + OFF };
      const exit = outSide === 'W' ? { x: -OFF, y: last.y } : outSide === 'E' ? { x: W + OFF, y: last.y }
        : outSide === 'N' ? { x: last.x, y: -OFF } : { x: last.x, y: H + OFF };

      const raw = [entry].concat(pts, [exit]);

      /* drop zero-length segments (can happen when entry and first node coincide) */
      const clean = [raw[0]];
      for (let i = 1; i < raw.length; i++) {
        const p = raw[i], q = clean[clean.length - 1];
        if (Math.abs(p.x - q.x) < 0.5 && Math.abs(p.y - q.y) < 0.5) continue;
        clean.push(p);
      }
      if (clean.length < 2) return null;

      /* lane-offset the polyline so the whole route stays continuous */
      const dirs = [];
      for (let i = 0; i < clean.length - 1; i++) {
        const dx = clean[i + 1].x - clean[i].x, dy = clean[i + 1].y - clean[i].y;
        const len = Math.hypot(dx, dy);
        dirs.push({ x: dx / len, y: dy / len });
      }
      const nrm = (d) => ({ x: -d.y, y: d.x });   // right-hand side, screen coords
      const out = [];
      for (let i = 0; i < clean.length; i++) {
        const p = clean[i];
        let ox, oy;
        if (i === 0) { const n = nrm(dirs[0]); ox = n.x * LANE; oy = n.y * LANE; }
        else if (i === clean.length - 1) { const n = nrm(dirs[dirs.length - 1]); ox = n.x * LANE; oy = n.y * LANE; }
        else {
          const a = dirs[i - 1], b = dirs[i];
          const na = nrm(a), nb = nrm(b);
          const straight = Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
          ox = na.x * LANE + (straight ? 0 : nb.x * LANE);
          oy = na.y * LANE + (straight ? 0 : nb.y * LANE);
        }
        out.push({ x: p.x + ox, y: p.y + oy, r: p.r, c: p.c, dirIn: i > 0 ? dirs[i - 1] : null });
      }

      const cum = [0];
      for (let i = 0; i < out.length - 1; i++) {
        cum.push(cum[i] + Math.hypot(out[i + 1].x - out[i].x, out[i + 1].y - out[i].y));
      }

      const stops = [];
      for (let i = 1; i < out.length - 1; i++) {
        if (out[i].r === undefined) continue;
        const d = out[i].dirIn;
        stops.push({ s: cum[i] - HALF_INT, r: out[i].r, c: out[i].c, axis: Math.abs(d.x) > 0.5 ? 'EW' : 'NS' });
      }
      return { pts: out, cum, total: cum[cum.length - 1], stops, dir0: dirs[0] };
    }

    function spawn() {
      if (cars.length > 78) return;
      const p = buildPath();
      if (!p) return;
      const head = p.pts[0];
      for (const c of cars) {
        if (Math.hypot(c.x - head.x, c.y - head.y) < 46) return;   // don't stack on the on-ramp
      }
      cars.push({
        path: p, s: 0, seg: 0, v: VMAX * 0.6, wait: 0, stopIdx: 0,
        x: head.x, y: head.y, dx: p.dir0.x, dy: p.dir0.y,
        color: pick(COLORS), age: 0
      });
    }

    function place(car) {
      const { cum, pts } = car.path;
      let i = car.seg;
      while (i < pts.length - 2 && car.s > cum[i + 1]) i++;
      while (i > 0 && car.s < cum[i]) i--;
      car.seg = i;
      const segLen = cum[i + 1] - cum[i] || 1;
      const t = clamp((car.s - cum[i]) / segLen, 0, 1);
      const a = pts[i], b = pts[i + 1];
      car.x = a.x + (b.x - a.x) * t;
      car.y = a.y + (b.y - a.y) * t;
      car.dx = (b.x - a.x) / segLen;
      car.dy = (b.y - a.y) / segLen;
    }

    const speedFor = (gap) => clamp(gap * 2.1 - 8, 0, VMAX);

    function isGreen(r, c, axis) {
      const L = lights[r][c];
      return L.red <= 0 && L.phase === axis;
    }

    /* ---------- update ---------- */
    function update(dt) {
      if (over) return;
      elapsed += dt;
      waveT += dt;
      if (waveT > 34) { waveT = 0; wave++; api.sfx.blip(880); }

      /* lights */
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const L = lights[r][c];
          L.flash = Math.max(0, L.flash - dt);
          if (L.red > 0) {
            L.red -= dt;
            if (L.red <= 0 && L.pending) { L.phase = L.pending; L.pending = null; L.t = 0; }
          } else {
            L.t += dt;
            if (autoMode && L.t > 11 / dm) switchLight(r, c);
          }
        }
      }

      /* spawn */
      spawnT -= dt;
      if (spawnT <= 0) {
        spawn();
        spawnT = Math.max(0.38, 1.35 - wave * 0.09) * rand(0.7, 1.4) / dm;
      }

      for (const car of cars) place(car);

      /* decide speeds */
      let jammed = 0;
      for (const a of cars) {
        let allowed = VMAX;

        /* car ahead (this also stops cars from driving into a blocked box) */
        for (const b of cars) {
          if (b === a) continue;
          const vx = b.x - a.x, vy = b.y - a.y;
          const fwd = vx * a.dx + vy * a.dy;
          if (fwd <= 0 || fwd > 110) continue;
          const lat = Math.abs(vx * -a.dy + vy * a.dx);
          if (lat > 12) continue;
          allowed = Math.min(allowed, speedFor(fwd - FOLLOW));
        }

        /* red light ahead */
        while (a.stopIdx < a.path.stops.length && a.s > a.path.stops[a.stopIdx].s + 6) a.stopIdx++;
        const st = a.path.stops[a.stopIdx];
        if (st) {
          const d = st.s - a.s;
          if (d >= 0 && d < 130 && !isGreen(st.r, st.c, st.axis)) allowed = Math.min(allowed, speedFor(d));
        }

        a.v += clamp(allowed - a.v, -DEC * dt, ACC * dt);
        a.v = clamp(a.v, 0, VMAX);
        a.s += a.v * dt;
        a.age += dt;
        if (a.v < 8) { a.wait += dt; if (a.wait > 3) jammed++; }
        else a.wait = Math.max(0, a.wait - dt * 2.5);
      }

      for (let i = cars.length - 1; i >= 0; i--) {
        if (cars[i].s >= cars[i].path.total) { cars.splice(i, 1); delivered++; }
      }

      rage = clamp(rage + dt * (jammed * 0.85 * dm - 2.6 / dm), 0, 100);
      if (rage >= 100 && !prefill) endGame();

      pJam.textContent = 'Jammed: ' + jammed;
      pDelivered.textContent = 'Through: ' + delivered;
      pWave.textContent = 'Wave ' + wave;
      meter.style.width = rage.toFixed(0) + '%';
      meterWrap.classList.toggle('warn', rage > 60);
    }

    function switchLight(r, c) {
      const L = lights[r][c];
      const want = L.phase === 'NS' ? 'EW' : 'NS';
      if (L.pending === want) return;
      L.pending = want;
      L.red = 0.85;
      L.flash = 0.35;
    }

    function endGame() {
      over = true;
      const res = api.submit(delivered);
      api.sfx.bad();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Total gridlock.'),
        h('p', null, delivered + ' commuters made it through in ' + Engine.fmtTime(elapsed) + '.' +
          (res.isRecord ? ' New personal best!' : res.isFirst ? '' : ' Best: ' + res.best + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Try again'));
    }

    /* ---------- render ---------- */
    function draw() {
      ctx.fillStyle = '#0c1220';
      ctx.fillRect(0, 0, W, H);

      /* blocks between the roads */
      ctx.fillStyle = '#0f1729';
      for (let r = -1; r < ROWS; r++) {
        for (let c = -1; c < COLS; c++) {
          const x = c < 0 ? -OFF : nodeX(c) + ROAD / 2;
          const y = r < 0 ? -OFF : nodeY(r) + ROAD / 2;
          const x2 = c + 1 >= COLS ? W + OFF : nodeX(c + 1) - ROAD / 2;
          const y2 = r + 1 >= ROWS ? H + OFF : nodeY(r + 1) - ROAD / 2;
          Engine.roundRect(ctx, x + 6, y + 6, x2 - x - 12, y2 - y - 12, 8);
          ctx.fill();
        }
      }

      /* asphalt */
      ctx.fillStyle = '#28324a';
      for (let r = 0; r < ROWS; r++) ctx.fillRect(-OFF, nodeY(r) - ROAD / 2, W + OFF * 2, ROAD);
      for (let c = 0; c < COLS; c++) ctx.fillRect(nodeX(c) - ROAD / 2, -OFF, ROAD, H + OFF * 2);

      /* lane dashes */
      ctx.strokeStyle = '#59648a';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([11, 13]);
      ctx.beginPath();
      for (let r = 0; r < ROWS; r++) { ctx.moveTo(-OFF, nodeY(r)); ctx.lineTo(W + OFF, nodeY(r)); }
      for (let c = 0; c < COLS; c++) { ctx.moveTo(nodeX(c), -OFF); ctx.lineTo(nodeX(c), H + OFF); }
      ctx.stroke();
      ctx.setLineDash([]);

      /* intersections + signals */
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = nodeX(c), y = nodeY(r), L = lights[r][c];
          ctx.fillStyle = '#323d59';
          ctx.fillRect(x - ROAD / 2, y - ROAD / 2, ROAD, ROAD);
          if (L.flash > 0) {
            ctx.strokeStyle = 'rgba(56,225,255,' + (L.flash / 0.35 * 0.9).toFixed(2) + ')';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - ROAD / 2 - 3, y - ROAD / 2 - 3, ROAD + 6, ROAD + 6);
          }
          const ns = L.red > 0 ? '#ffb020' : (L.phase === 'NS' ? '#4ade5e' : '#ff4d5e');
          const ew = L.red > 0 ? '#ffb020' : (L.phase === 'EW' ? '#4ade5e' : '#ff4d5e');
          const d = ROAD / 2 + 5;
          const dot = (px, py, col) => {
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(px, py, 3.4, 0, 7);
            ctx.fill();
          };
          dot(x - 4, y - d, ns); dot(x + 4, y + d, ns);
          dot(x - d, y + 4, ew); dot(x + d, y - 4, ew);
        }
      }

      /* cars */
      for (const car of cars) {
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(Math.atan2(car.dy, car.dx));
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        Engine.roundRect(ctx, -CAR_L / 2 + 1.5, -CAR_W / 2 + 2, CAR_L, CAR_W, 3);
        ctx.fill();
        ctx.fillStyle = car.color;
        Engine.roundRect(ctx, -CAR_L / 2, -CAR_W / 2, CAR_L, CAR_W, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(10,14,24,.55)';
        Engine.roundRect(ctx, -1, -CAR_W / 2 + 1.5, 7, CAR_W - 3, 2);
        ctx.fill();
        if (car.v < 6) {
          ctx.fillStyle = '#ff3b3b';
          ctx.fillRect(-CAR_L / 2 - 1, -CAR_W / 2 + 1, 2, CAR_W - 2);
        }
        ctx.restore();
        if (car.wait > 4) {
          const a = clamp((car.wait - 4) / 5, 0, 1);
          ctx.fillStyle = 'rgba(255,80,80,' + (0.35 + a * 0.55).toFixed(2) + ')';
          ctx.font = 'bold 13px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText('!', car.x, car.y - 11);
        }
      }

      if (Engine.paused && !over) {
        ctx.fillStyle = 'rgba(8,11,20,.62)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#e8ecf7';
        ctx.font = 'bold 24px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('paused', W / 2, H / 2);
      }
    }

    /* the pause overlay needs to render while the sim is frozen */
    let rafId = 0;
    (function paintLoop() {
      rafId = requestAnimationFrame(paintLoop);
      if (Engine.paused) draw();
    })();
    bagg.add(() => cancelAnimationFrame(rafId));

    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);

    bagg.listen(cv.el, 'pointerdown', (e) => {
      if (over) return;
      const p = cv.pos(e);
      let bestD = 1e9, br = -1, bc = -1;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const d = Math.hypot(p.x - nodeX(c), p.y - nodeY(r));
          if (d < bestD) { bestD = d; br = r; bc = c; }
        }
      }
      if (bestD < 62) { switchLight(br, bc); api.sfx.click(); }
    });

    api.button('Restart', reset);
    const autoBtn = api.button('Auto-cycle: on', () => {
      autoMode = !autoMode;
      autoBtn.textContent = 'Auto-cycle: ' + (autoMode ? 'on' : 'off');
      autoBtn.classList.toggle('on', autoMode);
    }, 'on');
    api.button('All lights E–W', () => {
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (lights[r][c].phase !== 'EW') switchLight(r, c);
    });
    api.button('All lights N–S', () => {
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (lights[r][c].phase !== 'NS') switchLight(r, c);
    });

    function sync() { meter.style.width = '0%'; }

    reset();
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'gridlock',
    title: 'Gridlock',
    emoji: '🚦',
    cat: 'sim',
    order: 1,
    blurb: 'Twelve intersections. One rush hour. You are the lights. Nobody voted for you and everybody is going to blame you.',
    scoreLabel: 'Cars through',
    link: {
      url: 'https://claude.ai/code/artifact/245d9555-fb6f-4685-b698-42a8f82c10bd',
      label: 'See why real jams start'
    },
    tags: ['traffic', 'jam', 'city', 'lights'],
    how: [
      'Click an intersection to flip which way gets the green.',
      'Every flip runs a short all-red first, so think one beat ahead or you will just move the jam somewhere else.',
      'Auto-cycle flips lights on a timer. Switch it off when you want total control and total responsibility.',
      'Cars stuck in traffic fill the commuter rage bar. Fill it and the city turns on you.',
      'It gets busier every 34 seconds. Score is cars that made it off the map.'
    ],
    mount
  });
})();
