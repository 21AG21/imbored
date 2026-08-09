/* Video Poker — Jacks or Better, the break-room casino machine. Deal five, hold
 * the keepers, draw once, get paid by the table. Fake credits, real decisions. */
(function () {
  'use strict';
  const { h } = Engine;

  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']; // index 0..12
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RED = new Set([1, 2]); // hearts, diamonds

  /* Jacks-or-Better pay table, per credit bet (royal pays a bonus at max bet) */
  const TABLE = [
    { key: 'royal', name: 'Royal flush', pay: 250 },
    { key: 'sflush', name: 'Straight flush', pay: 50 },
    { key: 'quads', name: 'Four of a kind', pay: 25 },
    { key: 'boat', name: 'Full house', pay: 9 },
    { key: 'flush', name: 'Flush', pay: 6 },
    { key: 'straight', name: 'Straight', pay: 4 },
    { key: 'trips', name: 'Three of a kind', pay: 3 },
    { key: 'twopair', name: 'Two pair', pay: 2 },
    { key: 'jacks', name: 'Jacks or better', pay: 1 }
  ];
  const PAY = {}; TABLE.forEach((t) => { PAY[t.key] = t.pay; });

  /* classify a 5-card hand -> pay-table key or null */
  function evaluate(cards) {
    const ranks = cards.map((c) => c.r).sort((a, b) => a - b);
    const suits = cards.map((c) => c.s);
    const flush = suits.every((s) => s === suits[0]);
    const uniq = [...new Set(ranks)];
    let straight = false;
    if (uniq.length === 5) {
      if (ranks[4] - ranks[0] === 4) straight = true;
      if (ranks.join(',') === '0,1,2,3,12') straight = true;   // wheel A-2-3-4-5
    }
    const cnt = {}; for (const r of ranks) cnt[r] = (cnt[r] || 0) + 1;
    const counts = Object.values(cnt).sort((a, b) => b - a);
    const royalRanks = ranks.join(',') === '8,9,10,11,12';
    if (flush && straight && royalRanks) return 'royal';
    if (flush && straight) return 'sflush';
    if (counts[0] === 4) return 'quads';
    if (counts[0] === 3 && counts[1] === 2) return 'boat';
    if (flush) return 'flush';
    if (straight) return 'straight';
    if (counts[0] === 3) return 'trips';
    if (counts[0] === 2 && counts[1] === 2) return 'twopair';
    if (counts[0] === 2) {
      const pairRank = +Object.keys(cnt).find((k) => cnt[k] === 2);
      if (pairRank >= 9) return 'jacks';   // J,Q,K,A pair
    }
    return null;
  }

  function payout(key, bet) {
    if (!key) return 0;
    if (key === 'royal' && bet === 5) return 4000;   // the max-bet royal bonus
    return PAY[key] * bet;
  }

  function mount(root, api) {
    const bagg = Engine.bag();
    let deck, hand, held, phase, bet, credits, best;
    credits = api.load('credits', 100);
    if (credits < 1) credits = 100;
    best = api.load('best', 0);

    const pCredits = api.pill('Credits ' + credits);
    const pBet = api.pill('Bet 1');
    const pWin = api.pill('');

    const tableEl = h('div', { class: 'vp-table' }, TABLE.map((t) =>
      h('div', { class: 'vp-pay', data: { key: t.key } },
        h('span', null, t.name), h('span', { class: 'vp-pay-n' }, '×' + t.pay))));
    const handEl = h('div', { class: 'vp-hand' });
    const cardEls = [];
    for (let i = 0; i < 5; i++) {
      const el = h('div', { class: 'vp-card back' },
        h('span', { class: 'vp-rank' }, ''), h('span', { class: 'vp-hold' }, 'HOLD'));
      el.addEventListener('click', () => toggleHold(i));
      cardEls.push(el); handEl.appendChild(el);
    }
    const dealBtn = h('button', { class: 'btn primary vp-deal', type: 'button' }, 'Deal');
    dealBtn.addEventListener('click', action);
    const status = h('div', { class: 'vp-status' });
    root.append(tableEl, handEl, h('div', { class: 'vp-controls' }, dealBtn), status);

    api.button('Bet -', () => setBet(bet - 1));
    api.button('Bet +', () => setBet(bet + 1));
    api.button('Max bet', () => { setBet(5); if (phase !== 'draw') action(); });
    api.button('Add credits', () => { if (credits < 5) { credits += 100; save(); sync(); api.status('Topped up with 100 fun-credits. It is not real money; it is barely a game.'); } });

    bet = 1; phase = 'deal'; hand = []; held = [false, false, false, false, false];
    renderHand(); sync();
    api.status('Press Deal to get five cards. Click cards to hold them, then Draw once. You get paid for a pair of jacks or better.');

    function setBet(v) {
      if (phase === 'draw') return;
      bet = Math.max(1, Math.min(5, v));
      sync();
    }

    function freshDeck() {
      const d = [];
      for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) d.push({ r, s });
      for (let i = d.length - 1; i > 0; i--) { const j = Engine.randInt(0, i); const t = d[i]; d[i] = d[j]; d[j] = t; }
      return d;
    }

    function action() {
      if (phase === 'deal') {
        if (credits < bet) { api.status('Not enough credits for that bet. Lower the bet or add credits.'); return; }
        credits -= bet;
        deck = freshDeck();
        hand = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
        held = [false, false, false, false, false];
        phase = 'draw';
        pWin.textContent = '';
        dealBtn.textContent = 'Draw';
        api.sfx.click();
        renderHand(); sync();
        api.status('Hold the cards you want to keep, then press Draw.');
      } else {
        for (let i = 0; i < 5; i++) if (!held[i]) hand[i] = deck.pop();
        phase = 'deal';
        dealBtn.textContent = 'Deal';
        const key = evaluate(hand);
        const win = payout(key, bet);
        credits += win;
        if (credits > best) { best = credits; api.save('best', best); api.submit(best); }
        save();
        renderHand(true);
        highlight(key);
        if (win > 0) { api.sfx.great(); pWin.textContent = '+' + win; api.status((TABLE.find((t) => t.key === key) || {}).name + '! Paid ' + win + ' credits.'); }
        else { api.sfx.bad(); pWin.textContent = ''; api.status('No pay that time. Deal again.'); }
        sync();
      }
    }

    function toggleHold(i) {
      if (phase !== 'draw') return;
      held[i] = !held[i];
      cardEls[i].classList.toggle('held', held[i]);
      api.sfx.blip(held[i] ? 640 : 360);
    }

    function renderHand(reveal) {
      for (let i = 0; i < 5; i++) {
        const el = cardEls[i], c = hand[i];
        el.classList.toggle('held', !!held[i]);
        el.classList.remove('win');
        if (!c) { el.classList.add('back'); el.querySelector('.vp-rank').textContent = ''; el.classList.remove('red'); continue; }
        el.classList.remove('back');
        el.classList.toggle('red', RED.has(c.s));
        el.querySelector('.vp-rank').textContent = RANKS[c.r] + SUITS[c.s];
      }
      void reveal;
    }

    function highlight(key) {
      tableEl.querySelectorAll('.vp-pay').forEach((e) => e.classList.toggle('lit', e.dataset.key === key));
    }

    function sync() {
      pCredits.textContent = 'Credits ' + credits;
      pBet.textContent = 'Bet ' + bet;
      pWin.className = 'pill ' + (pWin.textContent ? 'good' : '');
      dealBtn.disabled = (phase === 'deal' && credits < bet);
    }
    function save() { api.save('credits', credits); }

    /* ---- test seam ---- */
    window.__vp = {
      evaluate, payout,
      /* parse "AS KS QS JS 10S" -> cards, classify */
      classify(str) {
        const cards = str.trim().split(/\s+/).map((t) => {
          const m = /^(10|[2-9]|[JQKA])([SHDC])$/i.exec(t.toUpperCase());
          return { r: RANKS.indexOf(m[1] === '10' ? '10' : m[1]), s: 'SHDC'.indexOf(m[2]) };
        });
        return evaluate(cards);
      },
      state: () => ({ phase, credits, bet, best, hand: hand.map((c) => c ? RANKS[c.r] + SUITS[c.s] : null) }),
      setState(cr, bt) { if (cr != null) credits = cr; if (bt != null) bet = bt; sync(); }
    };
    bagg.add(() => { if (window.__vp) delete window.__vp; });

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'videopoker',
    title: 'Video Poker',
    emoji: 'cards',
    cat: 'goofy',
    order: 42,
    blurb: 'Jacks-or-Better video poker for the break room. Deal five, hold the keepers, draw once, get paid by the table. The credits are fake.',
    scoreLabel: 'Best credits',
    tags: ['poker', 'cards', 'casino'],
    how: [
      'Set your bet (1 to 5 credits) and press Deal for five cards. The bet comes out up front.',
      'Click the cards you want to keep, marked HOLD, then press Draw. Every unheld card is replaced once.',
      'The table pays a pair of jacks or better, up through two pair, straights, flushes, full houses, quads, straight flush and royal flush.',
      'A royal flush pays a 4000 bonus at the max bet of five, which is what Max bet is for. Everything else pays a straight multiple of your bet.',
      'Credits are fake and saved between visits. Bust out and Add credits tops you back up. Your score is the highest balance you reach.'
    ],
    mount
  });
})();
