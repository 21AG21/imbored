/* Memo Decoder — a cryptogram. Every letter has been swapped for another; work
   out the substitution and read the office platitude underneath. */
(function () {
  'use strict';
  const { h, clamp, randInt, shuffle } = Engine;
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  /* short, self-contained office lines — common words so they're deducible */
  const PHRASES = [
    'LETS CIRCLE BACK ON THIS OFFLINE',
    'PLEASE FIND ATTACHED THE REVISED DECK',
    'PER MY LAST EMAIL THE DEADLINE STANDS',
    'THE PRINTER IS OUT OF TONER AGAIN',
    'THIS MEETING COULD HAVE BEEN AN EMAIL',
    'LOW HANGING FRUIT FOR A QUICK WIN',
    'LETS TAKE THIS CONVERSATION TO A BREAKOUT',
    'MOVING THE NEEDLE ON KEY DELIVERABLES',
    'HAPPY TO SYNC ON BANDWIDTH TOMORROW',
    'THE COFFEE MACHINE IS DOWN ON THE THIRD FLOOR',
    'RUNNING IT UP THE FLAGPOLE FOR VISIBILITY',
    'WE ARE BOILING THE OCEAN ON THIS ONE',
    'ADDING A PLACEHOLDER UNTIL WE HAVE NUMBERS',
    'THANKS FOR YOUR PATIENCE ON THE TICKET',
    'A GENTLE NUDGE ON MY EARLIER REQUEST',
    'THE QUARTERLY REVIEW HAS BEEN PUSHED AGAIN',
    'LOOPING IN THE WIDER TEAM FOR AWARENESS',
    'CAN WE PARK THAT IDEA FOR NOW',
    'DOUBLE CLICKING ON THE ACTION ITEMS',
    'MY CALENDAR IS A DISASTER THIS WEEK'
  ];

  function mount(root, api) {
    const bagg = Engine.bag();
    let phrase, enc, guess, locked, sel, over, disposed = false;

    const pSolved = api.pill('solved: ' + api.load('solved', 0));
    const pFilled = api.pill('0 / 0');
    const msg = h('div', { class: 'cg-msg' }, '');
    const puzzle = h('div', { class: 'cg-puzzle' });
    const keys = h('div', { class: 'cg-keys' });
    root.appendChild(h('div', { class: 'cryptogram' }, msg, puzzle, keys));
    api.button('New memo', fresh);
    api.button('Reveal a letter', hintOne);

    function makeCipher() {
      // a derangement of the alphabet: no letter maps to itself
      let perm;
      do { perm = shuffle(A); } while (perm.some((c, i) => c === A[i]));
      const map = {};
      A.forEach((c, i) => { map[c] = perm[i]; });
      return map;
    }

    function fresh() {
      phrase = PHRASES[randInt(0, PHRASES.length - 1)];
      const cipher = makeCipher();
      enc = phrase.split('').map((ch) => (/[A-Z]/.test(ch) ? cipher[ch] : ch));
      guess = {};          // cipherLetter -> guessed plain
      locked = {};         // cipherLetter -> true for freebies (can't change)
      sel = null; over = false;
      // freebies: chill hands you several starter letters, nightmare almost none
      const freebies = clamp(Math.round(6 - api.dm * 2), 0, 6);
      const cipherLettersUsed = [...new Set(enc.filter((c) => /[A-Z]/.test(c)))];
      shuffle(cipherLettersUsed).slice(0, freebies).forEach((cl) => {
        const plain = Object.keys(cipher).find((k) => cipher[k] === cl);
        guess[cl] = plain; locked[cl] = true;
      });
      msg.textContent = ''; msg.className = 'cg-msg';
      buildKeys(); render();
      api.status('Every letter was swapped for another. Tap a coded letter to select it, then tap or type the letter you think it stands for — every copy updates at once. Decode the whole memo.');
    }

    function render() {
      puzzle.replaceChildren();
      const words = [];
      let cur = [];
      enc.forEach((ch, i) => {
        if (ch === ' ') { words.push(cur); cur = []; }
        else cur.push({ ch, i });
      });
      words.push(cur);
      for (const w of words) {
        const wEl = h('div', { class: 'cg-word' });
        for (const { ch } of w) {
          if (!/[A-Z]/.test(ch)) { wEl.appendChild(h('span', { class: 'cg-punc' }, ch)); continue; }
          const g = guess[ch] || '';
          const cell = h('button', {
            class: 'cg-cell' + (sel === ch ? ' sel' : '') + (locked[ch] ? ' lock' : '') + (g ? ' filled' : ''),
            type: 'button', onclick: () => selectLetter(ch)
          }, h('b', { class: 'cg-plain' }, g || ''), h('span', { class: 'cg-code' }, ch));
          wEl.appendChild(cell);
        }
        puzzle.appendChild(wEl);
      }
      const total = new Set(enc.filter((c) => /[A-Z]/.test(c))).size;
      const done = new Set(Object.keys(guess).filter((k) => guess[k])).size;
      pFilled.textContent = done + ' / ' + total;
    }

    function buildKeys() {
      keys.replaceChildren();
      ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].forEach((row, ri) => {
        const rowEl = h('div', { class: 'cg-keyrow' });
        if (ri === 2) rowEl.appendChild(mkKey('⌫', 'clear', 'wide'));
        row.split('').forEach((c) => rowEl.appendChild(mkKey(c, c)));
        keys.appendChild(rowEl);
      });
    }
    function mkKey(label, val, cls) {
      const used = val.length === 1 && Object.keys(guess).some((k) => !locked[k] && guess[k] === val || locked[k] && guess[k] === val);
      const b = h('button', { class: 'cg-key ' + (cls || '') + (used ? ' used' : ''), type: 'button' }, label);
      bagg.listen(b, 'click', () => { if (val === 'clear') clearSel(); else assign(val); });
      return b;
    }

    function selectLetter(cl) {
      if (over || locked[cl]) { if (locked[cl]) api.sfx.thud(); return; }
      sel = (sel === cl ? null : cl); api.sfx.click(); render();
    }
    function assign(plain) {
      if (over || !sel) { if (!sel) msg.textContent = 'Tap a coded letter first.'; return; }
      guess[sel] = plain; api.sfx.blip(560);
      // advance selection to the next unsolved coded letter for flow
      sel = null;
      render(); buildKeys(); checkWin();
    }
    function clearSel() {
      if (over || !sel) return;
      delete guess[sel]; api.sfx.click(); render(); buildKeys();
    }
    function hintOne() {
      if (over) return;
      const cipherLettersUsed = [...new Set(enc.filter((c) => /[A-Z]/.test(c)))];
      // reveal a coded letter that's currently wrong or empty
      const wrong = cipherLettersUsed.filter((cl) => {
        const pos = enc.indexOf(cl);
        return guess[cl] !== phrase[pos];
      });
      if (!wrong.length) { msg.textContent = 'Every letter is already right.'; return; }
      const cl = wrong[randInt(0, wrong.length - 1)];
      const pos = enc.indexOf(cl);
      guess[cl] = phrase[pos]; locked[cl] = true;
      api.sfx.tone ? api.sfx.tone(660) : api.sfx.blip(660);
      sel = null; render(); buildKeys(); checkWin();
    }
    function checkWin() {
      for (let i = 0; i < enc.length; i++) {
        const c = enc[i];
        if (!/[A-Z]/.test(c)) continue;
        if (guess[c] !== phrase[i]) return;
      }
      over = true; api.sfx.great();
      const s = api.load('solved', 0) + 1; api.save('solved', s); api.submit(s);
      pSolved.textContent = 'solved: ' + s;
      msg.textContent = 'Decoded! “' + phrase + '”'; msg.className = 'cg-msg win';
      try { const r = msg.getBoundingClientRect(); Engine.fx.burst(r.left + r.width / 2, r.top + 14, 42); } catch (e) { /* ignore */ }
      render();
    }

    bagg.add(Engine.onKey((e) => {
      if (Engine.isEditable(e.target)) return;
      if (/^[a-z]$/i.test(e.key)) { assign(e.key.toUpperCase()); return true; }
      if (e.key === 'Backspace') { clearSel(); return true; }
    }));

    fresh();
    return () => { disposed = true; bagg.dispose(); };
  }

  Arcade.register({
    id: 'cryptogram', title: 'Memo Decoder', emoji: 'cipher', cat: 'brain', order: 27,
    blurb: 'A cryptogram of office-speak. Every letter has been swapped for another; crack the substitution and read the platitude underneath. Chill hands you a few letters to start; harder settings do not.',
    scoreLabel: 'Solved', tags: ['word', 'logic', 'cipher'],
    how: [
      'The memo has been enciphered — each letter always stands for the same other letter.',
      'Tap a coded letter to select it, then tap or type the letter you think it really is. Every copy of that code updates together.',
      'Use letter patterns and short words (a lone letter is usually A or I) to break in.',
      'Fill every letter correctly to decode the memo. Reveal a letter if you get stuck.'
    ],
    mount
  });
})();
