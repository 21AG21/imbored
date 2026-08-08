/* Cubicle Arcade — registry, hub, router, scores, boss key. */
(function (global) {
  'use strict';

  const h = Engine.h;

  const games = [];
  const byId = new Map();
  const CATS = [
    { id: 'sim', label: 'Simulations' },
    { id: 'puzzle', label: 'Puzzles' },
    { id: 'action', label: 'Action' },
    { id: 'brain', label: 'Brain' }
  ];

  /* ---------------- storage ---------------- */
  const store = {
    get(k, d) {
      try { const v = localStorage.getItem('cubicle:' + k); return v == null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set(k, v) { try { localStorage.setItem('cubicle:' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };

  let currentDispose = null;
  let currentGame = null;
  let bossOn = false;
  const REAL_TITLE = 'Cubicle Arcade';
  const BOSS_TITLE = 'Q3_Regional_Forecast_v7_FINAL.xlsx';

  /* ---------------- public API ---------------- */
  const Arcade = {
    CATS,
    register(def) {
      if (byId.has(def.id)) { console.warn('duplicate game id', def.id); return; }
      const g = Object.assign(
        { cat: 'puzzle', emoji: '🎮', blurb: '', how: [], scoreLabel: 'Best', lowerIsBetter: false },
        def);
      games.push(g);
      byId.set(g.id, g);
      return g;
    },
    games: () => games.slice(),
    get: (id) => byId.get(id),

    best(id) { return store.get('best:' + id, null); },
    submit(id, value) {
      const g = byId.get(id);
      const prev = store.get('best:' + id, null);
      const better = prev == null || (g && g.lowerIsBetter ? value < prev : value > prev);
      if (better) store.set('best:' + id, value);
      store.set('plays:' + id, store.get('plays:' + id, 0) + 1);
      return { best: better ? value : prev, isRecord: better && prev != null, isFirst: prev == null };
    },
    plays(id) { return store.get('plays:' + id, 0); },
    store,
    muted() { return Engine.audio.muted; },
    go(id) { location.hash = id ? '#g/' + id : ''; }
  };
  global.Arcade = Arcade;

  /* ---------------- chrome ---------------- */
  function buildChrome() {
    const search = h('input', {
      class: 'search', type: 'search', placeholder: 'Search games…   /', 'aria-label': 'Search games',
      oninput: () => { if (!location.hash) renderHub(); }
    });
    Arcade._search = search;

    const soundBtn = h('button', { class: 'icon-btn', type: 'button', title: 'Sound on/off' });
    const syncSound = () => {
      soundBtn.textContent = Engine.audio.muted ? '🔇' : '🔊';
      soundBtn.classList.toggle('on', !Engine.audio.muted);
    };
    soundBtn.addEventListener('click', () => {
      Engine.audio.muted = !Engine.audio.muted;
      store.set('muted', Engine.audio.muted);
      syncSound();
      if (!Engine.audio.muted) Engine.audio.good();
    });
    Engine.audio.muted = store.get('muted', true);
    syncSound();

    const bar = h('header', { class: 'topbar' },
      h('a', { class: 'brand', href: '#' },
        h('span', { class: 'brand-mark' }, '▚'),
        h('span', { class: 'brand-text' }, 'Cubicle', h('em', null, 'Arcade'))),
      h('div', { class: 'topbar-spacer' }),
      search,
      h('button', {
        class: 'icon-btn', type: 'button', title: 'Random game',
        onclick: () => Arcade.go(Engine.pick(games).id)
      }, '🎲'),
      soundBtn,
      h('button', { class: 'icon-btn boss-btn', type: 'button', title: 'Boss key (`)', onclick: () => toggleBoss() }, '🕴️'));

    const view = h('main', { id: 'view', class: 'view' });
    const foot = h('footer', { class: 'foot' },
      h('span', null, 'No accounts. No network. Everything runs in this tab.'),
      h('span', null, h('kbd', null, '`'), ' boss key · ', h('kbd', null, '/'), ' search · ', h('kbd', null, 'Esc'), ' back to hub'));
    document.body.append(bar, view, foot);
    return view;
  }

  /* ---------------- hub ---------------- */
  let activeCat = 'all';

  function renderHub() {
    const view = document.getElementById('view');
    if (!view) return;
    const q = ((Arcade._search && Arcade._search.value) || '').trim().toLowerCase();

    const list = games.filter((g) => {
      if (activeCat !== 'all' && g.cat !== activeCat) return false;
      if (!q) return true;
      return (g.title + ' ' + g.blurb + ' ' + (g.tags || []).join(' ') + ' ' + g.cat).toLowerCase().includes(q);
    });

    const chips = h('div', { class: 'chips' },
      ['all'].concat(CATS.map((c) => c.id)).map((id) =>
        h('button', {
          class: 'chip' + (activeCat === id ? ' active' : ''), type: 'button',
          onclick: () => { activeCat = id; renderHub(); }
        }, id === 'all'
          ? 'All ' + games.length
          : (CATS.find((c) => c.id === id) || {}).label + ' ' + games.filter((g) => g.cat === id).length)));

    const cards = list.map((g) => {
      const best = Arcade.best(g.id);
      return h('a', { class: 'card cat-' + g.cat, href: '#g/' + g.id },
        h('span', { class: 'card-emoji' }, g.emoji),
        h('span', { class: 'card-cat' }, (CATS.find((c) => c.id === g.cat) || { label: g.cat }).label),
        h('h3', { class: 'card-title' }, g.title),
        h('p', { class: 'card-blurb' }, g.blurb),
        h('span', { class: 'card-best' },
          best == null ? 'not played yet' : g.scoreLabel + ': ' + (g.formatScore ? g.formatScore(best) : best)));
    });

    view.replaceChildren(
      h('section', { class: 'hero' },
        h('h1', null, 'Look busy. ', h('span', { class: 'accent' }, 'Be busy.')),
        h('p', null,
          games.length + ' games and fix-the-system simulations. They load instantly, need no account, ',
          'and vanish behind a spreadsheet the moment you hit ', h('kbd', null, '`'), '.')),
      chips,
      h('div', { class: 'grid' }, cards.length ? cards : h('p', { class: 'empty' }, 'Nothing matches that search.')));
    document.title = bossOn ? BOSS_TITLE : REAL_TITLE;
  }

  /* ---------------- game shell ---------------- */
  function renderGame(g) {
    const view = document.getElementById('view');
    const stage = h('div', { class: 'stage' });
    const statusEl = h('div', { class: 'status' });
    const bestEl = h('span', { class: 'pill best' });

    const syncBest = () => {
      const b = Arcade.best(g.id);
      bestEl.textContent = b == null
        ? g.scoreLabel + ': —'
        : g.scoreLabel + ': ' + (g.formatScore ? g.formatScore(b) : b);
    };
    syncBest();

    const toolbar = h('div', { class: 'gametools' });

    const api = {
      game: g,
      stage,
      toolbar,
      status(txt) { statusEl.textContent = txt || ''; },
      submit(v) { const r = Arcade.submit(g.id, v); syncBest(); return r; },
      best() { return Arcade.best(g.id); },
      sfx: Engine.audio,
      save(k, v) { store.set('g:' + g.id + ':' + k, v); },
      load(k, d) { return store.get('g:' + g.id + ':' + k, d); },
      button(label, fn, cls) {
        const b = h('button', { class: 'btn ' + (cls || ''), type: 'button', onclick: fn }, label);
        toolbar.appendChild(b);
        return b;
      },
      pill(label, cls) {
        const p = h('span', { class: 'pill ' + (cls || '') }, label);
        toolbar.appendChild(p);
        return p;
      },
      select(label, options, value, fn) {
        const sel = h('select', { class: 'sel', onchange: () => fn(sel.value) },
          options.map((o) => h('option', { value: o.value, selected: o.value === value ? true : null }, o.label)));
        toolbar.appendChild(h('label', { class: 'sel-wrap' }, h('span', null, label), sel));
        return sel;
      }
    };

    view.replaceChildren(
      h('div', { class: 'gamehead' },
        h('a', { class: 'back', href: '#' }, '← All games'),
        h('h2', { class: 'gtitle' }, h('span', { class: 'ge' }, g.emoji), g.title),
        h('div', { class: 'gmeta' }, bestEl),
        h('details', { class: 'howto' },
          h('summary', null, 'How to play'),
          h('ul', null, g.how.map((s) => h('li', null, s))))),
      toolbar, statusEl, stage);

    let dispose = null;
    try {
      dispose = g.mount(stage, api);
    } catch (e) {
      console.error('[' + g.id + '] failed to start', e);
      stage.replaceChildren(h('p', { class: 'empty' }, 'This game hit a snag starting up — check the console.'));
    }
    currentDispose = () => { if (typeof dispose === 'function') dispose(); };
    currentGame = g;
    document.title = bossOn ? BOSS_TITLE : g.title + ' — ' + REAL_TITLE;
  }

  /* ---------------- router ---------------- */
  function route() {
    if (currentDispose) { try { currentDispose(); } catch (e) { console.error(e); } }
    currentDispose = null;
    currentGame = null;
    Engine.paused = bossOn || document.hidden;
    const m = /^#g\/([\w-]+)/.exec(location.hash || '');
    const g = m && byId.get(m[1]);
    if (g) {
      const recent = store.get('recent', []).filter((x) => x !== g.id);
      recent.unshift(g.id);
      store.set('recent', recent.slice(0, 8));
      renderGame(g);
    } else {
      renderHub();
    }
    scrollTo(0, 0);
  }

  /* ---------------- boss key ---------------- */
  const SHEET_ROWS = [
    ['Northeast', 'Enterprise', 1284900, 1402350, 9.1, 'On track'],
    ['Northeast', 'Mid-Market', 842100, 811200, -3.7, 'At risk'],
    ['Southeast', 'Enterprise', 977400, 1055800, 8.0, 'On track'],
    ['Southeast', 'SMB', 431050, 468990, 8.8, 'On track'],
    ['Midwest', 'Enterprise', 1120600, 1098450, -2.0, 'Watch'],
    ['Midwest', 'Mid-Market', 655300, 702110, 7.1, 'On track'],
    ['Mountain', 'SMB', 288750, 301400, 4.4, 'On track'],
    ['Pacific', 'Enterprise', 1640200, 1822900, 11.1, 'Ahead'],
    ['Pacific', 'Mid-Market', 903800, 889700, -1.6, 'Watch'],
    ['Pacific', 'SMB', 512400, 559330, 9.2, 'On track'],
    ['International', 'Enterprise', 1345000, 1290500, -4.1, 'At risk'],
    ['International', 'Mid-Market', 720900, 764480, 6.0, 'On track'],
    ['International', 'SMB', 398200, 425610, 6.9, 'On track'],
    ['Public Sector', 'Enterprise', 1088000, 1141200, 4.9, 'On track'],
    ['Public Sector', 'Mid-Market', 470300, 455900, -3.1, 'Watch']
  ];
  const money = (n) => '$' + n.toLocaleString('en-US');

  function buildBoss() {
    const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const head = h('tr', null, h('th', { class: 'rowhead' }, ''), cols.map((l) => h('th', null, l)));
    const rows = [h('tr', null, h('td', { class: 'rowhead' }, '1'),
      ['Region', 'Segment', 'FY Plan', 'FY Actual', 'Var %', 'Status', 'Owner'].map((t) => h('td', { class: 'hcell' }, t)))];
    SHEET_ROWS.forEach((r, i) => {
      rows.push(h('tr', null,
        h('td', { class: 'rowhead' }, i + 2),
        h('td', null, r[0]), h('td', null, r[1]),
        h('td', { class: 'num' }, money(r[2])),
        h('td', { class: 'num' }, money(r[3])),
        h('td', { class: 'num ' + (r[4] < 0 ? 'neg' : 'pos') }, (r[4] > 0 ? '+' : '') + r[4].toFixed(1) + '%'),
        h('td', null, r[5]),
        h('td', null, '')));
    });
    rows.push(h('tr', { class: 'total' },
      h('td', { class: 'rowhead' }, SHEET_ROWS.length + 2),
      h('td', null, 'TOTAL'), h('td', null, ''),
      h('td', { class: 'num' }, money(SHEET_ROWS.reduce((a, r) => a + r[2], 0))),
      h('td', { class: 'num' }, money(SHEET_ROWS.reduce((a, r) => a + r[3], 0))),
      h('td', { class: 'num pos' }, '+3.4%'), h('td', null, ''), h('td', null, '')));
    for (let i = 0; i < 8; i++) {
      rows.push(h('tr', null, h('td', { class: 'rowhead' }, SHEET_ROWS.length + 3 + i), cols.map(() => h('td', null, ''))));
    }

    return h('div', { class: 'boss hidden', id: 'boss', 'aria-hidden': 'true' },
      h('div', { class: 'boss-bar' },
        h('span', { class: 'boss-file' }, BOSS_TITLE),
        h('span', { class: 'boss-menu' }, ['File', 'Edit', 'View', 'Insert', 'Format', 'Data', 'Tools', 'Help'].map((m) => h('span', null, m))),
        h('span', { class: 'boss-hint' }, 'press ` to resume')),
      h('div', { class: 'boss-formula' },
        h('span', { class: 'cellref' }, 'D18'), h('span', { class: 'fx' }, 'fx'), h('span', null, '=SUM(D2:D16)')),
      h('div', { class: 'boss-sheet' }, h('table', null, h('thead', null, head), h('tbody', null, rows))),
      h('div', { class: 'boss-tabs' },
        h('span', { class: 'tab active' }, 'Summary'),
        h('span', { class: 'tab' }, 'By Region'),
        h('span', { class: 'tab' }, 'Pipeline'),
        h('span', { class: 'tab' }, 'Assumptions'),
        h('span', { class: 'tab' }, 'Sheet4')));
  }

  function toggleBoss(force) {
    bossOn = force === undefined ? !bossOn : force;
    const el = document.getElementById('boss');
    if (el) {
      el.classList.toggle('hidden', !bossOn);
      el.setAttribute('aria-hidden', bossOn ? 'false' : 'true');
    }
    document.body.classList.toggle('boss-on', bossOn);
    Engine.paused = bossOn || document.hidden;
    document.title = bossOn ? BOSS_TITLE : (currentGame ? currentGame.title + ' — ' + REAL_TITLE : REAL_TITLE);
  }
  Arcade.toggleBoss = toggleBoss;

  /* ---------------- boot ---------------- */
  Arcade.start = function start() {
    games.sort((a, b) => (a.order || 50) - (b.order || 50));
    buildChrome();
    document.body.appendChild(buildBoss());

    addEventListener('hashchange', route);

    addEventListener('keydown', (e) => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (e.key === '`' || (e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'b' && !typing)) {
        e.preventDefault();
        toggleBoss();
        return;
      }
      if (bossOn) return;
      if (typing) {
        if (e.key === 'Escape') { t.value = ''; t.blur(); if (!location.hash) renderHub(); }
        return;
      }
      if (e.key === '/') { e.preventDefault(); if (!location.hash) Arcade._search.focus(); }
      if (e.key === 'Escape' && location.hash) location.hash = '';
    });

    addEventListener('visibilitychange', () => {
      Engine.paused = bossOn || document.hidden;
    });

    route();
  };
})(window);
