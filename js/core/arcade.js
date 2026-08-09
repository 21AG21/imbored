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
        })),
      h('label', { class: 'theme-crt' },
        h('input', {
          type: 'checkbox', checked: store.get('crt', false) ? true : null,
          onchange: (e) => { document.body.classList.toggle('crt', e.target.checked); store.set('crt', e.target.checked); }
        }),
        h('span', null, 'CRT screen')),
      h('label', { class: 'theme-crt' },
        h('input', {
          type: 'checkbox', checked: store.get('colorsafe', false) ? true : null,
          onchange: (e) => { document.body.classList.toggle('colorsafe', e.target.checked); store.set('colorsafe', e.target.checked); }
        }),
        h('span', null, 'Colour-safe symbols')));

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

    const musicBtn = h('button', { class: 'icon-btn', type: 'button', title: 'Hold Music on/off', html: Icons.svg('music', 19) });
    musicBtn.addEventListener('click', () => { musicBtn.classList.toggle('on', Engine.music.toggle()); });

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
      musicBtn,
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

    /* Filing cabinet: every score lives in this origin's localStorage, so the
       Vercel / Pages / Drive / USB copies are separate silos. Back up carries
       them between; Restore merges a backup in. Purely local — nothing leaves. */
    function exportSaves() {
      const data = {};
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('cubicle:') === 0) data[k] = localStorage.getItem(k); } } catch (e) { /* private mode */ }
      const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: 'cubicle-arcade-saves.json' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
    const importInput = h('input', {
      type: 'file', accept: 'application/json,.json', style: { display: 'none' },
      onchange: (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
          try {
            const data = JSON.parse(rd.result);
            let n = 0;
            for (const k in data) if (k.indexOf('cubicle:') === 0) { localStorage.setItem(k, data[k]); n++; }
            if (n) location.reload(); else alert('No arcade scores found in that file.');
          } catch (err) { alert('That file did not look like an arcade backup.'); }
        };
        rd.readAsText(f);
        e.target.value = '';
      }
    });

    const foot = h('footer', { class: 'foot' },
      h('span', { class: 'foot-skin' },
        h('strong', null, 'PANIC SCREEN:'), skinSel,
        h('button', { class: 'btn tiny', type: 'button', onclick: () => toggleBoss(true) }, 'try it'),
        h('label', { class: 'foot-check' },
          h('input', {
            type: 'checkbox', checked: store.get('autohide', false) ? true : null,
            onchange: (e) => store.set('autohide', e.target.checked)
          }),
          h('span', null, 'auto-hide when I click away'))),
      h('span', { class: 'foot-skin' },
        h('strong', null, 'SCORES:'),
        h('button', { class: 'btn tiny', type: 'button', onclick: exportSaves }, 'Back up'),
        h('button', { class: 'btn tiny', type: 'button', onclick: () => importInput.click() }, 'Restore'),
        h('a', { class: 'foot-link', href: '#stats' }, 'Your timesheet'),
        importInput),
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
      h('span', { class: 'foot-privacy' },
        'No cookies. No accounts. No tracking. Every score and setting lives only in this browser, and nothing you type is ever sent anywhere.'),
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
    'You are doing great. I have to say that. I am attached to the desk.',
    'I am 94% recycled steel and 6% pure resentment.',
    'The printer down the hall is jammed. It is always jammed. It has chosen this.',
    'You could be in a meeting right now. You are not. This is growth.',
    'I keep a list of everyone who has jammed me. It is long. You are not on it yet.',
    'Someone microwaved fish. I felt it in my springs.',
    'Your calendar says "focus time." We both know what that means.',
    'Breaking: local worker looks incredibly busy. Sources say it is a browser tab.',
    'I have watched a thousand quarterly targets come and go. None came. All went.',
    'The office plant is plastic. Keep this between us.',
    'Alt-tab is a life skill. Put it on your resume.',
    'If a manager walks by, sigh loudly and open a spreadsheet. Works every time.',
    'I am not saying the coffee is bad. I am saying it dissolved a spoon.',
    'Somewhere a synergy is being leveraged. Not here. Here we play Snake.',
    'Try Powder. Pour lava onto water. Feel something for once.',
    'The Wi-Fi is fine. Your motivation is the outage.',
    'I once got promoted to heavy-duty. Then they bought a bigger stapler.',
    'Studies show that staring at a chart for eight seconds legally counts as work.',
    'That noise? The vending machine, grieving.',
    'You have 47 unread emails. They can wait. They have waited before.',
    'The all-hands is optional, in the sense that everything is, eventually.',
    'I do not have thumbs, and yet I have survived more meetings than most.',
    'Pro move: book a meeting so you look busy blocking time for the meeting.',
    'Racer stage 20 is completely unhinged. I approve. I am a stapler.',
    'Your mouse has travelled six miles today. None of it mattered.',
    'Nobody reads the terms. Nobody reads the docs. Nobody reads this.',
    'I believe in you. I am contractually required to.',
    'Reply-all is a cry for help. Do not answer it.',
    'The standup could have been a stapler. I would have listened.',
    'You cleared a new level. In the game. Not in life. Manage expectations.',
    'Ergonomics tip: lean back like you are deep in thought. Napping is optional.',
    'The org chart is a maze. Try the actual Maze instead. It has an exit.',
    'I heard your headphones. That is not a conference call. That is Tetris.',
    'The deadline is Friday. Friday is a construct. We are fine.',
    'Every open tab is a promise you made to yourself and quietly broke.',
    'The whiteboard still says DO NOT ERASE from 2019. We obey.',
    'Fun fact: circling back has never once produced a circle, or a back.',
    'Sokoban is moving boxes for no reason. So is Tuesday.',
    'You typed "per my last email" with real menace. I respect it.',
    'The elevator is slow because it, too, dreads the fourth floor.',
    'Coffee number four is where the personality lives.',
    'Somebody booked the good conference room for a nap. A legend walks among us.',
    'I audited your productivity. My findings: adorable.',
    'Word Guess counts as vocabulary training. Put it on your review.',
    'You could clear your inbox, or clear a Minesweeper board. Only one is winnable.',
    'The meeting ran long. Meetings are basically weather now. Uncontrollable.',
    'I remember when the desk was new. I remember when you were new.',
    'The suggestion box is full of resignation letters. Aspirational.',
    'Look at Desk Toss. Physics. In an office. Nobody can stop you.',
    'If the screen flashes every colour, that was the rave button. Blame the boss.',
    'Poke me again. I have nowhere to be. Neither, apparently, do you.'
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

  /* arrow-key navigation across the card grid (Tab already works linearly) */
  function wireGridKeys(grid) {
    grid.addEventListener('keydown', (e) => {
      if (e.key.slice(0, 5) !== 'Arrow' && e.key !== 'Home' && e.key !== 'End') return;
      const cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));
      if (!cards.length) return;
      const i = cards.indexOf(document.activeElement);
      if (i < 0) { cards[0].focus(); e.preventDefault(); return; }
      const top0 = cards[0].offsetTop;
      const cols = cards.filter((c) => c.offsetTop === top0).length || 1;
      let j = i;
      if (e.key === 'ArrowRight') j = i + 1;
      else if (e.key === 'ArrowLeft') j = i - 1;
      else if (e.key === 'ArrowDown') j = i + cols;
      else if (e.key === 'ArrowUp') j = i - cols;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = cards.length - 1;
      if (j >= 0 && j < cards.length) { cards[j].focus(); e.preventDefault(); }
    });
  }

  /* a curated first-run shelf, so 55 games are not a wall of equal choices */
  const FEATURED = [
    { id: 'workbook', hook: 'Minesweeper wearing a spreadsheet. Hide in plain sight.' },
    { id: 'spamfilter', hook: 'Tower defense for your inbox. Hold the line.' },
    { id: 'bubblewrap', hook: 'Aim, fire, pop clusters. Endlessly satisfying.' },
    { id: 'life', hook: 'Draw a colony, drop a glider gun, watch it breathe.' },
    { id: 'turf', hook: 'Rock-paper-scissors that curls into living spirals.' },
    { id: 'logistic', hook: 'One knob turns calm into chaos — the famous route.' },
    { id: 'busywork', hook: 'File reports, hire interns, reorg. Forever.' },
    { id: 'connect4', hook: 'Beat the CPU, or a coworker by hotseat or code.' }
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
          'Everything runs in this tab. Hit ', h('kbd', null, '`'), ' and the whole thing turns into a spreadsheet so fast nobody sees a thing.'),
        h('button', { class: 'btn primary daily-btn', type: 'button', onclick: () => Arcade.daily() }, 'Play today’s Daily')),
      (!q && activeCat === 'all') ? h('section', { class: 'featured' },
        h('h2', { class: 'featured-h' }, 'Start here'),
        h('div', { class: 'pick-row' },
          FEATURED.map((f) => {
            const g = games.find((x) => x.id === f.id);
            if (!g) return null;
            return h('a', { class: 'pick cat-' + g.cat, href: '#g/' + g.id },
              h('span', { class: 'pick-emoji', html: Icons.svg(g.emoji, 22) }),
              h('span', { class: 'pick-title' }, g.title),
              h('span', { class: 'pick-hook' }, f.hook));
          }))) : null,
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
    const gridEl = view.querySelector('.grid');
    if (gridEl) wireGridKeys(gridEl);
    applyDocTitle();
  }

  /* ---------------- your timesheet (stats, doubles as camouflage) ---------------- */
  const LADDER = [
    [0, 'Intern'], [15, 'Junior Associate'], [40, 'Associate'], [80, 'Senior Associate'],
    [140, 'Team Lead'], [220, 'Manager'], [340, 'Senior Manager'], [500, 'Regional Manager'], [750, 'VP of Morale']
  ];
  function renderStats() {
    const view = document.getElementById('view');
    const rows = [];
    let totalPlays = 0, played = 0, records = 0;
    for (const g of games) {
      const pl = Arcade.plays(g.id), bs = Arcade.best(g.id);
      totalPlays += pl; if (pl > 0) played++; if (bs != null) records++;
      if (pl > 0 || bs != null) rows.push({ g, pl, bs });
    }
    rows.sort((a, b) => b.pl - a.pl);
    const score = played * 3 + totalPlays + records * 2;
    let tier = LADDER[0], next = null;
    for (let i = 0; i < LADDER.length; i++) { if (score >= LADDER[i][0]) { tier = LADDER[i]; next = LADDER[i + 1] || null; } }
    const pct = next ? Math.max(3, Math.round((score - tier[0]) / (next[0] - tier[0]) * 100)) : 100;

    const badges = [];
    const add = (cond, name, desc) => { if (cond) badges.push({ name, desc }); };
    add(played >= 1, 'Onboarded', 'Played at least one game.');
    add(totalPlays >= 25, 'Getting Comfortable', 'Twenty-five sessions on the clock.');
    add(totalPlays >= 100, 'Regular', 'One hundred sessions. Nobody suspects a thing.');
    add(records >= 10, 'Record Holder', 'Ten personal bests on file.');
    add(played >= Math.ceil(games.length * 0.5), 'Half the Building', 'Tried half the shelf.');
    add(played >= games.length, 'Completionist', 'Opened every game. Concerning and impressive.');
    add(Arcade.plays('coffee') > 0, 'Caffeinated', 'You clicked the mug. It began.');
    add(Arcade.best('reflex') != null, 'Quick Draw', 'Logged a reaction time.');

    /* draw a mock dot-matrix certificate to a canvas and download it — no upload */
    function printCertificate() {
      const c = document.createElement('canvas'); c.width = 900; c.height = 640;
      const x = c.getContext('2d');
      x.fillStyle = '#f4efe0'; x.fillRect(0, 0, 900, 640);
      x.strokeStyle = '#1d1722'; x.lineWidth = 6; x.strokeRect(24, 24, 852, 592);
      x.lineWidth = 2; x.strokeRect(38, 38, 824, 564);
      x.fillStyle = '#1d1722'; x.textAlign = 'center';
      x.font = 'bold 20px "Courier New", monospace'; x.fillText('* * *   CUBICLE ARCADE   * * *', 450, 92);
      x.font = 'bold 34px Impact, "Arial Black", sans-serif'; x.fillText('CERTIFICATE OF ACHIEVEMENT', 450, 142);
      x.font = '15px "Courier New", monospace'; x.fillText('This certifies that the bearer has attained the rank of', 450, 202);
      x.fillStyle = '#6f3fa8'; x.font = 'bold 46px Impact, "Arial Black", sans-serif'; x.fillText(tier[1].toUpperCase(), 450, 262);
      x.fillStyle = '#1d1722'; x.font = '15px "Courier New", monospace';
      x.fillText(played + ' games played    ' + records + ' personal bests    ' + totalPlays + ' sessions logged', 450, 322);
      x.fillText('Issued ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), 450, 356);
      x.save(); x.translate(706, 470); x.rotate(-0.12);
      x.strokeStyle = '#e8402a'; x.lineWidth = 4; x.beginPath(); x.arc(0, 0, 72, 0, 7); x.stroke();
      x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 60, 0, 7); x.stroke();
      x.fillStyle = '#e8402a'; x.font = 'bold 15px Impact, sans-serif';
      x.fillText('EMPLOYEE', 0, -12); x.fillText('OF THE', 0, 8); x.fillText('MONTH', 0, 28);
      x.restore();
      x.strokeStyle = '#1d1722'; x.lineWidth = 1; x.beginPath(); x.moveTo(150, 500); x.lineTo(370, 500); x.stroke();
      x.textAlign = 'left'; x.font = '12px "Courier New", monospace';
      x.fillText('Authorised by CHOMPS, Office Assistant', 150, 520);
      c.toBlob((blob) => {
        if (!blob) return;
        const u = URL.createObjectURL(blob);
        const a = h('a', { href: u, download: 'certificate-of-achievement.png' });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(u), 1500);
      });
    }

    const table = h('table', { class: 'ts-table' },
      h('thead', null, h('tr', null,
        h('th', null, 'Code'), h('th', null, 'Activity'), h('th', null, 'Dept'),
        h('th', { class: 'num' }, 'Sessions'), h('th', null, 'Best result'), h('th', { class: 'num' }, 'Hrs'))),
      h('tbody', null,
        rows.map((r, i) => h('tr', null,
          h('td', { class: 'ts-code' }, 'TSK-' + (1000 + i)),
          h('td', null, h('span', { class: 'ts-ico', html: Icons.svg(r.g.emoji, 16) }), r.g.title),
          h('td', null, (CATS.find((c) => c.id === r.g.cat) || { label: r.g.cat }).label),
          h('td', { class: 'num' }, r.pl),
          h('td', null, r.bs == null ? '—' : (r.g.scoreLabel + ': ' + (r.g.formatScore ? r.g.formatScore(r.bs) : r.bs))),
          h('td', { class: 'num' }, (r.pl * 0.4).toFixed(1)))),
        rows.length ? h('tr', { class: 'ts-total' },
          h('td', null, ''), h('td', null, 'TOTAL'), h('td', null, ''),
          h('td', { class: 'num' }, totalPlays), h('td', null, records + ' records'),
          h('td', { class: 'num' }, (totalPlays * 0.4).toFixed(1))) : null));

    view.replaceChildren(
      h('div', { class: 'stats-wrap' },
        h('div', { class: 'gamehead' },
          h('a', { class: 'back', href: '#' }, '◀ shelf'),
          h('h2', { class: 'gtitle' }, h('span', { class: 'ge', html: Icons.svg('sheet', 24) }), 'Timesheet')),
        h('div', { class: 'ts-rating panel' },
          h('h4', null, 'Overall performance rating'),
          h('div', { class: 'ts-tier' }, tier[1]),
          h('div', { class: 'meter' }, h('i', { style: { width: pct + '%' } })),
          h('p', null, next ? (pct + '% of the way to ' + next[1] + '.') : 'Top of the ladder. Nowhere left to be promoted.'),
          h('button', { class: 'btn tiny', type: 'button', onclick: printCertificate, style: { marginTop: '8px' } }, 'Print certificate')),
        badges.length ? h('div', { class: 'ts-badges' }, badges.map((b) => h('span', { class: 'ts-badge', title: b.desc }, b.name))) : null,
        rows.length ? table
          : h('p', { class: 'empty' }, 'No sessions logged yet. Go play something — this page fills itself in, and doubles as a convincing timesheet.')));
    applyDocTitle();
  }

  /* ---------------- how-to demo animations ----------------
     Maps each game to a control scheme (drawn by Engine.tutorial) and a
     one-line goal. Schemes: arrows, wasd, leftright, space, click, aim, tap,
     type, drag. A game may override by setting its own `tut` in register(). */
  const TUT = {
    '2048': ['arrows', 'Slide the board — equal numbers merge and double.'],
    asteroids: ['arrows', 'Rotate and thrust to fly; space fires. Clear the rocks.'],
    atc: ['click', 'Click a plane, then click where it should go.'],
    battleship: ['aim', 'Click the grid to fire on the hidden fleet.'],
    blackjack: ['click', 'Hit or stand — get closer to 21 than the dealer.'],
    bubblewrap: ['aim', 'Aim and fire to pop three or more of a colour.'],
    c1: ['click', 'Click to earn, then buy things that click for you.'],
    checkers: ['click', 'Click a piece, then a dark square to move or jump.'],
    climb: ['leftright', 'Steer left and right — you bounce upward on your own.'],
    coal: ['click', 'Trim supply with the controls to hold the grid steady.'],
    commute: ['arrows', 'Cross the road and rails without getting clipped.'],
    connect4: ['click', 'Drop a disc into a column; line up four.'],
    copycat: ['click', 'Watch the sequence light up, then repeat it.'],
    deskgolf: ['drag', 'Drag back to aim and set power, release to putt.'],
    desktoss: ['drag', 'Drag to aim, release to lob it into the bin.'],
    elevator: ['click', 'Send the lifts to the floors that are waiting.'],
    fifteen: ['click', 'Click a tile beside the gap to slide it in.'],
    firedrill: ['click', 'Set the density, then watch it catch and spread.'],
    flap: ['space', 'Tap or press space to flap through the gaps.'],
    flood: ['click', 'Pick a colour to flood the board to a single shade.'],
    frost: ['click', 'Drop seeds and watch the frost branch out.'],
    hoops: ['wasd', 'A/D to move, W to jump — or the arrow keys for player two.'],
    intern: ['click', 'Click for coffee, then hire interns to pour it faster.'],
    invaders: ['arrows', 'Slide left and right, space to fire on the fleet.'],
    ising: ['click', 'Nudge the temperature and watch the spins flip.'],
    jam: ['drag', 'Slide the blocking cars aside to free the red one.'],
    kuramoto: ['click', 'Turn up the coupling and watch them fall in sync.'],
    life: ['drag', 'Paint some cells, press play, and watch them evolve.'],
    lightsout: ['click', 'Click a light — it flips its neighbours too. Clear them all.'],
    logistic: ['click', 'Drag the rate and watch order tip into chaos.'],
    mastermind: ['click', 'Guess the code; the pegs tell you how close you are.'],
    match3: ['drag', 'Swap two gems to line up three or more.'],
    maze: ['arrows', 'Steer through the maze to the exit.'],
    memory: ['click', 'Flip two cards to find the matching pairs.'],
    minesweeper: ['click', 'Click to clear a square, flag the ones you suspect.'],
    mitosis: ['drag', 'Paint a seed and watch the pattern grow and split.'],
    nonogram: ['click', 'Fill squares using the number clues on each line.'],
    noughts: ['click', 'Take a square — first to three in a row wins.'],
    obby: ['arrows', 'Run with left and right, jump the gaps and hazards.'],
    pipes: ['click', 'Click to rotate pipes until every node is connected.'],
    pong: ['arrows', 'Move your paddle up and down to return the ball.'],
    powder: ['drag', 'Pick a material and draw it into the tray.'],
    racer: ['arrows', 'Hold gas, steer through the traffic, reach the finish.'],
    rave: ['tap', 'Tap anywhere — or hit Esc — to make it stop.'],
    reflex: ['tap', 'Wait for green, then tap as fast as you can.'],
    reversi: ['click', 'Place a disc to flip the trapped line to your colour.'],
    sandpile: ['click', 'Drop grains and set off the avalanches.'],
    schelling: ['click', 'Set the tolerance and watch the neighbourhood sort.'],
    sir: ['click', 'Set the infection rate and watch it sweep through.'],
    smart: ['click', 'Toggle the lights to keep the cars moving.'],
    snake: ['arrows', 'Steer into the food; don’t hit a wall or your tail.'],
    sokoban: ['arrows', 'Push every crate onto a target square.'],
    solitaire: ['drag', 'Drag cards to build the piles down by alternating colour.'],
    soundboard: ['tap', 'Tap a pad to fire off the sound.'],
    spamfilter: ['click', 'Place filters along the path to stop the wave.'],
    stack: ['space', 'Tap to drop each block as close to centred as you can.'],
    sudoku: ['click', 'Fill the grid so every row, column and box has 1–9.'],
    tetris: ['arrows', 'Move and rotate the falling pieces; clear full lines.'],
    traffic: ['click', 'Set the density and watch a jam appear from nothing.'],
    turf: ['click', 'Seed the field and watch the three colours spiral.'],
    typing: ['type', 'Type each word before it scrolls away.'],
    vicsek: ['click', 'Turn down the noise and watch the flock align.'],
    videopoker: ['click', 'Hold the cards you want, draw to replace the rest.'],
    whack: ['tap', 'Whack each meeting the moment it pops up.'],
    wide: ['leftright', 'Slide the paddle to keep the ball in play.'],
    wordguess: ['type', 'Type a five-letter guess; the colours score each letter.'],
    wordsearch: ['drag', 'Drag across the hidden words to circle them.'],
    workbook: ['click', 'Click to reveal a cell, flag the mines you deduce.']
  };
  function tutSpec(g) {
    if (g.tut) return g.tut;                 // a game can ship its own
    const m = TUT[g.id];
    if (m) return { scheme: m[0], goal: m[1] };
    /* sensible default from category when unmapped */
    const byCat = { action: 'arrows', sim: 'click', puzzle: 'click', brain: 'click', goof: 'click', goofy: 'tap' };
    return { scheme: byCat[g.cat] || 'click', goal: '' };
  }

  /* ---------------- game screen ---------------- */
  function renderGame(g, daily) {
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

    /* how-to panel with an animated controls demo up top; the demo only runs
       while the panel is open, and is torn down with the game */
    const howList = h('ul', null, g.how.map((s) => h('li', null, s)));
    const howBody = h('div', { class: 'how-body' }, howList);
    let tut = null;
    try {
      if (Engine.tutorial) { tut = Engine.tutorial(tutSpec(g)); howBody.insertBefore(tut.el, howBody.firstChild); }
    } catch (e) { tut = null; }
    const howto = h('details', { class: 'howto' },
      h('summary', null, 'How to play'), howBody);
    if (tut) howto.addEventListener('toggle', () => { if (howto.open) tut.start(); else tut.halt(); });

    view.replaceChildren(
      h('div', { class: 'gamehead' },
        h('a', { class: 'back', href: '#' }, '◀ shelf'),
        h('h2', { class: 'gtitle' }, h('span', { class: 'ge', html: Icons.svg(g.emoji, 24) }), g.title),
        g.link ? h('a', { class: 'back rel-link', href: g.link.url, target: '_blank', rel: 'noopener' }, g.link.label + ' \u2197') : null,
        DAILY_POOL.indexOf(g.id) >= 0 ? h('a', { class: 'back share-board', href: '#', title: 'Copy a link that opens this exact board for a coworker', onclick: (e) => { e.preventDefault(); shareBoard(g.id); } }, 'share a board \u2197') : null,
        h('div', { class: 'gmeta' },
          h('span', { class: 'pill diff-tag d-' + Arcade.diff().id }, Arcade.diff().label),
          daily ? h('span', { class: 'pill daily-tag', title: 'Everyone gets this exact board today' }, 'DAILY ' + daily) : null,
          bestEl),
        howto),
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

    currentDispose = () => { if (typeof dispose === 'function') dispose(); if (tut) tut.halt(); };
    currentGame = g;
    applyDocTitle();
  }

  /* ---------------- router ---------------- */
  /* ---------------- Daily challenge (same seeded board for everyone) ---------------- */
  const DAILY_POOL = ['minesweeper', '2048', 'fifteen', 'flood', 'jam', 'sokoban', 'pipes', 'maze', 'sudoku', 'lightsout', 'nonogram', 'wordguess', 'match3', 'workbook', 'wordsearch'];
  let restoreRandom = null;
  function installSeed(s) { const orig = Math.random; Math.random = Engine.rng(s); return () => { Math.random = orig; }; }
  function todayStamp() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dailyPick(ds) { const pool = DAILY_POOL.filter((id) => byId.has(id)); const r = Engine.rng('pick:' + ds); return pool[Math.floor(r() * pool.length)] || pool[0]; }
  Arcade.daily = function () { const ds = todayStamp(); location.hash = '#daily/' + dailyPick(ds) + '/' + encodeURIComponent(ds); };
  /* share ANY seedable game's board: mints a fresh seed, copies a link, and
     loads it so you play exactly what you shared. Date.now, not Math.random, so
     it still works while a seeded Daily has Math.random overridden. */
  function shareBoard(id) {
    const seed = Date.now().toString(36);
    const url = location.origin + location.pathname + location.search + '#daily/' + id + '/' + seed;
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).catch(function () { }); } catch (e) { /* ignore */ }
    location.hash = '#daily/' + id + '/' + seed;
  }

  function route() {
    /* restore real Math.random if we're leaving a seeded Daily */
    if (restoreRandom) { try { restoreRandom(); } catch (e) { /* ignore */ } restoreRandom = null; }
    if (currentDispose) { try { currentDispose(); } catch (e) { console.error(e); } }
    currentDispose = null;
    currentGame = null;
    Engine.paused = bossOn || document.hidden;
    const dmatch = /^#daily\/([\w-]+)\/(.+)$/.exec(location.hash || '');
    const m = /^#g\/([\w-]+)/.exec(location.hash || '');
    let g = null, daily = null;
    if (dmatch && byId.get(dmatch[1])) { g = byId.get(dmatch[1]); daily = decodeURIComponent(dmatch[2]); }
    else if (m) g = byId.get(m[1]);
    document.body.classList.toggle('in-game', !!g);
    if (g) {
      if (daily) restoreRandom = installSeed('daily:' + daily + ':' + g.id);
      const recent = store.get('recent', []).filter((x) => x !== g.id);
      recent.unshift(g.id);
      store.set('recent', recent.slice(0, 8));
      renderGame(g, daily);
    } else if ((location.hash || '') === '#stats') {
      if (bigOn) setBig(false);
      renderStats();
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
    if (store.get('crt', false)) document.body.classList.add('crt');
    if (store.get('colorsafe', false)) document.body.classList.add('colorsafe');
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
      /* the panic key works from ANYWHERE — even mid-typing in a text box — so you
         are never one stuck keystroke away from hiding (or unhiding) the games */
      if (e.key === '`' || (e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        if (typing && t.blur) t.blur();
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

    /* opt-in quick-hide: clicking to another window snaps to the disguise */
    addEventListener('blur', () => {
      if (store.get('autohide', false) && !bossOn) toggleBoss(true);
    });

    route();
  };
})(window);
