/* Desk Lander — a little lunar-lander. Fight gravity with a thin fuel tank,
   come down slow and upright on a pad. Touch the ground too fast and it's a
   crater. */
(function () {
  'use strict';
  const { h, clamp, randInt } = Engine;
  const W = 460, H = 400;

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;
    const keys = Engine.keys(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'a', 'd', 'w', 'A', 'D', 'W', ' ']);
    bagg.add(() => keys.dispose());

    let ship, terrain, pads, state, landings, msgT;
    // difficulty: stronger pull, thinner fuel, narrower pads as it climbs — but
    // every tier must stay physically landable (THRUST-GRAV net decel with fuel
    // to spare), so nightmare only tightens the margin, it doesn't make it a coin
    // toss with no coin.
    const GRAV = 26 + api.dm * 7;                        // normal 33 ... nightmare 44
    const THRUST = 82;
    const ROT = 2.6;
    const FUEL0 = clamp(Math.round(170 - api.dm * 20), 118, 220);   // nightmare still ~4s of burn
    const SAFE_V = clamp(46 - api.dm * 6, 30, 60);      // max safe descent speed (floor raised)
    const SAFE_A = 0.30;                                 // max tilt off vertical (rad)

    const pFuel = api.pill('fuel 100');
    const pVel = api.pill('v 0');
    const pLand = api.pill('landings 0');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);
    api.button('New flight', () => reset(true));

    /* on-screen controls */
    const pad = h('div', { class: 'lander-pad' });
    const mk = (label, code, cls) => {
      const b = h('button', { class: 'lander-btn ' + (cls || ''), type: 'button' }, label);
      const set = (v) => { keys.state[code] = v; };
      bagg.listen(b, 'pointerdown', (e) => { e.preventDefault(); set(true); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => bagg.listen(b, ev, () => set(false)));
      return b;
    };
    pad.append(mk('◀', 'ArrowLeft'), mk('THRUST', 'ArrowUp', 'thrust'), mk('▶', 'ArrowRight'));
    root.appendChild(pad);

    /* Build terrain LEFT TO RIGHT with strictly-increasing x (so the collision
       scan is valid) and lay each landing pad flat, snapping the walk to the pad
       start so a pad can never be jumped over and lost. */
    function buildTerrain() {
      terrain = []; pads = [];
      const nPads = api.dm >= 1.8 ? 1 : 2;
      const padW = clamp(82 - api.dm * 12, 50, 92);
      const padStarts = [];
      for (let i = 0; i < nPads; i++) {
        const slot = (W - 120) / nPads;
        padStarts.push(Math.round(70 + i * slot + randInt(0, Math.max(1, Math.floor(slot - padW - 10)))));
      }
      padStarts.sort((a, b) => a - b);
      let y = H - randInt(40, 90), x = 0, lastX = -4, pi = 0;
      const push = (nx, ny, pad) => { nx = Math.max(nx, lastX + 4); terrain.push({ x: nx, y: ny, pad: !!pad }); lastX = nx; };
      push(0, y);
      while (x < W) {
        if (pi < padStarts.length && padStarts[pi] < W && x + 46 >= padStarts[pi]) {
          push(padStarts[pi], y);                       // pad left edge (flat, at current y)
          const left = terrain[terrain.length - 1].x;
          push(Math.min(left + padW, W - 2), y, true);  // pad right edge
          const right = terrain[terrain.length - 1].x;
          pads.push({ x1: left, x2: right, y });
          x = right; pi++;
          y = clamp(y + randInt(-42, 42), H - 150, H - 30);
        } else {
          let nx = x + randInt(28, 56);
          if (pi < padStarts.length) nx = Math.min(nx, padStarts[pi]);   // never overshoot a pad start
          nx = Math.min(nx, W);
          y = clamp(y + randInt(-34, 34), H - 172, H - 24);
          push(nx, y);
          x = nx;
        }
      }
      if (terrain[terrain.length - 1].x < W) push(W, y);
      // belt-and-braces: if a pad somehow didn't land, flatten a mid segment
      if (!pads.length) {
        const i = Math.floor(terrain.length / 2);
        const py = terrain[i].y;
        terrain[i - 1].y = py; terrain[i].pad = true;
        pads.push({ x1: terrain[i - 1].x, x2: terrain[i].x, y: py });
      }
    }

    function groundYAt(px) {
      for (let i = 0; i < terrain.length - 1; i++) {
        const a = terrain[i], b = terrain[i + 1];
        if (px >= a.x && px <= b.x) {
          if (b.x === a.x) return Math.min(a.y, b.y);
          const t = (px - a.x) / (b.x - a.x);
          return a.y + (b.y - a.y) * t;
        }
      }
      return H;
    }
    function padAt(px) { return pads.find((p) => px >= p.x1 && px <= p.x2); }

    function reset(newTerrain) {
      if (newTerrain || !terrain) buildTerrain();
      ship = { x: W / 2 + randInt(-60, 60), y: 40, vx: randInt(-10, 10), vy: 8, a: 0, fuel: FUEL0, thrust: false };
      state = 'fly'; msgT = 0;
      banner.style.display = 'none';
      api.status('Rotate with ◀ ▶ (or arrows), hold THRUST to fire the engine. Set down on a flat pad going slower than ' + Math.round(SAFE_V) + ', roughly upright. Fuel is limited.');
    }

    function update(dt) {
      if (state !== 'fly') { msgT -= dt; if (msgT <= 0 && state === 'crash') reset(false); if (msgT <= 0 && state === 'land') reset(true); return; }
      const left = keys.get('ArrowLeft') || keys.get('a') || keys.get('A');
      const right = keys.get('ArrowRight') || keys.get('d') || keys.get('D');
      const up = keys.get('ArrowUp') || keys.get('w') || keys.get('W') || keys.get(' ');
      if (left) ship.a -= ROT * dt;
      if (right) ship.a += ROT * dt;
      ship.a = clamp(ship.a, -Math.PI / 2, Math.PI / 2);
      ship.thrust = up && ship.fuel > 0;
      if (ship.thrust) {
        ship.vx += Math.sin(ship.a) * THRUST * dt;
        ship.vy -= Math.cos(ship.a) * THRUST * dt;
        ship.fuel = Math.max(0, ship.fuel - 30 * dt);
        if (Math.random() < 0.5) api.sfx.blip(140 + Math.random() * 60);
      }
      ship.vy += GRAV * dt;
      ship.x += ship.vx * dt; ship.y += ship.vy * dt;
      if (ship.x < 6) { ship.x = 6; ship.vx = Math.abs(ship.vx) * 0.4; }
      if (ship.x > W - 6) { ship.x = W - 6; ship.vx = -Math.abs(ship.vx) * 0.4; }

      const gy = groundYAt(ship.x);
      if (ship.y + 12 >= gy) {
        ship.y = gy - 12;
        const speed = Math.hypot(ship.vx, ship.vy);
        const onPad = padAt(ship.x);
        const upright = Math.abs(ship.a) <= SAFE_A;
        if (onPad && speed <= SAFE_V && upright) land(speed);
        else crash(speed, onPad, upright);
      }
      pFuel.textContent = 'fuel ' + Math.round(ship.fuel);
      pVel.textContent = 'v ' + Math.round(Math.hypot(ship.vx, ship.vy));
    }

    function land(speed) {
      state = 'land'; msgT = 1.6; api.sfx.great();
      landings = api.load('landings', 0) + 1; api.save('landings', landings);
      pLand.textContent = 'landings ' + landings;
      api.submit(landings);
      const fuelPct = Math.round(ship.fuel / FUEL0 * 100);
      show('Touchdown', 'Clean landing at ' + Math.round(speed) + '. Fuel left: ' + fuelPct + '%.', true);
      try { const r = banner.getBoundingClientRect(); Engine.fx.burst(r.left + r.width / 2, r.top + 30, 44); } catch (e) { /* ignore */ }
    }
    function crash(speed, onPad, upright) {
      state = 'crash'; msgT = 1.4; api.sfx.boom ? api.sfx.boom() : api.sfx.bad();
      const why = !onPad ? 'Missed the pad.' : !upright ? 'Came in crooked.' : 'Too fast at ' + Math.round(speed) + '.';
      show('Crater', why + ' Try again.', false);
    }
    function show(t, sub, good) {
      banner.style.display = '';
      banner.className = 'banner' + (good ? ' win' : '');
      banner.replaceChildren(h('h3', null, t), h('p', null, sub));
    }

    function draw() {
      ctx.fillStyle = '#0b1026'; ctx.fillRect(0, 0, W, H);
      // stars
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (let i = 0; i < 40; i++) { const sx = (i * 97) % W, sy = (i * 53) % (H - 120); ctx.fillRect(sx, sy, 1.5, 1.5); }
      // terrain
      ctx.beginPath(); ctx.moveTo(0, H);
      for (const pt of terrain) ctx.lineTo(pt.x, pt.y);
      ctx.lineTo(W, H); ctx.closePath();
      ctx.fillStyle = '#2b2440'; ctx.fill();
      ctx.strokeStyle = '#b7a7e0'; ctx.lineWidth = 2; ctx.stroke();
      // pads
      for (const p of pads) {
        ctx.fillStyle = '#6fcf2f'; ctx.fillRect(p.x1, p.y - 3, p.x2 - p.x1, 5);
        ctx.fillStyle = '#eafff0'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('▲', (p.x1 + p.x2) / 2, p.y - 6); ctx.textAlign = 'left';
      }
      // ship
      ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.a);
      if (ship.thrust) {
        ctx.fillStyle = '#ffcb1f';
        ctx.beginPath(); ctx.moveTo(-4, 10); ctx.lineTo(4, 10); ctx.lineTo(0, 18 + Math.random() * 8); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#dfe6ff';
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(9, 8); ctx.lineTo(-9, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#00a6b4'; ctx.beginPath(); ctx.arc(0, -2, 3.4, 0, 7); ctx.fill();
      ctx.strokeStyle = '#dfe6ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(-10, 14); ctx.moveTo(6, 8); ctx.lineTo(10, 14); ctx.stroke();
      ctx.restore();
      // safe-speed tint on the HUD velocity
      const spd = Math.hypot(ship.vx, ship.vy);
      ctx.fillStyle = spd <= SAFE_V ? '#6fcf2f' : '#e8402a';
      ctx.fillRect(W - 60, 10, 50, 6);
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(W - 60, 10, 50 * clamp(spd / (SAFE_V * 2), 0, 1), 6);
    }

    /* ---- test seam ---- */
    window.__lander = {
      get: () => ({ pads: pads.map((p) => ({ ...p })), ship: { ...ship }, state, landings: landings || 0, SAFE_V }),
      key: (code, v) => { keys.state[code] = v; }
    };
    bagg.add(() => { if (window.__lander) delete window.__lander; });

    reset(true);
    bagg.add(Engine.loop((dt) => { update(Math.min(0.05, dt)); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'lander', title: 'Desk Lander', emoji: 'lander', cat: 'action', order: 30,
    blurb: 'A lunar lander with a nearly empty fuel tank. Rotate, feather the thrust, and set down on a flat pad slowly and upright — or leave a crater.',
    scoreLabel: 'Landings', tags: ['physics', 'space', 'skill'],
    how: [
      'Rotate the craft with ◀ ▶ or the arrow keys, and hold THRUST (up / W / space) to fire the engine.',
      'Gravity is always pulling you down and your fuel runs out, so short taps beat holding it down.',
      'Land on a green pad, coming down slowly and roughly upright. The speed bar turns green when you are slow enough.',
      'Miss the pad, come in crooked, or hit too fast and it is a crash. Each clean landing adds to your streak.'
    ],
    mount
  });
})();
