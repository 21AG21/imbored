/* Jam Escape — slide the blockers, drive the red car out.
   Every level below was generated and solved by breadth-first search, so the
   shortest solution length after the "|" is exact. */
(function () {
  'use strict';
  const { h, clamp } = Engine;

  const LEVELS = [
    'EEE.../...HGG/IXXH.C/I.AH.C/FBADD./FBA...|5',
    '.GGCCD/....HD/EXX.H./E.AAH./EFF.BB/......|5',
    '....G./...CGB/XXFCHB/D.F.H./D.AA../...EE.|5',
    '.GG.EE/FFB.CC/XXBH../..BH../A...../A.IIDD|5',
    'EE.BB./GG.A../.XXADC/.H.ADC/.HFF../......|6',
    '.BBBGG/AAA.E./.XX.E./.D.FF./.D.CCC/......|6',
    '.AAA../..EC.B/XXEC.B/FFGGGB/..HH../.DD...|10',
    'JDDEE./J..FF./XX.KBH/C.AKBH/C.AII./C.AGGG|10',
    'IC.B.F/IC.BHF/I.XXHD/..EEHD/..A.GG/..A...|10',
    '..CCF./GGJJF./HXX.F./H.I.../HBIAAE/.B.DDE|10',
    'EEHHI./DD..I./..XXI./G..CC./GFFBAA/G..B..|11',
    'DDFF../.HHHE./..XXEG/JCAAEG/JCKI.G/J.KIBB|11',
    'FFFKGB/.JJKGB/..XXAB/C...A./C.EII./DDEHH.|12',
    '..AJJH/..A.CH/.XXECH/DI.EKK/DIFFGG/DIBBB.|13',
    'H.CCG./H...G./DBXXG./DB.AII/DBFAEE/..FJJJ|16',
    '..DDDE/...HCE/XXFHC./IIF..B/GLLAAB/GKK.JJ|16',
    'EE..../GKKKH./GXXJHC/IDDJ.C/I.ABBC/LLAFF.|17',
    'B..AJJ/B..ALI/.XX.LI/FFKHHI/.GK.DD/.GEECC|17',
    'GJ..../GJCCAB/GXXHAB/.DDHAB/..E.II/FFE...|18',
    'CCC.DD/.FFE../XXGEBI/..GEBI/JHH.BK/J.AA.K|19',
    'JCC.GG/J.AAA./XXE.../..EBHD/IIIBHD/FFF..D|20',
    'E.GGA./ECCJA./.XXJA./I.HBKK/I.HBFF/.DD...|20',
    'BBB..E/.IIIHE/AXX.H./AKG.HJ/AKGCCJ/.DD.FF|22',
    '.GGD.K/BBBDLK/XX..L./FFC.LI/J.CAAI/JEE.HH|22',
    '.KKDD./GGLL.C/AHXXFC/AH.EFC/AHBEII/MMBJJ.|22',
    '.CFF.I/.CG.BI/XXGKBD/LJJKBD/L.EM../AAEMHH|24',
    'ALLGG./AB..DI/ABXXDI/.BKKDE/..CJJE/FFCHH.|25',
    'II.HH./AAAEJF/XXDEJF/.KDGGF/BK..LL/BMM.CC|26'
  ];

  const N = 6, EXIT_ROW = 2;
  const CELL = 72, PAD = 22;
  const W = PAD * 2 + N * CELL + 44, H = PAD * 2 + N * CELL;

  const CARC = ['#38e1ff', '#9dff5c', '#ffc043', '#c08cff', '#ff8f4d', '#59f0d0',
    '#7aa2ff', '#f0f4ff', '#ffa8d8', '#b6c2dd', '#6ee7c4', '#ffd66b', '#8fb0ff'];

  function parse(spec) {
    const [gridStr, moves] = spec.split('|');
    const rows = gridStr.split('/');
    const seen = new Map();
    rows.forEach((row, r) => {
      for (let c = 0; c < N; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        if (!seen.has(ch)) seen.set(ch, { ch, r, c, len: 1, horiz: null });
        else {
          const v = seen.get(ch);
          if (v.horiz === null) v.horiz = r === v.r;
          v.len++;
        }
      }
    });
    const vs = [...seen.values()].map((v, i) => ({
      ch: v.ch, r: v.r, c: v.c, len: v.len,
      horiz: v.horiz === null ? true : v.horiz,
      red: v.ch === 'X',
      color: v.ch === 'X' ? '#ff4d5e' : CARC[i % CARC.length]
    }));
    return { vs, par: +moves };
  }

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;

    let level = clamp(api.load('level', 0), 0, LEVELS.length - 1);
    let vs, par, moves, solvedAnim, drag, done;

    const pLevel = api.pill('');
    const pMoves = api.pill('Moves: 0');
    const pPar = api.pill('Par: 0');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);

    api.button('Restart level', () => load(level));
    api.button('← Previous', () => { if (level > 0) load(level - 1); });
    api.button('Next →', () => { if (level < LEVELS.length - 1) load(level + 1); });

    function load(i) {
      level = clamp(i, 0, LEVELS.length - 1);
      api.save('level', level);
      const p = parse(LEVELS[level]);
      vs = p.vs; par = p.par;
      moves = 0; solvedAnim = 0; drag = null; done = false;
      banner.style.display = 'none';
      api.status('Drag a car along its own axis. Only the red car can leave, and only through the gap on the right.');
      sync();
    }

    function grid() {
      const g = Array.from({ length: N }, () => Array(N).fill(null));
      for (const v of vs) {
        for (let k = 0; k < v.len; k++) {
          const r = v.horiz ? v.r : v.r + k;
          const c = v.horiz ? v.c + k : v.c;
          if (r >= 0 && r < N && c >= 0 && c < N) g[r][c] = v;
        }
      }
      return g;
    }

    /* how many cells this vehicle can slide each way */
    function freedom(v) {
      const g = grid();
      let back = 0, fwd = 0;
      if (v.horiz) {
        for (let c = v.c - 1; c >= 0 && !g[v.r][c]; c--) back++;
        for (let c = v.c + v.len; c < N && !g[v.r][c]; c++) fwd++;
      } else {
        for (let r = v.r - 1; r >= 0 && !g[r][v.c]; r--) back++;
        for (let r = v.r + v.len; r < N && !g[r][v.c]; r++) fwd++;
      }
      return { back, fwd };
    }

    const bx = (c) => PAD + c * CELL;
    const by = (r) => PAD + r * CELL;

    function vehicleAt(px, py) {
      const c = Math.floor((px - PAD) / CELL), r = Math.floor((py - PAD) / CELL);
      if (r < 0 || c < 0 || r >= N || c >= N) return null;
      return grid()[r][c];
    }

    bagg.listen(cv.el, 'pointerdown', (e) => {
      if (done) return;
      const p = cv.pos(e);
      const v = vehicleAt(p.x, p.y);
      if (!v) return;
      cv.el.setPointerCapture(e.pointerId);
      const f = freedom(v);
      drag = { v, sx: p.x, sy: p.y, off: 0, min: -f.back * CELL, max: f.fwd * CELL };
    });

    bagg.listen(cv.el, 'pointermove', (e) => {
      if (!drag) return;
      const p = cv.pos(e);
      const raw = drag.v.horiz ? p.x - drag.sx : p.y - drag.sy;
      drag.off = clamp(raw, drag.min, drag.max);
    });

    function endDrag() {
      if (!drag) return;
      const { v, off } = drag;
      const cells = Math.round(off / CELL);
      drag = null;
      if (!cells) return;
      if (v.horiz) v.c += cells; else v.r += cells;
      moves++;
      api.sfx.click();
      sync();
      checkWin();
    }
    bagg.listen(cv.el, 'pointerup', endDrag);
    bagg.listen(cv.el, 'pointercancel', endDrag);

    function checkWin() {
      const red = vs.find((v) => v.red);
      if (!red || red.c + red.len !== N) return;
      const g = grid();
      for (let c = red.c + red.len; c < N; c++) if (g[EXIT_ROW][c]) return;
      done = true;
      solvedAnim = 0.001;
      api.sfx.great();
      const solved = Math.max(api.load('solved', 0), level + 1);
      api.save('solved', solved);
      api.submit(solved);
      setTimeout(() => {
        banner.style.display = '';
        banner.replaceChildren(
          h('h3', null, 'Out of the jam.'),
          h('p', null, 'Level ' + (level + 1) + ' in ' + moves + ' moves. Shortest possible: ' + par + '.' +
            (moves === par ? ' Perfect.' : moves <= par + 2 ? ' Very tidy.' : '')),
          level + 1 < LEVELS.length
            ? h('button', { class: 'btn primary', type: 'button', onclick: () => load(level + 1) }, 'Level ' + (level + 2) + ' →')
            : h('p', null, 'That was the last level. You beat all ' + LEVELS.length + '.'));
      }, 900);
    }

    function sync() {
      pLevel.textContent = 'Level ' + (level + 1) + '/' + LEVELS.length;
      pMoves.textContent = 'Moves: ' + moves;
      pPar.textContent = 'Par: ' + par;
      pMoves.className = 'pill ' + (moves > par ? 'warn' : moves ? 'good' : '');
    }

    function draw(dt) {
      if (solvedAnim > 0) solvedAnim += dt;
      ctx.fillStyle = '#0a1020';
      ctx.fillRect(0, 0, W, H);

      /* board */
      ctx.fillStyle = '#151d31';
      Engine.roundRect(ctx, PAD - 8, PAD - 8, N * CELL + 16, N * CELL + 16, 14);
      ctx.fill();
      ctx.strokeStyle = '#28324e';
      ctx.lineWidth = 1;
      for (let i = 0; i <= N; i++) {
        ctx.beginPath();
        ctx.moveTo(bx(i), by(0)); ctx.lineTo(bx(i), by(N));
        ctx.moveTo(bx(0), by(i)); ctx.lineTo(bx(N), by(i));
        ctx.stroke();
      }

      /* exit */
      const ey = by(EXIT_ROW);
      ctx.fillStyle = '#1b2740';
      ctx.fillRect(bx(N) + 8, ey + 6, 34, CELL - 12);
      ctx.fillStyle = '#ff4d5e';
      ctx.beginPath();
      ctx.moveTo(bx(N) + 16, ey + CELL / 2 - 12);
      ctx.lineTo(bx(N) + 38, ey + CELL / 2);
      ctx.lineTo(bx(N) + 16, ey + CELL / 2 + 12);
      ctx.closePath();
      ctx.fill();

      for (const v of vs) {
        let ox = 0, oy = 0;
        if (drag && drag.v === v) { if (v.horiz) ox = drag.off; else oy = drag.off; }
        if (solvedAnim > 0 && v.red) ox += Math.pow(solvedAnim, 2) * 900;
        const x = bx(v.c) + 5 + ox;
        const y = by(v.r) + 5 + oy;
        const w = (v.horiz ? v.len : 1) * CELL - 10;
        const hh = (v.horiz ? 1 : v.len) * CELL - 10;

        ctx.fillStyle = 'rgba(0,0,0,.32)';
        Engine.roundRect(ctx, x + 3, y + 4, w, hh, 11);
        ctx.fill();
        ctx.fillStyle = v.color;
        Engine.roundRect(ctx, x, y, w, hh, 11);
        ctx.fill();

        /* windows */
        ctx.fillStyle = 'rgba(10,16,32,.38)';
        if (v.horiz) Engine.roundRect(ctx, x + w * 0.24, y + 7, w * 0.52, hh - 14, 6);
        else Engine.roundRect(ctx, x + 7, y + hh * 0.24, w - 14, hh * 0.52, 6);
        ctx.fill();

        if (v.red) {
          ctx.fillStyle = 'rgba(255,255,255,.85)';
          ctx.font = 'bold 15px system-ui';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('YOU', x + w / 2, y + hh / 2);
        }
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    load(level);
    bagg.add(Engine.loop(draw));
    let rafId = 0;
    (function paint() { rafId = requestAnimationFrame(paint); if (Engine.paused) draw(0); })();
    bagg.add(() => cancelAnimationFrame(rafId));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'jam',
    title: 'Jam Escape',
    emoji: '🚗',
    cat: 'puzzle',
    order: 12,
    blurb: 'Twenty-eight parking-lot jams, every one solved by computer first so you know the exit exists.',
    scoreLabel: 'Levels solved',
    tags: ['rush hour', 'sliding', 'cars', 'unblock'],
    how: [
      'Drag any car along the direction it points. Cars never turn.',
      'Only the red car escapes, and only through the gap on the right edge.',
      '"Par" is the provably shortest solution — matching it is a genuine achievement.',
      'Levels are ordered by that shortest solution, so difficulty climbs steadily.'
    ],
    mount
  });
})();
