/* Sudoku. Every puzzle is generated and then checked to have exactly one
   solution, so there is never a guess and never a dead end. */
(function () {
  'use strict';
  const { h, clamp, randInt, shuffle } = Engine;

  const N = 9;
  const idx = (r, c) => r * N + c;

  /* ---------------- solver ---------------- */
  function candidates(g, r, c) {
    let used = 0;
    for (let i = 0; i < N; i++) {
      used |= 1 << g[idx(r, i)];
      used |= 1 << g[idx(i, c)];
    }
    const br = r - r % 3, bc = c - c % 3;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) used |= 1 << g[idx(br + i, bc + j)];
    const out = [];
    for (let v = 1; v <= 9; v++) if (!(used & (1 << v))) out.push(v);
    return out;
  }

  /* fills the grid in place; returns true once complete */
  function fill(g) {
    let best = -1, bestList = null;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const list = candidates(g, Math.floor(i / N), i % N);
      if (!list.length) return false;
      if (!bestList || list.length < bestList.length) { best = i; bestList = list; }
      if (list.length === 1) break;
    }
    if (best < 0) return true;
    for (const v of shuffle(bestList)) {
      g[best] = v;
      if (fill(g)) return true;
      g[best] = 0;
    }
    return false;
  }

  /* counts solutions, bailing out as soon as it finds a second one */
  function countSolutions(g, limit) {
    let best = -1, bestList = null;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const list = candidates(g, Math.floor(i / N), i % N);
      if (!list.length) return 0;
      if (!bestList || list.length < bestList.length) { best = i; bestList = list; }
      if (list.length === 1) break;
    }
    if (best < 0) return 1;
    let total = 0;
    for (const v of bestList) {
      g[best] = v;
      total += countSolutions(g, limit - total);
      g[best] = 0;
      if (total >= limit) break;
    }
    return total;
  }

  function generate(clues) {
    const solved = new Int8Array(81);
    fill(solved);
    const puzzle = Int8Array.from(solved);
    /* dig holes, but only where the answer stays forced */
    for (const i of shuffle([...Array(81).keys()])) {
      if (81 - puzzle.reduce((a, v) => a + (v ? 1 : 0), 0) >= 81 - clues) break;
      const keep = puzzle[i];
      if (!keep) continue;
      puzzle[i] = 0;
      const probe = Int8Array.from(puzzle);
      if (countSolutions(probe, 2) !== 1) puzzle[i] = keep;
    }
    return { puzzle, solved };
  }

  function mount(root, api) {
    const bagg = Engine.bag();
    const CLUES = { chill: 46, normal: 38, hard: 31, nightmare: 26 }[api.diffId] || 38;

    let puzzle, solved, grid, notes, sel, notesMode, done, startedAt, mistakes, tick;

    const pDiff = api.pill('');
    const pTime = api.pill('0:00');
    const pLeft = api.pill('');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });

    const boardEl = h('div', { class: 'sud-board' });
    const cells = [];
    for (let i = 0; i < 81; i++) {
      const el = h('div', { class: 'sud-cell', data: { i } });
      cells.push(el);
      boardEl.appendChild(el);
    }

    const padEl = h('div', { class: 'sud-pad' });
    for (let v = 1; v <= 9; v++) {
      padEl.appendChild(h('button', { class: 'sud-key', type: 'button', onclick: () => enter(v) }, String(v)));
    }
    const notesBtn = h('button', { class: 'sud-key wide', type: 'button', onclick: () => toggleNotes() }, 'Notes');
    padEl.appendChild(h('button', { class: 'sud-key wide', type: 'button', onclick: () => enter(0) }, 'Erase'));
    padEl.appendChild(notesBtn);

    root.append(boardEl, padEl, banner);

    boardEl.addEventListener('pointerdown', (e) => {
      const t = e.target.closest('.sud-cell');
      if (!t || done) return;
      sel = +t.dataset.i;
      render();
    });

    api.button('New puzzle', () => start());
    api.button('Check', () => {
      let wrong = 0;
      for (let i = 0; i < 81; i++) if (grid[i] && grid[i] !== solved[i]) wrong++;
      api.status(wrong
        ? wrong + ' number' + (wrong === 1 ? ' is' : 's are') + ' wrong. They are marked in red.'
        : 'Everything on the board so far is correct.');
      for (let i = 0; i < 81; i++) cells[i].classList.toggle('wrong', !!grid[i] && grid[i] !== solved[i] && !puzzle[i]);
      api.sfx[wrong ? 'bad' : 'good']();
    });
    api.button('Hint', () => {
      if (done) return;
      const blanks = [];
      for (let i = 0; i < 81; i++) if (!grid[i]) blanks.push(i);
      if (!blanks.length) return;
      const i = sel != null && !grid[sel] ? sel : blanks[randInt(0, blanks.length - 1)];
      grid[i] = solved[i];
      notes[i] = 0;
      mistakes++;
      api.sfx.blip(700);
      render();
      checkWin();
    });

    function start() {
      api.status('Generating a puzzle with exactly one solution...');
      /* generation is quick but not instant, so let the status paint first */
      setTimeout(() => {
        const made = generate(CLUES);
        puzzle = made.puzzle;
        solved = made.solved;
        grid = Int8Array.from(puzzle);
        notes = new Uint16Array(81);
        sel = null;
        notesMode = false;
        done = false;
        mistakes = 0;
        startedAt = Date.now();
        notesBtn.classList.remove('on');
        banner.style.display = 'none';
        api.status('Tap a square, then a number. Notes mode pencils in small candidates.');
        render();
      }, 30);
    }

    function toggleNotes() {
      notesMode = !notesMode;
      notesBtn.classList.toggle('on', notesMode);
      api.sfx.click();
    }

    function enter(v) {
      if (done || sel == null || puzzle[sel]) return;
      if (v === 0) { grid[sel] = 0; notes[sel] = 0; }
      else if (notesMode) { notes[sel] ^= 1 << v; grid[sel] = 0; }
      else { grid[sel] = grid[sel] === v ? 0 : v; notes[sel] = 0; }
      cells[sel].classList.remove('wrong');
      if (v !== 0 && !notesMode && grid[sel] === v) api.sfx[v === solved[sel] ? 'blip' : 'bad']();
      else api.sfx.click();
      render();
      checkWin();
    }

    function checkWin() {
      for (let i = 0; i < 81; i++) if (grid[i] !== solved[i]) return;
      done = true;
      const secs = Math.round((Date.now() - startedAt) / 1000);
      const solvedCount = api.load('solved', 0) + 1;
      api.save('solved', solvedCount);
      api.submit(solvedCount);
      api.sfx.great();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Solved.'),
        h('p', null, 'Finished in ' + Engine.fmtTime(secs) +
          (mistakes ? ' with ' + mistakes + ' hint' + (mistakes === 1 ? '' : 's') + '.' : ' with no hints at all.') +
          ' That is ' + solvedCount + ' puzzle' + (solvedCount === 1 ? '' : 's') + ' solved.'),
        h('button', { class: 'btn primary', type: 'button', onclick: start }, 'Another one'));
      render();
    }

    function render() {
      if (!grid) return;
      const selV = sel != null ? grid[sel] : 0;
      let blanks = 0;
      for (let i = 0; i < 81; i++) {
        const el = cells[i];
        const v = grid[i];
        if (!v) blanks++;
        let cls = 'sud-cell';
        const r = Math.floor(i / N), c = i % N;
        if (c % 3 === 2 && c !== 8) cls += ' rb';
        if (r % 3 === 2 && r !== 8) cls += ' bb';
        if (puzzle[i]) cls += ' given';
        if (sel === i) cls += ' sel';
        else if (sel != null) {
          const sr = Math.floor(sel / N), sc = sel % N;
          if (sr === r || sc === c ||
            (Math.floor(sr / 3) === Math.floor(r / 3) && Math.floor(sc / 3) === Math.floor(c / 3))) cls += ' peer';
        }
        if (v && selV && v === selV) cls += ' same';
        if (el.classList.contains('wrong')) cls += ' wrong';

        if (v) {
          if (el.dataset.v !== String(v) || el.className !== cls) {
            el.dataset.v = String(v);
            el.textContent = String(v);
          }
        } else if (notes[i]) {
          const marks = [];
          for (let n = 1; n <= 9; n++) marks.push(h('i', null, (notes[i] & (1 << n)) ? String(n) : ''));
          el.dataset.v = 'n' + notes[i];
          el.replaceChildren(h('span', { class: 'sud-notes' }, marks));
        } else if (el.dataset.v !== '') {
          el.dataset.v = '';
          el.textContent = '';
        }
        el.className = cls;
      }
      pDiff.textContent = api.diffId.toUpperCase() + '  ' + CLUES + ' given';
      pLeft.textContent = blanks + ' to go';
      pLeft.className = 'pill ' + (blanks === 0 ? 'good' : '');
    }

    bagg.add(Engine.onKey((e) => {
      if (done) return;
      if (/^[1-9]$/.test(e.key)) { enter(+e.key); return true; }
      if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') { enter(0); return true; }
      if (e.key === 'n' || e.key === 'N') { toggleNotes(); return true; }
      const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -N, ArrowDown: N }[e.key];
      if (move && sel != null) {
        const nr = sel + move;
        if (nr >= 0 && nr < 81 && !(Math.abs(move) === 1 && Math.floor(nr / N) !== Math.floor(sel / N))) {
          sel = nr;
          render();
        }
        return true;
      }
    }));

    tick = setInterval(() => {
      if (!startedAt || done) return;
      pTime.textContent = Engine.fmtTime((Date.now() - startedAt) / 1000);
    }, 500);
    bagg.add(() => clearInterval(tick));

    start();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'sudoku',
    usesDigits: true,   // 1-9 fill cells — the "1 = Docs" shortcut yields here
    title: 'Sudoku',
    emoji: 'sudoku',
    cat: 'brain',
    order: 20,
    blurb: 'A fresh puzzle every time, always with exactly one solution, so you never have to guess.',
    scoreLabel: 'Solved',
    tags: ['sudoku', 'numbers', 'logic', 'classic'],
    how: [
      'Tap a square, then a number. Type the number if you have a keyboard.',
      'Notes mode pencils small candidates into a square. N toggles it.',
      'Each puzzle is dug from a full solution, and any removal that would allow a second answer is put back. Logic always gets you there.',
      'Check marks any wrong number in red. Hint fills the selected square, at the cost of a clean finish.',
      'The difficulty dial sets your starting clues, from 46 on chill down to 26 on nightmare.'
    ],
    mount
  });
})();
