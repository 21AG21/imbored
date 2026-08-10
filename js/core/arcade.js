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
  /* In-memory only. Nothing is written to localStorage, cookies, or any other
     browser store — close the tab and everything is forgotten. Scores and
     settings live for the session; the footer's Back up button lets you save
     them to a file yourself if you want to keep them. */
  const mem = (window.__cubicleMem = window.__cubicleMem || {});
  const store = {
    get(k, d) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : d; },
    set(k, v) { mem[k] = v; }
  };

  /* ---------------- difficulty dial ----------------
     Every game multiplies its own knobs by Arcade.dm(): spawn rates, speeds,
     patience, board sizes, lives. One dial, sixteen different flavours of pain. */
  const DIFFS = [
    { id: 'chill', label: 'CHILL', m: 0.6, note: 'Slower and more forgiving.' },
    { id: 'normal', label: 'NORMAL', m: 1, note: 'The intended balance.' },
    { id: 'hard', label: 'HARD', m: 1.8, note: 'Faster and stingier.' },
    { id: 'nightmare', label: 'NIGHTMARE', m: 2.6, note: 'Unreasonable. Have fun.' }
  ];
  let diffIdx = 1;

  let currentDispose = null;
  let currentGame = null;
  let bossOn = false;

  /* ---------------- stay-awake guard ----------------
     A manager glancing over at a suddenly-dimmed "spreadsheet" screen is
     exactly the moment the disguise most needs to hold up. Request a wake
     lock for as long as a game or a panic-screen disguise is on screen;
     release it the instant neither is. Feature-detected — silently a no-op
     everywhere the API doesn't exist, and any denial (permissions, an
     unsupported context) is swallowed the same way. */
  let wakeLock = null;
  async function syncWakeLock() {
    const want = (!!currentGame || bossOn) && !document.hidden;
    if (!('wakeLock' in navigator)) return;
    if (want && !wakeLock) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } catch (e) { /* denied, or called from a context that can't hold one — leave it be */ }
    } else if (!want && wakeLock) {
      try { wakeLock.release(); } catch (e) { /* already gone */ }
      wakeLock = null;
    }
  }
  let bigOn = false;
  /* disguise mode: dress the whole app (home AND games) as plain documents, so
     from across the room it reads as paperwork. Default on; the normal arcade
     game UI is one toggle away. */
  let docModeOn = true;
  /* disguise figure brightness: how far the luminance flip floods a game's
     playfield toward white. 50% is the tuned default (brightness 1.35 on the
     inverted stages); the in-figure slider only shows in document mode. */
  let figBrightPct = store.get('figbright', 50);
  function applyFigBright() {
    const pct = Engine.clamp(figBrightPct, 0, 100);
    const b = 1.0 + (pct / 100) * 0.7;            // 0% -> 1.0, 50% -> 1.35, 100% -> 1.70
    const el = document.documentElement;
    el.style.setProperty('--doc-fig-bright', b.toFixed(3));
    el.style.setProperty('--doc-fig-bright-lb', Math.max(1, b - 0.23).toFixed(3));  // light boards run a touch dimmer
  }
  /* The site's display name. Editable straight from the top bar (click it and
     type); defaults to a forgettable "Docs" so a glance at the header or the
     browser tab gives nothing away. Drives both the brand and the tab title. */
  function brandName() { return store.get('brand', 'Docs'); }
  function applyDocTitle() {
    /* keep the neutral document name in the tab at all times (except inside the
       panic screen, which sets its own believable title) — a tab that reads
       "TETRIS - Docs" while you are "working" gives the whole thing away */
    document.title = bossOn ? Boss.title() : brandName();
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
    /* "plays" is a SESSION count ("N sessions on the clock" per the stats
       page), incremented once per mount in renderGame() — deliberately
       independent of submit(), which some open-ended sims (frost, life,
       kuramoto...) call many times a second to track a live-updating peak.
       Coupling the two used to credit one sitting of an idle sim as
       thousands of "plays". */
    submit(id, value) {
      const g = byId.get(id);
      const prev = store.get('best:' + id, null);
      const better = prev == null || (g && g.lowerIsBetter ? value < prev : value > prev);
      if (better) store.set('best:' + id, value);
      return { best: better ? value : prev, isRecord: better && prev != null, isFirst: prev == null };
    },
    countPlay(id) { store.set('plays:' + id, store.get('plays:' + id, 0) + 1); },
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
    },
    docMode() { return docModeOn; },
    setDocMode(on) {
      docModeOn = on == null ? !docModeOn : !!on;
      store.set('docmode', docModeOn);
      applyDocMode();
    },
    figBright() { return figBrightPct; },
    setFigBright(pct) {
      figBrightPct = Engine.clamp(Math.round(pct), 0, 100);
      store.set('figbright', figBrightPct);
      applyFigBright();
    }
  };
  global.Arcade = Arcade;

  /* toggle the whole-app document disguise. Pure CSS via a body class, so it
     flips live with no re-render; the two toggle controls resync their labels. */
  const docBtnSyncers = [];
  function applyDocMode() {
    document.body.classList.toggle('docmode', docModeOn);
    const hash = location.hash || '';
    const onHub = !currentGame && hash !== '#stats' && !/^#(g|daily)\//.test(hash);
    /* the home is a document only in disguise mode; keep the flag in sync */
    document.body.classList.toggle('home-doc', onHub && docModeOn);
    docBtnSyncers.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
    applyDocTitle();
    if (currentGame) { try { global.dispatchEvent(new Event('resize')); } catch (e) { /* ignore */ } fitStageSoon(); }   // re-fit for the new layout
    else if (onHub) renderHub();   // repaint the home in the newly-selected style
  }

  /* ---------------- big screen ---------------- */
  /* Canvas games grow via CSS (the .gcanvas max-width rule). The ~14 DOM-board
     games are fixed-pixel grids, so in big-screen mode they were left stranded
     at ~330px on an empty page. Scale the whole board to fill the freed space —
     transform keeps every cell's hit area mapped, so they stay clickable. */
  function fitStage() {
    const view = document.getElementById('view');
    const stage = view && view.querySelector('.stage');
    if (!stage) return;
    stage.style.transform = '';
    stage.style.transformOrigin = '';
    stage.style.zoom = '';
    if (stage.querySelector('canvas')) return;   // canvas games size themselves
    const docm = document.body.classList.contains('docmode') && !bigOn;
    const rect = stage.getBoundingClientRect();
    /* the stage is full-width but its board is a narrow centred child, so size to
       the widest real child, not the stage's own width */
    let natW = 0;
    for (const c of stage.children) { const r = c.getBoundingClientRect(); if (r.height > 4) natW = Math.max(natW, r.width); }
    const natH = stage.scrollHeight;
    if (!natW || !natH) return;
    if (docm) {
      /* document-embed: grow the board to fill the text column like a full-width
         table/figure, using zoom (not transform) so the page REFLOWS and the
         report prose flows below it instead of being overlapped. Height-capped. */
      const availW = stage.clientWidth - 8;
      const capH = global.innerHeight * 0.72;
      let z = Math.min(availW / natW, capH / natH);
      z = Math.max(1, Math.min(z, 2.2));
      if (z > 1.02) stage.style.zoom = z.toFixed(3);
      return;
    }
    /* Bound growth to the space the board actually has: down to the bottom of
       #view (which is exactly where the footer starts, so the scaled board never
       collides with it) in normal mode, or the whole viewport in big-screen. */
    const vBottom = bigOn ? global.innerHeight - 8 : view.getBoundingClientRect().bottom - 6;
    const availH = vBottom - rect.top;
    const availW = view.clientWidth - 8;
    if (availH < 40 || availW < 40) return;
    const scale = Math.min(availW / natW, availH / natH);
    const cap = bigOn ? 3.2 : 2.6;
    if (scale > 1.04) {
      stage.style.transformOrigin = 'top center';
      stage.style.transform = 'scale(' + Math.min(scale, cap).toFixed(3) + ')';
    }
  }
  Arcade.fitBig = fitStage;
  function fitStageSoon() { requestAnimationFrame(fitStage); setTimeout(fitStage, 90); setTimeout(fitStage, 260); }
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
    fitStageSoon();
  }
  global.addEventListener('resize', () => fitStage());
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
        h('span', null, 'Colour-safe symbols')),
      h('label', { class: 'theme-crt' },
        h('input', {
          type: 'checkbox', checked: store.get('saver', false) ? true : null,
          onchange: (e) => { if (global.Gags) global.Gags.screensaver.set(e.target.checked); }
        }),
        h('span', null, 'Screensaver when idle')),
      h('label', { class: 'theme-crt' },
        h('input', {
          type: 'checkbox', checked: store.get('office', false) ? true : null,
          onchange: (e) => { if (global.Gags) global.Gags.officeAlerts.set(e.target.checked); }
        }),
        h('span', null, 'Fake meeting alerts')));

    function paintSwatches() {
      swatches.replaceChildren();
      for (const t of Themes.list()) {
        const btn = h('button', {
          class: 'theme-swatch' + (Themes.current() === t.id ? ' on' : ''),
          type: 'button', title: t.name,
          onclick: () => { Themes.set(t.id); paintSwatches(); }
        }, h('span', { class: 'theme-name' }, t.name));
        /* preview chip built from that theme's own tokens */
        const sw = Themes.swatch(t.id);
        btn.style.setProperty('--sw-bg', sw[0]);
        btn.style.setProperty('--sw-ac', sw[1]);
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

    /* the disguise toggle: normal arcade chrome is always one click away */
    const docBtn = h('button', { class: 'btn docmode-btn', type: 'button' });
    const syncDocBtn = () => {
      docBtn.textContent = docModeOn ? 'View: Documents' : 'View: Arcade';
      docBtn.title = docModeOn
        ? 'Games are disguised as documents. Click for the normal arcade view.'
        : 'Normal arcade view. Click to disguise everything as documents.';
    };
    docBtn.addEventListener('click', () => Arcade.setDocMode());
    docBtnSyncers.push(syncDocBtn);
    syncDocBtn();

    const bar = h('header', { class: 'topbar' },
      h('span', { class: 'brand' },
        h('a', { class: 'brand-mark', href: '#', title: 'Home', html: Icons.svg('dice', 19) }),
        brandText),
      h('div', { class: 'topbar-spacer' }),
      docBtn,
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

    /* which document the Doc disguise shows: shuffle, or a pinned essay/report/etc. */
    const docSel = h('select', {
      class: 'sel', 'aria-label': 'Which document the Doc disguise shows',
      onchange: () => { if (docSel.value === 'shuffle') Boss.setShuffle(); else Boss.setDoc(+docSel.value); }
    }, [h('option', { value: 'shuffle', selected: Boss.docMode() === 'shuffle' ? true : null }, 'Shuffle (random each time)')]
      .concat(Boss.docs().map((t, i) => h('option', { value: String(i), selected: Boss.docMode() === i ? true : null }, t))));
    const docRow = h('span', { class: 'foot-skin' }, h('strong', null, 'DOCUMENT:'), docSel);

    syncWebRow = () => {
      const isWeb = Boss.skinId() === 'web';
      webRow.style.display = isWeb ? '' : 'none';
      webHint.style.display = isWeb ? '' : 'none';
      docRow.style.display = Boss.skinId() === 'docs' ? '' : 'none';
      docSel.value = Boss.docMode() === 'shuffle' ? 'shuffle' : String(Boss.docMode());
      webHint.textContent = Boss.mode() === 'jump'
        ? 'Open the site: the key loads that address in this tab. Works with any website. Your scores are saved, so come back with the back button.'
        : 'Embed it: the key drops the site into a frame over the games, keeping your game paused underneath. Only works for sites that allow embedding, which most big ones do not.';
    };

    /* Nothing persists on its own — scores and settings live only in memory for
       this session. Back up writes them to a file you keep; Restore reads one
       back in. That is the only way anything survives a reload, and it is fully
       manual and local: nothing is stored in the browser and nothing leaves. */
    function exportSaves() {
      const blob = new Blob([JSON.stringify(mem, null, 1)], { type: 'application/json' });
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
            for (const k in data) {
              /* accept old backups too (keys were 'cubicle:'-prefixed and values
                 were JSON strings); normalise both to the in-memory shape */
              const key = k.indexOf('cubicle:') === 0 ? k.slice(8) : k;
              let val = data[k];
              if (typeof val === 'string') { try { val = JSON.parse(val); } catch (err2) { /* keep as string */ } }
              mem[key] = val; n++;
            }
            if (n) {
              if (window.Themes && Themes.apply) Themes.apply();
              renderHub();
              alert('Restored ' + n + ' saved item' + (n === 1 ? '' : 's') + '. (Nothing is stored in the browser — back up again before you close the tab to keep changes.)');
            } else alert('No arcade scores found in that file.');
          } catch (err) { alert('That file did not look like an arcade backup.'); }
        };
        rd.readAsText(f);
        e.target.value = '';
      }
    });

    /* Save the whole arcade as one self-contained file you can drop in Drive, on
       a USB stick, anywhere — and open offline any time. We clone the live page,
       strip the runtime-injected UI back to the pristine skeleton, then pull in
       every external asset the skeleton still points at (the stylesheet and each
       <script src>) and inline it, so the saved copy needs nothing else to run.

       This matters because the live site serves the MULTI-FILE build — the page
       still references js/core/*.js and css/arcade.css. Just cloning the DOM
       would hand back a file whose <script src> paths resolve to nothing once
       it is opened offline. Fetching each one (same origin, so it is allowed)
       and inlining it is what makes the download genuinely portable. On the
       single-file build there is nothing external left to fetch, so this same
       code path simply serialises the clone unchanged. */
    const escClose = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');   // don't let content close its own tag
    async function downloadSelf(btn) {
      const label = btn && btn.textContent;
      const setLabel = (t) => { if (btn) btn.textContent = t; };
      setLabel('Preparing…');
      try {
        const clone = document.documentElement.cloneNode(true);
        clone.removeAttribute('style');      // drop the theme vars stamped on <html>
        clone.removeAttribute('data-ui');
        clone.removeAttribute('data-dark');
        const titleEl = clone.querySelector('title'); if (titleEl) titleEl.textContent = 'Docs';
        clone.querySelectorAll('link[rel="manifest"]').forEach((n) => n.remove());   // external, useless offline
        const b = clone.querySelector('body');
        if (b) Array.prototype.slice.call(b.children).forEach((n) => {
          const tag = n.tagName ? n.tagName.toLowerCase() : '';
          if (tag !== 'script' && tag !== 'noscript') n.remove();   // everything else is rebuilt on load
        });

        /* Inline every external asset. We fetch via the LIVE document's nodes
           (their .href/.src are already resolved to absolute URLs) and swap the
           matching node in the clone for an inline <style>/<script>. */
        const jobs = [];
        const liveCss = Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"][href]'));
        const cloneCss = Array.prototype.slice.call(clone.querySelectorAll('link[rel="stylesheet"][href]'));
        liveCss.forEach((live, i) => {
          const target = cloneCss[i]; if (!target) return;
          jobs.push(fetch(live.href).then((r) => r.text()).then((css) => {
            const style = document.createElement('style');
            style.textContent = escClose(css);
            target.replaceWith(style);
          }));
        });
        const liveJs = Array.prototype.slice.call(document.querySelectorAll('script[src]'));
        const cloneJs = Array.prototype.slice.call(clone.querySelectorAll('script[src]'));
        liveJs.forEach((live, i) => {
          const target = cloneJs[i]; if (!target) return;
          jobs.push(fetch(live.src).then((r) => r.text()).then((js) => {
            const s = document.createElement('script');
            s.textContent = escClose(js);
            target.replaceWith(s);
          }));
        });
        if (jobs.length) { setLabel('Bundling ' + jobs.length + ' files…'); await Promise.all(jobs); }

        if (clone.querySelector('script[src], link[rel="stylesheet"][href]')) {
          throw new Error('external reference survived inlining');
        }
        const html = '<!doctype html>\n' + clone.outerHTML;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = h('a', { href: url, download: 'docs.html' });   // a discreet filename
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        setLabel('Saved ✓');
        setTimeout(() => setLabel(label || 'Download the whole arcade'), 2200);
      } catch (e) {
        setLabel(label || 'Download the whole arcade');
        alert('Could not build the offline copy — a file failed to load (' + (e && e.message ? e.message : e) + '). If you opened this straight from a file on disk rather than a web address, grab the ready-made single-file build (dist/cubicle-arcade.html) from the project instead.');
      }
    }

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
      docRow,
      h('span', { class: 'foot-skin' },
        h('strong', null, 'SCORES:'),
        h('button', { class: 'btn tiny', type: 'button', title: 'Save your scores and settings to a file on your computer — nothing is stored in the browser, so this is the only way to keep them', onclick: exportSaves }, 'Save to file'),
        h('button', { class: 'btn tiny', type: 'button', title: 'Load scores back from a file you saved earlier', onclick: () => importInput.click() }, 'Load from file'),
        h('a', { class: 'foot-link', href: '#stats' }, 'Your timesheet'),
        importInput),
      h('span', { class: 'foot-skin' },
        h('strong', null, 'PLAY OFFLINE:'),
        h('button', { class: 'btn tiny primary', type: 'button', title: 'Save the entire arcade as a single file you can reopen with no internet — drop it on a USB stick or in Drive and play anywhere', onclick: (e) => downloadSelf(e.currentTarget) }, 'Download the whole arcade'),
        h('span', { class: 'foot-privacy' }, 'one self-contained file — no internet needed to reopen it')),
      webRow,
      h('span', null,
        h('a', { class: 'foot-link', href: 'https://claude.ai/code/artifact/245d9555-fb6f-4685-b698-42a8f82c10bd', target: '_blank', rel: 'noopener' }, 'PHANTOM: why traffic jams happen for no reason')),
      h('span', null,
        h('kbd', null, '`'), ' look busy   ',
        h('kbd', null, '1'), ' jump to Docs   ',
        h('kbd', null, 'Shift'), '+', h('kbd', null, '`'), ' rave   ',
        h('kbd', null, '['), h('kbd', null, ']'), ' switch game   ',
        h('kbd', null, '−'), h('kbd', null, '='), ' difficulty   ',
        h('kbd', null, 'R'), ' restart   ',
        h('kbd', null, '\\'), ' big screen   ',
        h('kbd', null, '/'), ' search   ',
        h('kbd', null, 'Esc'), ' back'),
      h('span', { class: 'foot-privacy' },
        'No cookies. No accounts. No tracking. No storage of any kind — nothing is written to this browser and nothing you type ever leaves it. Close the tab and it forgets everything; use Back up to save your scores to a file yourself.'),
      webHint);
    syncWebRow();

    /* the document-style home screen (renderHub) reuses these from its own
       understated footer, since the topbar/footer are hidden there */
    Arcade._downloadSelf = downloadSelf;
    Arcade._syncSound = syncSound;
    Arcade._brandText = brandText;

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
    { id: 'bubblewrap', hook: 'Aim, fire, pop clusters of three. Keep the wall off the line.' },
    { id: 'life', hook: 'Draw a colony, drop a glider gun, watch it breathe.' },
    { id: 'turf', hook: 'Rock-paper-scissors that curls into living spirals.' },
    { id: 'logistic', hook: 'One knob turns calm into chaos, the classic road to it.' },
    { id: 'busywork', hook: 'File reports, hire interns, reorg. Forever.' },
    { id: 'connect4', hook: 'Beat the CPU, or a coworker by hotseat or code.' }
  ];

  /* one dry line of framing per section, so the index reads like a real
     internal catalogue rather than an arcade shelf */
  const CATMETA = {
    sim: 'Working models of systems that arrange themselves — traffic, crowds, epidemics, growth. Change the conditions and watch the behaviour emerge.',
    puzzle: 'Logic and spatial problems, solved at your own pace. No clock unless you go looking for one.',
    brain: 'Word, number, and strategy games. Several can be played against the computer, or a colleague at the same desk.',
    action: 'Timing and reflex exercises. Keyboard or touch, quick to pick up.',
    goof: 'Short diversions, novelties, and games of chance for a spare minute.'
  };
  const DOC_ORDER = ['sim', 'puzzle', 'brain', 'action', 'goof'];

  /* The home renders one of two ways: the plain professional document (disguise
     mode) or the original arcade shelf (normal mode). The View toggle flips
     between them, so there is always a way back to the normal home screen. */
  function renderHub() {
    if (docModeOn) renderHubDoc(); else renderHubArcade();
  }

  function renderHubArcade() {
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
          h('span', { class: 'card-best' }, 'opens in a new tab ↗')) : null),
      h('div', { class: 'ticker' }, h('span', null,
        '*** NOW WITH ' + games.length + ' GAMES ***' + TICKER.slice(2).join(''))));
    const gridEl = view.querySelector('.grid');
    if (gridEl) wireGridKeys(gridEl);
    applyDocTitle();
  }

  /* The disguise home: a plain, professional document. No cards, no buttons,
     no colour — every game is opened by clicking its title, the way you would
     follow a link in a report. The office disguise, but sincere. */
  function renderHubDoc() {
    const view = document.getElementById('view');
    if (!view) return;
    const n = games.length;

    /* the document title doubles as the site name and stays editable, kept in
       sync with the hidden topbar brand */
    const title = h('h1', {
      class: 'doc-title', contenteditable: 'true', spellcheck: 'false',
      title: 'Click to rename. Enter to save.', 'aria-label': 'Document title (editable)'
    }, brandName());
    const readTitle = () => title.textContent.replace(/\s+/g, ' ').trim();
    const commit = () => {
      const t = readTitle() || 'Docs';
      store.set('brand', t); applyDocTitle();
      if (Arcade._brandText && Arcade._brandText.textContent !== t) Arcade._brandText.textContent = t;
    };
    title.addEventListener('input', commit);
    title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });
    title.addEventListener('blur', () => { const t = readTitle() || 'Docs'; if (title.textContent !== t) title.textContent = t; commit(); });

    const masthead = h('header', { class: 'doc-masthead' },
      h('div', { class: 'doc-overline' }, 'Internal reference · For personal use only'),
      title,
      h('p', { class: 'doc-deck' },
        'An index of ' + n + ' interactive modules that run entirely inside this browser tab. ' +
        'Nothing installs, and nothing you do here ever leaves your machine. Open one by clicking its title.'),
      h('div', { class: 'doc-meta' },
        'Document 1-A · Revision 4.2 · ' + n + ' entries · Updated ' + todayStamp()));

    const usage = h('p', { class: 'doc-usage' },
      'Press ', h('kbd', null, 'Ctrl'), '+', h('kbd', null, 'F'), ' to jump to any title. Press ',
      h('kbd', null, '`'), ' to blank the screen to a plain document, and ',
      h('kbd', null, '−'), ' / ', h('kbd', null, '='), ' to set the challenge level.');

    const sections = DOC_ORDER.map((cat, idx) => {
      const listing = games.filter((g) => g.cat === cat);
      if (!listing.length) return null;
      const label = (CATS.find((c) => c.id === cat) || { label: cat }).label;
      const entries = listing.map((g) => {
        const best = Arcade.best(g.id);
        const note = best == null ? null
          : h('span', { class: 'doc-note' }, '  ' + (g.scoreLabel || 'best') + ' ' + (g.formatScore ? g.formatScore(best) : best));
        return h('p', { class: 'doc-entry' },
          h('a', { class: 'doc-open', href: '#g/' + g.id }, g.title),
          h('span', { class: 'doc-desc' }, ' ' + g.blurb),
          note);
      });
      return h('section', { class: 'doc-sec' },
        h('h2', { class: 'doc-h2' },
          h('span', { class: 'doc-num' }, String(idx + 1).padStart(2, '0')),
          h('span', { class: 'doc-h2-t' }, label),
          h('span', { class: 'doc-count' }, listing.length + ' entries')),
        h('p', { class: 'doc-lead' }, CATMETA[cat] || ''),
        h('div', { class: 'doc-list' }, entries));
    });

    /* discreet document-footer controls — styled as plain text links, so the
       page stays button-free while sound / appearance / offline copy / the log
       remain reachable without the topbar */
    const isDark = () => document.documentElement.getAttribute('data-dark') === '1';
    const apBtn = h('button', { class: 'doc-tool', type: 'button', title: 'Switch the page between light and dark' });
    const syncAp = () => { apBtn.textContent = 'Appearance: ' + (isDark() ? 'Dark' : 'Light'); };
    apBtn.addEventListener('click', () => { Themes.set(isDark() ? 'paper' : 'graphite'); syncAp(); });
    syncAp();

    const sndBtn = h('button', { class: 'doc-tool', type: 'button', title: 'Sound effects on or off' });
    const syncSnd = () => { sndBtn.textContent = 'Sound: ' + (Engine.audio.muted ? 'off' : 'on'); };
    sndBtn.addEventListener('click', () => {
      Engine.audio.muted = !Engine.audio.muted;
      store.set('muted', Engine.audio.muted);
      if (!Engine.audio.muted) Engine.audio.good();
      if (Arcade._syncSound) Arcade._syncSound();
      syncSnd();
    });
    syncSnd();

    const dlBtn = h('button', {
      class: 'doc-tool', type: 'button',
      title: 'Save the whole thing as one file you can reopen with no internet'
    }, 'Save an offline copy');
    dlBtn.addEventListener('click', () => { if (Arcade._downloadSelf) Arcade._downloadSelf(dlBtn); });

    const viewBtn = h('button', { class: 'doc-tool', type: 'button', title: 'Switch between the document disguise and the normal arcade home' },
      'Switch to the arcade view');
    viewBtn.addEventListener('click', () => Arcade.setDocMode(false));

    const sep = () => h('span', { class: 'doc-sep' }, '·');
    const tools = h('div', { class: 'doc-tools' },
      viewBtn, sep(), apBtn, sep(), sndBtn, sep(), dlBtn, sep(),
      h('a', { class: 'doc-tool', href: '#stats' }, 'Activity log'));

    const foot = h('footer', { class: 'doc-foot' },
      tools,
      h('p', { class: 'doc-fine' },
        'No account, no cookies, no tracking, no storage of any kind — scores live only in this tab and are forgotten when you close it. ' +
        'Use “Save an offline copy” to keep everything as one portable file.'));

    view.replaceChildren(h('article', { class: 'docpage' }, masthead, usage, sections, foot));
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

  /* Disguise-only "report" prose that wraps the game like a figure in a document.
     Shown only in docmode (CSS-hidden otherwise). Deliberately generic so it sits
     plausibly around any game; picked deterministically per game id so a given
     game always reads the same. The point is text DENSITY: a blurred page of text
     with a figure in the middle reads as a document, not a game on an empty page. */
  const PROSE = [
    'This section summarises the current position and the items still outstanding at the time of writing.',
    'The material below is provided for reference and reflects the most recent review by the working group.',
    'No significant changes were recorded since the previous update, and the working assumptions remain in place.',
    'Where figures are shown they should be read as provisional and are subject to the usual caveats.',
    'The approach follows the process agreed at the last checkpoint, with minor adjustments noted where relevant.',
    'Comments from the group have been folded in, and the remaining open questions are flagged for follow-up.',
    'Overall the picture is consistent with expectations, though a small number of cases warrant a closer look.',
    'A fuller breakdown is available on request; the summary here is intended to support a quick read before the review.',
    'The underlying detail has been checked against the source records and reconciled where discrepancies were found.',
    'These notes are circulated ahead of the meeting so that comments can be gathered and resolved in advance.',
    'Nothing here changes the headline conclusion, which is unchanged from the earlier draft shared last week.',
    'The next steps are listed at the end, with an owner and a rough timing recorded against each item.'
  ];
  const FIGCAPS = [
    'Figure 1. Current-state overview, captured for this review.',
    'Figure 1. Summary layout for the period under review.',
    'Figure 1. Reference view, as referred to in the notes above.',
    'Table 1. Working figures — provisional and subject to revision.',
    'Figure 1. Snapshot circulated for comment ahead of the meeting.'
  ];
  function hashId(s) { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = (x * 16777619) >>> 0; } return x; }
  function docProse(g) {
    const seed = hashId(g.id || 'x');
    const P = (k) => PROSE[(seed >>> (k * 4)) % PROSE.length];   // unsigned shift — signed >> can go negative -> undefined
    const intro = h('div', { class: 'doc-prose doc-intro' },
      h('p', null, P(0)),
      h('p', null, P(1) + ' ' + P(2)));
    const after = h('div', { class: 'doc-prose doc-after' },
      h('p', { class: 'doc-figcap' }, FIGCAPS[seed % FIGCAPS.length]),
      h('p', null, P(3) + ' ' + P(4)),
      h('p', null, P(5)));
    return { intro, after };
  }

  /* ---------------- game screen ---------------- */
  function renderGame(g, daily) {
    const view = document.getElementById('view');
    /* games whose board is already light shouldn't get the disguise luminance
       flip (it would darken them and make them stand out) */
    const stage = h('div', { class: 'stage' + (g.lightBoard ? ' no-doc-invert' : '') });
    const statusEl = h('div', { class: 'status', role: 'status', 'aria-live': 'polite' });
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

    /* document-mode only: a slider to tune how far the figure is washed toward
       white. Sits under the "figure" like a quiet caption control. */
    const figSlider = h('input', {
      class: 'fig-bright', type: 'range', min: '0', max: '100', step: '1',
      value: String(Arcade.figBright()), 'aria-label': 'Figure brightness',
      oninput: () => Arcade.setFigBright(+figSlider.value)
    });
    const figBar = h('div', { class: 'figbar' },
      h('span', { class: 'figbar-cap' }, 'Figure exposure'),
      figSlider);

    /* how-to panel: the game's written instructions. */
    const howList = h('ul', null, g.how.map((s) => h('li', null, s)));
    const howBody = h('div', { class: 'how-body' }, howList);
    const howto = h('details', { class: 'howto' },
      h('summary', null, 'How to play'), howBody);

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
        h('p', { class: 'game-cap' }, g.blurb),   // reads as a document caption in disguise mode; hidden otherwise
        howto),
      docProse(g).intro,                          // disguise-only report prose around the "figure"
      toolbar, statusEl, stage, figBar,
      docProse(g).after);

    stage.appendChild(h('div', { class: 'rotate-nudge' },
      'Built wide. Turn the phone sideways or tap expand to fill the screen.'));

    let dispose = null;
    try {
      dispose = g.mount(stage, api);
      Arcade.countPlay(g.id);
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

    /* Scale a DOM board up to fill the screen, and keep it filled as its content
       changes size (cards dealt, board resized). Canvas games size themselves. */
    let ro = null;
    try {
      if (global.ResizeObserver && !stage.querySelector('canvas')) {
        ro = new global.ResizeObserver(() => fitStage());
        ro.observe(stage);
      }
    } catch (e) { ro = null; }

    currentDispose = () => {
      if (ro) { try { ro.disconnect(); } catch (e) { /* ignore */ } ro = null; }
      if (typeof dispose === 'function') dispose();
    };
    currentGame = g;
    applyDocTitle();
    fitStageSoon();
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
    if (g) document.body.dataset.game = g.id; else delete document.body.dataset.game;
    /* the hub renders as a plain document ONLY in disguise mode; in normal mode
       it is the arcade shelf, so the document chrome must not apply */
    document.body.classList.toggle('home-doc', !g && (location.hash || '') !== '#stats' && docModeOn);
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
    syncWakeLock();
  }

  /* ---------------- panic screen ---------------- */
  function toggleBoss(force) {
    bossOn = Boss.toggle(force);
    Engine.paused = bossOn || document.hidden;
    applyDocTitle();
    syncWakeLock();
  }

  Arcade.toggleBoss = toggleBoss;

  /* ---------------- boot ---------------- */
  Arcade.start = function start() {
    games.sort((a, b) => (a.order || 50) - (b.order || 50));
    if (store.get('crt', false)) document.body.classList.add('crt');
    if (store.get('colorsafe', false)) document.body.classList.add('colorsafe');
    docModeOn = store.get('docmode', true);
    applyFigBright();
    buildChrome();
    applyDocMode();
    document.body.appendChild(Boss.build());
    buildChomps();
    if (global.Gags) global.Gags.init();

    addEventListener('hashchange', route);
    addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && bigOn) setBig(false);
    });

    addEventListener('keydown', (e) => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      /* the panic key works from ANYWHERE — even mid-typing in a text box — so you
         are never one stuck keystroke away from hiding (or unhiding) the games */
      /* match the physical key (e.code) too: inside a text field, backtick is a
         dead key on many layouts (UK, US-International, German, French...) so
         e.key comes through as 'Dead' and the character check alone would miss */
      if (((e.key === '`' || e.code === 'Backquote') && !e.shiftKey) || (e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'b')) {
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
      /* difficulty on the keyboard: - eases it, = (or +) cranks it. Non-letter,
         non-digit keys, so they never collide with any game's own controls. */
      if (e.key === '-' || e.key === '_' || e.code === 'Minus') {
        e.preventDefault();
        if (diffIdx > 0) { Engine.audio.blip(280 + (diffIdx - 1) * 150); Arcade.setDiff(diffIdx - 1); }
        return;
      }
      if (e.key === '=' || e.key === '+' || e.code === 'Equal') {
        e.preventDefault();
        if (diffIdx < DIFFS.length - 1) { Engine.audio.blip(280 + (diffIdx + 1) * 150); Arcade.setDiff(diffIdx + 1); }
        return;
      }
      /* the anti-panic key: Shift+backtick (~) detonates Rave Mode from anywhere
         — the loud opposite of the quiet panic key right next to it. Match the
         physical key too, for dead-key layouts where the tilde never arrives. */
      if (e.key === '~' || (e.shiftKey && e.code === 'Backquote')) { e.preventDefault(); Arcade.go('rave'); return; }
      /* the 1 key: a one-press jump straight into the Docs disguise — not a
         toggle, always the document, wherever you are. It steps aside for the
         few games that actually use number keys (they set usesDigits), matching
         "the 1 key if it's not being used". */
      if (e.key === '1' && !e.ctrlKey && !e.metaKey && !e.altKey && (!currentGame || !currentGame.usesDigits)) {
        e.preventDefault();
        if (Boss.setSkin) Boss.setSkin('docs');
        if (!bossOn) toggleBoss(true);
        return;
      }
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
      /* a wake lock auto-releases the instant the tab is hidden, per spec —
         this is what re-acquires it once the tab is visible again */
      syncWakeLock();
    });

    /* opt-in quick-hide: clicking to another window snaps to the disguise */
    addEventListener('blur', () => {
      if (store.get('autohide', false) && !bossOn) toggleBoss(true);
    });

    route();
  };
})(window);
