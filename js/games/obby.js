/* The Obby — a Roblox-style obstacle course. Run and jump across platforms,
 * dodge lava and spikes, touch the checkpoints so a fall only costs a little,
 * and reach the flag. Twenty stages that ramp up; jump to any of them. */
(function () {
  'use strict';
  const { h, clamp } = Engine;
  const W = 720, H = 420;
  const GRAV = 2000, JUMP = 660, MOVE = 300, PW = 22, PH = 30;
  const LEVELS = 20;
  const PLAT_COLS = ['#e8402a', '#ffcb1f', '#6fcf2f', '#00a6b4', '#6f3fa8', '#ff2d87'];

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H, { maxHeight: '58vh' });
    const ctx = cv.ctx;
    const keys = Engine.keys(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'a', 'd', 'w', 'A', 'D', 'W', ' ']);
    bagg.add(() => keys.dispose());

    let plats, hazards, checks, finish, worldEnd, level, px, py, vx, vy, grounded, spawnIdx, deaths, t, over, coyote, jumpBuf;
    level = clamp(api.load('level', 1), 1, LEVELS);

    const pLevel = api.pill('Stage 1');
    const pDeaths = api.pill('Falls: 0');
    const pTime = api.pill('0.0s');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);

    api.select('Stage', Array.from({ length: LEVELS }, (_, i) => ({ value: String(i + 1), label: 'Stage ' + (i + 1) })), String(level), (v) => { level = +v; api.save('level', level); build(); });
    api.button('Restart stage', build);

    const pad = h('div', { class: 'racer-pad' });
    const mk = (label, code) => { const b = h('button', { class: 'racer-btn', type: 'button' }, label); const set = (v) => { keys.state[code] = v; }; bagg.listen(b, 'pointerdown', (e) => { e.preventDefault(); set(true); }); bagg.listen(b, 'pointerup', () => set(false)); bagg.listen(b, 'pointerleave', () => set(false)); bagg.listen(b, 'pointercancel', () => set(false)); return b; };
    pad.append(mk('◀', 'ArrowLeft'), mk('JUMP', ' '), mk('▶', 'ArrowRight'));
    root.appendChild(pad);

    function build() {
      const rng = Engine.rng('obby:' + level);
      plats = []; hazards = []; checks = [];
      const diff = (level - 1) / (LEVELS - 1);
      let x = 0, y = H - 70;
      plats.push({ x: 0, y, w: 220, h: H - y, c: 0 });
      checks.push({ x: 60, y: y - PH, i: 0 });
      let cx = 220, ci = 1;
      const count = 12 + level * 2;
      for (let i = 0; i < count; i++) {
        /* Gap is capped to the jump's actual reach — a running jump covers
           MOVE * (2*JUMP/GRAV) ~= 198px flat, so keep the widest gap well under
           that. The difficulty dial narrows pads and adds hazards, never widens
           gaps, since a gap past the jump arc hard-walls the whole stage. */
        const gap = 55 + rng() * Math.min(60 + diff * 90, 105);   // <= 160px
        const gapStart = cx;
        cx += gap;
        const pw = Math.max(46, 90 - diff * 30 - (api.dm - 1) * 8 + rng() * 60);
        /* clamp the next platform's height so the jump across this gap is
           physically clearable: at the moment you've crossed the gap you must be
           at or above the target top */
        const tCross = gap / MOVE;
        const maxRise = JUMP * tCross - 0.5 * GRAV * tCross * tCross;   // px the next top may sit higher
        let ny = clamp(y + (rng() - 0.5) * (110 + diff * 90), 130, H - 44);
        ny = Math.max(ny, y - maxRise + 12);                            // 12px safety under the ceiling
        y = clamp(ny, 130, H - 44);
        plats.push({ x: cx, y, w: pw, h: H - y, c: (i % PLAT_COLS.length) });
        /* lava under some gaps */
        if (rng() < clamp(0.35 + diff * 0.2 + (api.dm - 1) * 0.12, 0.1, 0.85) && i > 1) hazards.push({ x: gapStart, y: H - 16, w: gap, h: 16, t: 'lava' });
        /* spikes on some platform tops */
        if (rng() < clamp(0.22 + diff * 0.2 + (api.dm - 1) * 0.1, 0.05, 0.75) && i > 2 && pw > 60) hazards.push({ x: cx + pw * 0.32, y: y - 12, w: pw * 0.36, h: 12, t: 'spike' });
        if (i % 4 === 3) { checks.push({ x: cx + pw / 2, y: y - PH, i: ci++ }); }
        cx += pw;
      }
      cx += 70; y = clamp(y, 130, H - 44);
      plats.push({ x: cx, y, w: 150, h: H - y, c: 2 });
      finish = { x: cx + 60, y: y - 54, w: 30, h: 54 };
      worldEnd = cx + 150;
      spawnIdx = 0; deaths = 0; t = 0; over = false;
      respawn();
      banner.style.display = 'none';
      pLevel.textContent = 'Stage ' + level;
      api.status('Stage ' + level + ' of ' + LEVELS + '. Run with ◀ ▶ / A D, jump with Space / W. Touch a checkpoint so a fall only sends you back a bit. Reach the flag. Jump to any stage from the menu.');
    }

    function respawn() {
      const c = checks[spawnIdx] || checks[0];
      px = c.x; py = c.y; vx = 0; vy = 0; grounded = false; coyote = 0; jumpBuf = 0;
    }
    function die() {
      deaths++; pDeaths.textContent = 'Falls: ' + deaths;
      api.sfx.bad(); respawn();
    }

    function overlap(ax, ay, aw, ah, b) { return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y; }

    function update(dt) {
      if (over) return;
      t += dt;
      const left = keys.get('ArrowLeft', 'a', 'A'), right = keys.get('ArrowRight', 'd', 'D');
      const jump = keys.get('ArrowUp', 'w', 'W', ' ');
      vx = (right ? 1 : 0) * MOVE - (left ? 1 : 0) * MOVE;

      if (jump) jumpBuf = 0.12; else jumpBuf -= dt;
      coyote -= dt;
      if (jumpBuf > 0 && (grounded || coyote > 0)) { vy = -JUMP; grounded = false; coyote = 0; jumpBuf = 0; api.sfx.blip(620); }

      vy += GRAV * dt;
      /* move X, resolve */
      px += vx * dt;
      for (const p of plats) {
        if (overlap(px, py, PW, PH, p)) {
          if (vx > 0) px = p.x - PW; else if (vx < 0) px = p.x + p.w;
        }
      }
      /* move Y, resolve */
      py += vy * dt;
      grounded = false;
      for (const p of plats) {
        if (overlap(px, py, PW, PH, p)) {
          if (vy > 0) { py = p.y - PH; vy = 0; grounded = true; coyote = 0.1; }
          else if (vy < 0) { py = p.y + p.h; vy = 0; }
        }
      }

      /* checkpoints */
      for (const c of checks) if (c.i > spawnIdx && px + PW / 2 > c.x) { spawnIdx = c.i; api.sfx.good(); }

      /* hazards + fall */
      for (const hz of hazards) if (overlap(px + 3, py + 3, PW - 6, PH - 6, hz)) return die();
      if (py > H + 40) return die();

      /* finish */
      if (overlap(px, py, PW, PH, finish)) return finishLevel();
      px = clamp(px, 0, worldEnd - PW);
    }

    function finishLevel() {
      over = true;
      const prev = api.load('best:' + level, null);
      const rec = prev == null || t < prev;
      if (rec) api.save('best:' + level, +t.toFixed(1));
      const done = api.load('cleared', 0) + 1; api.save('cleared', done); api.submit(done);
      api.sfx.great();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Flag reached!'),
        h('p', null, 'Stage ' + level + ' done in ' + t.toFixed(1) + 's with ' + deaths + ' fall' + (deaths === 1 ? '' : 's') + (rec ? ' — new best time!' : '') + '.'),
        h('div', { class: 'racer-endbtns' },
          level < LEVELS ? h('button', { class: 'btn primary', type: 'button', onclick: () => { level++; api.save('level', level); build(); } }, 'Next stage →') : h('span', null, 'You cleared every stage!'),
          h('button', { class: 'btn', type: 'button', onclick: build }, 'Replay')));
    }

    function draw() {
      const doc = Arcade.docMode();
      const camX = clamp(px - W * 0.34, 0, Math.max(0, worldEnd - W));
      if (doc) {
        ctx.fillStyle = Engine.docPaper(); ctx.fillRect(0, 0, W, H);
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#2a3552'); g.addColorStop(1, '#3e4e78');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      ctx.save(); ctx.translate(-Math.round(camX), 0);

      for (const p of plats) {
        if (doc) {
          const x = Math.round(p.x), y = Math.round(p.y), w = Math.round(p.w), h = Math.round(p.h);
          ctx.fillStyle = Engine.docPaper(); ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        } else {
          ctx.fillStyle = PLAT_COLS[p.c]; ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(p.x, p.y, p.w, 5);
          ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(p.x, p.y + p.h - 4, p.w, 4);
        }
      }
      for (const hz of hazards) {
        if (hz.t === 'lava') {
          if (doc) {
            ctx.fillStyle = Engine.docInk(); ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
            ctx.fillStyle = Engine.docPaper(); for (let x = hz.x; x < hz.x + hz.w; x += 12) ctx.fillRect(Math.round(x), Math.round(hz.y), 6, 3);
          } else {
            ctx.fillStyle = '#ff5a2a'; ctx.fillRect(hz.x, hz.y, hz.w, hz.h); ctx.fillStyle = '#ffb02e'; for (let x = hz.x; x < hz.x + hz.w; x += 12) ctx.fillRect(x, hz.y, 6, 3);
          }
        }
        else {
          ctx.fillStyle = doc ? Engine.docInk() : '#d0d0d8';
          for (let x = hz.x; x < hz.x + hz.w - 6; x += 10) { ctx.beginPath(); ctx.moveTo(x, hz.y + hz.h); ctx.lineTo(x + 5, hz.y); ctx.lineTo(x + 10, hz.y + hz.h); ctx.closePath(); ctx.fill(); }
        }
      }
      for (const c of checks) {
        const reached = c.i <= spawnIdx;
        if (doc) {
          ctx.fillStyle = Engine.docInk();
          ctx.fillRect(Math.round(c.x) - 2, Math.round(c.y) - 22, 4, 24);
          ctx.beginPath(); ctx.moveTo(c.x + 2, c.y - 22); ctx.lineTo(c.x + 18, c.y - 17); ctx.lineTo(c.x + 2, c.y - 12); ctx.closePath();
          if (reached) ctx.fill(); else { ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 1.5; ctx.stroke(); }
        } else {
          ctx.fillStyle = reached ? '#6fcf2f' : '#8a8674';
          ctx.fillRect(c.x - 2, c.y - 22, 4, 24);
          ctx.beginPath(); ctx.moveTo(c.x + 2, c.y - 22); ctx.lineTo(c.x + 18, c.y - 17); ctx.lineTo(c.x + 2, c.y - 12); ctx.closePath(); ctx.fill();
        }
      }
      /* finish flag */
      if (doc) {
        ctx.fillStyle = Engine.docInk(); ctx.fillRect(Math.round(finish.x) - 2, Math.round(finish.y), 4, finish.h);
        ctx.fillStyle = Engine.docPaper(); ctx.fillRect(Math.round(finish.x) + 2, Math.round(finish.y), 22, 16);
        ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 1.5; ctx.strokeRect(Math.round(finish.x) + 2.5, Math.round(finish.y) + 0.5, 21, 15);
        ctx.fillStyle = Engine.docInk();
        ctx.fillRect(Math.round(finish.x) + 2, Math.round(finish.y), 22, 4); ctx.fillRect(Math.round(finish.x) + 2, Math.round(finish.y) + 8, 22, 4);
      } else {
        ctx.fillStyle = '#ded6c2'; ctx.fillRect(finish.x - 2, finish.y, 4, finish.h);
        ctx.fillStyle = '#ffcb1f'; ctx.fillRect(finish.x + 2, finish.y, 22, 16);
        ctx.fillStyle = '#1d1722'; ctx.fillRect(finish.x + 2, finish.y, 22, 4); ctx.fillRect(finish.x + 2, finish.y + 8, 22, 4);
      }

      /* player */
      if (doc) {
        const ppx = Math.round(px), ppy = Math.round(py);
        ctx.fillStyle = Engine.docPaper(); ctx.fillRect(ppx, ppy, PW, PH);
        ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 2; ctx.strokeRect(ppx + 1, ppy + 1, PW - 2, PH - 2);
        ctx.fillStyle = Engine.docInk(); ctx.fillRect(ppx + (vx >= 0 ? 12 : 4), ppy + 8, 5, 5);
      } else {
        ctx.fillStyle = '#ffcb1f'; ctx.fillRect(px, py, PW, PH);
        ctx.fillStyle = '#1d1722'; ctx.fillRect(px + (vx >= 0 ? 12 : 4), py + 8, 5, 5);
        ctx.fillStyle = '#e8402a'; ctx.fillRect(px, py + PH - 8, PW, 4);
      }
      ctx.restore();

      pTime.textContent = t.toFixed(1) + 's';
      /* progress */
      if (doc) {
        ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 1;
        ctx.strokeRect(10.5, 10.5, W - 21, 6);
        ctx.fillStyle = Engine.docInk();
        ctx.fillRect(11, 11, Math.round((W - 22) * clamp(px / worldEnd, 0, 1)), 5);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(10, 10, W - 20, 7);
        ctx.fillStyle = '#6fcf2f'; ctx.fillRect(10, 10, (W - 20) * clamp(px / worldEnd, 0, 1), 7);
      }
    }

    bagg.add(Engine.onKey((e) => { if ((e.key === 'r' || e.key === 'R') && over) { build(); return true; } }));

    /* ---- test seam ---- */
    window.__obby = {
      build(lv) { if (lv != null) level = lv; build(); },
      stats: () => ({ level, px, py, vy, grounded, spawnIdx, deaths, t, over, worldEnd, finish: { x: finish.x, y: finish.y }, plats: plats.length, hazards: hazards.length, checks: checks.length }),
      hold(code, v) { keys.state[code] = v; },
      tick(sec) { let s = sec; while (s > 0) { const dt = Math.min(1 / 60, s); update(dt); s -= dt; } },
      teleport(x, y) { px = x; py = y == null ? py : y; vy = 0; }
    };
    bagg.add(() => { if (window.__obby) delete window.__obby; });

    build();
    bagg.add(Engine.loop((dt) => { update(Math.min(0.033, dt)); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'obby',
    title: 'The Obby',
    emoji: 'obby',
    cat: 'action',
    order: 21,
    lightBoard: true,   // doc mode draws its own paper/ink palette above; the blanket invert would only flip it back
    blurb: 'A Roblox-style obstacle course. Jump across the platforms to the flag while dodging lava and spikes. Twenty stages, and you can start on any one.',
    scoreLabel: 'Stages cleared',
    tags: ['platformer', 'obby', 'jump', 'obstacle-course'],
    how: [
      'Move with the arrows or A/D and jump with Space, W, or the on-screen JUMP button. Small coyote-time and jump-buffering make jumps forgiving.',
      'Jump platform to platform across the gaps. A fall, lava, or spikes sends you back to your last checkpoint.',
      'Green flags are checkpoints. Run past one to light it, so a slip costs a little ground instead of the stage.',
      'Touch the chequered flag to clear the stage. Your time and fall count are recorded, and your best time per stage is saved.',
      'The twenty stages get longer, higher, and more hazardous. Use the Stage menu to jump to any of them.'
    ],
    mount
  });
})();
