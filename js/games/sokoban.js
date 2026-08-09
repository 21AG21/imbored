/* Crate Pusher. Sokoban. Every level here was solver-checked before shipping. */
(function () {
  'use strict';
  const { h, clamp } = Engine;

  /* ordered by verified shortest solution length */
  const LEVELS = [
    '#######/#     #/# .$@ #/#     #/#######',
    '########/#      #/# .##. #/# $  $ #/#  @   #/########',
    '########/#      #/#  ##  #/# $..$ #/#  @   #/#      #/########',
    '#########/#  #    #/# $$ .  #/# @  .  #/#  ###  #/#       #/#########',
    '#######/#. #  #/#  $  #/# $ . #/#  @  #/#######',
    '#########/##      #/#  $ #  #/# .#..  #/#  $ $  #/#   @   #/#########',
    '##########/#        #/# $$$$   #/# ....   #/#   @    #/##########',
    '#########/#   #   #/# $   $ #/#  ###  #/# .   . #/#   @   #/#########',
    '##########/#        #/#  $  $  #/#  .  .  #/#  $  $  #/#  .  .  #/#    @   #/##########',
    '#########/#   #   #/# $ $ . #/#   #.  #/#  @    #/#########',
    '########/#      #/# .$.  #/# $@$  #/# .$.  #/#      #/########',
    '########/#  #   #/# $$   #/# .. # #/#   @  #/########',
    '##########/#   ##   #/# $    $ #/# # .. # #/#  $..$  #/#    @   #/##########',
    /* an extra dozen, each machine-checked solvable, ramping easy -> hard */
    '########/#. .   #/# $$   #/#  @   #/#      #/########',
    '######/#@   #/#$$  #/#    #/#..  #/######',
    '#######/#. .  #/#$$$ .#/#  @  #/#######',
    '######/#  . #/# $$ #/# . @#/######',
    '#######/#  .  #/# $$  #/# @ . #/#     #/#######',
    '#######/#.    #/# $   #/#  @  #/#   $ #/#    .#/#######',
    '#########/#  ...  #/# $$$   #/#   @   #/#########',
    '########/#      #/# $$$$ #/# .... #/#  @   #/########',
    '########/#  .   #/# $$$ ##/#  .  .#/#  @   #/########',
    '########/#. #   #/#  $ $ #/#  @   #/#. #   #/########',
    '########/#     .#/# $$$  #/#    ..#/#  @   #/########',
    '#########/#       #/# $$$ ..#/#  @  . #/#########'
  ];

  function mount(root, api) {
    const bagg = Engine.bag();
    let level = clamp(api.load('level', 0), 0, LEVELS.length - 1);
    let W, Hh, walls, goals, boxes, px, py, pushes, steps, history, done, CELL;

    const cv = Engine.canvas(root, 640, 480);
    const ctx = cv.ctx;
    const pLevel = api.pill('');
    const pSteps = api.pill('Steps: 0');
    const pPush = api.pill('Pushes: 0');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);
    Engine.dpad(root, (d) => { if (d !== 'action') move(d); }, { class: 'touch-only' });

    api.button('Undo', () => undo());
    api.button('Restart level', () => load(level));
    api.button('← Previous', () => { if (level > 0) load(level - 1); });
    api.button('Next →', () => { if (level < LEVELS.length - 1) load(level + 1); });
    const lvlSel = api.select('Level', LEVELS.map((_, i) => ({ value: String(i), label: 'Level ' + (i + 1) })), '0', (v) => load(+v));

    const k = (x, y) => x + ',' + y;

    function load(i) {
      level = clamp(i, 0, LEVELS.length - 1);
      api.save('level', level);
      if (lvlSel) lvlSel.value = String(level);
      const rows = LEVELS[level].split('/');
      Hh = rows.length;
      W = Math.max(...rows.map((r) => r.length));
      walls = new Set(); goals = new Set(); boxes = new Set();
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          if (ch === '#') walls.add(k(x, y));
          if (ch === '.' || ch === '*' || ch === '+') goals.add(k(x, y));
          if (ch === '$' || ch === '*') boxes.add(k(x, y));
          if (ch === '@' || ch === '+') { px = x; py = y; }
        }
      });
      CELL = Math.min(70, Math.floor(Math.min(600 / W, 440 / Hh)));
      steps = 0; pushes = 0; history = []; done = false;
      banner.style.display = 'none';
      api.status('Arrow keys or WASD. You can push a crate, never pull it. Think before you shove.');
      sync();
    }

    function move(dir) {
      if (done) return;
      const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir] || [0, 0];
      if (!dx && !dy) return;
      const nx = px + dx, ny = py + dy;
      if (walls.has(k(nx, ny))) return;
      let pushed = false;
      if (boxes.has(k(nx, ny))) {
        const bx = nx + dx, by = ny + dy;
        if (walls.has(k(bx, by)) || boxes.has(k(bx, by))) return;
        boxes.delete(k(nx, ny));
        boxes.add(k(bx, by));
        pushed = true;
      }
      history.push({ px, py, pushed, from: k(nx, ny), to: k(nx + dx, ny + dy) });
      if (history.length > 400) history.shift();
      px = nx; py = ny;
      steps++;
      if (pushed) { pushes++; api.sfx.thud(); }
      sync();
      if ([...boxes].every((b) => goals.has(b))) win();
    }

    function undo() {
      if (done || !history.length) return;
      const hst = history.pop();
      if (hst.pushed) { boxes.delete(hst.to); boxes.add(hst.from); pushes--; }
      px = hst.px; py = hst.py;
      steps--;
      api.sfx.click();
      sync();
    }

    function win() {
      done = true;
      api.sfx.great();
      const solved = Math.max(api.load('solved', 0), level + 1);
      api.save('solved', solved);
      api.submit(solved);
      if (level + 1 < LEVELS.length) {
        Engine.autoAdvance(banner, 'Every crate home.',
          'Level ' + (level + 1) + ' in ' + steps + ' steps and ' + pushes + ' pushes.',
          'Level ' + (level + 2), () => load(level + 1));
      } else {
        banner.style.display = '';
        banner.replaceChildren(h('h3', null, 'Every crate home.'),
          h('p', null, 'That was the last warehouse. All ' + LEVELS.length + ' cleared.'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => load(0) }, 'Start over'));
      }
    }

    function sync() {
      pLevel.textContent = 'Level ' + (level + 1) + '/' + LEVELS.length;
      pSteps.textContent = 'Steps: ' + steps;
      pPush.textContent = 'Pushes: ' + pushes;
    }

    function draw() {
      ctx.fillStyle = '#0a1020';
      ctx.fillRect(0, 0, cv.w, cv.h);
      const ox = (cv.w - W * CELL) / 2, oy = (cv.h - Hh * CELL) / 2;
      const X = (x) => ox + x * CELL, Y = (y) => oy + y * CELL;

      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        if (walls.has(k(x, y))) continue;
        ctx.fillStyle = '#101828';
        ctx.fillRect(X(x), Y(y), CELL, CELL);
        ctx.strokeStyle = '#1a2338';
        ctx.lineWidth = 1;
        ctx.strokeRect(X(x) + 0.5, Y(y) + 0.5, CELL - 1, CELL - 1);
      }
      for (const key of walls) {
        const [x, y] = key.split(',').map(Number);
        ctx.fillStyle = '#414f70';
        Engine.roundRect(ctx, X(x) + 1, Y(y) + 1, CELL - 2, CELL - 2, 4);
        ctx.fill();
      }
      for (const key of goals) {
        const [x, y] = key.split(',').map(Number);
        ctx.strokeStyle = boxes.has(key) ? '#9dff5c' : '#ffc043';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(X(x) + CELL / 2, Y(y) + CELL / 2, CELL * 0.17, 0, 7);
        ctx.stroke();
      }
      for (const key of boxes) {
        const [x, y] = key.split(',').map(Number);
        const on = goals.has(key);
        const m = CELL * 0.13;
        ctx.fillStyle = on ? '#4a8c34' : '#8a6a3a';
        Engine.roundRect(ctx, X(x) + m, Y(y) + m, CELL - m * 2, CELL - m * 2, 6);
        ctx.fill();
        ctx.fillStyle = on ? '#9dff5c' : '#c9a06a';
        Engine.roundRect(ctx, X(x) + m + 4, Y(y) + m + 4, CELL - m * 2 - 8, CELL - m * 2 - 8, 4);
        ctx.fill();
        ctx.strokeStyle = on ? '#4a8c34' : '#8a6a3a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(X(x) + m + 4, Y(y) + m + 4);
        ctx.lineTo(X(x) + CELL - m - 4, Y(y) + CELL - m - 4);
        ctx.moveTo(X(x) + CELL - m - 4, Y(y) + m + 4);
        ctx.lineTo(X(x) + m + 4, Y(y) + CELL - m - 4);
        ctx.stroke();
      }
      /* player */
      const cx = X(px) + CELL / 2, cy = Y(py) + CELL / 2;
      ctx.fillStyle = '#38e1ff';
      ctx.beginPath();
      ctx.arc(cx, cy - CELL * 0.11, CELL * 0.15, 0, 7);
      ctx.fill();
      Engine.roundRect(ctx, cx - CELL * 0.16, cy - CELL * 0.02, CELL * 0.32, CELL * 0.3, CELL * 0.08);
      ctx.fill();
    }

    bagg.add(Engine.onKey((e) => {
      const m = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right'
      }[e.key];
      if (m) { move(m); return true; }
      if (e.key === 'z' || e.key === 'Z' || e.key === 'u') { undo(); return true; }
      if (e.key === 'r' || e.key === 'R') { load(level); return true; }
    }));

    load(level);
    bagg.add(Engine.loop(draw));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'sokoban',
    title: 'Crate Pusher',
    emoji: 'sokoban',
    cat: 'puzzle',
    order: 13,
    blurb: 'Push crates onto the markers. You can push. You cannot pull. One thoughtless shove and the level is quietly unwinnable.',
    scoreLabel: 'Levels solved',
    tags: ['sokoban', 'boxes', 'warehouse', 'logic'],
    how: [
      'Arrows or WASD to walk. Walking into a crate shoves it one square.',
      'You can never pull. A crate in a corner is there forever.',
      'Z or the Undo button rewinds. Use it constantly, nobody is watching.',
      'Every crate on a ringed marker finishes the level.',
      'All twenty-five warehouses were checked by a solver before shipping, ramping from easy to hard. Use the Level menu to jump straight to any of them.'
    ],
    mount
  });
})();
