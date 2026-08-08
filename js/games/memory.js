/* Memory Match. Flip two, keep the pairs. Always winnable, no way to get stuck. */
(function () {
  'use strict';
  const { h, shuffle } = Engine;

  const FACES = ['gridlock', 'coffee', 'snake', 'atc', 'powergrid', 'jam', 'pipes', 'reflex',
    'solitaire', 'deskgolf', 'connect4', 'sokoban', 'copycat', 'whack', 'lightsout', 'desktoss',
    'elevator', 'tetris'];

  const SIZES = {
    chill: { cols: 4, rows: 3, label: '6 pairs' },
    normal: { cols: 4, rows: 4, label: '8 pairs' },
    hard: { cols: 6, rows: 4, label: '12 pairs' },
    nightmare: { cols: 6, rows: 6, label: '18 pairs' }
  };

  function mount(root, api) {
    const bagg = Engine.bag();
    const cfg = SIZES[api.diffId] || SIZES.normal;
    const pairs = cfg.cols * cfg.rows / 2;

    let deck, first, busy, matched, moves, startedAt, done, tick;

    const pMoves = api.pill('Moves: 0');
    const pPairs = api.pill('');
    const pTime = api.pill('0:00');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });

    const board = h('div', { class: 'mem-board', style: { gridTemplateColumns: 'repeat(' + cfg.cols + ', 1fr)' } });
    root.append(board, banner);

    function start() {
      const chosen = shuffle(FACES).slice(0, pairs);
      deck = shuffle(chosen.concat(chosen)).map((face, i) => ({ face, i, matched: false }));
      first = null; busy = false; matched = 0; moves = 0; done = false;
      startedAt = Date.now();
      banner.style.display = 'none';
      render();
      api.status('Flip two cards. If they match they stay up. Find every pair.');
    }

    function render() {
      board.replaceChildren();
      deck.forEach((card, i) => {
        const el = h('button', {
          class: 'mem-card', type: 'button',
          onclick: () => flip(i)
        },
          h('span', { class: 'mem-inner' },
            h('span', { class: 'mem-face mem-back' }),
            h('span', { class: 'mem-face mem-front', html: Icons.svg(card.face, 46) })));
        card.el = el;
        board.appendChild(el);
      });
    }

    function flip(i) {
      if (busy || done) return;
      const card = deck[i];
      if (card.matched || card === first) return;
      card.el.classList.add('flipped');
      api.sfx.blip(520);

      if (!first) { first = card; return; }

      moves++;
      pMoves.textContent = 'Moves: ' + moves;

      if (first.face === card.face) {
        first.matched = card.matched = true;
        first.el.classList.add('matched');
        card.el.classList.add('matched');
        first = null;
        matched++;
        api.sfx.good();
        if (matched === pairs) win();
      } else {
        busy = true;
        const a = first, b = card;
        first = null;
        setTimeout(() => {
          a.el.classList.remove('flipped');
          b.el.classList.remove('flipped');
          busy = false;
        }, 720);
        api.sfx.thud();
      }
    }

    function win() {
      done = true;
      const secs = Math.round((Date.now() - startedAt) / 1000);
      /* fewer moves is better; a perfect game is one move per pair */
      const best = api.load('best:' + cfg.cols + 'x' + cfg.rows, null);
      const record = best == null || moves < best;
      if (record) api.save('best:' + cfg.cols + 'x' + cfg.rows, moves);
      const wins = api.load('wins', 0) + 1;
      api.save('wins', wins);
      api.submit(wins);
      api.sfx.great();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'All matched.'),
        h('p', null, pairs + ' pairs in ' + moves + ' moves and ' + Engine.fmtTime(secs) + '. ' +
          (record ? 'Fewest moves yet on this size.' : 'Best on this size: ' + best + ' moves.')),
        h('button', { class: 'btn primary', type: 'button', onclick: start }, 'Shuffle again'));
    }

    api.button('New game', start);
    pPairs.textContent = cfg.label;

    tick = setInterval(() => {
      if (!startedAt || done) return;
      pTime.textContent = Engine.fmtTime((Date.now() - startedAt) / 1000);
    }, 500);
    bagg.add(() => clearInterval(tick));

    start();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'memory',
    title: 'Memory Match',
    emoji: 'memory',
    cat: 'brain',
    order: 26,
    blurb: 'Flip two cards, keep the pairs that match. Calm, quick, and impossible to lose. Just try to do it in fewer moves.',
    scoreLabel: 'Games won',
    tags: ['memory', 'pairs', 'concentration', 'cards'],
    how: [
      'Tap a card to flip it, then tap a second one.',
      'A matching pair stays face up. A mismatch flips both back down.',
      'Find every pair to win. You cannot lose, so the goal is to do it in as few moves as possible.',
      'Your fewest-moves record is kept for each board size.',
      'The difficulty dial only changes the board size: 6 pairs on Chill up to 18 on Nightmare.'
    ],
    mount
  });
})();
