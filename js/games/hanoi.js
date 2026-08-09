/* Tower of Hanoi — move the stack, never a big disk on a small one. */
(function () {
  'use strict';
  const { h } = Engine;

  function mount(root, api) {
    const bagg = Engine.bag();
    let N = Engine.clamp(Math.round(2 + api.dm * 1.6), 3, 6), n = N, pegs = [[], [], []], moves = 0, sel = null, over = false;   // opening disk count from difficulty

    const pMoves = api.pill('moves: 0');
    const pMin = api.pill('best: —');
    const pegEls = [0, 1, 2].map((i) => {
      const pe = h('div', { class: 'hn-peg' });
      pe.addEventListener('click', () => pick(i));
      return pe;
    });
    const board = h('div', { class: 'hanoi' }, pegEls.map((pe) => h('div', { class: 'hn-slot' }, pe)));
    const msg = h('div', { class: 'hn-msg' }, '');
    root.appendChild(h('div', { class: 'hanoi-wrap' }, board, msg));

    api.select('Disks', [3, 4, 5, 6].map((v) => ({ value: String(v), label: v + ' disks' })), String(N), (v) => { N = +v; reset(); });
    api.button('Restart', reset);

    function reset() {
      n = N; pegs = [[], [], []];
      for (let i = n; i >= 1; i--) pegs[0].push(i);
      moves = 0; sel = null; over = false;
      msg.textContent = 'Move the whole stack to the right peg in as few moves as you can.'; msg.className = 'hn-msg';
      render(); sync();
      api.status('Click a peg to lift its top disk, click another peg to drop it. A bigger disk can never sit on a smaller one. Minimum here is ' + ((1 << n) - 1) + ' moves.');
    }
    function sync() {
      pMoves.textContent = 'moves: ' + moves;
      const b = api.best(); pMin.textContent = 'best: ' + (b == null ? '—' : b);
    }
    function render() {
      pegEls.forEach((pe, pi) => {
        pe.className = 'hn-peg' + (sel === pi ? ' sel' : '');
        const stack = h('div', { class: 'hn-stack' });
        for (let k = pegs[pi].length - 1; k >= 0; k--) {
          const size = pegs[pi][k];
          stack.appendChild(h('div', { class: 'hn-disk d' + size, style: { width: (28 + size * 13) + 'px' } }, ''));
        }
        pe.replaceChildren(h('div', { class: 'hn-rod' }), stack);
      });
    }
    function pick(pi) {
      if (over) return;
      if (sel === null) {
        if (!pegs[pi].length) { api.sfx.thud(); return; }
        sel = pi; api.sfx.click(); render(); return;
      }
      if (sel === pi) { sel = null; render(); return; }
      const from = pegs[sel], to = pegs[pi];
      const disk = from[from.length - 1];
      if (to.length && to[to.length - 1] < disk) {
        api.sfx.bad(); msg.textContent = 'A bigger disk cannot go on a smaller one.'; msg.className = 'hn-msg lose';
        sel = null; render(); return;
      }
      to.push(from.pop()); moves++; sel = null; api.sfx.blip(520);
      msg.textContent = ''; msg.className = 'hn-msg';
      render(); sync();
      if (pegs[2].length === n) win();
    }
    function win() {
      over = true; api.sfx.great();
      const min = (1 << n) - 1;
      const r = api.submit(moves);
      msg.textContent = 'Solved in ' + moves + ' move' + (moves === 1 ? '' : 's') +
        (moves === min ? ' — perfect!' : ' (best possible: ' + min + ')') + '.' + (r.isRecord ? ' New record!' : '');
      msg.className = 'hn-msg win'; sync();
    }

    reset();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'hanoi', title: 'Tower of Hanoi', emoji: 'stack', cat: 'puzzle', order: 20,
    lowerIsBetter: true,
    blurb: 'The classic disk-stacking puzzle, restyled as ring binders. Move the stack one binder at a time, never a big one on a small one.',
    scoreLabel: 'Fewest moves', tags: ['puzzle', 'classic', 'logic'],
    how: [
      'Click a peg to lift its top disk, then click another peg to drop it.',
      'A larger disk can never sit on a smaller one.',
      'Move the whole stack from the left peg to the right peg.',
      'Fewer moves is better. The minimum is 2^disks minus 1.'
    ],
    mount
  });
})();
