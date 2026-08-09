/* Hangman — guess the office word before the little face gives up. */
(function () {
  'use strict';
  const { h } = Engine;
  const WORDS = ['SPREADSHEET', 'DEADLINE', 'MEETING', 'SYNERGY', 'KEYBOARD', 'STAPLER',
    'PRINTER', 'BUDGET', 'QUARTERLY', 'ONBOARDING', 'BANDWIDTH', 'ROADMAP', 'STANDUP',
    'INVOICE', 'FIREWALL', 'LATENCY', 'BACKLOG', 'CUBICLE', 'LANYARD', 'WHITEBOARD',
    'ELEVATOR', 'PROJECTOR', 'PARKING', 'COMMUTE', 'PAYROLL', 'HEADCOUNT'];
  const FACES = ['🙂', '😐', '😟', '😧', '😨', '😱', '💀'];
  const STAGES = 6;
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  function mount(root, api) {
    const bagg = Engine.bag();
    let word = '', guessed = {}, misses = 0, streak = 0, over = false;

    const pStreak = api.pill('streak: 0');
    const pLives = api.pill('misses: 0/' + STAGES);
    const face = h('div', { class: 'hm-gallows' }, FACES[0]);
    const wordEl = h('div', { class: 'hm-word' });
    const msg = h('div', { class: 'hm-msg' }, '');
    const keysEl = h('div', { class: 'hm-keys' });
    root.appendChild(h('div', { class: 'hangman' }, face, wordEl, msg, keysEl));
    api.button('New word', next);

    const keyBtns = {};
    ALPHA.forEach((c) => {
      const b = h('button', { class: 'btn hm-key', type: 'button', onclick: () => guess(c) }, c);
      keyBtns[c] = b; keysEl.appendChild(b);
    });

    function next() {
      word = WORDS[Math.floor(Math.random() * WORDS.length)];
      guessed = {}; misses = 0; over = false;
      ALPHA.forEach((c) => { keyBtns[c].disabled = false; keyBtns[c].className = 'btn hm-key'; });
      msg.textContent = ''; msg.className = 'hm-msg';
      render();
      api.status('Guess the hidden office word a letter at a time. Six misses ends it. Type letters or tap the keys.');
    }
    function render() {
      wordEl.replaceChildren.apply(wordEl, word.split('').map((ch) =>
        h('span', { class: 'hm-slot' + (guessed[ch] || over ? ' shown' : '') }, guessed[ch] || over ? ch : '')));
      pStreak.textContent = 'streak: ' + streak;
      pLives.textContent = 'misses: ' + misses + '/' + STAGES;
      face.textContent = FACES[Math.min(misses, STAGES)];
    }
    function guess(c) {
      if (over || guessed[c] !== undefined) return;
      keyBtns[c].disabled = true;
      if (word.indexOf(c) >= 0) {
        guessed[c] = c; keyBtns[c].classList.add('hit'); api.sfx.blip(700); render();
        if (word.split('').every((ch) => guessed[ch])) win();
      } else {
        guessed[c] = null; keyBtns[c].classList.add('miss'); misses++; api.sfx.bad(); render();
        if (misses >= STAGES) lose();
      }
    }
    function win() {
      over = true; streak++; api.sfx.great();
      const r = api.submit(streak);
      msg.textContent = 'Got it — ' + word + '! Streak ' + streak + '.' + (r.isRecord ? ' Best yet!' : '');
      msg.className = 'hm-msg win'; render();
    }
    function lose() {
      over = true; streak = 0; api.sfx.bad();
      msg.textContent = 'It was ' + word + '. Streak reset — tap New word.';
      msg.className = 'hm-msg lose'; render();
    }

    bagg.add(Engine.onKey((e) => {
      const c = (e.key || '').toUpperCase();
      if (c.length === 1 && c >= 'A' && c <= 'Z') { guess(c); return true; }
      if (e.key === 'Enter' && over) { next(); return true; }
    }));

    next();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'hangman', title: 'Hangman', emoji: 'find', cat: 'brain', order: 27,
    usesLetters: true,
    blurb: 'A hidden office word shown as blanks. Guess letters before six misses fill in the little face. Words are all cubicle stock like deadline, spreadsheet and synergy.',
    scoreLabel: 'Best streak', tags: ['word', 'classic', 'spelling'],
    how: [
      'A hidden word shows as blanks. Guess letters by tapping the keys or typing them.',
      'A correct letter fills every spot it appears; a wrong one adds a miss.',
      'Six misses loses the round. Solve the word to extend your streak.',
      'Your score is the longest run of words solved in a row.'
    ],
    mount
  });
})();
