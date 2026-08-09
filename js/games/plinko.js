/* Quarter Plinko — drop a chip, watch it clatter down the pegs, take whatever
   slot it lands in. Fifteen chips a round; the edges pay big and hurt big. */
(function () {
  'use strict';
  const { h, clamp, randInt } = Engine;
  const W = 380, H = 470;
  const ROWS = 9, PEG_R = 4.5, CHIP_R = 7;
  const TOP = 60, BOT = H - 70;

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;

    let pegs, slots, chips, banked, left, over;
    const CHIPS = 15;
    // difficulty widens the spread — nightmare edges pay (and punish) harder
    const edge = Math.round(6 + api.dm * 6);
    const SLOTVALS = buildSlots(edge);

    const pBank = api.pill('banked 0');
    const pLeft = api.pill('chips ' + CHIPS);
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);
    api.button('New round', reset);

    function buildSlots(e) {
      // 9 slots, symmetric: big pay at the edges, a real PENALTY just inside them,
      // then a calm middle — so the edges genuinely pay big and sting big
      const t = Math.round(e / 3);
      return [e, -t, 3, 1, 0, 1, 3, -t, e];
    }

    function build() {
      pegs = [];
      const gapY = (BOT - TOP) / ROWS;
      for (let r = 0; r < ROWS; r++) {
        const count = r + 3;
        const span = W - 60;
        const step = span / (count - 1);
        const x0 = (W - span) / 2;
        const y = TOP + r * gapY;
        for (let i = 0; i < count; i++) pegs.push({ x: x0 + i * step, y });
      }
      slots = [];
      const S = SLOTVALS.length, sw = W / S;
      for (let i = 0; i < S; i++) slots.push({ x1: i * sw, x2: (i + 1) * sw, v: SLOTVALS[i] });
    }

    function reset() {
      build();
      chips = []; banked = 0; left = CHIPS; over = false;
      banner.style.display = 'none';
      pBank.textContent = 'banked 0'; pLeft.textContent = 'chips ' + CHIPS;
      api.status('Tap along the top to drop a chip. It rattles down into a slot — the outer slots pay the most, the two just inside them take points away, and the middle is a wash. You get ' + CHIPS + ' chips.');
    }

    function drop(x) {
      if (over || left <= 0) return;
      x = clamp(x, 12, W - 12);
      chips.push({ x, y: 24, vx: randInt(-20, 20) / 10, vy: 0, done: false });
      left--; pLeft.textContent = 'chips ' + left;
      api.sfx.blip(500);
    }
    bagg.listen(cv.el, 'pointerdown', (e) => { e.preventDefault(); const p = cv.pos(e); drop(p.x); });

    function step(dt) {
      const G = 620;
      for (const c of chips) {
        if (c.done) continue;
        c.vy += G * dt;
        c.x += c.vx * dt; c.y += c.vy * dt;
        // walls
        if (c.x < CHIP_R) { c.x = CHIP_R; c.vx = Math.abs(c.vx) * 0.6; }
        if (c.x > W - CHIP_R) { c.x = W - CHIP_R; c.vx = -Math.abs(c.vx) * 0.6; }
        // pegs
        for (const p of pegs) {
          const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy), min = PEG_R + CHIP_R;
          if (d < min && d > 0) {
            const nx = dx / d, ny = dy / d;
            c.x = p.x + nx * min; c.y = p.y + ny * min;
            const dot = c.vx * nx + c.vy * ny;
            c.vx = (c.vx - 2 * dot * nx) * 0.55 + (Math.random() - 0.5) * 40;
            c.vy = (c.vy - 2 * dot * ny) * 0.55;
            if (Math.random() < 0.3) api.sfx.blip(720 + Math.random() * 120);
          }
        }
        if (c.y >= BOT) { c.y = BOT; landChip(c); }
      }
      if (over) return;
      if (left === 0 && chips.every((c) => c.done)) finish();
    }

    function landChip(c) {
      c.done = true;
      const s = slots.find((sl) => c.x >= sl.x1 && c.x < sl.x2) || slots[slots.length - 1];
      banked = Math.max(0, banked + s.v);        // a penalty slot can eat into the bank, but not below zero
      pBank.textContent = 'banked ' + banked;
      c.slot = s;
      if (s.v >= SLOTVALS[0]) api.sfx.great();
      else if (s.v < 0) api.sfx.bad();
      else if (s.v === 0) api.sfx.thud();
      else api.sfx.good();
    }

    function finish() {
      over = true;
      const best = api.best();
      const rec = api.submit(banked);
      banner.style.display = '';
      banner.className = 'banner' + (rec && rec.isRecord ? ' win' : '');
      banner.replaceChildren(
        h('h3', null, banked + ' banked'),
        h('p', null, rec && rec.isRecord ? 'New best round!' : (best != null ? 'Best round: ' + Math.max(best, banked) : '')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Another round'));
      if (rec && rec.isRecord) { try { const r = banner.getBoundingClientRect(); Engine.fx.burst(r.left + r.width / 2, r.top + 24, 46); } catch (e) { /* ignore */ } }
    }

    function draw() {
      ctx.fillStyle = '#1b1630'; ctx.fillRect(0, 0, W, H);
      // slots
      for (const s of slots) {
        const big = s.v >= SLOTVALS[0], zero = s.v === 0, neg = s.v < 0;
        ctx.fillStyle = big ? '#3a9d3a' : neg ? '#b3312a' : zero ? '#3a3450' : s.v >= 3 ? '#6f3fa8' : '#00838d';
        ctx.fillRect(s.x1 + 1, BOT + 4, s.x2 - s.x1 - 2, H - BOT - 8);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
        ctx.fillText((s.v > 0 ? '+' : '') + s.v, (s.x1 + s.x2) / 2, BOT + 26);
      }
      ctx.textAlign = 'left';
      // pegs
      ctx.fillStyle = '#cdbef2';
      for (const p of pegs) { ctx.beginPath(); ctx.arc(p.x, p.y, PEG_R, 0, 7); ctx.fill(); }
      // chips
      for (const c of chips) {
        ctx.fillStyle = c.done ? '#8a7fb0' : '#ffcb1f';
        ctx.beginPath(); ctx.arc(c.x, c.y, CHIP_R, 0, 7); ctx.fill();
        ctx.strokeStyle = '#1d1722'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      // drop hint line
      if (!over) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, 22, W, 1); }
    }

    reset();
    bagg.add(Engine.loop((dt) => { step(Math.min(0.04, dt)); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'plinko', title: 'Quarter Plinko', emoji: 'plinko', cat: 'goof', order: 44,
    blurb: 'Drop a chip and watch it rattle down through the pegs into a payout slot. The outer slots pay big — but the two just inside them take points away, so aiming for the edge is a gamble. Fifteen chips to a round.',
    scoreLabel: 'Best round', tags: ['luck', 'physics', 'risk'],
    how: [
      'Tap anywhere along the top to drop a chip from that spot.',
      'It clatters down through the pegs — where it ends up is mostly up to the bounces.',
      'The outer slots pay the most; the two slots just inside them are penalties that eat into your bank; the middle is a wash.',
      'You get fifteen chips a round. Your bank never drops below zero. Bank as much as you dare.'
    ],
    mount
  });
})();
