/* Higher or Lower — one card down, guess the next, ride the streak. */
(function () {
  'use strict';
  const { h, randInt } = Engine;
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const SUITS = ['♠', '♥', '♦', '♣'];

  function mount(root, api) {
    const bagg = Engine.bag();
    let streak = 0, over = false, cur = null, disposed = false;

    const pStreak = api.pill('streak: 0');
    const cardEl = h('div', { class: 'hl-card' });
    const nextEl = h('div', { class: 'hl-card back' }, '?');
    const msg = h('div', { class: 'hl-msg' }, 'Higher or lower than this card?');
    const loBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => guess(-1) }, '▼ Lower');
    const hiBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => guess(1) }, '▲ Higher');
    root.appendChild(h('div', { class: 'hilo' },
      h('div', { class: 'hl-cards' }, cardEl, nextEl),
      msg,
      h('div', { class: 'hl-btns' }, loBtn, hiBtn)));
    api.button('New run', reset);

    const draw = () => ({ r: randInt(0, 12), s: randInt(0, 3) });
    function paint(el, c, faceUp) {
      if (!faceUp) { el.className = 'hl-card back'; el.textContent = '?'; return; }
      el.className = 'hl-card' + (c.s === 1 || c.s === 2 ? ' red' : '');
      el.replaceChildren(h('span', { class: 'hl-rank' }, RANKS[c.r]), h('span', { class: 'hl-suit' }, SUITS[c.s]));
    }
    function busy(b) { hiBtn.disabled = b; loBtn.disabled = b; }
    function sync() { pStreak.textContent = 'streak: ' + streak; }

    function reset() {
      streak = 0; over = false; cur = draw();
      paint(cardEl, cur, true); paint(nextEl, null, false);
      msg.textContent = 'Higher or lower than this card?'; msg.className = 'hl-msg';
      busy(false); sync();
      api.status('Guess whether the next card is higher or lower. Equal rank counts as a win. Ride the streak.');
    }
    function guess(dir) {
      if (over) return;
      busy(true);
      const nxt = draw();
      paint(nextEl, nxt, true);
      const cmp = nxt.r === cur.r ? 0 : (nxt.r > cur.r ? 1 : -1);
      if (cmp === 0 || cmp === dir) {
        streak++; api.sfx.good(); sync();
        const r = api.submit(streak);
        msg.textContent = 'Correct! Streak ' + streak + '.' + (r.isRecord ? ' Best yet!' : '');
        msg.className = 'hl-msg win';
        setTimeout(() => {
          if (disposed || over) return;
          cur = nxt; paint(cardEl, cur, true); paint(nextEl, null, false);
          msg.textContent = 'Higher or lower?'; msg.className = 'hl-msg'; busy(false);
        }, 700);
      } else {
        over = true; streak = 0; api.sfx.bad(); sync();
        msg.textContent = 'Wrong — the run ends there. Tap New run.'; msg.className = 'hl-msg lose';
      }
    }

    reset();
    return () => { disposed = true; bagg.dispose(); };
  }

  Arcade.register({
    id: 'higherlower', title: 'Higher or Lower', emoji: 'cards', cat: 'goofy', order: 47,
    blurb: 'One card is up. Guess whether the next is higher or lower and build a streak. A tie counts as a win.',
    scoreLabel: 'Best streak', tags: ['cards', 'luck', 'quick'],
    how: [
      'A card is shown. Guess whether the next card ranks higher or lower.',
      'A correct guess extends the streak, and that card becomes the one to beat.',
      'A tie of the same rank counts in your favor. One wrong guess ends the run.',
      'Your score is the longest streak in a single run.'
    ],
    mount
  });
})();
