/* Brick Break. Paddle, ball, powerups, mild rage. */
(function () {
  'use strict';
  const { h, clamp, rand, randInt, pick } = Engine;

  const W = 800, H = 560;
  const COLS = 11, ROWS = 7;
  const BW = 62, BH = 22, BGAP = 6;
  const OX = (W - (COLS * (BW + BGAP) - BGAP)) / 2, OY = 70;
  const BASE_SPEED = 330;

  const POWERS = [
    { id: 'wide', color: '#38e1ff', label: 'W' },
    { id: 'multi', color: '#ff5cc8', label: '3' },
    { id: 'slow', color: '#9dff5c', label: 'S' },
    { id: 'life', color: '#ffc043', label: '♥' }
  ];

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;
    const keys = Engine.keys(['ArrowLeft', 'ArrowRight', 'Space', ' ']);
    bagg.add(() => keys.dispose());

    let paddle, balls, bricks, drops, score, lives, level, over, launched, wideT, slowT, shake, msg, msgT;

    const pScore = api.pill('Score: 0');
    const pLives = api.pill('♥♥♥');
    const pLevel = api.pill('Level 1');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);

    api.button('Restart', () => reset(true));

    function reset(full) {
      if (full) { score = 0; lives = api.dm > 2 ? 1 : api.dm > 1.2 ? 2 : 3; level = 1; }
      paddle = { x: W / 2, w: 110, h: 14, y: H - 34, vx: 0 };
      drops = [];
      wideT = 0; slowT = 0; shake = 0; over = false;
      buildBricks();
      resetBall();
      banner.style.display = 'none';
      api.status('Move with the mouse or arrow keys. Space launches. Catch the falling letters.');
      sync();
    }

    function resetBall() {
      launched = false;
      balls = [{ x: paddle.x, y: paddle.y - 12, vx: 0, vy: 0, r: 7 }];
    }

    function buildBricks() {
      bricks = [];
      const rows = Math.min(ROWS, 3 + level);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < COLS; c++) {
          if (level > 2 && (r + c) % 7 === 3) continue;          // holes in later layouts
          const hp = r < 1 && level > 1 ? 2 : 1;
          bricks.push({
            x: OX + c * (BW + BGAP), y: OY + r * (BH + BGAP), w: BW, h: BH,
            hp, max: hp, hue: 190 + r * 22
          });
        }
      }
    }

    function sync() {
      pScore.textContent = 'Score: ' + score;
      pLives.textContent = lives > 0 ? '♥'.repeat(lives) : '--';
      pLives.className = 'pill ' + (lives <= 1 ? 'bad' : '');
      pLevel.textContent = 'Level ' + level;
    }

    function flash(text) { msg = text; msgT = 1.6; }

    function launch() {
      if (launched || over) return;
      launched = true;
      const b = balls[0];
      b.vx = rand(-90, 90);
      b.vy = (-BASE_SPEED - level * 12) * (0.82 + api.dm * 0.18);
      api.sfx.blip(700);
    }

    bagg.listen(cv.el, 'pointermove', (e) => {
      const p = cv.pos(e);
      paddle.x = clamp(p.x, paddle.w / 2, W - paddle.w / 2);
    });
    bagg.listen(cv.el, 'pointerdown', launch);
    bagg.add(Engine.onKey((e) => {
      if (e.code === 'Space' || e.key === ' ') { launch(); return true; }
    }));

    function update(dt) {
      if (over) return;
      shake = Math.max(0, shake - dt * 3);
      if (msgT > 0) msgT -= dt;
      if (wideT > 0) { wideT -= dt; if (wideT <= 0) paddle.w = 110; }
      if (slowT > 0) slowT -= dt;

      const kv = (keys.get('ArrowLeft', 'a') ? -1 : 0) + (keys.get('ArrowRight', 'd') ? 1 : 0);
      if (kv) paddle.x = clamp(paddle.x + kv * 620 * dt, paddle.w / 2, W - paddle.w / 2);

      if (!launched) {
        balls[0].x = paddle.x;
        balls[0].y = paddle.y - 12;
        return;
      }

      const speedScale = slowT > 0 ? 0.66 : 1;

      for (let bi = balls.length - 1; bi >= 0; bi--) {
        const b = balls[bi];
        /* substep so a fast ball cannot tunnel through a brick */
        const steps = Math.ceil(Math.hypot(b.vx, b.vy) * dt * speedScale / 6) || 1;
        const sdt = dt / steps;
        for (let s = 0; s < steps; s++) {
          b.x += b.vx * sdt * speedScale;
          b.y += b.vy * sdt * speedScale;

          if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); api.sfx.click(); }
          if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); api.sfx.click(); }
          if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); api.sfx.click(); }

          /* paddle */
          if (b.vy > 0 && b.y + b.r >= paddle.y && b.y - b.r <= paddle.y + paddle.h &&
            b.x >= paddle.x - paddle.w / 2 - b.r && b.x <= paddle.x + paddle.w / 2 + b.r) {
            b.y = paddle.y - b.r;
            const off = clamp((b.x - paddle.x) / (paddle.w / 2), -1, 1);
            const sp = Math.min(760, Math.hypot(b.vx, b.vy) * 1.012);
            const ang = -Math.PI / 2 + off * 1.05;
            b.vx = Math.cos(ang) * sp;
            b.vy = Math.sin(ang) * sp;
            api.sfx.blip(420);
          }

          /* bricks */
          for (let i = 0; i < bricks.length; i++) {
            const k = bricks[i];
            if (b.x + b.r < k.x || b.x - b.r > k.x + k.w || b.y + b.r < k.y || b.y - b.r > k.y + k.h) continue;
            const overlapL = b.x + b.r - k.x, overlapR = k.x + k.w - (b.x - b.r);
            const overlapT = b.y + b.r - k.y, overlapB = k.y + k.h - (b.y - b.r);
            const m = Math.min(overlapL, overlapR, overlapT, overlapB);
            if (m === overlapL) { b.x = k.x - b.r; b.vx = -Math.abs(b.vx); }
            else if (m === overlapR) { b.x = k.x + k.w + b.r; b.vx = Math.abs(b.vx); }
            else if (m === overlapT) { b.y = k.y - b.r; b.vy = -Math.abs(b.vy); }
            else { b.y = k.y + k.h + b.r; b.vy = Math.abs(b.vy); }

            k.hp--;
            score += 10 * level;
            shake = 0.35;
            api.sfx.blip(300 + k.hue);
            if (k.hp <= 0) {
              bricks.splice(i, 1);
              if (Math.random() < 0.13) {
                const p = pick(POWERS);
                drops.push({ x: k.x + k.w / 2, y: k.y + k.h / 2, p });
              }
            }
            break;
          }
          if (b.y - b.r > H) { balls.splice(bi, 1); break; }
        }
      }

      if (!balls.length) {
        lives--;
        api.sfx.bad();
        sync();
        if (lives <= 0) return end();
        paddle.w = 110; wideT = 0;
        resetBall();
      }

      /* powerup drops */
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.y += 175 * dt;
        if (d.y > H + 20) { drops.splice(i, 1); continue; }
        if (d.y > paddle.y - 10 && Math.abs(d.x - paddle.x) < paddle.w / 2 + 12) {
          drops.splice(i, 1);
          applyPower(d.p);
        }
      }

      if (!bricks.length) nextLevel();
      sync();
    }

    function applyPower(p) {
      api.sfx.good();
      if (p.id === 'wide') { paddle.w = 172; wideT = 16; flash('Wide paddle'); }
      if (p.id === 'slow') { slowT = 11; flash('Slow motion'); }
      if (p.id === 'life') { lives++; flash('Extra life'); }
      if (p.id === 'multi') {
        const src = balls[0];
        if (src) {
          for (let i = 0; i < 2; i++) {
            const ang = Math.atan2(src.vy, src.vx) + (i ? 0.42 : -0.42);
            const sp = Math.hypot(src.vx, src.vy) || BASE_SPEED;
            balls.push({ x: src.x, y: src.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 7 });
          }
        }
        flash('Multiball');
      }
    }

    function nextLevel() {
      level++;
      score += 250;
      api.sfx.great();
      flash('Level ' + level);
      paddle.w = 110; wideT = 0; slowT = 0;
      drops = [];
      buildBricks();
      resetBall();
      sync();
    }

    function end() {
      over = true;
      const res = api.submit(score);
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Out of balls.'),
        h('p', null, score.toLocaleString() + ' points, reached level ' + level + '.' +
          (res.isRecord ? ' New personal best!' : res.isFirst ? '' : ' Best: ' + res.best.toLocaleString() + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: () => reset(true) }, 'Play again'));
    }

    function draw() {
      ctx.save();
      if (shake > 0) ctx.translate(rand(-shake * 3, shake * 3), rand(-shake * 3, shake * 3));
      ctx.fillStyle = '#080d18';
      ctx.fillRect(-10, -10, W + 20, H + 20);

      for (const k of bricks) {
        const dmg = k.hp / k.max;
        ctx.fillStyle = 'hsl(' + k.hue + ', 72%, ' + (34 + dmg * 22) + '%)';
        Engine.roundRect(ctx, k.x, k.y, k.w, k.h, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.14)';
        Engine.roundRect(ctx, k.x + 3, k.y + 3, k.w - 6, 5, 2);
        ctx.fill();
        if (k.max > 1 && k.hp > 1) {
          ctx.strokeStyle = 'rgba(255,255,255,.5)';
          ctx.lineWidth = 1.5;
          Engine.roundRect(ctx, k.x + 1, k.y + 1, k.w - 2, k.h - 2, 4);
          ctx.stroke();
        }
      }

      for (const d of drops) {
        ctx.fillStyle = d.p.color;
        Engine.roundRect(ctx, d.x - 11, d.y - 9, 22, 18, 5);
        ctx.fill();
        ctx.fillStyle = '#0a1020';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(d.p.label, d.x, d.y);
      }

      ctx.fillStyle = wideT > 0 ? '#38e1ff' : '#dfe6f5';
      Engine.roundRect(ctx, paddle.x - paddle.w / 2, paddle.y, paddle.w, paddle.h, 7);
      ctx.fill();

      for (const b of balls) {
        ctx.fillStyle = slowT > 0 ? '#9dff5c' : '#fff';
        ctx.shadowColor = slowT > 0 ? '#9dff5c' : '#8fd0ff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, 7);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      if (!launched && !over) {
        ctx.fillStyle = '#8f9ab8';
        ctx.font = 'bold 15px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('space or click to launch', W / 2, paddle.y - 46);
      }
      if (msgT > 0) {
        ctx.globalAlpha = clamp(msgT, 0, 1);
        ctx.fillStyle = '#ffd98a';
        ctx.font = 'bold 30px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(msg, W / 2, H / 2 - 30);
        ctx.globalAlpha = 1;
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }

    reset(true);
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'breakout',
    title: 'Brick Break',
    emoji: 'breakout',
    cat: 'action',
    order: 31,
    blurb: 'Bounce, smash, grab the falling letters. Multiball is a gift right up until the moment it is a punishment.',
    scoreLabel: 'Score',
    tags: ['breakout', 'arkanoid', 'paddle', 'ball'],
    how: [
      'Mouse or arrow keys move the paddle. Space or click launches.',
      'Where the ball hits the paddle decides where it goes. Edges fire it out wide.',
      'Falling tiles: W widens the paddle, 3 splits the ball, S slows time, and the heart is a spare life.',
      'Clear every brick for a 250 point bonus, then it does it again but worse.',
      'Hard gives you two lives. Nightmare gives you one, and a faster ball.'
    ],
    mount
  });
})();
