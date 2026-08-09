/* Spam Filter — a tower-defense. Junk mail marches along the wire toward your
 * inbox; drop filters beside the path to shred it before it lands. Earn
 * productivity for every message you stop, spend it on more filters, and survive
 * the waves. Reach the inbox too many times and you declare bankruptcy at zero. */
(function () {
  'use strict';
  const { h, clamp } = Engine;
  const W = 560, H = 560, COLS = 14, ROWS = 14, CELL = W / COLS;
  const MAX_WAVE = 12;

  /* path waypoints in cell coords (axis-aligned segments) */
  const WP = [[0, 2], [11, 2], [11, 5], [2, 5], [2, 8], [11, 8], [11, 11], [13, 11]];

  const TOWERS = {
    filter: { name: 'Keyword filter', cost: 50, range: 2.6, rate: 3.2, dmg: 7, col: '#2a7fd6', kind: 'single' },
    shred: { name: 'Shredder', cost: 120, range: 2.1, rate: 1.0, dmg: 16, col: '#e8402a', kind: 'splash', splash: 1.2 },
    quar: { name: 'Quarantine', cost: 95, range: 2.7, rate: 2.2, dmg: 2, col: '#6f3fa8', kind: 'slow' }
  };

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H, { maxHeight: '64vh' });
    const ctx = cv.ctx;

    /* build the pixel path + the set of cells it occupies */
    const pts = WP.map(([c, r]) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 }));
    const segs = [];
    let pathLen = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
      segs.push({ a, b, len, at: pathLen }); pathLen += len;
    }
    const onPath = new Set();
    for (let i = 0; i < WP.length - 1; i++) {
      const [c0, r0] = WP[i], [c1, r1] = WP[i + 1];
      const dc = Math.sign(c1 - c0), dr = Math.sign(r1 - r0);
      let c = c0, r = r0; onPath.add(r + ',' + c);
      while (c !== c1 || r !== r1) { c += dc; r += dr; onPath.add(r + ',' + c); }
    }
    function posAt(d) {
      d = clamp(d, 0, pathLen);
      for (const s of segs) if (d <= s.at + s.len) { const t = (d - s.at) / s.len; return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t }; }
      return pts[pts.length - 1];
    }

    let money, lives, wave, score, phase, spawnQ, spawnT, waitT, sel, over, won;
    const enemies = [], towers = [], beams = [];

    const pMoney = api.pill('$0');
    const pLives = api.pill('Inbox 20');
    const pWave = api.pill('Wave 0');

    const pTower = api.pill('Keyword filter $50');
    api.select('Filter', Object.keys(TOWERS).map((k) => ({ value: k, label: TOWERS[k].name + ' $' + TOWERS[k].cost })), 'filter', (v) => { sel = v; pTower.textContent = TOWERS[v].name + ' $' + TOWERS[v].cost; });
    const btnWave = api.button('Send wave', sendWave);
    const btnSpeed = api.button('Speed 1×', cycleSpeed);
    api.button('Restart', reset);
    let speed = 1;
    function cycleSpeed() { speed = speed === 1 ? 2 : speed === 2 ? 3 : 1; btnSpeed.textContent = 'Speed ' + speed + '×'; }

    function reset() {
      money = 150; lives = 20; wave = 0; score = 0; phase = 'build'; over = false; won = false;
      enemies.length = 0; towers.length = 0; beams.length = 0;
      spawnQ = 0; spawnT = 0; waitT = 0; sel = sel || 'filter';
      syncPills();
      api.status('Drop filters on empty tiles beside the wire, then Send wave. Keyword filters are cheap and fast, Shredders hit a splash, Quarantine slows the junk down. Keep the inbox above zero.');
    }

    function waveHp(w) { return 12 * Math.pow(1.28, w - 1); }
    function sendWave() {
      if (phase !== 'build' || over) return;
      wave++;
      spawnQ = 5 + wave * 2;
      spawnT = 0;
      phase = 'wave';
      api.sfx.blip(300);
      syncPills();
    }

    function spawnOne() {
      const hp = waveHp(wave);
      enemies.push({ d: -Math.random() * 6, hp: hp, max: hp, spd: 34 * (1 + wave * 0.02), slowT: 0 });
    }

    function cellFromXY(x, y) { return { c: Math.floor(x / CELL), r: Math.floor(y / CELL) }; }
    bagg.listen(cv.el, 'pointerdown', (e) => {
      if (over) return;
      const p = cv.pos(e); const { c, r } = cellFromXY(p.x, p.y);
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
      if (onPath.has(r + ',' + c)) { api.sfx.bad(); api.status('Cannot build on the wire.'); return; }
      if (towers.some((t) => t.r === r && t.c === c)) return;
      const spec = TOWERS[sel];
      if (money < spec.cost) { api.sfx.bad(); api.status('Not enough productivity for a ' + spec.name + '.'); return; }
      money -= spec.cost;
      towers.push({ r, c, x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, type: sel, cd: 0 });
      api.sfx.click(); syncPills();
    });

    function fire(t, spec) {
      let best = null;
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const p = posAt(e.d);
        if (Math.hypot(p.x - t.x, p.y - t.y) <= spec.range * CELL && (!best || e.d > best.d)) best = e;
      }
      if (!best) return;
      const bp = posAt(best.d);
      beams.push({ x1: t.x, y1: t.y, x2: bp.x, y2: bp.y, t: 0.08, col: spec.col });
      best.hp -= spec.dmg;
      if (spec.kind === 'slow') { best.slowT = 1.3; }
      if (spec.kind === 'splash') {
        for (const e of enemies) { if (e === best || e.hp <= 0) continue; const p = posAt(e.d); if (Math.hypot(p.x - bp.x, p.y - bp.y) <= spec.splash * CELL) e.hp -= spec.dmg * 0.6; }
      }
      t.cd = 1 / spec.rate;
      api.sfx.blip(spec.kind === 'shred' ? 180 : 600);
    }

    function update(dt) {
      if (over) return;
      for (const b of beams) b.t -= dt;
      for (let i = beams.length - 1; i >= 0; i--) if (beams[i].t <= 0) beams.splice(i, 1);

      if (phase === 'wave') {
        if (spawnQ > 0) { spawnT -= dt; if (spawnT <= 0) { spawnOne(); spawnQ--; spawnT = 0.55; } }
      }
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.hp <= 0) { enemies.splice(i, 1); money += 2 + Math.floor(wave / 3); score++; api.sfx.blip(880); syncPills(); continue; }
        if (e.slowT > 0) e.slowT -= dt;
        e.d += e.spd * (e.slowT > 0 ? 0.45 : 1) * dt;
        if (e.d >= pathLen) { enemies.splice(i, 1); lives--; api.sfx.bad(); syncPills(); if (lives <= 0) return end(false); }
      }
      for (const t of towers) { t.cd -= dt; if (t.cd <= 0) fire(t, TOWERS[t.type]); }

      if (phase === 'wave' && spawnQ === 0 && enemies.length === 0) {
        if (wave >= MAX_WAVE) return end(true);
        phase = 'build';
        money += 25 + wave * 5;              // end-of-wave bonus
        api.status('Wave ' + wave + ' cleared. +$' + (25 + wave * 5) + '. Build up, then Send wave ' + (wave + 1) + '.');
        syncPills();
      }
    }

    function end(win) {
      over = true; won = win; phase = 'over';
      const res = api.submit(score);
      api.sfx[win ? 'great' : 'bad']();
      api.status(win
        ? 'Inbox zero. You survived all ' + MAX_WAVE + ' waves and blocked ' + score + ' messages.'
        : 'The inbox overflowed on wave ' + wave + '. Blocked ' + score + ' messages' + (res && res.isRecord ? ' — a new best.' : '.'));
    }

    function syncPills() {
      pMoney.textContent = '$' + money;
      pLives.textContent = 'Inbox ' + Math.max(0, lives);
      pLives.className = 'pill ' + (lives <= 5 ? 'warn' : '');
      pWave.textContent = 'Wave ' + wave + '/' + MAX_WAVE;
      btnWave.disabled = phase !== 'build' || over;
    }

    function draw() {
      ctx.fillStyle = '#e7e0cf'; ctx.fillRect(0, 0, W, H);
      /* build tiles */
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (onPath.has(r + ',' + c)) continue;
        ctx.fillStyle = '#d8cfb8'; ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      }
      /* the wire */
      ctx.strokeStyle = '#3a3446'; ctx.lineWidth = CELL * 0.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
      ctx.strokeStyle = '#565064'; ctx.lineWidth = CELL * 0.5 - 6; ctx.stroke();
      /* inbox at the end */
      const end2 = pts[pts.length - 1];
      ctx.fillStyle = '#1c7a4a'; ctx.fillRect(end2.x - 14, end2.y - 12, 28, 24);
      ctx.fillStyle = '#fffdf3'; ctx.font = 'bold 9px Verdana'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('INBOX', end2.x, end2.y);

      /* towers + range on the selected type when affordable (hover-free hint: none) */
      for (const t of towers) {
        const spec = TOWERS[t.type];
        ctx.fillStyle = spec.col; ctx.strokeStyle = '#0c1119'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(t.x, t.y, CELL * 0.32, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fffdf3'; ctx.beginPath(); ctx.arc(t.x, t.y, CELL * 0.13, 0, 7); ctx.fill();
      }
      /* enemies: little envelopes with an HP bar */
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const p = posAt(e.d); const s = CELL * 0.34;
        ctx.fillStyle = e.slowT > 0 ? '#9fb6d8' : '#f4d03f';
        ctx.strokeStyle = '#3a3446'; ctx.lineWidth = 1.5;
        ctx.fillRect(p.x - s, p.y - s * 0.7, s * 2, s * 1.4); ctx.strokeRect(p.x - s, p.y - s * 0.7, s * 2, s * 1.4);
        ctx.beginPath(); ctx.moveTo(p.x - s, p.y - s * 0.7); ctx.lineTo(p.x, p.y + s * 0.05); ctx.lineTo(p.x + s, p.y - s * 0.7); ctx.stroke();
        const f = clamp(e.hp / e.max, 0, 1);
        ctx.fillStyle = '#e8402a'; ctx.fillRect(p.x - s, p.y - s * 1.15, s * 2, 3);
        ctx.fillStyle = '#6fcf2f'; ctx.fillRect(p.x - s, p.y - s * 1.15, s * 2 * f, 3);
      }
      /* beams */
      for (const b of beams) { ctx.strokeStyle = b.col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); }

      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      if (over) {
        ctx.fillStyle = 'rgba(20,16,12,.72)'; ctx.fillRect(0, H / 2 - 44, W, 88);
        ctx.fillStyle = won ? '#6fcf2f' : '#e8402a'; ctx.font = 'bold 34px Impact, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(won ? 'INBOX DEFENDED' : 'INBOX OVERFLOW', W / 2, H / 2 + 2);
        ctx.fillStyle = '#fffdf3'; ctx.font = '13px Verdana'; ctx.fillText('Blocked ' + score + ' messages — Restart to play again', W / 2, H / 2 + 26);
        ctx.textAlign = 'left';
      }
    }

    /* ---- test seam ---- */
    window.__spam = {
      state: () => ({ money, lives, wave, score, phase, enemies: enemies.length, towers: towers.length, over, won }),
      place(r, c, type) { if (!onPath.has(r + ',' + c) && !towers.some((t) => t.r === r && t.c === c) && money >= TOWERS[type].cost) { money -= TOWERS[type].cost; towers.push({ r, c, x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, type, cd: 0 }); return true; } return false; },
      send() { sendWave(); },
      grant(n) { money += n; },
      tick(sec) { let t = sec; while (t > 0) { const dt = Math.min(0.05, t); update(dt); t -= dt; } },
      onPath: (r, c) => onPath.has(r + ',' + c)
    };
    bagg.add(() => { if (window.__spam) delete window.__spam; });

    reset();
    bagg.add(Engine.loop((dt) => { for (let i = 0; i < speed; i++) update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'spamfilter',
    title: 'Spam Filter',
    emoji: 'spam',
    cat: 'brain',
    order: 32,
    blurb: 'Tower defense for your inbox. Junk mail crawls the wire toward your inbox; drop filters beside it to shred each message before it lands. Earn productivity per block and hold out for twelve waves.',
    scoreLabel: 'Messages blocked',
    tags: ['tower-defense', 'strategy', 'waves'],
    how: [
      'Junk mail enters top-left and follows the wire to your inbox. Each message that reaches the inbox costs one of your twenty slots, and hitting zero ends the run.',
      'Click an empty tile beside the wire to place the selected filter (you cannot build on the wire). Keyword filters are cheap and fast, Shredders hit a small blast, and Quarantine slows the junk so your other filters land more shots.',
      'You earn productivity for every message blocked, plus a bonus after each wave. Spend it on more filters between waves.',
      'Press Send wave when you are ready. Each wave brings more messages with more health, and the Speed button fast-forwards.',
      'Clear all twelve waves to win. Your score is the total messages blocked.'
    ],
    mount
  });
})();
