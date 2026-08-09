(function () {
  'use strict';
  const { clamp, rand, pick } = Engine;

  function mount(root, api) {
    const bagg = Engine.bag();
    const W = 760, H = 560;
    const cv = Engine.canvas(root, W, H, { maxHeight: '78vh' });
    const ctx = cv.ctx;

    const COLS = 9, ROWS = 5, TOTAL = COLS * ROWS;
    const invW = 38, invH = 24, colStep = 60, rowStep = 40;
    const x0 = Math.round((W - ((COLS - 1) * colStep + invW)) / 2);
    const rowColors = ['#e8402a', '#6f3fa8', '#00a6b4', '#6fcf2f', '#ffcb1f'];
    const margin = 16;
    const shipY = H - 40, shipW = 46, shipH = 16;
    const breachLine = H - 74;

    const startLives = api.diffId === 'nightmare' ? 2 : (api.diffId === 'chill' ? 4 : 3);
    const maxShots = api.diffId === 'chill' ? 4 : (api.hard ? 2 : 3);
    const bunkerCount = api.hard ? 3 : 4;
    const speedDm = 0.9 + (api.dm - 1) * 0.45;

    const scorePill = api.pill('Score 0');
    const livesPill = api.pill('Lives ' + startLives);
    const wavePill = api.pill('Wave 1');
    api.status('Arrow keys or A/D to strafe, Space to fire. Touch: D-pad, FIRE in the center.');

    const keys = Engine.keys(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD']);
    bagg.add(keys.dispose);

    let inv, dir, fx, fy, shots, bombs, bunkers, ufo, ufoTimer;
    let ship, aimX, lives, score, wave, fireCd, bombCd, state, breakT, respawnT, overCd, fireQueued, result;

    function buildBunkers() {
      bunkers = [];
      const cols = 12, rows = 8, cell = 5;
      const bw = cols * cell;
      const by = H - 150;
      const gap = W / (bunkerCount + 1);
      for (let i = 0; i < bunkerCount; i++) {
        const bx = Math.round(gap * (i + 1) - bw / 2);
        const grid = [];
        for (let r = 0; r < rows; r++) {
          const rowArr = [];
          for (let c = 0; c < cols; c++) rowArr.push(true);
          grid.push(rowArr);
        }
        // round the top corners
        grid[0][0] = grid[0][1] = grid[0][cols - 1] = grid[0][cols - 2] = false;
        grid[1][0] = grid[1][cols - 1] = false;
        // carve a doorway at the bottom center
        for (let r = rows - 3; r < rows; r++) {
          for (let c = 4; c < 8; c++) grid[r][c] = false;
        }
        bunkers.push({ x: bx, y: by, cols: cols, rows: rows, cell: cell, grid: grid });
      }
    }

    function spawnWave(n) {
      inv = [];
      const startY = 60 + Math.min(6, n - 1) * 14;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          inv.push({ col: c, row: r, alive: true, color: rowColors[r], points: (ROWS - r) * 10 });
        }
      }
      dir = 1; fx = 0; fy = startY;
      shots = []; bombs = []; ufo = null;
      ufoTimer = rand(8, 16);
      bombCd = rand(0.6, 1.4);
    }

    function invX(iv) { return x0 + iv.col * colStep + fx; }
    function invY(iv) { return iv.row * rowStep + fy; }

    function reset() {
      lives = startLives; score = 0; wave = 1;
      ship = { x: (W - shipW) / 2 };
      aimX = ship.x;
      fireCd = 0; respawnT = 0; overCd = 0; fireQueued = false;
      state = 'play'; breakT = 0; result = null;
      buildBunkers();
      spawnWave(1);
      updateHud();
    }

    function updateHud() {
      scorePill.textContent = 'Score ' + score;
      livesPill.textContent = 'Lives ' + Math.max(0, lives);
      wavePill.textContent = 'Wave ' + wave;
    }

    function aliveList() { return inv.filter(function (v) { return v.alive; }); }

    function fire() {
      shots.push({ x: ship.x + shipW / 2, y: shipY - 6 });
      fireCd = 0.30;
      api.sfx.tone({ freq: 660, to: 900, dur: 0.08, type: 'square', vol: 0.5 });
    }

    function hitBunker(px, py) {
      for (let i = 0; i < bunkers.length; i++) {
        const b = bunkers[i];
        if (px < b.x || px >= b.x + b.cols * b.cell) continue;
        if (py < b.y || py >= b.y + b.rows * b.cell) continue;
        const ci = Math.floor((px - b.x) / b.cell);
        const ri = Math.floor((py - b.y) / b.cell);
        if (!b.grid[ri] || !b.grid[ri][ci]) continue;
        const rad = 1;
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            const nr = ri + dy, nc = ci + dx;
            if (b.grid[nr] && b.grid[nr][nc] && (Math.abs(dx) + Math.abs(dy) <= rad || Math.random() < 0.4)) {
              b.grid[nr][nc] = false;
            }
          }
        }
        return true;
      }
      return false;
    }

    function loseLife(reason) {
      lives--;
      updateHud();
      api.sfx.bad();
      bombs = [];
      if (lives <= 0) {
        gameOver();
      } else {
        respawnT = 1.1;
        if (reason === 'breach') fy = 60;
        ship.x = (W - shipW) / 2;
        aimX = ship.x;
      }
    }

    function gameOver() {
      state = 'over';
      overCd = 0.7;
      api.sfx.thud();
      api.sfx.boom();
      result = api.submit(score);
    }

    function rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    function update(dt) {
      if (state === 'over') {
        if (overCd > 0) overCd -= dt;
        return;
      }
      if (state === 'break') {
        breakT -= dt;
        if (breakT <= 0) {
          wave++;
          updateHud();
          spawnWave(wave);
          state = 'play';
        }
        return;
      }

      const spd = 300;
      const left = keys.get('ArrowLeft', 'a', 'A');
      const right = keys.get('ArrowRight', 'd', 'D');
      if (left || right) {
        ship.x += (right ? 1 : 0) * spd * dt - (left ? 1 : 0) * spd * dt;
        ship.x = clamp(ship.x, margin, W - margin - shipW);
        aimX = ship.x;
      } else {
        const d = clamp(aimX - ship.x, -spd * dt, spd * dt);
        ship.x = clamp(ship.x + d, margin, W - margin - shipW);
      }
      aimX = clamp(aimX, margin, W - margin - shipW);

      if (respawnT > 0) respawnT -= dt;
      fireCd -= dt;
      const wantFire = keys.get('Space', ' ') || fireQueued;
      if (wantFire && fireCd <= 0 && shots.length < maxShots) {
        fire();
        fireQueued = false;
      }

      // player shots
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.y -= 470 * dt;
        if (s.y < -12) { shots.splice(i, 1); continue; }
        if (hitBunker(s.x, s.y)) { shots.splice(i, 1); continue; }
        if (ufo && rectHit(s.x - 2, s.y, 4, 10, ufo.x, ufo.y, ufo.w, ufo.h)) {
          score += ufo.points; updateHud(); api.sfx.great();
          ufo = null; shots.splice(i, 1); continue;
        }
        const list = aliveList();
        let done = false;
        for (let j = 0; j < list.length; j++) {
          const v = list[j];
          const vx = invX(v), vy = invY(v);
          if (rectHit(s.x - 2, s.y, 4, 10, vx, vy, invW, invH)) {
            v.alive = false;
            score += v.points; updateHud();
            api.sfx.blip(700 + v.row * 60);
            shots.splice(i, 1); done = true; break;
          }
        }
        if (done) continue;
      }

      // wave cleared?
      const alive = aliveList();
      if (alive.length === 0) {
        state = 'break'; breakT = 1.2;
        api.sfx.great();
        return;
      }

      // march the formation
      const frac = alive.length / TOTAL;
      const waveFactor = 1 + (wave - 1) * 0.1;
      const speed = (22 + (1 - frac) * 95) * speedDm * waveFactor;
      fx += dir * speed * dt;
      let minC = COLS, maxC = 0, maxR = 0;
      for (let k = 0; k < alive.length; k++) {
        if (alive[k].col < minC) minC = alive[k].col;
        if (alive[k].col > maxC) maxC = alive[k].col;
        if (alive[k].row > maxR) maxR = alive[k].row;
      }
      const groupLeft = x0 + minC * colStep + fx;
      const groupRight = x0 + maxC * colStep + invW + fx;
      if (dir > 0 && groupRight >= W - margin) { dir = -1; fy += 16; }
      else if (dir < 0 && groupLeft <= margin) { dir = 1; fy += 16; }

      // breach at the bottom
      const lowest = maxR * rowStep + fy + invH;
      if (lowest >= breachLine) {
        loseLife('breach');
        if (state === 'over') return;
      }

      // invader bombs, dropped from the lowest of a random column
      bombCd -= dt;
      const maxBombs = (api.hard ? 5 : 3) + (wave - 1);
      if (bombCd <= 0 && bombs.length < maxBombs) {
        const byCol = {};
        for (let k = 0; k < alive.length; k++) {
          const v = alive[k];
          if (!byCol[v.col] || v.row > byCol[v.col].row) byCol[v.col] = v;
        }
        const shooters = Object.keys(byCol).map(function (kk) { return byCol[kk]; });
        const shooter = pick(shooters);
        bombs.push({ x: invX(shooter) + invW / 2, y: invY(shooter) + invH });
        bombCd = rand(0.7, 1.7) / (speedDm * waveFactor);
      }
      const bombSpd = 210 * (0.85 + 0.15 * api.dm);
      for (let i = bombs.length - 1; i >= 0; i--) {
        const b = bombs[i];
        b.y += bombSpd * dt;
        if (b.y > H) { bombs.splice(i, 1); continue; }
        if (hitBunker(b.x, b.y)) { bombs.splice(i, 1); continue; }
        if (respawnT <= 0 && rectHit(b.x - 2, b.y, 4, 10, ship.x, shipY, shipW, shipH)) {
          bombs.splice(i, 1);
          loseLife('hit');
          if (state === 'over') return;
        }
      }

      // urgent bonus invader
      if (ufo) {
        ufo.x += ufo.vx * dt;
        if (ufo.x > W + 60 || ufo.x < -60) ufo = null;
      } else {
        ufoTimer -= dt;
        if (ufoTimer <= 0 && alive.length > 2) {
          const fromLeft = Math.random() < 0.5;
          ufo = {
            x: fromLeft ? -50 : W + 50,
            y: 30, w: 60, h: 18,
            vx: (fromLeft ? 1 : -1) * 130,
            points: pick([50, 100, 150, 200])
          };
          ufoTimer = rand(12, 22);
        }
      }
    }

    function drawInv(ix, iy, color) {
      ctx.fillStyle = color;
      ctx.fillRect(ix, iy, invW, invH);
      ctx.strokeStyle = '#1d1722';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ix, iy, invW, invH);
      ctx.beginPath();
      ctx.moveTo(ix, iy);
      ctx.lineTo(ix + invW / 2, iy + invH * 0.55);
      ctx.lineTo(ix + invW, iy);
      ctx.stroke();
    }

    function drawShip() {
      ctx.fillStyle = '#00a6b4';
      ctx.fillRect(ship.x, shipY + 4, shipW, shipH - 4);
      ctx.fillRect(ship.x + shipW / 2 - 3, shipY - 6, 6, 10);
      ctx.strokeStyle = '#1d1722';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ship.x, shipY + 4, shipW, shipH - 4);
    }

    function draw() {
      cv.clear('#0c1119');
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      for (let i = 0; i < 40; i++) {
        const sx = (i * 97 + 13) % W;
        const sy = (i * 53 + 29) % (H - 120);
        ctx.fillRect(sx, sy, 2, 2);
      }
      for (let i = 0; i < bunkers.length; i++) {
        const b = bunkers[i];
        ctx.fillStyle = '#6fcf2f';
        for (let r = 0; r < b.rows; r++) {
          for (let c = 0; c < b.cols; c++) {
            if (b.grid[r][c]) ctx.fillRect(b.x + c * b.cell, b.y + r * b.cell, b.cell, b.cell);
          }
        }
      }
      const alive = aliveList();
      for (let i = 0; i < alive.length; i++) {
        drawInv(invX(alive[i]), invY(alive[i]), alive[i].color);
      }
      if (ufo) {
        ctx.fillStyle = '#ff2d87';
        ctx.fillRect(ufo.x, ufo.y, ufo.w, ufo.h);
        ctx.strokeStyle = '#1d1722';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ufo.x, ufo.y, ufo.w, ufo.h);
        ctx.fillStyle = '#fffdf3';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('URGENT', ufo.x + ufo.w / 2, ufo.y + ufo.h / 2 + 1);
      }
      ctx.fillStyle = '#ffcb1f';
      for (let i = 0; i < shots.length; i++) ctx.fillRect(shots[i].x - 2, shots[i].y, 4, 10);
      ctx.fillStyle = '#e8402a';
      for (let i = 0; i < bombs.length; i++) ctx.fillRect(bombs[i].x - 2, bombs[i].y, 4, 10);

      if (!(respawnT > 0 && Math.floor(respawnT * 10) % 2 === 0)) drawShip();

      if (state === 'over') {
        ctx.fillStyle = 'rgba(12,17,25,0.8)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffcb1f';
        ctx.font = 'bold 44px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 40);
        ctx.fillStyle = '#fffdf3';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('Final Score ' + score, W / 2, H / 2 + 4);
        if (result && result.isRecord) {
          ctx.fillStyle = '#6fcf2f';
          ctx.fillText('NEW RECORD', W / 2, H / 2 + 34);
        }
        ctx.fillStyle = '#cfc6ae';
        ctx.font = '15px monospace';
        ctx.fillText('Press Space or New Game to retry', W / 2, H / 2 + 70);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    Engine.dpad(root, function (d) {
      if (state === 'over') {
        if (d === 'action' && overCd <= 0) reset();
        return;
      }
      if (d === 'left') aimX = clamp(aimX - 70, margin, W - margin - shipW);
      else if (d === 'right') aimX = clamp(aimX + 70, margin, W - margin - shipW);
      else if (d === 'action') fireQueued = true;
    }, { center: 'FIRE', class: 'touch-only' });

    bagg.add(Engine.onKey(function (e) {
      if (state === 'over' && overCd <= 0 && (e.code === 'Space' || e.key === ' ' || e.code === 'Enter')) {
        reset();
        return true;
      }
      return false;
    }));

    api.button('New Game', function () { reset(); });

    reset();

    bagg.add(Engine.loop(function (dt) {
      update(dt);
      draw();
    }));

    return function () { bagg.dispose(); };
  }

  Arcade.register({
    id: 'invaders',
    title: 'Inbox Invaders',
    emoji: 'invaders',
    cat: 'action',
    order: 30,
    blurb: 'A formation of unread email marches down the screen. Shoot every one before it reaches the bottom.',
    scoreLabel: 'Score',
    tags: ['shooter', 'arcade', 'reflex'],
    how: [
      'Shoot every email invader before the formation reaches the bottom.',
      'Move with Left/Right or A/D and fire with Space. On touch, use the D-pad and the centre FIRE button.',
      'The fewer invaders left, the faster they march and drop. Out-of-Office bunkers soak up fire but wear away.',
      'Score by shooting invaders. The URGENT banner sweeping the top is worth a big bonus.',
      'You start with three lives and lose one when an invader lands or a bomb hits you. Each cleared wave returns faster and lower.',
      'Higher settings bring faster invaders, more bombs, and fewer bunkers. Nightmare also starts you with fewer lives.'
    ],
    usesLetters: true,
    mount: mount
  });
})();