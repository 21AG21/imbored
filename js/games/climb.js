/* Climb. Bounce up the shelves. Do not look down. */
(function () {
  'use strict';
  const { h, clamp, randInt } = Engine;
  const W = 480, H = 680;
  const PW = 78, PH = 16, R = 18;
  const JUMP = -720, GRAV = 1500, START_PY = H - 80;

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H, { maxHeight: '80vh' });
    const ctx = cv.ctx;
    const keys = Engine.keys(['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D']);
    bagg.add(() => keys.dispose());

    let px, py, vy, plats, camY, best, over, started, facing, pointerDir;

    const pScore = api.pill('Height: 0');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);
    api.button('Restart', reset);

    bagg.listen(cv.el, 'pointerdown', (e) => { started = true; aim(e); });
    bagg.listen(cv.el, 'pointermove', (e) => { if (e.buttons) aim(e); });
    bagg.listen(cv.el, 'pointerup', () => { pointerDir = 0; });
    bagg.listen(cv.el, 'pointerleave', () => { pointerDir = 0; });
    function aim(e) { pointerDir = cv.pos(e).x < W / 2 ? -1 : 1; }

    function mkPlat(y) {
      const moving = Math.random() < clamp(0.09 * api.dm, 0, 0.42);
      return { x: randInt(6, W - PW - 6), y, moving, dir: Math.random() < 0.5 ? -1 : 1, vx: 42 + api.dm * 22 };
    }

    function reset() {
      plats = [{ x: (W - PW) / 2, y: H - 40, moving: false, dir: 1, vx: 0 }];
      let y = H - 40;
      for (let i = 0; i < 16; i++) { y -= randInt(74, 112); plats.push(mkPlat(y)); }
      px = W / 2; py = START_PY; vy = JUMP; camY = 0; best = 0;
      over = false; started = false; facing = 1; pointerDir = 0;
      banner.style.display = 'none';
      api.status('Steer with the mouse, arrow keys, or A/D. You bounce on your own — just line up the shelves.');
      sync();
    }

    function topY() { let m = 1e9; for (const p of plats) if (p.y < m) m = p.y; return m; }

    function die() {
      over = true;
      api.sfx.bad();
      const res = api.submit(Math.round(best / 10));
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'And down.'),
        h('p', null, 'Height ' + Math.round(best / 10) + '.' +
          (res.isRecord ? ' New peak!' : res.isFirst ? '' : ' Best: ' + res.best + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Climb again'));
    }

    function update(dt) {
      if (over) return;
      const k = (keys.get('ArrowLeft', 'a', 'A') ? -1 : 0) + (keys.get('ArrowRight', 'd', 'D') ? 1 : 0);
      const dir = k || pointerDir;
      if (dir) facing = dir;
      // the on-canvas prompt and the how-to text both promise a key press
      // starts the climb, but only pointerdown ever set `started` — a
      // keyboard-only player following the game's own instructions saw
      // nothing happen at all
      if (k) started = true;
      px += dir * 320 * dt;
      if (px < -R) px = W + R; else if (px > W + R) px = -R;

      if (started) { vy += GRAV * dt; py += vy * dt; }

      for (const p of plats) {
        if (!p.moving) continue;
        p.x += p.dir * p.vx * dt;
        if (p.x < 4) { p.x = 4; p.dir = 1; } else if (p.x > W - PW - 4) { p.x = W - PW - 4; p.dir = -1; }
      }

      if (vy > 0) {
        for (const p of plats) {
          if (px + R > p.x && px - R < p.x + PW &&
            py + R >= p.y && py + R <= p.y + PH + Math.max(0, vy * dt)) {
            py = p.y - R; vy = JUMP; api.sfx.blip(560); break;
          }
        }
      }

      const line = camY + H * 0.42;
      if (py < line) camY += (py - line);

      plats = plats.filter((p) => p.y < camY + H + 60);
      let ty = topY();
      while (ty > camY - 60) { ty -= randInt(74, 112); plats.push(mkPlat(ty)); }

      const climbed = START_PY - py;
      if (climbed > best) best = climbed;
      sync();

      if (py - camY > H + R) return die();
    }

    function sync() { pScore.textContent = 'Height: ' + Math.max(0, Math.round(best / 10)); }

    function draw() {
      ctx.fillStyle = '#1b2340';
      ctx.fillRect(0, 0, W, H);
      for (const p of plats) {
        const sy = p.y - camY;
        if (sy < -PH || sy > H) continue;
        ctx.fillStyle = p.moving ? '#c9822e' : '#3bbf6a';
        ctx.fillRect(p.x, sy, PW, PH);
        ctx.fillStyle = 'rgba(255,255,255,.16)';
        ctx.fillRect(p.x, sy, PW, 4);
      }
      const sy = py - camY;
      ctx.fillStyle = '#ffd02a';
      ctx.beginPath(); ctx.arc(px, sy, R, 0, 7); ctx.fill();
      ctx.fillStyle = '#1d1722';
      ctx.beginPath(); ctx.arc(px + facing * 5, sy - 5, 2.6, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(px + facing * 5 + facing * 6, sy - 5, 2.6, 0, 7); ctx.fill();
      if (!started && !over) {
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        ctx.font = 'bold 20px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('click or press a key to start', W / 2, H * 0.5);
        ctx.textAlign = 'left';
      }
    }

    reset();
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'climb',
    title: 'Climb',
    emoji: 'climb',
    cat: 'action',
    order: 37,
    blurb: 'You bounce on your own and steer onto the next shelf up. Miss one and you fall off the bottom.',
    scoreLabel: 'Height',
    tags: ['doodle', 'jump', 'platform'],
    how: [
      'You bounce automatically. Steering left and right is all you control.',
      'Move with arrow keys, A/D, or hold the mouse to one side of the field. Leave one edge and you reappear on the other.',
      'You bounce only when landing on top of a shelf, so line up your descent. Green shelves hold still; orange ones slide, and harder settings add more sliding ones.',
      'The view scrolls up as you climb and never drops back. Fall past the bottom and the run ends.',
      'Your score is the height you reach before you fall.'
    ],
    mount
  });
})();
