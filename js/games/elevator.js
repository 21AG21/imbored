/* Elevator Rush. Dispatch three lifts in a tower full of late people. */
(function () {
  'use strict';
  const { h, clamp, rand, randInt, pick } = Engine;

  const W = 860, H = 600;
  const FLOORS = 8;
  const CAP = 5;
  const SHAFT_X = [400, 540, 680];
  const SHAFT_W = 86;
  const SPEED = 2.3;            // floors per second
  const DOOR_T = 1.05;
  const MAX_FURY = 5;

  const floorY = (f) => 540 - f * 62;
  const floorName = (f) => (f === 0 ? 'L' : String(f + 1));
  const DESTC = ['#38e1ff', '#ff5c8f', '#9dff5c', '#ffc043', '#c08cff', '#ff8f4d', '#59f0d0', '#f0f4ff'];

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;
    const dm = api.dm;
    const PATIENCE = 26 / dm;

    const pDone = api.pill('Delivered: 0');
    const pWait = api.pill('Waiting: 0');
    const pFury = api.pill('Stormed off: 0/' + MAX_FURY);
    const banner = h('div', { class: 'banner', style: { display: 'none' } });

    let lifts, waiting, delivered, fury, spawnT, elapsed, over, wave;

    function reset() {
      lifts = SHAFT_X.map((x, i) => ({
        x, f: i * 3, target: null, queue: new Set(), dir: 1,
        door: 0, pax: [], flash: 0
      }));
      waiting = [];
      for (let f = 0; f < FLOORS; f++) waiting.push([]);
      delivered = 0; fury = 0; spawnT = 1; elapsed = 0; wave = 1; over = false;
      banner.style.display = 'none';
      api.status('Click a floor inside a lift shaft to send that lift there. Passengers press their own buttons once aboard.');
      for (let i = 0; i < 3; i++) addPerson();
    }

    function addPerson() {
      const from = randInt(0, FLOORS - 1);
      let to = randInt(0, FLOORS - 1);
      while (to === from) to = randInt(0, FLOORS - 1);
      if (waiting[from].length > 7) return;
      waiting[from].push({ dest: to, p: PATIENCE, max: PATIENCE });
    }

    function nextTarget(L) {
      if (!L.queue.size) return null;
      const list = [...L.queue];
      const ahead = list.filter((f) => (L.dir > 0 ? f > L.f + 0.01 : f < L.f - 0.01));
      const pool = ahead.length ? ahead : list;
      let best = pool[0], bd = Math.abs(pool[0] - L.f);
      for (const f of pool) {
        const d = Math.abs(f - L.f);
        if (d < bd) { bd = d; best = f; }
      }
      return best;
    }

    function update(dt) {
      if (over) return;
      elapsed += dt;

      wave = 1 + Math.floor(elapsed / 30);
      spawnT -= dt;
      if (spawnT <= 0) {
        addPerson();
        spawnT = Math.max(0.7, 3.4 - wave * 0.26) * rand(0.6, 1.4) / dm;
      }

      /* patience */
      let totalWaiting = 0;
      for (let f = 0; f < FLOORS; f++) {
        const q = waiting[f];
        for (let i = q.length - 1; i >= 0; i--) {
          q[i].p -= dt;
          if (q[i].p <= 0) {
            q.splice(i, 1);
            fury++;
            api.sfx.bad();
            if (fury >= MAX_FURY) endGame();
          }
        }
        totalWaiting += q.length;
      }

      for (const L of lifts) {
        L.flash = Math.max(0, L.flash - dt);
        if (L.door > 0) {
          L.door -= dt;
          if (L.door <= 0) L.target = nextTarget(L);
          continue;
        }
        if (L.target == null) { L.target = nextTarget(L); if (L.target == null) continue; }

        const d = L.target - L.f;
        if (Math.abs(d) < 0.02) {
          L.f = L.target;
          const fl = Math.round(L.f);
          L.queue.delete(fl);
          L.door = DOOR_T;

          const before = L.pax.length;
          L.pax = L.pax.filter((p) => p.dest !== fl);
          const dropped = before - L.pax.length;
          if (dropped) { delivered += dropped; api.sfx.good(); }

          const q = waiting[fl];
          while (L.pax.length < CAP && q.length) {
            const p = q.shift();
            L.pax.push(p);
            L.queue.add(p.dest);
          }
          L.target = null;
          continue;
        }
        L.dir = d > 0 ? 1 : -1;
        L.f += clamp(d, -SPEED * dt, SPEED * dt);
      }

      pDone.textContent = 'Delivered: ' + delivered;
      pWait.textContent = 'Waiting: ' + totalWaiting;
      pFury.textContent = 'Stormed off: ' + fury + '/' + MAX_FURY;
      pFury.className = 'pill ' + (fury >= MAX_FURY - 1 ? 'bad' : fury > 1 ? 'warn' : '');
    }

    function endGame() {
      over = true;
      const res = api.submit(delivered);
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'The tenants have taken the stairs.'),
        h('p', null, delivered + ' people delivered in ' + Engine.fmtTime(elapsed) + '.' +
          (res.isRecord ? ' New personal best!' : res.isFirst ? '' : ' Best: ' + res.best + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Run it back'));
    }

    /* ---------------- render ---------------- */
    function draw() {
      ctx.fillStyle = '#0b1020';
      ctx.fillRect(0, 0, W, H);

      /* building shell */
      ctx.fillStyle = '#121a2e';
      Engine.roundRect(ctx, 24, 60, W - 48, H - 92, 14);
      ctx.fill();

      ctx.textBaseline = 'middle';
      for (let f = 0; f < FLOORS; f++) {
        const y = floorY(f);
        ctx.strokeStyle = '#1e2740';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, y + 26); ctx.lineTo(W - 40, y + 26);
        ctx.stroke();

        ctx.fillStyle = '#5f6a86';
        ctx.font = 'bold 13px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(floorName(f), 46, y);

        /* waiting people */
        const q = waiting[f];
        const shown = Math.min(q.length, 8);
        for (let i = 0; i < shown; i++) {
          const p = q[i];
          const px = 78 + i * 34;
          const frac = clamp(p.p / p.max, 0, 1);
          ctx.fillStyle = DESTC[p.dest % DESTC.length];
          ctx.globalAlpha = 0.25 + frac * 0.75;
          ctx.beginPath();
          ctx.arc(px, y - 6, 7, 0, 7);
          ctx.fill();
          Engine.roundRect(ctx, px - 6, y + 2, 12, 12, 3);
          ctx.fill();
          ctx.globalAlpha = 1;

          ctx.fillStyle = '#0b1020';
          ctx.font = 'bold 9px ui-monospace, Menlo, monospace';
          ctx.fillText(floorName(p.dest), px, y + 8);

          /* patience bar */
          ctx.fillStyle = '#1b2338';
          ctx.fillRect(px - 11, y + 17, 22, 3);
          ctx.fillStyle = frac > 0.5 ? '#4ade5e' : frac > 0.22 ? '#ffc043' : '#ff4d5e';
          ctx.fillRect(px - 11, y + 17, 22 * frac, 3);
        }
        if (q.length > shown) {
          ctx.fillStyle = '#8f9ab8';
          ctx.font = 'bold 12px system-ui';
          ctx.fillText('+' + (q.length - shown), 78 + shown * 34, y);
        }
      }

      /* shafts */
      lifts.forEach((L, li) => {
        const x = L.x - SHAFT_W / 2;
        ctx.fillStyle = '#0d1424';
        Engine.roundRect(ctx, x, floorY(FLOORS - 1) - 28, SHAFT_W, FLOORS * 62 + 4, 8);
        ctx.fill();

        /* queued stops */
        for (const f of L.queue) {
          const y = floorY(f);
          ctx.fillStyle = 'rgba(56,225,255,.16)';
          ctx.fillRect(x + 3, y - 26, SHAFT_W - 6, 52);
          ctx.fillStyle = '#38e1ff';
          ctx.beginPath();
          ctx.arc(x + 10, y, 3.5, 0, 7);
          ctx.fill();
        }

        /* car */
        const cy = floorY(L.f);
        ctx.fillStyle = '#25314e';
        Engine.roundRect(ctx, x + 6, cy - 25, SHAFT_W - 12, 50, 7);
        ctx.fill();
        ctx.strokeStyle = L.door > 0 ? '#9dff5c' : '#3d4a70';
        ctx.lineWidth = 2;
        Engine.roundRect(ctx, x + 6, cy - 25, SHAFT_W - 12, 50, 7);
        ctx.stroke();

        /* doors */
        const openAmt = L.door > 0 ? clamp(Math.sin((1 - Math.abs(L.door / DOOR_T - 0.5) * 2) * Math.PI / 2), 0, 1) : 0;
        const half = (SHAFT_W - 16) / 2;
        ctx.fillStyle = '#36436a';
        ctx.fillRect(x + 8, cy - 23, half * (1 - openAmt), 46);
        ctx.fillRect(x + 8 + half + half * openAmt, cy - 23, half * (1 - openAmt), 46);

        /* passengers */
        L.pax.forEach((p, i) => {
          ctx.fillStyle = DESTC[p.dest % DESTC.length];
          ctx.beginPath();
          ctx.arc(x + 20 + (i % 3) * 16, cy - 8 + Math.floor(i / 3) * 17, 5.5, 0, 7);
          ctx.fill();
        });

        ctx.fillStyle = '#8f9ab8';
        ctx.font = 'bold 11px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('LIFT ' + (li + 1) + '  ' + L.pax.length + '/' + CAP, L.x, 42);
        ctx.fillText(floorName(Math.round(L.f)) + (L.door > 0 ? ' ▤' : L.target != null ? (L.dir > 0 ? ' ▲' : ' ▼') : ' ·'), L.x, H - 22);
      });

      if (Engine.paused && !over) {
        ctx.fillStyle = 'rgba(8,11,20,.62)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#e8ecf7';
        ctx.font = 'bold 24px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('paused', W / 2, H / 2);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    bagg.listen(cv.el, 'pointerdown', (e) => {
      if (over) return;
      const p = cv.pos(e);
      const li = lifts.findIndex((L) => Math.abs(p.x - L.x) < SHAFT_W / 2 + 8);
      if (li < 0) return;
      let bf = -1, bd = 1e9;
      for (let f = 0; f < FLOORS; f++) {
        const d = Math.abs(p.y - floorY(f));
        if (d < bd) { bd = d; bf = f; }
      }
      if (bd > 34) return;
      const L = lifts[li];
      if (L.queue.has(bf)) L.queue.delete(bf);
      else { L.queue.add(bf); L.flash = 0.3; }
      if (L.target != null && !L.queue.has(L.target) && L.door <= 0) L.target = null;
      api.sfx.click();
    });

    api.button('Restart', reset);
    api.button('Clear all calls', () => lifts.forEach((L) => { L.queue.clear(); if (L.door <= 0) L.target = null; }));
    root.appendChild(banner);

    reset();
    let rafId = 0;
    (function paint() { rafId = requestAnimationFrame(paint); if (Engine.paused) draw(); })();
    bagg.add(() => cancelAnimationFrame(rafId));
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'elevator',
    title: 'Elevator Rush',
    emoji: 'elevator',
    cat: 'sim',
    order: 2,
    blurb: 'Dispatch three lifts across eight floors. Send each car where you want; riders board and pick their own floor. Five walk-offs ends the shift.',
    scoreLabel: 'Delivered',
    tags: ['lift', 'dispatch', 'tower', 'scheduling'],
    how: [
      'Click a floor inside a lift shaft to send that car there. Click again to cancel.',
      'People board on their own when the doors open and press their floor. You only route the cars.',
      'Five riders per lift. The colored dot shows where each one is headed.',
      'The bar under a waiting person is their patience. Five walk-offs ends the shift.',
      'Your score is people delivered.'
    ],
    mount
  });
})();
