/* Deadline Dice — Yahtzee. Five dice, three rolls, thirteen boxes to fill. */
(function () {
  'use strict';
  const { h, randInt } = Engine;
  const PIPS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const CATS = [
    { id: 'ones', name: 'Ones', fn: (d) => sumOf(d, 1) },
    { id: 'twos', name: 'Twos', fn: (d) => sumOf(d, 2) },
    { id: 'threes', name: 'Threes', fn: (d) => sumOf(d, 3) },
    { id: 'fours', name: 'Fours', fn: (d) => sumOf(d, 4) },
    { id: 'fives', name: 'Fives', fn: (d) => sumOf(d, 5) },
    { id: 'sixes', name: 'Sixes', fn: (d) => sumOf(d, 6) },
    { id: 'three', name: 'Three of a kind', fn: (d) => ofKind(d, 3) ? sum(d) : 0 },
    { id: 'four', name: 'Four of a kind', fn: (d) => ofKind(d, 4) ? sum(d) : 0 },
    { id: 'full', name: 'Full house', fn: (d) => fullHouse(d) ? 25 : 0 },
    { id: 'sm', name: 'Small straight', fn: (d) => straight(d, 4) ? 30 : 0 },
    { id: 'lg', name: 'Large straight', fn: (d) => straight(d, 5) ? 40 : 0 },
    { id: 'yz', name: 'Deadline! (5 alike)', fn: (d) => ofKind(d, 5) ? 50 : 0 },
    { id: 'chance', name: 'Chance', fn: (d) => sum(d) }
  ];
  const sum = (d) => d.reduce((a, v) => a + v, 0);
  const sumOf = (d, n) => d.filter((v) => v === n).length * n;
  const counts = (d) => { const c = [0, 0, 0, 0, 0, 0, 0]; d.forEach((v) => c[v]++); return c; };
  const ofKind = (d, n) => counts(d).some((x) => x >= n);
  const fullHouse = (d) => { const c = counts(d).filter((x) => x); return (c.includes(3) && c.includes(2)) || c.includes(5); };
  const straight = (d, n) => {
    const s = [...new Set(d)].sort((a, b) => a - b);
    let run = 1, best = 1;
    for (let i = 1; i < s.length; i++) { if (s[i] === s[i - 1] + 1) { run++; best = Math.max(best, run); } else run = 1; }
    return best >= n;
  };

  function mount(root, api) {
    const bagg = Engine.bag();
    let dice, held, rollsLeft, scores, rolled, over;

    const pTotal = api.pill('total: 0');
    const pRolls = api.pill('rolls: 3');
    const diceRow = h('div', { class: 'yz-dice' });
    const dieEls = [0, 1, 2, 3, 4].map((i) => {
      const el = h('button', { class: 'yz-die', type: 'button', onclick: () => toggleHold(i) }, '?');
      diceRow.appendChild(el); return el;
    });
    const rollBtn = h('button', { class: 'btn primary yz-roll', type: 'button', onclick: roll }, 'Roll');
    const card = h('div', { class: 'yz-card' });
    const msg = h('div', { class: 'yz-msg' }, '');
    root.appendChild(h('div', { class: 'yahtzee' }, diceRow, h('div', { class: 'yz-ctrl' }, rollBtn), card, msg));
    api.button('New game', reset);

    const rows = {};
    CATS.forEach((cat) => {
      const val = h('span', { class: 'yz-val' }, '');
      const row = h('button', { class: 'yz-row', type: 'button', onclick: () => pick(cat) }, h('span', { class: 'yz-name' }, cat.name), val);
      rows[cat.id] = { row, val }; card.appendChild(row);
    });
    const bonusRow = h('div', { class: 'yz-row bonus' }, h('span', { class: 'yz-name' }, 'Upper bonus (63+)'), h('span', { class: 'yz-val', id: 'yz-bonus' }, '0'));
    card.appendChild(bonusRow);

    function reset() {
      dice = [0, 0, 0, 0, 0]; held = [false, false, false, false, false];
      rollsLeft = 3; scores = {}; rolled = false; over = false;
      dieEls.forEach((e) => { e.textContent = '?'; e.className = 'yz-die'; });
      msg.textContent = 'Roll to start. You get three rolls a turn.'; msg.className = 'yz-msg';
      renderCard(); sync();
      api.status('Roll five dice, keep the ones you like by tapping them, and roll again up to three times. Then bank the dice in a scoring box. Fill all thirteen for your total.');
    }
    function roll() {
      if (over || rollsLeft <= 0) return;
      for (let i = 0; i < 5; i++) if (!held[i]) dice[i] = randInt(1, 6);
      rollsLeft--; rolled = true; api.sfx.blip(360);
      dieEls.forEach((e, i) => { e.textContent = PIPS[dice[i]]; e.classList.toggle('held', held[i]); });
      renderCard(); sync();
      msg.textContent = rollsLeft > 0 ? 'Keep dice by tapping them, then roll again or bank a box.' : 'Last roll spent. Bank the dice in a box.';
      msg.className = 'yz-msg';
    }
    function toggleHold(i) {
      if (over || !rolled) return;
      held[i] = !held[i]; dieEls[i].classList.toggle('held', held[i]); api.sfx.click();
    }
    function pick(cat) {
      if (over || !rolled || scores[cat.id] != null) return;
      scores[cat.id] = cat.fn(dice);
      api.sfx.good();
      rollsLeft = 3; rolled = false; held = [false, false, false, false, false];
      dieEls.forEach((e) => { e.textContent = '?'; e.className = 'yz-die'; });
      renderCard(); sync();
      if (Object.keys(scores).length >= CATS.length) return finish();
      msg.textContent = 'Boxed for ' + scores[cat.id] + '. Roll for the next box.'; msg.className = 'yz-msg';
    }
    function upperSum() { return ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'].reduce((a, id) => a + (scores[id] || 0), 0); }
    function bonus() { return upperSum() >= 63 ? 35 : 0; }
    function total() { return CATS.reduce((a, c) => a + (scores[c.id] || 0), 0) + bonus(); }
    function renderCard() {
      CATS.forEach((cat) => {
        const done = scores[cat.id] != null;
        rows[cat.id].row.className = 'yz-row' + (done ? ' filled' : rolled ? ' pickable' : '');
        rows[cat.id].row.disabled = done || !rolled;
        rows[cat.id].val.textContent = done ? scores[cat.id] : (rolled ? cat.fn(dice) : '');
        rows[cat.id].val.classList.toggle('preview', !done && rolled);
      });
      document.getElementById('yz-bonus').textContent = String(bonus()) + (upperSum() ? ' (' + upperSum() + '/63)' : '');
    }
    function sync() { pTotal.textContent = 'total: ' + total(); pRolls.textContent = 'rolls: ' + rollsLeft; rollBtn.disabled = over || rollsLeft <= 0; }
    function finish() {
      over = true; api.sfx.great();
      const t = total(); const r = api.submit(t);
      msg.textContent = 'Sheet full. Total ' + t + '.' + (r.isRecord ? ' New best!' : ''); msg.className = 'yz-msg win';
      sync();
    }

    reset();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'yahtzee', title: 'Deadline Dice', emoji: 'dice', cat: 'goof', order: 50,
    lightBoard: true,   // light dice buttons + scoring rows would invert to dark slabs under the figure flip
    blurb: 'Yahtzee under an office coat of paint. Five dice, three rolls a turn, thirteen boxes to fill. Chase the straights and the five-of-a-kind for your best total.',
    scoreLabel: 'Best total', tags: ['dice', 'yahtzee', 'classic'],
    how: [
      'Roll the five dice. Tap dice to keep them, then roll again up to three times a turn.',
      'Bank the dice in a scoring box. The board shows what each box would score.',
      'Fill all thirteen boxes. Reaching 63 in the top half earns a 35-point bonus.',
      'Your score is your best full-sheet total.'
    ],
    mount
  });
})();
