/* Reversi. Flank the light discs and flip them dark. */
(function () {
  'use strict';
  const { h } = Engine;
  const N = 8, YOU = 1, AI = 2;
  const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const BLUNDER = { chill: 0.5, normal: 0.25, hard: 0.05, nightmare: 0 };
  const WEIGHTS = [
    [120, -20, 20, 5, 5, 20, -20, 120],
    [-20, -40, -5, -5, -5, -5, -40, -20],
    [20, -5, 15, 3, 3, 15, -5, 20],
    [5, -5, 3, 3, 3, 3, -5, 5],
    [5, -5, 3, 3, 3, 3, -5, 5],
    [20, -5, 15, 3, 3, 15, -5, 20],
    [-20, -40, -5, -5, -5, -5, -40, -20],
    [120, -20, 20, 5, 5, 20, -20, 120]
  ];

  function mount(root, api) {
    const bagg = Engine.bag();
    let b, turn, done, busy, timer, mode = '1p';

    const pYou = api.pill('You: 2');
    const pAi = api.pill('CPU: 2');
    const board = h('div', { class: 'board rev', style: { gridTemplateColumns: 'repeat(8, auto)' } });
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    const cells = [];
    for (let i = 0; i < N * N; i++) {
      const el = h('button', { class: 'cell', type: 'button' });
      const r = Math.floor(i / N), c = i % N;
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
    const sideName = (who) => (who === YOU ? 'dark (P1)' : 'light (P2)');
    bagg.add(() => { if (timer) clearTimeout(timer); });

    /* play-by-paste correspondence */
    const flatBoard = () => { const a = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) a.push(b[r][c]); return a; };
    function loadPosition(res) {
      let k = 0;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) b[r][c] = res.cells[k++];
      mode = '2p'; turn = res.extra ? AI : YOU; done = false; busy = false;
      if (!legal(YOU).length && !legal(AI).length) { finish(); return; }
      if (!legal(turn).length) turn = turn === YOU ? AI : YOU;
      banner.style.display = 'none';
      api.status('Loaded. You are ' + (turn === YOU ? 'dark' : 'light') + ' — click a glowing square, then Share the new code back.');
      render();
    }
    const codeInput = h('input', { type: 'text', class: 'boss-url', placeholder: 'move code', spellcheck: 'false', style: { width: '150px' } });
    api.toolbar.appendChild(codeInput);
    api.button('Share code', () => {
      mode = '2p';
      codeInput.value = Engine.packCode('RV', flatBoard(), turn === YOU ? 0 : 1);
      codeInput.select();
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(codeInput.value).catch(function () { }); } catch (e) { /* ignore */ }
      api.status('Move code ready — send it over. Your opponent pastes it and presses Load.');
    });
    api.button('Load code', () => {
      const res = Engine.unpackCode('RV', codeInput.value, N * N);
      if (!res) { api.status('That code did not scan — paste the whole thing.'); return; }
      loadPosition(res);
    });

    function reset() {
      b = [];
      for (let r = 0; r < N; r++) b.push(new Array(N).fill(0));
      b[3][3] = AI; b[3][4] = YOU; b[4][3] = YOU; b[4][4] = AI;
      turn = YOU; done = false; busy = false;
      banner.style.display = 'none';
      api.status(mode === '2p'
        ? 'Hotseat: Player 1 is dark, Player 2 is light. Click a glowing square to move.'
        : 'You are the dark discs. Legal squares glow — click one to trap a run of light discs and flip it.');
      render();
    }

    const inb = (r, c) => r >= 0 && c >= 0 && r < N && c < N;

    function flips(r, c, who) {
      if (b[r][c]) return [];
      const opp = who === YOU ? AI : YOU, out = [];
      for (const d of DIRS) {
        const line = [];
        let rr = r + d[0], cc = c + d[1];
        while (inb(rr, cc) && b[rr][cc] === opp) { line.push([rr, cc]); rr += d[0]; cc += d[1]; }
        if (line.length && inb(rr, cc) && b[rr][cc] === who) for (const p of line) out.push(p);
      }
      return out;
    }

    function legal(who) {
      const mv = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const f = flips(r, c, who);
        if (f.length) mv.push({ r, c, f });
      }
      return mv;
    }

    function apply(r, c, who, f) { b[r][c] = who; for (const p of f) b[p[0]][p[1]] = who; }

    function counts() {
      let y = 0, a = 0;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (b[r][c] === YOU) y++; else if (b[r][c] === AI) a++;
      }
      return { y, a };
    }

    function human(r, c) {
      if (done || busy) return;
      const who = turn;
      if (mode === '1p' && who !== YOU) return;
      const f = flips(r, c, who);
      if (!f.length) return;
      apply(r, c, who, f);
      if (who === YOU) api.sfx.click(); else api.sfx.blip(300);
      render();
      handoff(who === YOU ? AI : YOU);
    }

    function handoff(next) {
      turn = next;
      if (!legal(YOU).length && !legal(AI).length) return finish();
      if (mode === '2p') {
        /* both sides human: if the next player is stuck, pass back automatically */
        if (!legal(next).length) {
          api.status('No move for ' + sideName(next) + ' — turn passes.');
          turn = next === YOU ? AI : YOU;
        }
        busy = false;
        render();
        return;
      }
      if (next === AI) {
        busy = true;
        render();
        timer = setTimeout(aiTurn, 300);
      } else {
        busy = false;
        if (!legal(YOU).length) { api.status('No move for you — the CPU plays on.'); handoff(AI); }
        else render();
      }
    }

    function aiTurn() {
      timer = null;
      const mv = legal(AI);
      if (!mv.length) { handoff(YOU); return; }
      const m = choose(mv);
      apply(m.r, m.c, AI, m.f);
      api.sfx.blip(300);
      render();
      handoff(YOU);
    }

    function choose(mv) {
      const bl = BLUNDER[api.diffId];
      if (Math.random() < (bl === undefined ? 0.2 : bl)) return mv[Math.floor(Math.random() * mv.length)];
      let pick = mv[0], hi = -1e9;
      for (const m of mv) {
        const s = WEIGHTS[m.r][m.c] + m.f.length;
        if (s > hi) { hi = s; pick = m; }
      }
      return pick;
    }

    function finish() {
      done = true; busy = false;
      const cc = counts();
      const res = mode === '1p' ? api.submit(cc.y) : null;
      const title = cc.y > cc.a
        ? (mode === '2p' ? 'Player 1 (dark) wins.' : 'You win.')
        : cc.y < cc.a
          ? (mode === '2p' ? 'Player 2 (light) wins.' : 'CPU wins.')
          : 'Dead even.';
      (cc.y > cc.a ? api.sfx.great : api.sfx.bad)();
      render();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, title),
        h('p', null, 'Dark ' + cc.y + ', light ' + cc.a + '.' + (res && res.isRecord ? ' Most discs yet!' : '')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Play again'));
    }

    function render() {
      const cc = counts();
      pYou.textContent = (mode === '2p' ? 'Dark P1: ' : 'You: ') + cc.y;
      pAi.textContent = (mode === '2p' ? 'Light P2: ' : 'CPU: ') + cc.a;
      const humanTurn = !done && !busy && (mode === '2p' || turn === YOU);
      const hints = humanTurn ? legal(turn) : [];
      const hintSet = new Set(hints.map((m) => m.r * N + m.c));
      for (let i = 0; i < N * N; i++) {
        const r = Math.floor(i / N), c = i % N;
        cells[i].className = 'cell' +
          (b[r][c] === YOU ? ' d' : b[r][c] === AI ? ' l' : '') +
          (hintSet.has(i) ? ' hint' : '');
      }
    }

    reset();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'reversi',
    title: 'Reversi',
    emoji: 'reversi',
    cat: 'brain',
    order: 27,
    blurb: 'Othello on an 8x8 board. Trap a straight line of light discs between two of your dark ones and the whole line flips to dark. Corners decide most games.',
    scoreLabel: 'Most discs',
    tags: ['othello', 'reversi', 'vs-cpu'],
    how: [
      'You play the dark discs. Legal squares glow, so click one.',
      'Your disc flips every straight run of light discs pinned between it and another dark disc, in all directions at once.',
      'With no legal move your turn passes automatically. Corners can never be flipped back, so they are worth the most.',
      'When neither side can move, whoever has more discs wins.',
      'Set Players to 2 for hotseat, Player 1 dark and Player 2 light on one screen. The difficulty dial only tunes the CPU, so it does nothing in two-player.'
    ],
    mount
  });
})();
