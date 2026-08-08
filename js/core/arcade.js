/* Cubicle Arcade '98 - registry, hub, router, scores, boss key, CHOMPS. */
(function (global) {
  'use strict';

  const h = Engine.h;

  const games = [];
  const byId = new Map();
  const CATS = [
    { id: 'sim', label: 'Sims' },
    { id: 'puzzle', label: 'Puzzles' },
    { id: 'action', label: 'Action' },
    { id: 'brain', label: 'Brain' },
    { id: 'goof', label: 'Goofy' }
  ];

  /* ---------------- storage ---------------- */
  const store = {
    get(k, d) {
      try { const v = localStorage.getItem('cubicle:' + k); return v == null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set(k, v) { try { localStorage.setItem('cubicle:' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };

  /* ---------------- difficulty dial ----------------
     Every game multiplies its own knobs by Arcade.dm(): spawn rates, speeds,
     patience, board sizes, lives. One dial, sixteen different flavours of pain. */
  const DIFFS = [
    { id: 'chill', label: 'CHILL', m: 0.7, note: 'Everything is slower and kinder. No shame in it.' },
    { id: 'normal', label: 'NORMAL', m: 1, note: 'The way these were built.' },
    { id: 'hard', label: 'HARD', m: 1.55, note: 'Faster, meaner, fewer second chances.' },
    { id: 'nightmare', label: 'NIGHTMARE', m: 2.3, note: 'This is a bad idea and you should do it.' }
  ];
  let diffIdx = 1;

  let currentDispose = null;
  let currentGame = null;
  let bossOn = false;
  let bigOn = false;
  /* The site's display name. Editable straight from the top bar (click it and
     type); defaults to a forgettable "Docs" so a glance at the header or the
     browser tab gives nothing away. Drives both the brand and the tab title. */
  function brandName() { return store.get('brand', 'Docs'); }
  function applyDocTitle() {
    document.title = bossOn ? Boss.title()
      : (currentGame ? currentGame.title.toUpperCase() + ' - ' + brandName() : brandName());
  }

  /* ---------------- public API ---------------- */
  const Arcade = {
    CATS,
    register(def) {
      if (byId.has(def.id)) { console.warn('duplicate game id', def.id); return; }
      const g = Object.assign(
        { cat: 'puzzle', emoji: 'dice', blurb: '', how: [], scoreLabel: 'Best', lowerIsBetter: false },
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
    go(id) { location.hash = id ? '#g/' + id : ''; },

    DIFFS,
    dm() { return DIFFS[diffIdx].m; },
    diff() { return DIFFS[diffIdx]; },
    hard() { return diffIdx >= 2; },
    setDiff(i) {
      diffIdx = Engine.clamp(i, 0, DIFFS.length - 1);
      store.set('diff', DIFFS[diffIdx].id);
      syncDiffBtn();
      route();          // restart whatever is running so the change bites immediately
    }
  };
  global.Arcade = Arcade;

  /* ---------------- big screen ---------------- */
  function setBig(on) {
    bigOn = on;
    document.body.classList.toggle('bigscreen', bigOn);
    const btn = document.getElementById('fsbtn');
    if (btn) btn.classList.toggle('on', bigOn);
    if (bigOn && !document.fullscreenElement) {
      const r = document.documentElement.requestFullscreen;
      if (r) r.call(document.documentElement).catch(() => { /* blocked, class alone still helps */ });
    } else if (!bigOn && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => { });
    }
  }
  Arcade.toggleBig = () => setBig(!bigOn);

  let skinSel = null;
  let syncWebRow = () => { };
  function syncSkinSel() { if (skinSel) skinSel.value = Boss.skinId(); syncWebRow(); }

  let diffBtn = null;
  function syncDiffBtn() {
    if (!diffBtn) return;
    diffBtn.textContent = DIFFS[diffIdx].label;
    diffBtn.title = DIFFS[diffIdx].note + '  (click to change)';
    diffBtn.className = 'btn diffbtn d-' + DIFFS[diffIdx].id;
  }

  /* ---------------- theme picker ---------------- */
  function buildThemeBtn() {
    const swatches = h('div', { class: 'theme-swatches' });
    const pop = h('div', { class: 'theme-pop hidden' },
      h('h4', null, 'Colour scheme'),
      swatches,
      h('label', { class: 'theme-custom' },
        h('span', null, 'Pick your own'),
        h('input', {
          type: 'color', value: Themes.custom(),
          oninput: (e) => { Themes.setCustom(e.target.value); paintSwatches(); }
        })));

    function paintSwatches() {
      swatches.replaceChildren();
      for (const t of Themes.list()) {
        const btn = h('button', {
          class: 'theme-swatch' + (Themes.current() === t.id ? ' on' : ''),
          type: 'button', title: t.name,
          onclick: () => { Themes.set(t.id); paintSwatches(); }
        }, h('span', { class: 'theme-name' }, t.name));
        /* preview chip built from that theme's own tokens */
        btn.style.setProperty('--sw', t.id === 'custom' ? Themes.custom() : '');
        btn.dataset.theme = t.id;
        swatches.appendChild(btn);
      }
    }
    paintSwatches();

    const btn = h('button', { class: 'icon-btn', type: 'button', title: 'Colour scheme', html: Icons.svg('palette', 19) });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      pop.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!pop.classList.contains('hidden') && !pop.contains(e.target) && e.target !== btn) pop.classList.add('hidden');
    });
    return h('div', { class: 'theme-wrap' }, btn, pop);
  }

  /* ---------------- top chrome ---------------- */
  function buildChrome() {
    const search = h('input', {
      class: 'search', type: 'search', placeholder: 'find a game...', 'aria-label': 'Search games',
      oninput: () => { if (!location.hash) renderHub(); }
    });
    Arcade._search = search;

    const soundBtn = h('button', { class: 'icon-btn', type: 'button', title: 'Noise on/off' });
    const syncSound = () => {
      soundBtn.innerHTML = Icons.svg(Engine.audio.muted ? 'mute' : 'sound', 19);
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

    diffBtn = h('button', {
      class: 'btn diffbtn', type: 'button',
      onclick: () => { Engine.audio.blip(280 + diffIdx * 170); Arcade.setDiff((diffIdx + 1) % DIFFS.length); }
    });
    const savedDiff = DIFFS.findIndex((d) => d.id === store.get('diff', 'normal'));
    diffIdx = savedDiff < 0 ? 1 : savedDiff;
    syncDiffBtn();

    const brandText = h('span', {
      class: 'brand-text', contenteditable: 'true', spellcheck: 'false',
      title: 'Click to rename. Enter to save.', 'aria-label': 'Site name (editable)'
    }, brandName());
    const readBrand = () => brandText.textContent.replace(/\s+/g, ' ').trim();
    const saveBrand = () => { store.set('brand', readBrand() || 'Docs'); applyDocTitle(); };
    brandText.addEventListener('input', saveBrand);
    brandText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); brandText.blur(); }
    });
    brandText.addEventListener('blur', () => {
      const t = readBrand() || 'Docs';
      if (brandText.textContent !== t) brandText.textContent = t;
      store.set('brand', t); applyDocTitle();
    });

    const bar = h('header', { class: 'topbar' },
      h('span', { class: 'brand' },
        h('a', { class: 'brand-mark', href: '#', title: 'Home', html: Icons.svg('dice', 19) }),
        brandText),
      h('div', { class: 'topbar-spacer' }),
      diffBtn,
      search,
      h('button', {
        class: 'icon-btn', type: 'button', title: 'Surprise me',
        html: Icons.svg('dice', 19),
        onclick: () => Arcade.go(Engine.pick(games).id)
      }),
      h('button', { class: 'icon-btn', id: 'fsbtn', type: 'button', title: 'Big screen (\\)', html: Icons.svg('expand', 19), onclick: () => Arcade.toggleBig() }),
      buildThemeBtn(),
      soundBtn,
      h('button', {
        class: 'icon-btn', type: 'button',
        title: 'LOOK BUSY (backtick). Shift-click to change disguise.',
        html: Icons.svg('panic', 19),
        onclick: (e) => { if (e.shiftKey) { Boss.cycle(); syncSkinSel(); } else toggleBoss(); }
      }));

    const view = h('main', { id: 'view', class: 'view' });
    skinSel = h('select', {
      class: 'sel', 'aria-label': 'Panic screen disguise',
      onchange: () => { Boss.setSkin(skinSel.value); syncWebRow(); }
    }, Boss.SKINS.map((sk) => h('option', { value: sk.id, selected: sk.id === Boss.skinId() ? true : null }, sk.label)));

    const urlInput = h('input', {
      class: 'boss-url', type: 'text', spellcheck: 'false',
      placeholder: 'paste any web address', value: Boss.url(),
      oninput: () => Boss.setUrl(urlInput.value)
    });
    const modeSel = h('select', {
      class: 'sel', 'aria-label': 'How the site opens',
      onchange: () => { Boss.setMode(modeSel.value); syncWebRow(); }
    },
      h('option', { value: 'jump', selected: Boss.mode() === 'jump' ? true : null }, 'Open the site'),
      h('option', { value: 'embed', selected: Boss.mode() === 'embed' ? true : null }, 'Embed it'));

    const webRow = h('span', { class: 'foot-skin' }, urlInput, modeSel);
    const webHint = h('span', { class: 'foot-hint' });

    syncWebRow = () => {
      const isWeb = Boss.skinId() === 'web';
      webRow.style.display = isWeb ? '' : 'none';
      webHint.style.display = isWeb ? '' : 'none';
      webHint.textContent = Boss.mode() === 'jump'
        ? 'Open the site: the key loads that address in this tab. Works with any website. Your scores are saved, so come back with the back button.'
        : 'Embed it: the key drops the site into a frame over the games, keeping your game paused underneath. Only works for sites that allow embedding, which most big ones do not.';
    };

    const foot = h('footer', { class: 'foot' },
      h('span', { class: 'foot-skin' },
        h('strong', null, 'PANIC SCREEN:'), skinSel,
        h('button', { class: 'btn tiny', type: 'button', onclick: () => toggleBoss(true) }, 'try it')),
      webRow,
      h('span', null,
        h('a', { class: 'foot-link', href: 'https://claude.ai/code/artifact/245d9555-fb6f-4685-b698-42a8f82c10bd', target: '_blank', rel: 'noopener' }, 'PHANTOM: why traffic jams happen for no reason')),
      h('span', null,
        h('kbd', null, '`'), ' look busy   ',
        h('kbd', null, '['), h('kbd', null, ']'), ' switch game   ',
        h('kbd', null, 'R'), ' restart   ',
        h('kbd', null, '\\'), ' big screen   ',
        h('kbd', null, '/'), ' search   ',
        h('kbd', null, 'Esc'), ' back'),
      webHint);
    syncWebRow();

    document.body.append(bar, view, foot);
    document.body.appendChild(h('div', { class: 'bigscreen-note' }, 'big screen on • press \\ or Esc to shrink'));
    return view;
  }

  /* ---------------- CHOMPS the stapler ---------------- */
  const TIPS = [
    'Hi! I am CHOMPS. I am a stapler. I have no useful skills.',
    'Psst. Backtick key. Instant spreadsheet. Tell nobody.',
    'Statistically speaking, somebody is walking behind you right now.',
    'You have played for a while. I am not judging. Staplers cannot judge.',
    'Pro tip: if anyone asks, you are stress testing the browser.',
    'Have you tried Gridlock? Traffic is fake. So is your inbox.',
    'I once held forty sheets together. Nobody clapped.',
    'Press F. The games get enormous. It rules.',
    'Do NOT play Coffee Clicker. It will eat your afternoon. I am serious.',
    'Solitaire is right there. It has been right there since 1990.',
    'If your screen goes beige and boring, that was me. You are welcome.',
    'Fun fact: nobody has ever finished reading a status update.',
    'My cousin is a hole punch. We do not speak.',
    'Nine minutes until the next meeting. Probably. I cannot read clocks.',
    'You are doing great. I have to say that. I am attached to the desk.'
  ];

  function chompsSvg() {
    return '<svg viewBox="0 0 58 62" width="58" height="62" aria-hidden="true">' +
      '<ellipse cx="29" cy="57" rx="20" ry="4" fill="rgba(0,0,0,.25)"/>' +
      '<path d="M6 40 h46 a4 4 0 0 1 4 4 v8 a4 4 0 0 1-4 4 H6 a4 4 0 0 1-4-4 v-8 a4 4 0 0 1 4-4z" fill="#4a4155" stroke="#1d1722" stroke-width="3"/>' +
      '<path d="M9 18 h40 a6 6 0 0 1 6 6 v14 a4 4 0 0 1-4 4 H7 a4 4 0 0 1-4-4 V24 a6 6 0 0 1 6-6z" fill="#e8402a" stroke="#1d1722" stroke-width="3"/>' +
      '<path d="M12 22 h34 v6 H12z" fill="#ff8a76"/>' +
      '<circle cx="20" cy="33" r="8" fill="#fffdf3" stroke="#1d1722" stroke-width="2.5"/>' +
      '<circle cx="39" cy="33" r="8" fill="#fffdf3" stroke="#1d1722" stroke-width="2.5"/>' +
      '<circle class="pupil" cx="21" cy="35" r="3.4" fill="#1d1722"/>' +
      '<circle class="pupil" cx="40" cy="35" r="3.4" fill="#1d1722"/>' +
      '</svg>';
  }

  function buildChomps() {
    let idx = 0;
    const text = h('span', null, TIPS[0]);
    const bubble = h('div', { class: 'chomps-bubble' },
      h('b', null, 'CHOMPS SAYS'),
      text,
      h('button', {
        class: 'chomps-x', type: 'button', title: 'Dismiss CHOMPS forever',
        onclick: (e) => {
          e.stopPropagation();
          wrap.classList.add('hidden');
          store.set('chomps', false);
        }
      }, '×'));

    const guy = h('button', { class: 'chomps-guy', type: 'button', title: 'Poke the stapler', html: chompsSvg() });
    const wrap = h('div', { class: 'chomps' }, bubble, guy);

    const nextTip = () => {
      idx = (idx + 1 + Math.floor(Math.random() * (TIPS.length - 1))) % TIPS.length;
      text.textContent = TIPS[idx];
    };
    guy.addEventListener('click', () => {
      nextTip();
      Engine.audio.tone({ freq: 180 + Math.random() * 60, to: 90, dur: 0.09, type: 'square', vol: 0.09 });
      guy.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(.82) rotate(8deg)' }, { transform: 'scale(1)' }],
        { duration: 220 });
    });
    setInterval(nextTip, 52000);

    /* googly eyes follow the pointer */
    const pupils = guy.querySelectorAll('.pupil');
    addEventListener('pointermove', (e) => {
      if (wrap.classList.contains('hidden')) return;
      const r = guy.getBoundingClientRect();
      if (!r.width) return;
      const ang = Math.atan2(e.clientY - (r.top + r.height * 0.55), e.clientX - (r.left + r.width / 2));
      pupils.forEach((p, i) => {
        p.setAttribute('cx', (i ? 39 : 20) + Math.cos(ang) * 3);
        p.setAttribute('cy', 33 + Math.sin(ang) * 3);
      });
    }, { passive: true });

    if (store.get('chomps', true) === false) wrap.classList.add('hidden');
    document.body.appendChild(wrap);
  }

  /* ---------------- hub ---------------- */
  let activeCat = 'all';

  const TICKER = [
    'NOW WITH ' , ' GAMES',
    ' *** ZERO INSTALLERS *** NO ACCOUNT *** NOBODY EMAILS YOU EVER ***',
    ' *** WORKS ON THE BEIGE ONE UNDER THE DESK ***',
    ' *** SCORES SAVED TO YOUR OWN BROWSER AND NOWHERE ELSE ***',
    ' *** PRESS BACKTICK IF SOMEONE IMPORTANT WALKS PAST ***',
    ' *** PRESS F TO MAKE IT ENORMOUS ***',
    ' *** CHOMPS THE STAPLER IS NOT A REAL EMPLOYEE ***'
  ];

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
          ? 'Everything (' + games.length + ')'
          : (CATS.find((c) => c.id === id) || {}).label + ' (' + games.filter((g) => g.cat === id).length + ')')));

    const cards = list.map((g) => {
      const best = Arcade.best(g.id);
      return h('a', { class: 'card cat-' + g.cat, href: '#g/' + g.id },
        h('span', { class: 'card-emoji', html: Icons.svg(g.emoji, 28) }),
        h('span', { class: 'card-cat' }, (CATS.find((c) => c.id === g.cat) || { label: g.cat }).label),
        h('h3', { class: 'card-title' }, g.title),
        h('p', { class: 'card-blurb' }, g.blurb),
        h('span', { class: 'card-best' + (best == null ? '' : ' played') },
          best == null ? 'never touched' : g.scoreLabel + ': ' + (g.formatScore ? g.formatScore(best) : best)));
    });

    view.replaceChildren(
      h('section', { class: 'hero' },
        h('span', { class: 'sticker s1' }, games.length + ' games'),
        h('span', { class: 'sticker s2' }, '0 calories'),
        h('span', { class: 'sticker s3' }, 'no install!'),
        h('h1', null, 'Look busy. ', h('span', { class: 'accent' }, 'Be busy.')),
        h('p', null,
          'The complete shareware collection for people whose meeting has no agenda. ',
          'Everything runs in this tab. Hit ', h('kbd', null, '`'), ' and the whole thing turns into a spreadsheet so fast nobody sees a thing.')),
      chips,
      h('div', { class: 'grid' },
        cards.length ? cards : h('p', { class: 'empty' }, 'Nothing by that name. Try fewer letters.'),
        (!q && (activeCat === 'all' || activeCat === 'sim')) ? h('a', {
          class: 'card card-link', href: 'https://claude.ai/code/artifact/245d9555-fb6f-4685-b698-42a8f82c10bd', target: '_blank', rel: 'noopener'
        },
          h('span', { class: 'card-emoji', html: Icons.svg('road', 28) }),
          h('span', { class: 'card-cat' }, 'Bonus'),
          h('h3', { class: 'card-title' }, 'Phantom'),
          h('p', { class: 'card-blurb' }, 'A traffic jam with no cause at all. One driver taps the brakes and the pulse outlives them, travelling backwards through the traffic forever. Watch it, then go play Gridlock again.'),
          h('span', { class: 'card-best' }, 'opens in a new tab \u2197')) : null),
      h('div', { class: 'ticker' }, h('span', null,
        '*** NOW WITH ' + games.length + ' GAMES ***' + TICKER.slice(2).join(''))));
    applyDocTitle();
  }

  /* ---------------- game screen ---------------- */
  function renderGame(g) {
    const view = document.getElementById('view');
    const stage = h('div', { class: 'stage' });
    const statusEl = h('div', { class: 'status' });
    const bestEl = h('span', { class: 'pill best' });

    const syncBest = () => {
      const b = Arcade.best(g.id);
      bestEl.textContent = b == null
        ? g.scoreLabel + ': none yet'
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
      /* difficulty: multiply your knobs by this. 0.7 chill ... 2.3 nightmare */
      dm: Arcade.dm(),
      hard: Arcade.hard(),
      diffId: Arcade.diff().id,
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
        h('a', { class: 'back', href: '#' }, '◀ shelf'),
        h('h2', { class: 'gtitle' }, h('span', { class: 'ge', html: Icons.svg(g.emoji, 24) }), g.title),
        g.link ? h('a', { class: 'back rel-link', href: g.link.url, target: '_blank', rel: 'noopener' }, g.link.label + ' \u2197') : null,
        h('div', { class: 'gmeta' },
          h('span', { class: 'pill diff-tag d-' + Arcade.diff().id }, Arcade.diff().label),
          bestEl),
        h('details', { class: 'howto' },
          h('summary', null, 'How this thing works'),
          h('ul', null, g.how.map((s) => h('li', null, s))))),
      toolbar, statusEl, stage);

    stage.appendChild(h('div', { class: 'rotate-nudge' },
      'Built wide. Turn the phone sideways or tap expand to fill the screen.'));

    let dispose = null;
    try {
      dispose = g.mount(stage, api);
    } catch (e) {
      console.error('[' + g.id + '] failed to start', e);
      stage.replaceChildren(h('p', { class: 'empty' }, 'This one fell over on startup. Sorry. Try another.'));
    }
    /* a landscape playfield is unreadable in a portrait phone, so say so */
    requestAnimationFrame(() => {
      const cvEl = stage.querySelector('canvas');
      const ar = cvEl ? parseFloat(getComputedStyle(cvEl).getPropertyValue('--ar')) : 0;
      stage.classList.toggle('wide', ar > 1.35);
    });

    currentDispose = () => { if (typeof dispose === 'function') dispose(); };
    currentGame = g;
    applyDocTitle();
  }

  /* ---------------- router ---------------- */
  function route() {
    if (currentDispose) { try { currentDispose(); } catch (e) { console.error(e); } }
    currentDispose = null;
    currentGame = null;
    Engine.paused = bossOn || document.hidden;
    const m = /^#g\/([\w-]+)/.exec(location.hash || '');
    const g = m && byId.get(m[1]);
    document.body.classList.toggle('in-game', !!g);
    if (g) {
      const recent = store.get('recent', []).filter((x) => x !== g.id);
      recent.unshift(g.id);
      store.set('recent', recent.slice(0, 8));
      renderGame(g);
    } else {
      if (bigOn) setBig(false);
      renderHub();
    }
    scrollTo(0, 0);
  }

  /* ---------------- panic screen ---------------- */
  function toggleBoss(force) {
    bossOn = Boss.toggle(force);
    Engine.paused = bossOn || document.hidden;
    applyDocTitle();
  }

  Arcade.toggleBoss = toggleBoss;

  /* ---------------- boot ---------------- */
  Arcade.start = function start() {
    games.sort((a, b) => (a.order || 50) - (b.order || 50));
    buildChrome();
    document.body.appendChild(Boss.build());
    buildChomps();

    addEventListener('hashchange', route);
    addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && bigOn) setBig(false);
    });

    addEventListener('keydown', (e) => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (!typing && (e.key === '`' || (e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'b'))) {
        e.preventDefault();
        toggleBoss();
        return;
      }
      if (bossOn) return;
      if (typing) {
        if (e.key === 'Escape') { t.value = ''; t.blur(); if (!location.hash) renderHub(); }
        return;
      }
      /* big screen is a non-letter key (backslash) so it never competes with a
         game's own controls — every letter belongs to the games */
      if (e.key === '\\') { e.preventDefault(); Arcade.toggleBig(); return; }
      /* in a game: [ and ] flick to the previous/next game on the shelf,
         R restarts the current one (skipped where letters are the controls) */
      if (currentGame) {
        if (e.key === '[' || e.key === ']') {
          e.preventDefault();
          const i = games.indexOf(currentGame);
          if (i >= 0) { const j = (i + (e.key === ']' ? 1 : -1) + games.length) % games.length; Arcade.go(games[j].id); }
          return;
        }
        if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !currentGame.usesLetters) {
          e.preventDefault(); route(); return;
        }
      }
      if (e.key === '/') { e.preventDefault(); if (!location.hash) Arcade._search.focus(); }
      if (e.key === 'Escape') {
        if (bigOn) setBig(false);
        else if (location.hash) location.hash = '';
      }
    });

    addEventListener('visibilitychange', () => {
      Engine.paused = bossOn || document.hidden;
    });

    route();
  };
})(window);
