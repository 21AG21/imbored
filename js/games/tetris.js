/* Stacker. Falling blocks with hold, ghost and a proper 7-bag. */
(function () {
  'use strict';
  const { h, clamp, randInt } = Engine;

  const COLS = 10, ROWS = 20, CELL = 26;
  const WX = 28, WY = 34;
  const W = 520, H = WY + ROWS * CELL + 26;

  const PIECES = {
    I: { box: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]], color: '#38e1ff' },
    O: { box: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: '#ffc043' },
    T: { box: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]], color: '#c08cff' },
    S: { box: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: '#9dff5c' },
    Z: { box: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: '#ff5c8f' },
    J: { box: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: '#7aa2ff' },
    L: { box: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: '#ff8f4d' }
  };
  const NAMES = Object.keys(PIECES);
  const KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [0, -2]];

  function rotate(cells, box, times) {
    let out = cells.map(([x, y]) => [x, y]);
    for (let t = 0; t < ((times % 4) + 4) % 4; t++) out = out.map(([x, y]) => [box - 1 - y, x]);
    return out;
  }

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;

    let board, cur, hold, canHold, bag, queue, score, lines, level, dropT, lockT, over, paused, clearAnim, combo;
    let dasDir = 0, dasT = 0;
    const startLevel = api.dm > 2 ? 7 : api.dm > 1.2 ? 4 : 1;

    const pScore = api.pill('Score: 0');
    const pLines = api.pill('Lines: 0');
    const pLevel = api.pill('Level 1');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);
    Engine.dpad(root, (d) => {
      if (d === 'left') move(-1);
      else if (d === 'right') move(1);
      else if (d === 'down') softDrop();
      else if (d === 'up') spin(1);
      else hardDrop();
    }, { center: '⤓', class: 'touch-only' });

    api.button('Restart', reset);
    api.button('Pause', () => { paused = !paused; });

    function refillBag() {
      const b = NAMES.slice();
      for (let i = b.length - 1; i > 0; i--) { const j = randInt(0, i); [b[i], b[j]] = [b[j], b[i]]; }
      bag = bag.concat(b);
    }
    function nextPiece() {
      if (bag.length < 8) refillBag();
      return bag.shift();
    }

    function spawn(name) {
      const p = PIECES[name];
      const piece = {
        name, box: p.box, color: p.color, rot: 0,
        x: Math.floor((COLS - p.box) / 2), y: -1,
        cells: p.cells
      };
      if (collides(piece, 0, 0, 0)) return end();
      cur = piece;
      canHold = true;
      lockT = 0;
    }

    function reset() {
      board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      bag = []; queue = [];
      hold = null; canHold = true;
      score = 0; lines = 0; level = api.dm > 2 ? 7 : api.dm > 1.2 ? 4 : 1; dropT = 0; lockT = 0;
      over = false; paused = false; clearAnim = null; combo = -1;
      refillBag();
      for (let i = 0; i < 5; i++) queue.push(nextPiece());
      spawn(queue.shift());
      queue.push(nextPiece());
      banner.style.display = 'none';
      api.status('← → move · ↑ or X rotate · Z rotate back · ↓ soft drop · Space hard drop · C hold · P pause');
      sync();
    }

    function blocksOf(p, rot) {
      return rotate(p.cells, p.box, rot === undefined ? p.rot : rot);
    }

    function collides(p, dx, dy, drot) {
      const cells = blocksOf(p, p.rot + (drot || 0));
      for (const [cx, cy] of cells) {
        const x = p.x + cx + dx, y = p.y + cy + dy;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && board[y][x]) return true;
      }
      return false;
    }

    function move(dx) {
      if (!cur || over || paused || clearAnim) return;
      if (!collides(cur, dx, 0, 0)) { cur.x += dx; lockT = 0; api.sfx.click(); }
    }

    function spin(dir) {
      if (!cur || over || paused || clearAnim) return;
      for (const [kx, ky] of KICKS) {
        if (!collides(cur, kx, ky, dir)) {
          cur.x += kx; cur.y += ky;
          cur.rot = ((cur.rot + dir) % 4 + 4) % 4;
          lockT = 0;
          api.sfx.blip(500);
          return;
        }
      }
    }

    function softDrop() {
      if (!cur || over || paused || clearAnim) return;
      if (!collides(cur, 0, 1, 0)) { cur.y++; score++; dropT = 0; }
    }

    function hardDrop() {
      if (!cur || over || paused || clearAnim) return;
      let d = 0;
      while (!collides(cur, 0, d + 1, 0)) d++;
      cur.y += d;
      score += d * 2;
      api.sfx.thud();
      lock();
    }

    function ghostY() {
      let d = 0;
      while (!collides(cur, 0, d + 1, 0)) d++;
      return cur.y + d;
    }

    function lock() {
      for (const [cx, cy] of blocksOf(cur)) {
        const x = cur.x + cx, y = cur.y + cy;
        if (y < 0) return end();
        board[y][x] = cur.color;
      }
      const full = [];
      for (let y = 0; y < ROWS; y++) if (board[y].every((c) => c)) full.push(y);

      if (full.length) {
        clearAnim = { rows: full, t: 0.28 };
        api.sfx[full.length === 4 ? 'great' : 'good']();
        combo++;
        const base = [0, 100, 300, 500, 800][full.length] || 800;
        score += base * level + (combo > 0 ? combo * 50 * level : 0);
        lines += full.length;
        const newLevel = startLevel + Math.floor(lines / 10);
        if (newLevel > level) { level = newLevel; }
      } else {
        combo = -1;
        cur = null;
        spawnNext();
      }
      sync();
    }

    function spawnNext() {
      spawn(queue.shift());
      queue.push(nextPiece());
    }

    function finishClear() {
      for (const y of clearAnim.rows.slice().sort((a, b) => a - b)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(null));
      }
      clearAnim = null;
      cur = null;
      spawnNext();
    }

    function doHold() {
      if (!cur || !canHold || over || paused || clearAnim) return;
      const cname = cur.name;
      if (hold) {
        const hname = hold;
        hold = cname;
        spawn(hname);
      } else {
        hold = cname;
        cur = null;
        spawnNext();
      }
      canHold = false;
      api.sfx.blip(380);
      sync();
    }

    function end() {
      over = true;
      cur = null;
      api.sfx.bad();
      const res = api.submit(score);
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Stack out.'),
        h('p', null, score.toLocaleString() + ' points, ' + lines + ' lines, level ' + level + '.' +
          (res.isRecord ? ' New personal best!' : res.isFirst ? '' : ' Best: ' + res.best.toLocaleString() + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Again'));
    }

    function sync() {
      pScore.textContent = 'Score: ' + score.toLocaleString();
      pLines.textContent = 'Lines: ' + lines;
      pLevel.textContent = 'Level ' + level;
    }

    const gravity = () => Math.max(0.045, 0.82 - (level - 1) * 0.065);

    function update(dt) {
      if (over || paused) return;
      if (clearAnim) {
        clearAnim.t -= dt;
        if (clearAnim.t <= 0) finishClear();
        return;
      }
      if (!cur) return;

      if (dasDir) {
        dasT -= dt;
        if (dasT <= 0) { move(dasDir); dasT = 0.045; }
      }

      dropT += dt;
      if (dropT >= gravity()) {
        dropT = 0;
        if (!collides(cur, 0, 1, 0)) cur.y++;
      }
      if (collides(cur, 0, 1, 0)) {
        lockT += dt;
        if (lockT > 0.5) lock();
      } else lockT = 0;
    }

    /* ---------------- render ---------------- */
    function cellRect(x, y, color, alpha) {
      ctx.globalAlpha = alpha === undefined ? 1 : alpha;
      ctx.fillStyle = color;
      Engine.roundRect(ctx, x + 1, y + 1, CELL - 2, CELL - 2, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      Engine.roundRect(ctx, x + 4, y + 4, CELL - 8, 4, 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function drawMini(name, ox, oy, scale) {
      if (!name) return;
      const p = PIECES[name];
      const s = CELL * scale;
      const xs = p.cells.map((c) => c[0]), ys = p.cells.map((c) => c[1]);
      const cw = (Math.max(...xs) - Math.min(...xs) + 1) * s;
      const ch = (Math.max(...ys) - Math.min(...ys) + 1) * s;
      const bx = ox - cw / 2 - Math.min(...xs) * s;
      const by = oy - ch / 2 - Math.min(...ys) * s;
      ctx.fillStyle = p.color;
      for (const [cx, cy] of p.cells) {
        Engine.roundRect(ctx, bx + cx * s + 1, by + cy * s + 1, s - 2, s - 2, 3);
        ctx.fill();
      }
    }

    function draw() {
      ctx.fillStyle = '#080d18';
      ctx.fillRect(0, 0, W, H);

      /* well */
      ctx.fillStyle = '#0d1424';
      Engine.roundRect(ctx, WX - 5, WY - 5, COLS * CELL + 10, ROWS * CELL + 10, 8);
      ctx.fill();
      ctx.strokeStyle = '#232d48';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < COLS; x++) { ctx.moveTo(WX + x * CELL, WY); ctx.lineTo(WX + x * CELL, WY + ROWS * CELL); }
      for (let y = 1; y < ROWS; y++) { ctx.moveTo(WX, WY + y * CELL); ctx.lineTo(WX + COLS * CELL, WY + y * CELL); }
      ctx.stroke();

      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (!board[y][x]) continue;
        const clearing = clearAnim && clearAnim.rows.includes(y);
        cellRect(WX + x * CELL, WY + y * CELL, clearing ? '#ffffff' : board[y][x], clearing ? clamp(clearAnim.t / 0.28, 0, 1) : 1);
      }

      if (cur && !clearAnim) {
        const gy = ghostY();
        for (const [cx, cy] of blocksOf(cur)) {
          const y = gy + cy;
          if (y < 0) continue;
          ctx.strokeStyle = cur.color;
          ctx.globalAlpha = 0.32;
          ctx.lineWidth = 2;
          Engine.roundRect(ctx, WX + (cur.x + cx) * CELL + 2, WY + y * CELL + 2, CELL - 4, CELL - 4, 4);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        for (const [cx, cy] of blocksOf(cur)) {
          const y = cur.y + cy;
          if (y < 0) continue;
          cellRect(WX + (cur.x + cx) * CELL, WY + y * CELL, cur.color);
        }
      }

      /* side panel */
      const px = WX + COLS * CELL + 30;
      ctx.fillStyle = '#8f9ab8';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('HOLD', px, WY + 8);
      ctx.fillStyle = '#0d1424';
      Engine.roundRect(ctx, px, WY + 16, 130, 70, 8);
      ctx.fill();
      if (hold) drawMini(hold, px + 65, WY + 51, 0.72);

      ctx.fillStyle = '#8f9ab8';
      ctx.fillText('NEXT', px, WY + 118);
      ctx.fillStyle = '#0d1424';
      Engine.roundRect(ctx, px, WY + 126, 130, 300, 8);
      ctx.fill();
      queue.slice(0, 5).forEach((n, i) => drawMini(n, px + 65, WY + 166 + i * 58, 0.62));

      if (paused || over) {
        ctx.fillStyle = 'rgba(8,13,24,.68)';
        ctx.fillRect(WX - 5, WY - 5, COLS * CELL + 10, ROWS * CELL + 10);
        ctx.fillStyle = '#e8ecf7';
        ctx.font = 'bold 22px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(over ? 'game over' : 'paused', WX + COLS * CELL / 2, WY + ROWS * CELL / 2);
      }
      ctx.textAlign = 'left';
    }

    bagg.add(Engine.onKey((e) => {
      if (e.ctrlKey || e.metaKey) return;
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A': if (!e.repeat) { move(-1); dasDir = -1; dasT = 0.16; } return true;
        case 'ArrowRight': case 'd': case 'D': if (!e.repeat) { move(1); dasDir = 1; dasT = 0.16; } return true;
        case 'ArrowDown': case 's': case 'S': softDrop(); return true;
        case 'ArrowUp': case 'x': case 'X': if (!e.repeat) spin(1); return true;
        case 'z': case 'Z': if (!e.repeat) spin(-1); return true;
        case ' ': if (!e.repeat) hardDrop(); return true;
        case 'c': case 'C': if (!e.repeat) doHold(); return true;
        case 'p': case 'P': paused = !paused; return true;
      }
    }));
    bagg.listen(window, 'keyup', (e) => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key) && dasDir === -1) dasDir = 0;
      if (['ArrowRight', 'd', 'D'].includes(e.key) && dasDir === 1) dasDir = 0;
    });

    reset();
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    let rafId = 0;
    (function paint() { rafId = requestAnimationFrame(paint); if (Engine.paused) draw(); })();
    bagg.add(() => cancelAnimationFrame(rafId));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'tetris',
    title: 'Stacker',
    emoji: 'tetris',
    cat: 'action',
    order: 32,
    blurb: 'Falling blocks with hold, ghost piece, hard drop and a proper 7-bag. You already know exactly what to do here.',
    scoreLabel: 'Score',
    tags: ['tetris', 'blocks', 'stacking'],
    how: [
      'Left and right move. Up or X spins clockwise, Z spins the other way.',
      'Down soft drops for a point a row. Space hard drops for two.',
      'C parks a piece in hold. One swap per piece.',
      'Four lines at once is 800 times the level. Back to back clears build a combo bonus on top.',
      'P pauses. Hard starts you at level 4 and Nightmare at level 7, which is not a gentle place to begin.'
    ],
    mount
  });
})();
