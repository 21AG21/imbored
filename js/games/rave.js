/* Rave — the anti-panic key. Where the backtick turns the site into a spreadsheet,
 * this turns the whole screen into a screaming rainbow nightclub, on purpose, to
 * make a hovering boss decide they saw nothing and leave. Full-viewport takeover.
 * Every pointer is now an identical white circle, and the whole field drifts in
 * the direction of your hand at ONE uniform speed — same for every circle — so
 * there is no "yours is the faster one that follows my mouse" tell left. There is
 * no button and no Escape; the secret exits are instant Shift+S (quit) and Shift+M
 * (mute), and even closing the tab nags you about unsaved work. Carries a
 * photosensitivity + loud-audio heads-up because the flashing and screeching are
 * both very real. */
(function () {
  'use strict';
  const { h, clamp } = Engine;

  const LINES = ['PARTY MODE', 'MAXIMUM VIBES', 'DO NOT DISTURB', 'CONTENT UNAVAILABLE', 'GPU GO BRRR', 'RENDERING…', 'MORALE.EXE', '10x ENERGY', 'SYNERGY ACHIEVED'];
  const EMO = ['✦', '★', '●', '▲', '◆', '♥', '✚', '☀', '❄', '♪'];

  /* ---- the screamer: a self-contained, deliberately LOUD zoo of synthesized
     animal screeches on its own AudioContext (so it ignores the site mute — the
     whole point of the rave is that it is obnoxious). It picks a fresh creature
     every burst and never repeats twice in a row, so the sound keeps changing. */
  function makeScreamer() {
    let ac = null, timer = 0, alive = false, master = null, last = -1;
    function ctx() {
      if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
      if (ac && ac.state === 'suspended') ac.resume();
      return ac;
    }
    /* one sung/screamed tone with vibrato + optional tremolo + optional filter */
    function voice(a, t0, p) {
      const dur = p.dur;
      const osc = a.createOscillator();
      osc.type = p.type || 'sawtooth';
      osc.frequency.setValueAtTime(p.f0, t0);
      if (p.f1 && p.f1 !== p.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(30, p.f1), t0 + dur);
      if (p.vibD) {
        const lfo = a.createOscillator(), lg = a.createGain();
        lfo.type = 'sine'; lfo.frequency.value = p.vibR || 16; lg.gain.value = p.vibD;
        lfo.connect(lg); lg.connect(osc.frequency);
        lfo.start(t0); lfo.stop(t0 + dur + 0.05);
      }
      let node = osc;
      if (p.cut) {
        const flt = a.createBiquadFilter();
        flt.type = p.cutType || 'bandpass'; flt.frequency.value = p.cut; flt.Q.value = p.q || 6;
        osc.connect(flt); node = flt;
      }
      const g = a.createGain();
      const peak = p.vol == null ? 0.55 : p.vol;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
      g.gain.setValueAtTime(peak, t0 + dur * 0.65);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      if (p.trD) {                                   // amplitude wobble = bleating / gargle
        const tlfo = a.createOscillator(), tg = a.createGain();
        tlfo.type = 'sine'; tlfo.frequency.value = p.trR || 22; tg.gain.value = p.trD;
        tlfo.connect(tg); tg.connect(g.gain);
        tlfo.start(t0); tlfo.stop(t0 + dur + 0.05);
      }
      node.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    }
    function noiseBurst(a, t0, dur, cut, q, vol, type) {
      const buf = a.createBuffer(1, Math.max(1, Math.ceil(a.sampleRate * dur)), a.sampleRate);
      const dch = buf.getChannelData(0);
      for (let i = 0; i < dch.length; i++) dch[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource(); src.buffer = buf;
      const flt = a.createBiquadFilter(); flt.type = type || 'bandpass'; flt.frequency.value = cut; flt.Q.value = q || 4;
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(flt); flt.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + dur + 0.02);
    }
    const rnd = (a, b) => a + Math.random() * (b - a);
    /* each creature returns how long its burst runs, in seconds */
    const ZOO = [
      function cat(a, t) { voice(a, t, { type: 'sawtooth', f0: rnd(700, 820), f1: 360, dur: 0.75, vibR: 17, vibD: 75, cut: 1700, cutType: 'lowpass', q: 2, vol: 0.6 }); noiseBurst(a, t, 0.14, 2600, 3, 0.25); return 0.75; },
      function hawk(a, t) { voice(a, t, { type: 'square', f0: rnd(2100, 2500), f1: 1150, dur: 0.5, vibR: 34, vibD: 150, cut: 2400, q: 5, vol: 0.45 }); return 0.5; },
      function goat(a, t) { voice(a, t, { type: 'sawtooth', f0: rnd(480, 560), f1: 470, dur: 0.85, vibR: 9, vibD: 38, trR: 25, trD: 0.35, vol: 0.55 }); return 0.85; },
      function pig(a, t) { voice(a, t, { type: 'sawtooth', f0: 780, f1: rnd(1500, 1750), dur: 0.6, vibR: 27, vibD: 105, cut: 2100, cutType: 'lowpass', vol: 0.55 }); return 0.6; },
      function monkey(a, t) { let d = 0; const n = 5 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) { voice(a, t + d, { type: 'square', f0: rnd(880, 1400), f1: rnd(1200, 1700), dur: 0.08, vibR: 40, vibD: 90, vol: 0.42 }); d += 0.1; } return d; },
      function crow(a, t) { let d = 0; for (let i = 0; i < 3; i++) { noiseBurst(a, t + d, 0.18, 1150, 6, 0.5, 'bandpass'); voice(a, t + d, { type: 'sawtooth', f0: 430, f1: 300, dur: 0.18, cut: 1500, cutType: 'lowpass', vol: 0.3 }); d += 0.25; } return d; },
      function monster(a, t) { voice(a, t, { type: 'sawtooth', f0: 90, f1: 150, dur: 1.05, vibR: 7, vibD: 22, cut: 900, cutType: 'lowpass', vol: 0.7 }); noiseBurst(a, t, 0.95, 320, 1, 0.45, 'lowpass'); return 1.05; },
      function seagull(a, t) { let d = 0; for (let i = 0; i < 5; i++) { voice(a, t + d, { type: 'triangle', f0: 1400 - i * 130, f1: 900 - i * 120, dur: 0.11, vibR: 20, vibD: 60, vol: 0.42 }); d += 0.16; } return d; },
      function elephant(a, t) { voice(a, t, { type: 'sawtooth', f0: 180, f1: rnd(560, 680), dur: 0.75, vibR: 12, vibD: 44, cut: 1600, cutType: 'lowpass', vol: 0.6 }); return 0.75; },
      function rooster(a, t) { const parts = [[520, 0.14], [900, 0.14], [780, 0.18], [1150, 0.4]]; let d = 0; for (const [f, du] of parts) { voice(a, t + d, { type: 'sawtooth', f0: f, f1: f * 1.05, dur: du, vibR: 14, vibD: 40, vol: 0.5 }); d += du + 0.02; } return d; }
    ];
    function burst() {
      const a = ctx(); if (!a || !alive) return;
      let i = (Math.random() * ZOO.length) | 0;
      if (i === last) i = (i + 1) % ZOO.length;      // never the same beast twice running
      last = i;
      const t0 = a.currentTime + 0.03;
      let d = 0.5;
      try { d = ZOO[i](a, t0); } catch (e) { /* ignore a bad frame */ }
      timer = setTimeout(burst, Math.max(120, d * 1000 * (0.62 + Math.random() * 0.28)));   // slight overlap keeps it relentless
    }
    return {
      start() {
        if (alive) return;
        const a = ctx(); if (!a) return;
        alive = true;
        master = a.createGain(); master.gain.value = 0.95;         // pushed loud on purpose
        const comp = a.createDynamicsCompressor();                  // tame clipping, stay hot
        comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.12;
        master.connect(comp); comp.connect(a.destination);
        burst();
      },
      stop() {
        alive = false;
        if (timer) { clearTimeout(timer); timer = 0; }
        if (ac) { try { ac.close(); } catch (e) { /* ignore */ } ac = null; }
        master = null;
      }
    };
  }

  function mount(root, api) {
    const bagg = Engine.bag();
    let overlay = null, raf = 0;
    const screamer = makeScreamer();

    /* every pointer is now just a plain white circle — identical dots, so there
       is nothing distinctive about yours to latch onto in the swarm */
    function drawDot(ctx, x, y, r) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111';
      ctx.lineWidth = Math.max(1, r * 0.18);
      ctx.fill(); ctx.stroke();
    }

    function start() {
      root.replaceChildren(h('p', { class: 'rave-hint' }, 'The party owns your whole screen — a blizzard of identical circles that all drift the same way at the same speed whenever you move, so your real one is gone for good. No button, no Escape, and closing the tab just nags you. Turning it off is a secret you have to find.'));
      api.status('RAVE ENGAGED. Loud, bright, and very hard to kill — every circle is identical and moves at the same speed, so there is no tell left at all. There is a way out, but you have to discover it.');

      overlay = h('div', { class: 'rave-overlay', tabindex: '0', style: { cursor: 'none' } });
      const cv = h('canvas', { class: 'rave-canvas' });
      overlay.append(cv);
      document.body.appendChild(overlay);
      const ctx = cv.getContext('2d');

      let scaleX = 1, scaleY = 1;
      function size() {
        const dpr = Math.min(2, devicePixelRatio || 1);
        cv.width = Math.floor(innerWidth * dpr); cv.height = Math.floor(innerHeight * dpr);
        scaleX = cv.width / innerWidth; scaleY = cv.height / innerHeight;
      }
      size();
      bagg.listen(window, 'resize', size);

      const blobs = [];
      for (let i = 0; i < 26; i++) blobs.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, r: 0.05 + Math.random() * 0.14, h: Math.random() * 360, s: (Math.random() * EMO.length) | 0 });

      /* a field of identical circles in CSS-pixel space (0..innerWidth/Height).
         Every frame the WHOLE field slides by one and the same vector, in whatever
         direction you last moved your mouse, at a single fixed speed — no per-dot
         variation at all, so there is no faster or slower "yours" to pick out.
         Only the direction follows your hand; the speed never changes. They wrap
         at the edges so the screen stays full instead of piling up on one wall. */
      const DECOYS = Math.max(30, Math.min(64, Math.round(innerWidth * innerHeight / 24000)));
      const dots = [];
      for (let i = 0; i < DECOYS; i++) dots.push({ x: Math.random() * innerWidth, y: Math.random() * innerHeight });

      const SPEED = 520;                               // px/sec — the same for every single circle
      let haveReal = false, lastX = 0, lastY = 0, dirX = 0, dirY = 0, moveT = 0;
      bagg.listen(overlay, 'pointermove', (e) => {
        if (haveReal) {
          const dx = e.clientX - lastX, dy = e.clientY - lastY, len = Math.hypot(dx, dy);
          if (len > 0.5) { dirX = dx / len; dirY = dy / len; moveT = 0.14; }   // take the direction only, not the speed
        }
        lastX = e.clientX; lastY = e.clientY; haveReal = true;
      });

      const wrap = (v, hi) => { v %= hi; return v < 0 ? v + hi : v; };

      let t = 0, lineI = 0, lineT = 0, last = performance.now();
      function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const W = cv.width, H = cv.height;
        t += 1;
        /* rapid rainbow wash — hue spins fast, brightness stays high-ish to look
           wild while avoiding the worst full-field luminance strobe */
        const baseHue = (t * 11) % 360;
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, 'hsl(' + baseHue + ',100%,55%)');
        g.addColorStop(0.5, 'hsl(' + ((baseHue + 120) % 360) + ',100%,50%)');
        g.addColorStop(1, 'hsl(' + ((baseHue + 240) % 360) + ',100%,55%)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

        for (const b of blobs) {
          b.x += b.vx * 0.016; b.y += b.vy * 0.016; b.h = (b.h + 7) % 360;
          if (b.x < 0 || b.x > 1) b.vx *= -1; if (b.y < 0 || b.y > 1) b.vy *= -1;
          b.x = clamp(b.x, 0, 1); b.y = clamp(b.y, 0, 1);
          const px = b.x * W, py = b.y * H, rr = b.r * Math.min(W, H) * (1 + 0.15 * Math.sin(t * 0.3 + b.h));
          ctx.fillStyle = 'hsl(' + b.h + ',100%,60%)';
          ctx.font = 'bold ' + rr + 'px Impact, Arial Black, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(EMO[b.s], px, py);
        }

        lineT -= 1;
        if (lineT <= 0) { lineI = (Math.random() * LINES.length) | 0; lineT = 22; }
        const scale = 1 + 0.08 * Math.sin(t * 0.6);
        ctx.save();
        ctx.translate(W / 2, H / 2); ctx.scale(scale, scale);
        ctx.font = 'bold ' + Math.floor(Math.min(W, H) * 0.11) + 'px Impact, Arial Black, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(4, W * 0.006); ctx.strokeStyle = '#000';
        ctx.fillStyle = 'hsl(' + ((baseHue + 180) % 360) + ',100%,92%)';
        ctx.strokeText(LINES[lineI], 0, 0); ctx.fillText(LINES[lineI], 0, 0);
        ctx.restore();

        /* every circle slides the exact same distance this frame in the mouse
           direction — one uniform speed, so none of them can be singled out as
           yours. Movement fades a beat after your hand stops. */
        const dotR = scaleX * 9;                        // dot radius in device px
        const stepPx = moveT > 0 ? SPEED * dt : 0;
        if (moveT > 0) moveT -= dt;
        for (const d of dots) {
          d.x = wrap(d.x + dirX * stepPx, innerWidth);
          d.y = wrap(d.y + dirY * stepPx, innerHeight);
          drawDot(ctx, d.x * scaleX, d.y * scaleY, dotR);
        }

        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
      screamer.start();

      const kill = () => { location.hash = ''; };
      let muted = false;
      const toggleMute = () => { muted = !muted; if (muted) screamer.stop(); else screamer.start(); };
      /* While the rave is up it OWNS the keyboard: a capture-phase listener eats
         every keydown before the site's global shortcuts (Escape-to-exit, the
         panic key, difficulty keys…) can see it, so none of them bail you out.
         Escape now does nothing. Two secret instant combos: Shift+S quits, Shift+M
         mutes/unmutes the screeching. Browser accelerators (Ctrl/Cmd+W, reload) are
         left alone so the unsaved-changes nag below can catch them. */
      bagg.listen(window, 'keydown', (e) => {
        e.stopImmediatePropagation();                              // nothing else on the page hears this key
        if (e.shiftKey && (e.code === 'KeyS' || (e.key || '').toLowerCase() === 's')) { e.preventDefault(); kill(); return; }
        if (e.shiftKey && (e.code === 'KeyM' || (e.key || '').toLowerCase() === 'm')) { e.preventDefault(); toggleMute(); return; }
        if (!e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();   // block page defaults, but not real browser shortcuts
      }, true);
      /* trying to close the tab or navigate away nags you about "unsaved work" —
         one more speed bump on the way out. The Shift+S exit only changes the URL
         hash, which never triggers this, so the secret quit stays instant. */
      bagg.listen(window, 'beforeunload', (e) => {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes that will be lost. Leave anyway?';
        return e.returnValue;
      });
      overlay.focus();
    }

    bagg.add(() => { if (raf) cancelAnimationFrame(raf); screamer.stop(); if (overlay && overlay.parentNode) overlay.remove(); });

    start();          // no gate — it fires the moment you open it
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'rave',
    title: 'Rave Mode',
    emoji: 'rave',
    cat: 'goof',
    order: 45,
    blurb: 'The opposite of the panic key. It fills your whole screen with strobing rainbow colour and screaming animal noises so anyone reading over your shoulder looks away fast. Turning it off is a puzzle.',
    scoreLabel: 'Parties thrown',
    tags: ['toy', 'prank', 'boss'],
    how: [
      'Opening it takes over the whole screen with fast spinning colour, giant flashing text, and loud, ever-changing animal screeches. It fires the instant you open it, with no confirmation.',
      'It sprays dozens of identical white circles across the screen. The whole field drifts in whatever direction you move your mouse, and every circle moves at the exact same speed, so your real one is completely lost in the crowd — there is no tell at all.',
      'There is no stop button, no press-any-key, and Escape does nothing. Even closing the tab throws up an "unsaved changes" warning. Getting out is a secret you have to figure out — that is the point.',
      'It flashes fast and bright and gets loud, so open it only when you actually want that.',
      'Pair it with the panic key (the backtick turns the site into a spreadsheet) for cover at both extremes.',
      'Press Shift and the backtick key (the ~ key above Tab) to summon it from anywhere.'
    ],
    mount
  });
})();
