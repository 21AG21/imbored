/* Data Entry — a typing-speed test wearing an office coat. Type the line exactly;
 * only the correct key moves you on, so words-per-minute is honest and cannot be
 * mashed. Looks like you're deep in a form. */
(function () {
  'use strict';
  const { h, pick } = Engine;

  const PASSAGES = [
    'Please find attached the revised deck reflecting the notes from yesterday.',
    'Circling back to align on deliverables before we loop in the wider team.',
    'The quarterly figures are ready for your review ahead of the Monday sync.',
    'Per my last email, the deadline has moved to the end of the week.',
    'Let us take this offline and reconvene once the blockers are cleared.',
    'Thanks for flagging that; I have updated the tracker and reassigned the task.',
    'The quick brown fox jumps over the lazy dog while the printer jams again.',
    'Kindly confirm receipt and let me know if anything looks off on your end.',
    'We are moving the standup to ten so the whole squad can make it.',
    'Attaching the one pager; happy to walk through it on a quick call today.',
    'A gentle nudge on the invoice, which was due at the start of the month.',
    'The migration finished overnight and every check is green this morning.',
    'Looping you in for visibility; no action needed on your side just yet.',
    'Bandwidth is tight this sprint, so let us prioritise the top three items.',
    'Great work shipping that fix; the numbers already look healthier today.'
  ];

  function mount(root, api) {
    const bagg = Engine.bag();
    let chars = [], state = [], cursor = 0, started = false, done = false;
    let t0 = 0, keystrokes = 0, errors = 0, tickId = 0;

    const pWpm = api.pill('WPM 0');
    const pAcc = api.pill('Acc 100%');
    const pBest = api.pill('');

    const textEl = h('div', { class: 'type-text' });
    const input = h('input', { class: 'type-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'type here', placeholder: 'click here and start typing…' });
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.append(h('div', { class: 'type-wrap' }, textEl, input), banner);

    api.button('New line', reset);

    function reset() {
      const p = pick(PASSAGES);
      chars = p.split('');
      state = chars.map(() => '');
      cursor = 0; started = false; done = false; keystrokes = 0; errors = 0;
      clearInterval(tickId); tickId = 0;
      banner.style.display = 'none';
      input.value = '';
      renderText();
      syncPills();
      api.status('Click the box and type the line exactly. A wrong key will not advance — fix it and keep going. Your speed is words per minute.');
      input.focus();
    }

    function renderText() {
      const spans = chars.map((ch, i) => {
        let cls = 'ch';
        if (state[i] === 'ok') cls += ' ok';
        else if (i === cursor) cls += (state[i] === 'bad' ? ' cur bad' : ' cur');
        return h('span', { class: cls }, ch === ' ' ? '·' : ch);
      });
      textEl.replaceChildren(...spans);
    }

    function liveWpm() {
      if (!started) return 0;
      const mins = (Date.now() - t0) / 60000;
      return mins > 0 ? Math.round((cursor / 5) / mins) : 0;
    }
    function accuracy() { return keystrokes ? Math.round((keystrokes - errors) / keystrokes * 100) : 100; }

    function syncPills() {
      pWpm.textContent = 'WPM ' + liveWpm();
      pAcc.textContent = 'Acc ' + accuracy() + '%';
      const b = api.best();
      pBest.textContent = b == null ? 'no record' : 'best ' + b + ' wpm';
    }

    function onKey(e) {
      if (done) return;
      if (e.key === 'Backspace') { e.preventDefault(); if (cursor > 0 && state[cursor] !== 'bad') { cursor--; state[cursor] = ''; renderText(); } else if (state[cursor] === 'bad') { state[cursor] = ''; renderText(); } return; }
      if (e.key.length !== 1) return;          // ignore shift, arrows, etc.
      e.preventDefault();
      if (!started) { started = true; t0 = Date.now(); tickId = setInterval(syncPills, 200); bagg.add(() => clearInterval(tickId)); }
      keystrokes++;
      if (e.key === chars[cursor]) {
        state[cursor] = 'ok'; cursor++;
        if (cursor >= chars.length) { finish(); return; }
      } else {
        errors++; state[cursor] = 'bad';
        api.sfx.tone({ freq: 150, dur: 0.07, type: 'square', vol: 0.07 });
      }
      renderText(); syncPills();
    }
    bagg.listen(input, 'keydown', onKey);
    /* keep native input empty; we render the passage ourselves */
    bagg.listen(input, 'input', () => { input.value = ''; });

    function finish() {
      done = true;
      clearInterval(tickId); tickId = 0;
      const wpm = liveWpm(), acc = accuracy();
      renderText(); syncPills();
      let res = { isRecord: false, best: api.best() };
      if (acc >= 90) res = api.submit(wpm);          // only clean runs count
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, wpm + ' words per minute'),
        h('p', null, 'Accuracy ' + acc + '%. ' +
          (acc < 90 ? 'Under 90% accuracy, so it does not count — slow down a touch.'
            : res.isRecord ? 'A new personal best!' : res.best != null ? 'Best: ' + res.best + ' wpm.' : '')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Another line'));
    }

    reset();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'typing',
    title: 'Data Entry',
    emoji: 'keys',
    cat: 'brain',
    order: 30,
    blurb: 'A words-per-minute test disguised as a form. Type the line exactly — only the right key advances, so the score is honest — and find out how fast you really are. Looks exactly like work.',
    scoreLabel: 'Best WPM',
    tags: ['typing', 'speed', 'words-per-minute', 'skill'],
    how: [
      'Click the box and type the line shown, character for character, including spaces (drawn as a dot) and punctuation.',
      'It is strict: a wrong key does not move you forward. The current character just turns red until you hit the right one, so you cannot mash your way to a fake score.',
      'Words per minute is measured the standard way — five characters count as one word — from your first keystroke to your last.',
      'Accuracy is the share of keystrokes that were correct. A run only sets a record if you finish at 90% accuracy or better, so speed without control does not count.',
      'Hit New line for a fresh sentence any time. Your best clean WPM is the score to beat.'
    ],
    mount
  });
})();
