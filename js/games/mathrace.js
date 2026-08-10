/* Timesheet Math — quick arithmetic against the clock. Look busy, get faster. */
(function () {
  'use strict';
  const { h, randInt } = Engine;

  function mount(root, api) {
    const bagg = Engine.bag();
    const SECS = Math.round(60 * (api.dm > 1 ? 1 : 1));   // fixed 60s window
    let a, b, op, answer, score, timeLeft, running, disposed = false, acc = 0, streak = 0;

    const pScore = api.pill('solved: 0');
    const pTime = api.pill('time: 60s');
    const pStreak = api.pill('streak: 0');
    const q = h('div', { class: 'mr-q' }, '');
    const input = h('input', { class: 'mr-input', type: 'text', inputmode: 'numeric', spellcheck: 'false', autocomplete: 'off', placeholder: '?' });
    const form = h('form', { class: 'mr-form' }, input, h('button', { class: 'btn primary', type: 'submit' }, 'Enter'));
    form.addEventListener('submit', (e) => { e.preventDefault(); check(); });
    const msg = h('div', { class: 'mr-msg' }, '');
    root.appendChild(h('div', { class: 'mathrace' }, q, form, msg));
    api.button('Start / restart', start);

    /* harder difficulty = bigger numbers and more multiplication */
    function nextQ() {
      const hard = api.dm;
      const ops = hard > 1.4 ? ['+', '-', '×', '×'] : hard > 0.8 ? ['+', '-', '×'] : ['+', '-'];
      op = ops[randInt(0, ops.length - 1)];
      if (op === '×') { a = randInt(2, Math.round(6 + hard * 4)); b = randInt(2, Math.round(6 + hard * 3)); answer = a * b; }
      else {
        const hi = Math.round(12 + hard * 30);
        a = randInt(2, hi); b = randInt(2, hi);
        if (op === '-') { if (b > a) { const t = a; a = b; b = t; } answer = a - b; }
        else answer = a + b;
      }
      q.textContent = a + ' ' + op + ' ' + b + ' =';
      input.value = ''; if (running) try { input.focus(); } catch (e) { /* */ }
    }
    function start() {
      score = 0; timeLeft = SECS; running = true; acc = 0; streak = 0;
      msg.textContent = ''; msg.className = 'mr-msg'; input.disabled = false;
      nextQ(); sync(); try { input.focus(); } catch (e) { /* */ }
      api.status('Answer as many as you can in ' + SECS + ' seconds. Type the number and press Enter. Wrong answers cost you three seconds.');
    }
    function sync() {
      pScore.textContent = 'solved: ' + score;
      pTime.textContent = 'time: ' + Math.max(0, Math.ceil(timeLeft)) + 's';
      pStreak.textContent = 'streak: ' + streak;
      pStreak.className = 'pill' + (streak >= 3 ? ' good' : '');
    }
    function check() {
      if (!running) return;
      if (input.value.trim() === '') return;
      if (parseInt(input.value, 10) === answer) {
        score++; streak++;
        api.sfx.tone({ freq: 500 + streak * 40, dur: 0.08, type: 'triangle', vol: 0.12 });
        api.submit(score); nextQ(); sync();
      }
      else { streak = 0; api.sfx.bad(); timeLeft -= 3; q.classList.remove('shake'); void q.offsetWidth; q.classList.add('shake'); input.value = ''; sync(); }
    }
    function end() {
      running = false; input.disabled = true; streak = 0; api.sfx.great();
      const r = api.submit(score);
      msg.textContent = 'Time! ' + score + ' solved.' + (r.isRecord ? ' New best!' : '');
      msg.className = 'mr-msg win';
      sync();
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
    id: 'mathrace', title: 'Timesheet Math', emoji: 'workbook', cat: 'brain', order: 32,
    lightBoard: true,   // plain text on the page — the luminance flip would turn the sum white-on-white

    blurb: 'Sixty seconds of quick arithmetic. Answer as many as you can; wrong answers cost time. Harder settings mean bigger numbers and more multiplication.',
    scoreLabel: 'Best (60s)', tags: ['maths', 'speed', 'mental'],
    how: [
      'A sum appears. Type the answer and press Enter.',
      'Each correct answer scores a point and loads the next.',
      'A wrong answer costs three seconds, so be sure before you commit.',
      'Your score is the most you solve in one sixty-second run.'
    ],
    mount
  });
})();
