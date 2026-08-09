/* Fifteen. Slide the tiles back into order. */
(function () {
  'use strict';
  const { h, randInt } = Engine;
  const N = 4;

  function mount(root, api) {
    const bagg = Engine.bag();
    let tiles, moves, solved;

    const pMoves = api.pill('Moves: 0');
    const board = h('div', { class: 'board f15', style: { gridTemplateColumns: 'repeat(4, auto)' } });
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    const cells = [];
    for (let i = 0; i < N * N; i++) {
      const el = h('button', { class: 'cell', type: 'button' });
      const idx = i;
      el.addEventListener('click', () => clickTile(idx));
      cells.push(el);
      board.appendChild(el);
    }
    root.append(board, banner);
    api.button('New scramble', scramble);

    function neighbors(i) {
      const r = Math.floor(i / N), c = i % N, out = [];
      if (r > 0) out.push(i - N);
      if (r < N - 1) out.push(i + N);
      if (c > 0) out.push(i - 1);
      if (c < N - 1) out.push(i + 1);
      return out;
    }

    function scramble() {
      tiles = [];
      for (let i = 1; i < N * N; i++) tiles.push(i);
      tiles.push(0);
      /* shuffle by legal slides only, so it is always solvable */
      let blank = N * N - 1, last = -1;
      const total = 90 + Math.round(api.dm * 40);
      for (let k = 0; k < total; k++) {
        const ns = neighbors(blank).filter((n) => n !== last);
        const to = ns[randInt(0, ns.length - 1)];
        tiles[blank] = tiles[to]; tiles[to] = 0;
        last = blank; blank = to;
      }
      if (isSolved()) return scramble();
      moves = 0; solved = false;
      banner.style.display = 'none';
      api.status('Click a tile beside the gap, or use the arrow keys. Line them up 1 to 15.');
      render();
    }

    function blankPos() { return tiles.indexOf(0); }

    function clickTile(i) {
      if (solved) return;
      const b = blankPos();
      if (neighbors(i).indexOf(b) < 0) return;
      tiles[b] = tiles[i]; tiles[i] = 0;
      moves++; api.sfx.click();
      after();
    }

    /* arrow keys slide the neighbouring tile into the gap */
    function slide(d) {
      if (solved) return;
      const b = blankPos(), r = Math.floor(b / N), c = b % N;
      let from = -1;
      if (d === 'up' && r < N - 1) from = b + N;
      if (d === 'down' && r > 0) from = b - N;
      if (d === 'left' && c < N - 1) from = b + 1;
      if (d === 'right' && c > 0) from = b - 1;
      if (from < 0) return;
      tiles[b] = tiles[from]; tiles[from] = 0;
      moves++; api.sfx.click();
      after();
    }

    function after() { render(); if (isSolved()) win(); }

    function isSolved() {
      for (let i = 0; i < N * N - 1; i++) if (tiles[i] !== i + 1) return false;
      return true;
    }

    function win() {
      solved = true;
      api.sfx.great();
      const res = api.submit(moves);
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Solved.'),
        h('p', null, 'Ordered in ' + moves + ' moves.' +
          (res.isRecord ? ' Fewest yet!' : res.isFirst ? '' : ' Best: ' + res.best + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: scramble }, 'Scramble again'));
    }

    function render() {
      for (let i = 0; i < N * N; i++) {
        const v = tiles[i], el = cells[i];
        el.textContent = v || '';
        el.classList.toggle('blank', v === 0);
        el.classList.toggle('home', v !== 0 && v === i + 1);
      }
      pMoves.textContent = 'Moves: ' + moves;
    }

    bagg.add(Engine.onKey((e) => {
      const m = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }[e.key];
      if (!m) return;
      slide(m);
      return true;
    }));
    Engine.dpad(root, (d) => { if (d !== 'action') slide(d); }, { class: 'touch-only' });

    scramble();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'fifteen',
    title: 'Fifteen',
    emoji: 'fifteen',
    cat: 'puzzle',
    order: 14,
    blurb: 'The 15-tile sliding puzzle. Slide tiles into the gap until they read 1 to 15, and your score is how few moves that takes.',
    scoreLabel: 'Fewest moves',
    lowerIsBetter: true,
    tags: ['sliding', 'tiles', '15-puzzle'],
    how: [
      'Click a tile next to the gap and it slides in.',
      'Arrow keys, WASD, or a swipe also slide tiles, on desktop or phone.',
      'Order the tiles 1 to 15 with the gap bottom-right. A tile turns green when it is home.',
      'Each scramble comes from shuffling a solved board, so it always has a solution.',
      'Your score is the fewest moves you have used to solve it. Harder settings scramble further from solved.'
    ],
    mount
  });
})();
