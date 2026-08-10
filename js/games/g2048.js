/* Budget Rollup. Slide, merge, regret. */
(function () {
  'use strict';
  const { h, randInt } = Engine;
  const N = 4;

  function mount(root, api) {
    const bagg = Engine.bag();
    let grid, score, over, wonAt2048, prev;

    const pScore = api.pill('Score: 0');
    const board = h('div', { class: 'board g2048', style: { gridTemplateColumns: 'repeat(4, auto)' } });
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    const cells = [];
    for (let i = 0; i < N * N; i++) {
      const c = h('div', { class: 'cell', data: { v: '0' } });
      cells.push(c);
      board.appendChild(c);
    }
    root.append(board, banner);
    Engine.dpad(root, (d) => { if (d !== 'action') move(d); }, { class: 'touch-only' });

    const undoBtn = api.button('Undo', () => {
      if (!prev) return;
      grid = prev.grid.map((r) => r.slice());
      score = prev.score;
      prev = null;
      over = false;
      banner.style.display = 'none';
      render();
      undoBtn.disabled = true;
    });
    api.button('New sheet', reset);

    function reset() {
      grid = Array.from({ length: N }, () => Array(N).fill(0));
      score = 0; over = false; wonAt2048 = false; prev = null;
      undoBtn.disabled = true;
      addTile(); addTile();
      banner.style.display = 'none';
      api.status('Arrow keys, WASD, or swipe. Same numbers merge.');
      render();
    }

    function addTile() {
      const empty = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) empty.push([r, c]);
      if (!empty.length) return false;
      const [r, c] = empty[randInt(0, empty.length - 1)];
      grid[r][c] = Math.random() < (0.9 - (api.dm - 1) * 0.18) ? 2 : 4;
      return true;
    }

    /* slide one row left, returning [newRow, gained] */
    function slide(row) {
      const vals = row.filter((v) => v);
      const out = [];
      let gained = 0;
      for (let i = 0; i < vals.length; i++) {
        if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
          out.push(vals[i] * 2);
          gained += vals[i] * 2;
          i++;
        } else out.push(vals[i]);
      }
      while (out.length < N) out.push(0);
      return [out, gained];
    }

    const rot = (g) => g[0].map((_, c) => g.map((row) => row[c]).reverse());   // 90° clockwise

    function move(dir) {
      if (over) return;
      const before = JSON.stringify(grid);
      const snapshot = { grid: grid.map((r) => r.slice()), score };

      /* rot() turns the board clockwise, so bringing a given edge to the left
         takes the CW count below — up needs 3 (=one CCW), down needs 1. Getting
         these backwards silently inverts the vertical controls. */
      const turns = { left: 0, up: 3, right: 2, down: 1 }[dir];
      let g = grid;
      for (let i = 0; i < turns; i++) g = rot(g);
      let gained = 0;
      g = g.map((row) => { const [nr, gn] = slide(row); gained += gn; return nr; });
      for (let i = turns; i < 4; i++) g = rot(g);
      grid = g;

      if (JSON.stringify(grid) === before) return;
      score += gained;
      prev = snapshot;
      undoBtn.disabled = false;
      addTile();
      if (gained) api.sfx.blip(300 + Math.min(900, gained * 4));
      else api.sfx.click();

      if (!wonAt2048 && grid.some((r) => r.some((v) => v >= 2048))) {
        wonAt2048 = true;
        api.sfx.great();
        api.status('New high total! Keep going for a bigger one.');
      }
      render();
      if (!canMove()) end();
    }

    function canMove() {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (!grid[r][c]) return true;
        if (c + 1 < N && grid[r][c] === grid[r][c + 1]) return true;
        if (r + 1 < N && grid[r][c] === grid[r + 1][c]) return true;
      }
      return false;
    }

    function end() {
      over = true;
      const res = api.submit(score);
      api.sfx.bad();
      let best = 0;
      for (const row of grid) for (const v of row) best = Math.max(best, v);
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Board is full.'),
        h('p', null, score.toLocaleString() + ' points, biggest tile ' + best + '.' +
          (res.isRecord ? ' New personal best!' : res.isFirst ? '' : ' Best: ' + res.best.toLocaleString() + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'New sheet'));
    }

    function render() {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const v = grid[r][c];
        const el = cells[r * N + c];
        const s = String(v);
        if (el.dataset.v !== s) {
          el.dataset.v = s;
          el.classList.toggle('big', v > 2048);
          el.classList.remove('pop');
          void el.offsetWidth;
          if (v) el.classList.add('pop');
        }
        el.textContent = v || '';
      }
      pScore.textContent = 'Score: ' + score.toLocaleString();
    }

    bagg.add(Engine.onKey((e) => {
      const m = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
        a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down'
      }[e.key];
      if (!m) return;
      move(m);
      return true;
    }));
    bagg.add(Engine.swipe(board, (d) => move(d)));

    reset();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: '2048',
    title: 'Budget Rollup',
    emoji: '2048',
    cat: 'puzzle',
    order: 11,
    lightBoard: true,   // has its own document greyscale palette; skip the luminance flip that turned tiles black

    blurb: 'Slide the whole board one way and equal line items merge into their sum. Keep rolling up from 2, 4, 8 toward the highest total before the sheet fills. Includes one undo.',
    scoreLabel: 'Score',
    tags: ['tiles', 'merge', 'numbers'],
    how: [
      'Arrow keys, WASD, or swipe move every tile at once.',
      'Two tiles of the same number merge into one worth their sum.',
      'A new tile drops in after any move that changed the board.',
      'Undo reverts one move. It resets after you use it.',
      'Harder settings deal more 4-tiles, which fill the board faster.'
    ],
    mount
  });
})();
