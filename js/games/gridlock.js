/* Gridlock. Twelve junctions, a working day, and a budget.
   Cars route themselves and queue behind each other. You own the signals,
   the money, and the blame. */
(function () {
  'use strict';
  const { h, clamp, rand, randInt, pick } = Engine;

  const W = 980, H = 600;
  const ROWS = 3, COLS = 4;
  const X0 = 152, DX = 226;
  const Y0 = 132, DY = 176;
  const OFF = 80;
  const LANE = 9;
  const ROAD = 38;
  const HALF_INT = 25;
  const CIRCLE_R = 46;

  const nodeX = (c) => X0 + c * DX;
  const nodeY = (r) => Y0 + r * DY;

  /* ---------------- vehicle classes ---------------- */
  const KINDS = {
    car: { len: 21, wid: 11, vmax: 92, acc: 150, dec: 330, fee: 1, weight: 68 },
    truck: { len: 34, wid: 13, vmax: 72, acc: 78, dec: 260, fee: 4, weight: 13 },
    bus: { len: 40, wid: 14, vmax: 78, acc: 96, dec: 280, fee: 9, weight: 12, stops: true },
    ambulance: { len: 27, wid: 12, vmax: 124, acc: 210, dec: 400, fee: 30, weight: 7 }
  };
  const CAR_COLORS = ['#ff5c8f', '#38e1ff', '#9dff5c', '#ffcb1f', '#c08cff', '#ff8f4d', '#59f0d0', '#f0f4ff'];

  /* ---------------- what you can buy ---------------- */
  const SHOP = [
    { id: 'smart', name: 'Smart Signal', cost: 140, place: true, desc: 'Times itself off the queue lengths. Stops being your problem.' },
    { id: 'circle', name: 'Roundabout', cost: 260, place: true, desc: 'No signal at all. Brilliant until it is busy, then it is a car park.' },
    { id: 'over', name: 'Overpass', cost: 560, place: true, desc: 'Grade separation. Nobody ever stops here again. Costs a fortune.' },
    { id: 'wider', name: 'Wider Roads', cost: 190, repeat: 3, desc: 'Higher limit and tighter following, everywhere at once.' },
    { id: 'priority', name: 'Ambulance Priority', cost: 230, desc: 'Signals turn green for a siren before it arrives.' },
    { id: 'reports', name: 'Congestion Reports', cost: 120, desc: 'Paints the queues red so you can see trouble coming.' }
  ];

  /* a day is three shifts, each pushing traffic a different way */
  const SHIFTS = [
    { name: 'MORNING PEAK', until: 38, inWeight: { W: 4, N: 3, E: 1, S: 1 }, rate: 0.85 },
    { name: 'MIDDAY', until: 70, inWeight: { W: 1, N: 1, E: 1, S: 1 }, rate: 1.25 },
    { name: 'EVENING PEAK', until: 104, inWeight: { W: 1, N: 1, E: 4, S: 3 }, rate: 0.8 }
  ];
  const DAY_LEN = 104;

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;
    const dm = api.dm;

    let nodes, cars, money, day, dayT, delivered, rage, over, prefill;
    let upgrades, placing, shopOpen, tripSum, tripN, spawnT, ambT, autoMode;
    let drag, hint, hintT;

    const pDay = api.pill('');
    const pMoney = api.pill('');
    const pThrough = api.pill('');
    const pTrip = api.pill('');

    const meterWrap = h('div', { class: 'panel', style: { width: 'min(620px,100%)' } },
      h('h4', null, 'Commuter rage'),
      h('div', { class: 'meter' }, h('i', { style: { width: '0%' } })));
    const meter = meterWrap.querySelector('i');

    const shopEl = h('div', { class: 'panel gl-shop', style: { display: 'none' } });
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.append(meterWrap, shopEl, banner);

    function reset() {
      nodes = [];
      for (let r = 0; r < ROWS; r++) {
        nodes.push([]);
        for (let c = 0; c < COLS; c++) {
          nodes[r].push({
            r, c, type: 'light',
            phase: (r + c) % 2 ? 'NS' : 'EW',
            t: rand(0, 6), red: 0, pending: null, flash: 0,
            peds: 0, pedWait: 0, qNS: 0, qEW: 0, minGreen: 0
          });
        }
      }
      cars = [];
      money = 0; day = 1; dayT = 0; delivered = 0; rage = 0;
      tripSum = 0; tripN = 0;
      upgrades = { wider: 0, priority: 0, reports: 0 };
      placing = null; shopOpen = false; over = false;
      spawnT = 0.2; ambT = rand(18, 34);
      autoMode = true;
      drag = null; hint = ''; hintT = 0;
      shopEl.style.display = 'none';
      banner.style.display = 'none';

      prefill = true;
      for (let i = 0; i < 400; i++) update(1 / 30);
      prefill = false;
      delivered = 0; rage = 0; money = 0; dayT = 0; tripSum = 0; tripN = 0;

      api.status('Click a junction to flip it. Drag along a row or column for a green wave. Survive the day, then spend the takings.');
      sync(0);
    }

    const speedScale = () => 1 + upgrades.wider * 0.11;
    const followGap = () => 30 - upgrades.wider * 2.4;

    /* ---------------- routing ---------------- */
    function weightedSide(wmap) {
      const entries = Object.entries(wmap);
      const total = entries.reduce((a, [, w]) => a + w, 0);
      let x = Math.random() * total;
      for (const [k, w] of entries) { x -= w; if (x <= 0) return k; }
      return entries[0][0];
    }

    function buildPath(inSide, outSide) {
      let sr, sc, er, ec;
      if (inSide === 'W') { sr = randInt(0, ROWS - 1); sc = 0; }
      else if (inSide === 'E') { sr = randInt(0, ROWS - 1); sc = COLS - 1; }
      else if (inSide === 'N') { sr = 0; sc = randInt(0, COLS - 1); }
      else { sr = ROWS - 1; sc = randInt(0, COLS - 1); }

      if (outSide === 'W') { er = randInt(0, ROWS - 1); ec = 0; }
      else if (outSide === 'E') { er = randInt(0, ROWS - 1); ec = COLS - 1; }
      else if (outSide === 'N') { er = 0; ec = randInt(0, COLS - 1); }
      else { er = ROWS - 1; ec = randInt(0, COLS - 1); }

      const horizIn = inSide === 'W' || inSide === 'E';
      const horizOut = outSide === 'W' || outSide === 'E';
      const list = [];
      const push = (r, c) => {
        const last = list[list.length - 1];
        if (!last || last[0] !== r || last[1] !== c) list.push([r, c]);
      };
      const runH = (r, a, b) => { const s = b > a ? 1 : -1; for (let c = a; ; c += s) { push(r, c); if (c === b) break; } };
      const runV = (c, a, b) => { const s = b > a ? 1 : -1; for (let r = a; ; r += s) { push(r, c); if (r === b) break; } };

      if (horizIn && horizOut) { const m = randInt(0, COLS - 1); runH(sr, sc, m); runV(m, sr, er); runH(er, m, ec); }
      else if (horizIn) { runH(sr, sc, ec); runV(ec, sr, er); }
      else if (!horizOut) { const m = randInt(0, ROWS - 1); runV(sc, sr, m); runH(m, sc, ec); runV(ec, m, er); }
      else { runV(sc, sr, er); runH(er, sc, ec); }

      const pts = list.map(([r, c]) => ({ x: nodeX(c), y: nodeY(r), r, c }));
      const first = pts[0], last = pts[pts.length - 1];
      const entry = inSide === 'W' ? { x: -OFF, y: first.y } : inSide === 'E' ? { x: W + OFF, y: first.y }
        : inSide === 'N' ? { x: first.x, y: -OFF } : { x: first.x, y: H + OFF };
      const exit = outSide === 'W' ? { x: -OFF, y: last.y } : outSide === 'E' ? { x: W + OFF, y: last.y }
        : outSide === 'N' ? { x: last.x, y: -OFF } : { x: last.x, y: H + OFF };

      const raw = [entry].concat(pts, [exit]);
      const clean = [raw[0]];
      for (let i = 1; i < raw.length; i++) {
        const p = raw[i], q = clean[clean.length - 1];
        if (Math.abs(p.x - q.x) < 0.5 && Math.abs(p.y - q.y) < 0.5) continue;
        clean.push(p);
      }
      if (clean.length < 2) return null;

      const dirs = [];
      for (let i = 0; i < clean.length - 1; i++) {
        const dx = clean[i + 1].x - clean[i].x, dy = clean[i + 1].y - clean[i].y;
        const len = Math.hypot(dx, dy);
        dirs.push({ x: dx / len, y: dy / len });
      }
      const nrm = (d) => ({ x: -d.y, y: d.x });
      const out = [];
      for (let i = 0; i < clean.length; i++) {
        const p = clean[i];
        let ox, oy;
        if (i === 0) { const n = nrm(dirs[0]); ox = n.x * LANE; oy = n.y * LANE; }
        else if (i === clean.length - 1) { const n = nrm(dirs[dirs.length - 1]); ox = n.x * LANE; oy = n.y * LANE; }
        else {
          const a = dirs[i - 1], b = dirs[i];
          const na = nrm(a), nb = nrm(b);
          const straight = Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
          ox = na.x * LANE + (straight ? 0 : nb.x * LANE);
          oy = na.y * LANE + (straight ? 0 : nb.y * LANE);
        }
        out.push({ x: p.x + ox, y: p.y + oy, r: p.r, c: p.c, dirIn: i > 0 ? dirs[i - 1] : null });
      }

      const cum = [0];
      for (let i = 0; i < out.length - 1; i++) {
        cum.push(cum[i] + Math.hypot(out[i + 1].x - out[i].x, out[i + 1].y - out[i].y));
      }
      const stops = [];
      for (let i = 1; i < out.length - 1; i++) {
        if (out[i].r === undefined) continue;
        const d = out[i].dirIn;
        stops.push({ s: cum[i] - HALF_INT, at: cum[i], r: out[i].r, c: out[i].c, axis: Math.abs(d.x) > 0.5 ? 'EW' : 'NS' });
      }
      return { pts: out, cum, total: cum[cum.length - 1], stops, dir0: dirs[0] };
    }

    function spawn(kindName) {
      if (cars.length > 92) return;
      const shift = SHIFTS.find((s) => dayT < s.until) || SHIFTS[SHIFTS.length - 1];
      const inSide = weightedSide(shift.inWeight);
      const opp = { W: 'E', E: 'W', N: 'S', S: 'N' };
      const outMap = {};
      for (const k of ['W', 'E', 'N', 'S']) if (k !== inSide) outMap[k] = shift.inWeight[opp[k]];
      const outSide = weightedSide(outMap);

      const p = buildPath(inSide, outSide);
      if (!p) return;
      const head = p.pts[0];
      for (const c of cars) if (Math.hypot(c.x - head.x, c.y - head.y) < 54) return;

      const name = kindName || pickKind();
      const K = KINDS[name];
      const car = {
        kind: name, K, path: p, s: 0, seg: 0, v: K.vmax * 0.55, wait: 0, stopIdx: 0,
        x: head.x, y: head.y, dx: p.dir0.x, dy: p.dir0.y,
        color: name === 'ambulance' ? '#fffdf3' : name === 'bus' ? '#ffcb1f' : name === 'truck' ? '#8f9ab8' : pick(CAR_COLORS),
        born: 0, dwell: 0, stopsLeft: null
      };
      if (K.stops && p.stops.length > 1) car.stopsLeft = [p.stops[randInt(0, p.stops.length - 1)].at];
      if (name === 'ambulance') car.deadline = p.total / 70 + 6;
      cars.push(car);
    }

    function pickKind() {
      const names = Object.keys(KINDS).filter((n) => n !== 'ambulance');
      const total = names.reduce((a, n) => a + KINDS[n].weight, 0);
      let x = Math.random() * total;
      for (const n of names) { x -= KINDS[n].weight; if (x <= 0) return n; }
      return 'car';
    }

    function place(car) {
      const { cum, pts } = car.path;
      let i = car.seg;
      while (i < pts.length - 2 && car.s > cum[i + 1]) i++;
      while (i > 0 && car.s < cum[i]) i--;
      car.seg = i;
      const segLen = cum[i + 1] - cum[i] || 1;
      const t = clamp((car.s - cum[i]) / segLen, 0, 1);
      const a = pts[i], b = pts[i + 1];
      car.x = a.x + (b.x - a.x) * t;
      car.y = a.y + (b.y - a.y) * t;
      car.dx = (b.x - a.x) / segLen;
      car.dy = (b.y - a.y) / segLen;
    }

    const speedFor = (gap) => clamp(gap * 2.1 - 8, 0, 999);

    function mayPass(node, axis, car) {
      if (node.type === 'over') return true;
      if (node.type === 'circle') {
        for (const o of cars) {
          if (o === car) continue;
          if (Math.hypot(o.x - nodeX(node.c), o.y - nodeY(node.r)) < CIRCLE_R) return false;
        }
        return true;
      }
      if (car && car.kind === 'ambulance') return true;
      return node.red <= 0 && node.phase === axis;
    }

    function switchLight(node, force) {
      if (node.type !== 'light' && node.type !== 'smart' && !force) return;
      const want = node.phase === 'NS' ? 'EW' : 'NS';
      if (node.pending === want) return;
      node.pending = want;
      node.red = 0.85;
      node.flash = 0.35;
      node.minGreen = 3.5;
      /* the all-red is when people finally get to cross */
      node.peds = 0;
      node.pedWait = 0;
    }

    function setAxis(node, axis) {
      if (node.type === 'over' || node.type === 'circle') return;
      if (node.phase !== axis) switchLight(node, true);
    }

    /* ---------------- the day ---------------- */
    function update(dt) {
      if (over || shopOpen) return;
      dayT += dt;
      if (dayT >= DAY_LEN && !prefill) return endDay();

      const shift = SHIFTS.find((s) => dayT < s.until) || SHIFTS[SHIFTS.length - 1];

      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const n = nodes[r][c];
        n.flash = Math.max(0, n.flash - dt);
        n.minGreen = Math.max(0, n.minGreen - dt);
        if (n.type === 'over' || n.type === 'circle') { n.peds = 0; n.pedWait = 0; continue; }

        if (n.red > 0) {
          n.red -= dt;
          if (n.red <= 0 && n.pending) { n.phase = n.pending; n.pending = null; n.t = 0; }
        } else {
          n.t += dt;
          if (n.type === 'smart') {
            const cur = n.phase === 'NS' ? n.qNS : n.qEW;
            const oth = n.phase === 'NS' ? n.qEW : n.qNS;
            if (!n.minGreen && (oth > cur + 1 || n.t > 16)) switchLight(n);
          } else if (autoMode && n.t > 11 / dm) switchLight(n);
        }
        n.peds += dt * 0.16 * dm;
        if (n.peds > 0.9) n.pedWait += dt; else n.pedWait = 0;
      }

      spawnT -= dt;
      if (spawnT <= 0) {
        spawn();
        spawnT = clamp(shift.rate - day * 0.045, 0.3, 3) * rand(0.65, 1.4) / dm;
      }
      ambT -= dt;
      if (ambT <= 0 && !prefill) {
        spawn('ambulance');
        ambT = rand(26, 48) / dm;
        flash('An ambulance is on the network. Clear it a path.');
      }

      for (const car of cars) place(car);

      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { nodes[r][c].qNS = 0; nodes[r][c].qEW = 0; }
      for (const a of cars) {
        const st = a.path.stops[a.stopIdx];
        if (!st || a.v > 22) continue;
        const d = st.s - a.s;
        if (d < 0 || d > 150) continue;
        const n = nodes[st.r][st.c];
        if (st.axis === 'NS') n.qNS++; else n.qEW++;
      }

      let jammed = 0;
      for (const a of cars) {
        a.born += dt;
        let allowed = a.K.vmax * speedScale();
        if (a.dwell > 0) { a.dwell -= dt; allowed = 0; }

        for (const b of cars) {
          if (b === a) continue;
          const vx = b.x - a.x, vy = b.y - a.y;
          const fwd = vx * a.dx + vy * a.dy;
          if (fwd <= 0 || fwd > 120) continue;
          const lat = Math.abs(vx * -a.dy + vy * a.dx);
          if (lat > 13) continue;
          const gap = fwd - followGap() - (b.K.len - 21) * 0.5;
          allowed = Math.min(allowed, speedFor(a.kind === 'ambulance' ? gap + 10 : gap));
        }

        while (a.stopIdx < a.path.stops.length && a.s > a.path.stops[a.stopIdx].s + 6) a.stopIdx++;
        const st = a.path.stops[a.stopIdx];
        if (st) {
          const node = nodes[st.r][st.c];
          const d = st.s - a.s;
          if (d >= 0 && d < 140 && !mayPass(node, st.axis, a)) allowed = Math.min(allowed, speedFor(d));
          if (node.type === 'circle' && d < 60 && d > -30) allowed = Math.min(allowed, 52);
          if (upgrades.priority && a.kind === 'ambulance' && d > 0 && d < 240 &&
            (node.type === 'light' || node.type === 'smart') && node.phase !== st.axis && node.red <= 0) {
            switchLight(node);
          }
        }

        if (a.stopsLeft && a.stopsLeft.length) {
          const target = a.stopsLeft[0];
          if (a.s > target - 6 && a.dwell <= 0) { a.stopsLeft.shift(); a.dwell = 2.2; }
        }

        a.v += clamp(allowed - a.v, -a.K.dec * dt, a.K.acc * dt);
        a.v = clamp(a.v, 0, a.K.vmax * speedScale());
        a.s += a.v * dt;
        if (a.v < 8) { a.wait += dt; if (a.wait > 3) jammed++; }
        else a.wait = Math.max(0, a.wait - dt * 2.5);
      }

      for (let i = cars.length - 1; i >= 0; i--) {
        const a = cars[i];
        if (a.s < a.path.total) continue;
        cars.splice(i, 1);
        delivered++;
        tripSum += a.born;
        tripN++;
        let fee = a.K.fee;
        if (a.kind === 'ambulance') {
          if (a.born <= a.deadline) flash('Ambulance through in time. Plus $' + fee);
          else { fee = 4; rage = clamp(rage + 14, 0, 100); flash('The ambulance was stuck in your traffic.'); }
        }
        money += fee;
      }

      let pedAnger = 0;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (nodes[r][c].pedWait > 13) pedAnger++;

      rage = clamp(rage + dt * (jammed * 0.8 * dm + pedAnger * 0.9 - 2.6 / dm), 0, 100);
      if (rage >= 100 && !prefill) return endGame();

      if (hintT > 0) hintT -= dt;
      if (!prefill) sync(jammed);
    }

    function flash(text) { hint = text; hintT = 4; api.sfx.blip(760); }

    function sync(jammed) {
      const shift = SHIFTS.find((s) => dayT < s.until) || SHIFTS[SHIFTS.length - 1];
      pDay.textContent = 'Day ' + day + '  ' + shift.name;
      pMoney.textContent = '$' + money;
      pMoney.className = 'pill good';
      pThrough.textContent = 'Through: ' + delivered + (jammed ? '  (' + jammed + ' stuck)' : '');
      pTrip.textContent = tripN ? 'Avg trip ' + (tripSum / tripN).toFixed(1) + 's' : 'Avg trip --';
      meter.style.width = rage.toFixed(0) + '%';
    }

    function endDay() {
      shopOpen = true;
      api.sfx.great();
      renderShop();
    }

    function startDay() {
      shopOpen = false;
      placing = null;
      day++;
      dayT = 0;
      tripSum = 0; tripN = 0;
      ambT = rand(16, 30);
      rage = Math.max(0, rage - 30);
      shopEl.style.display = 'none';
      api.status('Day ' + day + '. Busier than yesterday, so spend the money.');
      sync(0);
    }

    const owned = (id) => upgrades[id] || 0;

    function renderShop() {
      const rows = SHOP.map((it) => {
        const n = owned(it.id);
        const maxed = it.repeat ? n >= it.repeat : (!it.place && n > 0);
        const afford = money >= it.cost && !maxed;
        return h('button', {
          class: 'gl-buy' + (afford ? ' afford' : '') + (placing === it.id ? ' picking' : ''),
          type: 'button', onclick: () => buy(it)
        },
          h('span', { class: 'gl-buy-icon', html: Icons.svg(it.id, 30) }),
          h('span', { class: 'gl-buy-body' },
            h('b', null, it.name + (it.repeat ? '  ' + n + '/' + it.repeat : maxed ? '  OWNED' : '')),
            h('span', null, it.desc)),
          h('span', { class: 'gl-buy-cost' }, '$' + it.cost));
      });

      shopEl.style.display = '';
      shopEl.replaceChildren(
        h('h4', null, 'END OF DAY ' + day + '  ·  $' + money + ' IN THE BUDGET'),
        h('p', { class: 'gl-shop-note' },
          delivered + ' vehicles through so far. ' +
          (tripN ? 'Average trip today was ' + (tripSum / tripN).toFixed(1) + ' seconds. ' : '') +
          'Junction upgrades need a junction: buy one, then click where it goes.'),
        h('div', { class: 'gl-shop-grid' }, rows),
        h('button', { class: 'btn primary', type: 'button', onclick: startDay }, 'Open the roads for day ' + (day + 1)));
    }

    function buy(it) {
      const n = owned(it.id);
      const maxed = it.repeat ? n >= it.repeat : (!it.place && n > 0);
      if (maxed || money < it.cost) { api.sfx.bad(); return; }
      if (it.place) {
        placing = placing === it.id ? null : it.id;
        api.sfx.click();
        renderShop();
        api.status(placing ? 'Now click the junction that gets the ' + it.name.toLowerCase() + '.' : 'Cancelled.');
        return;
      }
      money -= it.cost;
      upgrades[it.id] = n + 1;
      api.sfx.good();
      renderShop();
    }

    /* ---------------- input ---------------- */
    bagg.listen(cv.el, 'pointerdown', (e) => {
      if (over) return;
      const p = cv.pos(e);
      cv.el.setPointerCapture(e.pointerId);
      drag = { x0: p.x, y0: p.y, x: p.x, y: p.y };
    });
    bagg.listen(cv.el, 'pointermove', (e) => {
      if (!drag) return;
      const p = cv.pos(e);
      drag.x = p.x; drag.y = p.y;
    });
    function release() {
      if (!drag) return;
      const d = drag;
      drag = null;
      const dx = d.x - d.x0, dy = d.y - d.y0;

      if (Math.hypot(dx, dy) > 70) {
        if (Math.abs(dx) > Math.abs(dy)) {
          let br = 0, bd = 1e9;
          for (let r = 0; r < ROWS; r++) { const dd = Math.abs(d.y0 - nodeY(r)); if (dd < bd) { bd = dd; br = r; } }
          if (bd < 110) {
            for (let c = 0; c < COLS; c++) setAxis(nodes[br][c], 'EW');
            flash('Green wave across row ' + (br + 1) + '.');
            api.sfx.good();
          }
        } else {
          let bc = 0, bd = 1e9;
          for (let c = 0; c < COLS; c++) { const dd = Math.abs(d.x0 - nodeX(c)); if (dd < bd) { bd = dd; bc = c; } }
          if (bd < 130) {
            for (let r = 0; r < ROWS; r++) setAxis(nodes[r][bc], 'NS');
            flash('Green wave down column ' + (bc + 1) + '.');
            api.sfx.good();
          }
        }
        return;
      }

      let bd = 1e9, br = -1, bc = -1;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const dd = Math.hypot(d.x0 - nodeX(c), d.y0 - nodeY(r));
        if (dd < bd) { bd = dd; br = r; bc = c; }
      }
      if (bd > 66) return;
      const node = nodes[br][bc];

      if (placing) {
        const it = SHOP.find((s) => s.id === placing);
        if (node.type === placing) { flash('That junction already has one.'); api.sfx.bad(); return; }
        if (money < it.cost) { api.sfx.bad(); return; }
        money -= it.cost;
        node.type = placing;
        node.red = 0;
        node.pending = null;
        placing = null;
        api.sfx.great();
        flash(it.name + ' built at junction ' + (br + 1) + '-' + (bc + 1) + '.');
        renderShop();
        return;
      }
      if (shopOpen) return;
      if (node.type === 'circle' || node.type === 'over') { flash('Nothing to switch here. That is rather the point of it.'); return; }
      switchLight(node);
      api.sfx.click();
    }
    bagg.listen(cv.el, 'pointerup', release);
    bagg.listen(cv.el, 'pointercancel', release);

    function endGame() {
      over = true;
      const res = api.submit(delivered);
      api.sfx.bad();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'The city has had enough.'),
        h('p', null, delivered + ' vehicles delivered across ' + day + ' day' + (day === 1 ? '' : 's') +
          ', $' + money + ' left unspent' +
          (tripN ? ', average trip ' + (tripSum / tripN).toFixed(1) + 's' : '') + '.' +
          (res.isRecord ? ' Best run yet!' : res.isFirst ? '' : ' Best: ' + res.best + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Take the job again'));
    }

    /* ---------------- render ---------------- */
    function draw() {
      ctx.fillStyle = '#0f1729';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#131c30';
      for (let r = -1; r < ROWS; r++) for (let c = -1; c < COLS; c++) {
        const x = c < 0 ? -OFF : nodeX(c) + ROAD / 2;
        const y = r < 0 ? -OFF : nodeY(r) + ROAD / 2;
        const x2 = c + 1 >= COLS ? W + OFF : nodeX(c + 1) - ROAD / 2;
        const y2 = r + 1 >= ROWS ? H + OFF : nodeY(r + 1) - ROAD / 2;
        ctx.fillRect(x + 7, y + 7, x2 - x - 14, y2 - y - 14);
      }

      ctx.fillStyle = '#28324a';
      for (let r = 0; r < ROWS; r++) ctx.fillRect(-OFF, nodeY(r) - ROAD / 2, W + OFF * 2, ROAD);
      for (let c = 0; c < COLS; c++) ctx.fillRect(nodeX(c) - ROAD / 2, -OFF, ROAD, H + OFF * 2);

      if (upgrades.reports) {
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const n = nodes[r][c];
          const q = Math.max(n.qNS, n.qEW);
          if (q < 2) continue;
          ctx.fillStyle = 'rgba(232,64,42,' + clamp((q - 1) / 7, 0, 0.55).toFixed(2) + ')';
          ctx.beginPath();
          ctx.arc(nodeX(c), nodeY(r), 90, 0, 7);
          ctx.fill();
        }
      }

      ctx.strokeStyle = '#59648a';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([11, 13]);
      ctx.beginPath();
      for (let r = 0; r < ROWS; r++) { ctx.moveTo(-OFF, nodeY(r)); ctx.lineTo(W + OFF, nodeY(r)); }
      for (let c = 0; c < COLS; c++) { ctx.moveTo(nodeX(c), -OFF); ctx.lineTo(nodeX(c), H + OFF); }
      ctx.stroke();
      ctx.setLineDash([]);

      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const n = nodes[r][c];
        const x = nodeX(c), y = nodeY(r);

        if (n.type === 'over') {
          ctx.fillStyle = '#3d4a6d';
          ctx.fillRect(x - ROAD / 2 - 28, y - ROAD / 2 - 4, ROAD + 56, ROAD + 8);
          ctx.strokeStyle = '#0c1119';
          ctx.lineWidth = 3;
          ctx.strokeRect(x - ROAD / 2 - 28, y - ROAD / 2 - 4, ROAD + 56, ROAD + 8);
        } else {
          ctx.fillStyle = '#323d59';
          ctx.fillRect(x - ROAD / 2, y - ROAD / 2, ROAD, ROAD);
        }

        if (n.type === 'circle') {
          ctx.strokeStyle = '#8f9ab8';
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.arc(x, y, 24, 0, 7);
          ctx.stroke();
          ctx.fillStyle = '#1e6b3a';
          ctx.beginPath();
          ctx.arc(x, y, 15, 0, 7);
          ctx.fill();
        }

        if (n.flash > 0) {
          ctx.strokeStyle = 'rgba(255,203,31,' + (n.flash / 0.35).toFixed(2) + ')';
          ctx.lineWidth = 3;
          ctx.strokeRect(x - ROAD / 2 - 5, y - ROAD / 2 - 5, ROAD + 10, ROAD + 10);
        }

        if (n.type === 'light' || n.type === 'smart') {
          const ns = n.red > 0 ? '#ffb020' : (n.phase === 'NS' ? '#4ade5e' : '#ff4d5e');
          const ew = n.red > 0 ? '#ffb020' : (n.phase === 'EW' ? '#4ade5e' : '#ff4d5e');
          const d = ROAD / 2 + 6;
          const dot = (px, py, col) => {
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(px, py, 3.6, 0, 7);
            ctx.fill();
          };
          dot(x - 4, y - d, ns); dot(x + 4, y + d, ns);
          dot(x - d, y + 4, ew); dot(x + d, y - 4, ew);

          if (n.type === 'smart') {
            ctx.fillStyle = '#38e1ff';
            ctx.font = 'bold 10px Verdana, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('AUTO', x, y + 4);
            ctx.textAlign = 'left';
          }
          if (n.peds > 0.9) {
            ctx.fillStyle = n.pedWait > 10 ? '#ff4d5e' : '#cfc6ae';
            for (let i = 0; i < Math.min(4, Math.floor(n.peds)); i++) {
              ctx.beginPath();
              ctx.arc(x - ROAD / 2 - 12, y - 14 + i * 9, 3, 0, 7);
              ctx.fill();
            }
          }
        }
      }

      for (const a of cars) {
        const L = a.K.len, Wd = a.K.wid;
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(Math.atan2(a.dy, a.dx));
        ctx.fillStyle = 'rgba(0,0,0,.4)';
        Engine.roundRect(ctx, -L / 2 + 1.5, -Wd / 2 + 2, L, Wd, 3);
        ctx.fill();
        ctx.fillStyle = a.color;
        Engine.roundRect(ctx, -L / 2, -Wd / 2, L, Wd, 3);
        ctx.fill();

        if (a.kind === 'bus') {
          ctx.fillStyle = 'rgba(10,14,24,.5)';
          for (let i = 0; i < 4; i++) ctx.fillRect(-L / 2 + 5 + i * 8, -Wd / 2 + 2, 5, Wd - 4);
        } else if (a.kind === 'ambulance') {
          ctx.fillStyle = '#e8402a';
          ctx.fillRect(-L / 2 + 3, -Wd / 2, 5, Wd);
          ctx.fillStyle = Math.floor(Date.now() / 130) % 2 ? '#38a0ff' : '#ff4d5e';
          ctx.fillRect(-2, -Wd / 2 - 3, 6, 3);
        } else {
          ctx.fillStyle = 'rgba(10,14,24,.55)';
          Engine.roundRect(ctx, -1, -Wd / 2 + 1.5, 7, Wd - 3, 2);
          ctx.fill();
        }
        if (a.v < 6) {
          ctx.fillStyle = '#ff3b3b';
          ctx.fillRect(-L / 2 - 1, -Wd / 2 + 1, 2, Wd - 2);
        }
        ctx.restore();

        if (a.kind === 'ambulance') {
          ctx.strokeStyle = 'rgba(56,160,255,.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(a.x, a.y, 14 + Math.sin(Date.now() / 90) * 3, 0, 7);
          ctx.stroke();
        }
        if (a.wait > 4) {
          ctx.fillStyle = 'rgba(255,80,80,' + (0.35 + clamp((a.wait - 4) / 5, 0, 1) * 0.55).toFixed(2) + ')';
          ctx.font = 'bold 13px Verdana, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('!', a.x, a.y - 12);
          ctx.textAlign = 'left';
        }
      }

      if (drag && Math.hypot(drag.x - drag.x0, drag.y - drag.y0) > 70) {
        ctx.strokeStyle = 'rgba(111,207,47,.75)';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(drag.x0, drag.y0);
        ctx.lineTo(drag.x, drag.y);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }

      ctx.fillStyle = 'rgba(12,17,25,.82)';
      ctx.fillRect(0, 0, W, 26);
      ctx.fillStyle = '#6fcf2f';
      ctx.fillRect(0, 0, W * clamp(dayT / DAY_LEN, 0, 1), 26);
      ctx.fillStyle = '#0c1119';
      ctx.font = 'bold 12px Verdana, sans-serif';
      const shift = SHIFTS.find((s) => dayT < s.until) || SHIFTS[SHIFTS.length - 1];
      ctx.fillText('DAY ' + day + '   ' + shift.name, 10, 18);
      ctx.textAlign = 'right';
      ctx.fillText('$' + money, W - 10, 18);
      ctx.textAlign = 'left';

      if (hintT > 0) {
        ctx.globalAlpha = clamp(hintT, 0, 1);
        ctx.fillStyle = 'rgba(12,17,25,.92)';
        ctx.fillRect(W / 2 - 240, H - 52, 480, 30);
        ctx.strokeStyle = '#ffcb1f';
        ctx.lineWidth = 2;
        ctx.strokeRect(W / 2 - 240, H - 52, 480, 30);
        ctx.fillStyle = '#ffcb1f';
        ctx.font = 'bold 13px Verdana, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(hint, W / 2, H - 32);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      }

      if (placing) {
        ctx.fillStyle = 'rgba(255,203,31,.14)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffcb1f';
        ctx.font = '26px Impact, Haettenschweiler, Arial Black, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CLICK A JUNCTION TO BUILD', W / 2, 62);
        ctx.textAlign = 'left';
      }

      if (Engine.paused && !over) {
        ctx.fillStyle = 'rgba(12,17,25,.66)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ded6c2';
        ctx.font = '30px Impact, Haettenschweiler, Arial Black, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', W / 2, H / 2);
        ctx.textAlign = 'left';
      }
    }

    api.button('New job', reset);
    const autoBtn = api.button('Auto-cycle: on', () => {
      autoMode = !autoMode;
      autoBtn.textContent = 'Auto-cycle: ' + (autoMode ? 'on' : 'off');
      autoBtn.classList.toggle('on', autoMode);
    }, 'on');
    api.button('All E-W', () => { for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) setAxis(nodes[r][c], 'EW'); });
    api.button('All N-S', () => { for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) setAxis(nodes[r][c], 'NS'); });

    reset();
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    let rafId = 0;
    (function paint() { rafId = requestAnimationFrame(paint); if (Engine.paused || shopOpen) draw(); })();
    bagg.add(() => cancelAnimationFrame(rafId));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'gridlock',
    title: 'Gridlock',
    emoji: 'gridlock',
    cat: 'sim',
    order: 1,
    blurb: 'Run the lights on a twelve-junction city for a full working day. Cars, buses, trucks and ambulances all want through, and every jam fills the rage bar.',
    scoreLabel: 'Vehicles through',
    link: {
      url: 'https://claude.ai/code/artifact/245d9555-fb6f-4685-b698-42a8f82c10bd',
      label: 'See why real jams start'
    },
    tags: ['traffic', 'jam', 'city', 'lights', 'management'],
    how: [
      'Click a junction to flip which way gets the green. Each flip runs a short all-red, and that is when waiting pedestrians cross.',
      'Drag along a row or column to set a green wave down the whole corridor.',
      'Buses pull in at a stop and pay 9; trucks are slow and pay 4. Ambulances run reds and pay 30 if they arrive in time, or spike the rage bar if they do not.',
      'Traffic direction swings through the day, inbound at the morning peak and outbound in the evening, and gets heavier every day you last.',
      'You are paid per vehicle delivered. Spend the takings at the end of each day on smart signals, roundabouts, overpasses, wider roads, ambulance priority, or a congestion map.',
      'Queued drivers and stranded pedestrians both fill the rage bar. Let it fill and you lose the job.'
    ],
    mount
  });
})();
