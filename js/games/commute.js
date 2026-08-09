/* The Commute. Cross the open-plan office without being flattened by a chair. */
(function () {
  'use strict';
  const { h, clamp, rand, randInt, pick } = Engine;

  const COLS = 20, CELLW = 42;
  const W = COLS * CELLW;          // 840
  const ROWH = 46, ROWS = 12;
  const H = ROWS * ROWH + 34;      // room for the desk row label
  const TOP = 34;

  const rowY = (r) => TOP + (ROWS - 1 - r) * ROWH;   // row 0 at the bottom

  /* office hazards, drawn rather than typed */
  const HAZARDS = [
    { kind: 'chair', w: 46, col: '#4a4155' },
    { kind: 'cart', w: 64, col: '#a79e88' },
    { kind: 'printer', w: 58, col: '#cfc6ae' },
    { kind: 'trolley', w: 50, col: '#00a6b4' }
  ];

  function drawHazard(ctx, k, w, hgt) {
    ctx.fillStyle = k.col;
    if (k.kind === 'chair') {
      ctx.fillRect(-w / 2, -4, w, 9);
      ctx.fillRect(-w / 2 + 4, -hgt / 2 + 2, 8, 14);
      ctx.fillStyle = '#1d1722';
      ctx.beginPath(); ctx.arc(-w / 2 + 7, 10, 4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(w / 2 - 7, 10, 4, 0, 7); ctx.fill();
    } else if (k.kind === 'cart') {
      ctx.fillRect(-w / 2, -hgt / 2 + 4, w, hgt - 14);
      ctx.fillStyle = '#1d1722';
      ctx.fillRect(-w / 2, -hgt / 2 + 4, w, 3);
      ctx.beginPath(); ctx.arc(-w / 2 + 8, hgt / 2 - 8, 4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(w / 2 - 8, hgt / 2 - 8, 4, 0, 7); ctx.fill();
    } else if (k.kind === 'printer') {
      ctx.fillRect(-w / 2, -10, w, 20);
      ctx.fillStyle = '#fffdf3';
      ctx.fillRect(-w / 2 + 6, -16, w - 12, 7);
      ctx.fillStyle = '#1d1722';
      ctx.fillRect(-w / 2 + 5, 2, w - 10, 4);
    } else {
      ctx.fillRect(-w / 2, -hgt / 2 + 6, w, hgt - 16);
      ctx.fillStyle = '#1d1722';
      ctx.fillRect(-w / 2 + 4, -hgt / 2 + 10, w - 8, 4);
      ctx.beginPath(); ctx.arc(-w / 2 + 9, hgt / 2 - 10, 4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(w / 2 - 9, hgt / 2 - 10, 4, 0, 7); ctx.fill();
    }
  }

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;
    const dm = api.dm;

    let px, py, row, lanes, belts, desks, lives, score, over, dead, deadT, round, hopT, best;

    const pScore = api.pill('Score: 0');
    const pLives = api.pill('♥♥♥');
    const pRound = api.pill('Round 1');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);
    Engine.dpad(root, (d) => { if (d !== 'action') hop(d); }, { class: 'touch-only' });

    function reset(full) {
      if (full) { lives = 3; score = 0; round = 1; }
      desks = [false, false, false, false, false];
      buildLanes();
      spawnPlayer();
      over = false;
      banner.style.display = 'none';
      api.status('Arrows or WASD to hop. Lanes 1 to 4 will flatten you. The belts up top will only carry you if you land on a box.');
      sync();
    }

    function buildLanes() {
      const spd = (1 + (round - 1) * 0.16) * dm;
      lanes = [];
      for (let r = 1; r <= 4; r++) {
        const dir = r % 2 ? 1 : -1;
        const speed = dir * rand(58, 116) * spd;
        const items = [];
        const n = randInt(3, 5);
        const gap = W / n;
        const type = pick(HAZARDS);
        for (let i = 0; i < n; i++) {
          items.push({ x: i * gap + rand(0, gap * 0.4), w: type.w, kind: type });
        }
        lanes.push({ r, speed, items });
      }
      belts = [];
      for (let r = 7; r <= 10; r++) {
        const dir = r % 2 ? -1 : 1;
        const speed = dir * rand(44, 92) * spd;
        /* boxes have to cover most of the belt or landing on one is a coin flip */
        const items = [];
        const n = randInt(4, 5);
        const gap = W / n;
        for (let i = 0; i < n; i++) {
          items.push({ x: i * gap + rand(0, gap * 0.18), w: gap * rand(0.66, 0.82) });
        }
        belts.push({ r, speed, items });
      }
    }

    function spawnPlayer() {
      row = 0;
      px = W / 2;
      py = rowY(0);
      dead = false;
      deadT = 0;
      hopT = 0;
    }

    function sync() {
      pScore.textContent = 'Score: ' + score;
      pLives.textContent = lives > 0 ? '♥'.repeat(lives) : '--';
      pLives.className = 'pill ' + (lives <= 1 ? 'bad' : '');
      pRound.textContent = 'Round ' + round;
    }

    function hop(d) {
      if (over || dead) return;
      if (d === 'up' && row < ROWS - 1) { row++; score += 2; hopT = 0.12; }
      else if (d === 'down' && row > 0) { row--; hopT = 0.12; }
      else if (d === 'left') { px = clamp(px - CELLW, 16, W - 16); hopT = 0.1; }
      else if (d === 'right') { px = clamp(px + CELLW, 16, W - 16); hopT = 0.1; }
      else return;
      api.sfx.tone({ freq: 520, to: 700, dur: 0.05, type: 'square', vol: 0.06 });
      if (row === ROWS - 1) arrive();
      sync();
    }

    function arrive() {
      const slot = Math.floor(px / (W / 5));
      if (slot < 0 || slot > 4 || desks[slot]) { return die('That desk is taken.'); }
      desks[slot] = true;
      score += 60;
      api.sfx.good();
      if (desks.every(Boolean)) {
        round++;
        score += 250;
        desks = [false, false, false, false, false];
        buildLanes();
        api.sfx.great();
      }
      spawnPlayer();
      sync();
    }

    function die(why) {
      if (dead) return;
      dead = true;
      deadT = 0.9;
      lives--;
      api.sfx.boom();
      sync();
      if (lives <= 0) {
        over = true;
        const res = api.submit(score);
        banner.style.display = '';
        banner.replaceChildren(
          h('h3', null, 'Flattened.'),
          h('p', null, why + ' Final score ' + score + ' on round ' + round + '.' +
            (res.isRecord ? ' New best!' : res.isFirst ? '' : ' Best: ' + res.best + '.')),
          h('button', { class: 'btn primary', type: 'button', onclick: () => reset(true) }, 'Try the commute again'));
      }
    }

    function update(dt) {
      if (over) return;
      if (dead) { deadT -= dt; if (deadT <= 0) spawnPlayer(); return; }
      if (hopT > 0) hopT -= dt;

      for (const l of lanes.concat(belts)) {
        for (const it of l.items) {
          it.x += l.speed * dt;
          if (l.speed > 0 && it.x > W + 40) it.x = -it.w - rand(20, 120);
          if (l.speed < 0 && it.x < -it.w - 40) it.x = W + rand(20, 120);
        }
      }

      py += (rowY(row) - py) * Math.min(1, dt * 18);

      /* traffic lanes squash you */
      const lane = lanes.find((l) => l.r === row);
      if (lane) {
        for (const it of lane.items) {
          if (px > it.x - 15 && px < it.x + it.w + 15) return die('A rolling chair got you.');
        }
      }

      /* belts carry you, and only if you are standing on something */
      const belt = belts.find((b) => b.r === row);
      if (belt) {
        /* a short grace after landing, so a hop onto the edge of a box is not instant death */
        const edge = hopT > 0 ? 14 : 0;
        const on = belt.items.find((it) => px > it.x - edge && px < it.x + it.w + edge);
        if (!on) return die('You stepped onto a moving belt with nothing on it.');
        px += belt.speed * dt;
        if (px < 6 || px > W - 6) return die('The belt carried you into the wall.');
      }
    }

    function draw() {
      ctx.fillStyle = '#141a26';
      ctx.fillRect(0, 0, W, H);

      /* row backgrounds */
      for (let r = 0; r < ROWS; r++) {
        const y = rowY(r);
        let col = '#1e2635';
        if (r === 0 || r === 5 || r === 6) col = '#2b3548';           // safe carpet
        else if (r >= 1 && r <= 4) col = '#232c3d';                   // walkway
        else if (r >= 7 && r <= 10) col = '#12303a';                  // belts
        else if (r === 11) col = '#3b2e1c';                           // desks
        ctx.fillStyle = col;
        ctx.fillRect(0, y, W, ROWH);
        if (r >= 7 && r <= 10) {
          ctx.strokeStyle = 'rgba(255,255,255,.06)';
          ctx.lineWidth = 2;
          for (let x = 0; x < W; x += 22) {
            ctx.beginPath();
            ctx.moveTo(x, y); ctx.lineTo(x + 10, y + ROWH);
            ctx.stroke();
          }
        }
      }

      /* desks along the top */
      for (let i = 0; i < 5; i++) {
        const x = i * (W / 5);
        ctx.fillStyle = desks[i] ? '#6fcf2f' : '#5d452a';
        ctx.fillRect(x + 8, rowY(11) + 6, W / 5 - 16, ROWH - 12);
        ctx.strokeStyle = '#0c1119';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 8, rowY(11) + 6, W / 5 - 16, ROWH - 12);
        const dx = x + W / 10, dy = rowY(11) + ROWH / 2;
        ctx.fillStyle = desks[i] ? '#1d1722' : '#cfc6ae';
        ctx.fillRect(dx - 13, dy - 8, 26, 15);
        ctx.fillStyle = desks[i] ? '#1d1722' : '#8a6a3a';
        ctx.fillRect(dx - 4, dy + 7, 8, 5);
      }

      /* belts first, so hazards draw over them cleanly */
      for (const b of belts) {
        const y = rowY(b.r);
        for (const it of b.items) {
          ctx.fillStyle = '#8a6a3a';
          ctx.fillRect(it.x, y + 7, it.w, ROWH - 14);
          ctx.strokeStyle = '#0c1119';
          ctx.lineWidth = 3;
          ctx.strokeRect(it.x, y + 7, it.w, ROWH - 14);
          ctx.strokeStyle = '#c9a06a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(it.x + 6, y + ROWH / 2); ctx.lineTo(it.x + it.w - 6, y + ROWH / 2);
          ctx.stroke();
        }
      }

      for (const l of lanes) {
        const y = rowY(l.r);
        for (const it of l.items) {
          ctx.save();
          ctx.translate(it.x + it.w / 2, y + ROWH / 2);
          if (l.speed < 0) ctx.scale(-1, 1);
          drawHazard(ctx, it.kind, it.w, ROWH - 8);
          ctx.restore();
        }
      }

      /* you */
      if (!dead || Math.floor(deadT * 12) % 2) {
        const s = hopT > 0 ? 1.18 : 1;
        ctx.save();
        ctx.translate(px, py + ROWH / 2);
        ctx.scale(s, s);
        if (dead) {
          ctx.fillStyle = '#e8402a';
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const a = i / 10 * Math.PI * 2, rr = i % 2 ? 7 : 15;
            i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          ctx.closePath(); ctx.fill();
        } else {
          ctx.fillStyle = '#00a6b4';
          ctx.beginPath(); ctx.arc(0, -9, 5.5, 0, 7); ctx.fill();
          ctx.fillRect(-5, -3, 10, 11);
          ctx.fillRect(-5, 8, 4, 6);
          ctx.fillRect(1, 8, 4, 6);
        }
        ctx.restore();
      }

      ctx.fillStyle = '#ded6c2';
      ctx.font = 'bold 12px Verdana, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('GET TO A FREE DESK', 10, 22);
      ctx.textAlign = 'right';
      ctx.fillText(desks.filter(Boolean).length + ' / 5 SEATED', W - 10, 22);
      ctx.textAlign = 'left';
    }

    bagg.add(Engine.onKey((e) => {
      const m = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right'
      }[e.key];
      if (m) { hop(m); return true; }
    }));
    bagg.add(Engine.swipe(cv.el, hop));

    api.button('Restart', () => reset(true));
    reset(true);
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'commute',
    title: 'The Commute',
    emoji: 'commute',
    cat: 'action',
    order: 34,
    blurb: 'Cross the open-plan office to a free desk. Four lanes of rolling chairs first, then conveyor belts where standing on empty floor kills you.',
    scoreLabel: 'Score',
    tags: ['frogger', 'crossing', 'office', 'arcade'],
    how: [
      'Arrows, WASD or swipe to hop one square at a time.',
      'The bottom four lanes are traffic. Touch anything in them and you lose a life.',
      'The four belts near the top carry you sideways. Land on a box; empty belt is fatal.',
      'Fill all five desks to clear the round. Everything speeds up after each one.',
      'Three lives. Every square forward scores, and each desk is worth sixty.'
    ],
    mount
  });
})();
