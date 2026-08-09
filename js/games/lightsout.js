/* Lights Out. Flip the whole grid dark. */
(function () {
  'use strict';
  const { h, randInt } = Engine;
  const N = 5;

  function mount(root, api) {
    const bagg = Engine.bag();
    let grid, level, moves, par, solving;

    const pLevel = api.pill('Level 1');
    const pMoves = api.pill('Moves: 0');
    const pPar = api.pill('Par: 0');
    const board = h('div', { class: 'board lo', style: { gridTemplateColumns: 'repeat(' + N + ', auto)' } });
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    const cells = [];
    for (let i = 0; i < N * N; i++) {
      const el = h('div', { class: 'cell', data: { i } });
      cells.push(el);
      board.appendChild(el);
    }
    root.append(board, banner);

    board.addEventListener('click', (e) => {
      const t = e.target.closest('.cell');
      if (!t || solving) return;
      press(+t.dataset.i, true);
    });

    api.button('Restart level', () => start(level));
    api.button('Back to level 1', () => start(1));

    function start(lv) {
      level = lv;
      moves = 0;
      solving = false;
      grid = new Array(N * N).fill(false);
      par = Math.min(N * N - 2, Math.round((3 + level) * api.dm));
      /* scramble by pressing random cells, which guarantees a solution exists */
      const used = new Set();
      let guard = 0;
      while (used.size < par && guard++ < 400) {
        const i = randInt(0, N * N - 1);
        if (used.has(i)) continue;
        used.add(i);
        press(i, false);
      }
      if (grid.every((v) => !v)) { press(randInt(0, N * N - 1), false); }
      moves = 0;
      banner.style.display = 'none';
      api.status('Click a light to toggle it and its four neighbours. Turn every light off.');
      render();
    }

    function press(i, count) {
      const r = Math.floor(i / N), c = i % N;
      const flip = (rr, cc) => {
        if (rr < 0 || cc < 0 || rr >= N || cc >= N) return;
        grid[rr * N + cc] = !grid[rr * N + cc];
      };
      flip(r, c); flip(r - 1, c); flip(r + 1, c); flip(r, c - 1); flip(r, c + 1);
      if (count) {
        moves++;
        api.sfx.click();
        render();
        if (grid.every((v) => !v)) win();
      }
    }

    function win() {
      solving = true;
      api.sfx.great();
      const res = api.submit(level);
      Engine.autoAdvance(banner, 'Lights out.',
        'Level ' + level + ' cleared in ' + moves + ' moves (par ' + par + ').' +
          (res.isRecord ? ' Deepest run yet!' : ''),
        'Level ' + (level + 1), () => start(level + 1));
    }

    function render() {
      for (let i = 0; i < N * N; i++) cells[i].classList.toggle('on', grid[i]);
      pLevel.textContent = 'Level ' + level;
      pMoves.textContent = 'Moves: ' + moves;
      pPar.textContent = 'Par: ' + par;
      pMoves.className = 'pill ' + (moves > par * 2 ? 'warn' : '');
    }

    start(1);
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'lightsout',
    title: 'Lights Out',
    emoji: 'lightsout',
    cat: 'brain',
    order: 22,
    blurb: 'Click a light and it toggles itself and its four neighbours. Clear the whole grid to dark.',
    scoreLabel: 'Level',
    tags: ['grid', 'toggle', 'logic'],
    how: [
      'Click any light to flip it and its four orthogonal neighbours, a cross of five.',
      'Turn every light off to clear the board.',
      'Flips cancel, so order never matters and pressing the same light twice undoes it. Plan around that.',
      'Every board is made by scrambling a solved one, so a route back to all-dark always exists.',
      'Par is the number of presses used to scramble. Beat it by finding a shorter route than the machine took.'
    ],
    mount
  });
})();
