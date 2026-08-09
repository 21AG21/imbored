/* Cond. Format. A nonogram dressed up as a spreadsheet with the legend lost. */
(function () {
  'use strict';
  const { h } = Engine;

  function mount(root, api) {
    const bagg = Engine.bag();

    const SIZES = { chill: 5, normal: 10, hard: 12, nightmare: 15 };
    const N = SIZES[api.diffId] || 10;
    const FILL = 0.55;

    function cellSize() {
      if (N <= 5) return 46;
      if (N <= 10) return 34;
      if (N <= 12) return 30;
      return 26;
    }

    let target = new Array(N * N).fill(0); /* the hidden picture: 1 filled, 0 blank */
    let state = new Array(N * N).fill(0);  /* player marks: 0 empty, 1 filled, 2 X   */
    let rowCluesArr = [];
    let colCluesArr = [];
    let cellEls = [];
    let gridEl = null;

    let markMode = false;
    let solved = false;
    let started = false;
    let startPerf = 0;
    let lastSec = -1;
    let errTimer = 0;

    let dragging = false;
    let dragSet = 0;
    let lastIdx = -1;

    const defaultHint = 'Fill the runs the numbers describe. Left-click fills a cell, right-click marks a blank with an X.';

    /* ---------- shell ---------- */
    const wrapEl = h('div', { class: 'nono-wrap' });
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    const container = h('div', { class: 'nono' }, wrapEl, banner);
    root.appendChild(container);
    container.style.setProperty('--cs', cellSize() + 'px');

    /* ---------- toolbar ---------- */
    const timePill = api.pill('Time 0:00');
    const markBtn = api.button('Mark: off', function () {
      markMode = !markMode;
      markBtn.textContent = 'Mark: ' + (markMode ? 'on' : 'off');
      markBtn.classList.toggle('on', markMode);
      api.status(markMode
        ? 'Mark mode on: tap places an X. Right-click still fills.'
        : 'Fill mode: tap fills. Right-click places an X.');
    });
    api.button('Check', doCheck);
    api.button('New', newPuzzle);

    /* ---------- generation ---------- */
    function genTarget() {
      const t = new Array(N * N);
      let count = 0;
      for (let i = 0; i < N * N; i++) {
        const v = Math.random() < FILL ? 1 : 0;
        t[i] = v;
        count += v;
      }
      if (count === 0) t[Math.floor(Math.random() * N * N)] = 1;
      return t;
    }
    function clueFor(get) {
      const arr = [];
      let run = 0;
      for (let i = 0; i < N; i++) {
        if (get(i)) run++;
        else if (run) { arr.push(run); run = 0; }
      }
      if (run) arr.push(run);
      if (!arr.length) arr.push(0);
      return arr;
    }
    function computeClues() {
      rowCluesArr = [];
      colCluesArr = [];
      for (let r = 0; r < N; r++) {
        rowCluesArr.push(clueFor(function (c) { return target[r * N + c]; }));
      }
      for (let c = 0; c < N; c++) {
        colCluesArr.push(clueFor(function (r) { return target[r * N + c]; }));
      }
    }

    /* ---------- rendering ---------- */
    function buildGrid() {
      cellEls = new Array(N * N);
      const kids = [];
      kids.push(h('div', { class: 'nono-hcell corner' }, 'fx'));
      for (let c = 0; c < N; c++) {
        let cls = 'nono-hcell colclue';
        if ((c + 1) % 5 === 0 && c !== N - 1) cls += ' band-r';
        kids.push(h('div', { class: cls },
          ...colCluesArr[c].map(function (n) { return h('span', { text: String(n) }); })));
      }
      for (let r = 0; r < N; r++) {
        let rcls = 'nono-hcell rowclue';
        if ((r + 1) % 5 === 0 && r !== N - 1) rcls += ' band-b';
        kids.push(h('div', { class: rcls },
          ...rowCluesArr[r].map(function (n) { return h('span', { text: String(n) }); })));
        for (let c = 0; c < N; c++) {
          const i = r * N + c;
          let ccls = 'gcell';
          if ((c + 1) % 5 === 0 && c !== N - 1) ccls += ' band-r';
          if ((r + 1) % 5 === 0 && r !== N - 1) ccls += ' band-b';
          const el = h('div', { class: ccls, data: { idx: String(i) } });
          cellEls[i] = el;
          kids.push(el);
        }
      }
      return h('div', {
        class: 'nono-grid',
        style: { gridTemplateColumns: 'auto repeat(' + N + ', var(--cs))' }
      }, ...kids);
    }
    function updateCellEl(i) {
      const el = cellEls[i];
      el.classList.toggle('filled', state[i] === 1);
      el.classList.toggle('marked', state[i] === 2);
      if (state[i] !== 1) el.classList.remove('error');
    }

    /* ---------- interaction ---------- */
    function primaryKind(button) {
      const right = button === 2;
      const mark = right ? !markMode : markMode;
      return mark ? 'mark' : 'fill';
    }
    function toggledState(i, kind) {
      const cur = state[i];
      if (kind === 'fill') return cur === 1 ? 0 : 1;
      return cur === 2 ? 0 : 2;
    }
    function setCell(i, v) {
      if (state[i] === v) return;
      state[i] = v;
      updateCellEl(i);
    }
    function cellIndexAt(x, y) {
      const el = document.elementFromPoint(x, y);
      if (!el || !el.closest) return -1;
      const c = el.closest('.gcell');
      if (!c || c.dataset.idx == null) return -1;
      return +c.dataset.idx;
    }
    function onDown(e) {
      if (solved) return;
      const cell = e.target && e.target.closest ? e.target.closest('.gcell') : null;
      if (!cell) return;
      e.preventDefault();
      if (!started) { started = true; startPerf = performance.now(); }
      const i = +cell.dataset.idx;
      const kind = primaryKind(e.button);
      const res = toggledState(i, kind);
      dragging = true;
      dragSet = res;
      lastIdx = i;
      setCell(i, res);
      api.sfx.blip(res === 0 ? 220 : (kind === 'fill' ? 540 : 360));
    }
    function onMove(e) {
      if (!dragging) return;
      const i = cellIndexAt(e.clientX, e.clientY);
      if (i < 0 || i === lastIdx) return;
      lastIdx = i;
      setCell(i, dragSet);
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      lastIdx = -1;
      afterChange();
    }

    function afterChange() {
      if (solved) return;
      if (isSolved()) win();
    }
    function isSolved() {
      for (let i = 0; i < N * N; i++) {
        if ((state[i] === 1) !== (target[i] === 1)) return false;
      }
      return true;
    }

    function clearErrors() {
      for (let i = 0; i < N * N; i++) if (cellEls[i]) cellEls[i].classList.remove('error');
    }
    function doCheck() {
      if (solved) return;
      let bad = 0;
      for (let i = 0; i < N * N; i++) {
        if (state[i] === 1 && target[i] === 0) {
          cellEls[i].classList.add('error');
          bad++;
        }
      }
      if (bad) {
        api.sfx.bad();
        api.status(bad + (bad === 1 ? ' cell breaks' : ' cells break') + ' the clues. Flagged red for a moment.');
        if (errTimer) clearTimeout(errTimer);
        errTimer = setTimeout(function () { clearErrors(); errTimer = 0; }, 1500);
      } else {
        api.sfx.good();
        api.status('No contradictions so far. Keep going.');
      }
    }

    function round1(t) { return Math.round(t * 10) / 10; }
    function win() {
      solved = true;
      dragging = false;
      if (errTimer) { clearTimeout(errTimer); errTimer = 0; }
      clearErrors();
      const t = (performance.now() - startPerf) / 1000;
      const res = api.submit(round1(t));
      api.sfx.great();
      let body = 'Sheet reconstructed in ' + Engine.fmtTime(t) + '.';
      if (res && res.isRecord) body += ' New personal best for this size.';
      else if (res && res.best != null) body += ' Best: ' + Engine.fmtTime(res.best) + '.';
      Engine.autoAdvance(banner, 'CONDITIONS MET', body, 'New sheet', newPuzzle, 6);
    }

    function newPuzzle() {
      banner.style.display = 'none';
      if (errTimer) { clearTimeout(errTimer); errTimer = 0; }
      target = genTarget();
      computeClues();
      state = new Array(N * N).fill(0);
      const g = buildGrid();
      if (gridEl) gridEl.remove();
      gridEl = g;
      wrapEl.appendChild(g);
      solved = false;
      started = false;
      startPerf = 0;
      lastSec = -1;
      dragging = false;
      lastIdx = -1;
      timePill.textContent = 'Time 0:00';
      api.status(defaultHint);
    }

    /* ---------- wiring ---------- */
    bagg.listen(wrapEl, 'pointerdown', onDown);
    bagg.listen(wrapEl, 'contextmenu', function (e) { e.preventDefault(); });
    bagg.listen(window, 'pointermove', onMove);
    bagg.listen(window, 'pointerup', onUp);
    bagg.listen(window, 'pointercancel', onUp);
    bagg.add(function () { if (errTimer) clearTimeout(errTimer); });

    bagg.add(Engine.loop(function () {
      if (solved || !started) return;
      const s = Math.floor((performance.now() - startPerf) / 1000);
      if (s !== lastSec) {
        lastSec = s;
        timePill.textContent = 'Time ' + Engine.fmtTime(s);
      }
    }));

    newPuzzle();

    return function () { bagg.dispose(); };
  }

  Arcade.register({
    id: 'nonogram',
    title: 'Cond. Format',
    emoji: 'nonogram',
    cat: 'puzzle',
    order: 13,
    blurb: 'A nonogram dressed as a spreadsheet with the legend lost. Fill the cells the row and column numbers describe to rebuild the hidden picture.',
    scoreLabel: 'solve time (s)',
    lowerIsBetter: true,
    tags: ['puzzle', 'logic', 'picross', 'grid'],
    how: [
      'Rebuild the hidden picture. Each number is a run of filled cells in that row or column, in order, with a gap between runs.',
      'Left-click or tap to fill a cell; right-click to mark a blank with an X. Drag to paint a whole streak.',
      'On a touchscreen, flip the Mark button to place X marks instead of fills.',
      'Check turns any wrong filled cell red for a moment. New deals a fresh sheet.',
      'You solve the instant your filled cells match the target. Blank cells never need an X.',
      'Harder tiers give a bigger grid: 5, 10, 12 or 15 cells square. Score is your solve time, so lower is better.'
    ],
    mount: mount
  });
})();
