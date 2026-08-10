/* Quarterly Slots — a three-reel office fruit machine. Spin the budget away. */
(function () {
  'use strict';
  const { h, randInt } = Engine;
  const SYMS = ['📎', '☕', '📈', '💼', '🏆', '💾', '7️⃣'];
  /* payout for three-of-a-kind, by symbol index */
  const PAY3 = [5, 8, 12, 15, 25, 40, 100];

  function mount(root, api) {
    const bagg = Engine.bag();
    let credits, best, bet = 1, spinning = false, disposed = false;

    const pCredits = api.pill('credits: 20');
    const pBest = api.pill('best: 20');
    const reelEls = [0, 1, 2].map(() => h('div', { class: 'slot-reel' }, '❓'));
    const msg = h('div', { class: 'slot-msg' }, 'Spin costs your bet. A pair returns it; three of a kind pays.');
    const betLabel = h('span', { class: 'pill slot-bet' }, 'bet: 1');
    const betDown = h('button', { class: 'btn tiny', type: 'button', onclick: () => setBet(bet - 1) }, '–');
    const betUp = h('button', { class: 'btn tiny', type: 'button', onclick: () => setBet(bet + 1) }, '+');
    const spinBtn = h('button', { class: 'btn primary slot-spin', type: 'button', onclick: spin }, 'Spin (1)');
    root.appendChild(h('div', { class: 'slots' },
      h('div', { class: 'slot-window' }, reelEls),
      msg,
      h('div', { class: 'slot-btns' }, betDown, betLabel, betUp, spinBtn)));
    api.button('Cash out / restart', reset);

    function setBet(v) {
      if (spinning) return;
      bet = Engine.clamp(v, 1, Math.min(3, Math.max(1, credits)));
      betLabel.textContent = 'bet: ' + bet;
      spinBtn.textContent = 'Spin (' + bet + ')';
    }
    function reset() {
      credits = 20; best = 20; bet = 1; spinning = false;
      reelEls.forEach((r) => { r.textContent = '❓'; });
      msg.textContent = 'Spin costs your bet. A pair returns it; three of a kind pays.'; msg.className = 'slot-msg';
      setBet(1); sync();
      api.status('Each spin costs your bet. A pair just returns your stake — three of a kind is where the money is, and three 7s is the jackpot. The house keeps a thin edge, so a good run has to be pressed. Bet bigger for bigger swings.');
    }
    function sync() {
      pCredits.textContent = 'credits: ' + credits;
      best = Math.max(best, credits);
      pBest.textContent = 'best: ' + best;
      if (bet > credits) setBet(credits);
      betDown.disabled = spinning || bet <= 1;
      betUp.disabled = spinning || bet >= Math.min(3, credits);
      spinBtn.disabled = spinning || credits <= 0;
    }
    function payout(a, b, c) {
      if (a === b && b === c) return PAY3[a] * bet;   // three of a kind — the real money
      if (a === b || b === c || a === c) return bet;  // a pair only returns your stake (a push)
      return 0;
    }
    function spin() {
      if (spinning || credits <= 0) return;
      if (bet > credits) setBet(credits);
      credits -= bet; spinning = true; sync();
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
          const three = finals[0] === finals[1] && finals[1] === finals[2];
          if (win > 0) {
            credits += win;
            if (three) {
              api.sfx.great();
              msg.textContent = (finals[0] === SYMS.length - 1) ? ('JACKPOT — three 7s! +' + win) : ('Three of a kind! +' + win);
              msg.className = 'slot-msg win';
              reelEls.forEach((r) => { r.classList.remove('hit'); void r.offsetWidth; r.classList.add('hit'); });
            } else {
              api.sfx.click();
              msg.textContent = 'A pair — stake back.';
              msg.className = 'slot-msg';
            }
          } else {
            api.sfx.bad(); msg.textContent = credits <= 0 ? 'Out of credits. Cash out to restart.' : 'Nothing. Spin again.';
            msg.className = 'slot-msg' + (credits <= 0 ? ' lose' : '');
          }
          sync();   // sync() is what actually raises `best` to the new credits total
          api.submit(best);
        }
      }, 70);
      bagg.add(() => clearInterval(iv));
    }

    reset();
    return () => { disposed = true; bagg.dispose(); };
  }

  Arcade.register({
    id: 'slots', title: 'Quarterly Slots', emoji: 'coffee', cat: 'goof', order: 49,
    lightBoard: true,   // light reel windows would invert to solid black under the figure flip
    blurb: 'A three-reel fruit machine stocked with office supplies. A pair just gives your stake back; three of a kind is the money, and three 7s is the jackpot. The house keeps a thin edge — no real money, only your dignity.',
    scoreLabel: 'Best credits', tags: ['luck', 'slots', 'toy'],
    how: [
      'Set your bet (1 to 3) and press Spin. The spin costs your bet.',
      'A pair just returns your stake — you break even on that spin.',
      'Three of a kind pays, scaled by your bet. Three 7s is the jackpot.',
      'The house keeps a thin edge, so credits drift down over time — a good run is one you cash out. Your score is the highest balance you reach.'
    ],
    mount
  });
})();
