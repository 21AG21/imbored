/* Quarterly Slots — a three-reel office fruit machine. Spin the budget away. */
(function () {
  'use strict';
  const { h, randInt } = Engine;
  const SYMS = ['📎', '☕', '📈', '💼', '🏆', '💾', '7️⃣'];
  /* payout for three-of-a-kind, by symbol index */
  const PAY3 = [5, 8, 12, 15, 25, 40, 100];

  function mount(root, api) {
    const bagg = Engine.bag();
    let credits, best, spinning = false, disposed = false;

    const pCredits = api.pill('credits: 20');
    const pBest = api.pill('best: 20');
    const reelEls = [0, 1, 2].map(() => h('div', { class: 'slot-reel' }, '❓'));
    const msg = h('div', { class: 'slot-msg' }, 'Spin costs 1 credit. Match three to win big.');
    const spinBtn = h('button', { class: 'btn primary slot-spin', type: 'button', onclick: spin }, 'Spin (1)');
    root.appendChild(h('div', { class: 'slots' },
      h('div', { class: 'slot-window' }, reelEls),
      msg,
      h('div', { class: 'slot-btns' }, spinBtn)));
    api.button('Cash out / restart', reset);

    function reset() {
      credits = 20; best = 20; spinning = false;
      reelEls.forEach((r) => { r.textContent = '❓'; });
      msg.textContent = 'Spin costs 1 credit. Match three to win big.'; msg.className = 'slot-msg';
      sync();
      api.status('Each spin costs one credit. Two of a kind pays a little, three pays a lot, three 7s pays out big. See how high your credits climb.');
    }
    function sync() {
      pCredits.textContent = 'credits: ' + credits;
      best = Math.max(best, credits);
      pBest.textContent = 'best: ' + best;
      spinBtn.disabled = spinning || credits <= 0;
    }
    function payout(a, b, c) {
      if (a === b && b === c) return PAY3[a];
      if (a === b || b === c || a === c) return 2;
      return 0;
    }
    function spin() {
      if (spinning || credits <= 0) return;
      credits--; spinning = true; sync();
      msg.textContent = '…'; msg.className = 'slot-msg';
      const finals = [randInt(0, SYMS.length - 1), randInt(0, SYMS.length - 1), randInt(0, SYMS.length - 1)];
      let ticks = 0;
      const settle = [10, 16, 22];
      const iv = setInterval(() => {
        if (disposed) { clearInterval(iv); return; }
        ticks++;
        for (let r = 0; r < 3; r++) {
          if (ticks < settle[r]) reelEls[r].textContent = SYMS[randInt(0, SYMS.length - 1)];
          else reelEls[r].textContent = SYMS[finals[r]];
        }
        if (ticks % 2 === 0) api.sfx.blip(400 + ticks * 20);
        if (ticks >= settle[2]) {
          clearInterval(iv);
          spinning = false;
          const win = payout(finals[0], finals[1], finals[2]);
          if (win > 0) {
            credits += win; api.sfx.great();
            msg.textContent = (finals[0] === finals[1] && finals[1] === finals[2]) ? ('Three of a kind! +' + win) : ('A pair. +' + win);
            msg.className = 'slot-msg win';
            reelEls.forEach((r) => { r.classList.remove('hit'); void r.offsetWidth; r.classList.add('hit'); });
          } else {
            api.sfx.bad(); msg.textContent = credits <= 0 ? 'Out of credits. Cash out to restart.' : 'Nothing. Spin again.';
            msg.className = 'slot-msg' + (credits <= 0 ? ' lose' : '');
          }
          api.submit(best);
          sync();
        }
      }, 70);
      bagg.add(() => clearInterval(iv));
    }

    reset();
    return () => { disposed = true; bagg.dispose(); };
  }

  Arcade.register({
    id: 'slots', title: 'Quarterly Slots', emoji: 'coffee', cat: 'goofy', order: 49,
    blurb: 'A three-reel fruit machine stocked with office supplies. Spin costs a credit, matches pay out, three 7s pay out big. No real money, only your dignity.',
    scoreLabel: 'Best credits', tags: ['luck', 'slots', 'toy'],
    how: [
      'Each spin costs one credit. Press Spin.',
      'Two matching symbols pay a little. Three matching pay a lot.',
      'Three 7s is the jackpot.',
      'Your score is the highest credit balance you reach in a run.'
    ],
    mount
  });
})();
