/* Supply Closet. Swap office supplies into rows of three before the buzzer. */
(function () {
  'use strict';
  const { h, randInt } = Engine;

  const SIZE = 8;
  const N = SIZE * SIZE;
  const GLYPH = ['◆', '●', '■', '▲', '★', '✦', '♥'];

  const SWAP_T = 0.14;   /* how long a swap animation shows */
  const CLEAR_T = 0.2;   /* how long clearing gems fade */
  const SETTLE_T = 0.12; /* pause after gravity before next cascade check */

  function mount(root, api) {
    const bagg = Engine.bag();
    const NCOLORS = api.diffId === 'nightmare' ? 7 : 6;
    const DURATION = Math.max(24, Math.round(60 / api.dm));

    const grid = new Array(N).fill(0);
    let selected = -1;
    let score = 0;
    let timeLeft = DURATION;
    let running = false;
    let phase = 'idle';   /* idle | swap | clearing | settle */
    let phaseT = 0;
    let mult = 1;
    let clearMask = null;
    let lastSwap = { a: -1, b: -1 };

    /* ---- toolbar ---- */
    const pTime = api.pill('Time ' + DURATION);
    const pScore = api.pill('Score 0');
    const pMult = api.pill('Chain x1');
    api.button('New round', () => startRound());

    /* ---- board ---- */
    const board = h('div', { class: 'board match3' });
    const cellEls = [];
    for (let i = 0; i < N; i++) {
      const b = h('button', { class: 'cell', type: 'button' });
      cellEls.push(b);
      board.appendChild(b);
      bagg.listen(b, 'click', () => onCell(i));
    }
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.append(board, banner);

    /* ---- pure grid helpers ---- */
    function randColor() { return randInt(0, NCOLORS - 1); }

    function swapCells(g, a, b) { const t = g[a]; g[a] = g[b]; g[b] = t; }

    function findMatches(g) {
      const clear = new Array(N).fill(false);
      for (let r = 0; r < SIZE; r++) {
        let c = 0;
        while (c < SIZE) {
          const v = g[r * SIZE + c];
          let c2 = c + 1;
          while (c2 < SIZE && v !== null && g[r * SIZE + c2] === v) c2++;
          if (v !== null && c2 - c >= 3) for (let k = c; k < c2; k++) clear[r * SIZE + k] = true;
          c = c2;
        }
      }
      for (let c = 0; c < SIZE; c++) {
        let r = 0;
        while (r < SIZE) {
          const v = g[r * SIZE + c];
          let r2 = r + 1;
          while (r2 < SIZE && v !== null && g[r2 * SIZE + c] === v) r2++;
          if (v !== null && r2 - r >= 3) for (let k = r; k < r2; k++) clear[k * SIZE + c] = true;
          r = r2;
        }
      }
      return clear;
    }

    function anyMatch(g) {
      const cl = findMatches(g);
      for (let i = 0; i < N; i++) if (cl[i]) return true;
      return false;
    }

    function collapse(g) {
      for (let c = 0; c < SIZE; c++) {
        const col = [];
        for (let r = SIZE - 1; r >= 0; r--) if (g[r * SIZE + c] !== null) col.push(g[r * SIZE + c]);
        let i = 0;
        for (let r = SIZE - 1; r >= 0; r--, i++) g[r * SIZE + c] = i < col.length ? col[i] : randColor();
      }
    }

    function hasLegalMove(g) {
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const i = r * SIZE + c;
          if (c < SIZE - 1) {
            swapCells(g, i, i + 1);
            const m = anyMatch(g);
            swapCells(g, i, i + 1);
            if (m) return true;
          }
          if (r < SIZE - 1) {
            swapCells(g, i, i + SIZE);
            const m = anyMatch(g);
            swapCells(g, i, i + SIZE);
            if (m) return true;
          }
        }
      }
      return false;
    }

    function newBoard(g) {
      let guard = 0;
      do {
        guard++;
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            let v, tries = 0;
            do {
              v = randColor();
              tries++;
            } while (tries < 40 && (
              (c >= 2 && g[r * SIZE + c - 1] === v && g[r * SIZE + c - 2] === v) ||
              (r >= 2 && g[(r - 1) * SIZE + c] === v && g[(r - 2) * SIZE + c] === v)
            ));
            g[r * SIZE + c] = v;
          }
        }
      } while (guard < 60 && !hasLegalMove(g));
    }

    function adjacent(a, b) {
      const ra = Math.floor(a / SIZE), ca = a % SIZE;
      const rb = Math.floor(b / SIZE), cb = b % SIZE;
      return (ra === rb && Math.abs(ca - cb) === 1) || (ca === cb && Math.abs(ra - rb) === 1);
    }

    /* ---- rendering ---- */
    function render() {
      for (let i = 0; i < N; i++) {
        const v = grid[i];
        const el = cellEls[i];
        el.className = 'cell g' + v + (i === selected ? ' sel' : '');
        el.textContent = GLYPH[v];
      }
    }

    function markClearing() {
      for (let i = 0; i < N; i++) if (clearMask[i]) cellEls[i].classList.add('clearing');
    }

    /* ---- flow ---- */
    function onCell(i) {
      if (!running || phase !== 'idle') return;
      if (selected === -1) {
        selected = i;
        api.sfx.blip(620);
        render();
        return;
      }
      if (i === selected) {
        selected = -1;
        api.sfx.click();
        render();
        return;
      }
      if (adjacent(selected, i)) {
        const a = selected;
        selected = -1;
        attemptSwap(a, i);
        return;
      }
      selected = i;
      api.sfx.blip(620);
      render();
    }

    function attemptSwap(a, b) {
      lastSwap = { a: a, b: b };
      swapCells(grid, a, b);
      render();
      api.sfx.click();
      phase = 'swap';
      phaseT = 0;
    }

    function beginClear() {
      clearMask = findMatches(grid);
      let count = 0;
      for (let i = 0; i < N; i++) if (clearMask[i]) count++;
      let pts = count * 10 + Math.max(0, count - 3) * 15;
      pts = pts * mult;
      score += pts;
      pScore.textContent = 'Score ' + score;
      pMult.textContent = 'Chain x' + mult;
      pMult.className = 'pill ' + (mult >= 3 ? 'good' : mult >= 2 ? 'warn' : '');
      if (mult >= 2) api.sfx.great(); else api.sfx.good();
      render();
      markClearing();
      phase = 'clearing';
      phaseT = 0;
    }

    function finishResolve() {
      phase = 'idle';
      mult = 1;
      pMult.textContent = 'Chain x1';
      pMult.className = 'pill';
      if (!hasLegalMove(grid)) {
        api.status('No moves left. Restocking the supply closet.');
        newBoard(grid);
        render();
      }
    }

    function step(dt) {
      phaseT += dt;
      if (phase === 'swap') {
        if (phaseT < SWAP_T) return;
        if (anyMatch(grid)) {
          mult = 1;
          beginClear();
        } else {
          swapCells(grid, lastSwap.a, lastSwap.b);
          render();
          api.sfx.bad();
          phase = 'idle';
        }
      } else if (phase === 'clearing') {
        if (phaseT < CLEAR_T) return;
        for (let i = 0; i < N; i++) if (clearMask[i]) grid[i] = null;
        collapse(grid);
        render();
        phase = 'settle';
        phaseT = 0;
      } else if (phase === 'settle') {
        if (phaseT < SETTLE_T) return;
        if (anyMatch(grid)) {
          mult++;
          beginClear();
        } else {
          finishResolve();
        }
      }
    }

    function endRound() {
      running = false;
      selected = -1;
      phase = 'idle';
      render();
      api.sfx.boom();
      const res = api.submit(score);
      Engine.autoAdvance(
        banner,
        'Buzzer.',
        'You cleared ' + score + ' points of office supplies.' +
          (res.isRecord ? ' New record.' : res.isFirst ? '' : ' Best: ' + res.best + '.'),
        'Restock',
        () => startRound()
      );
    }

    function startRound() {
      newBoard(grid);
      selected = -1;
      score = 0;
      timeLeft = DURATION;
      running = true;
      phase = 'idle';
      phaseT = 0;
      mult = 1;
      banner.style.display = 'none';
      pScore.textContent = 'Score 0';
      pTime.textContent = 'Time ' + DURATION;
      pTime.className = 'pill';
      pMult.textContent = 'Chain x1';
      pMult.className = 'pill';
      api.status('Tap a supply, then an adjacent one, to swap. Line up three or more of a kind.');
      render();
    }

    /* ---- main loop ---- */
    bagg.add(Engine.loop((dt) => {
      if (!running) return;
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        pTime.textContent = 'Time 0';
        endRound();
        return;
      }
      pTime.textContent = 'Time ' + Math.ceil(timeLeft);
      pTime.className = 'pill ' + (timeLeft <= 10 ? 'bad' : timeLeft <= 20 ? 'warn' : '');
      if (phase !== 'idle') step(dt);
    }));

    startRound();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'match3',
    title: 'Supply Closet',
    emoji: 'match3',
    cat: 'puzzle',
    order: 12,
    blurb: 'Swap office supplies to line up three or more of a kind and clear the shelves before the buzzer runs out.',
    scoreLabel: 'Points',
    tags: ['match-3', 'bejeweled', 'gems', 'timed'],
    how: [
      'Clear as many supplies as you can before time runs out. A normal round is 60 seconds.',
      'Click or tap a supply, then an adjacent one, to swap them.',
      'A swap only holds if it makes a line of three or more; otherwise it snaps back.',
      'Cleared supplies fall and fresh stock drops in from the top. Chain reactions raise a multiplier.',
      'Longer lines and deeper chains score more. Run out of legal moves and the closet restocks itself.',
      'Harder tiers shorten the clock; nightmare adds a seventh kind of supply.'
    ],
    mount
  });
})();
