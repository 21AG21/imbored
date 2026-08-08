/* Rock Field. Asteroids, with a hyperspace button for panic moments. */
(function () {
  'use strict';
  const { h, clamp, rand, randInt } = Engine;

  const W = 820, H = 560;
  const SIZES = { 3: 44, 2: 26, 1: 15 };
  const VALUE = { 3: 20, 2: 50, 1: 100 };

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;
    const keys = Engine.keys(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', ' ']);
    bagg.add(() => keys.dispose());

    let ship, rocks, bullets, bits, score, lives, wave, over, inv, fireCd, waveT;

    const pScore = api.pill('Score: 0');
    const pLives = api.pill('▲▲▲');
    const pWave = api.pill('Wave 1');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);
    Engine.dpad(root, (d) => {
      if (d === 'left') ship.a -= 0.28;
      else if (d === 'right') ship.a += 0.28;
      else if (d === 'up') { ship.thrusting = true; setTimeout(() => { ship.thrusting = false; }, 180); }
      else if (d === 'down') hyperspace();
      else fire();
    }, { center: '●', class: 'touch-only' });

    api.button('Restart', () => reset(true));

    function reset(full) {
      if (full) { score = 0; lives = api.dm > 2 ? 1 : api.dm > 1.2 ? 2 : 3; wave = 1; }
      ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, thrusting: false };
      rocks = []; bullets = []; bits = [];
      inv = 2.4; fireCd = 0; waveT = 0; over = false;
      spawnWave();
      banner.style.display = 'none';
      api.status('← → turn · ↑ thrust · Space fire · ↓ or Shift for hyperspace (risky).');
      sync();
    }

    function spawnWave() {
      const n = Math.min(14, Math.round((3 + wave) * api.dm));
      for (let i = 0; i < n; i++) {
        let x, y, guard = 0;
        do {
          x = rand(0, W); y = rand(0, H);
          guard++;
        } while (Math.hypot(x - ship.x, y - ship.y) < 180 && guard < 60);
        rocks.push(makeRock(x, y, 3));
      }
    }

    function makeRock(x, y, size) {
      const r = SIZES[size];
      const pts = [];
      const n = randInt(8, 12);
      for (let i = 0; i < n; i++) pts.push(rand(0.72, 1.28));
      const sp = rand(22, 52) + wave * 3;
      const ang = rand(0, Math.PI * 2);
      return {
        x, y, size, r, pts,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        rot: rand(0, 6.28), spin: rand(-1.2, 1.2)
      };
    }

    const wrap = (o) => {
      if (o.x < -30) o.x += W + 60;
      if (o.x > W + 30) o.x -= W + 60;
      if (o.y < -30) o.y += H + 60;
      if (o.y > H + 30) o.y -= H + 60;
    };

    function fire() {
      if (over || fireCd > 0 || bullets.length >= 5) return;
      bullets.push({
        x: ship.x + Math.cos(ship.a) * 15,
        y: ship.y + Math.sin(ship.a) * 15,
        vx: Math.cos(ship.a) * 560 + ship.vx,
        vy: Math.sin(ship.a) * 560 + ship.vy,
        life: 1.15
      });
      fireCd = 0.16;
      api.sfx.tone({ freq: 880, to: 320, dur: 0.08, vol: 0.07, type: 'square' });
    }

    function hyperspace() {
      if (over) return;
      ship.x = rand(40, W - 40);
      ship.y = rand(40, H - 40);
      ship.vx = ship.vy = 0;
      inv = Math.max(inv, 0.7);
      api.sfx.tone({ freq: 200, to: 1200, dur: 0.22, vol: 0.08, type: 'sine' });
      /* the classic risk: you might land on a rock */
      for (const r of rocks) {
        if (Math.hypot(r.x - ship.x, r.y - ship.y) < r.r + 12) { boom(); return; }
      }
    }

    function explode(x, y, n, color) {
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2), s = rand(40, 220);
        bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 1), color });
      }
    }

    function boom() {
      if (inv > 0) return;
      lives--;
      explode(ship.x, ship.y, 26, '#38e1ff');
      api.sfx.boom();
      sync();
      if (lives <= 0) return end();
      ship.x = W / 2; ship.y = H / 2; ship.vx = ship.vy = 0; ship.a = -Math.PI / 2;
      inv = 2.4;
    }

    function end() {
      over = true;
      const res = api.submit(score);
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Ship lost.'),
        h('p', null, score.toLocaleString() + ' points across ' + wave + ' waves.' +
          (res.isRecord ? ' New personal best!' : res.isFirst ? '' : ' Best: ' + res.best.toLocaleString() + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: () => reset(true) }, 'Launch again'));
    }

    function sync() {
      pScore.textContent = 'Score: ' + score.toLocaleString();
      pLives.textContent = lives > 0 ? '▲'.repeat(lives) : '--';
      pLives.className = 'pill ' + (lives <= 1 ? 'bad' : '');
      pWave.textContent = 'Wave ' + wave;
    }

    function update(dt) {
      if (over) return;
      inv = Math.max(0, inv - dt);
      fireCd = Math.max(0, fireCd - dt);

      if (keys.get('ArrowLeft', 'a')) ship.a -= 3.6 * dt;
      if (keys.get('ArrowRight', 'd')) ship.a += 3.6 * dt;
      ship.thrusting = keys.get('ArrowUp', 'w') || ship.thrusting;
      if (keys.get('ArrowUp', 'w')) {
        ship.vx += Math.cos(ship.a) * 330 * dt;
        ship.vy += Math.sin(ship.a) * 330 * dt;
      }
      if (keys.get('Space', ' ')) fire();

      const sp = Math.hypot(ship.vx, ship.vy);
      if (sp > 400) { ship.vx *= 400 / sp; ship.vy *= 400 / sp; }
      ship.vx *= Math.pow(0.55, dt);
      ship.vy *= Math.pow(0.55, dt);
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;
      wrap(ship);

      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.life -= dt;
        wrap(b);
        if (b.life <= 0) bullets.splice(i, 1);
      }

      for (const r of rocks) {
        r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.spin * dt;
        wrap(r);
      }

      for (let i = bits.length - 1; i >= 0; i--) {
        const p = bits[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= Math.pow(0.2, dt); p.vy *= Math.pow(0.2, dt);
        p.life -= dt;
        if (p.life <= 0) bits.splice(i, 1);
      }

      /* bullets vs rocks */
      outer:
      for (let ri = rocks.length - 1; ri >= 0; ri--) {
        const r = rocks[ri];
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
          const b = bullets[bi];
          if (Math.hypot(b.x - r.x, b.y - r.y) > r.r) continue;
          bullets.splice(bi, 1);
          rocks.splice(ri, 1);
          score += VALUE[r.size];
          explode(r.x, r.y, r.size * 6, '#b9c4dd');
          api.sfx.thud();
          if (r.size > 1) {
            for (let k = 0; k < 2; k++) {
              const nr = makeRock(r.x, r.y, r.size - 1);
              nr.vx += rand(-40, 40); nr.vy += rand(-40, 40);
              rocks.push(nr);
            }
          }
          sync();
          continue outer;
        }
        if (inv <= 0 && Math.hypot(ship.x - r.x, ship.y - r.y) < r.r + 9) boom();
      }

      if (!rocks.length) {
        waveT += dt;
        if (waveT > 1.1) {
          waveT = 0;
          wave++;
          score += 100;
          api.sfx.great();
          spawnWave();
          sync();
        }
      }
    }

    function draw() {
      ctx.fillStyle = '#05080f';
      ctx.fillRect(0, 0, W, H);

      /* starfield */
      ctx.fillStyle = 'rgba(255,255,255,.24)';
      for (let i = 0; i < 60; i++) {
        const x = (i * 137.5) % W, y = (i * 311.7) % H;
        ctx.fillRect(x, y, 1.4, 1.4);
      }

      for (const p of bits) {
        ctx.globalAlpha = clamp(p.life, 0, 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = '#b9c4dd';
      ctx.lineWidth = 2;
      for (const r of rocks) {
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.rot);
        ctx.beginPath();
        r.pts.forEach((m, i) => {
          const a = i / r.pts.length * Math.PI * 2;
          const x = Math.cos(a) * r.r * m, y = Math.sin(a) * r.r * m;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = '#fff';
      for (const b of bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2.4, 0, 7);
        ctx.fill();
      }

      if (!over && (inv <= 0 || Math.floor(inv * 10) % 2 === 0)) {
        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(ship.a);
        ctx.strokeStyle = '#38e1ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-11, 9);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-11, -9);
        ctx.closePath();
        ctx.stroke();
        if (ship.thrusting) {
          ctx.strokeStyle = '#ff8f4d';
          ctx.beginPath();
          ctx.moveTo(-7, 5);
          ctx.lineTo(-16 - Math.random() * 8, 0);
          ctx.lineTo(-7, -5);
          ctx.stroke();
        }
        ctx.restore();
      }
      ship.thrusting = false;
    }

    bagg.add(Engine.onKey((e) => {
      if (e.key === 'Shift' || e.key === 'ArrowDown') { hyperspace(); return true; }
      if (e.key === ' ') { fire(); return true; }
    }));

    reset(true);
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'asteroids',
    title: 'Rock Field',
    emoji: 'asteroids',
    cat: 'action',
    order: 33,
    blurb: 'Drifting, shooting, and the slow horror of realising momentum does not stop just because you did.',
    scoreLabel: 'Score',
    tags: ['asteroids', 'space', 'shooter', 'retro'],
    how: [
      'Left and right rotate, up thrusts. There is no brake. Turn around and burn the other way.',
      'Space fires. Five shots on screen at a time.',
      'Big rocks split into two mediums, mediums into two smalls, and the smalls are worth the most.',
      'Shift or down jumps you somewhere random. It may also drop you inside a rock. That is the deal.',
      'Clearing a wave is worth 100 and the next one is bigger. Nightmare starts you with one ship.'
    ],
    mount
  });
})();
