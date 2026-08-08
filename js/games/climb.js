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
    blurb: 'You bounce forever on your own. All you do is steer onto the next shelf, and the next, until you miss one. Then it is a long way down.',
    scoreLabel: 'Height',
    tags: ['doodle', 'jump', 'platform'],
    how: [
      'You bounce on your own, forever. Steering left and right is the only thing you control.',
      'Move with the arrow keys, A/D, or by holding the mouse to either side of the field. Walk off one edge and you reappear on the other.',
      'You only bounce when falling onto the top of a shelf, so aim your descent. Green shelves sit still; orange ones slide, and harder settings deal more of the moving kind.',
      'The screen scrolls up as you gain height and never comes back down. Fall off the bottom and the run ends.',
      'Your score is how high you climbed before gravity won.'
    ],
    mount
  });
})();
