/* Approach Control. Draw flight paths, land the right plane on the right runway. */
(function () {
  'use strict';
  const { h, clamp, rand, randInt, pick } = Engine;

  const W = 920, H = 600;
  const SEP = 30;             // separation minimum, px
  const TURN = 1.5;           // rad/s
  const SPEED = 62;           // px/s

  /* two runways: a touchdown point and the heading you must arrive on */
  const RUNWAYS = [
    { x: 250, y: 470, a: 0, len: 130, color: '#38e1ff', name: '09L' },
    { x: 690, y: 170, a: Math.PI, len: 130, color: '#ff5cc8', name: '27R' }
  ];

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;
    const dm = api.dm;

    let planes, landed, spawnT, over, drawing, t, warn;

    const pLanded = api.pill('Landed: 0');
    const pAir = api.pill('In the air: 0');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);

    api.button('Restart', reset);

    function reset() {
      planes = [];
      landed = 0; spawnT = 1.2; over = false; drawing = null; t = 0; warn = 0;
      banner.style.display = 'none';
      api.status('Drag from an aircraft to draw its route. Land each one on the runway that matches its colour, from the correct end.');
      for (let i = 0; i < 2; i++) spawn();
      sync();
    }

    function spawn() {
      if (planes.length > 11) return;
      const side = randInt(0, 3);
      let x, y, a;
      if (side === 0) { x = -20; y = rand(60, H - 60); a = 0; }
      else if (side === 1) { x = W + 20; y = rand(60, H - 60); a = Math.PI; }
      else if (side === 2) { x = rand(60, W - 60); y = -20; a = Math.PI / 2; }
      else { x = rand(60, W - 60); y = H + 20; a = -Math.PI / 2; }
      /* never drop a new arrival right on top of somebody */
      for (const p of planes) if (Math.hypot(p.x - x, p.y - y) < 110) return;
      const rw = randInt(0, RUNWAYS.length - 1);
      planes.push({
        x, y, a, rw, path: [], sel: false,
        big: Math.random() < 0.35,
        id: pick(['AC', 'BA', 'DL', 'LH', 'UA', 'QF', 'AF', 'NZ']) + randInt(100, 999)
      });
    }

    const nearestPlane = (x, y) => {
      let best = null, bd = 34;
      for (const p of planes) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    };

    bagg.listen(cv.el, 'pointerdown', (e) => {
      if (over) return;
      const pt = cv.pos(e);
      const p = nearestPlane(pt.x, pt.y);
      if (!p) return;
      cv.el.setPointerCapture(e.pointerId);
      p.path = [];
      drawing = p;
      planes.forEach((q) => { q.sel = q === p; });
    });

    bagg.listen(cv.el, 'pointermove', (e) => {
      if (!drawing) return;
      const pt = cv.pos(e);
      const last = drawing.path[drawing.path.length - 1] || { x: drawing.x, y: drawing.y };
      if (Math.hypot(pt.x - last.x, pt.y - last.y) > 13) drawing.path.push({ x: pt.x, y: pt.y });
    });

    function endDraw() {
      if (drawing) { drawing.sel = false; api.sfx.click(); }
      drawing = null;
    }
    bagg.listen(cv.el, 'pointerup', endDraw);
    bagg.listen(cv.el, 'pointercancel', endDraw);

    function angDiff(a, b) {
      let d = (b - a) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      return d;
    }

    function update(dt) {
      if (over) return;
      t += dt;
      warn = Math.max(0, warn - dt);

      spawnT -= dt;
      if (spawnT <= 0) {
        spawn();
        spawnT = Math.max(2.6, 8 - landed * 0.12) * rand(0.75, 1.3) / Math.min(dm, 1.7);
      }

      for (let i = planes.length - 1; i >= 0; i--) {
        const p = planes[i];
        const sp = SPEED * (p.big ? 1.18 : 1) * (0.8 + dm * 0.2);

        if (p.path.length) {
          const wp = p.path[0];
          const want = Math.atan2(wp.y - p.y, wp.x - p.x);
          p.a += clamp(angDiff(p.a, want), -TURN * dt, TURN * dt);
          if (Math.hypot(wp.x - p.x, wp.y - p.y) < 11) p.path.shift();
        }
        p.x += Math.cos(p.a) * sp * dt;
        p.y += Math.sin(p.a) * sp * dt;

        /* wandered out of the airspace */
        if (p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) {
          if (p.everInside) return crash('lost an aircraft off the edge of the airspace', p);
        } else p.everInside = true;

        /* landing */
        const rw = RUNWAYS[p.rw];
        if (Math.hypot(p.x - rw.x, p.y - rw.y) < 20 && Math.abs(angDiff(p.a, rw.a)) < 0.62) {
          planes.splice(i, 1);
          landed++;
          api.sfx.good();
          sync();
          continue;
        }
        /* landed on the wrong runway = go-around, not a crash, but it costs you */
        const other = RUNWAYS[1 - p.rw];
        if (Math.hypot(p.x - other.x, p.y - other.y) < 18 && Math.abs(angDiff(p.a, other.a)) < 0.5) {
          p.path = [];
          p.a += Math.PI;
          p.x += Math.cos(p.a) * 26;
          p.y += Math.sin(p.a) * 26;
          warn = 1.2;
          api.sfx.bad();
        }
      }

      for (let i = 0; i < planes.length; i++) {
        for (let j = i + 1; j < planes.length; j++) {
          const d = Math.hypot(planes[i].x - planes[j].x, planes[i].y - planes[j].y);
          if (d < SEP) return crash('two aircraft lost separation', planes[i]);
          if (d < SEP * 2.4) warn = Math.max(warn, 0.4);
        }
      }
      sync();
    }

    function crash(reason, p) {
      over = true;
      api.sfx.boom();
      const res = api.submit(landed);
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Incident.'),
        h('p', null, 'You ' + reason + ' after landing ' + landed + '.' +
          (res.isRecord ? ' New personal best!' : res.isFirst ? '' : ' Best: ' + res.best + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Back on shift'));
    }

    function sync() {
      pLanded.textContent = 'Landed: ' + landed;
      pAir.textContent = 'In the air: ' + planes.length;
      pAir.className = 'pill ' + (planes.length > 8 ? 'warn' : '');
    }

    function draw() {
      ctx.fillStyle = '#071019';
      ctx.fillRect(0, 0, W, H);

      /* radar rings */
      ctx.strokeStyle = 'rgba(80,220,180,.07)';
      ctx.lineWidth = 1;
      for (let r = 90; r < 700; r += 90) {
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, r, 0, 7);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
      ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
      ctx.stroke();

      /* runways */
      for (const rw of RUNWAYS) {
        ctx.save();
        ctx.translate(rw.x, rw.y);
        ctx.rotate(rw.a);
        ctx.fillStyle = '#1b2536';
        Engine.roundRect(ctx, -rw.len, -13, rw.len + 26, 26, 4);
        ctx.fill();
        ctx.strokeStyle = rw.color;
        ctx.lineWidth = 2;
        Engine.roundRect(ctx, -rw.len, -13, rw.len + 26, 26, 4);
        ctx.stroke();
        ctx.setLineDash([12, 12]);
        ctx.strokeStyle = 'rgba(255,255,255,.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-rw.len + 10, 0); ctx.lineTo(10, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        /* touchdown marker */
        ctx.fillStyle = rw.color;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, 7);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = rw.color;
        ctx.font = 'bold 12px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(rw.name, rw.x, rw.y + 34);
      }

      /* paths */
      for (const p of planes) {
        if (!p.path.length) continue;
        ctx.strokeStyle = RUNWAYS[p.rw].color;
        ctx.globalAlpha = p.sel ? 0.95 : 0.45;
        ctx.lineWidth = p.sel ? 2.6 : 1.6;
        ctx.setLineDash([6, 7]);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        for (const wp of p.path) ctx.lineTo(wp.x, wp.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      /* separation halos */
      for (let i = 0; i < planes.length; i++) {
        for (let j = i + 1; j < planes.length; j++) {
          const a = planes[i], b = planes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > SEP * 2.4) continue;
          ctx.strokeStyle = 'rgba(255,77,94,' + clamp(1 - d / (SEP * 2.4), 0, 1).toFixed(2) + ')';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      /* aircraft */
      for (const p of planes) {
        const col = RUNWAYS[p.rw].color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);
        const s = p.big ? 1.28 : 1;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(13 * s, 0);
        ctx.lineTo(-6 * s, 8 * s);
        ctx.lineTo(-2 * s, 0);
        ctx.lineTo(-6 * s, -8 * s);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = 'rgba(200,214,238,.72)';
        ctx.font = '10px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(p.id, p.x + 13, p.y - 10);

        ctx.strokeStyle = 'rgba(255,255,255,.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, SEP / 2, 0, 7);
        ctx.stroke();
      }

      if (warn > 0) {
        ctx.strokeStyle = 'rgba(255,77,94,' + clamp(warn, 0, 0.8).toFixed(2) + ')';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, W - 6, H - 6);
      }
      ctx.textAlign = 'left';
    }

    reset();
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    let rafId = 0;
    (function paint() { rafId = requestAnimationFrame(paint); if (Engine.paused) draw(); })();
    bagg.add(() => cancelAnimationFrame(rafId));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'atc',
    title: 'Approach Control',
    emoji: 'atc',
    cat: 'sim',
    order: 4,
    blurb: 'Drag a route from each plane and it flies the line you draw. Land each one on the matching-colour runway without letting two get too close.',
    scoreLabel: 'Landings',
    tags: ['air traffic', 'planes', 'radar', 'routing'],
    how: [
      'Drag from a plane to draw its route. Release and it follows the line.',
      'Match each plane to the runway of its colour, and land it heading along the dashed centreline.',
      'Touch down on the wrong runway and the plane goes around again, costing you time.',
      'Let two planes cross inside the white ring and the shift ends. Same if one flies off the screen.',
      'Your score is the number of planes landed before that happens.'
    ],
    mount
  });
})();
