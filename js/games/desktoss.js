/* Desk Toss. Paper. Bin. Air conditioning that hates you. */
(function () {
  'use strict';
  const { h, clamp, rand, randInt, pick } = Engine;

  const W = 860, H = 520;
  const G = 1500;                 // gravity px/s^2
  const FLOOR = H - 42;

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;
    const dm = api.dm;

    let ball, bin, wind, windTarget, score, streak, misses, over, aim, shots, bits, msg, msgT;
    const MAXMISS = 5;

    const pScore = api.pill('Score: 0');
    const pStreak = api.pill('Streak: 0');
    const pMiss = api.pill('Misses: 0/3');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);

    api.button('New game', reset);

    function reset() {
      score = 0; streak = 0; misses = 0; over = false; shots = 0;
      bits = []; msg = ''; msgT = 0;
      wind = 0; windTarget = rand(-1, 1) * 30 * dm;
      placeBin(true);
      resetBall();
      banner.style.display = 'none';
      api.status('Drag back from the paper ball and let go. Like a catapult. Watch the flag for the air con.');
      sync();
    }

    function placeBin(first) {
      const minX = first ? 420 : 360;
      const maxX = W - 90;
      const spread = clamp(0.22 + score / 700, 0, 0.85);
      const x = rand(minX + (maxX - minX) * (1 - spread) * 0.4, maxX);
      const w = clamp(98 - score / 70 - (dm - 1) * 8, 68, 98);
      const onDesk = Math.random() < clamp(0.05 + score / 400, 0, 0.5);
      bin = { x, w, h: 62, y: onDesk ? FLOOR - 96 : FLOOR, desk: onDesk };
    }

    function resetBall() {
      ball = { x: 96, y: FLOOR - 22, vx: 0, vy: 0, live: false, spin: 0, scored: false };
      aim = null;
    }

    function sync() {
      pScore.textContent = 'Score: ' + score;
      pStreak.textContent = 'Streak: ' + streak;
      pMiss.textContent = 'Misses: ' + misses + '/' + MAXMISS;
      pMiss.className = 'pill ' + (misses >= MAXMISS - 1 ? 'bad' : misses ? 'warn' : '');
    }

    function flash(t) { msg = t; msgT = 1.5; }

    function confetti(x, y) {
      for (let i = 0; i < 22; i++) {
        const a = rand(-Math.PI, 0);
        bits.push({
          x, y, vx: Math.cos(a) * rand(60, 260), vy: Math.sin(a) * rand(120, 340),
          life: rand(0.6, 1.3), c: pick(['#ffcb1f', '#ff2d87', '#00a6b4', '#6fcf2f', '#fffdf3'])
        });
      }
    }

    function land(scored) {
      shots++;
      if (scored) {
        streak++;
        const bonus = bin.desk ? 2 : 1;
        const pts = (10 + streak * 5) * bonus;
        score += pts;
        confetti(bin.x, bin.y - 40);
        api.sfx.great();
        flash(bin.desk ? 'DESK SHOT +' + pts : '+' + pts + (streak > 1 ? '  x' + streak : ''));
      } else {
        misses++;
        streak = 0;
        api.sfx.thud();
        flash('miss');
      }
      sync();
      if (misses >= MAXMISS) return end();
      placeBin();
      windTarget = rand(-1, 1) * 30 * dm;
      setTimeout(() => { if (!over) resetBall(); }, 520);
    }

    function end() {
      over = true;
      const res = api.submit(score);
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Paper everywhere.'),
        h('p', null, score + ' points from ' + shots + ' throws. Someone is going to have to pick those up.' +
          (res.isRecord ? ' New record!' : res.isFirst ? '' : ' Best: ' + res.best + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Crumple another'));
    }

    bagg.listen(cv.el, 'pointerdown', (e) => {
      if (over || !ball || ball.live) return;
      const p = cv.pos(e);
      if (Math.hypot(p.x - ball.x, p.y - ball.y) > 90) return;
      try { if (cv.el.setPointerCapture) cv.el.setPointerCapture(e.pointerId); } catch (err) { /* no active pointer; harmless */ }
      aim = { x: p.x, y: p.y };
    });
    bagg.listen(cv.el, 'pointermove', (e) => {
      if (!aim) return;
      const p = cv.pos(e);
      aim.x = p.x; aim.y = p.y;
    });
    function release() {
      if (!aim || !ball || ball.live) { aim = null; return; }
      const dx = ball.x - aim.x, dy = ball.y - aim.y;
      const power = clamp(Math.hypot(dx, dy), 0, 210) * 4.4;
      const a = Math.atan2(dy, dx);
      if (power < 60) { aim = null; return; }
      ball.vx = Math.cos(a) * power;
      ball.vy = Math.sin(a) * power;
      ball.live = true;
      ball.spin = rand(-8, 8);
      aim = null;
      api.sfx.tone({ freq: 300, to: 720, dur: 0.12, type: 'triangle', vol: 0.07 });
    }
    bagg.listen(cv.el, 'pointerup', release);
    bagg.listen(cv.el, 'pointercancel', release);

    function update(dt) {
      if (over) return;
      wind += (windTarget - wind) * Math.min(1, dt * 0.7);
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        b.vy += G * 0.6 * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0) bits.splice(i, 1);
      }
      if (msgT > 0) msgT -= dt;
      if (!ball || !ball.live) return;

      ball.vy += G * dt;
      ball.vx += wind * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.spin += ball.vx * dt * 0.02;

      /* rim collision: the two lips of the bin */
      const lipY = bin.y - bin.h;
      const lips = [bin.x - bin.w / 2, bin.x + bin.w / 2];
      for (const lx of lips) {
        if (Math.hypot(ball.x - lx, ball.y - lipY) < 8 && ball.vy > 0) {
          ball.vy = -Math.abs(ball.vy) * 0.3;
          ball.vx += (ball.x - lx) * 6;
          api.sfx.click();
        }
      }

      /* through the mouth going down = in */
      if (!ball.scored && ball.vy > 0 &&
        ball.y > lipY - 4 && ball.y < lipY + 30 &&
        Math.abs(ball.x - bin.x) < bin.w / 2 - 2) {
        ball.scored = true;
        ball.live = false;
        return land(true);
      }

      /* desk top */
      if (bin.desk) {
        const dTop = FLOOR - 34;
        if (ball.y > dTop - 9 && ball.y < dTop + 14 && ball.x > bin.x - 120 && ball.x < bin.x + 120 && ball.vy > 0) {
          ball.y = dTop - 9;
          ball.vy *= -0.36;
          ball.vx *= 0.7;
          if (Math.abs(ball.vy) < 60) { ball.live = false; return land(false); }
        }
      }

      if (ball.y > FLOOR - 9) {
        ball.y = FLOOR - 9;
        ball.vy *= -0.34;
        ball.vx *= 0.72;
        if (Math.abs(ball.vy) < 60) { ball.live = false; return land(false); }
      }
      if (ball.x < -40 || ball.x > W + 40 || ball.y > H + 80) { ball.live = false; land(false); }
    }

    function draw() {
      /* wall */
      ctx.fillStyle = '#25304a';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#2c3852';
      for (let x = 0; x < W; x += 64) ctx.fillRect(x, 0, 2, FLOOR);
      /* floor */
      ctx.fillStyle = '#3b3020';
      ctx.fillRect(0, FLOOR, W, H - FLOOR);
      ctx.fillStyle = '#4a3c28';
      for (let x = -20; x < W; x += 78) {
        ctx.fillRect(x, FLOOR + 4, 70, 3);
        ctx.fillRect(x + 40, FLOOR + 22, 70, 3);
      }

      /* air-con vent + flag */
      ctx.fillStyle = '#9aa3b5';
      ctx.fillRect(W - 150, 14, 108, 30);
      ctx.fillStyle = '#5c6478';
      for (let i = 0; i < 5; i++) ctx.fillRect(W - 144 + i * 21, 18, 12, 22);
      const dir = Math.sign(wind) || 1;
      const strength = clamp(Math.abs(wind) / 90, 0, 1);
      ctx.save();
      ctx.translate(W - 168, 50);
      ctx.strokeStyle = '#cfc6ae';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, 36);
      ctx.stroke();
      ctx.fillStyle = strength > 0.55 ? '#e8402a' : '#ffcb1f';
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(dir * (10 + strength * 34), 10);
      ctx.lineTo(0, 20);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#9aa3b5';
      ctx.font = 'bold 11px Verdana, sans-serif';
      ctx.fillText('AIR CON', W - 148, 62);

      /* desk if the bin is up high */
      if (bin.desk) {
        ctx.fillStyle = '#7a5a34';
        ctx.fillRect(bin.x - 120, FLOOR - 34, 240, 12);
        ctx.fillStyle = '#5d452a';
        ctx.fillRect(bin.x - 108, FLOOR - 22, 14, FLOOR - (FLOOR - 22));
        ctx.fillRect(bin.x + 94, FLOOR - 22, 14, 22);
      }

      /* bin */
      const lipY = bin.y - bin.h;
      ctx.fillStyle = '#39435c';
      ctx.beginPath();
      ctx.moveTo(bin.x - bin.w / 2, lipY);
      ctx.lineTo(bin.x + bin.w / 2, lipY);
      ctx.lineTo(bin.x + bin.w / 2 - 9, bin.y);
      ctx.lineTo(bin.x - bin.w / 2 + 9, bin.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#0c1119';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#0c1119';
      ctx.fillRect(bin.x - bin.w / 2, lipY - 5, bin.w, 7);
      ctx.fillStyle = '#59657f';
      ctx.fillRect(bin.x - bin.w / 2 + 3, lipY - 2, bin.w - 6, 3);

      /* confetti */
      for (const b of bits) {
        ctx.globalAlpha = clamp(b.life, 0, 1);
        ctx.fillStyle = b.c;
        ctx.fillRect(b.x - 3, b.y - 3, 6, 6);
      }
      ctx.globalAlpha = 1;

      /* aim guide */
      if (aim && ball && !ball.live) {
        const dx = ball.x - aim.x, dy = ball.y - aim.y;
        const power = clamp(Math.hypot(dx, dy), 0, 210);
        const a = Math.atan2(dy, dx);
        ctx.strokeStyle = 'rgba(255,203,31,.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 6]);
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(aim.x, aim.y);
        ctx.stroke();
        ctx.setLineDash([]);
        /* predicted arc */
        let px = ball.x, py = ball.y;
        let pvx = Math.cos(a) * power * 4.4, pvy = Math.sin(a) * power * 4.4;
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        for (let i = 0; i < 26; i++) {
          for (let k = 0; k < 3; k++) {
            pvy += G * 0.016; pvx += wind * 0.016;
            px += pvx * 0.016; py += pvy * 0.016;
          }
          if (py > FLOOR) break;
          ctx.fillRect(px - 2, py - 2, 4, 4);
        }
      }

      /* paper ball */
      if (ball) {
        ctx.save();
        ctx.translate(ball.x, ball.y);
        ctx.rotate(ball.spin);
        ctx.fillStyle = '#fffdf3';
        ctx.beginPath();
        for (let i = 0; i < 9; i++) {
          const a = i / 9 * Math.PI * 2;
          const r = 9 + (i % 2 ? -2.2 : 2.2);
          i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#b6ae99';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      if (msgT > 0) {
        ctx.globalAlpha = clamp(msgT, 0, 1);
        ctx.fillStyle = '#ffcb1f';
        ctx.font = '34px Impact, Haettenschweiler, Arial Black, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(msg, W / 2, 120);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      }
    }

    reset();
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'desktoss',
    title: 'Desk Toss',
    emoji: 'desktoss',
    cat: 'goof',
    order: 62,
    blurb: 'Catapult crumpled paper into the bin while the air-con vent pushes it off course. A bin up on a desk counts double.',
    scoreLabel: 'Score',
    tags: ['paper', 'basketball', 'bin', 'physics', 'throw'],
    how: [
      'Drag back from the paper ball and release. Further back throws harder.',
      'The dotted arc shows the current shot. The flag shows which way the air-con blows.',
      'The rim bounces the ball, so bank shots are fair game.',
      'Every basket moves the bin back and shrinks it. A bin on a desk scores double.',
      'Five misses ends the game. The bin only drifts back slowly.'
    ],
    mount
  });
})();
