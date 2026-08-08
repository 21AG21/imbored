/* Flap. One button between you and the floor. */
(function () {
  'use strict';
  const { h, clamp, randInt } = Engine;
  const W = 560, H = 640;
  const BX = 150, R = 16, PIPE_W = 74, SPACING = 250;
  const GRAV = 1500, FLAP_V = -430;

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H, { maxHeight: '78vh' });
    const ctx = cv.ctx;

    let by, bv, pipes, score, started, over;

    const pScore = api.pill('Score: 0');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);
    api.button('Restart', reset);

    const gap = () => Math.max(120, 190 - api.dm * 24);
    const speed = () => 168 + api.dm * 42;

    function reset() {
      by = H / 2; bv = 0; pipes = []; score = 0; started = false; over = false;
      spawn(W + 120);
      spawn(W + 120 + SPACING);
      spawn(W + 120 + SPACING * 2);
      banner.style.display = 'none';
      api.status('Click, tap, or press Space to flap. Thread every gap.');
      sync();
    }

    function spawn(x) {
      pipes.push({ x, cy: randInt(130, H - 130), g: gap(), passed: false });
    }

    function flap() {
      if (over) return;
      started = true;
      bv = FLAP_V;
      api.sfx.blip(680);
    }
    bagg.listen(cv.el, 'pointerdown', (e) => { e.preventDefault(); flap(); });
    bagg.add(Engine.onKey((e) => {
      if (e.code === 'Space' || e.key === ' ' || e.key === 'ArrowUp') { flap(); return true; }
    }));

    function die() {
      over = true;
      api.sfx.bad();
      const res = api.submit(score);
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Down it goes.'),
        h('p', null, score + ' pipe' + (score === 1 ? '' : 's') + ' cleared.' +
          (res.isRecord ? ' New best!' : res.isFirst ? '' : ' Best: ' + res.best + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Try again'));
    }

    function update(dt) {
      if (over || !started) return;
      bv += GRAV * dt;
      by += bv * dt;

      const sp = speed();
      for (const p of pipes) p.x -= sp * dt;
      while (pipes.length && pipes[0].x < -PIPE_W) pipes.shift();
      const lastX = pipes.length ? pipes[pipes.length - 1].x : W;
      if (lastX <= W - SPACING) spawn(lastX + SPACING);

      for (const p of pipes) {
        if (!p.passed && p.x + PIPE_W < BX) { p.passed = true; score++; api.sfx.good(); sync(); }
      }

      if (by + R > H - 6 || by - R < 6) return die();
      for (const p of pipes) {
        if (BX + R > p.x && BX - R < p.x + PIPE_W &&
          (by - R < p.cy - p.g / 2 || by + R > p.cy + p.g / 2)) return die();
      }
    }

    function sync() { pScore.textContent = 'Score: ' + score; }

    function draw() {
      ctx.fillStyle = '#7ec0ee';
      ctx.fillRect(0, 0, W, H);

      for (const p of pipes) {
        ctx.fillStyle = '#4aa72e';
        ctx.fillRect(p.x, 0, PIPE_W, p.cy - p.g / 2);
        ctx.fillRect(p.x, p.cy + p.g / 2, PIPE_W, H - (p.cy + p.g / 2));
        ctx.fillStyle = 'rgba(0,0,0,.16)';
        ctx.fillRect(p.x + PIPE_W - 10, 0, 10, p.cy - p.g / 2);
        ctx.fillRect(p.x + PIPE_W - 10, p.cy + p.g / 2, 10, H - (p.cy + p.g / 2));
        ctx.fillStyle = '#3c8a24';
        ctx.fillRect(p.x - 3, p.cy - p.g / 2 - 16, PIPE_W + 6, 16);
        ctx.fillRect(p.x - 3, p.cy + p.g / 2, PIPE_W + 6, 16);
      }

      ctx.fillStyle = '#caa24a';
      ctx.fillRect(0, H - 6, W, 6);

      const rot = clamp(bv / 620, -0.5, 1.2);
      ctx.save();
      ctx.translate(BX, by);
      ctx.rotate(started ? rot : 0);
      ctx.fillStyle = '#ffd02a';
      ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
      ctx.fillStyle = '#fffdf3';
      ctx.beginPath(); ctx.arc(6, -5, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#1d1722';
      ctx.beginPath(); ctx.arc(8, -5, 2.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8402a';
      ctx.fillRect(R - 3, -2, 9, 5);
      ctx.restore();

      if (!started && !over) {
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        ctx.font = 'bold 22px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('tap / space to flap', W / 2, H / 2 - 70);
        ctx.textAlign = 'left';
      }
    }

    reset();
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'flap',
    title: 'Flap',
    emoji: 'flap',
    cat: 'action',
    order: 34,
    blurb: 'One button, one bird, one floor. The gaps never get bigger and you never get better quite fast enough.',
    scoreLabel: 'Score',
    tags: ['flappy', 'one-button', 'tap'],
    how: [
      'Click, tap, or press Space for one flap upward. Every flap is exactly the same size.',
      'Gravity keeps pulling you down between flaps, so you are constantly correcting.',
      'Thread the gap in each pipe. Touching a pipe, the floor, or the ceiling ends the run instantly.',
      'Your score is the number of pipes you clear. Harder settings tighten the gaps and speed up the scroll.'
    ],
    mount
  });
})();
