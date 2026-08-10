/* Space Allocation. 1010!-style block fitting, filed as a floor-plan approval tool. */
(function () {
  'use strict';
  const { h, randInt, pick, clamp } = Engine;
  const N = 9;

  /* polyomino shapes as [dx,dy] offsets from an anchor cell. Pieces never
     rotate in this genre, so each orientation is its own entry. Weighted so
     small, easy-to-place shapes turn up more often than the big ones. */
  const SHAPES = [
    { w: 1, cells: [[0, 0]] },
    { w: 3, cells: [[0, 0], [1, 0]] },
    { w: 3, cells: [[0, 0], [0, 1]] },
    { w: 2, cells: [[0, 0], [1, 0], [2, 0]] },
    { w: 2, cells: [[0, 0], [0, 1], [0, 2]] },
    { w: 2, cells: [[0, 0], [1, 0], [0, 1]] },
    { w: 2, cells: [[0, 0], [1, 0], [1, 1]] },
    { w: 2, cells: [[0, 0], [0, 1], [1, 1]] },
    { w: 2, cells: [[1, 0], [0, 1], [1, 1]] },
    { w: 2, cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
    { w: 2, cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
    { w: 3, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { w: 2, cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
    { w: 2, cells: [[1, 0], [0, 1], [1, 1], [1, 2]] },
    { w: 2, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    { w: 2, cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
    { w: 2, cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
    { w: 2, cells: [[0, 0], [1, 0], [2, 0], [0, 1]] },
    { w: 2, cells: [[1, 0], [1, 1], [1, 2], [0, 2]] },
    { w: 2, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    { w: 2, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    { w: 2, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    { w: 1, cells: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]] },
    { w: 1, cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]] },
    { w: 1, cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]] }
  ];
  const WEIGHTED = SHAPES.flatMap((s) => Array(s.w).fill(s));
  const COLORS = 6;   // colour index 1..6, matched to CSS .df-c1..c6

  function mount(root, api) {
    const bagg = Engine.bag();
    let board, colorOf, tray, score, best, over, dragIdx, dragPos, hoverAnchor;

    const pScore = api.pill('0 sq ft');
    const pBest = api.pill('best 0');
    const boardEl = h('div', { class: 'df-board', style: { gridTemplateColumns: 'repeat(' + N + ', 1fr)' } });
    const cellEls = [];
    for (let i = 0; i < N * N; i++) {
      const el = h('div', { class: 'df-cell', data: { i } });
      cellEls.push(el); boardEl.appendChild(el);
    }
    const trayEl = h('div', { class: 'df-tray' });
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.append(h('div', { class: 'deskfit' }, boardEl, trayEl), banner);
    api.button('New floor plan', reset);

    best = api.load('best', 0);

    function boxOf(r, c) { return Math.floor(r / 3) * 3 + Math.floor(c / 3); }

    function fitsAt(shape, anchorR, anchorC) {
      if (!Number.isInteger(anchorR) || !Number.isInteger(anchorC)) return false;
      for (const [dx, dy] of shape.cells) {
        const r = anchorR + dy, c = anchorC + dx;
        if (r < 0 || c < 0 || r >= N || c >= N) return false;
        if (board[r * N + c]) return false;
      }
      return true;
    }
    function anyFit(shape) {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fitsAt(shape, r, c)) return true;
      return false;
    }

    function newPiece() {
      const shape = pick(WEIGHTED);
      return { shape, color: randInt(1, COLORS) };
    }

    function refillTray() {
      let attempt = 0, pieces;
      do {
        pieces = [newPiece(), newPiece(), newPiece()];
        attempt++;
      } while (attempt < 4 && !pieces.some((p) => anyFit(p.shape)));
      tray = pieces;
      renderTray();
      checkGameOver();
    }

    function reset() {
      board = new Uint8Array(N * N);
      colorOf = new Uint8Array(N * N);
      score = 0; over = false; dragIdx = null; dragPos = null; hoverAnchor = null;
      banner.style.display = 'none';
      refillTray();
      render();
      api.status('Drag a shape from the tray onto the floor plan. Fill a whole row, column, or 3x3 zone to clear it. The round ends when nothing in the tray fits anywhere.');
    }

    function checkGameOver() {
      if (over) return;
      if (tray.every((p) => !p || !anyFit(p.shape))) finish();
    }

    function place(shape, color, anchorR, anchorC) {
      for (const [dx, dy] of shape.cells) {
        const r = anchorR + dy, c = anchorC + dx;
        board[r * N + c] = 1; colorOf[r * N + c] = color;
      }
      score += shape.cells.length;
      api.sfx.click();

      /* find full rows / cols / 3x3 zones */
      const rows = [], cols = [], boxes = [];
      for (let r = 0; r < N; r++) { let full = true; for (let c = 0; c < N; c++) if (!board[r * N + c]) { full = false; break; } if (full) rows.push(r); }
      for (let c = 0; c < N; c++) { let full = true; for (let r = 0; r < N; r++) if (!board[r * N + c]) { full = false; break; } if (full) cols.push(c); }
      for (let b = 0; b < N; b++) {
        const br = Math.floor(b / 3) * 3, bc = (b % 3) * 3;
        let full = true;
        for (let dy = 0; dy < 3 && full; dy++) for (let dx = 0; dx < 3; dx++) if (!board[(br + dy) * N + (bc + dx)]) { full = false; break; }
        if (full) boxes.push(b);
      }
      const cleared = rows.length + cols.length + boxes.length;
      if (cleared) {
        for (const r of rows) for (let c = 0; c < N; c++) { board[r * N + c] = 0; colorOf[r * N + c] = 0; }
        for (const c of cols) for (let r = 0; r < N; r++) { board[r * N + c] = 0; colorOf[r * N + c] = 0; }
        for (const b of boxes) {
          const br = Math.floor(b / 3) * 3, bc = (b % 3) * 3;
          for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) { board[(br + dy) * N + (bc + dx)] = 0; colorOf[(br + dy) * N + (bc + dx)] = 0; }
        }
        score += cleared * N * 2;
        api.sfx[cleared > 1 ? 'great' : 'good']();
        api.status(cleared > 1 ? (cleared + ' lines approved at once. Nice packing.') : 'Approved — relocated. Space freed.');
      }
      if (score > best) { best = score; api.save('best', best); }
      api.submit(score);
      render();
    }

    function render() {
      for (let i = 0; i < N * N; i++) {
        const el = cellEls[i];
        el.className = 'df-cell' + (boxOf(Math.floor(i / N), i % N) % 2 ? ' df-alt' : '') + (board[i] ? ' df-c' + colorOf[i] : '');
      }
      if (hoverAnchor) {
        const { shape, ok } = hoverAnchor;
        for (const [dx, dy] of shape.cells) {
          const r = hoverAnchor.r + dy, c = hoverAnchor.c + dx;
          if (r < 0 || c < 0 || r >= N || c >= N) continue;
          cellEls[r * N + c].classList.add(ok ? 'df-preview-ok' : 'df-preview-bad');
        }
      }
      pScore.textContent = score + ' sq ft';
      pBest.textContent = 'best ' + best;
    }

    function renderTray() {
      trayEl.replaceChildren();
      tray.forEach((p, idx) => {
        if (!p) { trayEl.appendChild(h('div', { class: 'df-slot-empty' })); return; }
        const maxX = Math.max(...p.shape.cells.map((c) => c[0])) + 1;
        const maxY = Math.max(...p.shape.cells.map((c) => c[1])) + 1;
        const mini = h('div', { class: 'df-piece', style: { gridTemplateColumns: 'repeat(' + maxX + ', 1fr)', gridTemplateRows: 'repeat(' + maxY + ', 1fr)' } });
        for (const [dx, dy] of p.shape.cells) {
          mini.appendChild(h('div', { class: 'df-mini df-c' + p.color, style: { gridColumn: String(dx + 1), gridRow: String(dy + 1) } }));
        }
        const slot = h('div', { class: 'df-slot', data: { idx } }, mini);
        bagg.listen(slot, 'pointerdown', (e) => startDrag(idx, e));
        trayEl.appendChild(slot);
      });
    }

    /* ---------------- drag ---------------- */
    const ghost = h('div', { class: 'df-ghost' });
    document.body.appendChild(ghost);
    bagg.add(() => ghost.remove());
    ghost.style.display = 'none';

    function boardCellFromPoint(x, y) {
      const r = boardEl.getBoundingClientRect();
      const cw = r.width / N, ch = r.height / N;
      const c = Math.floor((x - r.left) / cw);
      const row = Math.floor((y - r.top) / ch);
      return { row, c };
    }

    function startDrag(idx, e) {
      if (over || !tray[idx]) return;
      dragIdx = idx;
      e.preventDefault();
      const p = tray[idx];
      const maxX = Math.max(...p.shape.cells.map((c) => c[0])) + 1;
      const maxY = Math.max(...p.shape.cells.map((c) => c[1])) + 1;
      ghost.replaceChildren();
      ghost.style.gridTemplateColumns = 'repeat(' + maxX + ', 1fr)';
      ghost.style.gridTemplateRows = 'repeat(' + maxY + ', 1fr)';
      for (const [dx, dy] of p.shape.cells) {
        ghost.appendChild(h('div', { class: 'df-mini df-c' + p.color, style: { gridColumn: String(dx + 1), gridRow: String(dy + 1) } }));
      }
      ghost.style.display = 'grid';
      moveDrag(e);
    }

    function moveDrag(e) {
      if (dragIdx == null) return;
      const cellPx = boardEl.getBoundingClientRect().width / N;
      const liftY = e.pointerType === 'touch' ? cellPx * 1.6 : 0;   // lift the ghost above the finger so it isn't hidden on touch; hit-testing always uses the real pointer position so every row (including the bottom one) stays reachable
      ghost.style.width = cellPx + 'px';
      ghost.style.height = cellPx + 'px';
      ghost.style.left = (e.clientX - cellPx / 2) + 'px';
      ghost.style.top = (e.clientY - cellPx / 2 - liftY) + 'px';

      const p = tray[dragIdx];
      const { row, c } = boardCellFromPoint(e.clientX, e.clientY);
      const ok = fitsAt(p.shape, row, c);
      hoverAnchor = { shape: p.shape, r: row, c, ok };
      render();
    }

    function endDrag(e) {
      if (dragIdx == null) return;
      const idx = dragIdx;
      dragIdx = null;
      ghost.style.display = 'none';
      const p = tray[idx];
      if (hoverAnchor && hoverAnchor.ok) {
        place(p.shape, p.color, hoverAnchor.r, hoverAnchor.c);
        tray[idx] = null;
        renderTray();
        if (tray.every((x) => !x)) refillTray();
        else checkGameOver();
      }
      hoverAnchor = null;
      render();
    }

    function cancelDrag() {
      if (dragIdx == null) return;
      dragIdx = null;
      hoverAnchor = null;
      ghost.style.display = 'none';
      render();
    }

    bagg.listen(window, 'pointermove', moveDrag);
    bagg.listen(window, 'pointerup', endDrag);
    bagg.listen(window, 'pointercancel', cancelDrag);

    function finish() {
      over = true;
      api.sfx.bad();
      const record = score >= best;
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Floor full.'),
        h('p', null, 'Approved ' + score + ' sq ft this plan.' + (record ? ' New record.' : ' Best: ' + best + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'New floor plan'));
    }

    /* headless testability seam, matching the window.__vp / window.__life
       convention already used elsewhere in this repo */
    window.__deskfit = {
      state() { return { board: Array.from(board), score, over, tray: tray.map((p) => p && { cells: p.shape.cells, color: p.color }) }; },
      place(idx, r, c) { const p = tray[idx]; if (!p || !fitsAt(p.shape, r, c)) return false; place(p.shape, p.color, r, c); tray[idx] = null; renderTray(); if (tray.every((x) => !x)) refillTray(); else checkGameOver(); return true; }
    };
    bagg.add(() => { if (window.__deskfit) delete window.__deskfit; });

    reset();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'deskfit',
    title: 'Space Allocation',
    emoji: 'deskfit',
    cat: 'puzzle',
    order: 16,
    blurb: 'A floor-plan approval queue. Drag each pending desk cluster onto the plan; fill a row, column, or department zone and it ships out, freeing the space back up.',
    scoreLabel: 'Sq ft approved',
    tags: ['blocks', 'fit', 'polyomino', 'endless'],
    how: [
      'Drag one of the three pending shapes from the tray onto the 9x9 floor plan. It can only land where every one of its cells is empty.',
      'Fill an entire row, column, or 3x3 department zone (the alternating shaded blocks) and it clears immediately, freeing the space and scoring extra.',
      'A fresh trio of shapes arrives once all three in the tray are placed. Shapes never rotate — plan around the orientation you are given.',
      'The plan is full when nothing left in the tray fits anywhere on the board. There is no clock, only space.',
      'Your score is the most square footage approved in one run, including the clearing bonus. Try to beat your best.'
    ],
    mount
  });
})();
