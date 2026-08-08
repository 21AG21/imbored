/* Stack. Land each slab on the last one. Miss and it crumbles. */
(function () {
  'use strict';
  const { h } = Engine;
  const W = 520, H = 640, BH = 34;

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H, { maxHeight: '78vh' });
    const ctx = cv.ctx;

    let stack, cur, dir, speed, camY, score, slivers, over;

    const pScore = api.pill('Height: 0');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);
    api.button('Restart', reset);

    function reset() {
      const w0 = 230;
      stack = [{ x: (W - w0) / 2, w: w0 }];
      score = 0; camY = 0; slivers = []; over = false;
      speed = 180 + api.dm * 44;
      newBlock();
      banner.style.display = 'none';
      api.status('Click, tap, or Space to drop the slab. Whatever hangs over the edge is sliced away.');
      sync();
    }

    function screenTop(i) { return H - (i + 1) * BH + camY; }

    function newBlock() {
      const top = stack[stack.length - 1];
      cur = { x: 0, w: top.w, row: stack.length };
      dir = 1;
      speed += 4;
    }

    function drop() {
      if (over) return;
      const below = stack[stack.length - 1];
      const left = Math.max(cur.x, below.x);
      const right = Math.min(cur.x + cur.w, below.x + below.w);
      const overlap = right - left;
      if (overlap <= 0) return die();

      const sy = screenTop(cur.row);
      if (cur.x < below.x) slivers.push({ sx: cur.x, sy, w: below.x - cur.x, vx: -70, vy: -120, rot: 0 });
      if (cur.x + cur.w > below.x + below.w) slivers.push({ sx: below.x + below.w, sy, w: (cur.x + cur.w) - (below.x + below.w), vx: 70, vy: -120, rot: 0 });

      const perfect = overlap === below.w;
      stack.push({ x: left, w: overlap });
      score++;
      if (perfect) api.sfx.good(); else api.sfx.blip(340 + score * 12);
      sync();
      newBlock();
    }
    bagg.listen(cv.el, 'pointerdown', (e) => { e.preventDefault(); drop(); });
    bagg.add(Engine.onKey((e) => { if (e.code === 'Space' || e.key === ' ') { drop(); return true; } }));

    function die() {
      over = true;
      api.sfx.bad();
      const res = api.submit(score);
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'It topples.'),
        h('p', null, 'Height ' + score + '.' +
          (res.isRecord ? ' New record!' : res.isFirst ? '' : ' Best: ' + res.best + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Stack again'));
    }

    function update(dt) {
      if (over) return;
      cur.x += dir * speed * dt;
      if (cur.x < 0) { cur.x = 0; dir = 1; }
      if (cur.x + cur.w > W) { cur.x = W - cur.w; dir = -1; }

      const targetCam = Math.max(0, (stack.length + 1) * BH - 0.46 * H);
      camY += (targetCam - camY) * Math.min(1, dt * 7);

      for (const s of slivers) { s.vy += 1500 * dt; s.sy += s.vy * dt; s.sx += s.vx * dt; s.rot += dt * 4; }
      slivers = slivers.filter((s) => s.sy < H + 80);
    }

    function slab(x, y, w, i, active) {
      if (y > H || y < -BH) return;
      ctx.fillStyle = active ? '#ffd05a' : 'hsl(' + ((190 + i * 12) % 360) + ',52%,' + (44 + (i % 3) * 6) + '%)';
      ctx.fillRect(x, y, w, BH - 3);
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(x, y, w, 5);
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.fillRect(x, y + BH - 7, w, 4);
    }

    function draw() {
      ctx.fillStyle = '#141726';
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < stack.length; i++) slab(stack[i].x, screenTop(i), stack[i].w, i, false);
      if (!over) slab(cur.x, screenTop(cur.row), cur.w, cur.row, true);
      for (const s of slivers) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#8892b8';
        ctx.translate(s.sx + s.w / 2, s.sy + BH / 2);
        ctx.rotate(s.rot);
        ctx.fillRect(-s.w / 2, -BH / 2, s.w, BH - 3);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    function sync() { pScore.textContent = 'Height: ' + score; }

    reset();
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'stack',
    title: 'Stack',
    emoji: 'stack',
    cat: 'action',
    order: 36,
    blurb: 'Drop the sliding slab onto the tower. Miss the edge and it gets trimmed, thinner and thinner, until there is nothing left to aim at.',
    scoreLabel: 'Height',
    tags: ['stacker', 'timing', 'tower'],
    how: [
      'A slab slides back and forth. Click, tap, or Space drops it.',
      'Anything hanging past the slab below is sliced off, so precision keeps you wide.',
      'A perfect drop keeps the full width and plays a happier note.',
      'It speeds up as you climb. Height is your score.'
    ],
    mount
  });
})();
