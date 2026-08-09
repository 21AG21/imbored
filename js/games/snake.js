/* Snake, with a golden apple worth chasing. */
(function () {
  'use strict';
  const { h, clamp, randInt } = Engine;

  const CELL = 24;
  /* a 3:2 board is unreadable on a portrait phone, so go squarer there */
  const narrow = matchMedia('(orientation: portrait) and (max-width: 620px)').matches;
  const COLS = narrow ? 20 : 30, ROWS = 20;
  const W = COLS * CELL, H = ROWS * CELL;
  const TOUCH = matchMedia('(hover: none)').matches;

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;

    let snake, dir, queue, food, gold, goldT, score, speed, acc, dead, grow, flash, wrap, started;
    wrap = api.load('wrap', false);

    const pScore = api.pill('Score: 0');
    const pLen = api.pill('Length: 3');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);
    Engine.dpad(root, (d) => { if (d !== 'action') turn(d); }, { class: 'touch-only' });

    api.button('Restart', reset);
    const wrapBtn = api.button('Walls: ' + (wrap ? 'open' : 'solid'), () => {
      wrap = !wrap;
      api.save('wrap', wrap);
      wrapBtn.textContent = 'Walls: ' + (wrap ? 'open' : 'solid');
      wrapBtn.classList.toggle('on', wrap);
      reset();
    }, wrap ? 'on' : '');

    function reset() {
      snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
      dir = { x: 1, y: 0 };
      queue = [];
      score = 0; speed = 8 * (0.75 + api.dm * 0.25); acc = 0; dead = false; grow = 0; flash = 0;
      gold = null; goldT = 0; started = false;
      placeFood();
      banner.style.display = 'none';
      api.status('Arrows, WASD, or swipe. The golden apple is worth five, but it will not wait.');
      sync();
    }

    const occupied = (x, y) => snake.some((s) => s.x === x && s.y === y);

    function freeCell() {
      let x, y, guard = 0;
      do { x = randInt(0, COLS - 1); y = randInt(0, ROWS - 1); }
      while ((occupied(x, y) || (gold && gold.x === x && gold.y === y) || (food && food.x === x && food.y === y)) && guard++ < 900);
      return { x, y };
    }
    function placeFood() { food = freeCell(); }

    function turn(d) {
      const v = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[d];
      if (!v) return;
      const last = queue.length ? queue[queue.length - 1] : dir;
      if (last.x === -v.x && last.y === -v.y) return;    // no instant reversal
      if (last.x === v.x && last.y === v.y) return;
      if (queue.length < 2) queue.push(v);
      started = true;
    }

    function step() {
      if (queue.length) dir = queue.shift();
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

      if (wrap) {
        head.x = (head.x + COLS) % COLS;
        head.y = (head.y + ROWS) % ROWS;
      } else if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) {
        return die('You met the wall.');
      }

      /* the tail square frees up this tick unless we are growing */
      const body = grow > 0 ? snake : snake.slice(0, -1);
      if (body.some((s) => s.x === head.x && s.y === head.y)) return die('You ate yourself.');

      snake.unshift(head);
      if (grow > 0) grow--;
      else snake.pop();

      if (head.x === food.x && head.y === food.y) {
        score += 10;
        grow += 1;
        speed = Math.min(24, speed + 0.28 * api.dm);
        flash = 0.2;
        api.sfx.blip(560 + score);
        placeFood();
        if (!gold && Math.random() < 0.24) { gold = freeCell(); goldT = 7; }
      } else if (gold && head.x === gold.x && head.y === gold.y) {
        score += 50;
        grow += 3;
        speed = Math.min(19, speed + 0.4);
        gold = null;
        flash = 0.35;
        api.sfx.great();
      }
      sync();
    }

    function die(reason) {
      dead = true;
      api.sfx.bad();
      const res = api.submit(score);
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, reason),
        h('p', null, score + ' points, ' + snake.length + ' segments long.' +
          (res.isRecord ? ' New personal best!' : res.isFirst ? '' : ' Best: ' + res.best + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Again'));
    }

    function sync() {
      pScore.textContent = 'Score: ' + score;
      pLen.textContent = 'Length: ' + snake.length;
    }

    function update(dt) {
      if (dead) return;
      flash = Math.max(0, flash - dt);
      if (gold) { goldT -= dt; if (goldT <= 0) gold = null; }
      if (!started) return;
      acc += dt;
      const interval = 1 / speed;
      while (acc >= interval && !dead) { acc -= interval; step(); }
    }

    function draw() {
      ctx.fillStyle = '#080d18';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = '#111a2c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < COLS; x++) { ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, H); }
      for (let y = 1; y < ROWS; y++) { ctx.moveTo(0, y * CELL); ctx.lineTo(W, y * CELL); }
      ctx.stroke();

      if (!wrap) {
        ctx.strokeStyle = '#38415e';
        ctx.lineWidth = 3;
        ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
      }

      /* food */
      const bob = Math.sin(Date.now() / 220) * 1.6;
      ctx.fillStyle = '#ff5c8f';
      ctx.shadowColor = '#ff5c8f';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2 + bob, CELL * 0.31, 0, 7);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (gold) {
        const p = clamp(goldT / 7, 0, 1);
        ctx.fillStyle = '#ffc043';
        ctx.shadowColor = '#ffc043';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(gold.x * CELL + CELL / 2, gold.y * CELL + CELL / 2 + bob, CELL * (0.2 + 0.16 * p), 0, 7);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,192,67,.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gold.x * CELL + CELL / 2, gold.y * CELL + CELL / 2, CELL * 0.44, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
        ctx.stroke();
      }

      /* snake */
      for (let i = snake.length - 1; i >= 0; i--) {
        const s = snake[i];
        const t = i / Math.max(1, snake.length);
        ctx.fillStyle = i === 0 ? '#c9ffb0' : 'hsl(' + (140 - t * 45) + ', 70%, ' + (62 - t * 22) + '%)';
        const m = i === 0 ? 1.5 : 2.5;
        Engine.roundRect(ctx, s.x * CELL + m, s.y * CELL + m, CELL - m * 2, CELL - m * 2, 6);
        ctx.fill();
      }
      /* eyes */
      const hd = snake[0];
      ctx.fillStyle = '#0a1020';
      const ex = hd.x * CELL + CELL / 2 + dir.x * 4;
      const ey = hd.y * CELL + CELL / 2 + dir.y * 4;
      const px = -dir.y * 4, py = dir.x * 4;
      ctx.beginPath();
      ctx.arc(ex + px, ey + py, 2.1, 0, 7);
      ctx.arc(ex - px, ey - py, 2.1, 0, 7);
      ctx.fill();

      if (flash > 0) {
        ctx.fillStyle = 'rgba(157,255,92,' + (flash * 0.3).toFixed(2) + ')';
        ctx.fillRect(0, 0, W, H);
      }
      if (!started && !dead) {
        ctx.fillStyle = 'rgba(8,13,24,.55)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#e8ecf7';
        ctx.font = 'bold 22px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(TOUCH ? 'swipe or tap an arrow to start' : 'press an arrow key to start', W / 2, H / 2);
        ctx.textAlign = 'left';
      }
    }

    bagg.add(Engine.onKey((e) => {
      const m = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right'
      }[e.key];
      if (m) { turn(m); return true; }
    }));
    bagg.add(Engine.swipe(cv.el, turn));

    reset();
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'snake',
    title: 'Snake',
    emoji: 'snake',
    cat: 'action',
    order: 30,
    blurb: 'The snake you already know, with a golden apple worth five ordinary ones and a toggle for solid or open walls.',
    scoreLabel: 'Score',
    tags: ['classic', 'arcade', 'retro'],
    how: [
      'Steer with the arrows, WASD, swipe, or the on-screen pad. You cannot turn straight back on yourself.',
      'Normal apples score 10. The golden apple scores 50 and vanishes after seven seconds.',
      'Every apple you eat speeds the snake up, which is the trouble.',
      'Set Walls to open to wrap around the edges instead of dying at them.',
      'Higher settings start you faster and speed you up quicker.'
    ],
    mount
  });
})();
