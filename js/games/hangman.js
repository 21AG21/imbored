/* Hangman — guess the office word before the little face gives up. */
(function () {
  'use strict';
  const { h } = Engine;
  /* the severity face is a colour emoji glyph — emoji bake in their own
     gradient shading that survives the doc filter's grayscale as visible
     grey no matter what runs over them (see css/arcade.css for the fuller
     note), so doc mode swaps in a drawn line-art face instead: a plain
     stroked circle whose mouth curve and eyes are computed from the same
     0..6 severity index the emoji array already uses. Both faces are kept
     in the DOM at all times and CSS toggles which one shows, the same
     "flips live with no re-render" contract every other doc-mode style in
     this file relies on. */
  function faceSVG(i) {
    const t = Engine.clamp(i / 6, 0, 1);
    const dead = i >= 6;
    const eyes = dead
      ? '<path d="M8 9l4 4M12 9l-4 4M17 9l4 4M21 9l-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
      : '<circle cx="10.5" cy="11.5" r="1.5" fill="currentColor"/><circle cx="18.5" cy="11.5" r="1.5" fill="currentColor"/>';
    const my = 18, bow = 6 - t * 12;
    return '<svg viewBox="0 0 29 29" width="54" height="54" fill="none" aria-hidden="true">' +
      '<circle cx="14.5" cy="14.5" r="12.5" stroke="currentColor" stroke-width="1.6"/>' +
      eyes +
      '<path d="M9 ' + my + ' Q14.5 ' + (my + bow) + ' 20 ' + my + '" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '</svg>';
  }
  const WORDS = ['COFFEE', 'EMAIL', 'MONDAY', 'LUNCH', 'DESK', 'CHAIR', 'MOUSE', 'INBOX',
    'PENCIL', 'STAPLER', 'PRINTER', 'MEETING', 'DEADLINE', 'BUDGET', 'COMMUTE', 'PARKING',
    'PAYROLL', 'SNACK', 'NAPTIME', 'WEEKEND', 'MEMO', 'BOSS', 'RAISE', 'SPREADSHEET',
    'KEYBOARD', 'SYNERGY', 'ROADMAP', 'STANDUP', 'BACKLOG', 'CUBICLE', 'ELEVATOR',
    'PROJECTOR', 'FIREWALL', 'INVOICE', 'QUARTERLY', 'ONBOARDING', 'WHITEBOARD'];
  const FACES = ['🙂', '😐', '😟', '😧', '😨', '😱', '💀'];
  const STAGES = 6;
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  function mount(root, api) {
    const bagg = Engine.bag();
    const stages = Engine.clamp(Math.round(7 - (api.dm - 0.6) * 1.5), 4, 7);   // 7/6/5/4 misses by tier — classic-generous by default
    let word = '', guessed = {}, misses = 0, streak = 0, over = false;

    const pStreak = api.pill('streak: 0');
    const pLives = api.pill('misses: 0/' + stages);
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
      /* freebies: hand over the first letter and one vowel so nobody stares at a
         wall of blanks — friendlier, less frustrating, and you get going faster */
      reveal(word[0]);
      const vowels = word.slice(1).split('').filter((ch) => 'AEIOU'.indexOf(ch) >= 0);
      if (vowels.length) reveal(vowels[Math.floor(Math.random() * vowels.length)]);
      render();
      if (word.split('').every((ch) => guessed[ch])) { win(); return; }
      api.status('Guess the office word. The first letter and a vowel are already filled in. ' + stages + ' misses ends it — type or tap letters.');
    }
    function reveal(ch) {
      if (guessed[ch] !== undefined) return;
      guessed[ch] = ch;
      if (keyBtns[ch]) { keyBtns[ch].disabled = true; keyBtns[ch].classList.add('hit'); }
    }
    function render() {
      wordEl.replaceChildren.apply(wordEl, word.split('').map((ch) =>
        h('span', { class: 'hm-slot' + (guessed[ch] || over ? ' shown' : '') }, guessed[ch] || over ? ch : '')));
      pStreak.textContent = 'streak: ' + streak;
      pLives.textContent = 'misses: ' + misses + '/' + stages;
      face.textContent = FACES[Math.min(6, Math.round(misses / stages * 6))];
    }
    function guess(c) {
      if (over || guessed[c] !== undefined) return;
      keyBtns[c].disabled = true;
      if (word.indexOf(c) >= 0) {
        guessed[c] = c; keyBtns[c].classList.add('hit'); api.sfx.blip(700); render();
        if (word.split('').every((ch) => guessed[ch])) win();
      } else {
        guessed[c] = null; keyBtns[c].classList.add('miss'); misses++; api.sfx.bad(); render();
        if (misses >= stages) lose();
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
    lightBoard: true,   // plain text on the page — the invert filter washed the revealed letters and blank-slot underlines out
    usesLetters: true,
    blurb: 'A hidden office word shown as blanks. Guess letters before six misses fill in the little face. Words are all cubicle stock like deadline, spreadsheet and synergy.',
    scoreLabel: 'Best streak', tags: ['word', 'classic', 'spelling'],
    how: [
      'A hidden word shows as blanks, with the first letter and one vowel already filled in to start you off. Guess the rest by tapping the keys or typing them.',
      'A correct letter fills every spot it appears; a wrong one adds a miss.',
      'Run out of misses and the round is lost (seven on Chill, down to four on Nightmare). Solve the word to extend your streak.',
      'Your score is the longest run of words solved in a row.'
    ],
    mount
  });
})();
