/* Last Stick — misère Nim. Take 1–3; get stuck with the last one and you lose. */
(function () {
  'use strict';
  const { h, randInt, clamp } = Engine;
  const MAX = 3;

  /* a start count where the FIRST mover (you) can still win with perfect play,
     i.e. not ≡ 1 (mod 4) — so it is beatable, but only if you find the trick */
  function startCount() {
    let n;
    do { n = randInt(15, 24); } while (n % (MAX + 1) === 1);
    return n;
  }

  function mount(root, api) {
    const bagg = Engine.bag();
    let sticks = 21, turn = 'you', over = false, streak = 0, disposed = false;

    const pStreak = api.pill('win streak: 0');
    const pile = h('div', { class: 'nim-pile' });
    const msg = h('div', { class: 'nim-msg' }, '');
    const btns = h('div', { class: 'nim-btns' }, [1, 2, 3].map((k) =>
      h('button', { class: 'btn primary nim-take', type: 'button', onclick: () => take(k) }, 'Take ' + k)));
    root.appendChild(h('div', { class: 'nim' }, pile, msg, btns));
    api.button('New game', reset);

    function reset() {
      sticks = startCount(); turn = 'you'; over = false;
      msg.textContent = 'Take 1, 2 or 3. Do NOT get stuck with the last stick.'; msg.className = 'nim-msg';
      render(); busy(false);
      api.status('There are ' + sticks + ' sticks. Take 1–3 per turn, alternating with your deskmate. Whoever must take the last stick loses.');
    }
    function render() {
      pile.replaceChildren.apply(pile, Array.from({ length: sticks }, () => h('span', { class: 'nim-stick' })));
      pStreak.textContent = 'win streak: ' + streak;
    }
    function busy(b) { [...btns.children].forEach((c, i) => { c.disabled = b || (i + 1) > sticks; }); }

    function take(k) {
      if (over || turn !== 'you' || k > sticks) return;
      sticks -= k; api.sfx.blip(520); render();
      if (sticks === 0) { over = true; streak = 0; msg.textContent = 'You took the last stick — you lose. Streak reset.'; msg.className = 'nim-msg lose'; api.sfx.bad(); busy(true); return; }
      turn = 'cpu'; busy(true); msg.textContent = 'Deskmate is thinking…';
      setTimeout(cpu, 620);
    }
    function cpu() {
      if (disposed || over) return;
      /* the dial decides how often the deskmate fluffs it: chill and normal
         hand you openings, hard and nightmare play the perfect misère line */
      const blunder = clamp(0.6 - api.dm * 0.35, 0, 0.5);
      let k;
      if (Math.random() < blunder) {
        k = randInt(1, Math.min(MAX, sticks));   // random legal take — a gift
      } else {
        k = (sticks - 1) % (MAX + 1);            // leave opponent at ≡1 (mod 4)
        if (k === 0) k = randInt(1, Math.min(MAX, sticks)); // already losing — play on
      }
      k = Math.max(1, Math.min(k, MAX, sticks));
      sticks -= k; api.sfx.blip(360); render();
      if (sticks === 0) {
        over = true; streak++; api.sfx.great();
        const r = api.submit(streak);
        msg.textContent = 'Deskmate took the last stick — you win! Streak ' + streak + '.' + (r.isRecord ? ' Best yet!' : '');
        msg.className = 'nim-msg win'; busy(true); return;
      }
      turn = 'you'; busy(false); msg.textContent = 'Your move. Take 1, 2 or 3.'; msg.className = 'nim-msg';
    }

    reset();
    return () => { disposed = true; bagg.dispose(); };
  }

  Arcade.register({
    id: 'nim', title: 'Last Stick', emoji: 'priority', cat: 'brain', order: 29,
    lightBoard: true,   // doc mode paints its own literal black sticks (see arcade.css) — the blanket invert can't reach true black on a themed accent colour
    blurb: 'Take one, two, or three sticks per turn against the deskmate. Whoever takes the last stick loses.',
    scoreLabel: 'Win streak', tags: ['strategy', 'maths', 'classic'],
    how: [
      'On your turn, take one, two, or three sticks.',
      'Turns alternate with your deskmate. Taking the last stick loses.',
      'There is a counting pattern that wins every game. Work it out.',
      'Your score is your streak of games won in a row.'
    ],
    mount
  });
})();
