/* Busywork — an idle/incremental. File a report by hand, then hire things that
 * file reports for you, then reorganise the whole department to start over with
 * a permanent tailwind. The numbers-go-up game, office edition. Progress is
 * saved, and the machines keep working while the tab is closed. */
(function () {
  'use strict';
  const { h } = Engine;

  const GENS = [
    { name: 'Intern', cost: 15, rate: 0.2, blurb: 'Files slowly, complains quietly.' },
    { name: 'Photocopier', cost: 130, rate: 1.6, blurb: 'Jams at the worst moment, otherwise tireless.' },
    { name: 'Consultant', cost: 1500, rate: 11, blurb: 'Bills by the report. Produces plenty of them.' },
    { name: 'Middle manager', cost: 18000, rate: 70, blurb: 'Files reports about the other reports.' },
    { name: 'Server farm', cost: 260000, rate: 480, blurb: 'Generates paperwork at industrial scale.' },
    { name: 'Subsidiary', cost: 4200000, rate: 3400, blurb: 'A whole other office, filing on your behalf.' },
    { name: 'Think tank', cost: 68000000, rate: 26000, blurb: 'Produces reports and the demand for them.' }
  ];

  const UPGRADES = [
    { id: 'c1', name: 'Standing desk', desc: 'Hand-filing counts ×5.', cost: 400, kind: 'click', mul: 5, req: (s) => s.life >= 120 },
    { id: 'g0', name: 'Free pizza', desc: 'Interns ×2.', cost: 900, kind: 'gen', gen: 0, mul: 2, req: (s) => s.own[0] >= 12 },
    { id: 'g1', name: 'Toner club', desc: 'Photocopiers ×2.', cost: 9000, kind: 'gen', gen: 1, mul: 2, req: (s) => s.own[1] >= 12 },
    { id: 'a1', name: 'Open floor plan', desc: 'Everything ×2.', cost: 60000, kind: 'all', mul: 2, req: (s) => s.life >= 50000 },
    { id: 'g2', name: 'Frequent-flyer miles', desc: 'Consultants ×2.', cost: 120000, kind: 'gen', gen: 2, mul: 2, req: (s) => s.own[2] >= 12 },
    { id: 'c2', name: 'Mechanical keyboard', desc: 'Hand-filing counts ×5 again.', cost: 250000, kind: 'click', mul: 5, req: (s) => s.life >= 200000 },
    { id: 'g3', name: 'Corner offices', desc: 'Managers ×2.', cost: 1600000, kind: 'gen', gen: 3, mul: 2, req: (s) => s.own[3] >= 12 },
    { id: 'a2', name: 'Synergy mandate', desc: 'Everything ×2.', cost: 9000000, kind: 'all', mul: 2, req: (s) => s.life >= 5000000 },
    { id: 'g4', name: 'Liquid cooling', desc: 'Server farms ×2.', cost: 42000000, kind: 'gen', gen: 4, mul: 2, req: (s) => s.own[4] >= 12 },
    { id: 'a3', name: 'Company retreat', desc: 'Everything ×3.', cost: 400000000, kind: 'all', mul: 3, req: (s) => s.life >= 250000000 }
  ];

  const KEY = 'save2';
  const CLOUT_AT = 1e6;          // lifetime reports per prestige unit (sqrt scaling)
  const OFFLINE_CAP = 8 * 3600;  // seconds of offline earning granted (at 50%)

  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 1000) return n < 10 ? (Math.round(n * 10) / 10).toString() : Math.floor(n).toString();
    const u = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
    let i = 0; while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n).toString()) + u[i];
  }

  function mount(root, api) {
    const bagg = Engine.bag();

    const fresh = () => ({ rep: 0, life: 0, run: 0, clout: 0, own: GENS.map(() => 0), ups: {}, last: Date.now() });
    let s = api.load(KEY, null);
    if (!s || !Array.isArray(s.own)) s = fresh();
    while (s.own.length < GENS.length) s.own.push(0);
    if (!s.ups) s.ups = {};

    /* multipliers derived from purchased upgrades + clout */
    let clickMul, allMul, genMul;
    function recompute() {
      clickMul = 1; allMul = 1; genMul = GENS.map(() => 1);
      for (const u of UPGRADES) {
        if (!s.ups[u.id]) continue;
        if (u.kind === 'click') clickMul *= u.mul;
        else if (u.kind === 'all') allMul *= u.mul;
        else if (u.kind === 'gen') genMul[u.gen] *= u.mul;
      }
      const cloutBoost = 1 + s.clout * 0.05;
      allMul *= cloutBoost;
    }
    recompute();

    const genCost = (i) => Math.ceil(GENS[i].cost * Math.pow(1.15, s.own[i]));
    const clickVal = () => 1 * clickMul * allMul;
    const perSec = () => GENS.reduce((a, g, i) => a + s.own[i] * g.rate * genMul[i] * allMul, 0);
    const cloutGain = () => Math.max(0, Math.floor(Math.sqrt(s.run / CLOUT_AT)) - s.clout);

    /* ---------- offline earnings ---------- */
    let welcome = '';
    (function offline() {
      const dt = Math.min(OFFLINE_CAP, Math.max(0, (Date.now() - (s.last || Date.now())) / 1000));
      if (dt > 30) {
        const gained = perSec() * dt * 0.5;
        if (gained > 0) { s.rep += gained; s.life += gained; s.run += gained; welcome = 'While you were out (' + Math.round(dt / 60) + ' min), the office filed ' + fmt(gained) + ' reports.'; }
      }
    })();

    /* ---------- DOM ---------- */
    const pRep = api.pill('0 reports');
    const pRate = api.pill('0 / sec');
    const pClout = api.pill('Clout 0');

    const clickBtn = h('button', { class: 'bw-file btn primary', type: 'button' }, 'File a report');
    const genList = h('div', { class: 'bw-gens' });
    const upList = h('div', { class: 'bw-ups' });
    const reorgBtn = h('button', { class: 'btn', type: 'button' });
    const wrap = h('div', { class: 'busywork' },
      h('div', { class: 'bw-top' }, clickBtn, h('div', { class: 'bw-reorg' }, reorgBtn)),
      h('div', { class: 'bw-cols' },
        h('div', null, h('h4', { class: 'bw-h' }, 'Hire'), genList),
        h('div', null, h('h4', { class: 'bw-h' }, 'Upgrades'), upList)));
    root.append(wrap);
    api.button('Wipe save', hardReset);

    const genRows = GENS.map((g, i) => {
      const buy = h('button', { class: 'bw-buy btn', type: 'button' });
      buy.addEventListener('click', () => {
        const c = genCost(i);
        if (s.rep < c) return;
        s.rep -= c; s.own[i]++; api.sfx.click(); dirty = true; renderGens();
      });
      const row = h('div', { class: 'bw-gen' },
        h('div', { class: 'bw-gen-main' },
          h('span', { class: 'bw-gen-name' }, g.name),
          h('span', { class: 'bw-gen-blurb' }, g.blurb)),
        h('div', { class: 'bw-gen-buy' }, h('span', { class: 'bw-own' }), buy));
      genList.appendChild(row);
      return { buy, row, own: row.querySelector('.bw-own') };
    });

    clickBtn.addEventListener('click', () => {
      const v = clickVal();
      s.rep += v; s.life += v; s.run += v; dirty = true;
      api.sfx.blip(700);
    });

    reorgBtn.addEventListener('click', () => {
      const g = cloutGain();
      if (g < 1) return;
      s.clout += g;
      s.rep = 0; s.run = 0; s.own = GENS.map(() => 0); s.ups = {};
      recompute(); dirty = true;
      api.sfx.great();
      api.status('Reorganised. +' + g + ' clout — every future report is worth more. Build it back up.');
      renderGens(); renderUps();
    });

    function hardReset() {
      s = fresh(); recompute(); dirty = true;
      api.status('Save wiped. Back to a blank desk and one report at a time.');
      renderGens(); renderUps();
    }

    function renderGens() {
      genRows.forEach((r, i) => {
        const c = genCost(i);
        r.own.textContent = 'have ' + s.own[i];
        r.buy.textContent = 'Buy · ' + fmt(c);
        r.buy.disabled = s.rep < c;
      });
    }

    function renderUps() {
      upList.replaceChildren();
      const avail = UPGRADES.filter((u) => !s.ups[u.id] && u.req(s));
      if (!avail.length) upList.appendChild(h('p', { class: 'bw-noups' }, 'Nothing new yet — keep filing.'));
      for (const u of avail) {
        const b = h('button', { class: 'bw-up btn', type: 'button' },
          h('span', { class: 'bw-up-name' }, u.name),
          h('span', { class: 'bw-up-desc' }, u.desc),
          h('span', { class: 'bw-up-cost' }, fmt(u.cost)));
        b.disabled = s.rep < u.cost;
        b.addEventListener('click', () => {
          if (s.rep < u.cost) return;
          s.rep -= u.cost; s.ups[u.id] = 1; recompute(); api.sfx.good(); dirty = true;
          renderUps(); renderGens();
        });
        upList.appendChild(b);
      }
    }

    function syncPills() {
      pRep.textContent = fmt(s.rep) + ' reports';
      pRate.textContent = fmt(perSec()) + ' / sec';
      pClout.textContent = 'Clout ' + s.clout;
      pClout.className = 'pill ' + (s.clout > 0 ? 'good' : '');
      const g = cloutGain();
      reorgBtn.textContent = g >= 1 ? 'Reorg for +' + g + ' clout' : 'Reorg (need ' + fmt((s.clout + 1) * (s.clout + 1) * CLOUT_AT) + ' lifetime)';
      reorgBtn.disabled = g < 1;
      reorgBtn.classList.toggle('primary', g >= 1);
    }

    /* ---------- save ---------- */
    let dirty = false;
    function save() { s.last = Date.now(); api.save(KEY, s); api.submit(Math.floor(s.life)); }
    const saveId = setInterval(() => { save(); }, 5000);
    bagg.add(() => { clearInterval(saveId); save(); });   // persist on leave

    /* ---------- tick ---------- */
    let affordCheck = 0;
    let last = performance.now();
    renderGens(); renderUps(); syncPills();
    if (welcome) api.status(welcome);
    else api.status('Click File a report to start. Then hire interns to file for you, buy upgrades, and reorganise to prestige. It keeps running while you are away.');

    bagg.add(Engine.loop(() => {
      const now = performance.now();
      const dt = Math.min(0.25, (now - last) / 1000); last = now;
      const gain = perSec() * dt;
      if (gain > 0) { s.rep += gain; s.life += gain; s.run += gain; }
      syncPills();
      /* re-enable buy buttons as reports accrue (cheap, throttled) */
      affordCheck += dt;
      if (affordCheck > 0.25) { affordCheck = 0; refreshAfford(); }
    }));

    function refreshAfford() {
      genRows.forEach((r, i) => { r.buy.disabled = s.rep < genCost(i); });
      [...upList.querySelectorAll('.bw-up')].forEach((b, k) => {
        const avail = UPGRADES.filter((u) => !s.ups[u.id] && u.req(s));
        const u = avail[k]; if (u) b.disabled = s.rep < u.cost;
      });
      /* a newly-met upgrade requirement should surface without a click */
      const availNow = UPGRADES.filter((u) => !s.ups[u.id] && u.req(s)).length;
      if (availNow !== lastAvail) { lastAvail = availNow; renderUps(); }
    }
    let lastAvail = UPGRADES.filter((u) => !s.ups[u.id] && u.req(s)).length;

    /* ---- test seam ---- */
    window.__busywork = {
      state: () => ({ rep: s.rep, life: s.life, run: s.run, clout: s.clout, own: s.own.slice(), perSec: perSec(), clickVal: clickVal(), cloutGain: cloutGain() }),
      add(n) { s.rep += n; s.life += n; s.run += n; },
      buyGen(i) { const c = genCost(i); if (s.rep >= c) { s.rep -= c; s.own[i]++; renderGens(); return true; } return false; },
      buyUp(id) { const u = UPGRADES.find((x) => x.id === id); if (u && !s.ups[id] && s.rep >= u.cost && u.req(s)) { s.rep -= u.cost; s.ups[id] = 1; recompute(); renderUps(); renderGens(); return true; } return false; },
      reorg() { const g = cloutGain(); if (g < 1) return false; s.clout += g; s.rep = 0; s.run = 0; s.own = GENS.map(() => 0); s.ups = {}; recompute(); renderGens(); renderUps(); return g; },
      save() { save(); },
      cost: (i) => genCost(i),
      fmt: fmt
    };
    bagg.add(() => { if (window.__busywork) delete window.__busywork; });

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'busywork',
    title: 'Busywork',
    emoji: 'busywork',
    cat: 'goofy',
    order: 41,
    blurb: 'The numbers-go-up game, office edition. File one report by hand, then hire interns, photocopiers and whole subsidiaries to file them for you — and reorganise the department to start over with a permanent raise. It keeps working while the tab is shut.',
    scoreLabel: 'Lifetime reports',
    formatScore: (n) => (function f(x) { if (x < 1000) return '' + Math.floor(x); const u = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi']; let i = 0; while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; } return (x < 100 ? x.toFixed(1) : Math.floor(x)) + u[i]; })(n),
    tags: ['idle', 'incremental', 'clicker', 'prestige'],
    how: [
      'File a report by hand to earn your first few. Then spend reports to hire things that file reports for you — interns, photocopiers, consultants, all the way up to whole subsidiaries.',
      'Each hire you own of a kind makes the next one pricier, so growth comes from spreading across many kinds and from upgrades that multiply their output.',
      'Upgrades appear as you hit milestones. They multiply one kind of worker, your hand-filing, or everything at once.',
      'When lifetime reports get big enough, Reorg the department: you lose your workers and reports but bank permanent clout, and every report afterwards is worth 5% more per clout. Prestiging is how you break through the wall.',
      'It runs while you are gone — the machines file at half speed for up to eight hours offline, and your progress is saved automatically. Your score is lifetime reports filed.'
    ],
    mount
  });
})();
