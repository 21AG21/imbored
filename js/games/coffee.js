/* Coffee Clicker. It will eat your afternoon. That is the point. */
(function () {
  'use strict';
  const { h, clamp, rand, pick } = Engine;

  const SHOP = [
    { id: 'intern', name: 'Unpaid Intern', icon: 'panic', base: 15, cps: 0.15, blurb: 'Fetches coffee. Slowly. Resentfully.' },
    { id: 'press', name: 'French Press', icon: 'coffee', base: 110, cps: 1.1, blurb: 'Somebody left it in the sink for a week.' },
    { id: 'machine', name: 'Vending Machine', icon: 'dice', base: 620, cps: 5.4, blurb: 'Takes your money. Sometimes gives coffee.' },
    { id: 'barista', name: 'Guy Named Todd', icon: 'panic', base: 3400, cps: 24, blurb: 'Todd has opinions about beans.' },
    { id: 'robot', name: 'Espresso Robot', icon: 'smart', base: 21000, cps: 130, blurb: 'Four arms. Zero small talk. Perfect.' },
    { id: 'breakroom', name: 'Second Break Room', icon: 'over', base: 145000, cps: 720, blurb: 'Nobody knows it exists. Keep it that way.' },
    { id: 'farm', name: 'Rooftop Coffee Farm', icon: 'deskgolf', base: 980000, cps: 4200, blurb: 'HR filed a complaint. The beans are worth it.' },
    { id: 'portal', name: 'Bean Portal', icon: 'circle', base: 7600000, cps: 28000, blurb: 'It hums. Do not put your hand in it.' },
    { id: 'singularity', name: 'Caffeine Singularity', icon: 'boom', base: 62000000, cps: 190000, blurb: 'Time is a flat white now.' }
  ];

  const EVENTS = [
    { t: 'Somebody took the last cup and did not start a new pot.', mul: -0.08 },
    { t: 'Free doughnuts in the kitchen! Morale spike!', mul: 0.25 },
    { t: 'The fire alarm went off. Nobody brewed anything for a bit.', mul: -0.12 },
    { t: 'A mystery box of beans arrived. No note.', mul: 0.4 },
    { t: 'The machine is making iced coffee only. It is January.', mul: -0.06 },
    { t: 'You were named Employee Of The Month by nobody in particular.', mul: 0.6 },
    { t: 'Post-lunch slump. Everything is molasses.', mul: -0.15 }
  ];

  const fmt = (n) => {
    if (n < 1000) return n.toFixed(n < 10 && n % 1 ? 1 : 0);
    const units = ['k', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];
    let u = -1;
    while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
    return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + units[u];
  };

  function mount(root, api) {
    const bagg = Engine.bag();
    const priceScale = 1 + (api.dm - 1) * 0.55;      /* nightmare makes everything pricier */

    let S = api.load('save', null);
    if (!S || typeof S.cups !== 'number' || S.diff !== api.diffId) {
      S = { cups: 0, total: 0, clicks: 0, own: {}, diff: api.diffId };
    }
    for (const it of SHOP) if (!S.own[it.id]) S.own[it.id] = 0;

    let boost = 0, boostT = 0, eventText = '', eventT = 0, pops = [];

    const pCups = api.pill('Cups: 0');
    const pRate = api.pill('0.0 /sec');
    const pTotal = api.pill('lifetime 0');

    const mug = h('button', { class: 'mug', type: 'button', 'aria-label': 'Brew a cup' },
      h('span', { class: 'mug-art', html: Icons.svg('coffee', 110) }),
      h('span', { class: 'mug-label' }, 'BREW'));

    const popLayer = h('div', { class: 'pop-layer' });
    const eventBar = h('div', { class: 'coffee-event' });
    const shopEl = h('div', { class: 'shop' });

    root.append(
      h('div', { class: 'coffee-wrap' },
        h('div', { class: 'coffee-left' }, popLayer, mug, eventBar),
        shopEl));

    api.button('Wipe the save', () => {
      if (!confirm('Delete every bean you have ever earned? There is no undo.')) return;
      S = { cups: 0, total: 0, clicks: 0, own: {}, diff: api.diffId };
      for (const it of SHOP) S.own[it.id] = 0;
      boost = 0; boostT = 0;
      save();
      renderShop();
      sync();
    }, 'danger');

    const price = (it) => Math.ceil(it.base * priceScale * Math.pow(1.15, S.own[it.id]));
    const cps = () => SHOP.reduce((a, it) => a + it.cps * S.own[it.id], 0) * (1 + boost);

    function buy(it, many) {
      let n = 0;
      while (n < (many ? 10 : 1) && S.cups >= price(it)) {
        S.cups -= price(it);
        S.own[it.id]++;
        n++;
      }
      if (n) { api.sfx.good(); save(); renderShop(); sync(); }
      else api.sfx.bad();
    }

    const rows = [];
    function renderShop() {
      shopEl.replaceChildren(h('h4', { class: 'shop-head' }, 'THE SHOP'));
      rows.length = 0;
      for (const it of SHOP) {
        const owned = h('span', { class: 'shop-own' }, String(S.own[it.id]));
        const cost = h('span', { class: 'shop-cost' }, fmt(price(it)));
        const row = h('button', {
          class: 'shop-row', type: 'button',
          onclick: (e) => buy(it, e.shiftKey)
        },
          h('span', { class: 'shop-emoji', html: Icons.svg(it.icon, 24) }),
          h('span', { class: 'shop-body' },
            h('span', { class: 'shop-name' }, it.name),
            h('span', { class: 'shop-blurb' }, it.blurb)),
          h('span', { class: 'shop-right' }, cost, owned));
        rows.push({ it, row, cost, owned });
        shopEl.appendChild(row);
      }
      shopEl.appendChild(h('p', { class: 'shop-foot' }, 'shift-click buys ten at once'));
    }

    function pop(text, x, y) {
      const el = h('span', { class: 'pop' }, text);
      el.style.left = x + '%';
      el.style.top = y + '%';
      popLayer.appendChild(el);
      setTimeout(() => el.remove(), 900);
    }

    function brew(ev) {
      const gain = 1 + cps() * 0.06;
      S.cups += gain;
      S.total += gain;
      S.clicks++;
      api.sfx.tone({ freq: 420 + rand(-40, 60), to: 240, dur: 0.06, type: 'triangle', vol: 0.07 });
      pop('+' + fmt(gain), rand(24, 72), rand(20, 62));
      mug.classList.remove('squish');
      void mug.offsetWidth;
      mug.classList.add('squish');
      sync();
    }
    mug.addEventListener('click', brew);

    function sync() {
      pCups.textContent = 'Cups: ' + fmt(S.cups);
      pRate.textContent = fmt(cps()) + ' /sec' + (boost ? (boost > 0 ? ' UP' : ' DOWN') : '');
      pRate.className = 'pill ' + (boost > 0 ? 'good' : boost < 0 ? 'bad' : '');
      pTotal.textContent = 'lifetime ' + fmt(S.total);
      for (const r of rows) {
        r.cost.textContent = fmt(price(r.it));
        r.owned.textContent = String(S.own[r.it.id]);
        r.row.classList.toggle('afford', S.cups >= price(r.it));
      }
    }

    let saveT = 0;
    function save() { api.save('save', S); api.submit(Math.floor(S.total)); }

    let evTimer = rand(25, 45) / api.dm;
    bagg.add(Engine.loop((dt) => {
      const gained = cps() * dt;
      S.cups += gained;
      S.total += gained;

      if (boostT > 0) { boostT -= dt; if (boostT <= 0) boost = 0; }
      evTimer -= dt;
      if (evTimer <= 0) {
        const e = pick(EVENTS);
        boost = e.mul * (e.mul < 0 ? api.dm : 1 / api.dm);
        boostT = 14;
        eventText = e.t;
        eventT = 7;
        evTimer = rand(25, 45) / api.dm;
        api.sfx.blip(e.mul > 0 ? 700 : 220);
      }
      if (eventT > 0) {
        eventT -= dt;
        eventBar.textContent = eventText;
        eventBar.className = 'coffee-event show ' + (boost > 0 ? 'up' : 'down');
      } else eventBar.className = 'coffee-event';

      saveT += dt;
      if (saveT > 4) { saveT = 0; save(); }
      sync();
    }));

    bagg.add(() => save());
    renderShop();
    sync();
    api.status('Click the mug. Buy things that click the mug for you. Do not look at the clock.');
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'coffee',
    lightBoard: true,   // light shop panel would invert to solid black under the figure flip
    title: 'Coffee Clicker',
    emoji: 'coffee',
    cat: 'goof',
    order: 60,
    blurb: 'Click the mug for coffee, then spend it on things that brew for you. An idle clicker that runs while you do other work.',
    scoreLabel: 'Lifetime cups',
    formatScore: (v) => fmt(v),
    tags: ['idle', 'incremental', 'clicker', 'coffee'],
    how: [
      'Click the mug to brew a cup.',
      'Spend cups in the shop. Everything you buy keeps brewing while you are away.',
      'Shift-click a shop row to buy ten at once.',
      'Office events swing your rate up or down for a while. Doughnuts help, fire alarms hurt.',
      'Progress saves to this browser. Harder difficulty makes everything cost more.'
    ],
    mount
  });
})();
