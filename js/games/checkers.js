/* Board Meeting. English draughts: forced jumps, mandatory multi-jumps, crown at the back rank. */
(function () {
  'use strict';
  const { h, shuffle } = Engine;

  const RED = 1, BLK = 2;                 /* sides */
  const RMAN = 1, RKING = 2, BMAN = 3, BKING = 4;  /* piece codes */
  const DEPTH = { chill: 2, normal: 4, hard: 6, nightmare: 8 };
  const BUDGET = { chill: 15000, normal: 70000, hard: 200000, nightmare: 500000 };
  const WIN = 1e6;

  function colorOf(p) { return p === 0 ? 0 : (p <= 2 ? RED : BLK); }
  function isKing(p) { return p === RKING || p === BKING; }
  function king(p) { return p === RMAN ? RKING : (p === BMAN ? BKING : p); }
  function crownRow(p) { return colorOf(p) === RED ? 0 : 7; }   /* red climbs to row 0, black sinks to row 7 */
  function other(side) { return side === RED ? BLK : RED; }
  function inb(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

  const UP = [[-1, -1], [-1, 1]];
  const DOWN = [[1, -1], [1, 1]];
  const ALL = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  function dirsFor(p) { return isKing(p) ? ALL : (colorOf(p) === RED ? UP : DOWN); }

  /* --- move generation ------------------------------------------------- */
  function captureMoves(board, r, c) {
    const start = board[r][c];
    function dfs(cr, cc, cp, capList, path) {
      const res = [];
      for (const d of dirsFor(cp)) {
        const mr = cr + d[0], mc = cc + d[1], lr = cr + d[0] * 2, lc = cc + d[1] * 2;
        if (!inb(lr, lc)) continue;
        const mid = board[mr][mc];
        if (mid === 0 || colorOf(mid) === colorOf(cp)) continue;
        if (board[lr][lc] !== 0) continue;
        /* apply this hop on the working board so chained hops see it vacated */
        board[cr][cc] = 0; board[mr][mc] = 0;
        let np = cp, crowned = false;
        if (!isKing(cp) && lr === crownRow(cp)) { np = king(cp); crowned = true; }
        board[lr][lc] = np;
        const nc = capList.concat([[mr, mc]]);
        const npath = path.concat([[lr, lc]]);
        const cont = crowned ? [] : dfs(lr, lc, np, nc, npath);  /* crowning ends the turn */
        if (cont.length) { for (const s of cont) res.push(s); }
        else res.push({ from: [r, c], to: [lr, lc], path: npath, captures: nc, crowned: crowned });
        /* undo */
        board[lr][lc] = 0; board[mr][mc] = mid; board[cr][cc] = cp;
      }
      return res;
    }
    return dfs(r, c, start, [], [[r, c]]);
  }

  function simpleMoves(board, r, c) {
    const p = board[r][c], out = [];
    for (const d of dirsFor(p)) {
      const nr = r + d[0], nc = c + d[1];
      if (!inb(nr, nc) || board[nr][nc] !== 0) continue;
      out.push({ from: [r, c], to: [nr, nc], path: [[r, c], [nr, nc]], captures: [], crowned: !isKing(p) && nr === crownRow(p) });
    }
    return out;
  }

  function genMoves(board, side) {
    const caps = [], simp = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p === 0 || colorOf(p) !== side) continue;
      const cs = captureMoves(board, r, c);
      if (cs.length) { for (const m of cs) caps.push(m); }
      else { const ss = simpleMoves(board, r, c); for (const m of ss) simp.push(m); }
    }
    return caps.length ? caps : simp;   /* captures are forced */
  }

  function applyMove(board, mv) {
    const fr = mv.path[0][0], fc = mv.path[0][1], tr = mv.to[0], tc = mv.to[1];
    const p = board[fr][fc];
    const capVals = mv.captures.map(function (cp) { return board[cp[0]][cp[1]]; });
    board[fr][fc] = 0;
    for (const cp of mv.captures) board[cp[0]][cp[1]] = 0;
    board[tr][tc] = mv.crowned ? king(p) : p;
    return { p: p, capVals: capVals };
  }
  function undoMove(board, mv, rec) {
    const fr = mv.path[0][0], fc = mv.path[0][1], tr = mv.to[0], tc = mv.to[1];
    board[tr][tc] = 0;
    mv.captures.forEach(function (cp, i) { board[cp[0]][cp[1]] = rec.capVals[i]; });
    board[fr][fc] = rec.p;
  }

  /* --- evaluation + alpha-beta ---------------------------------------- */
  function evaluate(board) {   /* positive favours red */
    let s = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p === RMAN) s += 100 + (7 - r) * 3;
      else if (p === RKING) s += 175;
      else if (p === BMAN) s -= 100 + r * 3;
      else if (p === BKING) s -= 175;
    }
    return s;
  }
  function sideVal(board, side) { return side === RED ? evaluate(board) : -evaluate(board); }

  function makeSearch() {
    let nodes = 0, cap = 0;
    function search(board, side, depth, alpha, beta) {
      if (nodes > cap) return sideVal(board, side);
      nodes++;
      const moves = genMoves(board, side);
      if (moves.length === 0) return -(WIN + depth);   /* side to move is stuck -> loses */
      if (depth === 0) return sideVal(board, side);
      let best = -Infinity;
      for (const m of moves) {
        const rec = applyMove(board, m);
        const v = -search(board, other(side), depth - 1, -beta, -alpha);
        undoMove(board, m, rec);
        if (v > best) best = v;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
      }
      return best;
    }
    return function pick(board, side, diffId) {
      const moves = genMoves(board, side);
      if (moves.length <= 1) return moves[0] || null;
      nodes = 0; cap = BUDGET[diffId] || 70000;
      const depth = DEPTH[diffId] || 4;
      const ord = shuffle(moves);
      let best = ord[0], bestVal = -Infinity, alpha = -Infinity;
      for (const m of ord) {
        const rec = applyMove(board, m);
        const v = -search(board, other(side), depth - 1, -Infinity, -alpha);
        undoMove(board, m, rec);
        if (v > bestVal) { bestVal = v; best = m; }
        if (v > alpha) alpha = v;
      }
      return best;
    };
  }

  function mount(root, api) {
    const bagg = Engine.bag();
    const pickAI = makeSearch();
    let board, turn, mode = '1p', selected = null, legalMoves = [], done = false, busy = false, alive = true;
    let wins = api.load('wins', 0);

    const pRed = api.pill('Red: 12');
    const pBlk = api.pill('Black: 12');
    const pTurn = api.pill('Turn: Red');

    const boardEl = h('div', { class: 'board checkers', style: { gridTemplateColumns: 'repeat(8, auto)' } });
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    const cells = [];
    for (let i = 0; i < 64; i++) {
      const r = Math.floor(i / 8), c = i % 8;
      const cell = h('button', { class: 'cell', type: 'button' });
      bagg.listen(cell, 'click', function () { onClick(r, c); });
      cells.push(cell);
      boardEl.appendChild(cell);
    }
    root.append(boardEl, banner);

    api.button('New game', reset);
    const playerSel = api.select('Players', [
      { value: '1p', label: '1 player (vs CPU)' },
      { value: '2p', label: '2 players (hotseat)' }
    ], '1p', function (v) { mode = v; reset(); });
    bagg.add(function () { alive = false; });

    /* play-by-paste: the 32 dark squares (5 states each) + whose turn, as a
       short checksummed code you send over any chat — correspondence draughts
       for a building where you cannot share a link. */
    const DARK = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) DARK.push([r, c]);
    const flat = function () { return DARK.map(function (sq) { return board[sq[0]][sq[1]]; }); };
    function loadPosition(res) {
      board = [];
      for (let r = 0; r < 8; r++) board.push(new Array(8).fill(0));
      DARK.forEach(function (sq, i) { board[sq[0]][sq[1]] = res.cells[i]; });
      mode = '2p'; if (playerSel) playerSel.value = '2p';
      turn = res.extra ? BLK : RED;
      selected = null; done = false; busy = false;
      banner.style.display = 'none';
      legalMoves = genMoves(board, turn);
      if (legalMoves.length === 0) { finish(turn); return; }
      api.status('Loaded. ' + nameOf(turn) + ' to move — make your move, then Share the new code back.');
      render();
    }
    const codeInput = h('input', { type: 'text', class: 'boss-url', placeholder: 'board code', spellcheck: 'false', style: { width: '150px' } });
    api.toolbar.appendChild(codeInput);
    api.button('Share code', function () {
      mode = '2p'; if (playerSel) playerSel.value = '2p';
      codeInput.value = Engine.packCode('CK', flat(), turn === BLK ? 1 : 0, 5);
      codeInput.select();
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(codeInput.value).catch(function () { }); } catch (e) { /* ignore */ }
      api.status('Board code ready — send it to your opponent. They paste it here and press Load.');
    });
    api.button('Load code', function () {
      const res = Engine.unpackCode('CK', codeInput.value, DARK.length, 5);
      if (!res) { api.status('That code did not scan — paste the whole thing.'); return; }
      loadPosition(res);
    });

    function nameOf(side) {
      if (mode === '2p') return side === RED ? 'Player 1 (red)' : 'Player 2 (black)';
      return side === RED ? 'You (red)' : 'CPU (black)';
    }

    function reset() {
      board = [];
      for (let r = 0; r < 8; r++) board.push(new Array(8).fill(0));
      for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) board[r][c] = BMAN;
      for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) board[r][c] = RMAN;
      turn = RED; selected = null; done = false; busy = false;
      banner.style.display = 'none';
      api.status(mode === '2p'
        ? 'Hotseat draughts. Red moves first. Jumps are compulsory; a piece that can keep jumping must.'
        : 'You are red at the bottom. Click a piece, then a glowing square. Jumps are compulsory.');
      beginTurn();
    }

    function beginTurn() {
      legalMoves = genMoves(board, turn);
      if (legalMoves.length === 0) { finish(turn); return; }
      if (mode === '1p' && turn === BLK && !done) {
        busy = true; selected = null; render();
        bagg.timer(aiTurn, 320);
        return;
      }
      busy = false;
      const forced = legalMoves.length && legalMoves[0].captures.length > 0;
      if (!done) api.status(nameOf(turn) + ' to move.' + (forced ? ' A jump is available — you must take it.' : ''));
      render();
    }

    function aiTurn() {
      if (!alive || done) return;
      const mv = pickAI(board, BLK, api.diffId);
      if (!mv) { finish(BLK); return; }
      doMove(mv, BLK);
    }

    function doMove(mv, who) {
      const takes = mv.captures.length;
      applyMove(board, mv);
      if (mv.crowned) api.sfx.great();
      else if (takes) api.sfx.good();
      else api.sfx.click();
      selected = null;
      turn = other(who);
      beginTurn();
    }

    function movesFrom(r, c) {
      return legalMoves.filter(function (m) { return m.from[0] === r && m.from[1] === c; });
    }

    function onClick(r, c) {
      if (done || busy) return;
      if (mode === '1p' && turn !== RED) return;
      if (selected) {
        const matches = movesFrom(selected[0], selected[1]).filter(function (m) { return m.to[0] === r && m.to[1] === c; });
        if (matches.length) {
          /* if two capture routes end on the same square, take the one that grabs the most */
          let best = matches[0];
          for (const m of matches) if (m.captures.length > best.captures.length) best = m;
          doMove(best, turn);
          return;
        }
      }
      const p = board[r][c];
      if (p !== 0 && colorOf(p) === turn && movesFrom(r, c).length) {
        selected = [r, c];
        api.sfx.blip(320);
        render();
        return;
      }
      if (selected) { selected = null; render(); }
    }

    function counts() {
      let R = 0, B = 0;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const col = colorOf(board[r][c]);
        if (col === RED) R++; else if (col === BLK) B++;
      }
      return { R: R, B: B };
    }

    function finish(loser) {
      done = true; busy = false; selected = null;
      const winner = other(loser);
      render();
      let extra = '';
      if (mode === '1p' && winner === RED) {
        wins += 1; api.save('wins', wins);
        const res = api.submit(wins);
        extra = res && res.isRecord ? ' New career best.' : '';
        api.sfx.great();
      } else if (mode === '1p') {
        api.sfx.bad();
      } else {
        api.sfx.great();
      }
      const cc = counts();
      let title;
      if (mode === '2p') title = (winner === RED ? 'Player 1 (red) wins.' : 'Player 2 (black) wins.');
      else title = (winner === RED ? 'You win the board meeting.' : 'The CPU adjourns you.');
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, title),
        h('p', null, 'Red ' + cc.R + ', black ' + cc.B + '.' + (mode === '1p' && winner === RED ? ' Career wins: ' + wins + '.' + extra : '')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Play again'));
    }

    function render() {
      const cc = counts();
      pRed.textContent = (mode === '2p' ? 'P1 red: ' : 'Red: ') + cc.R;
      pBlk.textContent = (mode === '2p' ? 'P2 black: ' : 'Black: ') + cc.B;
      pTurn.textContent = done ? 'Turn: —' : 'Turn: ' + (turn === RED ? 'Red' : 'Black');

      const humanTurn = !done && !busy && (mode === '2p' || turn === RED);
      const movable = new Set();
      if (humanTurn) for (const m of legalMoves) movable.add(m.from[0] * 8 + m.from[1]);
      const targets = new Set();
      if (humanTurn && selected) for (const m of movesFrom(selected[0], selected[1])) targets.add(m.to[0] * 8 + m.to[1]);

      for (let i = 0; i < 64; i++) {
        const r = Math.floor(i / 8), c = i % 8, dark = (r + c) % 2 === 1;
        const cell = cells[i];
        cell.replaceChildren();
        let cls = 'cell' + (dark ? ' dk' : '');
        const p = board[r][c];
        if (p !== 0) {
          cell.appendChild(h('i', { class: 'pc ' + (colorOf(p) === RED ? 'red' : 'blk') + (isKing(p) ? ' king' : '') }));
        }
        if (selected && selected[0] === r && selected[1] === c) cls += ' sel';
        else if (movable.has(i)) cls += ' can';
        if (targets.has(i)) { cls += ' target'; cell.appendChild(h('i', { class: 'dot' })); }
        cell.className = cls;
      }
    }

    reset();
    return function () { bagg.dispose(); };
  }

  Arcade.register({
    id: 'checkers',
    title: 'Board Meeting',
    emoji: 'checkers',
    cat: 'brain',
    order: 28,
    blurb: 'English draughts on company time. Jumps are compulsory, so is that 4pm sync. Chain your captures and crown a king before the CPU does.',
    scoreLabel: 'Wins',
    tags: ['checkers', 'draughts', 'board', 'vs-cpu', 'correspondence'],
    how: [
      'You are red at the bottom; the CPU is black at the top. Reduce the other side to no pieces or no legal move.',
      'Click or tap one of your pieces, then click a glowing square to move it there. Men step diagonally forward, kings step either way.',
      'Captures are forced: if any jump exists you must take one, and a piece that can keep jumping keeps jumping in the same turn.',
      'Reach the far back rank and the piece is crowned a king. Career wins are your score.',
      'Difficulty sets how deep the CPU thinks: chill barely plans ahead, nightmare reads eight plies. Set Players to 2 for hotseat and the CPU steps aside.',
      'Play a coworker with no network: make your move, hit Share code, and send the short code over any chat. They paste it, press Load, play their reply, and Share back. It is full correspondence draughts that travels as a dull reference number.'
    ],
    usesLetters: false,
    mount: mount
  });
})();