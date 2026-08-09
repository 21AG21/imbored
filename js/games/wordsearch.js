/* Word Search. Office-flavoured word lists hidden in a grid of letters; drag a
 * straight line through one to cross it off. Find them all. */
(function () {
  'use strict';
  const { h, randInt, pick, shuffle } = Engine;
  const SIZE = 12;

  const SETS = [
    { theme: 'Buzzwords', words: ['SYNERGY', 'PIVOT', 'LEVERAGE', 'BANDWIDTH', 'AGILE', 'DISRUPT', 'ALIGN', 'ROADMAP', 'TRACTION', 'IDEATE'] },
    { theme: 'Coffee', words: ['ESPRESSO', 'LATTE', 'MOCHA', 'CREMA', 'ARABICA', 'ROAST', 'BEANS', 'DECAF', 'FILTER', 'BREW'] },
    { theme: 'The meeting', words: ['AGENDA', 'MINUTES', 'ACTION', 'RECAP', 'STANDUP', 'OFFLINE', 'SIDEBAR', 'QUORUM', 'PARKING', 'CIRCLE'] },
    { theme: 'Desk supplies', words: ['STAPLER', 'PENCIL', 'ERASER', 'BINDER', 'FOLDER', 'MARKER', 'RULER', 'NOTEPAD', 'CLIP', 'TAPE'] },
    { theme: 'Excuses', words: ['TRAFFIC', 'DENTIST', 'MIGRAINE', 'PLUMBER', 'FAMILY', 'CALL', 'DEADLINE', 'JAMMED', 'REBOOT', 'AWOL'] }
  ];
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]];

  function mount(root, api) {
    const bagg = Engine.bag();
    let grid, place, words, found, setIdx = 0, done, t0, timerId;
    let dragging = false, startCell = null, path = [];

    const pTheme = api.pill('');
    const pFound = api.pill('0/0');
    const pTime = api.pill('⏱ 0');

    const boardEl = h('div', { class: 'ws-board' });
    const listEl = h('div', { class: 'ws-list' });
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.append(h('div', { class: 'ws-wrap' }, boardEl, listEl), banner);

    api.select('Puzzle', SETS.map((s, i) => ({ value: String(i), label: s.theme })), '0', (v) => { setIdx = +v; reset(); });
    api.button('New grid', reset);

    const inb = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

    function build() {
      const set = SETS[setIdx];
      words = set.words.filter((w) => w.length <= SIZE).map((w) => ({ w, done: false }));
      for (let attempt = 0; attempt < 40; attempt++) {
        grid = Array.from({ length: SIZE * SIZE }, () => '');
        place = {};
        let ok = true;
        for (const item of shuffle(words.slice())) {
          if (!placeWord(item.w)) { ok = false; break; }
        }
        if (ok) break;
      }
      const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = A[randInt(0, 25)];
    }

    function placeWord(w) {
      for (let tries = 0; tries < 200; tries++) {
        const dir = pick(DIRS);
        const r0 = randInt(0, SIZE - 1), c0 = randInt(0, SIZE - 1);
        const rE = r0 + dir[0] * (w.length - 1), cE = c0 + dir[1] * (w.length - 1);
        if (!inb(rE, cE)) continue;
        let good = true;
        for (let i = 0; i < w.length; i++) {
          const r = r0 + dir[0] * i, c = c0 + dir[1] * i, g = grid[r * SIZE + c];
          if (g && g !== w[i]) { good = false; break; }
        }
        if (!good) continue;
        for (let i = 0; i < w.length; i++) grid[(r0 + dir[0] * i) * SIZE + (c0 + dir[1] * i)] = w[i];
        return true;
      }
      return false;
    }

    let cellEls;
    function render() {
      boardEl.replaceChildren();
      boardEl.style.gridTemplateColumns = 'repeat(' + SIZE + ', 1fr)';
      cellEls = [];
      for (let i = 0; i < SIZE * SIZE; i++) {
        const el = h('div', { class: 'ws-cell', data: { i: String(i) } }, grid[i]);
        cellEls.push(el); boardEl.appendChild(el);
      }
      paintFound();
      listEl.replaceChildren(...words.map((it) => h('span', { class: 'ws-word' + (it.done ? ' got' : '') }, it.w)));
    }

    function paintFound() {
      for (const el of cellEls) el.classList.remove('sel');
      for (const i of foundCells) cellEls[i] && cellEls[i].classList.add('got');
    }
    const foundCells = new Set();

    function reset() {
      build();
      found = 0; done = false; foundCells.clear();
      clearInterval(timerId); timerId = 0; t0 = 0;
      banner.style.display = 'none';
      render();
      pTheme.textContent = SETS[setIdx].theme;
      pFound.textContent = '0/' + words.length;
      pTime.textContent = '⏱ 0';
      api.status('Find the ' + words.length + ' ' + SETS[setIdx].theme.toLowerCase() + ' words. Drag a straight line — across, down, or diagonal, forwards or backwards — through a word to lock it in.');
    }

    function lineCells(a, b) {
      const r0 = Math.floor(a / SIZE), c0 = a % SIZE, r1 = Math.floor(b / SIZE), c1 = b % SIZE;
      const dr = r1 - r0, dc = c1 - c0;
      if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
      const steps = Math.max(Math.abs(dr), Math.abs(dc));
      const sr = Math.sign(dr), sc = Math.sign(dc), out = [];
      for (let i = 0; i <= steps; i++) out.push((r0 + sr * i) * SIZE + (c0 + sc * i));
      return out;
    }

    function startTimer() { if (timerId) return; t0 = Date.now(); timerId = setInterval(() => { pTime.textContent = '⏱ ' + Math.floor((Date.now() - t0) / 1000); }, 250); bagg.add(() => clearInterval(timerId)); }

    function evaluate() {
      if (!path || path.length < 2) return;
      const str = path.map((i) => grid[i]).join('');
      const rev = str.split('').reverse().join('');
      const hit = words.find((it) => !it.done && (it.w === str || it.w === rev));
      if (hit) {
        hit.done = true; found++;
        for (const i of path) foundCells.add(i);
        api.sfx.good();
        pFound.textContent = found + '/' + words.length;
        listEl.replaceChildren(...words.map((it) => h('span', { class: 'ws-word' + (it.done ? ' got' : '') }, it.w)));
        if (found >= words.length) win();
      } else api.sfx.click();
    }

    function win() {
      done = true; clearInterval(timerId); timerId = 0;
      const secs = Math.floor((Date.now() - t0) / 1000);
      const wins = api.load('wins', 0) + 1; api.save('wins', wins); api.submit(wins);
      api.sfx.great();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'All found.'),
        h('p', null, 'Cleared "' + SETS[setIdx].theme + '" in ' + secs + 's. Puzzles solved: ' + wins + '.'),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Another grid'));
    }

    function cellFrom(e) { const t = e.target.closest('.ws-cell'); return t ? +t.dataset.i : null; }
    function showPath(cells) {
      for (const el of cellEls) el.classList.remove('sel');
      if (cells) for (const i of cells) cellEls[i].classList.add('sel');
    }
    bagg.listen(boardEl, 'pointerdown', (e) => {
      if (done) return;
      const i = cellFrom(e); if (i == null) return;
      startTimer(); dragging = true; startCell = i; path = [i]; showPath(path);
      try { if (boardEl.setPointerCapture) boardEl.setPointerCapture(e.pointerId); } catch (err) { /* */ }
    });
    bagg.listen(boardEl, 'pointermove', (e) => {
      if (!dragging) return;
      const i = cellFrom(e); if (i == null || i === startCell) return;
      const cells = lineCells(startCell, i);
      if (cells) { path = cells; showPath(cells); }
    });
    function endDrag() { if (!dragging) return; dragging = false; evaluate(); showPath(null); paintFound(); }
    bagg.listen(boardEl, 'pointerup', endDrag);
    bagg.listen(boardEl, 'pointercancel', endDrag);

    reset();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'wordsearch',
    title: 'Word Search',
    emoji: 'find',
    cat: 'puzzle',
    order: 18,
    blurb: 'The back-page word search, restocked with office vocabulary. Themed lists of buzzwords, coffee terms and excuses hide in a letter grid, and you drag a line through each to strike it off.',
    scoreLabel: 'Puzzles solved',
    tags: ['word-search', 'words', 'relaxing'],
    how: [
      'Each grid hides a themed list of words placed across, down, or diagonally, forwards or backwards.',
      'Press the first letter of a word and drag in a straight line to its last letter, then release. A correct word locks in and crosses off the list.',
      'Lines must be straight: horizontal, vertical, or a true 45-degree diagonal. Any other shape clears and you try again.',
      'Find every word on the list to clear the grid. A timer runs from your first drag if you want to race yourself.',
      'Pick a different theme from the menu, or hit New grid to reshuffle the same words into a fresh layout. Each clear counts toward your total.'
    ],
    mount
  });
})();
