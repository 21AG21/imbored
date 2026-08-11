/* Battleship. A floor-by-floor asset audit dressed up as naval warfare. */
(function () {
  'use strict';
  const { h, randInt, pick } = Engine;

  /* the standard fleet, relabelled as things you'd account for in a drill */
  const FLEET = [
    { name: 'Server rack', size: 5 },
    { name: 'Boardroom table', size: 4 },
    { name: 'Water cooler', size: 3 },
    { name: 'Filing cabinet', size: 3 },
    { name: 'Fax machine', size: 2 }
  ];
  const N = 10;
  const COLS = 'ABCDEFGHIJ';

  const inb = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

  function footprint(r, c, size, o) {
    const out = [];
    for (let i = 0; i < size; i++) out.push(o === 'h' ? [r, c + i] : [r + i, c]);
    return out;
  }
  function emptyBoard() { return { grid: new Array(N * N).fill(-1), ships: [] }; }
  function canPlace(board, cells) {
    for (const cc of cells) {
      const r = cc[0], c = cc[1];
      if (!inb(r, c)) return false;
      if (board.grid[r * N + c] !== -1) return false;
    }
    return true;
  }
  function addShip(board, spec, cells) {
    const ship = { name: spec.name, size: spec.size, cells: cells, hits: 0, sunk: false };
    const idx = board.ships.length;
    board.ships.push(ship);
    for (const cc of cells) board.grid[cc[0] * N + cc[1]] = idx;
    return ship;
  }
  function randomBoard() {
    const b = emptyBoard();
    for (const spec of FLEET) {
      let placed = false, tries = 0;
      while (!placed && tries < 800) {
        tries++;
        const o = Math.random() < 0.5 ? 'h' : 'v';
        const r = o === 'h' ? randInt(0, 9) : randInt(0, N - spec.size);
        const c = o === 'h' ? randInt(0, N - spec.size) : randInt(0, 9);
        const cells = footprint(r, c, spec.size, o);
        if (canPlace(b, cells)) { addShip(b, spec, cells); placed = true; }
      }
      if (!placed) {
        /* exhaustive fallback; practically never needed on a 10x10 */
        for (let rr = 0; rr < N && !placed; rr++)
          for (let cc = 0; cc < N && !placed; cc++)
            for (let oi = 0; oi < 2 && !placed; oi++) {
              const cells = footprint(rr, cc, spec.size, oi ? 'v' : 'h');
              if (canPlace(b, cells)) { addShip(b, spec, cells); placed = true; }
            }
      }
    }
    return b;
  }
  function allSunk(board) { return board.ships.every((s) => s.sunk); }
  function unsunk(board) { let n = 0; for (const s of board.ships) if (!s.sunk) n++; return n; }

  function mount(root, api) {
    const bagg = Engine.bag();

    let phase = 'setup';       /* setup | battle | over */
    let turn = 'player';       /* player | cpu */
    let mode = '1p';           /* 1p vs CPU | 2p hotseat pass-and-play */
    let busy = false;
    let reveal = false;
    let playerBoard, enemyBoard;
    let pShots, eShots;        /* shots taken AT a board: 0 unknown, 1 miss, 2 hit */
    /* 2p canonical state: each player owns a board; the render vars above are
       pointed at the current player's perspective by setView() */
    let boardA, boardB, shotsAtA, shotsAtB, cur = 1;
    let setupIdx = 0;
    let orient = 'h';
    let hoverCell = null;
    let wins = api.load('wins', 0);
    let streak = api.load('streak', 0);

    let alive = true;
    const timers = new Set();
    function after(ms, fn) {
      const id = setTimeout(function () { timers.delete(id); if (alive) fn(); }, ms);
      timers.add(id);
      return id;
    }
    bagg.add(function () { alive = false; timers.forEach(clearTimeout); timers.clear(); });

    /* ---------------- DOM ---------------- */
    const banner = h('div', { class: 'banner', style: { display: 'none' } });

    function buildBoard(kind) {
      const el = h('div', { class: 'bs-board bs-' + kind });
      const cells = new Array(N * N);
      el.appendChild(h('div', { class: 'bs-lab corner' }));
      for (let c = 0; c < N; c++) el.appendChild(h('div', { class: 'bs-lab' }, COLS[c]));
      for (let r = 0; r < N; r++) {
        el.appendChild(h('div', { class: 'bs-lab' }, String(r + 1)));
        for (let c = 0; c < N; c++) {
          const cell = h('div', { class: 'cell', data: { r: String(r), c: String(c) } });
          cells[r * N + c] = cell;
          el.appendChild(cell);
        }
      }
      return { el: el, cells: cells };
    }
    const me = buildBoard('me');
    const them = buildBoard('them');
    const meTitle = h('h4', null, 'Your floor');
    const wrap = h('div', { class: 'battleship' },
      h('div', { class: 'panelrow' },
        h('div', { class: 'bs-side' }, meTitle, me.el),
        h('div', { class: 'bs-side' }, h('h4', null, 'Enemy floor'), them.el)));
    /* full-cover interstitial so a passing player never sees the other's fleet */
    const passScreen = h('div', { class: 'bs-pass', style: { display: 'none' } });
    wrap.appendChild(passScreen);
    root.append(banner, wrap);

    function showPass(nextPlayer, msg, onReady) {
      busy = true;
      passScreen.replaceChildren(
        h('div', { class: 'bs-pass-card' },
          h('h3', null, 'Pass the device to Player ' + nextPlayer),
          h('p', null, msg),
          h('button', {
            class: 'btn primary', type: 'button',
            onclick: function () { passScreen.style.display = 'none'; onReady(); }
          }, 'I am Player ' + nextPlayer + ' — Ready')));
      passScreen.style.display = '';
    }

    /* ---------------- toolbar ---------------- */
    const pTurn = api.pill('Setup');
    const pEnemy = api.pill('Targets left: 5');
    const pStreak = api.pill('Streak 0', 'best');

    const btnNew = api.button('New game', newGame);
    const btnRandom = api.button('Re-roll fleet', randomiseSetup);
    const btnClear = api.button('Place by hand', clearSetup);
    const btnRotate = api.button('Rotate (R)', rotate);
    const btnStart = api.button('Start battle', primaryAction, 'primary');
    api.select('Players', [
      { value: '1p', label: '1 player (vs CPU)' },
      { value: '2p', label: '2 players (hotseat)' }
    ], '1p', function (v) { mode = v; resetForMode(); });
    const setupBtns = [btnRandom, btnClear, btnRotate, btnStart];
    void btnNew;

    function resetForMode() { banner.style.display = 'none'; if (mode === '2p') newSetup2p(); else newSetup(); }
    function primaryAction() { if (mode === '2p') return primary2p(); return startBattle(); }
    /* point the shared render vars at a player's perspective (own board on the
       left, opponent's hidden board on the right) */
    function setView(player) {
      cur = player;
      if (player === 1) { playerBoard = boardA; pShots = shotsAtA; enemyBoard = boardB; eShots = shotsAtB; }
      else { playerBoard = boardB; pShots = shotsAtB; enemyBoard = boardA; eShots = shotsAtA; }
    }
    function syncCanonical() {
      if (mode !== '2p') return;
      if (cur === 1) boardA = playerBoard; else boardB = playerBoard;
    }

    /* ---------------- listeners ---------------- */
    bagg.listen(them.el, 'click', function (e) {
      const t = e.target.closest('.cell');
      if (!t) return;
      if (phase !== 'battle' || busy) return;
      if (mode === '2p') { fire2p(+t.dataset.r, +t.dataset.c); return; }
      if (turn !== 'player') return;
      playerFire(+t.dataset.r, +t.dataset.c);
    });
    bagg.listen(me.el, 'click', function (e) {
      if (phase !== 'setup') return;
      const t = e.target.closest('.cell');
      if (!t) return;
      placeAt(+t.dataset.r, +t.dataset.c);
    });
    bagg.listen(me.el, 'pointermove', function (e) {
      if (phase !== 'setup' || setupIdx >= FLEET.length) return;
      const t = e.target.closest('.cell');
      const nc = t ? [+t.dataset.r, +t.dataset.c] : null;
      if ((nc && hoverCell && nc[0] === hoverCell[0] && nc[1] === hoverCell[1]) || (!nc && !hoverCell)) return;
      hoverCell = nc;
      renderMe();
    });
    bagg.listen(me.el, 'pointerleave', function () {
      if (!hoverCell) return;
      hoverCell = null;
      renderMe();
    });
    bagg.add(Engine.onKey(function (e) {
      if (phase === 'setup' && (e.code === 'KeyR' || e.key === 'r' || e.key === 'R')) { rotate(); return true; }
      return false;
    }));

    /* ---------------- setup phase ---------------- */
    function newGame() { resetForMode(); }

    function newSetup() {
      phase = 'setup'; mode = '1p'; turn = 'player'; busy = false; reveal = false;
      hoverCell = null; orient = 'h';
      btnStart.textContent = 'Start battle';
      passScreen.style.display = 'none';
      playerBoard = emptyBoard();
      enemyBoard = randomBoard();
      pShots = new Array(N * N).fill(0);
      eShots = new Array(N * N).fill(0);
      setupIdx = 0;
      randomiseSetup();
    }

    function randomiseSetup() {
      if (phase !== 'setup') return;
      playerBoard = randomBoard();
      syncCanonical();
      setupIdx = FLEET.length;
      hoverCell = null;
      api.sfx.click();
      api.status(mode === '2p'
        ? 'Player ' + cur + ': fleet moored. Re-roll, place by hand, then hit ' + (cur === 1 ? 'Pass to Player 2.' : 'Start battle.')
        : 'Fleet moored. Re-roll, place it by hand, or start the drill.');
      updateToolbar(); updatePills(); renderAll();
    }

    function clearSetup() {
      if (phase !== 'setup') return;
      playerBoard = emptyBoard();
      syncCanonical();
      setupIdx = 0; hoverCell = null;
      api.sfx.click();
      api.status((mode === '2p' ? 'Player ' + cur + ': placing your ' : 'Placing your ') + FLEET[0].name + ' (' + FLEET[0].size + '). Click a square; press R to rotate.');
      updateToolbar(); updatePills(); renderAll();
    }

    function rotate() {
      if (phase !== 'setup') return;
      orient = orient === 'h' ? 'v' : 'h';
      api.sfx.blip(440);
      renderMe();
    }

    function placeAt(r, c) {
      if (setupIdx >= FLEET.length) return;
      const spec = FLEET[setupIdx];
      const cells = footprint(r, c, spec.size, orient);
      if (!canPlace(playerBoard, cells)) {
        api.sfx.bad();
        api.status('That will not fit. Try another square or rotate with R.');
        return;
      }
      addShip(playerBoard, spec, cells);
      setupIdx++;
      api.sfx.click();
      if (setupIdx >= FLEET.length) api.status('Fleet ready. Hit Start battle.');
      else api.status('Now placing ' + FLEET[setupIdx].name + ' (' + FLEET[setupIdx].size + '). Press R to rotate.');
      updateToolbar(); renderMe();
    }

    function startBattle() {
      if (phase !== 'setup' || setupIdx < FLEET.length) return;
      phase = 'battle'; turn = 'player'; busy = false; reveal = false; hoverCell = null;
      api.sfx.good();
      api.status('Battle stations. Click a square on the enemy floor to fire.');
      updateToolbar(); updatePills(); renderAll();
    }

    /* ---------------- 2-player hotseat (pass-and-play) ---------------- */
    function newSetup2p() {
      phase = 'setup'; mode = '2p'; reveal = false; busy = false; hoverCell = null; orient = 'h';
      boardA = emptyBoard(); boardB = emptyBoard();
      shotsAtA = new Array(N * N).fill(0); shotsAtB = new Array(N * N).fill(0);
      setView(1);
      playerBoard = randomBoard(); syncCanonical(); setupIdx = FLEET.length;
      btnStart.textContent = 'Pass to Player 2';
      api.status('Player 1: place your fleet. Re-roll or place by hand, then Pass to Player 2. Player 2, look away.');
      updateToolbar(); updatePills(); renderAll();
    }

    function primary2p() {
      if (phase !== 'setup' || setupIdx < FLEET.length) return;
      api.sfx.good();
      if (cur === 1) {
        showPass(2, 'Player 2, set up your own fleet. No peeking at Player 1’s floor.', function () {
          setView(2);
          playerBoard = randomBoard(); syncCanonical(); setupIdx = FLEET.length;
          hoverCell = null; orient = 'h';
          btnStart.textContent = 'Start battle';
          api.status('Player 2: place your fleet, then Start battle.');
          updateToolbar(); updatePills(); renderAll();
        });
      } else {
        showPass(1, 'Battle stations — Player 1 fires first.', function () {
          phase = 'battle'; reveal = false; busy = false; hoverCell = null;
          setView(1);
          api.status('Player 1: click a square on the enemy floor to fire.');
          updateToolbar(); updatePills(); renderAll();
        });
      }
    }

    function fire2p(r, c) {
      const i = r * N + c;
      if (eShots[i] !== 0) return;
      const res = resolveShot(enemyBoard, eShots, r, c);
      renderThem(); updatePills();
      const shooter = cur, nxt = cur === 1 ? 2 : 1;
      if (allSunk(enemyBoard)) { endGame2p(shooter); return; }
      const msg = res.sunk ? ('You sank their ' + res.name + ' (' + res.size + ').')
        : res.hit ? 'Direct hit.' : 'Splash — a miss.';
      busy = true;
      after(700, function () {
        if (!alive || phase !== 'battle') return;
        showPass(nxt, msg + ' Player ' + shooter + ', look away.', function () {
          setView(nxt); busy = false; reveal = false;
          api.status('Player ' + nxt + ': fire at the enemy floor.');
          updatePills(); renderAll();
        });
      });
    }

    function endGame2p(winner) {
      phase = 'over'; busy = true; reveal = true;
      updateToolbar(); updatePills(); renderAll();
      api.sfx.great();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Player ' + winner + ' wins.'),
        h('p', null, 'Player ' + winner + ' sank the entire enemy fleet.'),
        h('button', { class: 'btn primary', type: 'button', onclick: newGame }, 'Rematch'));
    }

    /* ---------------- combat ---------------- */
    function resolveShot(board, shots, r, c) {
      const i = r * N + c;
      const shipIdx = board.grid[i];
      if (shipIdx >= 0) {
        shots[i] = 2;
        const ship = board.ships[shipIdx];
        ship.hits++;
        if (ship.hits >= ship.size) { ship.sunk = true; api.sfx.boom(); return { hit: true, sunk: true, name: ship.name, size: ship.size }; }
        api.sfx.thud();
        return { hit: true, sunk: false, name: ship.name, size: ship.size };
      }
      shots[i] = 1;
      api.sfx.blip(240);
      return { hit: false, sunk: false };
    }

    function playerFire(r, c) {
      const i = r * N + c;
      if (eShots[i] !== 0) return;
      const res = resolveShot(enemyBoard, eShots, r, c);
      if (res.sunk) api.status('Cleared their ' + res.name + ' (' + res.size + '). ' + unsunk(enemyBoard) + ' asset(s) left.');
      else if (res.hit) api.status('Direct hit on the enemy floor.');
      else api.status('Splash. Nothing there.');
      renderThem(); updatePills();
      if (allSunk(enemyBoard)) { endGame(true); return; }
      turn = 'cpu'; busy = true;
      updatePills(); renderThem();
      after(560, cpuTurn);
    }

    function cpuTurn() {
      if (!alive || phase !== 'battle') return;
      const shot = cpuPick();
      if (!shot) { turn = 'player'; busy = false; renderThem(); return; }
      const res = resolveShot(playerBoard, pShots, shot[0], shot[1]);
      renderMe(); updatePills();
      if (allSunk(playerBoard)) { endGame(false); return; }
      turn = 'player'; busy = false;
      if (res.sunk) api.status('The CPU cleared your ' + res.name + ' (' + res.size + '). Your move.');
      else if (res.hit) api.status('The CPU tagged one of your assets. Your move.');
      else api.status('The CPU missed. Your move.');
      updatePills(); renderThem();
    }

    /* ---------------- CPU intelligence ---------------- */
    function allUnknown() {
      const a = [];
      for (let i = 0; i < N * N; i++) if (pShots[i] === 0) a.push([Math.floor(i / N), i % N]);
      return a;
    }
    function activeHits() {
      const out = [];
      for (const s of playerBoard.ships) {
        if (s.sunk) continue;
        for (const cc of s.cells) if (pShots[cc[0] * N + cc[1]] === 2) out.push(cc);
      }
      return out;
    }
    function cpuPick() {
      if (api.diffId === 'nightmare') return densityPick() || pick(allUnknown() ) || null;
      if (api.diffId !== 'chill') {
        const t = targetPick();
        if (t) return t;
      }
      return huntPick();
    }
    function targetPick() {
      const hits = activeHits();
      if (!hits.length) return null;
      const H = new Set(hits.map((k) => k[0] * N + k[1]));
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      const strong = [];
      for (const hc of hits) {
        const r = hc[0], c = hc[1];
        for (const d of dirs) {
          const dr = d[0], dc = d[1];
          if (!H.has((r + dr) * N + (c + dc))) continue;
          /* a line exists in this direction: aim just past each end */
          let er = r, ec = c;
          while (inb(er + dr, ec + dc) && H.has((er + dr) * N + (ec + dc))) { er += dr; ec += dc; }
          if (inb(er + dr, ec + dc) && pShots[(er + dr) * N + (ec + dc)] === 0) strong.push([er + dr, ec + dc]);
          let br = r, bc = c;
          while (inb(br - dr, bc - dc) && H.has((br - dr) * N + (bc - dc))) { br -= dr; bc -= dc; }
          if (inb(br - dr, bc - dc) && pShots[(br - dr) * N + (bc - dc)] === 0) strong.push([br - dr, bc - dc]);
        }
      }
      if (strong.length) return pick(strong);
      const weak = [];
      for (const hc of hits) {
        for (const d of dirs) {
          const nr = hc[0] + d[0], ncc = hc[1] + d[1];
          if (inb(nr, ncc) && pShots[nr * N + ncc] === 0) weak.push([nr, ncc]);
        }
      }
      return weak.length ? pick(weak) : null;
    }
    function huntPick() {
      const all = [], par = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (pShots[r * N + c] === 0) { all.push([r, c]); if ((r + c) % 2 === 0) par.push([r, c]); }
      }
      if (!all.length) return null;
      if (api.diffId === 'hard' && par.length) return pick(par);
      return pick(all);
    }
    function densityPick() {
      const rem = playerBoard.ships.filter((s) => !s.sunk).map((s) => s.size);
      if (!rem.length) return null;
      const activeSet = new Set(activeHits().map((k) => k[0] * N + k[1]));
      const avail = new Array(N * N);
      for (let i = 0; i < N * N; i++) {
        if (pShots[i] === 1) avail[i] = false;
        else if (pShots[i] === 2) avail[i] = !playerBoard.ships[playerBoard.grid[i]].sunk;
        else avail[i] = true;
      }
      const heat = new Array(N * N).fill(0);
      for (const size of rem) {
        for (let r = 0; r < N; r++) for (let c = 0; c <= N - size; c++) {
          let ok = true, cov = 0;
          for (let k = 0; k < size; k++) { const i = r * N + (c + k); if (!avail[i]) { ok = false; break; } if (activeSet.has(i)) cov++; }
          if (!ok) continue;
          const w = cov > 0 ? Math.pow(80, cov) : 1;
          for (let k = 0; k < size; k++) { const i = r * N + (c + k); if (pShots[i] === 0) heat[i] += w; }
        }
        for (let c = 0; c < N; c++) for (let r = 0; r <= N - size; r++) {
          let ok = true, cov = 0;
          for (let k = 0; k < size; k++) { const i = (r + k) * N + c; if (!avail[i]) { ok = false; break; } if (activeSet.has(i)) cov++; }
          if (!ok) continue;
          const w = cov > 0 ? Math.pow(80, cov) : 1;
          for (let k = 0; k < size; k++) { const i = (r + k) * N + c; if (pShots[i] === 0) heat[i] += w; }
        }
      }
      let bi = -1, bv = -1;
      for (let i = 0; i < N * N; i++) { if (pShots[i] === 0 && heat[i] > bv) { bv = heat[i]; bi = i; } }
      if (bi < 0) return null;
      return [Math.floor(bi / N), bi % N];
    }

    /* ---------------- end ---------------- */
    function endGame(playerWon) {
      phase = 'over'; busy = true; turn = null; reveal = true;
      updateToolbar(); updatePills(); renderAll();
      banner.style.display = '';
      if (playerWon) {
        wins++; streak++;
        api.save('wins', wins); api.save('streak', streak);
        const res = api.submit(streak);
        api.sfx.great();
        banner.replaceChildren(
          h('h3', null, 'Floor cleared.'),
          h('p', null, 'Every enemy asset accounted for. Career wins: ' + wins + '. Win streak: ' + streak + '.' +
            (res && res.isRecord ? ' New best streak.' : '')),
          h('button', { class: 'btn primary', type: 'button', onclick: newGame }, 'Run it again'));
      } else {
        streak = 0; api.save('streak', 0);
        api.sfx.bad();
        banner.replaceChildren(
          h('h3', null, 'You got audited.'),
          h('p', null, 'The CPU cleared your last asset. Streak reset to zero. Career wins: ' + wins + '.'),
          h('button', { class: 'btn primary', type: 'button', onclick: newGame }, 'Try again'));
      }
      updatePills();
    }

    /* ---------------- rendering ---------------- */
    function setCls(el, cls) { if (el.className !== cls) el.className = cls; }

    function renderMe() {
      let prev = null, prevOk = false;
      if (phase === 'setup' && setupIdx < FLEET.length && hoverCell) {
        const cells = footprint(hoverCell[0], hoverCell[1], FLEET[setupIdx].size, orient);
        prevOk = canPlace(playerBoard, cells);
        prev = new Set();
        for (const cc of cells) if (inb(cc[0], cc[1])) prev.add(cc[0] * N + cc[1]);
      }
      for (let i = 0; i < N * N; i++) {
        let cls = 'cell';
        const shipIdx = playerBoard.grid[i];
        if (pShots[i] === 2) cls += playerBoard.ships[shipIdx].sunk ? ' sunk' : ' hit';
        else if (pShots[i] === 1) cls += ' miss';
        else if (shipIdx >= 0) cls += ' ship';
        if (prev && prev.has(i)) cls += prevOk ? ' prev-ok' : ' prev-bad';
        setCls(me.cells[i], cls);
      }
    }

    function renderThem() {
      const live = phase === 'battle' && !busy && (mode === '2p' || turn === 'player');
      for (let i = 0; i < N * N; i++) {
        let cls = 'cell';
        if (eShots[i] === 2) cls += enemyBoard.ships[enemyBoard.grid[i]].sunk ? ' sunk' : ' hit';
        else if (eShots[i] === 1) cls += ' miss';
        else {
          cls += ' water';
          if (reveal && enemyBoard.grid[i] >= 0) cls += ' ghost';
          if (live) cls += ' live';
        }
        setCls(them.cells[i], cls);
      }
    }

    function renderAll() { renderMe(); renderThem(); }

    function updatePills() {
      if (mode === '2p') {
        meTitle.textContent = 'Player ' + cur + ' — your floor';
        pTurn.textContent = phase === 'setup' ? 'Player ' + cur + ' setup'
          : phase === 'over' ? 'Game over' : 'Player ' + cur + ' fires';
        pTurn.className = 'pill' + (phase === 'battle' ? ' good' : '');
        pEnemy.textContent = 'Enemy assets: ' + (enemyBoard ? unsunk(enemyBoard) : FLEET.length);
        pStreak.textContent = 'Hotseat';
        return;
      }
      meTitle.textContent = 'Your floor';
      pTurn.textContent = phase === 'setup' ? 'Setup'
        : phase === 'over' ? 'Game over'
          : (turn === 'player' ? 'Your move' : 'CPU firing');
      pTurn.className = 'pill' + (phase === 'battle' && turn === 'player' ? ' good'
        : phase === 'battle' && turn === 'cpu' ? ' warn' : '');
      pEnemy.textContent = 'Targets left: ' + (enemyBoard ? unsunk(enemyBoard) : FLEET.length);
      const b = api.best();
      pStreak.textContent = 'Streak ' + streak + (b ? ' · best ' + b : '');
    }

    function updateToolbar() {
      const setup = phase === 'setup';
      wrap.classList.toggle('setup-mode', setup);
      for (const b of setupBtns) b.style.display = setup ? '' : 'none';
      btnStart.disabled = !(setup && setupIdx >= FLEET.length);
    }

    newSetup();
    return function () { bagg.dispose(); };
  }

  Arcade.register({
    id: 'battleship',
    lightBoard: true,   // dark navy water + red hit fills invert to flat mid-grey; see css/arcade.css
    title: 'Battleship',
    emoji: 'battleship',
    cat: 'brain',
    order: 24,
    blurb: 'Hide five ships on your grid, then call shots at the enemy grid until one fleet is sunk. Ships wear office-asset names, but it plays like Battleship.',
    scoreLabel: 'Win streak',
    tags: ['battleship', 'strategy', 'vs-cpu', 'hotseat', 'grid'],
    how: [
      'Sink every ship on the enemy grid before the CPU sinks all of yours. Both grids are 10x10.',
      'Click a square on the enemy grid to fire. During setup, use Re-roll fleet, or Place by hand and press R to rotate.',
      'Fill every cell of a ship to sink it. The CPU fires blind until it lands a hit, then works along the ship.',
      'Win to extend your streak. A loss resets it to zero, and your best streak is the score to beat.',
      'Raise the difficulty for a smarter CPU. Chill fires at random; nightmare runs a probability map that tracks down your ships.',
      'Set Players to 2 for hotseat on one device. Each of you places a fleet, a cover screen hides it between turns, and you fire until one fleet is gone.'
    ],
    usesLetters: true,
    mount: mount
  });
})();
