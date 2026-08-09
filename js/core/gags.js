/* Gags — the toy box. Screen effects, office pranks and easter eggs that sit on
   top of the arcade. Everything here is in-memory, dismissible, and the ones
   that could get annoying (screensaver, fake alerts) are off until you opt in.
   Discover the rest by poking around. */
(function (global) {
  'use strict';
  const Engine = global.Engine;
  const h = Engine.h;
  const A = Engine.audio;
  const memStore = { _m: {}, get(k, d) { return k in this._m ? this._m[k] : d; }, set(k, v) { this._m[k] = v; } };
  const store = () => (global.Arcade && global.Arcade.store) || memStore;
  const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const bossOn = () => !!(global.Boss && global.Boss.isOn && global.Boss.isOn());
  const inGame = () => /^#(g|daily)\//.test(location.hash || '');
  const DPR = () => Math.min(2, global.devicePixelRatio || 1);
  const CONF_COLORS = ['#ff2d87', '#ffcb1f', '#00a6b4', '#6fcf2f', '#6f3fa8', '#e8402a', '#3a9d3a', '#ff8a3a'];

  /* ---------------- confetti ---------------- */
  function confetti(opts) {
    opts = opts || {};
    if (reduce()) return;
    const cv = h('canvas', { class: 'gag-fx gag-confetti' });
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    const dpr = DPR();
    const size = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
    size();
    const onR = () => size();
    addEventListener('resize', onR);
    const n = opts.count || 150;
    const spread = opts.x != null ? 80 * dpr : cv.width;
    const ox = (opts.x != null ? opts.x * dpr : cv.width / 2);
    const oy = (opts.y != null ? opts.y * dpr : -12);
    const parts = [];
    for (let i = 0; i < n; i++) parts.push({
      x: ox + (Math.random() - 0.5) * spread, y: oy + Math.random() * 40,
      vx: (Math.random() - 0.5) * 11 * dpr, vy: (Math.random() * 6 + 3) * dpr,
      g: (0.16 + Math.random() * 0.12) * dpr, s: (4 + Math.random() * 6) * dpr,
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
      c: CONF_COLORS[(Math.random() * CONF_COLORS.length) | 0]
    });
    let t = 0, raf = 0;
    function frame() {
      t++;
      ctx.clearRect(0, 0, cv.width, cv.height);
      let alive = 0;
      for (const p of parts) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr;
        if (p.y < cv.height + 24) alive++;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.62); ctx.restore();
      }
      if (alive > 0 && t < 320) raf = requestAnimationFrame(frame);
      else { cancelAnimationFrame(raf); removeEventListener('resize', onR); cv.remove(); }
    }
    raf = requestAnimationFrame(frame);
  }

  /* ---------------- toasts ---------------- */
  function toastHost() {
    let host = document.querySelector('.gag-toasts');
    if (!host) { host = h('div', { class: 'gag-toasts', 'aria-live': 'polite' }); document.body.appendChild(host); }
    return host;
  }
  function toast(o) {
    o = o || {};
    const host = toastHost();
    let done = false;
    const close = () => { if (done) return; done = true; el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 320); };
    const xBtn = h('button', { class: 'gag-toast-x', type: 'button', 'aria-label': 'Dismiss', onclick: close }, '×');
    const el = h('div', { class: 'gag-toast' + (o.tone ? ' ' + o.tone : '') },
      h('div', { class: 'gag-toast-ico' }, o.icon || '🔔'),
      h('div', { class: 'gag-toast-main' },
        h('div', { class: 'gag-toast-title' }, o.title || 'Notification'),
        o.body ? h('div', { class: 'gag-toast-text' }, o.body) : null),
      xBtn);
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    const timer = setTimeout(close, o.ms || 6000);
    el.addEventListener('click', (e) => { if (e.target.closest('.gag-toast-x')) return; clearTimeout(timer); close(); });
    return { close };
  }

  /* ---------------- fake IT update ---------------- */
  function itPopup() {
    if (document.querySelector('.gag-modal')) return;
    const bar = h('div', { class: 'gag-bar-fill' });
    const pct = h('span', { class: 'gag-bar-pct' }, '0%');
    const label = h('div', { class: 'gag-modal-label' }, 'Installing update 1 of 147…');
    const modal = h('div', { class: 'gag-modal' },
      h('div', { class: 'gag-modal-win' },
        h('div', { class: 'gag-modal-title' }, '⟳  System Update'),
        label,
        h('div', { class: 'gag-bar' }, bar),
        pct,
        h('div', { class: 'gag-modal-note' }, 'Please do not turn off your computer.')));
    document.body.appendChild(modal);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 7 + 1;
      if (p >= 99) p = 99;
      bar.style.width = p + '%'; pct.textContent = Math.floor(p) + '%';
      label.textContent = 'Installing update ' + Math.min(147, 1 + Math.floor(p / 0.7)) + ' of 147…';
      if (p >= 99) { clearInterval(iv); setTimeout(fail, 1200); }
    }, reduce() ? 350 : 170);
    function fail() {
      label.textContent = 'Update failed (0x8007000E). Rolling back changes…';
      pct.textContent = ''; bar.style.width = '100%'; bar.classList.add('err');
      setTimeout(() => { modal.remove(); if (A && A.bad) A.bad(); toast({ icon: '✅', title: 'Just kidding', body: 'Nothing was installed. As you were.' }); }, 1700);
    }
    modal.addEventListener('click', (e) => { if (e.target === modal) { clearInterval(iv); modal.remove(); } });
  }

  /* ---------------- matrix rain ---------------- */
  let matrixEl = null, matrixRaf = 0;
  function stopMatrix() { if (matrixRaf) cancelAnimationFrame(matrixRaf); matrixRaf = 0; if (matrixEl) { if (matrixEl._off) matrixEl._off(); matrixEl.remove(); matrixEl = null; } }
  function matrix(on) {
    const want = on == null ? !matrixEl : on;
    if (!want) { stopMatrix(); return; }
    if (matrixEl) return;
    if (reduce()) { toast({ icon: '🟩', title: 'Matrix rain', body: 'Skipped — reduced motion is on.' }); return; }
    const cv = h('canvas', { class: 'gag-fx gag-matrix' });
    document.body.appendChild(cv); matrixEl = cv;
    const ctx = cv.getContext('2d'); const dpr = DPR();
    let cols, drops, fs;
    const size = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; fs = 16 * dpr; cols = Math.ceil(cv.width / fs); drops = Array.from({ length: cols }, () => (Math.random() * cv.height / fs) | 0); };
    size(); const onR = () => size(); addEventListener('resize', onR); cv._off = () => removeEventListener('resize', onR);
    const CH = 'アカサタナハマヤabcdef0123456789<>=/*';
    function frame() {
      ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.font = fs + 'px monospace';
      for (let i = 0; i < cols; i++) {
        ctx.fillStyle = i % 9 === 0 ? '#b9ffcf' : '#37e065';
        ctx.fillText(CH[(Math.random() * CH.length) | 0], i * fs, drops[i] * fs);
        if (drops[i] * fs > cv.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      matrixRaf = requestAnimationFrame(frame);
    }
    frame();
    toast({ icon: '🟩', title: 'Wake up', body: 'Type "matrix" again (or press Esc) to stop.' });
  }

  /* ---------------- idle screensaver (DVD-bounce) ---------------- */
  let saverEl = null, saverRaf = 0, idleTimer = 0;
  const saverOn = () => !!store().get('saver', false);
  function armIdle() { clearTimeout(idleTimer); if (saverOn()) idleTimer = setTimeout(showSaver, 90000); }
  function showSaver() {
    if (saverEl || bossOn() || document.hidden || reduce()) { armIdle(); return; }
    const brand = (document.querySelector('.brand-text') || {}).textContent || 'Docs';
    const badge = h('div', { class: 'gag-saver-badge' }, brand);
    saverEl = h('div', { class: 'gag-saver' }, badge);
    document.body.appendChild(saverEl);
    let x = innerWidth * 0.3, y = innerHeight * 0.3, vx = 1.7, vy = 1.35, hue = 200;
    const step = () => {
      const bw = badge.offsetWidth, bh = badge.offsetHeight;
      x += vx; y += vy; let bump = false;
      if (x < 0) { x = 0; vx = Math.abs(vx); bump = true; }
      if (x + bw > innerWidth) { x = innerWidth - bw; vx = -Math.abs(vx); bump = true; }
      if (y < 0) { y = 0; vy = Math.abs(vy); bump = true; }
      if (y + bh > innerHeight) { y = innerHeight - bh; vy = -Math.abs(vy); bump = true; }
      if (bump) { hue = (hue + 47) % 360; badge.style.color = 'hsl(' + hue + ',85%,66%)'; }
      badge.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      saverRaf = requestAnimationFrame(step);
    };
    step();
  }
  function hideSaver() { if (saverRaf) cancelAnimationFrame(saverRaf); saverRaf = 0; if (saverEl) { saverEl.remove(); saverEl = null; } armIdle(); }

  /* ---------------- fake office alerts ---------------- */
  const OFFICE = [
    { icon: '📅', title: 'Reminder', body: 'Standup starts in 5 minutes.' },
    { icon: '📧', title: 'New message', body: 'RE: RE: RE: quick question' },
    { icon: '💾', title: 'Software Center', body: 'Updates are ready to install.' },
    { icon: '📎', title: 'Assistant', body: 'It looks like you’re trying to look busy.' },
    { icon: '🗓️', title: 'Calendar', body: '“Sync about the sync” starts soon.' },
    { icon: '🔔', title: 'HR', body: 'Please complete your training module.' },
    { icon: '🖨️', title: 'Printer', body: 'Tray 2 is out of paper. It always is.' },
    { icon: '☕', title: 'Kitchen', body: 'Someone left a full pot. A hero walks among us.' }
  ];
  let officeTimer = 0;
  const officeOn = () => !!store().get('office', false);
  function armOffice() {
    clearTimeout(officeTimer);
    if (!officeOn()) return;
    officeTimer = setTimeout(() => {
      if (!bossOn() && !document.hidden) toast(OFFICE[(Math.random() * OFFICE.length) | 0]);
      armOffice();
    }, 40000 + Math.random() * 55000);
  }

  /* ---------------- easter eggs: konami + secret words + logo ---------------- */
  const KON = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let konI = 0, wordBuf = '';
  const WORDS = {
    matrix: () => matrix(),
    party: () => { confetti({ count: 220 }); if (A && A.great) A.great(); },
    rave: () => { if (global.Arcade && global.Arcade.go) global.Arcade.go('rave'); },
    raise: () => { toast({ icon: '💸', title: 'Compensation review', body: 'Your request has been declined.' }); if (A && A.bad) A.bad(); },
    coffee: () => toast({ icon: '☕', title: 'Break room', body: 'A fresh pot is brewing. Allegedly.' }),
    update: () => itPopup()
  };
  function konami() {
    confetti({ count: 240 });
    if (A && A.great) A.great();
    toast({ icon: '🎮', title: 'Cheat activated', body: '↑↑↓↓←→←→ B A — 30 extra lives you don’t need.' });
    document.body.classList.add('gag-konami');
    setTimeout(() => document.body.classList.remove('gag-konami'), 3800);
  }
  function keyHandler(e) {
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (e.key === 'Escape') { if (matrixEl) stopMatrix(); if (saverEl) hideSaver(); }
    if (typing || inGame()) { konI = 0; return; }   // eggs only on the calm hub, never mid-game or mid-typing
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === KON[konI]) { konI++; if (konI === KON.length) { konI = 0; konami(); } }
    else konI = (k === KON[0]) ? 1 : 0;
    if (/^[a-z]$/.test(k)) {
      wordBuf = (wordBuf + k).slice(-12);
      for (const w in WORDS) { if (wordBuf.endsWith(w)) { wordBuf = ''; WORDS[w](); break; } }
    }
  }
  function wireLogo() {
    const mark = document.querySelector('.brand-mark');
    if (!mark) return;
    let n = 0, timer = 0;
    mark.style.cursor = 'pointer';
    mark.title = 'Company logo';
    mark.addEventListener('click', () => {
      n++; clearTimeout(timer); timer = setTimeout(() => { n = 0; }, 1200);
      if (n >= 7) { n = 0; confetti({ count: 170 }); toast({ icon: '🎉', title: 'You found it', body: 'Seven clicks on the logo. Impeccable procrastination.' }); }
    });
  }

  /* ---------------- boot ---------------- */
  function onActivity() { if (saverEl) hideSaver(); else armIdle(); }
  let started = false;
  function init() {
    if (started) return; started = true;
    try {
      addEventListener('keydown', keyHandler, true);
      ['mousemove', 'pointerdown', 'wheel', 'touchstart'].forEach((ev) => addEventListener(ev, onActivity, { passive: true }));
      addEventListener('keydown', onActivity, { passive: true });
      document.addEventListener('visibilitychange', () => { if (document.hidden && saverEl) hideSaver(); });
      wireLogo();
      armIdle(); armOffice();
    } catch (e) { /* never let a gag break the app */ }
  }

  global.Gags = {
    confetti, toast, itPopup, matrix, init,
    screensaver: { enabled: saverOn, set(on) { store().set('saver', !!on); if (!on && saverEl) hideSaver(); armIdle(); } },
    officeAlerts: { enabled: officeOn, set(on) { store().set('office', !!on); armOffice(); } }
  };
})(window);
