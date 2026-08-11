/* Company Car — a pseudo-3D arcade racer. A proper curving, cresting road drawn
 * the OutRun way (projected road segments), roadside scenery, traffic to weave
 * through, twenty procedurally-built stages you can jump between freely, and a
 * clock. Keyboard or on-screen buttons. */
(function () {
  'use strict';
  const { h, clamp } = Engine;
  const DOC = () => !!(window.Arcade && Arcade.docMode && Arcade.docMode());
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
    tree: '#1c5a2a',
    grassL: '#3a9d3a', grassD: '#329033',
    roadL: '#6b6b6b', roadD: '#666666',
    rumbleL: '#e8402a', rumbleD: '#f4f4f4',
    lane: '#f4f4f4'
  };
  const CARCOLS = ['#ffcb1f', '#e8402a', '#6f3fa8', '#00a6b4', '#f4f4f4', '#2a4bbd'];

  function ease(a, b, p) { return a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5); }
  function easeIn(a, b, p) { return a + (b - a) * p * p; }
  function easeOut(a, b, p) { return a + (b - a) * (1 - (1 - p) * (1 - p)); }

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;
    const keys = Engine.keys(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 's', 'a', 'd', 'W', 'S', 'A', 'D', ' ']);

    let segs, trackLen, cars, level, pos, playerX, speed, t, over, won, started;
    let cd, shakeT, screechT;
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
        color: Math.floor(n / RUMBLE) % 2 ? 'd' : 'l', cars: [], sprite: null
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

      /* roadside scenery — trees, signs and marker posts sprinkled down both
         shoulders. Sprites live just off the tarmac (|x| > 1) and give the
         projection real depth as they rush past. */
      for (let i = 20; i < segs.length; i++) {
        if (rng() < 0.16) {
          const side = rng() < 0.5 ? -1 : 1;
          const x = side * (1.35 + rng() * 2.2);
          const r = rng();
          const type = r < 0.68 ? 'tree' : r < 0.86 ? 'bush' : r < 0.95 ? 'sign' : 'post';
          segs[i].sprite = { x, type, seed: rng() };
        }
      }
      /* evenly spaced marker posts along the very edge for a sense of speed */
      for (let i = 24; i < segs.length; i += 8) {
        if (!segs[i].sprite) segs[i].sprite = { x: (i % 16 === 0 ? -1 : 1) * 1.15, type: 'post', seed: 0 };
      }

      /* traffic: more and denser on later stages, and the difficulty dial packs
         the road tighter on top of that (chill ~0.8x, nightmare ~1.7x) */
      const nCars = Math.round((8 + level * 3) * (0.55 + api.dm * 0.45));
      for (let c = 0; c < nCars; c++) {
        const i = 40 + Math.floor(rng() * (segs.length - 80));
        const lane = (rng() * LANES | 0) - 1;   // -1,0,1
        segs[i].cars.push({ x: lane * 0.55, col: CARCOLS[rng() * CARCOLS.length | 0], spd: (0.35 + rng() * 0.25) });
      }
      pos = 0; playerX = 0; speed = 0; t = 0; over = false; won = false; started = false;
      cd = 2.6; shakeT = 0; screechT = 0;
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
      if (cd > 0) { cd -= dt; return; }          // start-line countdown holds the car
      if (shakeT > 0) shakeT -= dt;
      if (screechT > 0) screechT -= dt;
      const cur = segAt(pos);
      if (!cur) return;
      const spdPct = speed / MAXSPD;
      const dir = (keys.get('ArrowLeft') || keys.get('a') || keys.get('A')) ? -1 : (keys.get('ArrowRight') || keys.get('d') || keys.get('D')) ? 1 : 0;
      if (dir) started = true;
      playerX += dir * dt * 2.6 * spdPct;
      /* centrifugal push on curves */
      playerX -= dt * spdPct * cur.curve * CENTRI;
      /* tyres protest when you hold a fast, tight curve */
      if (Math.abs(cur.curve) > 2.4 && spdPct > 0.55 && screechT <= 0) { api.sfx.noise({ dur: 0.16, cutoff: 2600, vol: 0.05 }); screechT = 0.22; }

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
        if (speed > 0 && Math.abs(playerX - car.x) < 0.5) { speed = MAXSPD * 0.18; playerX += (playerX > car.x ? 1 : -1) * dt * 2; api.sfx.thud(); shakeT = 0.32; }
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

    function drawSky(base) {
      const doc0 = DOC();
      if (doc0) {
        ctx.fillStyle = Engine.docPaper(); ctx.fillRect(0, 0, W, H);
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#2f6fb0'); g.addColorStop(0.55, '#6aa8e0'); g.addColorStop(1, '#bfe0f5');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      /* sun drifts opposite the road's lean so bends feel like they sweep past */
      const sunX = W * 0.5 - (base ? base.curve : 0) * 26 - playerX * 40;
      const sunY = H * 0.30;
      if (doc0) {
        ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(sunX, sunY, 34, 0, 7); ctx.stroke();
      } else {
        const sg = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 120);
        sg.addColorStop(0, 'rgba(255,246,196,.95)'); sg.addColorStop(0.4, 'rgba(255,221,120,.55)'); sg.addColorStop(1, 'rgba(255,221,120,0)');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sunX, sunY, 120, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff2b0'; ctx.beginPath(); ctx.arc(sunX, sunY, 34, 0, 7); ctx.fill();
      }
      /* distant hill band on the horizon — outline only in doc mode, no grey wash */
      if (doc0) {
        ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 1.5; ctx.beginPath();
        ctx.moveTo(0, H * 0.52);
        for (let i = 0; i <= 8; i++) ctx.lineTo(W * i / 8, H * 0.52 - Math.sin(i * 1.3 + (base ? base.i * 0.02 : 0)) * 18 - 10);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(46,120,70,.55)';
        ctx.beginPath(); ctx.moveTo(0, H * 0.52);
        for (let i = 0; i <= 8; i++) ctx.lineTo(W * i / 8, H * 0.52 - Math.sin(i * 1.3 + (base ? base.i * 0.02 : 0)) * 18 - 10);
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      }
    }

    function drawScenery(sp, spr) {
      const x = sp.sx + sp.sw * spr.x, y = sp.sy, s = sp.sw;
      if (s < 1.5) return;
      if (spr.type === 'tree') {
        const th = s * (1.9 + spr.seed * 1.4), tw = s * 0.62;
        const doc0 = DOC();
        ctx.fillStyle = doc0 ? Engine.docPaper() : '#5a3b1c';
        if (doc0) { ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 1; ctx.strokeRect(x - s * 0.06, y - th * 0.34, s * 0.12, th * 0.34); }
        else ctx.fillRect(x - s * 0.06, y - th * 0.34, s * 0.12, th * 0.34);
        ctx.fillStyle = doc0 ? Engine.docPaper() : (spr.seed > 0.5 ? '#1c5a2a' : '#237a35');
        ctx.beginPath(); ctx.moveTo(x, y - th); ctx.lineTo(x - tw, y - th * 0.34); ctx.lineTo(x + tw, y - th * 0.34); ctx.closePath();
        if (doc0) { ctx.fill(); ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 1; ctx.stroke(); } else ctx.fill();
        ctx.beginPath(); ctx.moveTo(x, y - th * 0.78); ctx.lineTo(x - tw * 1.15, y - th * 0.18); ctx.lineTo(x + tw * 1.15, y - th * 0.18); ctx.closePath();
        if (doc0) { ctx.fill(); ctx.stroke(); } else ctx.fill();
      } else if (spr.type === 'bush') {
        const r = s * 0.5, doc0 = DOC();
        ctx.fillStyle = doc0 ? Engine.docPaper() : '#2f8a3a';
        ctx.beginPath(); ctx.arc(x, y - r * 0.6, r, 0, 7); ctx.arc(x - r * 0.7, y - r * 0.3, r * 0.7, 0, 7); ctx.arc(x + r * 0.7, y - r * 0.3, r * 0.7, 0, 7); ctx.fill();
        if (doc0) { ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 1; ctx.stroke(); }
      } else if (spr.type === 'sign') {
        const bw = s * 1.5, bh = s * 0.9, ph = s * 1.1, doc0 = DOC();
        /* post: thin, ink is fine even filled solid, same call as the tree trunk above */
        ctx.fillStyle = doc0 ? Engine.docInk() : '#3a2f22'; ctx.fillRect(x - s * 0.08, y - ph, s * 0.16, ph);
        /* board: white with an ink outline, not a solid colour block */
        ctx.fillStyle = doc0 ? Engine.docPaper() : '#1666a8'; ctx.fillRect(x - bw / 2, y - ph - bh, bw, bh);
        if (doc0) { ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 1; ctx.strokeRect(x - bw / 2 + 0.5, y - ph - bh + 0.5, bw - 1, bh - 1); }
        /* text bars: ink strokes on the paper board, not white-on-blue */
        ctx.fillStyle = doc0 ? Engine.docInk() : '#fff';
        ctx.fillRect(x - bw / 2 + 3, y - ph - bh + 3, bw - 6, Math.max(1, bh * 0.22));
        ctx.fillRect(x - bw / 2 + 3, y - ph - bh * 0.5, bw * 0.6, Math.max(1, bh * 0.18));
      } else { /* post: thin marker, ink is fine even filled solid; the reflector
                  band is a decorative detail dropped in doc mode rather than
                  converted, same call as the sun/haze omissions in drawSky */
        const ph = s * 1.2, doc0 = DOC();
        ctx.fillStyle = doc0 ? Engine.docInk() : '#f4f4f4'; ctx.fillRect(x - s * 0.05, y - ph, s * 0.1, ph);
        if (!doc0) { ctx.fillStyle = '#e8402a'; ctx.fillRect(x - s * 0.05, y - ph, s * 0.1, ph * 0.3); }
      }
    }

    function drawTraffic(sp, car) {
      const cw = sp.sw * 0.9, cx = sp.sx + sp.sw * car.x, cy = sp.sy;
      if (cw < 2) return;
      const bw = cw * 0.6, bh = cw * 0.34;
      const doc0 = DOC();
      if (doc0) {
        /* paper body with an ink outline + outline-only rear window, like the
           player car's own doc treatment above — no filled colour block, no
           translucent black shadow/shade (those blend to grey on paper). */
        ctx.fillStyle = Engine.docPaper(); ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 1;
        ctx.fillRect(cx - bw / 2, cy - bh, bw, bh); ctx.strokeRect(cx - bw / 2 + 0.5, cy - bh + 0.5, bw - 1, bh - 1);
        ctx.strokeRect(cx - bw * 0.32 + 0.5, cy - bh * 0.9 + 0.5, bw * 0.64 - 1, bh * 0.42 - 1);
        /* tail lights: small, ink is fine */
        ctx.fillStyle = Engine.docInk();
        ctx.fillRect(cx - bw / 2, cy - bh * 0.28, bw * 0.16, bh * 0.2);
        ctx.fillRect(cx + bw / 2 - bw * 0.16, cy - bh * 0.28, bw * 0.16, bh * 0.2);
        return;
      }
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath(); ctx.ellipse(cx, cy + 1, bw * 0.6, bh * 0.22, 0, 0, 7); ctx.fill();
      ctx.fillStyle = car.col; ctx.fillRect(cx - bw / 2, cy - bh, bw, bh);              // body
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(cx - bw / 2, cy - bh * 0.36, bw, bh * 0.36);  // lower shade
      ctx.fillStyle = '#1a2733'; ctx.fillRect(cx - bw * 0.32, cy - bh * 0.9, bw * 0.64, bh * 0.42); // rear window
      ctx.fillStyle = '#3a0d0a'; ctx.fillRect(cx - bw / 2, cy - bh * 0.28, bw * 0.16, bh * 0.2);     // tail lights
      ctx.fillRect(cx + bw / 2 - bw * 0.16, cy - bh * 0.28, bw * 0.16, bh * 0.2);
      ctx.fillStyle = '#111'; ctx.fillRect(cx - bw / 2 - 1, cy - bh * 0.06, bw * 0.14, bh * 0.16);
      ctx.fillRect(cx + bw / 2 - bw * 0.13, cy - bh * 0.06, bw * 0.14, bh * 0.16);
    }

    function draw() {
      const base = segAt(pos), basePct = (pos % SEG) / SEG;
      const shx = shakeT > 0 ? (Math.random() - 0.5) * 10 * shakeT : 0;
      const shy = shakeT > 0 ? (Math.random() - 0.5) * 10 * shakeT : 0;
      ctx.save();
      ctx.translate(shx, shy);

      /* the asphalt/grass palette is literal gray by design (roads ARE gray) —
         fine normally, but doc mode wants paper, not gray, so swap the shared
         palette to paper/rule/ink tones for the duration of this frame. */
      const doc0 = DOC();
      if (doc0) {
        /* road and grass both stay plain paper — no grey stripe alternation.
           The ink/paper rumble strip at the road edge and the ink lane
           dashes carry all the motion cues, both true black, not grey. */
        COL.grassL = Engine.docPaper(); COL.grassD = Engine.docPaper();
        COL.roadL = Engine.docPaper(); COL.roadD = Engine.docPaper();
        COL.rumbleL = Engine.docInk(); COL.rumbleD = Engine.docPaper();
        COL.lane = Engine.docInk();
      } else {
        COL.grassL = '#3a9d3a'; COL.grassD = '#329033';
        COL.roadL = '#6b6b6b'; COL.roadD = '#666666';
        COL.rumbleL = '#e8402a'; COL.rumbleD = '#f4f4f4';
        COL.lane = '#f4f4f4';
      }

      drawSky(base);

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
        if (seg.p1.cz <= CAMD || seg.p2.sy >= seg.p1.sy || seg.p2.sy >= maxy) { seg._p1 = null; continue; }
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

      /* horizon haze softens the far clip line */
      const hz = ctx.createLinearGradient(0, H * 0.42, 0, H * 0.58);
      hz.addColorStop(0, 'rgba(191,224,245,.5)'); hz.addColorStop(1, 'rgba(191,224,245,0)');
      ctx.fillStyle = hz; ctx.fillRect(0, H * 0.42, W, H * 0.16);

      /* scenery + traffic sprites, back to front */
      for (let n = DRAW - 1; n >= 0; n--) {
        const seg = segs[(base.i + n) % segs.length];
        if (!seg._p1) continue;
        if (seg.sprite) drawScenery(seg._p1, seg.sprite);
        if (seg.cars.length) for (const car of seg.cars) drawTraffic(seg._p1, car);
        seg._p1 = null;
      }

      /* player car */
      const bounce = speed > 0 ? Math.sin(t * 30) * 1.5 * (speed / MAXSPD) : 0;
      const steer = (keys.get('ArrowLeft') || keys.get('a')) ? -1 : (keys.get('ArrowRight') || keys.get('d')) ? 1 : 0;
      drawCar(W / 2, H - 74 + bounce, 132, 66, steer, keys.get('ArrowDown') || keys.get('s'));

      /* speed lines when you're really moving */
      const sp = speed / MAXSPD;
      if (sp > 0.6) {
        ctx.strokeStyle = 'rgba(255,255,255,' + (sp - 0.6) * 0.4 + ')';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const yy = 40 + Math.random() * (H - 120), len = 20 + Math.random() * 40, side = i < 3 ? 40 : W - 40;
          ctx.beginPath(); ctx.moveTo(side, yy); ctx.lineTo(side, yy + len); ctx.stroke();
        }
      }

      ctx.restore();   // end shake

      drawHUD();

      if (cd > 0) {
        const n = Math.ceil(cd - 0.6);
        const label = n <= 0 ? 'Starting' : 'Starting in ' + n;
        if (DOC()) {
          // a full-bleed dimmed overlay with a giant countdown numeral reads as
          // an unmistakable game-start sequence at a glance; in doc mode this
          // becomes a small, calm status line instead — same information,
          // none of the drama
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = Engine.docPaper();
          ctx.fillRect(W / 2 - 90, H / 2 - 16, 180, 32);
          ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 1.5;
          ctx.strokeRect(W / 2 - 90 + 0.75, H / 2 - 16 + 0.75, 178.5, 30.5);
          ctx.fillStyle = Engine.docInk();
          ctx.font = '600 15px "Courier New", monospace';
          ctx.fillText(label, W / 2, H / 2 + 1);
          ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        } else {
          ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H);
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1d1722'; ctx.lineWidth = 6;
          ctx.font = 'bold 120px Impact, Arial Black, sans-serif';
          const big = n <= 0 ? 'GO!' : String(n);
          ctx.strokeText(big, W / 2, H / 2); ctx.fillText(big, W / 2, H / 2);
          ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        }
      }
    }

    function drawCar(cx, cy, w, hh, lean, braking) {
      const doc0 = DOC();
      ctx.save(); ctx.translate(cx + lean * 7, cy);
      if (doc0) {
        ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, hh * 0.44, w * 0.52, hh * 0.17, 0, 0, 7); ctx.stroke();
        /* tyres: small, ink is fine */
        ctx.fillStyle = Engine.docInk();
        ctx.fillRect(-w / 2, hh * 0.16, w * 0.2, hh * 0.34); ctx.fillRect(w / 2 - w * 0.2, hh * 0.16, w * 0.2, hh * 0.34);
        /* body: white with an ink outline, not a solid colour block */
        ctx.fillStyle = Engine.docPaper(); ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 1.5;
        ctx.fillRect(-w / 2, -hh * 0.24, w, hh * 0.62); ctx.strokeRect(-w / 2 + 0.75, -hh * 0.24 + 0.75, w - 1.5, hh * 0.62 - 1.5);
        ctx.beginPath(); ctx.moveTo(-w / 2, -hh * 0.24 + hh * 0.24); ctx.lineTo(w / 2, -hh * 0.24 + hh * 0.24); ctx.stroke();
        /* cabin + rear window: outline only */
        ctx.strokeRect(-w * 0.33 + 0.75, -hh * 0.4 + 0.75, w * 0.66 - 1.5, hh * 0.26 - 1.5);
        ctx.strokeRect(-w * 0.29 + 0.75, -hh * 0.37 + 0.75, w * 0.58 - 1.5, hh * 0.14 - 1.5);
        /* spoiler + brake lights */
        ctx.fillStyle = Engine.docInk(); ctx.fillRect(-w * 0.42, -hh * 0.3, w * 0.84, hh * 0.08);
        if (braking) { ctx.fillRect(-w / 2 + 6, hh * 0.02, w * 0.2, hh * 0.14); ctx.fillRect(w / 2 - w * 0.2 - 6, hh * 0.02, w * 0.2, hh * 0.14); }
        else { ctx.strokeRect(-w / 2 + 6.75, hh * 0.02 + 0.75, w * 0.2 - 1.5, hh * 0.14 - 1.5); ctx.strokeRect(w / 2 - w * 0.2 - 5.25, hh * 0.02 + 0.75, w * 0.2 - 1.5, hh * 0.14 - 1.5); }
      } else {
        ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(0, hh * 0.44, w * 0.52, hh * 0.17, 0, 0, 7); ctx.fill();
        /* tyres */
        ctx.fillStyle = '#111'; ctx.fillRect(-w / 2, hh * 0.16, w * 0.2, hh * 0.34); ctx.fillRect(w / 2 - w * 0.2, hh * 0.16, w * 0.2, hh * 0.34);
        /* body */
        ctx.fillStyle = '#c0331f'; ctx.fillRect(-w / 2, -hh * 0.24, w, hh * 0.62);
        ctx.fillStyle = '#e8402a'; ctx.fillRect(-w / 2, -hh * 0.24, w, hh * 0.24);
        /* cabin + rear window */
        ctx.fillStyle = '#12303f'; ctx.fillRect(-w * 0.33, -hh * 0.4, w * 0.66, hh * 0.26);
        ctx.fillStyle = '#8fd0e8'; ctx.fillRect(-w * 0.29, -hh * 0.37, w * 0.58, hh * 0.14);
        /* spoiler + brake lights */
        ctx.fillStyle = '#1d1722'; ctx.fillRect(-w * 0.42, -hh * 0.3, w * 0.84, hh * 0.08);
        ctx.fillStyle = braking ? '#ff5b47' : '#7a1810';
        ctx.fillRect(-w / 2 + 6, hh * 0.02, w * 0.2, hh * 0.14); ctx.fillRect(w / 2 - w * 0.2 - 6, hh * 0.02, w * 0.2, hh * 0.14);
      }
      ctx.restore();
    }

    function drawHUD() {
      const doc0 = DOC();
      /* progress bar */
      ctx.fillStyle = doc0 ? Engine.docPaper() : 'rgba(0,0,0,.4)'; ctx.fillRect(10, 10, W - 20, 8);
      if (doc0) { ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 1; ctx.strokeRect(10.5, 10.5, W - 21, 7); }
      ctx.fillStyle = doc0 ? Engine.docInk() : '#6fcf2f'; ctx.fillRect(10, 10, (W - 20) * clamp(pos / trackLen, 0, 1), 8);
      /* mph readout + a little speedo arc, bottom-left */
      const mph = Math.round(speed / MAXSPD * 140);
      const gx = 52, gy = H - 40, gr = 30;
      ctx.strokeStyle = doc0 ? Engine.docPaper() : 'rgba(0,0,0,.45)'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(gx, gy, gr, Math.PI * 0.85, Math.PI * 2.15); ctx.stroke();
      if (doc0) { ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 1; ctx.stroke(); }
      ctx.strokeStyle = doc0 ? Engine.docInk() : '#ffcb1f'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(gx, gy, gr, Math.PI * 0.85, Math.PI * 0.85 + (Math.PI * 1.3) * clamp(speed / MAXSPD, 0, 1)); ctx.stroke();
      ctx.fillStyle = doc0 ? Engine.docInk() : '#fff'; ctx.strokeStyle = doc0 ? Engine.docPaper() : '#1d1722'; ctx.lineWidth = 3;
      ctx.textAlign = 'center'; ctx.font = 'bold 18px "Courier New", monospace';
      if (!doc0) ctx.strokeText(mph, gx, gy + 6);
      ctx.fillText(mph, gx, gy + 6);
      ctx.font = 'bold 9px "Courier New", monospace'; ctx.fillText('MPH', gx, gy + 20);
      ctx.textAlign = 'left';
      /* pills mirror the on-canvas HUD */
      pSpeed.textContent = mph + ' mph';
      pTime.textContent = t.toFixed(1) + 's';
    }

    bagg.add(Engine.onKey((e) => { if ((e.key === 'r' || e.key === 'R') && over) { build(); return true; } }));

    /* ---- test seam ---- */
    window.__racer = {
      build(lv) { if (lv != null) level = lv; build(); },
      stats: () => ({ level, pos, trackLen, speed, playerX, t, over, won, cd, segs: segs.length, cars: segs.reduce((a, s) => a + s.cars.length, 0) }),
      hold(code, v) { keys.state[code] = v; },
      tick(sec) { let s = sec; while (s > 0) { const dt = Math.min(1 / 60, s); update(dt); s -= dt; } },
      setPos(z) { pos = z; },
      skipCountdown() { cd = 0; }
    };
    bagg.add(() => { if (window.__racer) delete window.__racer; });

    build();
    bagg.add(Engine.loop((dt) => { update(Math.min(0.05, dt)); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'racer',
    lightBoard: true,   // scene has enough natural tonal range that plain greyscale reads fine; inverting collapsed it to a flat grey blob
    title: 'Company Car',
    emoji: 'car',
    cat: 'action',
    order: 20,
    blurb: 'An arcade racer down a curving, cresting highway lined with scenery and traffic to weave through. Twenty stages get twistier and busier as you go, and you can jump straight to any of them.',
    scoreLabel: 'Stages cleared',
    tags: ['racing', 'driving', 'arcade', '3d'],
    how: [
      'Wait for the lights, then hold gas to speed up, brake to slow, and steer left or right to stay on the road. Use arrow keys, WASD, or the on-screen buttons on touch.',
      'The road bends and rolls over hills. On a curve the car drifts toward the outside, so steer into the bend to hold your line. Drift onto the grass and you bog down.',
      'Traffic is scattered along every stage. Clip a car and you lose almost all your speed, so pick your lane early.',
      'Reach the finish to clear the stage and bank your time. Later stages run longer, curvier and more crowded.',
      'The Stage menu jumps straight to any stage, so you can skip around instead of grinding in order. Your best time per stage is saved.'
    ],
    mount
  });
})();
