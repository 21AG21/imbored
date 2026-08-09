/* Mancala (Kalah) — sow the stones, land in your own store to go again,
   finish in an empty pit on your side to capture across. Beat the deskmate. */
(function () {
  'use strict';
  const { h, clamp, pick } = Engine;
  /* board: 0..5 your pits, 6 your store, 7..12 cpu pits, 13 cpu store.
     Sowing runs 0->1->...->13->0, each side skipping the other's store. */
  const YOU_STORE = 6, CPU_STORE = 13;

  function mount(root, api) {
    const bagg = Engine.bag();
    let board, turn, over, busy, disposed = false;

    const pScore = api.pill('you 0 · 0 cpu');
    const pTurn = api.pill('your move');
    const msg = h('div', { class: 'mc-msg' }, '');
    const cpuRow = h('div', { class: 'mc-row mc-cpu' });
    const youRow = h('div', { class: 'mc-row mc-you' });
    const youStore = h('div', { class: 'mc-store', title: 'your store' });
    const cpuStore = h('div', { class: 'mc-store', title: 'deskmate store' });
    const pitEls = new Array(14);
    root.appendChild(h('div', { class: 'mancala' },
      msg,
      h('div', { class: 'mc-board' },
        cpuStore,
        h('div', { class: 'mc-mid' }, cpuRow, youRow),
        youStore)));
    api.button('New game', reset);

    function reset() {
      board = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
      turn = 1; over = false; busy = false;
      msg.textContent = 'Pick one of your pits (the bottom row).'; msg.className = 'mc-msg';
      build(); paint(); sync();
      api.status('Tap one of your pits along the bottom. Stones drop one per pit going right and around. Land your last stone in your store (right side) to move again; land in one of your own empty pits to capture the stones across from it. Most stones when a side empties out wins.');
    }

    function build() {
      cpuRow.replaceChildren(); youRow.replaceChildren();
      // cpu row shown left-to-right as pits 12..7 (mirrors the sowing direction)
      for (let i = 12; i >= 7; i--) pitEls[i] = mkPit(i, false);
      for (let i = 12; i >= 7; i--) cpuRow.appendChild(pitEls[i]);
      for (let i = 0; i <= 5; i++) { pitEls[i] = mkPit(i, true); youRow.appendChild(pitEls[i]); }
    }
    function mkPit(i, mine) {
      const b = h('button', { class: 'mc-pit' + (mine ? ' mine' : ''), type: 'button' });
      if (mine) bagg.listen(b, 'click', () => humanMove(i));
      else b.disabled = true;
      return b;
    }

    function sideEmpty(who) {
      if (who === 1) { for (let i = 0; i <= 5; i++) if (board[i]) return false; return true; }
      for (let i = 7; i <= 12; i++) if (board[i]) return false; return true;
    }
    function legal(who) {
      const out = [];
      if (who === 1) { for (let i = 0; i <= 5; i++) if (board[i]) out.push(i); }
      else { for (let i = 7; i <= 12; i++) if (board[i]) out.push(i); }
      return out;
    }

    /* sow from pit `start` for player `who` on array `bd`; returns {last, again} */
    function sow(bd, start, who) {
      let n = bd[start]; bd[start] = 0; let i = start;
      const skip = who === 1 ? CPU_STORE : YOU_STORE;
      while (n > 0) { i = (i + 1) % 14; if (i === skip) continue; bd[i]++; n--; }
      const myStore = who === 1 ? YOU_STORE : CPU_STORE;
      let again = i === myStore;
      // capture: last stone in own previously-empty pit, opposite has stones
      const ownPit = who === 1 ? (i >= 0 && i <= 5) : (i >= 7 && i <= 12);
      if (!again && ownPit && bd[i] === 1) {
        const opp = 12 - i;
        if (bd[opp] > 0) { bd[myStore] += bd[opp] + 1; bd[opp] = 0; bd[i] = 0; return { last: i, again, capture: true }; }
      }
      return { last: i, again, capture: false };
    }

    function sweepIfDone(bd) {
      const yE = [0, 1, 2, 3, 4, 5].every((i) => !bd[i]);
      const cE = [7, 8, 9, 10, 11, 12].every((i) => !bd[i]);
      if (yE || cE) {
        for (let i = 0; i <= 5; i++) { bd[YOU_STORE] += bd[i]; bd[i] = 0; }
        for (let i = 7; i <= 12; i++) { bd[CPU_STORE] += bd[i]; bd[i] = 0; }
        return true;
      }
      return false;
    }

    function humanMove(i) {
      if (over || busy || turn !== 1 || !board[i]) { if (!over) api.sfx.bad(); return; }
      const res = sow(board, i, 1);
      api.sfx[res.capture ? 'good' : 'click']();
      paint(); sync();
      if (sweepIfDone(board)) { paint(); return finish(); }
      if (res.again) { pTurn.textContent = 'go again'; return; }
      turn = 2; paint(); sync(); busy = true; setTimeout(cpuTurn, 480);   // repaint disables pits during the deskmate's think-time
    }

    function cpuTurn() {
      if (over || disposed) return;
      if (turn !== 2) { busy = false; return; }
      const moves = legal(2);
      if (!moves.length) { sweepIfDone(board); paint(); return finish(); }
      const move = chooseCpu(moves);
      const res = sow(board, move, 2);
      api.sfx[res.capture ? 'great' : 'blip'](res.capture ? undefined : 300);
      paint(); sync();
      if (sweepIfDone(board)) { paint(); busy = false; return finish(); }
      if (res.again && !sideEmpty(2)) { setTimeout(cpuTurn, 480); return; }
      turn = 1; busy = false; paint(); sync();   // paint re-enables the player's pits (turn flipped back)
      pTurn.textContent = 'your move';
    }

    /* look one move ahead, valuing store gain, extra turns and captures; a
       difficulty-scaled slice of the time it just plays a random legal pit */
    function chooseCpu(moves) {
      const sloppy = clamp(0.55 - api.dm * 0.24, 0, 0.5);
      if (Math.random() < sloppy) return pick(moves);
      let best = moves[0], bestScore = -1e9;
      for (const m of moves) {
        const bd = board.slice();
        const res = sow(bd, m, 2);
        let sc = bd[CPU_STORE] - board[CPU_STORE];       // stones banked
        if (res.again) sc += 2.2;                        // free move
        if (res.capture) sc += 1.5;
        // discourage leaving a fat capture for the human next turn
        let humanBest = 0;
        for (let hi = 0; hi <= 5; hi++) {
          if (!bd[hi]) continue;
          const t = bd.slice(); const hr = sow(t, hi, 1);
          humanBest = Math.max(humanBest, t[YOU_STORE] - bd[YOU_STORE] + (hr.again ? 1 : 0));
        }
        sc -= humanBest * 0.8;
        sc += Math.random() * 0.4;
        if (sc > bestScore) { bestScore = sc; best = m; }
      }
      return best;
    }

    function dots(n) {
      // a compact stone cluster; cap the drawn dots, always show the number
      const wrap = h('span', { class: 'mc-stones' });
      const shown = Math.min(n, 12);
      for (let k = 0; k < shown; k++) wrap.appendChild(h('i'));
      return wrap;
    }
    function paint() {
      for (let i = 0; i < 14; i++) {
        if (i === YOU_STORE || i === CPU_STORE) continue;
        const el = pitEls[i]; if (!el) continue;
        el.replaceChildren(dots(board[i]), h('b', { class: 'mc-num' }, String(board[i])));
        el.classList.toggle('empty', board[i] === 0);
        if (el.classList.contains('mine')) el.disabled = over || turn !== 1 || board[i] === 0;
      }
      youStore.replaceChildren(h('b', null, String(board[YOU_STORE])), h('span', { class: 'mc-slab' }, 'you'));
      cpuStore.replaceChildren(h('b', null, String(board[CPU_STORE])), h('span', { class: 'mc-slab' }, 'them'));
    }
    function sync() {
      pScore.textContent = 'you ' + board[YOU_STORE] + ' · ' + board[CPU_STORE] + ' cpu';
      pTurn.textContent = over ? '' : turn === 1 ? 'your move' : 'deskmate…';
    }
    function finish() {
      over = true; sync();
      const you = board[YOU_STORE], them = board[CPU_STORE];
      if (you > them) {
        api.sfx.great();
        const w = api.load('wins', 0) + 1; api.save('wins', w); api.submit(w);
        msg.textContent = 'You win ' + you + '–' + them + '.'; msg.className = 'mc-msg win';
        try { const r = msg.getBoundingClientRect(); Engine.fx.burst(r.left + r.width / 2, r.top + 20, 44); } catch (e) { /* ignore */ }
      } else if (you < them) {
        api.sfx.bad();
        msg.textContent = 'Deskmate wins ' + them + '–' + you + '. Rematch?'; msg.className = 'mc-msg lose';
      } else {
        api.sfx.thud();
        msg.textContent = 'Dead even, ' + you + '–' + them + '.'; msg.className = 'mc-msg';
      }
    }

    reset();
    return () => { disposed = true; bagg.dispose(); };
  }

  Arcade.register({
    id: 'mancala', title: 'Desk Mancala', emoji: 'mancala', cat: 'brain', order: 25,
    blurb: 'The count-and-capture board game, versus a deskmate. Sow your pits, chain extra turns by landing in your store, and capture across an empty pit. Most stones wins.',
    scoreLabel: 'Wins', tags: ['strategy', 'board', 'vs cpu', 'classic'],
    how: [
      'Tap one of your six pits along the bottom. Its stones drop one at a time into the pits to the right, going around the board.',
      'Land your last stone in your store (the big pit on your right) and you take another turn.',
      'Land your last stone in one of your own empty pits and you capture it plus every stone in the pit directly across.',
      'When either side runs out of pits, each player banks the stones on their own side. Most stones in your store wins.'
    ],
    mount
  });
})();
