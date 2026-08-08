/* Pipe Dream. Rotate every pipe until the whole network is fed. */
(function () {
  'use strict';
  const { h, clamp, randInt } = Engine;

  const U = 1, R = 2, D = 4, L = 8;
  const DIRS = [
    { bit: U, dr: -1, dc: 0, opp: D },
    { bit: R, dr: 0, dc: 1, opp: L },
    { bit: D, dr: 1, dc: 0, opp: U },
    { bit: L, dr: 0, dc: -1, opp: R }
  ];
  const rotMask = (m, n) => { for (let i = 0; i < ((n % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15; return m; };

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, 620, 620);
    const ctx = cv.ctx;

    let level = clamp(api.load('level', 1), 1, 99);
    let N, cells, root0, CELL, OX, OY, moves, done, t;

    const pLevel = api.pill('');
    const pMoves = api.pill('Turns: 0');
    const pLeft = api.pill('');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);

    api.button('Scramble again', () => start(level));
    api.button('Back to level 1', () => start(1));

    const at = (r, c) => (r < 0 || c < 0 || r >= N || c >= N ? null : cells[r * N + c]);

    function start(lv) {
      level = clamp(lv, 1, 99);
      api.save('level', level);
      N = Engine.clamp(Math.round((4 + Math.floor((level - 1) / 2)) * (0.85 + api.dm * 0.15)), 3, 10);
      CELL = Math.min(112, Math.floor(560 / N));
      OX = (cv.w - N * CELL) / 2;
      OY = (cv.h - N * CELL) / 2;
      moves = 0; done = false; t = 0;

      /* random spanning tree = always solvable, every cell connected */
      cells = new Array(N * N).fill(null).map(() => ({ base: 0, rot: 0, ang: 0, target: 0, powered: false }));
      root0 = randInt(0, N * N - 1);
      const visited = new Set([root0]);
      const stack = [root0];
      while (stack.length) {
        const cur = stack[stack.length - 1];
        const r = Math.floor(cur / N), c = cur % N;
        const options = DIRS.filter((d) => {
          const nr = r + d.dr, nc = c + d.dc;
          return nr >= 0 && nc >= 0 && nr < N && nc < N && !visited.has(nr * N + nc);
        });
        if (!options.length) { stack.pop(); continue; }
        const d = options[randInt(0, options.length - 1)];
        const ni = (r + d.dr) * N + (c + d.dc);
        cells[cur].base |= d.bit;
        cells[ni].base |= d.opp;
        visited.add(ni);
        stack.push(ni);
      }

      /* scramble, and make sure we did not hand out a solved board */
      let anyTurned = false;
      for (const cell of cells) {
        cell.rot = randInt(0, 3);
        cell.ang = cell.target = cell.rot * Math.PI / 2;
        if (cell.rot && cell.base !== 15) anyTurned = true;
      }
      if (!anyTurned) {
        const i = randInt(0, N * N - 1);
        cells[i].rot = 1;
        cells[i].ang = cells[i].target = Math.PI / 2;
      }
      banner.style.display = 'none';
      api.status('Click a pipe to turn it clockwise, right-click for counter-clockwise. Feed every last pipe from the glowing source.');
      power();
    }

    const maskOf = (cell) => rotMask(cell.base, cell.rot);

    function power() {
      for (const c of cells) c.powered = false;
      const stack = [root0];
      cells[root0].powered = true;
      let n = 1;
      while (stack.length) {
        const cur = stack.pop();
        const r = Math.floor(cur / N), c = cur % N;
        const m = maskOf(cells[cur]);
        for (const d of DIRS) {
          if (!(m & d.bit)) continue;
          const nb = at(r + d.dr, c + d.dc);
          if (!nb || nb.powered) continue;
          if (!(maskOf(nb) & d.opp)) continue;
          nb.powered = true;
          n++;
          stack.push((r + d.dr) * N + (c + d.dc));
        }
      }
      pLevel.textContent = 'Level ' + level + '  (' + N + '×' + N + ')';
      pMoves.textContent = 'Turns: ' + moves;
      pLeft.textContent = n + '/' + cells.length + ' connected';
      pLeft.className = 'pill ' + (n === cells.length ? 'good' : '');
      if (n === cells.length && !done && moves > 0) win();
      return n;
    }

    function win() {
      done = true;
      api.sfx.great();
      api.submit(level);
      setTimeout(() => {
        banner.style.display = '';
        banner.replaceChildren(
          h('h3', null, 'Network live.'),
          h('p', null, 'Level ' + level + ' solved in ' + moves + ' turns.'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => start(level + 1) }, 'Level ' + (level + 1) + ' →'));
      }, 500);
    }

    function turn(r, c, dir) {
      const cell = at(r, c);
      if (!cell || done) return;
      cell.rot = (cell.rot + dir + 4) % 4;
      cell.target += dir * Math.PI / 2;
      moves++;
      api.sfx.click();
      power();
    }

    bagg.listen(cv.el, 'contextmenu', (e) => e.preventDefault());
    bagg.listen(cv.el, 'pointerdown', (e) => {
      const p = cv.pos(e);
      const c = Math.floor((p.x - OX) / CELL), r = Math.floor((p.y - OY) / CELL);
      if (r < 0 || c < 0 || r >= N || c >= N) return;
      turn(r, c, e.button === 2 ? -1 : 1);
    });

    function draw(dt) {
      t += dt;
      ctx.fillStyle = '#08101d';
      ctx.fillRect(0, 0, cv.w, cv.h);

      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const cell = at(r, c);
        cell.ang += (cell.target - cell.ang) * Math.min(1, dt * 14);
        const x = OX + c * CELL, y = OY + r * CELL;

        ctx.fillStyle = cell.powered ? '#111f33' : '#131a2b';
        Engine.roundRect(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 8);
        ctx.fill();
        ctx.strokeStyle = '#1d2740';
        ctx.lineWidth = 1;
        Engine.roundRect(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 8);
        ctx.stroke();

        /* the source sits under its pipe so the junction stays readable */
        if (r * N + c === root0) {
          const pulse = 1 + Math.sin(t * 3) * 0.08;
          ctx.fillStyle = 'rgba(255,192,67,.22)';
          ctx.beginPath();
          ctx.arc(x + CELL / 2, y + CELL / 2, CELL * 0.42 * pulse, 0, 7);
          ctx.fill();
          ctx.fillStyle = '#ffc043';
          ctx.shadowColor = '#ffc043';
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.arc(x + CELL / 2, y + CELL / 2, CELL * 0.19 * pulse, 0, 7);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        ctx.save();
        ctx.translate(x + CELL / 2, y + CELL / 2);
        ctx.rotate(cell.ang);
        const col = cell.powered ? '#38e1ff' : '#4d5a7a';
        ctx.strokeStyle = col;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(5, CELL * 0.16);
        if (cell.powered) { ctx.shadowColor = '#38e1ff'; ctx.shadowBlur = 10; }
        const reach = CELL / 2 - 2;
        const base = cell.base;
        ctx.beginPath();
        if (base & U) { ctx.moveTo(0, 0); ctx.lineTo(0, -reach); }
        if (base & R) { ctx.moveTo(0, 0); ctx.lineTo(reach, 0); }
        if (base & D) { ctx.moveTo(0, 0); ctx.lineTo(0, reach); }
        if (base & L) { ctx.moveTo(0, 0); ctx.lineTo(-reach, 0); }
        ctx.stroke();
        ctx.shadowBlur = 0;

        const deg = [U, R, D, L].filter((b) => base & b).length;
        ctx.fillStyle = col;
        if (deg === 1) {
          ctx.beginPath();
          ctx.arc(0, 0, CELL * 0.15, 0, 7);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, CELL * 0.085, 0, 7);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    start(level);
    bagg.add(Engine.loop(draw));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'pipes',
    title: 'Pipe Dream',
    emoji: 'pipes',
    cat: 'puzzle',
    order: 14,
    blurb: 'Spin every pipe until the whole grid lights up from one glowing source. Endless levels, all of them definitely solvable.',
    scoreLabel: 'Level',
    tags: ['net', 'rotate', 'connect', 'plumbing'],
    how: [
      'Left click spins a pipe clockwise. Right click spins it back.',
      'The amber blob is the source. Pipes glow when they are fed by it.',
      'Every single pipe has to end up connected. No orphans allowed, not even the little ones.',
      'Boards are grown from a random spanning tree, so a solution always exists by construction.',
      'Harder settings hand you bigger grids sooner.'
    ],
    mount
  });
})();
