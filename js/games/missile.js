/* Mail Room Defense — a Missile Command clone. Incoming "urgent requests" rain
   on your buildings; tap to lob an interceptor and blow them out of the sky
   before they land. Waves get faster and busier. */
(function () {
  'use strict';
  const { h, clamp, randInt, rand } = Engine;
  const W = 600, H = 430;
  const GROUND = H - 26;

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;

    let cities, incoming, blasts, interceptors, wave, ammo, score, over, betweenT, spawnLeft, spawnT, disposed = false;

    const pWave = api.pill('Wave 1');
    const pAmmo = api.pill('Ammo 0');
    const pCity = api.pill('Buildings 6');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);
    api.button('New game', reset);

    const CITY_XS = [90, 165, 240, 360, 435, 510];
    const BASE_X = W / 2;

    // difficulty: faster, denser, thinner ammo as the dial climbs
    const enemySpeed = () => (34 + wave * 5) * (0.7 + api.dm * 0.35);
    const waveCount = () => Math.round((6 + wave * 2) * (0.7 + api.dm * 0.3));
    const ammoFor = () => clamp(Math.round(24 - api.dm * 4), 10, 30);
    const BLAST_MAX = 40, BLAST_GROW = 130, INT_SPEED = 460;

    function reset() {
      cities = CITY_XS.map((x) => ({ x, alive: true }));
      incoming = []; blasts = []; interceptors = [];
      wave = 1; score = 0; over = false; betweenT = 0;
      startWave();
      banner.style.display = 'none';
      api.status('Tap or click anywhere in the sky to fire an interceptor there — its blast clears any request caught in it. Protect the buildings. Each wave is faster and busier; you get fresh ammo every wave.');
    }
    function startWave() {
      ammo = ammoFor(); spawnLeft = waveCount(); spawnT = 0.4;
      pWave.textContent = 'Wave ' + wave;
      sync();
    }
    function sync() {
      pAmmo.textContent = 'Ammo ' + ammo;
      pCity.textContent = 'Buildings ' + cities.filter((c) => c.alive).length;
    }

    function spawnEnemy() {
      const sx = rand(20, W - 20);
      const targets = cities.filter((c) => c.alive);
      const tgt = targets.length ? targets[randInt(0, targets.length - 1)].x : rand(80, W - 80);
      const ang = Math.atan2(GROUND - 0, tgt - sx);
      const sp = enemySpeed();
      incoming.push({ x: sx, y: 0, tx: tgt, ty: GROUND, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, ox: sx, oy: 0 });
    }

    function fireAt(px, py) {
      if (over) return;
      if (ammo <= 0) { api.sfx.thud(); return; }
      py = clamp(py, 10, GROUND - 6);
      ammo--; sync();
      const dx = px - BASE_X, dy = py - (GROUND - 6), d = Math.hypot(dx, dy) || 1;
      interceptors.push({ x: BASE_X, y: GROUND - 6, tx: px, ty: py, vx: dx / d * INT_SPEED, vy: dy / d * INT_SPEED });
      api.sfx.blip(660);
    }
    bagg.listen(cv.el, 'pointerdown', (e) => { e.preventDefault(); const p = cv.pos(e); fireAt(p.x, p.y); });

    function boom(x, y) { blasts.push({ x, y, r: 4, grow: true }); api.sfx.boom ? api.sfx.boom() : api.sfx.good(); }

    function update(dt) {
      if (over) return;
      if (betweenT > 0) {
        betweenT -= dt;
        if (betweenT <= 0) { wave++; startWave(); }
        return;
      }
      // spawn
      if (spawnLeft > 0) {
        spawnT -= dt;
        if (spawnT <= 0) { spawnEnemy(); spawnLeft--; spawnT = rand(0.5, 1.4) / (0.7 + api.dm * 0.35); }
      }
      // interceptors
      for (let i = interceptors.length - 1; i >= 0; i--) {
        const m = interceptors[i];
        m.x += m.vx * dt; m.y += m.vy * dt;
        if ((m.vy < 0 && m.y <= m.ty) || (m.vy > 0 && m.y >= m.ty) || Math.hypot(m.x - m.tx, m.y - m.ty) < 8) {
          boom(m.tx, m.ty); interceptors.splice(i, 1);
        }
      }
      // blasts
      for (let i = blasts.length - 1; i >= 0; i--) {
        const b = blasts[i];
        if (b.grow) { b.r += BLAST_GROW * dt; if (b.r >= BLAST_MAX) b.grow = false; }
        else { b.r -= BLAST_GROW * 0.8 * dt; if (b.r <= 0) { blasts.splice(i, 1); continue; } }
      }
      // enemies
      for (let i = incoming.length - 1; i >= 0; i--) {
        const e = incoming[i];
        e.x += e.vx * dt; e.y += e.vy * dt;
        // caught in a blast?
        let hit = false;
        for (const b of blasts) if (Math.hypot(e.x - b.x, e.y - b.y) <= b.r) { hit = true; break; }
        if (hit) { incoming.splice(i, 1); score += 25; boom(e.x, e.y); continue; }
        if (e.y >= GROUND) {
          incoming.splice(i, 1);
          const c = cities.reduce((best, c2) => (c2.alive && Math.abs(c2.x - e.x) < Math.abs((best ? best.x : 1e9) - e.x) ? c2 : best), null);
          if (c && Math.abs(c.x - e.x) < 40) { c.alive = false; api.sfx.bad(); } else { api.sfx.thud(); }
          boom(e.x, GROUND);
          sync();
          if (!cities.some((c2) => c2.alive)) return end();
        }
      }
      // wave clear?
      if (spawnLeft === 0 && incoming.length === 0 && betweenT === 0) {
        score += ammo * 5 + 50;                 // bonus for spare ammo + survival
        betweenT = 1.6; api.sfx.great();
      }
    }

    function end() {
      over = true;
      const r = api.submit(score);
      banner.style.display = '';
      banner.className = 'banner' + (r && r.isRecord ? ' win' : '');
      banner.replaceChildren(
        h('h3', null, 'All buildings down'),
        h('p', null, 'Reached wave ' + wave + ' · ' + score + ' points' + (r && r.isRecord ? ' — new best!' : '') + '.'),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Again'));
    }

    function draw() {
      ctx.fillStyle = '#0a1020'; ctx.fillRect(0, 0, W, H);
      // stars
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (let i = 0; i < 30; i++) ctx.fillRect((i * 83) % W, (i * 47) % (GROUND - 40), 1.5, 1.5);
      // ground
      ctx.fillStyle = '#2b2440'; ctx.fillRect(0, GROUND, W, H - GROUND);
      // base
      ctx.fillStyle = '#b7a7e0'; ctx.beginPath(); ctx.moveTo(BASE_X - 18, GROUND); ctx.lineTo(BASE_X + 18, GROUND); ctx.lineTo(BASE_X, GROUND - 16); ctx.closePath(); ctx.fill();
      // cities
      for (const c of cities) {
        if (c.alive) {
          ctx.fillStyle = '#00a6b4';
          ctx.fillRect(c.x - 16, GROUND - 22, 32, 22);
          ctx.fillStyle = '#8fd0e8';
          for (let wx = -12; wx <= 8; wx += 8) for (let wy = -18; wy <= -4; wy += 7) ctx.fillRect(c.x + wx, GROUND + wy, 4, 4);
        } else {
          ctx.fillStyle = '#3a3450'; ctx.fillRect(c.x - 14, GROUND - 6, 28, 6);
        }
      }
      // enemy trails + heads
      for (const e of incoming) {
        ctx.strokeStyle = 'rgba(232,64,42,.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(e.ox, e.oy); ctx.lineTo(e.x, e.y); ctx.stroke();
        ctx.fillStyle = '#ffcb1f'; ctx.beginPath(); ctx.arc(e.x, e.y, 3, 0, 7); ctx.fill();
      }
      // interceptor trails
      for (const m of interceptors) {
        ctx.strokeStyle = 'rgba(111,207,47,.7)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(BASE_X, GROUND - 6); ctx.lineTo(m.x, m.y); ctx.stroke();
        ctx.fillStyle = '#eafff0'; ctx.beginPath(); ctx.arc(m.tx, m.ty, 2, 0, 7); ctx.fill();
      }
      // blasts
      for (const b of blasts) {
        ctx.fillStyle = 'rgba(255,203,31,' + clamp(b.r / BLAST_MAX, 0.2, 0.9) + ')';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
      }
      // HUD
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui';
      ctx.fillText('Score ' + score, 12, 20);
      if (betweenT > 0) {
        ctx.textAlign = 'center'; ctx.font = 'bold 20px system-ui';
        ctx.fillText('Wave ' + wave + ' cleared', W / 2, GROUND / 2);
        ctx.textAlign = 'left';
      }
      if (ammo <= 0 && !over) {
        ctx.fillStyle = '#e8402a'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('out of ammo — hold on', W / 2, GROUND / 2 + 26); ctx.textAlign = 'left';
      }
    }

    reset();
    bagg.add(Engine.loop((dt) => { update(Math.min(0.05, dt)); draw(); }));
    return () => { disposed = true; bagg.dispose(); };
  }

  Arcade.register({
    id: 'missile', title: 'Mail Room Defense', emoji: 'missile', cat: 'action', order: 31,
    blurb: 'Missile Command in an office. Urgent requests rain down on your buildings — tap the sky to intercept them with a blast before they land. Every wave comes in faster and thicker.',
    scoreLabel: 'Best score', tags: ['arcade', 'classic', 'defend'],
    how: [
      'Tap or click anywhere in the sky to fire an interceptor at that spot; its blast destroys any request caught inside it.',
      'One blast can take out several requests at once if you time it where they cluster.',
      'Any request that reaches the ground flattens the building it hits. Lose them all and it is over.',
      'You get fresh ammo each wave, plus points for the ammo you did not need. Later waves fall faster and heavier.'
    ],
    mount
  });
})();
