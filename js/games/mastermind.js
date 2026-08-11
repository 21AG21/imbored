/* Password Reset. Mastermind, reframed as guessing your own login before IT calls back. */
(function () {
  'use strict';
  const { h, randInt } = Engine;

  const ROWS = 10;
  /* Peg palette. light = use light text on the peg so the number stays legible. */
  const COLORS = [
    { hex: '#ffcb1f', light: false },
    { hex: '#e8402a', light: true },
    { hex: '#00a6b4', light: false },
    { hex: '#6f3fa8', light: true },
    { hex: '#6fcf2f', light: false },
    { hex: '#ff2d87', light: true },
    { hex: '#2a4bbd', light: true },
    { hex: '#ff8a1f', light: false }
  ];

  function mount(root, api) {
    const bagg = Engine.bag();
    const numColors = api.diffId === 'nightmare' ? 8 : api.diffId === 'hard' ? 7 : 6;
    const STATUS = 'Pick colours 1-' + numColors + ' to fill four slots, then Guess. Black peg = right colour and spot, white = right colour, wrong spot.';

    let secret, rows, cur, done, streak;
    streak = api.load('streak', 0);

    const pStreak = api.pill('Streak: ' + streak);
    const pRow = api.pill('Guess 1/' + ROWS);
    const pColors = api.pill('Colours: ' + numColors);

    const boardEl = h('div', { class: 'mm-board' });
    const palette = h('div', { class: 'mm-palette' });
    const guessBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => guess() }, 'Guess');
    const clearBtn = h('button', { class: 'btn', type: 'button', onclick: () => { if (!done && cur.length) { cur = []; render(); api.sfx.click(); } } }, 'Clear');
    const controls = h('div', { class: 'mm-controls' }, guessBtn, clearBtn);
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.append(boardEl, palette, controls, banner);

    /* doc mode: every swatch is already labelled with its own digit — the
       colour was a redundant second encoding of the same choice, so drop
       it rather than run eight distinct hues through grayscale() into
       eight barely-distinguishable greys. Plain ink-on-paper circles,
       told apart only by the numeral, same as the pegs below. Doc mode
       can be toggled while this game is already mounted (it's a body-
       class + CSS filter flip, not a remount), so this is a function
       re-run from a resize listener below rather than a one-time loop —
       otherwise a mid-session toggle would leave the old palette behind. */
    let lastDocMode = null;
    function renderPalette() {
      const doc = Arcade.docMode();
      if (doc === lastDocMode) return;
      lastDocMode = doc;
      palette.replaceChildren();
      for (let i = 0; i < numColors; i++) {
        const c = COLORS[i];
        palette.appendChild(h('button', {
          class: 'mm-swatch', type: 'button',
          style: doc ? { background: Engine.docPaper(), color: Engine.docInk() } : { background: c.hex, color: c.light ? '#fffdf3' : '#1d1722' },
          onclick: () => place(i)
        }, String(i + 1)));
      }
    }
    renderPalette();
    bagg.listen(window, 'resize', () => { renderPalette(); render(); });

    api.button('New code', newCode);
    api.button('Give up', () => {
      if (done) return;
      done = true;
      streak = 0;
      api.save('streak', 0);
      api.sfx.bad();
      finish(false);
      render();
    });

    /* Standard non-double-counting scoring: blacks first, then whites from what is left. */
    function score(guessArr, code) {
      let black = 0, white = 0;
      const sLeft = [], gLeft = [];
      for (let i = 0; i < 4; i++) {
        if (guessArr[i] === code[i]) black++;
        else { sLeft.push(code[i]); gLeft.push(guessArr[i]); }
      }
      for (let i = 0; i < gLeft.length; i++) {
        const idx = sLeft.indexOf(gLeft[i]);
        if (idx >= 0) { white++; sLeft.splice(idx, 1); }
      }
      return { black: black, white: white };
    }

    function makeSlot(ci, isNext, onClick) {
      const attrs = { class: 'mm-slot' + (ci >= 0 ? ' mm-peg' : '') + (isNext ? ' mm-next' : '') };
      if (onClick) attrs.onclick = onClick;
      const el = h('div', attrs, ci >= 0 ? String(ci + 1) : '');
      if (ci >= 0) {
        /* same reasoning as the palette above: the digit already says
           which colour this is, so doc mode inks the peg instead of
           colouring it. render() rebuilds every slot from scratch on
           every call, so this naturally follows a doc-mode toggle too. */
        if (Arcade.docMode()) {
          el.style.background = Engine.docPaper();
          el.style.color = Engine.docInk();
        } else {
          const c = COLORS[ci];
          el.style.background = c.hex;
          el.style.color = c.light ? '#fffdf3' : '#1d1722';
        }
      }
      return el;
    }

    function place(i) {
      if (done) return;
      if (cur.length >= 4) { api.sfx.thud(); return; }
      cur.push(i);
      api.sfx.click();
      render();
    }

    function guess() {
      if (done) return;
      if (cur.length < 4) { shake(); api.status('Fill all four slots first.'); return; }
      const fb = score(cur, secret);
      rows.push({ pegs: cur.slice(), black: fb.black, white: fb.white });
      api.sfx.blip(360 + fb.black * 90);
      cur = [];
      if (fb.black === 4) {
        done = true;
        streak++;
        api.save('streak', streak);
        api.submit(streak);
        api.sfx.great();
        finish(true);
        render();
        return;
      }
      if (rows.length >= ROWS) {
        done = true;
        streak = 0;
        api.save('streak', 0);
        api.sfx.bad();
        finish(false);
        render();
        return;
      }
      api.status(STATUS);
      render();
    }

    function finish(won) {
      const codeRow = h('div', { class: 'mm-guess mm-reveal' });
      for (let i = 0; i < 4; i++) codeRow.appendChild(makeSlot(secret[i], false, null));
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, won ? 'Access granted.' : 'Locked out.'),
        h('p', null, won
          ? ('Cracked in ' + rows.length + (rows.length === 1 ? ' guess.' : ' guesses.'))
          : 'The password was:'),
        codeRow,
        h('p', { class: 'mm-sub' }, won
          ? ('Streak: ' + streak + '. Best: ' + (api.best() || streak) + '. IT stands down.')
          : 'Streak reset to zero. IT is already dialling your extension.'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => reset() }, 'New password'));
    }

    function shake() {
      const row = boardEl.querySelector('.mm-row.active');
      if (row) {
        row.classList.remove('mm-shake');
        void row.offsetWidth;
        row.classList.add('mm-shake');
      }
      api.sfx.bad();
    }

    function render() {
      boardEl.replaceChildren();
      const activeIdx = done ? -1 : rows.length;
      for (let r = 0; r < ROWS; r++) {
        const data = rows[r];
        const isActive = r === activeIdx;
        const guessWrap = h('div', { class: 'mm-guess' });
        for (let i = 0; i < 4; i++) {
          let ci = -1;
          if (data) ci = data.pegs[i];
          else if (isActive && i < cur.length) ci = cur[i];
          const isNext = isActive && i === cur.length;
          const idx = i;
          const onClick = isActive
            ? function () { if (idx < cur.length) { cur = cur.slice(0, idx); render(); api.sfx.click(); } }
            : null;
          guessWrap.appendChild(makeSlot(ci, isNext, onClick));
        }
        const fbEl = h('div', { class: 'mm-feedback' });
        for (let k = 0; k < 4; k++) {
          let cls = 'mm-fb';
          if (data) {
            if (k < data.black) cls += ' black';
            else if (k < data.black + data.white) cls += ' white';
          }
          fbEl.appendChild(h('div', { class: cls }));
        }
        boardEl.appendChild(h('div', { class: 'mm-row' + (isActive ? ' active' : '') },
          h('div', { class: 'mm-num' }, String(r + 1)), guessWrap, fbEl));
      }
      pStreak.textContent = 'Streak: ' + streak;
      pRow.textContent = 'Guess ' + Math.min(done ? rows.length : rows.length + 1, ROWS) + '/' + ROWS;
      const active = boardEl.querySelector('.mm-row.active');
      if (active) active.scrollIntoView({ block: 'nearest' });
    }

    function reset() {
      secret = [];
      for (let i = 0; i < 4; i++) secret.push(randInt(0, numColors - 1));
      rows = [];
      cur = [];
      done = false;
      banner.style.display = 'none';
      api.status(STATUS);
      render();
    }

    function newCode() {
      if (!done && rows.length > 0) {
        streak = 0;
        api.save('streak', 0);
      }
      reset();
    }

    bagg.add(Engine.onKey((e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') { guess(); return true; }
      if (e.key === 'Backspace') { if (!done && cur.length) { cur.pop(); render(); } return true; }
      const n = parseInt(e.key, 10);
      if (!isNaN(n) && n >= 1 && n <= numColors) { place(n - 1); return true; }
    }));

    reset();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'mastermind',
    usesDigits: true,   // number keys pick pegs — the "1 = Docs" shortcut yields here
    lightBoard: true,   // doc mode inks the pegs/swatches in mount() above; the blanket invert would only flip it back
    title: 'Password Reset',
    emoji: 'mastermind',
    cat: 'brain',
    order: 23,
    blurb: 'Deduce the hidden four-colour password in ten guesses. Feedback pegs tell you how close each guess is.',
    scoreLabel: 'Win streak',
    tags: ['mastermind', 'logic', 'code', 'deduction'],
    how: [
      'Crack the hidden four-peg code in ten guesses.',
      'Tap a palette colour or press 1-8 to fill the four slots, then hit Guess or Enter. Backspace clears the last peg.',
      'A black peg means right colour and right slot. A white peg means right colour, wrong slot. Colours can repeat.',
      'Solve it and your win streak grows by one. A loss resets it to zero.',
      'Chill and normal use six colours, hard uses seven, nightmare eight.'
    ],
    mount
  });
})();
