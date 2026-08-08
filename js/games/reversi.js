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
    let b, turn, done, busy, timer;

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
    bagg.add(() => { if (timer) clearTimeout(timer); });

    function reset() {
      b = [];
      for (let r = 0; r < N; r++) b.push(new Array(N).fill(0));
      b[3][3] = AI; b[3][4] = YOU; b[4][3] = YOU; b[4][4] = AI;
      turn = YOU; done = false; busy = false;
      banner.style.display = 'none';
      api.status('You are the dark discs. Legal squares glow — click one to trap a run of light discs and flip it.');
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
      if (done || busy || turn !== YOU) return;
      const f = flips(r, c, YOU);
      if (!f.length) return;
      apply(r, c, YOU, f);
      api.sfx.click();
      render();
      handoff(AI);
    }

    function handoff(next) {
      turn = next;
      if (!legal(YOU).length && !legal(AI).length) return finish();
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
      const res = api.submit(cc.y);
      const title = cc.y > cc.a ? 'You win.' : cc.y < cc.a ? 'CPU wins.' : 'Dead even.';
      (cc.y > cc.a ? api.sfx.great : api.sfx.bad)();
      render();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, title),
        h('p', null, 'Dark ' + cc.y + ', light ' + cc.a + '.' + (res.isRecord ? ' Most discs yet!' : '')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Play again'));
    }

    function render() {
      const cc = counts();
      pYou.textContent = 'You: ' + cc.y;
      pAi.textContent = 'CPU: ' + cc.a;
      const hints = (turn === YOU && !done && !busy) ? legal(YOU) : [];
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
    blurb: 'Othello, the boardroom classic. Trap a straight line of light discs between two dark ones and the whole line switches sides. Corners decide everything.',
    scoreLabel: 'Most discs',
    tags: ['othello', 'reversi', 'vs-cpu'],
    how: [
      'You are the dark discs. Legal squares glow.',
      'Placing a disc flips every straight run of light discs pinned between it and another dark disc.',
      'If you have no legal move, your turn is passed automatically.',
      'When neither side can move, the most discs wins. Fight for the corners.'
    ],
    mount
  });
})();
