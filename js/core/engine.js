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
    if (opts.maxHeight) c.style.maxHeight = opts.maxHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    parent.appendChild(c);
    return {
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
