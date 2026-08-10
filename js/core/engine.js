/* Cubicle Arcade shared engine helpers.
   Plain old script (no modules) so the site works from file:// as well as a server. */
(function (global) {
  'use strict';

  /* ---------- math / misc ---------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  const fmtTime = (s) => {
    s = Math.max(0, Math.floor(s));
    const m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  };

  /* ---------- tiny DOM builder ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs && (typeof attrs !== 'object' || attrs.nodeType)) { kids.unshift(attrs); attrs = null; }
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'data' && typeof v === 'object') Object.assign(el.dataset, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(9)) {
      if (kid == null || kid === false || kid === '') continue;
      el.appendChild(kid && kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  /* ---------- disposer bag ---------- */
  function bag() {
    const fns = [];
    return {
      add(fn) { if (fn) fns.push(fn); return fn; },
      listen(target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        fns.push(() => target.removeEventListener(type, fn, opts));
        return fn;
      },
      timer(fn, ms) { const id = setInterval(fn, ms); fns.push(() => clearInterval(id)); return id; },
      dispose() { fns.splice(0).reverse().forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }
    };
  }

  /* ---------- canvas ---------- */
  function canvas(parent, w, hh, opts) {
    opts = opts || {};
    const c = document.createElement('canvas');
    c.className = 'gcanvas' + (opts.class ? ' ' + opts.class : '');
    const ctx = c.getContext('2d');
    const dpr = clamp(global.devicePixelRatio || 1, 1, 2);
    c.width = Math.round(w * dpr);
    c.height = Math.round(hh * dpr);
    c.style.aspectRatio = w + ' / ' + hh;
    /* big-screen mode reads these to grow the canvas to the viewport */
    c.style.setProperty('--gw', w + 'px');
    c.style.setProperty('--ar', String(w / hh));
    c.style.maxWidth = 'var(--gw)';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    parent.appendChild(c);

    /* Fit the playfield to the space actually available so a canvas game fills
       most of the screen instead of floating tiny in the middle of it. Sizes to
       the largest box that fits both the free width AND the free height (aspect
       ratio derives the other dimension, so it never distorts), leaving room for
       any control pad or panel sitting below the canvas in the same container.
       Grows past the intrinsic size on roomy screens and shrinks on cramped
       ones. Self-removes when detached. */
    function fitCanvas() {
      if (!c.isConnected) { cleanup(); return; }
      if (document.body.classList.contains('bigscreen')) { c.style.maxWidth = 'var(--gw)'; return; }
      /* disguise mode: the canvas is an embedded FIGURE in a document, not the
         whole show. Size it to the text column, capped to a portion of the
         viewport height, so report prose can flow above and below it without the
         canvas chasing the viewport bottom and overlapping that prose. */
      if (document.body.classList.contains('docmode')) {
        const parentW = (c.parentElement && c.parentElement.clientWidth) || c.getBoundingClientRect().width;
        const capH = ((global.visualViewport && global.visualViewport.height) || global.innerHeight) * 0.72;
        c.style.maxWidth = Math.round(Math.min(parentW, capH * w / hh)) + 'px';
        return;
      }
      const vpH = (global.visualViewport && global.visualViewport.height) || global.innerHeight;
      const cr = c.getBoundingClientRect();
      /* overhang = pixels from the canvas bottom down to the lowest thing below
         it (a control pad, panels), gaps and margins included. Independent of the
         canvas size, so resizing the canvas leaves exactly that much room. */
      let lowest = cr.bottom;
      for (let sib = c.nextElementSibling; sib; sib = sib.nextElementSibling) {
        const rb = sib.getBoundingClientRect().bottom;
        if (rb > lowest) lowest = rb;
      }
      const overhang = lowest - cr.bottom;
      const availH = Math.max(140, vpH - cr.top - overhang - 12);
      const parentW = (c.parentElement && c.parentElement.clientWidth) || cr.width;
      const availW = Math.max(140, parentW);
      /* largest width that respects both the free height (via aspect ratio) and
         the free width — no intrinsic-size ceiling, so it upscales to fill */
      c.style.maxWidth = Math.round(Math.min(availW, availH * w / hh)) + 'px';
    }
    let cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      global.removeEventListener('resize', fitCanvas);
      if (global.visualViewport) global.visualViewport.removeEventListener('resize', fitCanvas);
      if (mo) mo.disconnect();
    }
    global.addEventListener('resize', fitCanvas);
    if (global.visualViewport) global.visualViewport.addEventListener('resize', fitCanvas);
    requestAnimationFrame(fitCanvas);
    setTimeout(fitCanvas, 80);   // second pass once pads/panels have laid out
    /* the fitCanvas() call above only self-removes the NEXT time a resize
       event happens to fire after the canvas is already detached — on a
       desktop session where the window is never resized, that never
       happens, so the listener (and everything it closes over: this canvas,
       its parent chain) leaked for the rest of the page's life. A game
       switch replaces #view's children synchronously, so watch for that and
       clean up the instant it happens instead of waiting on a maybe-never
       event. */
    const viewEl = document.getElementById('view');
    const mo = viewEl && global.MutationObserver
      ? new MutationObserver(() => { if (!c.isConnected) cleanup(); })
      : null;
    if (mo) mo.observe(viewEl, { childList: true, subtree: true });

    return {
      fit: fitCanvas,
      dispose: cleanup,
      el: c, ctx, w, h: hh,
      pos(ev) {
        const r = c.getBoundingClientRect();
        const p = ev.touches && ev.touches.length ? ev.touches[0]
          : (ev.changedTouches && ev.changedTouches.length ? ev.changedTouches[0] : ev);
        return { x: (p.clientX - r.left) * w / r.width, y: (p.clientY - r.top) * hh / r.height };
      },
      clear(fill) {
        if (fill) { ctx.fillStyle = fill; ctx.fillRect(0, 0, w, hh); }
        else ctx.clearRect(0, 0, w, hh);
      }
    };
  }

  function roundRect(ctx, x, y, w, hh, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(hh) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + hh, r);
    ctx.arcTo(x + w, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const Engine = {
    paused: false,
    clamp, lerp, rand, randInt, pick, shuffle, fmtTime, h, bag, canvas, roundRect
  };

  /* ---------- doc-mode canvas colours ----------
     Canvas games can't rely on the disguise's blanket invert()/grayscale()
     filter to turn their native palette white — that only works for sources
     dark enough to invert into the light end, and mid-tone colours (a tan
     "susceptible" cell, a sky-blue backdrop) land in grey instead. Games with
     a background/resting-state colour that lands grey should read this
     (paired with `lightBoard: true` in Arcade.register so the filter stops
     inverting and just desaturates+brightens what's explicitly drawn here)
     and fill with docPaper()/docInk() directly in doc mode.

     Naive approach: read --doc-paper/--doc-ink and draw those. Wrong — a
     lightBoard stage still runs grayscale(1) contrast(0.92) brightness(1.12)
     OVER whatever gets drawn, and that brightness lift turns --doc-ink
     (#1f2329, already fairly dark) into ~rgb(47,47,47) on screen: a visible
     charcoal grey, not ink. The light doc theme has no dark-theme swap to
     worry about, so feed the filter true extremes (#000/#fff) instead of the
     tuned CSS value — pure black still clips to a near-black ~11 through
     that exact filter, pure white stays white. The dark doc theme has no
     such compounding filter (its lightBoard rule is scoped off in that
     theme), so there the CSS var IS the final on-screen colour and should be
     read directly. */
  const isDarkDoc = () => { try { return document.documentElement.getAttribute('data-dark') === '1'; } catch (e) { return false; } };
  Engine.docPaper = function docPaper() { return isDarkDoc() ? Engine.docColor('--doc-paper', '#1b1e24') : '#ffffff'; };
  Engine.docInk = function docInk() { return isDarkDoc() ? Engine.docColor('--doc-ink', '#e9ebef') : '#000000'; };
  Engine.docMut = function docMut() { return Engine.docColor('--doc-mut', '#767d88'); };
  Engine.docRule = function docRule() { return Engine.docColor('--doc-rule2', '#d3d6dc'); };
  Engine.docColor = function docColor(name, fallback) {
    try {
      const v = getComputedStyle(document.body).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) { return fallback; }
  };

  /* ---------- game loop (respects a global pause) ---------- */
  Engine.loop = function loop(fn) {
    let last = performance.now();
    let raf = 0;
    let dead = false;
    function tick(now) {
      if (dead) return;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.06) dt = 0.06;          // a backgrounded tab must not explode the sim
      if (!Engine.paused) {
        try { fn(dt); }
        catch (e) { dead = true; console.error(e); return; }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => { dead = true; cancelAnimationFrame(raf); };
  };

  /* ---------- keyboard ---------- */
  const isEditable = (t) => !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  Engine.isEditable = isEditable;

  Engine.keys = function keys(capture) {
    const cap = new Set(capture || []);
    const st = Object.create(null);
    const down = (e) => {
      if (isEditable(e.target)) return;      // typing beats every game binding
      st[e.code] = true; st[e.key] = true;
      if (cap.has(e.code) || cap.has(e.key)) e.preventDefault();
    };
    const up = (e) => { st[e.code] = false; st[e.key] = false; };
    const blur = () => { for (const k in st) st[k] = false; };
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    addEventListener('blur', blur);
    return {
      state: st,
      get(...ks) { return ks.some((k) => !!st[k]); },
      dispose() {
        removeEventListener('keydown', down);
        removeEventListener('keyup', up);
        removeEventListener('blur', blur);
      }
    };
  };

  /* discrete key presses; handler returns true to preventDefault */
  Engine.onKey = function onKey(fn) {
    const down = (e) => {
      if (isEditable(e.target)) return;
      if (fn(e) === true) e.preventDefault();
    };
    addEventListener('keydown', down);
    return () => removeEventListener('keydown', down);
  };

  /* swipe helper for touch */
  Engine.swipe = function swipe(el, fn, threshold) {
    threshold = threshold || 24;
    let sx = 0, sy = 0, active = false;
    const start = (e) => {
      const p = e.touches ? e.touches[0] : e;
      sx = p.clientX; sy = p.clientY; active = true;
    };
    const end = (e) => {
      if (!active) return;
      active = false;
      const p = e.changedTouches ? e.changedTouches[0] : e;
      const dx = p.clientX - sx, dy = p.clientY - sy;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
      fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchend', end);
      el.removeEventListener('mousedown', start);
      el.removeEventListener('mouseup', end);
    };
  };

  /* on-screen d-pad for phones */
  Engine.dpad = function dpad(parent, fn, opts) {
    opts = opts || {};
    const mk = (label, dir, cls) =>
      h('button', {
        class: 'dpad-btn ' + cls, type: 'button', 'aria-label': dir,
        onpointerdown: (e) => { e.preventDefault(); Engine.haptic(6); fn(dir); }
      }, label);
    const pad = h('div', { class: 'dpad' + (opts.class ? ' ' + opts.class : '') },
      mk('▲', 'up', 'up'), mk('◀', 'left', 'left'),
      opts.center
        ? h('button', {
          class: 'dpad-btn mid', type: 'button',
          onpointerdown: (e) => { e.preventDefault(); Engine.haptic(6); fn('action'); }
        }, opts.center)
        : h('span', { class: 'dpad-btn mid ghost' }),
      mk('▶', 'right', 'right'), mk('▼', 'down', 'down'));
    parent.appendChild(pad);
    return pad;
  };

  /* ---------- audio ---------- */
  const audio = (function () {
    let ac;
    function ctx() {
      if (ac === undefined) {
        try { ac = new (global.AudioContext || global.webkitAudioContext)(); }
        catch (e) { ac = null; }
      }
      if (ac && ac.state === 'suspended') ac.resume();
      return ac;
    }
    function tone(o) {
      o = o || {};
      if (api.muted) return;
      const a = ctx();
      if (!a) return;
      const t0 = a.currentTime + (o.delay || 0);
      const osc = a.createOscillator();
      const g = a.createGain();
      osc.type = o.type || 'square';
      const f = o.freq || 440;
      osc.frequency.setValueAtTime(f, t0);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + (o.dur || 0.1));
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.vol || 0.12, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || 0.1));
      osc.connect(g); g.connect(a.destination);
      osc.start(t0); osc.stop(t0 + (o.dur || 0.1) + 0.03);
    }
    function noise(o) {
      o = o || {};
      if (api.muted) return;
      const a = ctx();
      if (!a) return;
      const dur = o.dur || 0.15;
      const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = a.createBufferSource();
      src.buffer = buf;
      const g = a.createGain();
      g.gain.value = o.vol || 0.1;
      const flt = a.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = o.cutoff || 1400;
      src.connect(flt); flt.connect(g); g.connect(a.destination);
      src.start();
    }
    /* haptics ride the same mute toggle as sound; no-op where unsupported */
    function buzz(pattern) {
      try { if (!api.muted && global.navigator && global.navigator.vibrate) global.navigator.vibrate(pattern); } catch (e) { /* ignore */ }
    }
    const api = {
      muted: true,
      tone, noise, buzz,
      blip(f) { tone({ freq: f || 640, dur: 0.05, vol: 0.08 }); },
      click() { tone({ freq: 320, dur: 0.03, vol: 0.06, type: 'triangle' }); },
      good() {
        tone({ freq: 520, dur: 0.08, type: 'triangle', vol: 0.12 });
        tone({ freq: 784, dur: 0.12, type: 'triangle', vol: 0.1, delay: 0.07 });
        buzz(12);
      },
      great() { [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.1, delay: i * 0.06 })); buzz([8, 24, 8, 24, 16]); },
      bad() { tone({ freq: 180, to: 60, dur: 0.28, type: 'sawtooth', vol: 0.1 }); buzz(28); },
      thud() { noise({ dur: 0.12, cutoff: 500, vol: 0.12 }); },
      boom() { noise({ dur: 0.45, cutoff: 900, vol: 0.16 }); }
    };
    return api;
  })();
  Engine.audio = audio;
  Engine.sfx = audio;
  Engine.haptic = function haptic(pattern) { audio.buzz(pattern); };

  /* ---------- Hold Music: a tiny procedural chiptune loop ----------
     A lookahead scheduler over a I-vi-IV-V progression in C, so it sits under
     the existing C-major SFX instead of fighting them. Off by default. */
  Engine.music = (function () {
    let ac = null, on = false, timer = null, nextTime = 0, step = 0;
    const ROOTS = [130.81, 110.0, 87.31, 98.0];                 // C3 A2 F2 G2
    const ARPS = [
      [261.63, 329.63, 392.0, 329.63], [220.0, 261.63, 329.63, 261.63],
      [174.61, 220.0, 261.63, 220.0], [196.0, 246.94, 293.66, 246.94]
    ];
    const BPM = 92, beat = 60 / BPM, look = 0.12;
    function ctx() {
      if (!ac) { try { ac = new (global.AudioContext || global.webkitAudioContext)(); } catch (e) { ac = null; } }
      if (ac && ac.state === 'suspended') ac.resume();
      return ac;
    }
    function note(freq, t, dur, type, vol) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
    }
    function schedule() {
      const a = ctx(); if (!a) return;
      while (nextTime < a.currentTime + look) {
        const bar = Math.floor(step / 4) % 4, s = step % 4;
        if (s === 0) note(ROOTS[bar], nextTime, beat * 1.8, 'triangle', 0.07);
        note(ARPS[bar][s], nextTime, beat * 0.85, 'square', 0.03);
        nextTime += beat; step++;
      }
    }
    return {
      playing: () => on,
      start() { const a = ctx(); if (!a) return false; on = true; nextTime = a.currentTime + 0.08; step = 0; if (timer) clearInterval(timer); timer = setInterval(schedule, look * 500); return true; },
      stop() { on = false; if (timer) { clearInterval(timer); timer = null; } return false; },
      toggle() { return on ? this.stop() : this.start(); }
    };
  })();

  /* ---------- seeded RNG (xmur3 hash -> mulberry32) ----------
     Deterministic from a string seed, so the same seed reproduces the same
     board anywhere with no network. Used by the Daily challenge. */
  Engine.rng = function rng(seedStr) {
    seedStr = String(seedStr);
    let hh = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) {
      hh = Math.imul(hh ^ seedStr.charCodeAt(i), 3432918353);
      hh = (hh << 13) | (hh >>> 19);
    }
    let a = (hh ^= hh >>> 16) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- Engine.fx: a shared confetti burst overlay ----------
     One fixed pointer-through canvas over the page; particles self-clean when
     they die and the rAF loop stops. Skipped entirely under reduced-motion. */
  Engine.fx = (function () {
    let cv = null, fctx = null, parts = [], raf = 0;
    const COLORS = ['#ffcb1f', '#e8402a', '#00a6b4', '#6fcf2f', '#ff2d87', '#6f3fa8'];
    /* this canvas is a fixed full-page overlay, outside .stage, so the
       document-disguise luminance filter never touches it — a rainbow burst
       would blow the cover instantly. Use flecks of ink instead in doc mode. */
    const DOC_COLORS = ['#14171c', '#3a3f47', '#6b7178', '#9aa0a8'];
    const palette = () => (global.Arcade && global.Arcade.docMode && global.Arcade.docMode()) ? DOC_COLORS : COLORS;
    const reduce = () => { try { return global.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
    function resize() { if (cv) { cv.width = global.innerWidth; cv.height = global.innerHeight; } }
    function ensure() {
      if (cv) return;
      cv = document.createElement('canvas');
      cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:950';
      document.body.appendChild(cv);
      fctx = cv.getContext('2d');
      resize();
      global.addEventListener('resize', resize);
    }
    function loop() {
      if (!parts.length) { raf = 0; if (fctx) fctx.clearRect(0, 0, cv.width, cv.height); return; }
      fctx.clearRect(0, 0, cv.width, cv.height);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.life -= 0.016; p.rot += p.vr;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        fctx.save();
        fctx.globalAlpha = clamp(p.life * 2, 0, 1);
        fctx.translate(p.x, p.y); fctx.rotate(p.rot);
        fctx.fillStyle = p.c; fctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        fctx.restore();
      }
      raf = requestAnimationFrame(loop);
    }
    return {
      burst(x, y, n) {
        if (reduce()) return;
        ensure();
        n = n || 42;
        const cols = palette();
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 7;
          parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, life: 0.8 + Math.random() * 0.6, s: 5 + Math.random() * 5, c: cols[(Math.random() * cols.length) | 0], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4 });
        }
        if (!raf) raf = requestAnimationFrame(loop);
      }
    };
  })();

  /* ---------- share a board position as a short, checksummed code ----------
     Packs an array of small cell values (0/1/2) plus one extra bit (whose turn)
     into a base-36 code with a tag and a checksum char, so a board can travel
     over any chat as something that reads like a dull reference number. */
  Engine.packCode = function packCode(tag, cells, extra, base) {
    const B = BigInt(base || 3);       /* digits per cell; default 3 for 0/1/2 boards */
    let v = 0n;
    for (let i = cells.length - 1; i >= 0; i--) v = v * B + BigInt(cells[i] | 0);
    v = v * 2n + (extra ? 1n : 0n);
    let sum = extra ? 1 : 0;
    for (let i = 0; i < cells.length; i++) sum += cells[i] | 0;
    return tag.toUpperCase() + '-' + v.toString(36).toUpperCase() + '-' + (sum % 36).toString(36).toUpperCase();
  };
  Engine.unpackCode = function unpackCode(tag, code, n, base) {
    try {
      const B = BigInt(base || 3);
      const parts = String(code == null ? '' : code).trim().toUpperCase().split('-');
      if (parts.length !== 3 || parts[0] !== tag.toUpperCase()) return null;
      let v = 0n;
      for (const ch of parts[1]) { const d = parseInt(ch, 36); if (isNaN(d)) return null; v = v * 36n + BigInt(d); }
      const extra = Number(v % 2n); v = v / 2n;
      const cells = new Array(n);
      let sum = extra;
      for (let i = 0; i < n; i++) { const d = Number(v % B); v = v / B; cells[i] = d; sum += d; }
      if ((sum % 36).toString(36).toUpperCase() !== parts[2]) return null;
      return { cells: cells, extra: extra };
    } catch (e) { return null; }
  };

  /* ---------- auto-advancing win banner ----------
     Shows the result, then moves to the next level on a short countdown so
     nobody has to reach for the mouse. The button still works if you are
     impatient, and "Stay here" cancels it. */
  Engine.autoAdvance = function autoAdvance(banner, title, body, nextLabel, next, delay) {
    delay = delay || 2.4;
    let left = delay;
    let cancelled = false;
    const btn = h('button', { class: 'btn primary', type: 'button' }, nextLabel + ' →');
    const stay = h('button', { class: 'btn', type: 'button' }, 'Stay here');
    const bar = h('i');
    const countWrap = h('div', { class: 'auto-count' }, bar);

    const go = () => { if (!cancelled) { cleanup(); next(); } };
    let raf = 0, last = performance.now();
    function cleanup() { cancelled = true; cancelAnimationFrame(raf); }
    btn.addEventListener('click', go);
    stay.addEventListener('click', () => { cleanup(); stay.remove(); countWrap.remove(); });

    banner.style.display = '';
    banner.replaceChildren(
      h('div', { class: 'ship-stamp' }, pick(['APPROVED', 'SHIPPED', 'SIGNED OFF', 'FILED', 'EOD'])),
      h('h3', null, title),
      h('p', null, body),
      h('div', { class: 'banner-btns' }, btn, stay),
      countWrap);
    try { const r = banner.getBoundingClientRect(); Engine.fx.burst(r.left + r.width / 2, r.top + Math.min(r.height / 2, 60), 46); } catch (e) { /* ignore */ }

    function tickFn(now) {
      if (cancelled) return;
      left -= (now - last) / 1000;
      last = now;
      bar.style.width = clamp(left / delay, 0, 1) * 100 + '%';
      if (left <= 0) return go();
      raf = requestAnimationFrame(tickFn);
    }
    raf = requestAnimationFrame(tickFn);
    return cleanup;
  };

  global.Engine = Engine;
})(window);
