/* Desk Tennis. You versus a CPU that never gets up for coffee. */
(function () {
  'use strict';
  const { h, clamp, rand } = Engine;
  const W = 820, H = 520;
  const PW = 14, PH = 96, MARGIN = 26, BR = 9;
  const WIN = 7;

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;
    const keys = Engine.keys(['ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S']);
    bagg.add(() => keys.dispose());

    let you, cpu, ball, youScore, cpuScore, rally, bestRally, over, serveT;

    const pScore = api.pill('0 – 0');
    const pRally = api.pill('Rally: 0');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);
    api.button('Rematch', reset);

    let pointerY = null;
    bagg.listen(cv.el, 'pointermove', (e) => { pointerY = cv.pos(e).y; });
    bagg.listen(cv.el, 'pointerdown', (e) => { pointerY = cv.pos(e).y; });
    bagg.listen(cv.el, 'pointerleave', () => { pointerY = null; });

    function reset() {
      you = { y: H / 2 };
      cpu = { y: H / 2 };
      youScore = 0; cpuScore = 0; bestRally = 0; over = false;
      pointerY = null;
      serve(1);
      api.status('Mouse or drag to move your bat. Up/Down or W/S work too. First to ' + WIN + ' takes it.');
      sync();
    }

    function serve(dir) {
      rally = 0;
      const ang = rand(-0.32, 0.32);
      const sp = 360;
      ball = { x: W / 2, y: H / 2, vx: dir * sp * Math.cos(ang), vy: sp * Math.sin(ang) };
      serveT = 0.8;
    }

    function hit(pad) {
      const off = clamp((ball.y - pad.y) / (PH / 2), -1, 1);
      const sp = Math.min(780, Math.hypot(ball.vx, ball.vy) * 1.06 + 14);
      const dir = ball.vx < 0 ? 1 : -1;
      const ang = off * 0.92;
      ball.vx = dir * sp * Math.cos(ang);
      ball.vy = sp * Math.sin(ang);
      rally++;
      if (rally > bestRally) bestRally = rally;
      api.sfx.blip(420 + rally * 10);
      sync();
    }

    function point(youScored) {
      if (youScored) { youScore++; api.sfx.good(); } else { cpuScore++; api.sfx.bad(); }
      sync();
      if (youScore >= WIN || cpuScore >= WIN) return end();
      serve(youScored ? 1 : -1);
    }

    function update(dt) {
      if (over) return;

      /* player bat: follow pointer, or keys */
      const kv = (keys.get('ArrowUp', 'w', 'W') ? -1 : 0) + (keys.get('ArrowDown', 's', 'S') ? 1 : 0);
      const speed = 600;
      if (pointerY != null) you.y += clamp(pointerY - you.y, -speed * dt, speed * dt);
      if (kv) you.y += kv * speed * dt;
      you.y = clamp(you.y, PH / 2, H - PH / 2);

      /* CPU bat: track the ball with difficulty-scaled speed and wobble */
      const cpuSpeed = 300 + api.dm * 120;
      const wobble = clamp(1 - api.dm * 0.4, 0.08, 0.9) * 130;
      const target = ball.vx > 0 ? ball.y + rand(-wobble, wobble) : H / 2;
      cpu.y += clamp(target - cpu.y, -cpuSpeed * dt, cpuSpeed * dt);
      cpu.y = clamp(cpu.y, PH / 2, H - PH / 2);

      if (serveT > 0) { serveT -= dt; return; }

      /* substep the ball so it can never tunnel through a bat */
      const steps = Math.ceil(Math.hypot(ball.vx, ball.vy) * dt / 7) || 1;
      const sdt = dt / steps;
      for (let s = 0; s < steps; s++) {
        ball.x += ball.vx * sdt;
        ball.y += ball.vy * sdt;
        if (ball.y < BR) { ball.y = BR; ball.vy = Math.abs(ball.vy); api.sfx.click(); }
        if (ball.y > H - BR) { ball.y = H - BR; ball.vy = -Math.abs(ball.vy); api.sfx.click(); }

        const px = MARGIN + PW;
        if (ball.vx < 0 && ball.x - BR <= px && ball.x - BR >= MARGIN - 8 &&
          Math.abs(ball.y - you.y) <= PH / 2 + BR) { ball.x = px + BR; hit(you); }

        const cx = W - MARGIN - PW;
        if (ball.vx > 0 && ball.x + BR >= cx && ball.x + BR <= W - MARGIN + 8 &&
          Math.abs(ball.y - cpu.y) <= PH / 2 + BR) { ball.x = cx - BR; hit(cpu); }

        if (ball.x < -30) return point(false);
        if (ball.x > W + 30) return point(true);
      }
    }

    function end() {
      over = true;
      const youWon = youScore > cpuScore;
      const res = api.submit(bestRally);
      (youWon ? api.sfx.great : api.sfx.bad)();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, youWon ? 'Game. You win.' : 'CPU takes it.'),
        h('p', null, 'Final ' + youScore + '–' + cpuScore + '. Longest rally ' + bestRally + ' hits.' +
          (res.isRecord ? ' New rally record!' : res.isFirst ? '' : ' Best rally: ' + res.best + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Rematch'));
    }

    function sync() {
      pScore.textContent = youScore + ' – ' + cpuScore;
      pRally.textContent = 'Rally: ' + rally;
    }

    function draw() {
      ctx.fillStyle = '#0b1020';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      for (let y = 10; y < H; y += 30) ctx.fillRect(W / 2 - 3, y, 6, 16);

      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.font = 'bold 66px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(youScore, W / 2 - 78, 74);
      ctx.fillText(cpuScore, W / 2 + 78, 74);
      ctx.textAlign = 'left';

      ctx.fillStyle = '#dfe6f5';
      ctx.fillRect(MARGIN, you.y - PH / 2, PW, PH);
      ctx.fillStyle = '#ffd05a';
      ctx.fillRect(W - MARGIN - PW, cpu.y - PH / 2, PW, PH);

      ctx.fillStyle = '#fff';
      ctx.fillRect(ball.x - BR, ball.y - BR, BR * 2, BR * 2);

      if (serveT > 0 && !over) {
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.font = 'bold 15px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('serving…', W / 2, H - 40);
        ctx.textAlign = 'left';
      }
    }

    reset();
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'pong',
    title: 'Desk Tennis',
    emoji: 'pong',
    cat: 'action',
    order: 29,
    blurb: 'The original video game, more or less. You, a CPU, and a square that will not stop. Your longest rally is the score worth chasing.',
    scoreLabel: 'Longest rally',
    tags: ['pong', 'paddle', 'ball', 'vs-cpu'],
    how: [
      'Move your bat with the mouse, a drag, or Up/Down and W/S.',
      'Where the ball strikes your bat bends its angle — hit near the edge to fire it back sharp.',
      'First side to seven points wins the match.',
      'Your recorded score is the longest single rally you keep alive.',
      'Harder settings give the CPU a faster, steadier bat.'
    ],
    mount
  });
})();
