/* Bubble Wrap — a bubble shooter. Aim, fire, and land three-plus of a colour to
 * pop them; anything left dangling with nothing above drops too. Miss and your
 * bubble just sticks, growing the ceiling downward — let it reach the line and
 * the meeting's over. Pop the board clean to move on. */
(function () {
  'use strict';
  const { h, clamp, randInt, pick } = Engine;
  const W = 520, H = 560;
  const R = 20, D = 40, ROWH = D * 0.866, TOP = 6, MARGIN = 20;
  const COLORS = ['#e8402a', '#2a7fd6', '#ffcb1f', '#6fcf2f', '#a05fd8'];
  const DANGER = Math.floor((H - 60 - TOP - R) / ROWH);   // row at which you lose

  const colsInRow = (r) => (r % 2 === 0 ? 12 : 11);
  const cx = (r, c) => MARGIN + R + (r % 2) * (D / 2) + c * D;
  const cyOf = (r) => TOP + R + r * ROWH;

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H, { maxHeight: '66vh' });
    const ctx = cv.ctx;

    let grid, cur, next, shot, aim, shots, score, over, won, level;

    const pScore = api.pill('Popped 0');
    const pLevel = api.pill('Level 1');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);
    api.button('New game', () => { level = 1; reset(); });

    function palette() { return COLORS.slice(0, Math.min(COLORS.length, 3 + level)); }
    function randColor() { return randInt(0, palette().length - 1); }

    function reset() {
      grid = [];
      const rows = 4 + Math.min(4, level);
      for (let r = 0; r < rows; r++) { grid[r] = []; for (let c = 0; c < colsInRow(r); c++) grid[r][c] = randColor(); }
      cur = randColor(); next = randColor();
      shot = null; aim = -Math.PI / 2; shots = 0; score = 0; over = false; won = false;
      banner.style.display = 'none';
      pScore.textContent = 'Popped 0';
      pLevel.textContent = 'Level ' + level;
      api.status('Aim with the mouse and click to fire. Land three or more of a colour together to pop them. Bubbles that lose their grip on the ceiling fall too. Do not let the wall reach the line.');
    }
    level = 1; reset();

    function neighbors(r, c) {
      const odd = r % 2;
      const list = odd
        ? [[r, c - 1], [r, c + 1], [r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]]
        : [[r, c - 1], [r, c + 1], [r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]];
      return list.filter(([nr, nc]) => nr >= 0 && grid[nr] && nc >= 0 && nc < colsInRow(nr));
    }
    const at = (r, c) => (grid[r] && grid[r][c] != null) ? grid[r][c] : -1;

    /* find the empty grid cell whose centre is nearest (x,y) */
    function nearestCell(x, y) {
      const rr = Math.round((y - TOP - R) / ROWH);
      let best = null, bd = Infinity;
      for (let r = Math.max(0, rr - 1); r <= rr + 2; r++) {
        for (let c = 0; c < colsInRow(r); c++) {
          if (at(r, c) !== -1) continue;
          const d = Math.hypot(cx(r, c) - x, cyOf(r) - y);
          if (d < bd) { bd = d; best = [r, c]; }
        }
      }
      return best;
    }

    function popFrom(r, c, color) {
      const seen = new Set([r + ',' + c]), stack = [[r, c]], group = [[r, c]];
      while (stack.length) {
        const [y, x] = stack.pop();
        for (const [ny, nx] of neighbors(y, x)) {
          const k = ny + ',' + nx;
          if (!seen.has(k) && at(ny, nx) === color) { seen.add(k); stack.push([ny, nx]); group.push([ny, nx]); }
        }
      }
      return group;
    }

    function dropFloaters() {
      const anchored = new Set();
      const stack = [];
      for (let c = 0; c < colsInRow(0); c++) if (at(0, c) !== -1) { anchored.add('0,' + c); stack.push([0, c]); }
      while (stack.length) {
        const [y, x] = stack.pop();
        for (const [ny, nx] of neighbors(y, x)) { const k = ny + ',' + nx; if (!anchored.has(k) && at(ny, nx) !== -1) { anchored.add(k); stack.push([ny, nx]); } }
      }
      let dropped = 0;
      for (let r = 0; r < grid.length; r++) for (let c = 0; c < (grid[r] ? grid[r].length : 0); c++)
        if (at(r, c) !== -1 && !anchored.has(r + ',' + c)) { grid[r][c] = null; dropped++; }
      return dropped;
    }

    /* land a bubble of `color` at (x,y): snap, match, drop, check win/lose */
    function land(x, y, color) {
      const cell = nearestCell(x, y);
      if (!cell) { return; }
      const [r, c] = cell;
      if (!grid[r]) grid[r] = [];
      grid[r][c] = color;
      const group = popFrom(r, c, color);
      if (group.length >= 3) {
        for (const [gy, gx] of group) grid[gy][gx] = null;
        score += group.length;
        const dropped = dropFloaters();
        score += dropped * 2;
        api.sfx.great();
      } else api.sfx.click();
      pScore.textContent = 'Popped ' + score;
      /* win: board empty */
      let any = false, lowest = -1;
      for (let rr = 0; rr < grid.length; rr++) for (let cc = 0; cc < (grid[rr] ? grid[rr].length : 0); cc++) if (at(rr, cc) !== -1) { any = true; lowest = Math.max(lowest, rr); }
      if (!any) return winLevel();
      if (lowest >= DANGER) return end(false);
    }

    function winLevel() {
      won = true; over = true;
      api.sfx.great();
      const total = (api.load('cleared', 0)) + 1; api.save('cleared', total); api.submit(total);
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Board popped.'),
        h('p', null, 'Level ' + level + ' cleared. Boards cleared: ' + total + '.'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => { level++; reset(); } }, 'Next level'));
    }
    function end(win) {
      over = true; won = win;
      api.sfx.bad();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Wall reached the line.'),
        h('p', null, 'Popped ' + score + ' bubbles on level ' + level + '.'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => { level = 1; reset(); } }, 'Try again'));
    }

    bagg.listen(cv.el, 'pointermove', (e) => {
      const p = cv.pos(e); const dx = p.x - W / 2, dy = p.y - (H - 34);
      aim = clamp(Math.atan2(dy, dx), -Math.PI + 0.28, -0.28);
    });
    bagg.listen(cv.el, 'pointerdown', (e) => {
      if (over || shot) return;
      const p = cv.pos(e); const dx = p.x - W / 2, dy = p.y - (H - 34);
      aim = clamp(Math.atan2(dy, dx), -Math.PI + 0.28, -0.28);
      shot = { x: W / 2, y: H - 34, vx: Math.cos(aim) * 560, vy: Math.sin(aim) * 560, color: cur };
      cur = next; next = randColor(); shots++;
      api.sfx.blip(520);
    });

    function update(dt) {
      if (!shot) return;
      for (let s = 0; s < 4; s++) {
        shot.x += shot.vx * dt / 4; shot.y += shot.vy * dt / 4;
        if (shot.x < R) { shot.x = R; shot.vx = -shot.vx; }
        if (shot.x > W - R) { shot.x = W - R; shot.vx = -shot.vx; }
        if (shot.y <= TOP + R) { land(shot.x, TOP + R, shot.color); shot = null; return; }
        /* hit an existing bubble? */
        for (let r = 0; r < grid.length; r++) for (let c = 0; c < (grid[r] ? grid[r].length : 0); c++) {
          if (at(r, c) === -1) continue;
          if (Math.hypot(cx(r, c) - shot.x, cyOf(r) - shot.y) < D * 0.92) { land(shot.x, shot.y, shot.color); shot = null; return; }
        }
      }
    }

    function bubble(x, y, color, rad) {
      /* doc mode: every colour bubble becomes the same paper-white disc with
         a thin ink ring — no fillStyle taken from COLORS[] or any rgba tint,
         since a translucent black/white overlay still grayscales to a solid
         mid-tone under the lightBoard filter. */
      if (Arcade.docMode()) {
        ctx.fillStyle = Engine.docPaper(); ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, rad || R, 0, 7); ctx.fill(); ctx.stroke();
        return;
      }
      ctx.fillStyle = COLORS[color]; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, rad || R, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(x - (rad || R) * 0.3, y - (rad || R) * 0.3, (rad || R) * 0.28, 0, 7); ctx.fill();
    }

    function draw() {
      const doc = Arcade.docMode();
      ctx.fillStyle = doc ? Engine.docPaper() : '#141019'; ctx.fillRect(0, 0, W, H);
      /* danger line */
      const dy = cyOf(DANGER) - ROWH / 2;
      ctx.strokeStyle = doc ? Engine.docInk() : '#e8402a'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, dy); ctx.lineTo(W, dy); ctx.stroke(); ctx.setLineDash([]);
      /* grid */
      for (let r = 0; r < grid.length; r++) for (let c = 0; c < (grid[r] ? grid[r].length : 0); c++) if (at(r, c) !== -1) bubble(cx(r, c), cyOf(r), grid[r][c]);
      /* aim guide */
      if (!over && !shot) {
        ctx.strokeStyle = doc ? Engine.docInk() : 'rgba(255,255,255,.35)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(W / 2, H - 34); ctx.lineTo(W / 2 + Math.cos(aim) * 160, H - 34 + Math.sin(aim) * 160); ctx.stroke(); ctx.setLineDash([]);
      }
      /* shooter + queue */
      if (shot) bubble(shot.x, shot.y, shot.color);
      else if (!over) bubble(W / 2, H - 34, cur);
      bubble(W / 2 + 46, H - 22, next, 12);
      ctx.fillStyle = doc ? Engine.docInk() : '#f2ede0'; ctx.font = '10px Verdana'; ctx.textAlign = 'left'; ctx.fillText('next', W / 2 + 62, H - 19);
    }

    /* ---- test seam ---- */
    window.__bubble = {
      reset(lv) { if (lv != null) level = lv; reset(); },
      grid: () => grid.map((row) => row ? row.slice() : []),
      count: () => { let n = 0; for (let r = 0; r < grid.length; r++) for (let c = 0; c < (grid[r] ? grid[r].length : 0); c++) if (at(r, c) !== -1) n++; return n; },
      set(r, c, color) { if (!grid[r]) grid[r] = []; grid[r][c] = color; },
      clearAll() { grid = [[]]; },
      land: (r, c, color) => land(cx(r, c), cyOf(r), color),
      stats: () => ({ score, over, won, level, danger: DANGER, palette: palette().length })
    };
    bagg.add(() => { if (window.__bubble) delete window.__bubble; });

    bagg.add(Engine.loop((dt) => { update(Math.min(0.033, dt)); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'bubblewrap',
    title: 'Bubble Wrap',
    emoji: 'bubble',
    cat: 'puzzle',
    order: 19,
    lightBoard: true,   // doc mode draws its own paper/ink palette above; the blanket invert would only flip it back
    blurb: 'A bubble shooter. Fire bubbles up the board and pop clusters of three or more of a color. Every miss sticks and pushes the wall down toward the line.',
    scoreLabel: 'Boards cleared',
    tags: ['bubble-shooter', 'match', 'puzzle', 'aim'],
    how: [
      'Move the mouse to aim the launcher at the bottom, click to fire. Shots bounce off the side walls, so you can bank into tight spots.',
      'A fired bubble sticks when it touches the pack. Three or more of one color touching pops the whole cluster.',
      'Popping a cluster can cut other bubbles off from the ceiling. Anything left unconnected drops away for bonus points.',
      'A bubble that makes no match sticks and adds to the wall. Let the pack cross the dashed red line and the game ends.',
      'Clear every bubble to finish the board and go up a level, which adds another color. Your score is the number of boards you clear.'
    ],
    mount
  });
})();
