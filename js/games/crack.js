/* Number Cracker — bulls and cows. Guess the secret four-digit code. */
(function () {
  'use strict';
  const { h, shuffle } = Engine;
  const LEN = 4, MAXG = 10;

  function mount(root, api) {
    const bagg = Engine.bag();
    const maxg = Engine.clamp(Math.round(11 - api.dm * 2), 5, 12);   // fewer guesses on harder tiers
    let secret, guesses, over, streak, disposed = false;
    streak = api.load('streak', 0);

    const pStreak = api.pill('win streak: ' + streak);
    const pLeft = api.pill('guesses: ' + maxg);
    const list = h('div', { class: 'crk-list' });
    const input = h('input', { class: 'crk-input', type: 'text', inputmode: 'numeric', maxlength: String(LEN), placeholder: '4 digits', spellcheck: 'false', autocomplete: 'off' });
    const form = h('form', { class: 'crk-form' }, input, h('button', { class: 'btn primary', type: 'submit' }, 'Guess'));
    form.addEventListener('submit', (e) => { e.preventDefault(); guess(); });
    const msg = h('div', { class: 'crk-msg' }, '');
    root.appendChild(h('div', { class: 'cracker' },
      h('div', { class: 'crk-help' }, 'Four different digits (0-9). ● = right digit, right spot. ○ = right digit, wrong spot.'),
      list, form, msg));
    api.button('New code', reset);

    function newSecret() {
      const digits = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, LEN);
      return digits.join('');
    }
    function reset() {
      secret = newSecret(); guesses = []; over = false;
      list.replaceChildren(); msg.textContent = ''; msg.className = 'crk-msg';
      input.disabled = false; input.value = ''; try { input.focus(); } catch (e) { /* */ }
      pLeft.textContent = 'guesses: ' + maxg; pStreak.textContent = 'win streak: ' + streak;
      api.status('Crack the four-digit code. Each digit is different. Read the pegs and narrow it down.');
    }
    function score(g) {
      let bulls = 0, cows = 0;
      for (let i = 0; i < LEN; i++) {
        if (g[i] === secret[i]) bulls++;
        else if (secret.indexOf(g[i]) >= 0) cows++;
      }
      return { bulls, cows };
    }
    function guess() {
      if (over) return;
      const g = input.value.trim();
      if (!/^[0-9]{4}$/.test(g)) { shake(); msg.textContent = 'Enter four digits.'; msg.className = 'crk-msg lose'; return; }
      if (new Set(g.split('')).size !== LEN) { shake(); msg.textContent = 'All four digits must be different.'; msg.className = 'crk-msg lose'; return; }
      const { bulls, cows } = score(g);
      guesses.push(g);
      const pegs = h('span', { class: 'crk-pegs' });
      for (let i = 0; i < bulls; i++) pegs.appendChild(h('span', { class: 'crk-peg bull' }));
      for (let i = 0; i < cows; i++) pegs.appendChild(h('span', { class: 'crk-peg cow' }));
      for (let i = 0; i < LEN - bulls - cows; i++) pegs.appendChild(h('span', { class: 'crk-peg' }));
      const rowEl = h('div', { class: 'crk-row' }, h('span', { class: 'crk-guess' }, g.split('').map((d) => h('span', { class: 'crk-digit' }, d))), pegs);
      list.appendChild(rowEl);
      list.scrollTop = list.scrollHeight;
      /* brief flash on the newest row: a stronger pop when a digit lands right */
      rowEl.style.transition = 'background-color .6s ease, transform .2s ease';
      rowEl.style.transform = 'scale(1.04)';
      if (bulls > 0) rowEl.style.backgroundColor = 'var(--lime)';
      void rowEl.offsetWidth;
      requestAnimationFrame(() => { rowEl.style.transform = ''; rowEl.style.backgroundColor = ''; });
      input.value = ''; msg.textContent = ''; msg.className = 'crk-msg';
      pLeft.textContent = 'guesses: ' + (maxg - guesses.length);
      if (bulls === LEN) { over = true; streak++; api.save('streak', streak); api.submit(streak); api.sfx.great(); msg.textContent = 'Cracked it in ' + guesses.length + '! Streak ' + streak + '.'; msg.className = 'crk-msg win'; input.disabled = true; return; }
      api.sfx[bulls > 0 ? 'good' : 'click']();
      if (guesses.length >= maxg) { over = true; streak = 0; api.save('streak', 0); api.sfx.bad(); msg.textContent = 'Out of guesses. The code was ' + secret + '.'; msg.className = 'crk-msg lose'; input.disabled = true; return; }
      try { input.focus(); } catch (e) { /* */ }
    }
    function shake() { input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake'); api.sfx.bad(); }

    reset();
    return () => { disposed = true; bagg.dispose(); };
  }

  Arcade.register({
    id: 'crack', title: 'Number Cracker', emoji: 'find', cat: 'brain', order: 31,
    blurb: 'A hidden four-digit code, ten guesses. After each try you learn how many digits are right and how many are in the wrong spot. Deduce the rest.',
    scoreLabel: 'Win streak', tags: ['logic', 'deduction', 'numbers'],
    how: [
      'The code is four different digits. Type a guess and press Guess.',
      'A filled peg (●) means a digit is correct and in the right place.',
      'A hollow peg (○) means the digit is in the code but somewhere else.',
      'Crack it within ten guesses. Your score is the streak of codes cracked in a row.'
    ],
    mount
  });
})();
