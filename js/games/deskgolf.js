/* Desk Golf. Nine holes across the office floor. Mind the coffee. */
(function () {
  'use strict';
  const { h, clamp, rand } = Engine;

  const W = 860, H = 560;
  const BR = 9;                    // ball radius
  const STOP = 14;                 // below this speed the ball has stopped

  /* x, y, w, h for walls; circles for sand and coffee */
  const HOLES = [
    { par: 2, ball: [90, 280], cup: [740, 280], walls: [] },
    { par: 3, ball: [90, 460], cup: [760, 110], walls: [[300, 180, 30, 380], [520, 0, 30, 380]] },
    { par: 3, ball: [100, 460], cup: [730, 460], walls: [[260, 300, 340, 30]], sand: [[430, 430, 90]] },
    { par: 3, ball: [90, 100], cup: [770, 470], walls: [[240, 0, 28, 300], [470, 260, 28, 300]], coffee: [[360, 400, 60]] },
    { par: 4, ball: [80, 280], cup: [790, 280], walls: [[250, 0, 26, 210], [250, 350, 26, 210], [540, 0, 26, 210], [540, 350, 26, 210]], sand: [[400, 280, 70]] },
    { par: 3, ball: [100, 480], cup: [430, 90], walls: [[200, 180, 480, 26]], coffee: [[300, 300, 55], [560, 300, 55]] },
    { par: 4, ball: [80, 90], cup: [790, 90], walls: [[220, 60, 26, 420], [420, 80, 26, 420], [620, 60, 26, 420]] },
    { par: 4, ball: [430, 500], cup: [430, 80], walls: [[280, 200, 300, 26], [280, 340, 300, 26], [280, 226, 26, 114], [554, 226, 26, 114]], sand: [[180, 300, 80], [680, 300, 80]] },
    { par: 5, ball: [70, 500], cup: [800, 60], walls: [[180, 120, 26, 440], [340, 0, 26, 440], [500, 120, 26, 440], [660, 0, 26, 440]], coffee: [[260, 60, 45], [420, 500, 45], [580, 60, 45]] }
  ];

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;

    const CUPR = clamp(17 - (api.dm - 1) * 5, 10, 19);
    const FRICTION = 0.9955 - (api.dm - 1) * 0.0012;

    let hole, ball, vel, strokes, total, aim, sunk, sunkT, done, trail;

    const pHole = api.pill('');
    const pStroke = api.pill('Strokes: 0');
    const pTotal = api.pill('Total: 0');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);

    function startRound() {
      total = 0;
      loadHole(0);
      done = false;
      banner.style.display = 'none';
    }

    function loadHole(i) {
      hole = i;
      const H0 = HOLES[i];
      ball = { x: H0.ball[0], y: H0.ball[1] };
      vel = { x: 0, y: 0 };
      strokes = 0;
      aim = null;
      sunk = false;
      sunkT = 0;
      trail = [];
      api.status('Drag back from the ball to aim, let go to putt. Coffee spills cost you a stroke.');
      sync();
    }

    function sync() {
      const H0 = HOLES[hole];
      pHole.textContent = 'Hole ' + (hole + 1) + '/' + HOLES.length + '  ·  par ' + H0.par;
      pStroke.textContent = 'Strokes: ' + strokes;
      pStroke.className = 'pill ' + (strokes > H0.par ? 'warn' : '');
      pTotal.textContent = 'Total: ' + total;
    }

    const moving = () => Math.hypot(vel.x, vel.y) > STOP;

    bagg.listen(cv.el, 'pointerdown', (e) => {
      if (done || sunk || moving()) return;
      const p = cv.pos(e);
      if (Math.hypot(p.x - ball.x, p.y - ball.y) > 70) return;
      cv.el.setPointerCapture(e.pointerId);
      aim = { x: p.x, y: p.y };
    });
    bagg.listen(cv.el, 'pointermove', (e) => {
      if (!aim) return;
      const p = cv.pos(e);
      aim.x = p.x; aim.y = p.y;
    });
    function putt() {
      if (!aim) return;
      const dx = ball.x - aim.x, dy = ball.y - aim.y;
      const d = Math.hypot(dx, dy);
      aim = null;
      if (d < 8) return;
      const power = Math.min(d, 190) * 5.2;
      const a = Math.atan2(dy, dx);
      vel.x = Math.cos(a) * power;
      vel.y = Math.sin(a) * power;
      strokes++;
      api.sfx.tone({ freq: 700, to: 300, dur: 0.09, type: 'square', vol: 0.08 });
      sync();
    }
    bagg.listen(cv.el, 'pointerup', putt);
    bagg.listen(cv.el, 'pointercancel', putt);

    function inSand(x, y) {
      const s = HOLES[hole].sand || [];
      return s.some((c) => Math.hypot(x - c[0], y - c[1]) < c[2]);
    }
    function inCoffee(x, y) {
      const s = HOLES[hole].coffee || [];
      return s.some((c) => Math.hypot(x - c[0], y - c[1]) < c[2] - 4);
    }

    function update(dt) {
      if (done || sunk) { if (sunkT > 0) sunkT -= dt; return; }
      if (!moving() && (vel.x || vel.y)) { vel.x = 0; vel.y = 0; }
      if (!vel.x && !vel.y) return;

      const steps = Math.ceil(Math.hypot(vel.x, vel.y) * dt / 4) || 1;
      const sdt = dt / steps;
      for (let s = 0; s < steps; s++) {
        ball.x += vel.x * sdt;
        ball.y += vel.y * sdt;

        if (ball.x < BR) { ball.x = BR; vel.x = Math.abs(vel.x) * 0.82; api.sfx.click(); }
        if (ball.x > W - BR) { ball.x = W - BR; vel.x = -Math.abs(vel.x) * 0.82; api.sfx.click(); }
        if (ball.y < BR) { ball.y = BR; vel.y = Math.abs(vel.y) * 0.82; api.sfx.click(); }
        if (ball.y > H - BR) { ball.y = H - BR; vel.y = -Math.abs(vel.y) * 0.82; api.sfx.click(); }

        for (const wl of HOLES[hole].walls) {
          const [wx, wy, ww, wh] = wl;
          if (ball.x + BR < wx || ball.x - BR > wx + ww || ball.y + BR < wy || ball.y - BR > wy + wh) continue;
          const oL = ball.x + BR - wx, oR = wx + ww - (ball.x - BR);
          const oT = ball.y + BR - wy, oB = wy + wh - (ball.y - BR);
          const m = Math.min(oL, oR, oT, oB);
          if (m === oL) { ball.x = wx - BR; vel.x = -Math.abs(vel.x) * 0.8; }
          else if (m === oR) { ball.x = wx + ww + BR; vel.x = Math.abs(vel.x) * 0.8; }
          else if (m === oT) { ball.y = wy - BR; vel.y = -Math.abs(vel.y) * 0.8; }
          else { ball.y = wy + wh + BR; vel.y = Math.abs(vel.y) * 0.8; }
          api.sfx.thud();
        }

        const cup = HOLES[hole].cup;
        const dc = Math.hypot(ball.x - cup[0], ball.y - cup[1]);
        if (dc < CUPR && Math.hypot(vel.x, vel.y) < 420) return sink();

        if (inCoffee(ball.x, ball.y)) return splash();
      }

      trail.push({ x: ball.x, y: ball.y });
      if (trail.length > 40) trail.shift();

      const f = inSand(ball.x, ball.y) ? FRICTION - 0.012 : FRICTION;
      const damp = Math.pow(f, dt * 1000);
      vel.x *= damp;
      vel.y *= damp;
    }

    function splash() {
      api.sfx.bad();
      strokes++;
      const H0 = HOLES[hole];
      ball = { x: H0.ball[0], y: H0.ball[1] };
      vel = { x: 0, y: 0 };
      trail = [];
      api.status('Straight into the coffee. One penalty stroke, back to the start.');
      sync();
    }

    function sink() {
      sunk = true;
      sunkT = 1.1;
      vel = { x: 0, y: 0 };
      total += strokes;
      const par = HOLES[hole].par;
      const d = strokes - par;
      const name = strokes === 1 ? 'HOLE IN ONE' : d <= -2 ? 'EAGLE' : d === -1 ? 'BIRDIE' : d === 0 ? 'PAR' : d === 1 ? 'BOGEY' : d + ' OVER';
      api.sfx[d <= 0 ? 'great' : 'good']();
      api.status(name + ' on hole ' + (hole + 1) + '.');
      sync();
      setTimeout(() => {
        if (hole + 1 < HOLES.length) loadHole(hole + 1);
        else finish();
      }, 1200);
    }

    function finish() {
      done = true;
      const par = HOLES.reduce((a, x) => a + x.par, 0);
      const res = api.submit(total);
      const d = total - par;
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Round finished.'),
        h('p', null, total + ' strokes against a par of ' + par + '. That is ' +
          (d === 0 ? 'level par.' : d < 0 ? Math.abs(d) + ' under.' : d + ' over.') +
          (res.isRecord ? ' Best round yet!' : res.isFirst ? '' : ' Best: ' + res.best + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: startRound }, 'Play the nine again'));
    }

    function draw() {
      const H0 = HOLES[hole];
      /* carpet */
      ctx.fillStyle = '#2f7a48';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,.05)';
      for (let y = 0; y < H; y += 26) ctx.fillRect(0, y, W, 13);

      for (const s of (H0.sand || [])) {
        ctx.fillStyle = '#4a4155';
        ctx.beginPath();
        ctx.arc(s[0], s[1], s[2], 0, 7);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.07)';
        ctx.beginPath();
        ctx.arc(s[0], s[1], s[2] - 6, 0, 7);
        ctx.fill();
      }
      for (const c of (H0.coffee || [])) {
        ctx.fillStyle = '#4a2c14';
        ctx.beginPath();
        ctx.arc(c[0], c[1], c[2], 0, 7);
        ctx.fill();
        ctx.strokeStyle = '#7a4a22';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        ctx.beginPath();
        ctx.ellipse(c[0] - c[2] * 0.3, c[1] - c[2] * 0.3, c[2] * 0.25, c[2] * 0.14, -0.6, 0, 7);
        ctx.fill();
      }

      /* desks */
      for (const wl of H0.walls) {
        ctx.fillStyle = '#7a5a34';
        ctx.fillRect(wl[0], wl[1], wl[2], wl[3]);
        ctx.strokeStyle = '#1d1722';
        ctx.lineWidth = 4;
        ctx.strokeRect(wl[0], wl[1], wl[2], wl[3]);
        ctx.fillStyle = 'rgba(255,255,255,.13)';
        ctx.fillRect(wl[0] + 4, wl[1] + 4, Math.max(2, wl[2] - 8), 5);
      }

      /* cup */
      const cup = H0.cup;
      ctx.fillStyle = '#0c1119';
      ctx.beginPath();
      ctx.arc(cup[0], cup[1], CUPR, 0, 7);
      ctx.fill();
      ctx.strokeStyle = '#ded6c2';
      ctx.lineWidth = 2;
      ctx.stroke();
      /* flag */
      ctx.strokeStyle = '#fffdf3';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cup[0], cup[1]);
      ctx.lineTo(cup[0], cup[1] - 46);
      ctx.stroke();
      ctx.fillStyle = '#e8402a';
      ctx.beginPath();
      ctx.moveTo(cup[0], cup[1] - 46);
      ctx.lineTo(cup[0] + 30, cup[1] - 38);
      ctx.lineTo(cup[0], cup[1] - 30);
      ctx.closePath();
      ctx.fill();

      /* ball trail */
      trail.forEach((t, i) => {
        ctx.fillStyle = 'rgba(255,255,255,' + (i / trail.length * 0.22).toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(t.x, t.y, 3, 0, 7);
        ctx.fill();
      });

      /* aim */
      if (aim) {
        const dx = ball.x - aim.x, dy = ball.y - aim.y;
        const d = Math.min(Math.hypot(dx, dy), 190);
        const a = Math.atan2(dy, dx);
        ctx.strokeStyle = 'rgba(255,203,31,.9)';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(ball.x + Math.cos(a) * d * 1.4, ball.y + Math.sin(a) * d * 1.4);
        ctx.stroke();
        ctx.setLineDash([]);
        /* power bar */
        ctx.fillStyle = '#1d1722';
        ctx.fillRect(ball.x - 32, ball.y + 22, 64, 8);
        ctx.fillStyle = d > 150 ? '#e8402a' : d > 80 ? '#ffcb1f' : '#6fcf2f';
        ctx.fillRect(ball.x - 32, ball.y + 22, 64 * (d / 190), 8);
      }

      if (!sunk) {
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        ctx.beginPath();
        ctx.arc(ball.x + 2, ball.y + 3, BR, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#fffdf3';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BR, 0, 7);
        ctx.fill();
        ctx.strokeStyle = '#b6ae99';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (sunkT > 0) {
        ctx.fillStyle = '#ffcb1f';
        ctx.font = '40px Impact, Haettenschweiler, Arial Black, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('IN THE CUP', W / 2, H / 2);
        ctx.textAlign = 'left';
      }
    }

    api.button('Restart round', startRound);
    api.button('Replay hole', () => { total -= 0; loadHole(hole); });

    startRound();
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'deskgolf',
    title: 'Desk Golf',
    emoji: '⛳',
    cat: 'goof',
    order: 63,
    blurb: 'Nine holes of putting across the office carpet. Desks bounce, mousepads drag, and someone has spilled coffee absolutely everywhere.',
    scoreLabel: 'Best round',
    lowerIsBetter: true,
    tags: ['golf', 'putting', 'physics', 'mini golf'],
    how: [
      'Drag backwards from the ball and release to putt. The bar shows the power.',
      'Desks bounce the ball. The dark purple patches are mousepads and they slow you right down.',
      'The brown puddles are spilled coffee. In means one penalty stroke and back to the tee.',
      'Nine holes, par 31. Lower total is better, so this is the one game here where a small score wins.',
      'Harder difficulties shrink the cup and make the carpet faster.'
    ],
    mount
  });
})();
