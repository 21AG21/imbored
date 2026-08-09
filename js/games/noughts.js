/* Noughts. Beat the machine before it learns not to lose. */
(function () {
  'use strict';
  const { h, randInt } = Engine;
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const BLUNDER = { chill: 0.65, normal: 0.4, hard: 0.15, nightmare: 0 };

  function mount(root, api) {
    const bagg = Engine.bag();
    let b, turn, done, streak, mode = '1p';
    const tally = { X: 0, O: 0 };
    streak = api.load('streak', 0);

    const pStreak = api.pill('Streak: ' + streak);
    const board = h('div', { class: 'board ttt', style: { gridTemplateColumns: 'repeat(3, auto)' } });
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    const cells = [];
    for (let i = 0; i < 9; i++) {
      const el = h('button', { class: 'cell', type: 'button' });
      const idx = i;
      el.addEventListener('click', () => place(idx));
      cells.push(el);
      board.appendChild(el);
    }
    root.append(board, banner);
    api.button('New game', reset);
    api.button('Reset streak', () => { streak = 0; api.save('streak', 0); sync(); });
    api.select('Players', [
      { value: '1p', label: '1 player (vs CPU)' },
      { value: '2p', label: '2 players (hotseat)' }
    ], '1p', (v) => { mode = v; tally.X = 0; tally.O = 0; reset(); });

    /* play-by-paste correspondence */
    const flatBoard = () => b.map((v) => v === 'X' ? 1 : v === 'O' ? 2 : 0);
    function loadPosition(res) {
      for (let i = 0; i < 9; i++) b[i] = res.cells[i] === 1 ? 'X' : res.cells[i] === 2 ? 'O' : '';
      mode = '2p'; turn = res.extra ? 'O' : 'X'; done = false;
      banner.style.display = 'none';
      const w = winLine(b);
      if (w || full(b)) { finish(w ? b[w[0]] : ''); return; }
      api.status('Loaded. You are ' + turn + ' — make your move, then Share the new code.');
      render();
    }
    const codeInput = h('input', { type: 'text', class: 'boss-url', placeholder: 'move code', spellcheck: 'false', style: { width: '150px' } });
    api.toolbar.appendChild(codeInput);
    api.button('Share code', () => {
      mode = '2p';
      codeInput.value = Engine.packCode('N3', flatBoard(), turn === 'X' ? 0 : 1);
      codeInput.select();
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(codeInput.value).catch(function () { }); } catch (e) { /* ignore */ }
      api.status('Move code ready — send it over. Your opponent pastes it and presses Load.');
    });
    api.button('Load code', () => {
      const res = Engine.unpackCode('N3', codeInput.value, 9);
      if (!res) { api.status('That code did not scan — paste the whole thing.'); return; }
      loadPosition(res);
    });

    function reset() {
      b = ['', '', '', '', '', '', '', '', ''];
      turn = 'X'; done = false;
      banner.style.display = 'none';
      api.status(mode === '2p'
        ? 'Hotseat: Player 1 is X, Player 2 is O. Player 1 to move.'
        : 'You are X. Three in a row wins. Your win streak is the score.');
      render();
    }

    function place(i) {
      if (done || b[i]) return;
      if (mode === '2p') {
        const who = turn;
        b[i] = who;
        if (who === 'X') api.sfx.click(); else api.sfx.blip(300);
        render();
        const w = winLine(b);
        if (w || full(b)) return finish(w ? who : '');
        turn = who === 'X' ? 'O' : 'X';
        api.status((turn === 'X' ? 'Player 1' : 'Player 2') + ' to move (' + turn + ').');
        return;
      }
      if (turn !== 'X') return;
      b[i] = 'X'; api.sfx.click();
      render();
      const w = winLine(b);
      if (w || full(b)) return finish(w ? 'X' : '');
      turn = 'O';
      const mv = aiMove();
      if (mv >= 0) { b[mv] = 'O'; api.sfx.blip(300); }
      render();
      const w2 = winLine(b);
      if (w2 || full(b)) return finish(w2 ? 'O' : '');
      turn = 'X';
    }

    function aiMove() {
      const empty = [];
      for (let i = 0; i < 9; i++) if (!b[i]) empty.push(i);
      if (!empty.length) return -1;
      const bl = BLUNDER[api.diffId];
      if (Math.random() < (bl === undefined ? 0.3 : bl)) return empty[randInt(0, empty.length - 1)];
      return best('O').index;
    }

    /* minimax; O maximises, X minimises */
    function best(player) {
      const w = winner(b);
      if (w === 'O') return { score: 10 };
      if (w === 'X') return { score: -10 };
      if (full(b)) return { score: 0 };
      let choice = null;
      for (let i = 0; i < 9; i++) {
        if (b[i]) continue;
        b[i] = player;
        const s = best(player === 'O' ? 'X' : 'O').score;
        b[i] = '';
        if (!choice ||
          (player === 'O' && s > choice.score) ||
          (player === 'X' && s < choice.score)) choice = { index: i, score: s };
      }
      return choice;
    }

    function finish(w) {
      done = true;
      let title, msg;
      if (mode === '2p') {
        if (w) { tally[w]++; api.sfx.great(); title = (w === 'X' ? 'Player 1 (X)' : 'Player 2 (O)') + ' wins.'; }
        else { api.sfx.blip(420); title = 'Draw.'; }
        msg = 'Series so far: Player 1 ' + tally.X + ' – ' + tally.O + ' Player 2.';
        sync();
        const line2 = winLine(b);
        if (line2) for (const i of line2) cells[i].classList.add('win');
        banner.style.display = '';
        banner.replaceChildren(
          h('h3', null, title),
          h('p', null, msg),
          h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Play again'));
        return;
      }
      if (w === 'X') {
        streak++; api.save('streak', streak); api.submit(streak); api.sfx.great();
        title = 'You win.'; msg = 'Streak up to ' + streak + '.';
      } else if (w === 'O') {
        streak = 0; api.save('streak', 0); api.sfx.bad();
        title = 'It got you.'; msg = 'Streak reset to zero. Go again.';
      } else {
        api.sfx.blip(420);
        title = 'Draw.'; msg = 'Nobody blinked. Streak holds at ' + streak + '.';
      }
      sync();
      const line = winLine(b);
      if (line) for (const i of line) cells[i].classList.add('win');
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, title),
        h('p', null, msg),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Play again'));
    }

    function render() {
      for (let i = 0; i < 9; i++) {
        cells[i].textContent = b[i];
        cells[i].className = 'cell' + (b[i] ? ' ' + b[i].toLowerCase() : '');
      }
      sync();
    }

    function sync() { pStreak.textContent = mode === '2p' ? ('P1 ' + tally.X + ' – ' + tally.O + ' P2') : ('Streak: ' + streak); }
    function winner(bd) { const l = winLine(bd); return l ? bd[l[0]] : ''; }
    function winLine(bd) {
      for (const L of LINES) if (bd[L[0]] && bd[L[0]] === bd[L[1]] && bd[L[0]] === bd[L[2]]) return L;
      return null;
    }
    function full(bd) { return bd.every((v) => v); }

    reset();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'noughts',
    title: 'Noughts',
    emoji: 'noughts',
    cat: 'brain',
    order: 19,
    blurb: 'Tic-tac-toe against the computer. On chill it blunders often and lets you win; on nightmare it plays perfectly and the best you can force is a draw.',
    scoreLabel: 'Win streak',
    tags: ['tic-tac-toe', 'xo', 'vs-cpu'],
    how: [
      'You are X. Click a square to move and the computer replies at once.',
      'Get three of your marks in a line, across, down, or diagonally, to win.',
      'Your score is your win streak. A loss resets it to zero; a draw holds it.',
      'Harder settings make the computer blunder less. On nightmare it never blunders, so a draw is your ceiling.',
      'Set Players to 2 for hotseat, X versus O on one screen with a running series score.'
    ],
    mount
  });
})();
