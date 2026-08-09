/* Company Car — a pseudo-3D arcade racer. A proper curving, cresting road drawn
 * the OutRun way (projected road segments), traffic to weave through, twenty
 * procedurally-built stages you can jump between freely, and a clock. Keyboard
 * or on-screen buttons. */
(function () {
  'use strict';
  const { h, clamp } = Engine;
  const W = 640, H = 400;

  const SEG = 200;                 // segment length (world units)
  const RUMBLE = 3;               // segments per rumble stripe
  const ROADW = 2000;             // half road width
  const LANES = 3;
  const DRAW = 240;               // segments drawn ahead
  const CAMH = 1000;              // camera height
  const FOV = 100;
  const CAMD = 1 / Math.tan((FOV / 2) * Math.PI / 180);
  const MAXSPD = SEG * 60;        // top speed (units/sec) — one segment per frame at 60fps * 60
  const ACCEL = MAXSPD / 5;
  const BRAKE = -MAXSPD / 2.5;
  const DECEL = -MAXSPD / 6;
  const OFFDECEL = -MAXSPD / 2;
  const CENTRI = 0.32;
  const LEVELS = 20;

  const COL = {
    sky: ['#4a90d9', '#7ec0ee'],
    tree: '#1c5a2a',
    grassL: '#3a9d3a', grassD: '#329033',
    roadL: '#6b6b6b', roadD: '#666666',
    rumbleL: '#e8402a', rumbleD: '#f4f4f4',
    lane: '#f4f4f4'
  };

  function ease(a, b, p) { return a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5); }
  function easeIn(a, b, p) { return a + (b - a) * p * p; }
  function easeOut(a, b, p) { return a + (b - a) * (1 - (1 - p) * (1 - p)); }

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H, { maxHeight: '62vh' });
    const ctx = cv.ctx;
    const keys = Engine.keys(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 's', 'a', 'd', 'W', 'S', 'A', 'D', ' ']);

    let segs, trackLen, cars, level, pos, playerX, speed, t, over, won, started;
    level = clamp(api.load('level', 1), 1, LEVELS);

    const pLevel = api.pill('Stage 1');
    const pSpeed = api.pill('0 mph');
    const pTime = api.pill('0.0s');
    const pBest = api.pill('');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);

    api.select('Stage', Array.from({ length: LEVELS }, (_, i) => ({ value: String(i + 1), label: 'Stage ' + (i + 1) })), String(level), (v) => { level = +v; api.save('level', level); build(); });
    api.button('Restart stage', build);

    /* touch controls */
    const pad = h('div', { class: 'racer-pad' });
    bagg.add(() => keys.dispose());
    const mk = (label, code) => { const b = h('button', { class: 'racer-btn', type: 'button' }, label); const set = (v) => { keys.state[code] = v; }; bagg.listen(b, 'pointerdown', (e) => { e.preventDefault(); set(true); }); bagg.listen(b, 'pointerup', () => set(false)); bagg.listen(b, 'pointerleave', () => set(false)); bagg.listen(b, 'pointercancel', () => set(false)); return b; };
    pad.append(mk('◀', 'ArrowLeft'), mk('GAS', 'ArrowUp'), mk('BRK', 'ArrowDown'), mk('▶', 'ArrowRight'));
    root.appendChild(pad);

    /* ---- track builder ---- */
    function lastY() { return segs.length ? segs[segs.length - 1].p2.wy : 0; }
    function addSeg(curve, y) {
      const n = segs.length, y1 = lastY();
      segs.push({
        i: n, curve,
        p1: { wx: 0, wy: y1, wz: n * SEG }, p2: { wx: 0, wy: y, wz: (n + 1) * SEG },
        color: Math.floor(n / RUMBLE) % 2 ? 'd' : 'l', cars: []
      });
    }
    function addRoad(enter, hold, leave, curve, y) {
      const startY = lastY(), endY = startY + y * SEG;
      const total = enter + hold + leave;
      for (let n = 0; n < enter; n++) addSeg(easeIn(0, curve, n / enter), easeInOutY(startY, endY, n / total));
      for (let n = 0; n < hold; n++) addSeg(curve, easeInOutY(startY, endY, (enter + n) / total));
      for (let n = 0; n < leave; n++) addSeg(easeInOut(curve, 0, n / leave), easeInOutY(startY, endY, (enter + hold + n) / total));
    }
    function easeInOut(a, b, p) { return ease(a, b, p); }
    function easeInOutY(a, b, p) { return ease(a, b, p); }

    /* seeded pseudo-random so each stage is fixed but distinct */
    function build() {
      const rng = Engine.rng('racer:' + level);
      segs = []; cars = [];
      const diff = level / LEVELS;
      const sections = 8 + level;
      addRoad(30, 40, 30, 0, 0);                 // start straight
      for (let s = 0; s < sections; s++) {
        const len = [30, 50, 40];
        const curve = (rng() < 0.5 ? -1 : 1) * (2 + rng() * 4) * (0.4 + diff);
        const hill = (rng() - 0.5) * (20 + diff * 60);
        if (rng() < 0.7) addRoad(len[0], len[1] + (rng() * 40 | 0), len[2], curve, hill);
        else addRoad(20, 30, 20, 0, hill);        // straight-ish with a crest
      }
      addRoad(30, 60, 30, 0, 0);                  // finish straight
      trackLen = segs.length * SEG;
      /* traffic: more and denser on later stages */
      const nCars = 8 + level * 3;
      for (let c = 0; c < nCars; c++) {
        const i = 40 + Math.floor(rng() * (segs.length - 80));
        const lane = (rng() * LANES | 0) - 1;   // -1,0,1
        segs[i].cars.push({ x: lane * 0.55, col: ['#ffcb1f', '#e8402a', '#6f3fa8', '#00a6b4'][rng() * 4 | 0], spd: (0.35 + rng() * 0.25) });
      }
      pos = 0; playerX = 0; speed = 0; t = 0; over = false; won = false; started = false;
      banner.style.display = 'none';
      pLevel.textContent = 'Stage ' + level;
      const b = api.load('best:' + level, null);
      pBest.textContent = b == null ? 'no time' : 'best ' + b.toFixed(1) + 's';
      api.status('Stage ' + level + ' of ' + LEVELS + '. Hold gas, steer through the traffic, reach the finish. Arrow keys or the buttons; you can jump to any stage from the menu.');
    }

    function segAt(z) {
      if (!segs || !segs.length) return null;
      let i = Math.floor(z / SEG) % segs.length;
      if (i < 0 || !isFinite(i)) i = 0;
      return segs[i] || segs[0];
    }

    function update(dt) {
      if (over || !segs) return;
      const cur = segAt(pos);
      if (!cur) return;
      const spdPct = speed / MAXSPD;
      const dir = (keys.get('ArrowLeft') || keys.get('a') || keys.get('A')) ? -1 : (keys.get('ArrowRight') || keys.get('d') || keys.get('D')) ? 1 : 0;
      if (dir) started = true;
      playerX += dir * dt * 2.4 * spdPct;
      /* centrifugal push on curves */
      playerX -= dt * spdPct * cur.curve * CENTRI;

      const gas = keys.get('ArrowUp') || keys.get('w') || keys.get('W') || keys.get(' ');
      const brk = keys.get('ArrowDown') || keys.get('s') || keys.get('S');
      if (gas) { speed += ACCEL * dt; started = true; }
      else if (brk) speed += BRAKE * dt;
      else speed += DECEL * dt;
      if ((playerX < -1 || playerX > 1) && speed > MAXSPD / 4) speed += OFFDECEL * dt;   // off-road drag
      speed = clamp(speed, 0, MAXSPD);
      playerX = clamp(playerX, -2.4, 2.4);

      /* traffic collision */
      for (const car of cur.cars) {
        if (speed > 0 && Math.abs(playerX - car.x) < 0.5) { speed = MAXSPD * 0.18; playerX += (playerX > car.x ? 1 : -1) * dt * 2; api.sfx.thud(); }
      }

      pos += speed * dt;
      if (started) t += dt;
      if (pos >= trackLen) return finish();
    }

    function finish() {
      over = true; won = true; speed = 0;
      const prev = api.load('best:' + level, null);
      const rec = prev == null || t < prev;
      if (rec) api.save('best:' + level, +t.toFixed(1));
      const done = api.load('cleared', 0) + 1; api.save('cleared', done); api.submit(done);
      api.sfx.great();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Stage ' + level + ' cleared'),
        h('p', null, 'Time ' + t.toFixed(1) + 's' + (rec ? ' — new best!' : prev != null ? ' (best ' + prev.toFixed(1) + 's)' : '') + '.'),
        h('div', { class: 'racer-endbtns' },
          level < LEVELS ? h('button', { class: 'btn primary', type: 'button', onclick: () => { level++; api.save('level', level); build(); } }, 'Next stage →') : h('span', null, 'You cleared every stage!'),
          h('button', { class: 'btn', type: 'button', onclick: build }, 'Replay')));
    }

    /* ---- rendering ---- */
    function project(p, camX, camY, camZ) {
      p.cx = p.wx - camX; p.cy = p.wy - camY; p.cz = p.wz - camZ;
      p.scale = CAMD / Math.max(1, p.cz);
      p.sx = Math.round(W / 2 + p.scale * p.cx * W / 2);
      p.sy = Math.round(H / 2 - p.scale * p.cy * H / 2);
      p.sw = Math.round(p.scale * ROADW * W / 2);
    }
    function poly(x1, y1, w1, x2, y2, w2, color) {
      ctx.fillStyle = color; ctx.beginPath();
      ctx.moveTo(x1 - w1, y1); ctx.lineTo(x1 + w1, y1); ctx.lineTo(x2 + w2, y2); ctx.lineTo(x2 - w2, y2);
      ctx.closePath(); ctx.fill();
    }

    function draw() {
      /* sky + ground */
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, COL.sky[0]); g.addColorStop(1, COL.sky[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      const base = segAt(pos), basePct = (pos % SEG) / SEG;
      let x = 0, dx = -(base.curve * basePct);
      let maxy = H;
      const camY = CAMH + base.p1.wy;

      for (let n = 0; n < DRAW; n++) {
        const seg = segs[(base.i + n) % segs.length];
        const looped = seg.i < base.i;
        const camZ = pos - (looped ? trackLen : 0);
        project(seg.p1, playerX * ROADW - x, camY, camZ);
        project(seg.p2, playerX * ROADW - x - dx, camY, camZ);
        x += dx; dx += seg.curve;
        if (seg.p1.cz <= CAMD || seg.p2.sy >= seg.p1.sy || seg.p2.sy >= maxy) continue;
        const p1 = seg.p1, p2 = seg.p2, dark = seg.color === 'd';
        /* grass band */
        poly(W / 2, p1.sy, W / 2, W / 2, p2.sy, W / 2, dark ? COL.grassD : COL.grassL);
        /* rumble + road */
        const r1 = p1.sw * 1.18, r2 = p2.sw * 1.18;
        poly(p1.sx, p1.sy, r1, p2.sx, p2.sy, r2, dark ? COL.rumbleD : COL.rumbleL);
        poly(p1.sx, p1.sy, p1.sw, p2.sx, p2.sy, p2.sw, dark ? COL.roadD : COL.roadL);
        /* centre lane dashes */
        if (!dark) {
          const lw1 = p1.sw * 0.03, lw2 = p2.sw * 0.03;
          for (let l = 1; l < LANES; l++) {
            const off = (l / LANES) * 2 - 1;
            poly(p1.sx + p1.sw * off, p1.sy, lw1, p2.sx + p2.sw * off, p2.sy, lw2, COL.lane);
          }
        }
        maxy = p2.sy;
        seg._p1 = { sx: p1.sx, sy: p1.sy, sw: p1.sw };   // stash for sprite pass
      }

      /* traffic sprites, back to front */
      for (let n = DRAW - 1; n >= 0; n--) {
        const seg = segs[(base.i + n) % segs.length];
        if (!seg._p1 || !seg.cars.length) continue;
        for (const car of seg.cars) {
          const sp = seg._p1, cw = sp.sw * 0.9, cx = sp.sx + sp.sw * car.x, cy = sp.sy;
          if (cw < 2) continue;
          ctx.fillStyle = car.col;
          ctx.fillRect(cx - cw * 0.28, cy - cw * 0.4, cw * 0.56, cw * 0.34);
          ctx.fillStyle = '#111';
          ctx.fillRect(cx - cw * 0.28, cy - cw * 0.08, cw * 0.56, cw * 0.08);
        }
        seg._p1 = null;
      }

      /* player car */
      const pcW = 120, pcH = 60, pcx = W / 2 + playerX * 40 * 0, pcy = H - 68;
      const bounce = speed > 0 ? Math.sin(t * 30) * 1.5 * (speed / MAXSPD) : 0;
      drawCar(W / 2, pcy + bounce, pcW, pcH, '#e8402a', (keys.get('ArrowLeft') || keys.get('a')) ? -1 : (keys.get('ArrowRight') || keys.get('d')) ? 1 : 0);
      void pcx; void pcH;

      /* HUD */
      pSpeed.textContent = Math.round(speed / MAXSPD * 140) + ' mph';
      pTime.textContent = t.toFixed(1) + 's';
      /* progress bar */
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(10, 10, W - 20, 8);
      ctx.fillStyle = '#6fcf2f'; ctx.fillRect(10, 10, (W - 20) * clamp(pos / trackLen, 0, 1), 8);
    }

    function drawCar(cx, cy, w, hh, col, lean) {
      ctx.save(); ctx.translate(cx + lean * 6, cy);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, hh * 0.42, w * 0.5, hh * 0.16, 0, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.fillRect(-w / 2, -hh * 0.2, w, hh * 0.55);
      ctx.fillStyle = '#8fd0e8'; ctx.fillRect(-w * 0.32, -hh * 0.34, w * 0.64, hh * 0.2);
      ctx.fillStyle = '#111'; ctx.fillRect(-w / 2, hh * 0.28, w * 0.22, hh * 0.2); ctx.fillRect(w / 2 - w * 0.22, hh * 0.28, w * 0.22, hh * 0.2);
      ctx.fillStyle = '#ffcb1f'; ctx.fillRect(-w / 2 + 4, -hh * 0.16, 8, 6); ctx.fillRect(w / 2 - 12, -hh * 0.16, 8, 6);
      ctx.restore();
    }

    bagg.add(Engine.onKey((e) => { if ((e.key === 'r' || e.key === 'R') && over) { build(); return true; } }));

    /* ---- test seam ---- */
    window.__racer = {
      build(lv) { if (lv != null) level = lv; build(); },
      stats: () => ({ level, pos, trackLen, speed, playerX, t, over, won, segs: segs.length, cars: segs.reduce((a, s) => a + s.cars.length, 0) }),
      hold(code, v) { keys.state[code] = v; },
      tick(sec) { let s = sec; while (s > 0) { const dt = Math.min(1 / 60, s); update(dt); s -= dt; } },
      setPos(z) { pos = z; }
    };
    bagg.add(() => { if (window.__racer) delete window.__racer; });

    build();
    bagg.add(Engine.loop((dt) => { update(Math.min(0.05, dt)); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'racer',
    title: 'Company Car',
    emoji: 'car',
    cat: 'action',
    order: 20,
    blurb: 'A proper arcade racer hiding in a browser tab — a curving, cresting pseudo-3D highway, traffic to thread, and twenty stages that get twistier and busier. Floor it, keep it on the tarmac, and beat the clock. Jump to any stage whenever you like.',
    scoreLabel: 'Stages cleared',
    tags: ['racing', 'driving', 'arcade', '3d'],
    how: [
      'Hold gas to accelerate, brake to slow, and steer left/right to stay on the road — arrow keys, WASD, or the on-screen buttons on touch.',
      'The road bends and rolls over hills. On a curve the car drifts to the outside, so steer into the bend to hold your line; drift onto the grass and you bog down.',
      'Traffic is scattered down every stage. Clip a car and you lose almost all your speed, so pick your lane early.',
      'Reach the finish line to clear the stage and bank your time. Twenty stages get longer, curvier and more crowded as you go.',
      'Use the Stage menu to jump straight to any stage whenever you want — no need to grind through in order. Your best time per stage is saved.'
    ],
    mount
  });
})();
