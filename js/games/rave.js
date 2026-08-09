/* Rave — the anti-panic key. Where the backtick turns the site into a spreadsheet,
 * this turns the whole screen into a screaming rainbow nightclub, on purpose, to
 * make a hovering boss decide they saw nothing and leave. Full-viewport takeover,
 * one tap to stop. Carries a photosensitivity heads-up because the flashing is
 * real. */
(function () {
  'use strict';
  const { h, clamp } = Engine;
  const store = Arcade.store;

  const LINES = ['PARTY MODE', 'MAXIMUM VIBES', 'DO NOT DISTURB', 'CONTENT UNAVAILABLE', 'GPU GO BRRR', 'RENDERING…', 'MORALE.EXE', '10x ENERGY', 'SYNERGY ACHIEVED'];
  const EMO = ['✦', '★', '●', '▲', '◆', '♥', '✚', '☀', '❄', '♪'];

  function mount(root, api) {
    const bagg = Engine.bag();
    let overlay = null, raf = 0;

    function warn() {
      root.replaceChildren(h('div', { class: 'rave-warn' },
        h('h3', null, '⚠ Loud flashing colours'),
        h('p', null, 'This fills your entire screen with fast, saturated, strobing colour to scare off anyone reading over your shoulder. If you are sensitive to flashing light, sit this one out.'),
        h('div', { class: 'rave-warn-btns' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => { store.set('raveok', true); start(); } }, 'Start the party'),
          h('button', { class: 'btn', type: 'button', onclick: () => { location.hash = ''; } }, 'No thanks'))));
      api.status('Fair warning: this one is genuinely loud and flashy.');
    }

    function start() {
      root.replaceChildren(h('p', { class: 'rave-hint' }, 'The party is on your whole screen. Tap it (or press Esc) to make it stop.'));
      api.status('RAVE ENGAGED. Tap the screen or hit Esc to return to something that looks like work.');

      overlay = h('div', { class: 'rave-overlay', tabindex: '0' });
      const cv = h('canvas', { class: 'rave-canvas' });
      const stop = h('button', { class: 'rave-stop', type: 'button' }, 'MAKE IT STOP');
      overlay.append(cv, stop);
      document.body.appendChild(overlay);
      const ctx = cv.getContext('2d');

      function size() { cv.width = Math.floor(innerWidth * Math.min(2, devicePixelRatio || 1)); cv.height = Math.floor(innerHeight * Math.min(2, devicePixelRatio || 1)); }
      size();
      bagg.listen(window, 'resize', size);

      const blobs = [];
      for (let i = 0; i < 26; i++) blobs.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, r: 0.05 + Math.random() * 0.14, h: Math.random() * 360, s: (Math.random() * EMO.length) | 0 });

      let t = 0, lineI = 0, lineT = 0;
      function frame() {
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

        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      const kill = () => { location.hash = ''; };
      bagg.listen(overlay, 'pointerdown', kill);
      bagg.listen(stop, 'pointerdown', (e) => { e.stopPropagation(); kill(); });
      bagg.add(Engine.onKey((e) => { if (e.key === 'Escape') { kill(); return true; } }));
      overlay.focus();
    }

    bagg.add(() => { if (raf) cancelAnimationFrame(raf); if (overlay && overlay.parentNode) overlay.remove(); });

    if (store.get('raveok', false)) start(); else warn();
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'rave',
    title: 'Rave Mode',
    emoji: 'rave',
    cat: 'goofy',
    order: 45,
    blurb: 'The opposite of the panic key. Instead of hiding your games behind a spreadsheet, this detonates your entire screen into a strobing rainbow so aggressively that anyone reading over your shoulder decides they would rather be anywhere else. Tap to stop.',
    scoreLabel: 'Parties thrown',
    tags: ['toy', 'prank', 'boss'],
    how: [
      'Opening it takes over your whole screen — every pixel — with fast, saturated, spinning colour and giant flashing nonsense text.',
      'It exists to be seen by the wrong person. A boss glancing at a screen mid-seizure of rainbow tends to keep walking.',
      'Tap anywhere on the screen, press the Make It Stop button, or hit Escape to snap back to the calm arcade.',
      'It flashes fast and bright on purpose, so there is a one-time heads-up for anyone who is photosensitive — you can always back out there.',
      'Pair it with the real panic key (the backtick turns the site into a spreadsheet) for the full range of workplace camouflage: invisible, or extremely visible.'
    ],
    mount
  });
})();
