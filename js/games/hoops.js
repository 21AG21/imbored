/* Court — daft two-player physics sports. Two wobbly players on one keyboard
 * bounce, jump and boot a ball at each other's goal. Basketball (sink it in the
 * hoop) or Soccer (ram it into the net). Hotseat or versus a hapless CPU. */
(function () {
  'use strict';
  const { h, clamp } = Engine;
  const W = 720, H = 440, GROUND = H - 26;
  const PR = 26, BR = 14, GRAV = 1900, JUMP = 720, MOVE = 320, WIN = 7;
  /* the ball floats more than the players fall, so you can actually loft it up
     to the rim and it hangs long enough to aim — basketball, not a hot potato */
  const BALL_GRAV = 1180;
  const DOC = () => !!(window.Arcade && Arcade.docMode && Arcade.docMode());

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H, { maxHeight: '58vh' });
    const ctx = cv.ctx;
    const keys = Engine.keys(['a', 'd', 'w', 'A', 'D', 'W', 'ArrowLeft', 'ArrowRight', 'ArrowUp']);
    bagg.add(() => keys.dispose());

    let mode = '2p', sport = 'bball', p1, p2, ball, s1, s2, over, serveT, msg;

    const pScore = api.pill('0 — 0');
    const pMode = api.pill('Hotseat');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);

    api.select('Players', [{ value: '2p', label: '2 players (hotseat)' }, { value: '1p', label: '1 player (vs CPU)' }], '2p', (v) => { mode = v; reset(); });
    api.select('Sport', [{ value: 'bball', label: 'Basketball' }, { value: 'soccer', label: 'Soccer' }], 'bball', (v) => { sport = v; reset(); });
    api.button('New match', reset);

    /* touch: two thumbs */
    const pad = h('div', { class: 'hoops-pad' });
    const side = (cls, defs) => { const box = h('div', { class: 'hoops-side ' + cls }); defs.forEach(([l, code]) => { const b = h('button', { class: 'racer-btn', type: 'button' }, l); const set = (v) => { keys.state[code] = v; }; bagg.listen(b, 'pointerdown', (e) => { e.preventDefault(); set(true); }); bagg.listen(b, 'pointerup', () => set(false)); bagg.listen(b, 'pointerleave', () => set(false)); bagg.listen(b, 'pointercancel', () => set(false)); box.appendChild(b); }); return box; };
    pad.append(side('l', [['◀', 'a'], ['JUMP', 'w'], ['▶', 'd']]), side('r', [['◀', 'ArrowLeft'], ['JUMP', 'ArrowUp'], ['▶', 'ArrowRight']]));
    root.appendChild(pad);

    function reset() {
      p1 = { x: W * 0.25, y: GROUND, vx: 0, vy: 0, col: '#e8402a' };
      p2 = { x: W * 0.75, y: GROUND, vx: 0, vy: 0, col: '#2a7fd6' };
      s1 = 0; s2 = 0; over = false;
      serve(0);
      pMode.textContent = mode === '2p' ? 'Hotseat' : 'vs CPU';
      banner.style.display = 'none';
      sync();
      api.status(sport === 'bball'
        ? 'Basketball. Bump the ball into the OTHER player\'s hoop. Left player: A D move, W jump. Right player: arrows. First to ' + WIN + '.'
        : 'Soccer. Boot the ball into the OTHER player\'s goal. Left: A D W. Right: arrows. First to ' + WIN + '.');
    }

    function serve(dir) {
      ball = { x: W / 2, y: 120, vx: dir * 120, vy: 0 };
      serveT = 0.4;
    }
    function sync() { pScore.textContent = s1 + ' — ' + s2; }

    /* goals/hoops: p1 (left) attacks the RIGHT target; p2 attacks the LEFT target */
    function targets() {
      if (sport === 'bball') return { left: { hx: 98, hy: GROUND - 206, rw: 40 }, right: { hx: W - 98, hy: GROUND - 206, rw: 40 } };
      return { left: { gx: 0, gy: GROUND - 96, gw: 20, gh: 96 }, right: { gx: W - 20, gy: GROUND - 96, gw: 20, gh: 96 } };
    }

    function movePlayer(pl, left, right, jump) {
      pl.vx = (right ? MOVE : 0) - (left ? MOVE : 0);
      if (jump && pl.y >= GROUND - 0.5) pl.vy = -JUMP;
      pl.vy += GRAV * (1 / 60);
      pl.x = clamp(pl.x + pl.vx / 60, PR, W - PR);
      pl.y += pl.vy / 60;
      if (pl.y > GROUND) { pl.y = GROUND; pl.vy = 0; }
    }

    function cpu(pl) {
      /* the difficulty dial sets how sharply the deskmate reacts: a wide
         deadzone (laggy tracking) on chill, a tight one on nightmare, and it
         only reliably goes up for the ball on the harder tiers */
      const dz = clamp(46 - api.dm * 16, 6, 46);
      const left = ball.x < pl.x - dz, right = ball.x > pl.x + dz;
      const inRange = ball.y < pl.y - 40 && Math.abs(ball.x - pl.x) < 90 && pl.y >= GROUND - 0.5;
      const jump = inRange && (api.dm >= 1.4 || Math.random() < 0.14 + api.dm * 0.1);
      return { left, right, jump };
    }

    function kick(pl) {
      const dx = ball.x - pl.x, dy = ball.y - pl.y, d = Math.hypot(dx, dy) || 1;
      if (d < PR + BR) {
        const nx = dx / d, ny = dy / d;
        ball.x = pl.x + nx * (PR + BR); ball.y = pl.y + ny * (PR + BR);
        const power = 540;
        ball.vx = nx * power + pl.vx * 0.7;
        ball.vy = ny * power + pl.vy * 0.6 - 220;   // strong upward bias so a jump-and-bump lofts it rimward
        api.sfx.blip(300);
      }
    }

    function update(dt) {
      if (over) return;
      const j1 = keys.get('w', 'W'), j2 = keys.get('ArrowUp');
      movePlayer(p1, keys.get('a', 'A'), keys.get('d', 'D'), j1);
      if (mode === '2p') movePlayer(p2, keys.get('ArrowLeft'), keys.get('ArrowRight'), j2);
      else { const c = cpu(p2); movePlayer(p2, c.left, c.right, c.jump); }

      /* ball physics */
      if (serveT > 0) serveT -= dt;
      ball.vy += BALL_GRAV * dt;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx) * 0.75; }
      if (ball.x > W - BR) { ball.x = W - BR; ball.vx = -Math.abs(ball.vx) * 0.75; }
      if (ball.y < BR) { ball.y = BR; ball.vy = Math.abs(ball.vy) * 0.6; }
      if (ball.y > GROUND - BR) { ball.y = GROUND - BR; ball.vy = -Math.abs(ball.vy) * 0.68; ball.vx *= 0.9; if (Math.abs(ball.vy) < 40) ball.vy = 0; }
      kick(p1); kick(p2);

      const T = targets();
      if (sport === 'bball') {
        /* score when the ball drops through a rim from above */
        for (const [t, who] of [[T.right, 1], [T.left, 2]]) {
          if (ball.vy > 0 && Math.abs(ball.x - t.hx) < t.rw && ball.y > t.hy && ball.y < t.hy + 32) { return goal(who); }
        }
      } else {
        if (ball.x < T.left.gx + T.left.gw + BR && ball.y > T.left.gy) return goal(2);
        if (ball.x > T.right.gx - BR && ball.y > T.right.gy) return goal(1);
      }
    }

    function goal(who) {
      if (who === 1) s1++; else s2++;
      api.sfx.great(); sync();
      if (s1 >= WIN || s2 >= WIN) return end();
      serve(who === 1 ? -1 : 1);
    }

    function end() {
      over = true;
      const p1win = s1 > s2;
      if (mode === '1p') { if (p1win) { const w = api.load('wins', 0) + 1; api.save('wins', w); api.submit(w); } api.sfx[p1win ? 'great' : 'bad'](); }
      else api.sfx.great();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, mode === '2p' ? (p1win ? 'Red wins!' : 'Blue wins!') : (p1win ? 'You win!' : 'CPU wins.')),
        h('p', null, 'Final score ' + s1 + ' — ' + s2 + '.'),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Rematch'));
    }

    function drawPlayer(pl, face) {
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(pl.x, GROUND + 4, PR * 0.8, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = pl.col; ctx.beginPath(); ctx.arc(pl.x, pl.y - PR, PR, Math.PI, 0); ctx.rect(pl.x - PR, pl.y - PR, PR * 2, PR); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(pl.x + face * 8, pl.y - PR - 4, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#1d1722'; ctx.beginPath(); ctx.arc(pl.x + face * 10, pl.y - PR - 4, 2.4, 0, 7); ctx.fill();
    }

    function draw() {
      const doc0 = DOC();
      if (doc0) { ctx.fillStyle = Engine.docPaper(); ctx.fillRect(0, 0, W, H); }
      else {
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a6ea5'); g.addColorStop(1, '#5a86b8');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      ctx.fillStyle = doc0 ? Engine.docRule() : (sport === 'bball' ? '#c47a3a' : '#3a9d3a'); ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = doc0 ? Engine.docMut() : 'rgba(255,255,255,.25)'; ctx.fillRect(W / 2 - 1, 0, 2, GROUND);

      const T = targets();
      if (sport === 'bball') {
        for (const t of [T.left, T.right]) {
          const bx = t.hx < W / 2 ? 4 : W - 18;
          ctx.fillStyle = doc0 ? Engine.docMut() : '#ded6c2'; ctx.fillRect(bx, t.hy - 44, 14, 60);          // backboard post
          ctx.fillStyle = doc0 ? Engine.docInk() : '#e8402a'; ctx.fillRect(t.hx - t.rw, t.hy - 4, t.rw * 2, 6);  // rim
          ctx.strokeStyle = doc0 ? Engine.docInk() : 'rgba(255,255,255,.6)'; ctx.lineWidth = 1;
          for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(t.hx + i * t.rw * 0.7, t.hy); ctx.lineTo(t.hx + i * t.rw * 0.4, t.hy + 20); ctx.stroke(); }
        }
      } else {
        ctx.fillStyle = doc0 ? Engine.docInk() : 'rgba(255,255,255,.85)';
        ctx.fillRect(T.left.gx, T.left.gy, T.left.gw, T.left.gh);
        ctx.fillRect(T.right.gx, T.right.gy, T.right.gw, T.right.gh);
      }

      drawPlayer(p1, 1); drawPlayer(p2, -1);

      /* ball — the usual orange/white fills sit at almost the same luminance as
         the court behind them, so under any monochrome doc-mode transform they
         camouflage completely. In doc mode, force a dark fill with a bright
         halo so the ball reads regardless of what's behind it. */
      const doc = DOC();
      if (doc) {
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.beginPath(); ctx.arc(ball.x, ball.y, BR + 3, 0, 7); ctx.fill();
      }
      ctx.fillStyle = doc ? '#14171c' : (sport === 'bball' ? '#e8621f' : '#f4f4f4');
      ctx.beginPath(); ctx.arc(ball.x, ball.y, BR, 0, 7); ctx.fill();
      ctx.strokeStyle = doc ? '#14171c' : '#1d1722'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, BR, 0, 7); ctx.stroke();
      if (sport === 'bball') { ctx.beginPath(); ctx.moveTo(ball.x - BR, ball.y); ctx.lineTo(ball.x + BR, ball.y); ctx.moveTo(ball.x, ball.y - BR); ctx.lineTo(ball.x, ball.y + BR); ctx.stroke(); }
      void msg;
    }

    /* ---- test seam ---- */
    window.__hoops = {
      reset(m, sp) { if (m) mode = m; if (sp) sport = sp; reset(); },
      stats: () => ({ mode, sport, s1, s2, over, ball: { x: ball.x, y: ball.y }, p1: { x: p1.x, y: p1.y } }),
      hold(code, v) { keys.state[code] = v; },
      ballTo(x, y, vx, vy) { ball = { x, y, vx: vx || 0, vy: vy || 0 }; serveT = 0; },
      tick(sec) { let s = sec; while (s > 0) { const dt = Math.min(1 / 60, s); update(dt); s -= dt; } }
    };
    bagg.add(() => { if (window.__hoops) delete window.__hoops; });

    reset();
    bagg.add(Engine.loop((dt) => { update(Math.min(0.033, dt)); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'hoops',
    lightBoard: true,   // outdoor scene reads fine in plain greyscale; also needed so the doc-mode ball colour (authored dark) doesn't get inverted back to white
    title: 'Court',
    emoji: 'hoops',
    cat: 'action',
    order: 22,
    blurb: 'Two-player physics sport on one keyboard. Jump and boot the ball into the other player\'s target, basketball through the hoop or soccer into the net. Play a friend or the CPU.',
    scoreLabel: 'CPU wins',
    tags: ['sports', 'basketball', 'soccer', 'hotseat', 'physics'],
    how: [
      'Left player moves with A and D and jumps with W. Right player uses the arrow keys. On touch, each half of the screen has its own buttons.',
      'Jump into the ball to launch it. In Basketball, knock it down through the other player\'s hoop; in Soccer, push it into their net at the edge.',
      'The ball bounces off the floor, walls, and both players, so shots get messy.',
      'First to seven points wins. Pick Basketball or Soccer from the menu.',
      'Set Players to 1 to face the CPU. Beating it adds to your score.'
    ],
    mount
  });
})();
