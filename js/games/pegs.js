/* Peg Solitaire — jump pegs to clear the board down to one. */
(function () {
  'use strict';
  const { h } = Engine;
  const N = 7;
  const valid = (r, c) => !((r < 2 || r > 4) && (c < 2 || c > 4));

  function mount(root, api) {
    const bagg = Engine.bag();
    let cell, sel, over, best;

    const pLeft = api.pill('pegs: 0');
    const pBest = api.pill('best: —');
    const msg = h('div', { class: 'peg-msg' }, '');
    const grid = h('div', { class: 'peg-grid' });
    const els = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const el = valid(r, c)
        ? h('button', { class: 'peg-hole', type: 'button', onclick: () => tap(r * N + c) })
        : h('div', { class: 'peg-void' });
      els.push(el); grid.appendChild(el);
    }
    root.appendChild(h('div', { class: 'pegs' }, msg, grid));
    api.button('New board', reset);

    function reset() {
      cell = new Array(N * N).fill(-1);
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (valid(r, c)) cell[r * N + c] = 1;
      cell[3 * N + 3] = 0;
      sel = -1; over = false;
      msg.textContent = 'Jump a peg over a neighbour into an empty hole. Aim for one peg left.'; msg.className = 'peg-msg';
      render();
      api.status('Tap a peg, then tap an empty hole two spaces away with a peg between. The jumped peg is removed. Clear down to a single peg.');
    }
    function count() { return cell.reduce((a, v) => a + (v === 1 ? 1 : 0), 0); }
    function render() {
      for (let i = 0; i < cell.length; i++) {
        if (cell[i] === -1) continue;
        els[i].className = 'peg-hole' + (cell[i] === 1 ? ' peg' : '') + (i === sel ? ' sel' : '');
      }
      pLeft.textContent = 'pegs: ' + count();
      const b = api.best(); pBest.textContent = 'best: ' + (b == null ? '—' : b);
    }
    function jumps(i) {
      const r = Math.floor(i / N), c = i % N, out = [];
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const mr = r + dr, mc = c + dc, tr = r + 2 * dr, tc = c + 2 * dc;
        if (valid(tr, tc) && cell[mr * N + mc] === 1 && cell[tr * N + tc] === 0) out.push([mr * N + mc, tr * N + tc]);
      }
      return out;
    }
    function anyMove() {
      for (let i = 0; i < cell.length; i++) if (cell[i] === 1 && jumps(i).length) return true;
      return false;
    }
    function tap(i) {
      if (over) return;
      if (cell[i] === 1) { sel = (sel === i ? -1 : i); api.sfx.click(); render(); return; }
      if (cell[i] === 0 && sel >= 0) {
        const move = jumps(sel).find((m) => m[1] === i);
        if (!move) { api.sfx.thud(); return; }
        cell[sel] = 0; cell[move[0]] = 0; cell[i] = 1; sel = -1; api.sfx.blip(500); render();
        const n = count();
        if (n === 1) { over = true; api.sfx.great(); api.submit(1); msg.textContent = 'One peg left. Perfect solve!'; msg.className = 'peg-msg win'; return; }
        if (!anyMove()) { over = true; api.sfx.bad(); api.submit(n); msg.textContent = 'No moves left with ' + n + ' pegs. Try again.'; msg.className = 'peg-msg lose'; }
      }
    }

    reset();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'pegs', title: 'Peg Solitaire', emoji: 'lightsout', cat: 'puzzle', order: 21,
    lowerIsBetter: true,
    blurb: 'The wooden peg board from every waiting room. Jump pegs over each other to remove them and try to finish with a single peg standing.',
    scoreLabel: 'Fewest left', tags: ['puzzle', 'classic', 'solitaire'],
    how: [
      'Tap a peg to select it, then tap an empty hole two spaces away.',
      'The peg jumps a neighbour into the hole, and the jumped peg is removed.',
      'Keep jumping until no moves remain.',
      'Fewer pegs left is better. One peg is a perfect solve.'
    ],
    mount
  });
})();
