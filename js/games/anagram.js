/* Word Scramble — sixty seconds to unscramble as many office words as you can. */
(function () {
  'use strict';
  const { h, randInt } = Engine;
  const WORDS = ['MEETING', 'DEADLINE', 'BUDGET', 'PRINTER', 'COFFEE', 'KEYBOARD', 'MONITOR',
    'PROJECT', 'MANAGER', 'INVOICE', 'NETWORK', 'LAPTOP', 'FOLDER', 'AGENDA', 'QUARTER',
    'SYNERGY', 'PIVOT', 'STANDUP', 'BACKLOG', 'ROADMAP', 'CUBICLE', 'STAPLER', 'LANYARD',
    'PAYROLL', 'COMMUTE', 'EXPENSE'];
  const SPRINT = 60;

  function scramble(w) {
    const a = w.split('');
    let out;
    do {
      for (let i = a.length - 1; i > 0; i--) { const j = randInt(0, i); const t = a[i]; a[i] = a[j]; a[j] = t; }
      out = a.join('');
    } while (out === w && w.length > 1);
    return out;
  }

  function mount(root, api) {
    const bagg = Engine.bag();
    let word = '', solved = 0, timeLeft = SPRINT, running = false, disposed = false, acc = 0;

    const pSolved = api.pill('solved: 0');
    const pTime = api.pill('time: ' + SPRINT + 's');
    const scr = h('div', { class: 'ana-scramble' }, '');
    const input = h('input', { class: 'ana-input', type: 'text', spellcheck: 'false', autocomplete: 'off', placeholder: 'unscramble it…' });
    const msg = h('div', { class: 'ana-msg' }, '');
    const form = h('form', { class: 'ana-form' }, input, h('button', { class: 'btn primary', type: 'submit' }, 'Enter'));
    form.addEventListener('submit', (e) => { e.preventDefault(); check(); });
    root.appendChild(h('div', { class: 'anagram' }, scr, form,
      h('div', { class: 'ana-row' }, h('button', { class: 'btn', type: 'button', onclick: newWord }, 'Skip')), msg));
    api.button('Start / restart', start);

    function start() {
      solved = 0; timeLeft = SPRINT; running = true;
      msg.textContent = ''; msg.className = 'ana-msg';
      input.disabled = false; input.value = '';
      newWord(); sync(); try { input.focus(); } catch (e) { /* */ }
      api.status('Unscramble as many office words as you can in ' + SPRINT + ' seconds. Enter to submit, Skip for a new word.');
    }
    function newWord() {
      word = WORDS[randInt(0, WORDS.length - 1)];
      scr.textContent = scramble(word);
      input.value = ''; if (running) try { input.focus(); } catch (e) { /* */ }
    }
    function check() {
      if (!running) return;
      if (input.value.trim().toUpperCase() === word) {
        solved++; api.sfx.good(); msg.textContent = '✓ ' + word; msg.className = 'ana-msg win';
        api.submit(solved); newWord(); sync();
      } else {
        api.sfx.bad(); scr.classList.remove('shake'); void scr.offsetWidth; scr.classList.add('shake');
      }
    }
    function sync() { pSolved.textContent = 'solved: ' + solved; pTime.textContent = 'time: ' + Math.ceil(timeLeft) + 's'; }
    function end() {
      running = false; input.disabled = true; api.sfx.great();
      const r = api.submit(solved);
      msg.textContent = 'Time! ' + solved + ' solved.' + (r.isRecord ? ' New best!' : '');
      msg.className = 'ana-msg win';
    }

    bagg.add(Engine.loop((dt) => {
      if (!running || disposed) return;
      timeLeft -= dt; acc += dt;
      if (acc > 0.25) { acc = 0; sync(); }
      if (timeLeft <= 0) { timeLeft = 0; sync(); end(); }
    }));

    start();
    return () => { disposed = true; bagg.dispose(); };
  }

  Arcade.register({
    id: 'anagram', title: 'Word Scramble', emoji: 'wordguess', cat: 'brain', order: 28,
    blurb: 'Sixty seconds, a pile of jumbled office words, and your slowly-rising panic. Unscramble as many as you can before the clock runs out.',
    scoreLabel: 'Best (60s)', tags: ['word', 'speed', 'spelling'],
    how: [
      'A scrambled office word appears. Type the real word and press Enter.',
      'Each correct answer scores a point and serves up the next word.',
      'Stuck? Skip for a fresh one — it costs no points, only precious seconds.',
      'You have sixty seconds. The score kept is the most you have solved in one run.'
    ],
    mount
  });
})();
