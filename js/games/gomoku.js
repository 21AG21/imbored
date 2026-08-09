/* Five in a Row — get five of your stones in a line before the deskmate does. */
(function () {
  'use strict';
  const { h } = Engine;
  const SIZE = 13;
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  const HUMAN = 1, CPU = 2;

  function mount(root, api) {
    const bagg = Engine.bag();
    let board, over, streak, disposed = false, busy = false;
    streak = api.load('streak', 0);

    const pStreak = api.pill('win streak: ' + streak);
    const pTurn = api.pill('your move');
    const msg = h('div', { class: 'gk-msg' }, 'You are black. Get five in a row.');
    const grid = h('div', { class: 'gk-grid', style: { gridTemplateColumns: 'repeat(' + SIZE + ', 1fr)' } });
    const cells = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      const c = h('button', { class: 'gk-cell', type: 'button', onclick: () => human(i) });
      cells.push(c); grid.appendChild(c);
    }
    root.appendChild(h('div', { class: 'gomoku' }, msg, grid));
    api.button('New game', reset);

    const at = (r, c) => (r < 0 || c < 0 || r >= SIZE || c >= SIZE) ? -1 : board[r * SIZE + c];

    function reset() {
      board = new Array(SIZE * SIZE).fill(0);
      over = false; busy = false;
      cells.forEach((c) => { c.className = 'gk-cell'; });
      msg.textContent = 'You are black. Get five in a row.'; msg.className = 'gk-msg';
      pTurn.textContent = 'your move';
      api.status('Click an empty point to place a black stone. First to five in a line — any direction — wins.');
    }
    function render(lastHuman, lastCpu, winLine) {
      for (let i = 0; i < board.length; i++) {
        cells[i].className = 'gk-cell' + (board[i] === HUMAN ? ' b' : board[i] === CPU ? ' w' : '') +
          (i === lastHuman || i === lastCpu ? ' last' : '') + (winLine && winLine.indexOf(i) >= 0 ? ' win' : '');
      }
      pStreak.textContent = 'win streak: ' + streak;
    }

    /* longest run of `who` through (r,c) in direction d, plus open-end count */
    function lineInfo(r, c, d, who) {
      let len = 1, openA = false, openB = false;
      let rr = r + d[0], cc = c + d[1];
      while (at(rr, cc) === who) { len++; rr += d[0]; cc += d[1]; }
      if (at(rr, cc) === 0) openA = true;
      rr = r - d[0]; cc = c - d[1];
      while (at(rr, cc) === who) { len++; rr -= d[0]; cc -= d[1]; }
      if (at(rr, cc) === 0) openB = true;
      return { len, open: (openA ? 1 : 0) + (openB ? 1 : 0) };
    }
    function placeScore(r, c, who) {
      let best = 0;
      for (const d of DIRS) {
        const { len, open } = lineInfo(r, c, d, who);
        let v;
        if (len >= 5) v = 1000000;
        else if (len === 4) v = open === 2 ? 100000 : open === 1 ? 12000 : 0;
        else if (len === 3) v = open === 2 ? 6000 : open === 1 ? 400 : 0;
        else if (len === 2) v = open === 2 ? 300 : open === 1 ? 40 : 0;
        else v = open === 2 ? 20 : 5;
        best += v;
      }
      return best;
    }
    function winThrough(i, who) {
      const r = Math.floor(i / SIZE), c = i % SIZE;
      for (const d of DIRS) {
        const line = [i];
        let rr = r + d[0], cc = c + d[1];
        while (at(rr, cc) === who) { line.push(rr * SIZE + cc); rr += d[0]; cc += d[1]; }
        rr = r - d[0]; cc = c - d[1];
        while (at(rr, cc) === who) { line.push(rr * SIZE + cc); rr -= d[0]; cc -= d[1]; }
        if (line.length >= 5) return line;
      }
      return null;
    }

    function human(i) {
      if (over || busy || board[i]) return;
      board[i] = HUMAN; api.sfx.click();
      const win = winThrough(i, HUMAN);
      if (win) { over = true; streak++; api.save('streak', streak); api.submit(streak); api.sfx.great(); render(i, -1, win); msg.textContent = 'Five in a row — you win! Streak ' + streak + '.'; msg.className = 'gk-msg win'; pTurn.textContent = 'you win'; return; }
      render(i, -1);
      if (board.every((v) => v)) { over = true; msg.textContent = 'Board full — a draw.'; return; }
      busy = true; pTurn.textContent = 'deskmate…';
      setTimeout(() => cpuTurn(i), 260);
    }
    function cpuTurn(lastHuman) {
      if (disposed || over) return;
      let bestI = -1, bestV = -1;
      for (let i = 0; i < board.length; i++) {
        if (board[i]) continue;
        const r = Math.floor(i / SIZE), c = i % SIZE;
        const off = placeScore(r, c, CPU);
        const def = placeScore(r, c, HUMAN);
        const v = off + def * 0.92 + (Math.abs(r - 6) + Math.abs(c - 6) < 5 ? 3 : 0);
        if (v > bestV) { bestV = v; bestI = i; }
      }
      if (bestI < 0) { over = true; return; }
      board[bestI] = CPU; api.sfx.blip(300);
      const win = winThrough(bestI, CPU);
      if (win) { over = true; streak = 0; api.save('streak', 0); api.sfx.bad(); render(lastHuman, bestI, win); msg.textContent = 'Deskmate got five. Streak reset.'; msg.className = 'gk-msg lose'; pTurn.textContent = 'you lose'; busy = false; return; }
      render(lastHuman, bestI);
      busy = false; pTurn.textContent = 'your move';
    }

    reset();
    return () => { disposed = true; bagg.dispose(); };
  }

  Arcade.register({
    id: 'gomoku', title: 'Five in a Row', emoji: 'connect4', cat: 'brain', order: 30,
    blurb: 'Place stones on the grid and try to line up five in a row before your deskmate does. Simple to learn, hard to close out.',
    scoreLabel: 'Win streak', tags: ['strategy', 'board', 'classic'],
    how: [
      'Click an empty point to place a black stone. The deskmate answers in white.',
      'Line up five of your stones in a row, in any direction, to win.',
      'The deskmate blocks your threats, so build more than one at once.',
      'Your score is the streak of games you win in a row.'
    ],
    mount
  });
})();
