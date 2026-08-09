/* Desk Duel — rock, paper, scissors against a colleague who never blinks. */
(function () {
  'use strict';
  const { h, randInt } = Engine;
  const MOVES = [
    { id: 'rock', label: 'Rock', ico: '✊', beats: 'scissors' },
    { id: 'paper', label: 'Paper', ico: '✋', beats: 'rock' },
    { id: 'scissors', label: 'Scissors', ico: '✌️', beats: 'paper' }
  ];
  const ico = (id) => MOVES.find((m) => m.id === id).ico;

  function mount(root, api) {
    const bagg = Engine.bag();
    let streak = 0;

    const pStreak = api.pill('streak: 0');
    const pBest = api.pill('best: 0');
    const youCard = h('div', { class: 'rps-hand' }, '❔');
    const cpuCard = h('div', { class: 'rps-hand' }, '❔');
    const verdict = h('div', { class: 'rps-verdict' }, 'Throw a move.');
    const btns = h('div', { class: 'rps-btns' }, MOVES.map((m) =>
      h('button', { class: 'btn rps-btn', type: 'button', onclick: () => play(m.id) }, m.ico + ' ' + m.label)));
    root.appendChild(h('div', { class: 'rps' },
      h('div', { class: 'rps-row' },
        h('div', { class: 'rps-side' }, h('span', { class: 'rps-lbl' }, 'YOU'), youCard),
        verdict,
        h('div', { class: 'rps-side' }, h('span', { class: 'rps-lbl' }, 'DESKMATE'), cpuCard)),
      btns));

    function sync() {
      pStreak.textContent = 'streak: ' + streak;
      pBest.textContent = 'best: ' + (api.best() || 0);
    }
    function play(myId) {
      const cpu = MOVES[randInt(0, 2)];
      youCard.textContent = ico(myId);
      cpuCard.textContent = cpu.ico;
      const me = MOVES.find((m) => m.id === myId);
      if (myId === cpu.id) { verdict.textContent = 'Tie'; verdict.className = 'rps-verdict tie'; api.sfx.click(); }
      else if (me.beats === cpu.id) {
        streak++; verdict.textContent = 'You win!'; verdict.className = 'rps-verdict win'; api.sfx.good();
        api.submit(streak);
      } else {
        if (streak) api.sfx.bad(); else api.sfx.thud();
        streak = 0; verdict.textContent = 'They got you'; verdict.className = 'rps-verdict lose';
      }
      sync();
    }

    api.status('Pick rock, paper or scissors. Longest winning streak is what counts.');
    sync();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'rps', title: 'Desk Duel', emoji: 'circle', cat: 'brain', order: 26,
    blurb: 'Rock, paper, scissors against a deskmate who throws at random. Chase the longest winning streak you can string together.',
    scoreLabel: 'Best streak', tags: ['quick', 'luck', 'classic'],
    how: [
      'Pick rock, paper or scissors. Your deskmate picks at the same moment, at random.',
      'Rock beats scissors, scissors beats paper, paper beats rock. Matching throws tie and nothing changes.',
      'Every win extends your streak. One loss resets it to zero.',
      'Your score is the longest streak you manage.'
    ],
    mount
  });
})();
