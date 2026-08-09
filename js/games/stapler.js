/* Staple Empire — the purest office idle game. Click. Buy. Watch a number climb. */
(function () {
  'use strict';
  const { h } = Engine;

  function fmt(n) {
    if (n < 1000) return String(Math.floor(n));
    const u = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];
    let i = 0;
    while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + u[i];
  }

  const BUILDINGS = [
    { id: 'intern', name: 'Intern', base: 15, rate: 0.4, emoji: '🧑‍💼' },
    { id: 'auto', name: 'Auto-stapler', base: 110, rate: 3, emoji: '📎' },
    { id: 'mailbot', name: 'Mailroom bot', base: 1300, rate: 22, emoji: '🤖' },
    { id: 'factory', name: 'Staple factory', base: 16000, rate: 180, emoji: '🏭' }
  ];

  function mount(root, api) {
    const bagg = Engine.bag();
    let staples = 0, made = 0, clickPow = 1, acc = 0, since = 0, disposed = false, firstBuy = true;
    const owned = {}; BUILDINGS.forEach((b) => { owned[b.id] = 0; });

    const pRate = api.pill('0 /s');
    const countEl = h('div', { class: 'stp-count' }, '0');
    const stapler = h('button', { class: 'stp-big', type: 'button' }, '📎');
    const shop = h('div', { class: 'stp-shop' });
    root.appendChild(h('div', { class: 'stapler' },
      h('div', { class: 'stp-left' }, countEl, stapler, h('div', { class: 'stp-hint' }, 'Click the stapler. Staple everything.')),
      shop));

    const rows = BUILDINGS.map((b) => {
      const costEl = h('span', { class: 'stp-cost' }, '');
      const nameEl = h('b', null, b.name);
      const btn = h('button', { class: 'btn stp-buy', type: 'button', onclick: () => buy(b, btn) },
        h('span', { class: 'stp-emoji' }, b.emoji),
        h('span', { class: 'stp-info' }, nameEl, costEl));
      shop.appendChild(btn);
      return { b, btn, costEl, nameEl };
    });

    const rateOf = () => BUILDINGS.reduce((s, b) => s + owned[b.id] * b.rate, 0);
    const costOf = (b) => Math.floor(b.base * Math.pow(1.15, owned[b.id]));

    function buy(b, btn) {
      const c = costOf(b);
      if (staples < c) return;
      staples -= c; owned[b.id]++; api.sfx.good();
      if (firstBuy) {
        firstBuy = false;
        try { const r = btn.getBoundingClientRect(); Engine.fx.burst(r.left + r.width / 2, r.top + r.height / 2, 40); }
        catch (e) { api.sfx.great(); }
      }
      api.submit(Math.floor(made)); sync();
    }
    stapler.addEventListener('click', () => {
      staples += clickPow; made += clickPow; api.sfx.click();
      stapler.classList.remove('pop'); void stapler.offsetWidth; stapler.classList.add('pop');
      sync();
    });

    function sync() {
      countEl.textContent = fmt(staples);
      const r = rateOf();
      pRate.textContent = (r > 0 && r < 10 ? r.toFixed(1) : fmt(r)) + ' /s';
      rows.forEach((r) => {
        const c = costOf(r.b);
        r.costEl.textContent = fmt(c) + ' · +' + r.b.rate + '/s';
        r.nameEl.textContent = r.b.name + (owned[r.b.id] ? ' ×' + owned[r.b.id] : '');
        r.btn.disabled = staples < c;
      });
    }

    bagg.add(Engine.loop((dt) => {
      if (disposed) return;
      const r = rateOf();
      if (r > 0) { const add = r * dt; staples += add; made += add; }
      acc += dt; since += dt;
      if (acc > 0.1) { acc = 0; sync(); }
      if (since > 3) { since = 0; api.submit(Math.floor(made)); }
    }));

    api.status('Click the stapler for staples. Spend them on interns and machines that staple for you. It never really ends — that is the point.');
    sync();
    return () => { disposed = true; api.submit(Math.floor(made)); bagg.dispose(); };
  }

  Arcade.register({
    id: 'stapler', title: 'Staple Empire', emoji: 'busywork', cat: 'goof', order: 48,
    blurb: 'An office idle clicker. Click the stapler for staples, then spend them on interns and machines that staple for you while the number climbs on its own.',
    scoreLabel: 'Staples made', tags: ['idle', 'clicker', 'numbers'],
    formatScore: (v) => (function f(n) { if (n < 1000) return String(n); const u = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx']; let i = 0; while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; } return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + u[i]; })(v),
    how: [
      'Click the big stapler to make staples by hand.',
      'Spend staples in the shop on interns and machines that staple on their own.',
      'Each unit costs more the more you own, so keep expanding the line.',
      'Your score is the most staples you produce in a single run.'
    ],
    mount
  });
})();
