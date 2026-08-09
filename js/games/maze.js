/* Maze. A perfect maze (exactly one path between any two cells), so it always
   has a solution and can never trap you. Get from the corner to the flag. */
(function () {
  'use strict';
  const { h, clamp, randInt, shuffle } = Engine;

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, 640, 640);
    const ctx = cv.ctx;

    const SIZE = { chill: 9, normal: 15, hard: 21, nightmare: 29 }[api.diffId] || 15;

    let cells, N, px, py, trail, done, level, startedAt, showSol, sol, steps;

    const pLevel = api.pill('');
    const pSteps = api.pill('Steps: 0');
    const pTime = api.pill('0:00');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);
    Engine.dpad(root, (d) => { if (d !== 'action') step(d); }, { class: 'touch-only' });

    /* each cell stores which walls are still standing */
    function generate(n) {
      N = n;
      cells = [];
      for (let i = 0; i < n * n; i++) cells.push({ N: true, S: true, E: true, W: true, v: false });
      /* recursive-backtracker carve, iterative so big mazes never overflow */
      const stack = [0];
      cells[0].v = true;
      const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
      const DXY = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
      while (stack.length) {
        const cur = stack[stack.length - 1];
        const cx = cur % n, cy = Math.floor(cur / n);
        const nbrs = [];
        for (const dir of ['N', 'S', 'E', 'W']) {
          const nx = cx + DXY[dir][0], ny = cy + DXY[dir][1];
          if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
          const ni = ny * n + nx;
          if (!cells[ni].v) nbrs.push([dir, ni]);
        }
        if (!nbrs.length) { stack.pop(); continue; }
        const [dir, ni] = nbrs[randInt(0, nbrs.length - 1)];
        cells[cur][dir] = false;
        cells[ni][OPP[dir]] = false;
        cells[ni].v = true;
        stack.push(ni);
      }
    }

    /* breadth-first path from player to the exit, for the hint */
    function solve() {
      const n = N, start = py * n + px, goal = n * n - 1;
      const prev = new Int32Array(n * n).fill(-2);
      prev[start] = -1;
      const q = [start];
      const DXY = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
      while (q.length) {
        const cur = q.shift();
        if (cur === goal) break;
        const cx = cur % n, cy = Math.floor(cur / n);
        for (const dir of ['N', 'S', 'E', 'W']) {
          if (cells[cur][dir]) continue;
          const nx = cx + DXY[dir][0], ny = cy + DXY[dir][1];
          const ni = ny * n + nx;
          if (prev[ni] === -2) { prev[ni] = cur; q.push(ni); }
        }
      }
      const path = [];
      let c = goal;
      while (c >= 0) { path.push(c); c = prev[c]; }
      return path.reverse();
    }

    function start(nextLevel) {
      level = nextLevel ? (level || 0) + 1 : 1;
      generate(SIZE + (nextLevel ? Math.min(8, (level - 1) * 2) : 0));
      px = 0; py = 0;
      trail = [0];
      done = false; showSol = false; steps = 0;
      startedAt = Date.now();
      banner.style.display = 'none';
      api.status('Arrows, WASD, swipe or the pad. Reach the flag in the far corner. Stuck? Tap Show path.');
      draw();
    }

    function step(dir) {
      if (done) return;
      const map = { up: 'N', down: 'S', left: 'W', right: 'E' };
      const d = map[dir];
      if (!d) return;
      const cur = py * N + px;
      if (cells[cur][d]) { api.sfx.thud(); return; }
      const DXY = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
      px += DXY[d][0]; py += DXY[d][1];
      steps++;
      const ni = py * N + px;
      const back = trail.length > 1 && trail[trail.length - 2] === ni;
      if (back) trail.pop(); else trail.push(ni);
      showSol = false;
      api.sfx.blip(440 + (px + py) % 5 * 40);
      pSteps.textContent = 'Steps: ' + steps;
      if (px === N - 1 && py === N - 1) win();
      draw();
    }

    function win() {
      done = true;
      const secs = Math.round((Date.now() - startedAt) / 1000);
      const reached = Math.max(api.load('level', 0), level);
      api.save('level', reached);
      api.submit(reached);
      api.sfx.great();
      Engine.autoAdvance(banner, 'Out.',
        'Maze ' + level + ' (' + N + '×' + N + ') in ' + steps + ' steps and ' + Engine.fmtTime(secs) + '.',
        'Bigger maze', () => start(true));
      draw();
    }

    function draw() {
      const pad = 18;
      const cell = (cv.w - pad * 2) / N;
      ctx.fillStyle = '#0f1729';
      ctx.fillRect(0, 0, cv.w, cv.h);

      const X = (c) => pad + c * cell;
      const Y = (r) => pad + r * cell;

      /* solution hint */
      if (showSol) {
        sol = solve();
        ctx.strokeStyle = 'rgba(56,225,255,.5)';
        ctx.lineWidth = Math.max(3, cell * 0.32);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        sol.forEach((ci, i) => {
          const x = X(ci % N) + cell / 2, y = Y(Math.floor(ci / N)) + cell / 2;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.stroke();
        ctx.lineCap = 'butt';
      }

      /* breadcrumb trail */
      ctx.strokeStyle = 'rgba(255,203,31,.55)';
      ctx.lineWidth = Math.max(2, cell * 0.2);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      trail.forEach((ci, i) => {
        const x = X(ci % N) + cell / 2, y = Y(Math.floor(ci / N)) + cell / 2;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();

      /* exit cell */
      ctx.fillStyle = '#1e6b3a';
      ctx.fillRect(X(N - 1) + 2, Y(N - 1) + 2, cell - 4, cell - 4);

      /* walls */
      ctx.strokeStyle = '#cfc6ae';
      ctx.lineWidth = Math.max(2, cell * 0.14);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const cellObj = cells[r * N + c];
        const x = X(c), y = Y(r);
        if (cellObj.N) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
        if (cellObj.W) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
        if (cellObj.S) { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
        if (cellObj.E) { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
      }
      ctx.stroke();
      ctx.lineCap = 'butt';

      /* flag */
      const fx = X(N - 1) + cell / 2, fy = Y(N - 1) + cell / 2;
      ctx.strokeStyle = '#fffdf3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx, fy + cell * 0.3);
      ctx.lineTo(fx, fy - cell * 0.3);
      ctx.stroke();
      ctx.fillStyle = '#e8402a';
      ctx.beginPath();
      ctx.moveTo(fx, fy - cell * 0.3);
      ctx.lineTo(fx + cell * 0.32, fy - cell * 0.18);
      ctx.lineTo(fx, fy - cell * 0.06);
      ctx.closePath();
      ctx.fill();

      /* player */
      ctx.fillStyle = '#38e1ff';
      ctx.beginPath();
      ctx.arc(X(px) + cell / 2, Y(py) + cell / 2, cell * 0.3, 0, 7);
      ctx.fill();
      ctx.strokeStyle = '#0c1119';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    bagg.add(Engine.onKey((e) => {
      const m = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right'
      }[e.key];
      if (m) { step(m); return true; }
    }));
    bagg.add(Engine.swipe(cv.el, step));

    api.button('New maze', () => start(false));
    const solBtn = api.button('Show path', () => {
      showSol = !showSol;
      solBtn.classList.toggle('on', showSol);
      draw();
    });

    start(false);
    let rafId = 0;
    (function paint() { rafId = requestAnimationFrame(paint); if (Engine.paused) draw(); })();
    bagg.add(() => cancelAnimationFrame(rafId));
    const t = setInterval(() => {
      if (done || !startedAt) return;
      pTime.textContent = Engine.fmtTime((Date.now() - startedAt) / 1000);
      pLevel.textContent = 'Maze ' + level + '  ' + N + '×' + N;
    }, 500);
    bagg.add(() => clearInterval(t));

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'maze',
    title: 'Maze',
    emoji: 'maze',
    cat: 'puzzle',
    order: 16,
    blurb: 'Get from the top-left corner to the flag. Every maze is perfect, so exactly one path connects any two cells and there is always a way out.',
    scoreLabel: 'Level',
    tags: ['maze', 'labyrinth', 'navigation'],
    how: [
      'Move one cell at a time with the arrows, WASD, a swipe, or the on-screen pad.',
      'Your yellow breadcrumb marks where you have been so you do not retread.',
      'Reach the green flag in the far corner. Each maze you clear makes the next one larger.',
      'Press Show path to draw the route out. It costs you nothing.',
      'Every maze is carved with one path between any two cells, so a solution always exists.'
    ],
    mount
  });
})();
