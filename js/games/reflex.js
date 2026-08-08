/* Reflex Grid. How fast are you, really? */
(function () {
  'use strict';
  const { h, clamp, rand, randInt } = Engine;

  const W = 760, H = 460;
  const TOTAL = 25;
  const MISS_PENALTY = 250;

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;

    let target, times, misses, shown, waiting, waitT, running, t, lastAvg;

    const pShot = api.pill('0 / ' + TOTAL);
    const pLast = api.pill('last: --');
    const pAvg = api.pill('avg: --');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);

    api.button('Start / restart', start);

    function start() {
      times = []; misses = 0; shown = 0;
      target = null; running = true; t = 0;
      waiting = true; waitT = rand(0.5, 1.3);
      banner.style.display = 'none';
      api.status('Click each circle the instant it appears. ' + TOTAL + ' targets. Clicking empty space costs you ' + MISS_PENALTY + 'ms.');
      sync();
    }

    function spawn() {
      const r = rand(24, 42);
      target = {
        x: rand(r + 14, W - r - 14),
        y: rand(r + 14, H - r - 14),
        r, born: t, grow: 0
      };
      shown++;
      api.sfx.blip(760);
    }

    function sync() {
      pShot.textContent = shown + ' / ' + TOTAL;
      pLast.textContent = 'last: ' + (times.length ? Math.round(times[times.length - 1]) + 'ms' : '--');
      const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length + misses * MISS_PENALTY / TOTAL : 0;
      lastAvg = avg;
      pAvg.textContent = 'avg: ' + (times.length ? Math.round(avg) + 'ms' : '--');
      pAvg.className = 'pill ' + (avg && avg < 320 ? 'good' : avg > 600 ? 'warn' : '');
    }

    bagg.listen(cv.el, 'pointerdown', (e) => {
      if (!running) return;
      const p = cv.pos(e);
      if (target && Math.hypot(p.x - target.x, p.y - target.y) <= target.r) {
        times.push((t - target.born) * 1000);
        target = null;
        api.sfx.good();
        sync();
        if (times.length >= TOTAL) return finish();
        waiting = true;
        waitT = rand(0.28, 1.15);
      } else {
        misses++;
        api.sfx.bad();
        sync();
      }
    });

    function finish() {
      running = false;
      const avg = Math.round(lastAvg);
      const res = api.submit(avg);
      api.sfx.great();
      const best = times.length ? Math.round(Math.min(...times)) : 0;
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, avg + 'ms average'),
        h('p', null, 'Fastest single click ' + best + 'ms, ' + misses + ' misclick' + (misses === 1 ? '' : 's') + '. ' +
          (avg < 280 ? 'That is genuinely quick.' : avg < 400 ? 'Solid human reflexes.' : 'You may need more coffee.') +
          (res.isRecord ? ' New personal best!' : res.isFirst ? '' : ' Best: ' + res.best + 'ms.')),
        h('button', { class: 'btn primary', type: 'button', onclick: start }, 'Go again'));
    }

    function update(dt) {
      if (!running) return;
      t += dt;
      if (waiting) {
        waitT -= dt;
        if (waitT <= 0) { waiting = false; spawn(); }
      } else if (target) {
        target.grow = Math.min(1, target.grow + dt * 9);
        /* on the mean settings a target you ignore simply leaves */
        if (api.hard && t - target.born > 1.4 / api.dm) {
          target = null; misses++; api.sfx.bad(); sync();
          waiting = true; waitT = rand(0.3, 0.9);
        }
      }
    }

    function draw() {
      ctx.fillStyle = '#080d18';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#111a2c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 40; x < W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 40; y < H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();

      if (target) {
        const r = target.r * (0.5 + target.grow * 0.5);
        const age = t - target.born;
        ctx.fillStyle = '#38e1ff';
        ctx.shadowColor = '#38e1ff';
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.arc(target.x, target.y, r, 0, 7);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#05202c';
        ctx.beginPath();
        ctx.arc(target.x, target.y, r * 0.42, 0, 7);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(target.x, target.y, r + 6 + age * 26, 0, 7);
        ctx.stroke();
      } else if (running) {
        ctx.fillStyle = '#39435e';
        ctx.font = 'bold 16px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('wait for it…', W / 2, H / 2);
        ctx.textAlign = 'left';
      }

      /* running bar of times */
      const bw = W / TOTAL;
      for (let i = 0; i < times.length; i++) {
        const v = clamp(times[i] / 900, 0.04, 1);
        ctx.fillStyle = times[i] < 300 ? '#9dff5c' : times[i] < 500 ? '#ffc043' : '#ff5c8f';
        ctx.fillRect(i * bw + 2, H - 6 - v * 46, bw - 4, v * 46);
      }
    }

    start();
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'reflex',
    title: 'Reflex Grid',
    emoji: '🎯',
    cat: 'brain',
    order: 23,
    blurb: 'Twenty five targets, one number at the end. The most brutally honest game on the shelf.',
    scoreLabel: 'Best avg',
    lowerIsBetter: true,
    formatScore: (v) => v + 'ms',
    tags: ['reaction', 'aim', 'speed', 'training'],
    how: [
      'A circle appears somewhere at a random moment. Click it as fast as you physically can.',
      'Twenty five targets a run. The bars along the bottom are every single reaction time.',
      'Clicking empty space is a misclick and costs you 250ms spread across the run.',
      'Lower is better here. The score kept is your best average.',
      'On Hard and Nightmare the targets get bored and leave if you take too long.'
    ],
    mount
  });
})();
