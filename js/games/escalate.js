/* Escalate. Chain-reaction territory grab, filed as a ticket queue that
   overflows onto neighboring desks. Same bones as the classic "Chain
   Reaction" board game. */
(function () {
  'use strict';
  const { h, randInt } = Engine;
  const ROWS = 6, COLS = 8, N = ROWS * COLS, YOU = 1, AI = 2;
  const NEI = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const BLUNDER = { chill: 0.55, normal: 0.28, hard: 0.08, nightmare: 0 };
  /* a board filled to exactly capacity-1 everywhere has nowhere left to
     dissipate a chain reaction into (no sink cell) and can fire forever —
     rare in real play but legal, so cap the sweep count everywhere the
     resolve loop runs and treat hitting it as the floor saturating rather
     than let either a visible cascade or a synchronous AI simulation hang */
  const MAX_SWEEPS = 300;

  function mount(root, api) {
    const bagg = Engine.bag();
    let orbs, owner, turn, done, busy, movesMade, mode = '1p', timer;

    const pYou = api.pill('You: 0');
    const pAi = api.pill('CPU: 0');
    const board = h('div', { class: 'board esc', style: { gridTemplateColumns: 'repeat(' + COLS + ', 1fr)' } });
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    const cells = [];
    for (let i = 0; i < N; i++) {
      const el = h('button', { class: 'cell', type: 'button' }, h('span', { class: 'esc-count' }));
      const r = Math.floor(i / COLS), c = i % COLS;
      el.addEventListener('click', () => human(r, c));
      cells.push(el);
      board.appendChild(el);
    }
    root.append(board, banner);
    api.button('New game', reset);
    api.select('Players', [
      { value: '1p', label: '1 player (vs CPU)' },
      { value: '2p', label: '2 players (hotseat)' }
    ], '1p', (v) => { mode = v; reset(); });
    bagg.add(() => { if (timer) clearTimeout(timer); });

    const idx = (r, c) => r * COLS + c;
    const capacity = (r, c) => (r > 0 ? 1 : 0) + (r < ROWS - 1 ? 1 : 0) + (c > 0 ? 1 : 0) + (c < COLS - 1 ? 1 : 0);
    const CAP = []; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) CAP.push(capacity(r, c));

    function reset() {
      if (timer) { clearTimeout(timer); timer = null; }
      orbs = new Uint8Array(N);
      owner = new Uint8Array(N);
      turn = YOU; done = false; busy = false; movesMade = 0;
      banner.style.display = 'none';
      api.status(mode === '2p'
        ? 'Hotseat: Player 1 places first. Click any empty desk or one of your own to add a ticket.'
        : 'Click any empty desk or one of your own to add a ticket. Fill a desk past its capacity and it overflows onto every neighbor, converting them to you.');
      render();
    }

    function legalMoves(ownerArr, who) {
      const mv = [];
      for (let i = 0; i < N; i++) if (ownerArr[i] === 0 || ownerArr[i] === who) mv.push(i);
      return mv;
    }

    /* the abelian-sandpile property means the order critical cells fire in
       never changes the final settled board, so a plain repeated full-board
       sweep is enough — no queue bookkeeping needed */
    function resolveAll(orbsArr, ownerArr, who) {
      let changed = true, sweeps = 0;
      while (changed && sweeps < MAX_SWEEPS) {
        changed = false; sweeps++;
        for (let i = 0; i < N; i++) {
          if (orbsArr[i] < CAP[i]) continue;
          changed = true;
          const r = Math.floor(i / COLS), c = i % COLS;
          orbsArr[i] -= CAP[i];
          ownerArr[i] = orbsArr[i] > 0 ? who : 0;
          for (const [dr, dc] of NEI) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue;
            orbsArr[idx(nr, nc)] += 1;
            ownerArr[idx(nr, nc)] = who;
          }
        }
      }
    }

    /* stepped, visible version of the same resolution, so a big chain reads
       as a cascade instead of jumping straight to the final board */
    function resolveWave(who, after, wave) {
      wave = (wave || 0) + 1;
      if (wave > MAX_SWEEPS) {
        /* the floor has saturated — every desk sits at capacity-1 with
           nowhere left for the chain to go. End it on current holdings
           rather than let the cascade run forever. */
        render();
        const cc = counts();
        finish(cc.y === cc.a ? null : (cc.y > cc.a ? YOU : AI));
        return;
      }
      let firedAny = false;
      for (let i = 0; i < N; i++) {
        if (orbs[i] < CAP[i]) continue;
        firedAny = true;
        const r = Math.floor(i / COLS), c = i % COLS;
        orbs[i] -= CAP[i];
        owner[i] = orbs[i] > 0 ? who : 0;
        for (const [dr, dc] of NEI) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue;
          orbs[idx(nr, nc)] += 1;
          owner[idx(nr, nc)] = who;
        }
      }
      render();
      if (!firedAny) { after(); return; }
      api.sfx.blip(260);
      timer = setTimeout(() => resolveWave(who, after, wave), 150);
    }

    function counts() {
      let y = 0, a = 0;
      for (let i = 0; i < N; i++) { if (owner[i] === YOU) y += orbs[i]; else if (owner[i] === AI) a += orbs[i]; }
      return { y, a };
    }

    function place(r, c, who) {
      if (done || busy) return;
      const i = idx(r, c);
      if (owner[i] !== 0 && owner[i] !== who) return;
      orbs[i] += 1; owner[i] = who;
      movesMade++;
      api.sfx.click();
      busy = true;
      render();
      timer = setTimeout(() => resolveWave(who, () => afterMove(who)), 150);
    }

    function human(r, c) {
      if (done || busy) return;
      if (mode === '1p' && turn !== YOU) return;
      place(r, c, turn);
    }

    function afterMove(who) {
      busy = false;
      if (movesMade >= 2) {
        const cc = counts();
        const opp = who === YOU ? AI : YOU;
        const oppOrbs = opp === YOU ? cc.y : cc.a;
        if (oppOrbs === 0) { finish(who); return; }
      }
      turn = who === YOU ? AI : YOU;
      render();
      if (mode === '1p' && turn === AI) timer = setTimeout(aiTurn, 320);
    }

    function evalPosition(orbsArr, ownerArr, who) {
      const opp = who === YOU ? AI : YOU;
      let myOrbs = 0, oppOrbs = 0, myCells = 0, oppCells = 0;
      for (let i = 0; i < N; i++) {
        if (ownerArr[i] === who) { myOrbs += orbsArr[i]; myCells++; }
        else if (ownerArr[i] === opp) { oppOrbs += orbsArr[i]; oppCells++; }
      }
      if (oppCells === 0 && myCells > 0) return 1e6;
      return (myOrbs - oppOrbs) + (myCells - oppCells) * 1.6;
    }

    function simulateMove(orbsArr, ownerArr, i, who) {
      const o2 = orbsArr.slice(), w2 = ownerArr.slice();
      o2[i] += 1; w2[i] = who;
      resolveAll(o2, w2, who);
      return { orbs: o2, owner: w2 };
    }

    function chooseAiMove() {
      const mv = legalMoves(owner, AI);
      if (!mv.length) return null;
      const bl = BLUNDER[api.diffId] === undefined ? 0.25 : BLUNDER[api.diffId];
      if (Math.random() < bl) return mv[randInt(0, mv.length - 1)];
      const deep = api.diffId === 'hard' || api.diffId === 'nightmare';
      let best = mv[0], bestScore = -Infinity;
      for (const i of mv) {
        const sim = simulateMove(orbs, owner, i, AI);
        let score = evalPosition(sim.orbs, sim.owner, AI);
        if (deep && score < 1e6) {
          const oppMoves = legalMoves(sim.owner, YOU);
          let oppBest = -Infinity;
          for (const oi of oppMoves) {
            const sim2 = simulateMove(sim.orbs, sim.owner, oi, YOU);
            const oscore = evalPosition(sim2.orbs, sim2.owner, YOU);
            if (oscore > oppBest) oppBest = oscore;
          }
          if (oppMoves.length) score -= oppBest * 0.6;
        }
        if (score > bestScore) { bestScore = score; best = i; }
      }
      return best;
    }

    function aiTurn() {
      timer = null;
      if (done || busy || turn !== AI) return;
      const i = chooseAiMove();
      if (i == null) return;
      place(Math.floor(i / COLS), i % COLS, AI);
    }

    function finish(winner) {
      done = true; busy = false;
      const cc = counts();
      const res = mode === '1p' && winner != null ? api.submit(winner === YOU ? cc.y : 0) : null;
      const title = winner == null
        ? 'Floor saturated. Nobody controls it all.'
        : mode === '2p'
          ? (winner === YOU ? 'Player 1 wins.' : 'Player 2 wins.')
          : (winner === YOU ? 'You win.' : 'CPU wins.');
      if (winner == null) api.sfx.blip(300);
      else (winner === YOU || mode === '2p' ? api.sfx.great : api.sfx.bad)();
      render();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, title),
        h('p', null, 'Tickets held: you ' + cc.y + ', ' + (mode === '2p' ? 'P2 ' : 'CPU ') + cc.a + '.' +
          (res && res.isRecord ? ' New best.' : '')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'New game'));
    }

    function render() {
      const cc = counts();
      pYou.textContent = (mode === '2p' ? 'P1: ' : 'You: ') + cc.y;
      pAi.textContent = (mode === '2p' ? 'P2: ' : 'CPU: ') + cc.a;
      const clickable = !done && !busy && (mode === '2p' || turn === YOU);
      for (let i = 0; i < N; i++) {
        const own = owner[i];
        const canClick = clickable && (own === 0 || own === turn);
        cells[i].className = 'cell esc-cell' +
          (own === YOU ? ' esc-you' : own === AI ? ' esc-ai' : '') +
          (canClick ? ' hint' : '') +
          (orbs[i] >= CAP[i] - 1 && orbs[i] > 0 ? ' esc-hot' : '');
        cells[i].firstChild.textContent = orbs[i] > 0 ? String(orbs[i]) : '';
      }
    }

    /* headless testability seam, matching window.__vp / window.__deskfit */
    window.__escalate = {
      state() { return { orbs: Array.from(orbs), owner: Array.from(owner), turn, done, busy, movesMade, rows: ROWS, cols: COLS }; },
      place(r, c) { if (done || busy) return false; place(r, c, turn); return true; }
    };
    bagg.add(() => { if (window.__escalate) delete window.__escalate; });

    reset();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'escalate',
    title: 'Escalate',
    emoji: 'escalate',
    cat: 'brain',
    order: 34,
    blurb: 'A ticket queue that overflows onto neighboring desks. Stack tickets on your own desks; overload one and it dumps a ticket on every neighbor, converting them to you.',
    scoreLabel: 'Tickets held',
    lightBoard: true,   // doc mode authors its own paper/ink cells (see arcade.css) — the counter-invert trick can't reach true black
    tags: ['chain-reaction', 'territory', 'vs-cpu', 'hotseat', 'grid'],
    how: [
      'Click any empty desk, or one you already hold, to add a ticket. Every desk has a capacity based on how many neighbors it has: 2 in a corner, 3 on an edge, 4 in the open floor.',
      'Add a ticket that pushes a desk to its capacity and it overflows — it empties out and dumps one ticket on each neighboring desk, converting every one of them to you, no matter who held it.',
      'A single overflow can trigger the next one and the next, cascading across the floor in one turn.',
      'Once both sides have moved at least once, the moment your opponent holds zero tickets anywhere, they are out and you win the floor.',
      'Set Players to 2 for hotseat on one screen. The difficulty dial only tunes the CPU’s foresight, so it does nothing in two-player.'
    ],
    mount
  });
})();
