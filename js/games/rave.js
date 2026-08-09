/* Rave — the anti-panic key. Where the backtick turns the site into a spreadsheet,
 * this turns the whole screen into a screaming rainbow nightclub, on purpose, to
 * make a hovering boss decide they saw nothing and leave. Full-viewport takeover,
 * one tap to stop. Carries a photosensitivity heads-up because the flashing is
 * real. */
(function () {
  'use strict';
  const { h, clamp } = Engine;

  const LINES = ['PARTY MODE', 'MAXIMUM VIBES', 'DO NOT DISTURB', 'CONTENT UNAVAILABLE', 'GPU GO BRRR', 'RENDERING…', 'MORALE.EXE', '10x ENERGY', 'SYNERGY ACHIEVED'];
  const EMO = ['✦', '★', '●', '▲', '◆', '♥', '✚', '☀', '❄', '♪'];

  function mount(root, api) {
    const bagg = Engine.bag();
    let overlay = null, raf = 0;

    /* a classic arrow pointer, drawn on the canvas so we can spray dozens of
       identical decoys and hide which one is really yours */
    function drawCursor(ctx, x, y, s) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, 17); ctx.lineTo(4.2, 13); ctx.lineTo(7, 19.5);
      ctx.lineTo(9.6, 18.4); ctx.lineTo(6.9, 12); ctx.lineTo(12, 12); ctx.closePath();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6;
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    function start() {
      root.replaceChildren(h('p', { class: 'rave-hint' }, 'The party is on your whole screen — and so is a swarm of fake mouse pointers. Good luck finding yours. Press any key to make it all stop.'));
      api.status('RAVE ENGAGED. Your cursor is lost in a crowd of fakes — press any key (or find the real one and hit Make It Stop) to return to something that looks like work.');

      overlay = h('div', { class: 'rave-overlay', tabindex: '0', style: { cursor: 'none' } });
      const cv = h('canvas', { class: 'rave-canvas' });
      const stop = h('button', { class: 'rave-stop', type: 'button' }, 'MAKE IT STOP');
      overlay.append(cv, stop);
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

      /* a crowd of decoy cursors that wander the screen so yours is a needle in a
         haystack. They live in CSS-pixel space (0..innerWidth/Height) and drift
         with a light random walk, bouncing off the edges. Your real pointer is
         drawn identically on top — the only tell is that it follows your hand. */
      const DECOYS = Math.max(28, Math.min(60, Math.round(innerWidth * innerHeight / 26000)));
      const decoys = [];
      for (let i = 0; i < DECOYS; i++) {
        decoys.push({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260, turn: Math.random() * 2 });
      }
      let realX = innerWidth / 2, realY = innerHeight / 2, haveReal = false;
      bagg.listen(overlay, 'pointermove', (e) => { realX = e.clientX; realY = e.clientY; haveReal = true; });

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

        /* decoy cursors — wander, occasionally jink, bounce off the walls */
        const cs = scaleX * 1.9;                       // pointer size in device px
        for (const d of decoys) {
          d.turn -= dt;
          if (d.turn <= 0) { d.vx += (Math.random() - 0.5) * 260; d.vy += (Math.random() - 0.5) * 260; d.turn = 0.3 + Math.random() * 1.4; }
          const sp = Math.hypot(d.vx, d.vy) || 1; const cap = 340;
          if (sp > cap) { d.vx *= cap / sp; d.vy *= cap / sp; }
          d.x += d.vx * dt; d.y += d.vy * dt;
          if (d.x < 0) { d.x = 0; d.vx = Math.abs(d.vx); } else if (d.x > innerWidth) { d.x = innerWidth; d.vx = -Math.abs(d.vx); }
          if (d.y < 0) { d.y = 0; d.vy = Math.abs(d.vy); } else if (d.y > innerHeight) { d.y = innerHeight; d.vy = -Math.abs(d.vy); }
          drawCursor(ctx, d.x * scaleX, d.y * scaleY, cs);
        }
        /* your real pointer, identical, drawn last so it is in the pile too */
        if (haveReal) drawCursor(ctx, realX * scaleX, realY * scaleY, cs);

        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      const kill = () => { location.hash = ''; };
      /* clicking blindly no longer bails you out — you have to actually find your
         pointer and hit the button (or, the easy way, press any key) */
      bagg.listen(stop, 'pointerdown', (e) => { e.stopPropagation(); kill(); });
      /* ANY key gets you out — when you want the rainbow gone you want it gone
         now, not after remembering which key. Lone modifier taps (Shift, Ctrl,
         Alt, Meta, Caps) are ignored so a stray one doesn't bail you out early. */
      const MODS = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'OS'];
      bagg.add(Engine.onKey((e) => { if (MODS.indexOf(e.key) !== -1) return; kill(); return true; }));
      overlay.focus();
    }

    bagg.add(() => { if (raf) cancelAnimationFrame(raf); if (overlay && overlay.parentNode) overlay.remove(); });

    start();          // no gate — it fires the moment you open it
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'rave',
    title: 'Rave Mode',
    emoji: 'rave',
    cat: 'goof',
    order: 45,
    blurb: 'The opposite of the panic key. It fills your whole screen with strobing rainbow colour so anyone reading over your shoulder looks away. Tap to stop.',
    scoreLabel: 'Parties thrown',
    tags: ['toy', 'prank', 'boss'],
    how: [
      'Opening it takes over the whole screen with fast spinning colour and giant flashing text.',
      'It also sprays dozens of fake mouse pointers across the screen, so finding your real one to click anything is a genuine challenge. The only tell is that yours follows your hand.',
      'Press any key to end it instantly — that is the reliable escape. Or, if you fancy the hunt, find your real pointer and click Make It Stop. On touch just tap the button.',
      'It fires the instant you open it, with no confirmation. It flashes fast and bright, so open it only when you want that.',
      'Pair it with the panic key (the backtick turns the site into a spreadsheet) for cover at both extremes.',
      'Press Shift and the backtick key (the ~ key above Tab) to summon it from anywhere.'
    ],
    mount
  });
})();
