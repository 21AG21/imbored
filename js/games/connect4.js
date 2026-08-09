/* Four In A Row against the computer. It thinks deeper the meaner you set the dial. */
(function () {
  'use strict';
  const { h, clamp, randInt } = Engine;

  const COLS = 7, ROWS = 6;
  const CELL = 84, PAD = 16;
  const W = COLS * CELL + PAD * 2;
  const H = ROWS * CELL + PAD * 2 + 70;
  const TOP = 70;

  const YOU = 1, CPU = 2;

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;

    /* how many plies the computer looks ahead */
    const DEPTH = { chill: 1, normal: 4, hard: 6, nightmare: 8 }[api.diffId] || 4;

    let board, turn, over, winner, winLine, drop, hoverCol, thinking, wins, losses, mode = '1p', p1w = 0, p2w = 0;

    wins = api.load('wins', 0);
    losses = api.load('losses', 0);
    const canClick = () => !over && (mode === '2p' || turn === YOU);

    const pRec = api.pill('');
    const pTurn = api.pill('');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);

    function reset(cpuFirst) {
      board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
      turn = (mode === '1p' && cpuFirst) ? CPU : YOU;
      over = false; winner = 0; winLine = null; drop = null; hoverCol = -1; thinking = 0;
      banner.style.display = 'none';
      api.status(mode === '2p'
        ? 'Hotseat: Player 1 is yellow, Player 2 is red. Click a column to drop.'
        : 'Click a column to drop a disc. Four in a row in any direction wins it.');
      sync();
      if (mode === '1p' && turn === CPU) thinking = 0.45;
    }

    function sync() {
      if (mode === '2p') {
        pRec.textContent = 'P1 ' + p1w + ' - ' + p2w + ' P2';
        pTurn.textContent = over ? 'game over' : (turn === YOU ? "Player 1's move (yellow)" : "Player 2's move (red)");
        pTurn.className = 'pill good';
      } else {
        pRec.textContent = 'You ' + wins + ' - ' + losses + ' Computer';
        pTurn.textContent = over ? 'game over' : turn === YOU ? 'your move' : 'thinking...';
        pTurn.className = 'pill ' + (over ? '' : turn === YOU ? 'good' : 'warn');
      }
    }

    const freeRow = (b, c) => {
      for (let r = ROWS - 1; r >= 0; r--) if (!b[r][c]) return r;
      return -1;
    };

    function winnerAt(b) {
      const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const p = b[r][c];
        if (!p) continue;
        for (const [dr, dc] of dirs) {
          const er = r + dr * 3, ec = c + dc * 3;
          if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
          if (b[r + dr][c + dc] === p && b[r + dr * 2][c + dc * 2] === p && b[er][ec] === p) {
            return { p, line: [[r, c], [r + dr, c + dc], [r + dr * 2, c + dc * 2], [er, ec]] };
          }
        }
      }
      return null;
    }

    const full = (b) => b[0].every((v) => v);

    /* ---- evaluation: count how good every 4-window is for the computer ---- */
    function scoreWindow(w) {
      let me = 0, you = 0;
      for (const v of w) { if (v === CPU) me++; else if (v === YOU) you++; }
      if (me && you) return 0;
      if (me === 4) return 100000;
      if (you === 4) return -100000;
      if (me === 3) return 60;
      if (me === 2) return 8;
      if (you === 3) return -80;      // blocking matters slightly more than building
      if (you === 2) return -9;
      return 0;
    }

    function evaluate(b) {
      let s = 0;
      /* centre column is worth real estate */
      for (let r = 0; r < ROWS; r++) {
        if (b[r][3] === CPU) s += 7;
        else if (b[r][3] === YOU) s -= 7;
      }
      const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        for (const [dr, dc] of dirs) {
          const er = r + dr * 3, ec = c + dc * 3;
          if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
          s += scoreWindow([b[r][c], b[r + dr][c + dc], b[r + dr * 2][c + dc * 2], b[er][ec]]);
        }
      }
      return s;
    }

    const ORDER = [3, 2, 4, 1, 5, 0, 6];

    function negamax(b, depth, alpha, beta, player) {
      const w = winnerAt(b);
      if (w) return (w.p === CPU ? 1 : -1) * (900000 + depth * 1000);
      if (full(b) || depth === 0) return evaluate(b);

      let best = -Infinity;
      for (const c of ORDER) {
        const r = freeRow(b, c);
        if (r < 0) continue;
        b[r][c] = player;
        const v = -negamax(b, depth - 1, -beta, -alpha, player === CPU ? YOU : CPU);
        b[r][c] = 0;
        if (v > best) best = v;
        if (v > alpha) alpha = v;
        if (alpha >= beta) break;
      }
      return player === CPU ? best : best;
    }

    function cpuMove() {
      const moves = [];
      for (const c of ORDER) {
        const r = freeRow(board, c);
        if (r < 0) continue;
        board[r][c] = CPU;
        let v;
        const w = winnerAt(board);
        if (w && w.p === CPU) v = 1e9;
        else v = -negamax(board, DEPTH - 1, -Infinity, Infinity, YOU);
        board[r][c] = 0;
        moves.push({ c, v });
      }
      if (!moves.length) return -1;
      moves.sort((a, b) => b.v - a.v);
      /* on chill it plays a bit loose so you can actually win */
      if (api.diffId === 'chill' && moves.length > 1 && Math.random() < 0.45) return moves[randInt(0, Math.min(2, moves.length - 1))].c;
      const top = moves.filter((m) => m.v === moves[0].v);
      return top[randInt(0, top.length - 1)].c;
    }

    function place(col, who) {
      const r = freeRow(board, col);
      if (r < 0) return false;
      board[r][col] = who;
      drop = { r, c: col, y: -CELL, who };
      api.sfx.tone({ freq: who === YOU ? 400 : 300, to: 180, dur: 0.14, type: 'square', vol: 0.09 });
      const w = winnerAt(board);
      if (w) {
        over = true;
        winner = w.p;
        winLine = w.line;
        if (mode === '2p') {
          if (w.p === YOU) p1w++; else p2w++;
          api.sfx.great();
        } else if (w.p === YOU) { wins++; api.save('wins', wins); api.submit(wins); api.sfx.great(); }
        else { losses++; api.save('losses', losses); api.sfx.bad(); }
        setTimeout(showEnd, 700);
      } else if (full(board)) {
        over = true;
        winner = 0;
        setTimeout(showEnd, 500);
      } else {
        turn = who === YOU ? CPU : YOU;
        if (mode === '1p' && turn === CPU) thinking = 0.35;
      }
      sync();
      return true;
    }

    function showEnd() {
      banner.style.display = '';
      let title, msg;
      if (mode === '2p') {
        title = winner === YOU ? 'Player 1 wins.' : winner === CPU ? 'Player 2 wins.' : 'Full board, nobody wins.';
        msg = winner ? ('Series: Player 1 ' + p1w + ' – ' + p2w + ' Player 2.') : 'A draw. Run it back.';
      } else {
        title = winner === YOU ? 'You got it.' : winner === CPU ? 'Beaten.' : 'Full board, nobody wins.';
        msg = winner === YOU ? ('Four in a row. Record now ' + wins + ' to ' + losses + '.')
          : winner === CPU ? ('The computer was looking ' + DEPTH + ' moves ahead. Record ' + wins + ' to ' + losses + '.')
            : 'A draw. Nobody is proud of this.';
      }
      banner.replaceChildren(
        h('h3', null, title),
        h('p', null, msg),
        h('button', { class: 'btn primary', type: 'button', onclick: () => reset(mode === '1p' && winner === YOU) }, 'Play again'));
    }

    bagg.listen(cv.el, 'pointermove', (e) => {
      const p = cv.pos(e);
      hoverCol = !canClick() ? -1 : clamp(Math.floor((p.x - PAD) / CELL), 0, COLS - 1);
    });
    bagg.listen(cv.el, 'pointerleave', () => { hoverCol = -1; });
    bagg.listen(cv.el, 'pointerdown', (e) => {
      if (!canClick()) return;
      const p = cv.pos(e);
      const c = Math.floor((p.x - PAD) / CELL);
      if (c < 0 || c >= COLS) return;
      place(c, turn);
    });

    api.button('New game', () => reset(false));
    api.button('Let it start', () => reset(true));
    api.select('Players', [
      { value: '1p', label: '1 player (vs CPU)' },
      { value: '2p', label: '2 players (hotseat)' }
    ], '1p', (v) => { mode = v; p1w = 0; p2w = 0; reset(false); });

    /* play-by-paste: a move code you send over any chat; opponent loads it */
    const flat = () => { const a = []; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) a.push(board[r][c]); return a; };
    function loadPosition(res) {
      let k = 0;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) board[r][c] = res.cells[k++];
      mode = '2p'; turn = res.extra ? CPU : YOU;
      over = false; winner = 0; winLine = null; drop = null; thinking = 0; hoverCol = -1;
      const w = winnerAt(board);
      if (w) { over = true; winner = w.p; winLine = w.line; setTimeout(showEnd, 300); }
      else if (full(board)) { over = true; winner = 0; setTimeout(showEnd, 300); }
      banner.style.display = 'none';
      api.status(over ? 'Loaded — this game is already decided.'
        : 'Loaded. Your move, you are ' + (turn === YOU ? 'yellow' : 'red') + '. Drop, then Share the new code back.');
      sync();
    }
    const codeInput = h('input', { type: 'text', class: 'boss-url', placeholder: 'move code', spellcheck: 'false', style: { width: '150px' } });
    api.toolbar.appendChild(codeInput);
    api.button('Share code', () => {
      mode = '2p';
      codeInput.value = Engine.packCode('C4', flat(), turn === YOU ? 0 : 1);
      codeInput.select();
      try { if (navigator.clipboard) navigator.clipboard.writeText(codeInput.value); } catch (e) { /* ignore */ }
      api.status('Move code ready — send it to your opponent. They paste it here and press Load.');
    });
    api.button('Load code', () => {
      const res = Engine.unpackCode('C4', codeInput.value, ROWS * COLS);
      if (!res) { api.status('That code did not scan — paste the whole thing.'); return; }
      loadPosition(res);
    });

    function update(dt) {
      if (drop) {
        const target = TOP + PAD + drop.r * CELL;
        drop.y += 2400 * dt * (drop.y < target ? 1 : 0);
        if (drop.y >= target) drop = null;
      }
      if (thinking > 0 && !over) {
        thinking -= dt;
        if (thinking <= 0) {
          const c = cpuMove();
          if (c >= 0) place(c, CPU);
        }
      }
    }

    function draw() {
      ctx.fillStyle = '#141a26';
      ctx.fillRect(0, 0, W, H);

      /* hover ghost */
      if (hoverCol >= 0 && canClick() && freeRow(board, hoverCol) >= 0) {
        const solid = turn === YOU ? 'rgba(255,203,31,.9)' : 'rgba(232,64,42,.9)';
        const wash = turn === YOU ? 'rgba(255,203,31,.13)' : 'rgba(232,64,42,.13)';
        ctx.fillStyle = solid;
        ctx.beginPath();
        ctx.arc(PAD + hoverCol * CELL + CELL / 2, 34, CELL * 0.34, 0, 7);
        ctx.fill();
        ctx.fillStyle = wash;
        ctx.fillRect(PAD + hoverCol * CELL, TOP, CELL, ROWS * CELL + PAD * 2);
      }

      /* the blue board */
      ctx.fillStyle = '#2a4bbd';
      ctx.fillRect(PAD - 8, TOP - 8, COLS * CELL + 16, ROWS * CELL + PAD * 2 + 8);
      ctx.strokeStyle = '#0c1119';
      ctx.lineWidth = 5;
      ctx.strokeRect(PAD - 8, TOP - 8, COLS * CELL + 16, ROWS * CELL + PAD * 2 + 8);

      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const x = PAD + c * CELL + CELL / 2;
        const y = TOP + PAD + r * CELL + CELL / 2;
        const v = board[r][c];
        const falling = drop && drop.r === r && drop.c === c;
        ctx.fillStyle = '#141a26';
        ctx.beginPath();
        ctx.arc(x, y, CELL * 0.38, 0, 7);
        ctx.fill();
        if (!v || falling) continue;
        disc(x, y, v, false);
      }

      if (drop) {
        disc(PAD + drop.c * CELL + CELL / 2, drop.y + CELL / 2, drop.who, false);
      }

      if (winLine) {
        for (const [r, c] of winLine) {
          disc(PAD + c * CELL + CELL / 2, TOP + PAD + r * CELL + CELL / 2, board[r][c], true);
        }
      }

      ctx.fillStyle = '#ded6c2';
      ctx.font = 'bold 12px Verdana, sans-serif';
      ctx.fillText('COMPUTER LOOKS ' + DEPTH + ' MOVE' + (DEPTH === 1 ? '' : 'S') + ' AHEAD', PAD, 20);
    }

    function disc(x, y, v, glow) {
      ctx.fillStyle = v === YOU ? '#ffcb1f' : '#e8402a';
      ctx.beginPath();
      ctx.arc(x, y, CELL * 0.36, 0, 7);
      ctx.fill();
      ctx.strokeStyle = glow ? '#fffdf3' : '#0c1119';
      ctx.lineWidth = glow ? 5 : 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.beginPath();
      ctx.arc(x - CELL * 0.1, y - CELL * 0.11, CELL * 0.13, 0, 7);
      ctx.fill();
    }

    reset(false);
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'connect4',
    title: 'Four In A Row',
    emoji: 'connect4',
    cat: 'brain',
    order: 25,
    blurb: 'Drop discs, get four in a line, try to beat a computer that is genuinely quite good at this once you turn the dial up.',
    scoreLabel: 'Wins',
    tags: ['connect four', 'strategy', 'computer opponent', 'board'],
    how: [
      'Click or tap a column to drop your yellow disc. It falls to the lowest free slot.',
      'Four in a row wins: across, up and down, or on either diagonal.',
      'The computer searches ahead with alpha-beta pruning. Chill looks one move ahead and plays loose on purpose; nightmare looks eight moves ahead and does not.',
      'Your win-loss record against the computer is kept between visits.',
      'Set Players to 2 for hotseat: two people on one keyboard, yellow versus red, with a running series score.'
    ],
    mount
  });
})();
