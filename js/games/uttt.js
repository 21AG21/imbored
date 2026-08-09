/* Ultimate Tic-Tac-Toe — nine boards inside one. Where you play sends the
   deskmate where they must play next. Win three small boards in a row. */
(function () {
  'use strict';
  const { h, randInt, pick } = Engine;
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

  function winner(cells) {
    for (const [a, b, c] of LINES) if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a];
    return 0;
  }
  function full(cells) { return cells.every((v) => v); }

  function mount(root, api) {
    const bagg = Engine.bag();
    let micro, macro, forced, turn, over, disposed = false;

    const pTurn = api.pill('your move');
    const pScore = api.pill('');
    const msg = h('div', { class: 'uttt-msg' }, '');
    const grid = h('div', { class: 'uttt-grid' });
    const cellEls = [];    // cellEls[b][c]
    const boardEls = [];   // boardEls[b]
    root.appendChild(h('div', { class: 'uttt' }, msg, grid));
    api.button('New game', reset);

    function build() {
      grid.replaceChildren();
      for (let b = 0; b < 9; b++) {
        const bd = h('div', { class: 'uttt-board' });
        cellEls[b] = [];
        for (let c = 0; c < 9; c++) {
          const cell = h('button', { class: 'uttt-cell', type: 'button', onclick: () => play(b, c, 1) });
          cellEls[b][c] = cell; bd.appendChild(cell);
        }
        boardEls[b] = bd; grid.appendChild(bd);
      }
    }

    function reset() {
      micro = Array.from({ length: 9 }, () => new Array(9).fill(0));
      macro = new Array(9).fill(0);
      forced = -1; turn = 1; over = false;
      msg.textContent = 'You are X. Win three small boards in a row.'; msg.className = 'uttt-msg';
      paint(); syncTurn();
      api.status('Your move sends the deskmate to the matching small board. If that board is already decided, they play anywhere. Take three small boards in a line to win.');
    }

    function legalBoards() {
      if (forced >= 0 && !macro[forced] && !full(micro[forced])) return [forced];
      const out = [];
      for (let b = 0; b < 9; b++) if (!macro[b] && !full(micro[b])) out.push(b);
      return out;
    }

    function place(b, c, p) {
      micro[b][c] = p;
      const w = winner(micro[b]);
      if (w) macro[b] = w;
      else if (full(micro[b])) macro[b] = 3;   // drawn board, owned by nobody
      forced = (macro[c] || full(micro[c])) ? -1 : c;
    }

    function play(b, c, p) {
      if (over || disposed) return;
      if (p === 1 && turn !== 1) return;
      const ok = legalBoards();
      if (!ok.includes(b) || micro[b][c]) { api.sfx.bad(); return; }
      place(b, c, p);
      api.sfx.click();
      paint();
      const gw = winner(macro.map((v) => (v === 3 ? 0 : v)));
      if (gw || legalBoards().length === 0) return finish(gw);
      turn = p === 1 ? 2 : 1; syncTurn();
      if (turn === 2) setTimeout(cpu, 380);
    }

    /* CPU: win the game if it can, else win/deny a small board, else take
       center-ish, with a difficulty-scaled chance to just play at random. */
    function cpu() {
      if (over || disposed || turn !== 2) return;
      const boards = legalBoards();
      if (!boards.length) return finish(0);
      const moves = [];
      for (const b of boards) for (let c = 0; c < 9; c++) if (!micro[b][c]) moves.push([b, c]);

      const sloppy = Math.max(0, 0.5 - api.dm * 0.22);   // chill blunders often, nightmare almost never
      let choice = null;
      if (Math.random() > sloppy) {
        choice = scoreMove(moves);
      }
      if (!choice) choice = pick(moves);
      place(choice[0], choice[1], 2);
      api.sfx.blip(320);
      paint();
      const gw = winner(macro.map((v) => (v === 3 ? 0 : v)));
      if (gw || legalBoards().length === 0) return finish(gw);
      turn = 1; syncTurn();
    }

    function scoreMove(moves) {
      let best = null, bestScore = -1e9;
      for (const [b, c] of moves) {
        let sc = 0;
        const cells = micro[b].slice(); cells[c] = 2;
        const wonHere = winner(cells) === 2;
        if (wonHere) {
          sc += 30;
          // would winning this board complete a macro line?
          const test = macro.slice(); test[b] = 2;
          if (winner(test.map((v) => (v === 3 ? 0 : v))) === 2) sc += 1000;
        }
        // block: does the human threaten to win board b next?
        if (threatens(micro[b], 1) && !wonHere) sc -= 5;
        if (wonHere && threatens(micro[b], 1)) sc += 8;   // taking a board they wanted
        // avoid sending them to a board where they can win a macro-critical board
        const sendTo = (macro[c] || full(micro[c])) ? -1 : c;
        if (sendTo >= 0 && threatens(micro[sendTo], 1)) sc -= 12;
        if (sendTo === -1) sc -= 3;                        // free move is good for them
        sc += [3, 1, 3, 1, 4, 1, 3, 1, 3][c];              // center/corner bias inside a board
        sc += [3, 1, 3, 1, 4, 1, 3, 1, 3][b] * 0.4;        // and which board
        sc += Math.random() * 0.5;
        if (sc > bestScore) { bestScore = sc; best = [b, c]; }
      }
      return best;
    }
    function threatens(cells, p) {
      for (const [a, b, c] of LINES) {
        const line = [cells[a], cells[b], cells[c]];
        if (line.filter((v) => v === p).length === 2 && line.includes(0)) return true;
      }
      return false;
    }

    function paint() {
      const ok = legalBoards();
      for (let b = 0; b < 9; b++) {
        const owned = macro[b];
        boardEls[b].className = 'uttt-board' + (owned === 1 ? ' won-you' : owned === 2 ? ' won-cpu' : owned === 3 ? ' drawn' : '') + (ok.includes(b) && !over ? ' active' : '');
        for (let c = 0; c < 9; c++) {
          const v = micro[b][c];
          const el = cellEls[b][c];
          el.textContent = v === 1 ? '✕' : v === 2 ? '◯' : '';
          el.className = 'uttt-cell' + (v === 1 ? ' x' : v === 2 ? ' o' : '');
          el.disabled = over || v !== 0 || turn !== 1 || !ok.includes(b);
        }
      }
    }
    function syncTurn() {
      pTurn.textContent = over ? '' : turn === 1 ? 'your move' : 'deskmate…';
      const you = macro.filter((v) => v === 1).length, cpuB = macro.filter((v) => v === 2).length;
      pScore.textContent = 'boards ' + you + ' · ' + cpuB;
    }
    function finish(gw) {
      over = true; syncTurn(); paint();
      if (gw === 1) {
        api.sfx.great();
        const w = api.load('wins', 0) + 1; api.save('wins', w); api.submit(w);
        msg.textContent = 'You took the meta-board. Nicely done.'; msg.className = 'uttt-msg win';
        try { const r = msg.getBoundingClientRect(); Engine.fx.burst(r.left + r.width / 2, r.top + 20, 46); } catch (e) { /* ignore */ }
      } else if (gw === 2) {
        api.sfx.bad();
        msg.textContent = 'The deskmate lined up three boards. Rematch?'; msg.className = 'uttt-msg lose';
      } else {
        api.sfx.thud();
        const you = macro.filter((v) => v === 1).length, cpuB = macro.filter((v) => v === 2).length;
        msg.textContent = you === cpuB ? 'Board full — dead even.' : you > cpuB ? 'Board full — you led on boards.' : 'Board full — deskmate led on boards.';
        msg.className = 'uttt-msg';
      }
    }

    build(); reset();
    return () => { disposed = true; bagg.dispose(); };
  }

  Arcade.register({
    id: 'uttt', title: 'Ultimate Noughts', emoji: 'uttt', cat: 'brain', order: 24,
    blurb: 'Tic-tac-toe with a board inside every square. The cell you take decides which small board the deskmate must play next. Win three small boards in a row.',
    scoreLabel: 'Wins', tags: ['strategy', 'board', 'vs cpu'],
    how: [
      'Each of the nine squares holds its own noughts-and-crosses board. Win a small board to claim that square.',
      'The cell you play in tells the deskmate which small board they must play in next.',
      'If they are sent to a board that is already won or full, they may play in any open board.',
      'Win three small boards in a row — across, down, or diagonally — to win the whole thing.'
    ],
    mount
  });
})();
