/* Press Your Luck — the dice game where a single 1 wipes your whole turn. */
(function () {
  'use strict';
  const { h, randInt } = Engine;
  const GOAL = 100;
  const PIPS = ['·', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  function mount(root, api) {
    const bagg = Engine.bag();
    let you = 0, cpu = 0, turn = 0, whose = 'you', over = false, streak = 0, disposed = false;

    const pStreak = api.pill('win streak: 0');
    const youScore = h('div', { class: 'pig-score' }, '0');
    const cpuScore = h('div', { class: 'pig-score' }, '0');
    const turnEl = h('div', { class: 'pig-turn' }, 'this turn: 0');
    const die = h('div', { class: 'pig-die' }, '·');
    const msg = h('div', { class: 'pig-msg' }, 'Roll to build your turn. Bank before you bust.');
    const rollBtn = h('button', { class: 'btn primary', type: 'button', onclick: roll }, 'Roll');
    const bankBtn = h('button', { class: 'btn', type: 'button', onclick: bank }, 'Bank');
    root.appendChild(h('div', { class: 'pig' },
      h('div', { class: 'pig-board' },
        h('div', { class: 'pig-col' }, h('span', { class: 'pig-lbl' }, 'YOU'), youScore),
        h('div', { class: 'pig-mid' }, die, turnEl),
        h('div', { class: 'pig-col' }, h('span', { class: 'pig-lbl' }, 'DESKMATE'), cpuScore)),
      msg,
      h('div', { class: 'pig-btns' }, rollBtn, bankBtn)));
    api.button('New game', reset);

    function reset() {
      you = 0; cpu = 0; turn = 0; whose = 'you'; over = false;
      die.textContent = '·'; msg.textContent = 'Roll to build your turn. Bank before you bust.'; msg.className = 'pig-msg';
      busy(false); sync();
    }
    function sync() {
      youScore.textContent = you; cpuScore.textContent = cpu;
      turnEl.textContent = 'this turn: ' + turn; pStreak.textContent = 'win streak: ' + streak;
    }
    function busy(b) { rollBtn.disabled = b; bankBtn.disabled = b || turn === 0; }

    function roll() {
      if (over || whose !== 'you') return;
      const d = randInt(1, 6); die.textContent = PIPS[d];
      if (d === 1) { turn = 0; sync(); msg.textContent = 'Rolled a 1 — turn lost.'; api.sfx.bad(); endTurn(); }
      else { turn += d; api.sfx.blip(380 + d * 40); busy(false); sync(); }
    }
    function bank() {
      if (over || whose !== 'you' || turn === 0) return;
      you += turn; turn = 0; api.sfx.good(); sync();
      if (you >= GOAL) return finish(true);
      msg.textContent = 'Banked. Deskmate rolls…';
      endTurn();
    }
    function endTurn() {
      turn = 0; sync();
      whose = whose === 'you' ? 'cpu' : 'you';
      if (whose === 'cpu') { busy(true); setTimeout(cpuStep.bind(null, 0, 18 + randInt(0, 6)), 650); }
      else busy(false);
    }
    function cpuStep(t, target) {
      if (disposed || over) return;
      const d = randInt(1, 6); die.textContent = PIPS[d];
      if (d === 1) { msg.textContent = 'Deskmate rolled a 1.'; api.sfx.bad(); die.textContent = PIPS[1]; whose = 'you'; turn = 0; busy(false); sync(); return; }
      t += d; turnEl.textContent = 'deskmate turn: ' + t; api.sfx.blip(300);
      if (cpu + t >= GOAL) { cpu += t; sync(); return finish(false); }
      if (t >= target) { cpu += t; msg.textContent = 'Deskmate banks ' + t + '.'; whose = 'you'; turnEl.textContent = 'this turn: 0'; busy(false); sync(); return; }
      setTimeout(cpuStep.bind(null, t, target), 560);
    }
    function finish(youWon) {
      over = true; busy(true);
      if (youWon) { streak++; api.sfx.great(); const r = api.submit(streak); msg.textContent = 'You hit ' + GOAL + '! Win streak ' + streak + '.' + (r.isRecord ? ' Best yet!' : ''); msg.className = 'pig-msg win'; }
      else { streak = 0; api.sfx.bad(); msg.textContent = 'Deskmate reached ' + GOAL + ' first. Streak reset.'; msg.className = 'pig-msg lose'; }
      sync();
    }

    reset();
    return () => { disposed = true; bagg.dispose(); };
  }

  Arcade.register({
    id: 'pig', title: 'Press Your Luck', emoji: 'dice', cat: 'goofy', order: 46,
    blurb: 'A filthy little dice game. Roll to pile up points, but roll a single 1 and the whole turn evaporates. Bank when your nerve gives out. First to 100 against a deskmate who knows exactly when to quit.',
    scoreLabel: 'Win streak', tags: ['dice', 'luck', 'press-your-luck'],
    how: [
      'On your turn, roll as many times as you dare — each roll adds to your turn total.',
      'Roll a 1 and you lose everything built this turn. Bank to keep it and pass the dice.',
      'First to 100 wins. Your deskmate banks around twenty, so out-nerve them.',
      'The score kept is your streak of games won in a row.'
    ],
    mount
  });
})();
