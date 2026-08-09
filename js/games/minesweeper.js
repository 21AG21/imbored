/* Minesweeper. The original meeting game. */
(function () {
  'use strict';
  const { h, randInt } = Engine;

  const LEVELS = {
    easy: { w: 9, h: 9, m: 10, label: 'Coffee break (9×9, 10)' },
    medium: { w: 16, h: 16, m: 40, label: 'Standup (16×16, 40)' },
    hard: { w: 22, h: 14, m: 75, label: 'All-hands (22×14, 75)' }
  };

  function mount(root, api) {
    const bagg = Engine.bag();
    let diff = api.load('diff', 'easy');
    let W, Hh, M, grid, opened, flags, started, dead, won, t0, timerId, firstDone;

    const pMines = api.pill('Mines: 0');
    const pTime = api.pill('⏱ 0');
    const pBest = api.pill('');
    const boardWrap = h('div', { class: 'ms' });
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.append(boardWrap, banner);

    api.select('Board', Object.keys(LEVELS).map((k) => ({ value: k, label: LEVELS[k].label })), diff, (v) => {
      diff = v; api.save('diff', v); reset();
    });
    api.button('New board', () => reset());

    const idx = (x, y) => y * W + x;
    const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < Hh;
    function* nbrs(x, y) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (inB(x + dx, y + dy)) yield [x + dx, y + dy];
      }
    }

    function reset() {
      const L = LEVELS[diff];
      W = L.w; Hh = L.h;
      /* past roughly a quarter of the board, boards stop being solvable by logic */
      M = Engine.clamp(Math.round(L.m * (1 + (api.dm - 1) * 0.42)), 1, Math.floor(W * Hh * 0.26));
      grid = new Array(W * Hh).fill(0).map(() => ({ mine: false, open: false, flag: false, n: 0 }));
      opened = 0; flags = 0; started = false; dead = false; won = false; firstDone = false;
      clearInterval(timerId);
      timerId = 0;
      banner.style.display = 'none';
      buildBoard();
      syncPills();
      api.status('Left click to dig. Right click to flag. Right click a number with enough flags around it to sweep its neighbours.');
    }

    function layMines(sx, sy) {
      const safe = new Set([idx(sx, sy)]);
      for (const [x, y] of nbrs(sx, sy)) safe.add(idx(x, y));
      let placed = 0;
      while (placed < M) {
        const i = randInt(0, W * Hh - 1);
        if (grid[i].mine || safe.has(i)) continue;
        grid[i].mine = true;
        placed++;
      }
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        let n = 0;
        for (const [nx, ny] of nbrs(x, y)) if (grid[idx(nx, ny)].mine) n++;
        grid[idx(x, y)].n = n;
      }
      firstDone = true;
    }

    let cellEls;
    function buildBoard() {
      boardWrap.replaceChildren();
      const b = h('div', { class: 'board', style: { gridTemplateColumns: 'repeat(' + W + ', 30px)' } });
      cellEls = [];
      for (let y = 0; y < Hh; y++) {
        for (let x = 0; x < W; x++) {
          const el = h('div', { class: 'cell', data: { x, y } });
          cellEls.push(el);
          b.appendChild(el);
        }
      }
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      /* Mouse only — touch is handled by touchstart/touchend below so a tap
         can dig while a long-press flags. Without this guard the synthesized
         touch pointerdown digs instantly and the long-press never gets a turn. */
      b.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        const t = e.target.closest('.cell');
        if (!t || dead || won) return;
        const x = +t.dataset.x, y = +t.dataset.y;
        if (e.button === 2) { toggleFlag(x, y); }
        else if (e.button === 0) { dig(x, y); }
        render();
      });
      /* touch: a short tap digs, a long press (420ms) plants a flag */
      let holdT = 0, holdCell = null, flagged = false;
      b.addEventListener('touchstart', (e) => {
        const t = e.target.closest('.cell');
        if (!t || dead || won) { holdCell = null; return; }
        holdCell = { x: +t.dataset.x, y: +t.dataset.y };
        flagged = false;
        holdT = setTimeout(() => {
          if (holdCell) { toggleFlag(holdCell.x, holdCell.y); render(); flagged = true; }
          holdT = 0;
        }, 420);
      }, { passive: true });
      b.addEventListener('touchend', (e) => {
        if (holdT) { clearTimeout(holdT); holdT = 0; }
        if (holdCell && !flagged && !dead && !won) { e.preventDefault(); dig(holdCell.x, holdCell.y); render(); }
        holdCell = null;
      });
      b.addEventListener('touchmove', () => { if (holdT) { clearTimeout(holdT); holdT = 0; } holdCell = null; }, { passive: true });
      boardWrap.appendChild(b);
      render();
    }

    function startTimer() {
      if (started) return;
      started = true;
      t0 = Date.now();
      timerId = setInterval(() => { pTime.textContent = '⏱ ' + elapsed(); }, 250);
      bagg.add(() => clearInterval(timerId));
    }
    const elapsed = () => Math.floor((Date.now() - t0) / 1000);

    function toggleFlag(x, y) {
      const c = grid[idx(x, y)];
      if (c.open) { chord(x, y); return; }
      c.flag = !c.flag;
      flags += c.flag ? 1 : -1;
      api.sfx.click();
      syncPills();
    }

    function chord(x, y) {
      const c = grid[idx(x, y)];
      if (!c.open || !c.n) return;
      let f = 0;
      for (const [nx, ny] of nbrs(x, y)) if (grid[idx(nx, ny)].flag) f++;
      if (f !== c.n) return;
      for (const [nx, ny] of nbrs(x, y)) {
        const nc = grid[idx(nx, ny)];
        if (!nc.flag && !nc.open) dig(nx, ny);
      }
    }

    function dig(x, y) {
      const c = grid[idx(x, y)];
      if (c.flag) return;
      if (c.open) { chord(x, y); return; }
      if (!firstDone) layMines(x, y);
      startTimer();
      if (c.mine) return boom(x, y);

      const stack = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop();
        const cc = grid[idx(cx, cy)];
        if (cc.open || cc.flag) continue;
        cc.open = true;
        opened++;
        if (cc.n === 0) for (const [nx, ny] of nbrs(cx, cy)) stack.push([nx, ny]);
      }
      api.sfx.blip(520);
      if (opened === W * Hh - M) win();
    }

    function boom(x, y) {
      dead = true;
      grid[idx(x, y)].boom = true;
      for (const c of grid) if (c.mine) c.open = true;
      clearInterval(timerId);
      api.sfx.boom();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Boom.'),
        h('p', null, 'That one was a mine. ' + (M - flags) + ' left unfound.'),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'New board'));
    }

    function win() {
      won = true;
      clearInterval(timerId);
      const secs = elapsed();
      const bestKey = 'time:' + diff;
      const prev = api.load(bestKey, null);
      const record = prev == null || secs < prev;
      if (record) api.save(bestKey, secs);
      const wins = api.load('wins', 0) + 1;
      api.save('wins', wins);
      api.submit(wins);
      api.sfx.great();
      for (const c of grid) if (c.mine) c.flag = true;
      flags = M;
      syncPills();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Swept.'),
        h('p', null, LEVELS[diff].label.split(' (')[0] + ' cleared in ' + secs + 's' +
          (record ? ' Fastest yet!' : ' (best ' + prev + 's)') + '. Total wins: ' + wins + '.'),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Again'));
    }

    function syncPills() {
      pMines.textContent = 'Mines: ' + (M - flags);
      pTime.textContent = '⏱ ' + (started ? elapsed() : 0);
      const b = api.load('time:' + diff, null);
      pBest.textContent = b == null ? 'no time yet' : 'best ' + b + 's';
    }

    function render() {
      for (let i = 0; i < grid.length; i++) {
        const c = grid[i], el = cellEls[i];
        let cls = 'cell';
        let txt = '';
        if (c.open) {
          cls += ' open';
          if (c.mine) { cls += ' mine'; txt = c.boom ? 'ICON:boom' : 'ICON:mine'; }
          else if (c.n) { cls += ' n' + c.n; txt = c.n; }
        } else if (c.flag) { cls += ' flag'; txt = 'ICON:flag'; }
        if (el.className !== cls) el.className = cls;
        const want = String(txt);
        if (el.dataset.shown === want) continue;
        el.dataset.shown = want;
        if (want.slice(0, 5) === 'ICON:') el.innerHTML = Icons.svg(want.slice(5), 19);
        else el.textContent = want;
      }
      syncPills();
    }

    reset();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'minesweeper',
    title: 'Minesweeper',
    emoji: 'minesweeper',
    cat: 'puzzle',
    order: 10,
    blurb: 'Minesweeper with three board sizes, a first click that is always safe, and chording. Good cover for looking deep in thought.',
    scoreLabel: 'Wins',
    tags: ['mines', 'classic', 'logic'],
    how: [
      'Left click digs. Your first dig is never a mine.',
      'Right click plants a flag. On a touchscreen, press and hold.',
      'Click a number that already has its full count of flags around it to sweep the rest. This is most of the game once it clicks.',
      'Clear every square that is not a mine. Your fastest time per size is saved.',
      'Harder settings add more mines to the same board.'
    ],
    mount
  });
})();
