/* Flood. Swallow the whole board in as few moves as you can. */
(function () {
  'use strict';
  const { h, randInt } = Engine;
  const N = 14;
  const COLORS = ['#e8402a', '#ffcb1f', '#6fcf2f', '#00a6b4', '#6f3fa8', '#ff2d87'];
  const SYMS = ['●', '▲', '■', '◆', '✦', '✚'];   // ● ▲ ■ ◆ ✦ ✚

  function mount(root, api) {
    const bagg = Engine.bag();
    let grid, moves, done;

    const pMoves = api.pill('Moves: 0');
    const pPar = api.pill('Par: 0');
    const board = h('div', { class: 'board flood', style: { gridTemplateColumns: 'repeat(' + N + ', 1fr)' } });
    const cells = [];
    for (let i = 0; i < N * N; i++) { const el = h('div', { class: 'cell' }); cells.push(el); board.appendChild(el); }
    const picker = h('div', { class: 'flood-picker' });
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    const swatches = COLORS.map((col, ci) => {
      const b = h('button', { class: 'flood-swatch', type: 'button', style: { background: col }, 'aria-label': 'colour ' + (ci + 1) });
      b.addEventListener('click', () => play(ci));
      picker.appendChild(b);
      return b;
    });
    root.append(board, picker, banner);
    api.button('New board', reset);

    function par() { return Math.round(25 * (0.82 + (api.dm - 1) * 0.14)); }

    function reset() {
      grid = [];
      for (let i = 0; i < N * N; i++) grid.push(randInt(0, COLORS.length - 1));
      moves = 0; done = false;
      banner.style.display = 'none';
      api.status('Pick a colour. Your corner blob spreads into every touching tile of that colour. Fill the board.');
      render();
    }

    function region() {
      const target = grid[0], seen = new Set([0]), st = [0];
      while (st.length) {
        const i = st.pop(), r = Math.floor(i / N), c = i % N;
        const ns = [r > 0 ? i - N : -1, r < N - 1 ? i + N : -1, c > 0 ? i - 1 : -1, c < N - 1 ? i + 1 : -1];
        for (const n of ns) if (n >= 0 && !seen.has(n) && grid[n] === target) { seen.add(n); st.push(n); }
      }
      return seen;
    }

    function play(ci) {
      if (done || ci === grid[0]) return;
      const reg = region();
      for (const i of reg) grid[i] = ci;
      moves++; api.sfx.click();
      render();
      if (grid.every((v) => v === grid[0])) win();
    }

    function win() {
      done = true;
      api.sfx.great();
      const res = api.submit(moves);
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Whole board.'),
        h('p', null, 'Filled in ' + moves + ' moves (par ' + par() + ').' +
          (res.isRecord ? ' Fewest yet!' : res.isFirst ? '' : ' Best: ' + res.best + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'New board'));
    }

    function render() {
      /* doc mode desaturates everything to grey, so same-luminance colours
         (red vs hot pink, say) become indistinguishable — reuse the existing
         colour-blind symbol fallback instead of trying to out-guess the filter */
      const cs = document.body.classList.contains('colorsafe') || (window.Arcade && Arcade.docMode && Arcade.docMode());
      for (let i = 0; i < N * N; i++) { cells[i].style.background = COLORS[grid[i]]; cells[i].textContent = cs ? SYMS[grid[i]] : ''; }
      swatches.forEach((b, ci) => { b.textContent = cs ? SYMS[ci] : ''; b.classList.remove('cur'); });
      swatches[grid[0]].classList.add('cur');
      pMoves.textContent = 'Moves: ' + moves;
      pPar.textContent = 'Par: ' + par();
      pMoves.className = 'pill ' + (moves > par() ? 'warn' : '');
    }

    reset();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'flood',
    title: 'Flood',
    emoji: 'flood',
    cat: 'puzzle',
    order: 16,
    blurb: 'Flood the whole 14x14 board into one colour from the top-left corner. Do it in as few moves as you can.',
    scoreLabel: 'Fewest moves',
    lowerIsBetter: true,
    tags: ['flood-it', 'colour', 'fill'],
    how: [
      'Your territory is the single tile in the top-left corner.',
      'Pick a colour. Your territory repaints and absorbs every touching tile of that colour.',
      'Spread wide early so later floods have more edge to absorb.',
      'Fill the whole board to win. Your score is the flood count, so fewer is better.',
      'Par is a target move count for the board. Beat it if you can.'
    ],
    mount
  });
})();
