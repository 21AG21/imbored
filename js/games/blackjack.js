/* Twenty-One. Betting your unspent PTO against a dealer who has never once blinked. */
(function () {
  'use strict';
  const { h, shuffle } = Engine;

  const SUITS = ['♠', '♥', '♦', '♣'];   /* spade heart diamond club */
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const START = 200;
  const BETS = [5, 10, 25];

  const isRed = (s) => s === 1 || s === 2;

  function handValue(cards) {
    let total = 0, aces = 0;
    for (const c of cards) {
      if (c.r === 0) { aces++; total += 11; }
      else total += (c.r >= 9 ? 10 : c.r + 1);
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return { total: total, soft: aces > 0 };
  }
  const isBlackjack = (cards) => cards.length === 2 && handValue(cards).total === 21;

  function mount(root, api) {
    const bagg = Engine.bag();

    const numDecks = api.hard ? 4 : 1;
    const hitSoft17 = api.hard;                 /* dealer hits soft 17 only on hard/nightmare */
    const RESHUFFLE = Math.max(12, Math.floor(numDecks * 52 * 0.22));

    let shoe = [];
    let player = [];
    let dealer = [];
    let phase = 'ready';        /* ready | player | dealer */
    let revealHole = false;
    let stake = 0;
    let dealerTimer = null;

    let bankroll = api.load('chips', START);
    if (typeof bankroll !== 'number' || bankroll < 0) bankroll = START;
    let curBet = api.load('bet', 10);
    if (BETS.indexOf(curBet) < 0) curBet = 10;

    /* ---------------- toolbar ---------------- */
    const pChips = api.pill('Chips: ' + bankroll);
    const pShoe = api.pill('Shoe: 0');
    api.select('Bet', BETS.map((b) => ({ value: String(b), label: b + ' chips' })), String(curBet), (v) => {
      curBet = parseInt(v, 10) || 10;
      api.save('bet', curBet);
      updateButtons();
    });

    const dealBtn = api.button('Deal', () => deal(), 'primary');
    const hitBtn = api.button('Hit', () => playerHit());
    const standBtn = api.button('Stand', () => stand());
    const dblBtn = api.button('Double', () => double());
    api.button('PTO advance', () => advance());

    /* ---------------- felt ---------------- */
    const dealerScore = h('span', { class: 'bj-score' }, '');
    const playerScore = h('span', { class: 'bj-score' }, '');
    const dealerHand = h('div', { class: 'bj-hand' });
    const playerHand = h('div', { class: 'bj-hand' });
    const felt = h('div', { class: 'bj-felt' },
      h('div', { class: 'bj-row' },
        h('div', { class: 'bj-side' }, h('span', { class: 'bj-who' }, 'Dealer'), dealerScore),
        dealerHand),
      h('div', { class: 'bj-row' },
        h('div', { class: 'bj-side' }, h('span', { class: 'bj-who' }, 'You'), playerScore),
        playerHand));
    const msgEl = h('div', { class: 'bj-msg' }, '');
    root.appendChild(h('div', { class: 'blackjack' }, felt, msgEl));

    /* ---------------- deck ---------------- */
    function buildShoe(announce) {
      const cards = [];
      for (let d = 0; d < numDecks; d++)
        for (let s = 0; s < 4; s++)
          for (let r = 0; r < 13; r++) cards.push({ r: r, s: s });
      shoe = shuffle(cards);
      if (announce) api.status('Fresh ' + numDecks + '-deck shoe shuffled. The count you were keeping is now worthless.');
    }
    function drawCard() {
      if (!shoe.length) buildShoe(false);
      return shoe.pop();
    }
    buildShoe(false);

    /* ---------------- rendering ---------------- */
    function cardEl(c) {
      const r = RANKS[c.r], su = SUITS[c.s];
      return h('div', { class: 'bj-card' + (isRed(c.s) ? ' red' : '') },
        h('span', { class: 'bj-corner tl' }, r, h('br'), su),
        h('span', { class: 'bj-pip' }, su),
        h('span', { class: 'bj-corner br' }, r, h('br'), su));
    }
    function backEl() {
      return h('div', { class: 'bj-card back' }, h('span', { class: 'bj-back-mark' }, '?'));
    }

    function render() {
      dealerHand.replaceChildren();
      playerHand.replaceChildren();

      if (!dealer.length) dealerHand.appendChild(h('span', { class: 'bj-empty' }, '—'));
      else {
        const show = revealHole ? dealer : [dealer[0]];
        show.forEach((c) => dealerHand.appendChild(cardEl(c)));
        if (!revealHole && dealer.length > 1) dealerHand.appendChild(backEl());
      }

      if (!player.length) playerHand.appendChild(h('span', { class: 'bj-empty' }, '—'));
      else player.forEach((c) => playerHand.appendChild(cardEl(c)));

      if (dealer.length) {
        const dv = revealHole ? handValue(dealer) : handValue([dealer[0]]);
        dealerScore.textContent = revealHole ? String(dv.total) : dv.total + ' + ?';
      } else dealerScore.textContent = '';

      if (player.length) {
        const pv = handValue(player);
        playerScore.textContent = (pv.soft && pv.total < 21 ? 'soft ' : '') + pv.total;
      } else playerScore.textContent = '';
    }

    function updatePills() {
      pChips.textContent = 'Chips: ' + bankroll;
      pChips.className = 'pill ' + (bankroll >= START ? 'good' : bankroll < curBet ? 'bad' : '');
      pShoe.textContent = 'Shoe: ' + shoe.length;
    }

    function updateButtons() {
      dealBtn.disabled = phase !== 'ready' || bankroll < curBet;
      hitBtn.disabled = phase !== 'player';
      standBtn.disabled = phase !== 'player';
      dblBtn.disabled = !(phase === 'player' && player.length === 2 && bankroll >= stake);
    }

    function setMsg(text, kind) {
      msgEl.textContent = text || '';
      msgEl.className = 'bj-msg' + (kind ? ' ' + kind : '');
    }

    /* ---------------- round flow ---------------- */
    function deal() {
      if (phase !== 'ready') return;
      if (bankroll < curBet) {
        setMsg('Not enough chips.', 'lose');
        api.status('You are short. Lower the bet or take a PTO advance.');
        return;
      }
      if (shoe.length < RESHUFFLE) buildShoe(true);
      else api.status('Hit, stand, or double down.');

      player = []; dealer = [];
      stake = curBet;
      bankroll -= stake;             /* the bet goes onto the felt */
      player.push(drawCard()); dealer.push(drawCard());
      player.push(drawCard()); dealer.push(drawCard());
      revealHole = false;
      phase = 'player';
      setMsg('', '');
      api.sfx.blip(520);
      updatePills();
      render();
      updateButtons();

      const pBJ = isBlackjack(player);
      const dBJ = isBlackjack(dealer);
      if (pBJ || dBJ) {
        revealHole = true;
        if (pBJ && dBJ) finishRound(stake, 'Push.', 'push', 'You both had blackjack. Nothing changes hands.');
        else if (pBJ) finishRound(stake + Math.round(stake * 1.5), 'Blackjack!', 'bj', 'Twenty-one off the deal. Pays three to two.');
        else finishRound(0, 'Dealer blackjack.', 'lose', 'The hole card was exactly what you feared.');
      }
    }

    function playerHit() {
      if (phase !== 'player') return;
      player.push(drawCard());
      api.sfx.blip(620);
      updatePills();
      render();
      const hv = handValue(player);
      if (hv.total > 21) {
        revealHole = true;
        finishRound(0, 'Bust.', 'lose', 'Over twenty-one. The dealer wins by doing absolutely nothing.');
      } else if (hv.total === 21) {
        stand();
      } else {
        updateButtons();
      }
    }

    function double() {
      if (phase !== 'player' || player.length !== 2 || bankroll < stake) return;
      bankroll -= stake;             /* match the original bet */
      stake *= 2;
      player.push(drawCard());
      api.sfx.blip(600);
      updatePills();
      render();
      const hv = handValue(player);
      if (hv.total > 21) {
        revealHole = true;
        finishRound(0, 'Bust.', 'lose', 'Doubled, then busted. Bold. Wrong, but bold.');
      } else {
        phase = 'dealer';
        updateButtons();
        dealerPlay();
      }
    }

    function stand() {
      if (phase !== 'player') return;
      phase = 'dealer';
      updateButtons();
      dealerPlay();
    }

    function dealerShouldHit(hv) {
      if (hv.total < 17) return true;
      if (hv.total === 17 && hv.soft && hitSoft17) return true;
      return false;
    }

    function dealerPlay() {
      revealHole = true;
      render();
      updatePills();
      function step() {
        const hv = handValue(dealer);
        if (dealerShouldHit(hv)) {
          dealer.push(drawCard());
          api.sfx.blip(420);
          render();
          updatePills();
          dealerTimer = setTimeout(step, 640);
        } else {
          settle();
        }
      }
      dealerTimer = setTimeout(step, 640);
    }

    function settle() {
      const p = handValue(player).total;
      const d = handValue(dealer).total;
      if (d > 21) return finishRound(stake * 2, 'Dealer busts.', 'win', 'The dealer overcooked it on ' + d + '. You take ' + stake + ' chips.');
      if (p > d) return finishRound(stake * 2, 'You win.', 'win', 'Your ' + p + ' beats their ' + d + '. Up ' + stake + ' chips.');
      if (p < d) return finishRound(0, 'Dealer wins.', 'lose', 'Their ' + d + ' tops your ' + p + '. The ' + stake + ' chips are gone.');
      return finishRound(stake, 'Push.', 'push', 'Both sitting on ' + p + '. Your chips come home untouched.');
    }

    function finishRound(delta, title, kind, sub) {
      bankroll += delta;
      phase = 'ready';
      revealHole = true;
      api.save('chips', bankroll);
      const res = api.submit(bankroll);        /* keeps the high-water mark */

      if (kind === 'bj') api.sfx.great();
      else if (kind === 'win') api.sfx.good();
      else if (kind === 'push') api.sfx.click();
      else api.sfx.bad();

      setMsg(title, kind);
      updatePills();
      render();
      updateButtons();
      const note = res.isRecord ? ' New PTO high of ' + res.best + ' chips.' : '';
      api.status(sub + note + ' Press Deal for another hand.');
    }

    function advance() {
      if (phase !== 'ready') return;
      if (bankroll >= curBet) { api.status('You still have chips. Spend those first.'); return; }
      bankroll = START;              /* an advance is not a score, so it is not submitted */
      api.save('chips', bankroll);
      setMsg('', '');
      updatePills();
      updateButtons();
      api.sfx.click();
      api.status('HR advanced you ' + START + ' chips against next year. Try not to think about it.');
    }

    /* ---------------- keyboard ---------------- */
    bagg.add(Engine.onKey((e) => {
      const k = e.key.toLowerCase();
      if (k === 'h') { playerHit(); return true; }
      if (k === 's') { stand(); return true; }
      if (k === 'd') { double(); return true; }
      if (k === ' ' || k === 'enter') { if (phase === 'ready') deal(); return true; }
      return;
    }));

    bagg.add(() => { if (dealerTimer) clearTimeout(dealerTimer); });

    updatePills();
    render();
    updateButtons();
    api.status('Get to twenty-one without going over, and beat the dealer. Deal, then Hit or Stand. Blackjack pays three to two.');

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'blackjack',
    title: 'Twenty-One',
    emoji: 'blackjack',
    cat: 'goof',
    order: 6,
    blurb: 'Single-deck blackjack against a dealer with a fixed policy and no tells. You are betting your unspent PTO. It is not real. Please relax.',
    scoreLabel: 'Chip high',
    tags: ['cards', 'blackjack', 'dealer', 'chips'],
    usesLetters: true,
    how: [
      'Get closer to twenty-one than the dealer without going over. Aces are eleven or one, whichever helps.',
      'Buttons: Deal, Hit, Stand, Double. Keys: H hit, S stand, D double, Space deals. Pick a bet from the dropdown.',
      'The dealer hits sixteen and stands on seventeen, then flips the hole card once you stand. Blackjack pays three to two.',
      'Your chip bankroll persists and is the score kept. Broke? A PTO advance tops you back up, but that will not count toward a record.',
      'Chill and Normal use one deck and the dealer stands on soft seventeen. Hard and Nightmare deal four decks and the dealer hits soft seventeen.'
    ],
    mount: mount
  });
})();
