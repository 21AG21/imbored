/* Workbook — Minesweeper wearing a spreadsheet's clothes.
 *
 * Same logic as the classic (first click is always safe, zeros flood open,
 * chord a satisfied number to sweep its neighbours). The board is drawn as a
 * real-looking grid: lettered columns, numbered rows, a formula bar, sheet
 * tabs. Revealed counts read as tidy right-aligned figures; the mines you hit
 * turn into #REF! errors, which is exactly what a spreadsheet full of mines
 * ought to look like. Glance-proof camouflage for a boring afternoon.
 */
(function () {
  'use strict';
  const { h, randInt, clamp } = Engine;

  const LEVELS = {
    small: { w: 10, h: 12, m: 16, label: 'Expenses (10×12)' },
    medium: { w: 14, h: 16, m: 34, label: 'Headcount (14×16)' },
    large: { w: 18, h: 20, m: 64, label: 'Forecast (18×20)' }
  };

  /* spreadsheet column names: 0->A, 25->Z, 26->AA ... */
  function colName(n) {
    let s = '';
    n += 1;
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }

  function mount(root, api) {
    const bagg = Engine.bag();
    let diff = api.load('diff', 'small');
    let W, Hh, M, grid, opened, flags, dead, won, laid, started, t0, timerId;

    const pMines = api.pill('Flags: 0/0');
    const pTime = api.pill('⏱ 0');
    const pBest = api.pill('');

    /* fake application chrome — sells the disguise at a glance */
    const nameBox = h('span', { class: 'wb-name' }, 'A1');
    const formulaIn = h('span', { class: 'wb-formula-in' }, '');
    const bar = h('div', { class: 'wb-bar' },
      nameBox,
      h('span', { class: 'wb-fx' }, 'fx'),
      formulaIn);
    const scroll = h('div', { class: 'wb-scroll' });
    const tabs = h('div', { class: 'wb-tabs' },
      h('span', { class: 'wb-tab active' }, 'Sheet1'),
      h('span', { class: 'wb-tab' }, 'Q3 Actuals'),
      h('span', { class: 'wb-tab' }, 'Pivot'),
      h('span', { class: 'wb-tab wb-add' }, '+'));
    const board = h('div', { class: 'wb' }, bar, scroll, tabs);
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.append(board, banner);

    api.select('Sheet', Object.keys(LEVELS).map((k) => ({ value: k, label: LEVELS[k].label })), diff, (v) => {
      diff = v; api.save('diff', v); reset();
    });
    api.button('New sheet', () => reset());

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
      /* harder difficulty packs in more mines, capped short of unsolvable */
      M = clamp(Math.round(L.m * (1 + (api.dm - 1) * 0.4)), 1, Math.floor(W * Hh * 0.28));
      grid = new Array(W * Hh).fill(0).map(() => ({ mine: false, open: false, flag: false, n: 0, boom: false }));
      opened = 0; flags = 0; dead = false; won = false; laid = false; started = false;
      clearInterval(timerId); timerId = 0;
      banner.style.display = 'none';
      nameBox.textContent = 'A1';
      formulaIn.textContent = '';
      build();
      syncPills();
      api.status('Left-click a cell to fill it in. Each number counts the mines touching that cell. Right-click (or long-press) flags a suspected mine. Click a completed figure to auto-fill its neighbours. It is just Minesweeper, but it looks like you are working.');
    }

    function layMines(sx, sy) {
      const safe = new Set([idx(sx, sy)]);
      for (const [x, y] of nbrs(sx, sy)) safe.add(idx(x, y));
      let placed = 0;
      while (placed < M) {
        const i = randInt(0, W * Hh - 1);
        if (grid[i].mine || safe.has(i)) continue;
        grid[i].mine = true; placed++;
      }
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        let n = 0;
        for (const [nx, ny] of nbrs(x, y)) if (grid[idx(nx, ny)].mine) n++;
        grid[idx(x, y)].n = n;
      }
      laid = true;
    }

    let cellEls;
    function build() {
      const tbl = h('table', { class: 'wb-grid' });
      const thead = h('thead');
      const hr = h('tr');
      hr.appendChild(h('th', { class: 'wb-corner' }, ''));
      for (let x = 0; x < W; x++) hr.appendChild(h('th', { class: 'wb-colhead' }, colName(x)));
      thead.appendChild(hr);
      tbl.appendChild(thead);

      const tbody = h('tbody');
      cellEls = [];
      for (let y = 0; y < Hh; y++) {
        const tr = h('tr');
        tr.appendChild(h('th', { class: 'wb-rowhead' }, String(y + 1)));
        for (let x = 0; x < W; x++) {
          const td = h('td', { class: 'wb-cell', data: { x, y } });
          cellEls.push(td);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      tbl.appendChild(tbody);
      tbl.addEventListener('contextmenu', (e) => e.preventDefault());
      tbl.addEventListener('pointerdown', (e) => {
        const t = e.target.closest('.wb-cell');
        if (!t) return;
        const x = +t.dataset.x, y = +t.dataset.y;
        nameBox.textContent = colName(x) + (y + 1);
        if (e.pointerType === 'touch') return;   // touch is handled below so a tap can dig while a long-press flags
        if (dead || won) return;
        if (e.button === 2) flagAt(x, y);
        else if (e.button === 0) dig(x, y);
        render();
      });
      /* touch: a short tap digs, a long press (420ms) plants a flag */
      let holdT = 0, holdCell = null, flagged = false;
      tbl.addEventListener('touchstart', (e) => {
        const t = e.target.closest('.wb-cell');
        if (!t || dead || won) { holdCell = null; return; }
        holdCell = { x: +t.dataset.x, y: +t.dataset.y };
        flagged = false;
        holdT = setTimeout(() => {
          if (holdCell) { flagAt(holdCell.x, holdCell.y); render(); flagged = true; }
          holdT = 0;
        }, 420);
      }, { passive: true });
      tbl.addEventListener('touchend', (e) => {
        if (holdT) { clearTimeout(holdT); holdT = 0; }
        if (holdCell && !flagged && !dead && !won) { e.preventDefault(); dig(holdCell.x, holdCell.y); render(); }
        holdCell = null;
      });
      tbl.addEventListener('touchmove', () => { if (holdT) { clearTimeout(holdT); holdT = 0; } holdCell = null; }, { passive: true });
      scroll.replaceChildren(tbl);
      render();
    }

    function startTimer() {
      if (started) return;
      started = true; t0 = Date.now();
      timerId = setInterval(() => { pTime.textContent = '⏱ ' + elapsed(); }, 250);
      bagg.add(() => clearInterval(timerId));
    }
    const elapsed = () => Math.floor((Date.now() - t0) / 1000);

    function flagAt(x, y) {
      const c = grid[idx(x, y)];
      if (c.open) { chord(x, y); return; }
      c.flag = !c.flag;
      flags += c.flag ? 1 : -1;
      api.sfx.click();
      syncPills();
    }

    function chord(x, y) {
      if (dead || won) return;
      const c = grid[idx(x, y)];
      if (!c.open || !c.n) return;
      let f = 0;
      for (const [nx, ny] of nbrs(x, y)) if (grid[idx(nx, ny)].flag) f++;
      if (f !== c.n) return;
      for (const [nx, ny] of nbrs(x, y)) {
        if (dead || won) break;   // a mine among the neighbours may have just ended the game
        const nc = grid[idx(nx, ny)];
        if (!nc.flag && !nc.open) dig(nx, ny);
      }
    }

    function dig(x, y) {
      if (dead || won) return;
      const c = grid[idx(x, y)];
      if (c.flag) return;
      if (c.open) { chord(x, y); return; }
      if (!laid) layMines(x, y);
      startTimer();
      if (c.mine) return boom(x, y);
      const stack = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop();
        const cc = grid[idx(cx, cy)];
        if (cc.open || cc.flag) continue;
        cc.open = true; opened++;
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
        h('h3', null, '#REF!'),
        h('p', null, 'That cell was a mine. ' + Math.max(0, M - flags) + ' still unflagged. The formula chain broke.'),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'New sheet'));
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
        h('h3', null, 'Balanced.'),
        h('p', null, LEVELS[diff].label.split(' (')[0] + ' reconciled in ' + secs + 's' +
          (record ? ' — fastest yet!' : ' (best ' + prev + 's)') + '. Sheets closed: ' + wins + '.'),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Next sheet'));
    }

    function render() {
      for (let i = 0; i < grid.length; i++) {
        const c = grid[i], el = cellEls[i];
        el.className = 'wb-cell';
        if (c.boom) { el.classList.add('boom'); el.textContent = '#ERR!'; continue; }
        if (c.open && c.mine) { el.classList.add('mine'); el.textContent = '#REF!'; continue; }
        if (c.open) {
          el.classList.add('open');
          if (c.n === 0) { el.textContent = ''; el.classList.add('zero'); }
          else { el.textContent = String(c.n); el.classList.add('n' + c.n); }
          continue;
        }
        if (c.flag) { el.classList.add('flag'); el.textContent = ''; continue; }
        el.textContent = '';
      }
      /* keep the formula bar plausibly busy */
      const ref = nameBox.textContent;
      const sel = selFromRef(ref);
      if (sel && grid[sel] && grid[sel].open && grid[sel].n > 0) {
        formulaIn.textContent = '=COUNTIF(' + neighbourRange(ref) + ',"<>0")';
      } else if (sel && grid[sel] && grid[sel].flag) {
        formulaIn.textContent = '=FLAG("review")';
      } else {
        formulaIn.textContent = '';
      }
    }

    function selFromRef(ref) {
      const m = /^([A-Z]+)(\d+)$/.exec(ref || '');
      if (!m) return null;
      let col = 0;
      for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
      col -= 1;
      const row = +m[2] - 1;
      if (!inB(col, row)) return null;
      return idx(col, row);
    }
    function neighbourRange(ref) {
      const m = /^([A-Z]+)(\d+)$/.exec(ref || '');
      if (!m) return 'A1:A1';
      const row = +m[2];
      const c0 = m[1], r0 = Math.max(1, row - 1), r1 = row + 1;
      return c0 + r0 + ':' + c0 + r1;
    }

    function syncPills() {
      pMines.textContent = 'Flags: ' + flags + '/' + M;
      pMines.className = 'pill ' + (flags > M ? 'warn' : '');
      pTime.textContent = '⏱ ' + (started ? elapsed() : 0);
      const b = api.load('time:' + diff, null);
      pBest.textContent = b == null ? 'no time yet' : 'best ' + b + 's';
    }

    reset();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'workbook',
    lightBoard: true,   // light spreadsheet cell grid would invert to a solid black block under the figure flip
    title: 'Workbook',
    emoji: 'sheet',
    cat: 'puzzle',
    order: 17,
    blurb: 'Minesweeper dressed as a spreadsheet. Lettered columns and a formula bar read like data entry from across the room.',
    scoreLabel: 'Sheets closed',
    tags: ['minesweeper', 'spreadsheet', 'camouflage', 'logic'],
    how: [
      'Under the disguise it is Minesweeper. Each cell hides either a mine or a count of the mines around it.',
      'Left-click a cell to open it. Your first click is always safe and often opens a whole block.',
      'A number counts the mines in the eight cells around it. Use the numbers to deduce which neighbours are safe.',
      'Right-click, or long-press on touch, to flag a suspected mine. It fills amber like a highlighted cell.',
      'Click a number that already has enough flags around it to open its other neighbours at once.',
      'Hit a mine and it turns into a #REF! error. Open every safe cell to win.',
      'From a distance it looks like data entry. The panic key still works if you need it.'
    ],
    mount
  });
})();
