/* Whack-a-Meeting. Decline everything. Except the one you cannot. */
(function () {
  'use strict';
  const { h, clamp, rand, randInt, pick } = Engine;

  const W = 780, H = 560;
  const COLS = 3, ROWS = 3;
  const ROUND = 60;

  const JUNK = [
    'Quick Sync', 'Touch Base', 'Circle Back', 'Deep Dive', 'Alignment',
    'Pre-Read Review', 'Sync About The Sync', 'Kickoff (Again)', 'Retro Retro',
    'Brainstorm', 'Working Session', 'Status Update', 'Parking Lot',
    'Optional (Not Optional)', 'Weekly Cadence', 'Vibe Check'
  ];
  const REAL = ['PAYROLL', 'YOUR REVIEW', 'FIRE DRILL', 'FREE LUNCH', 'BONUS CHAT'];

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;

    const dm = api.dm;
    const pScore = api.pill('Declined: 0');
    const pTime = api.pill('60s');
    const pMiss = api.pill('Booked: 0/5');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);

    let slots, score, missed, t, over, spawnT, combo, shakes;
    const MAXMISS = 5;

    const cw = W / COLS, ch = (H - 60) / ROWS;
    const slotBox = (i) => {
      const c = i % COLS, r = Math.floor(i / COLS);
      return { x: c * cw + 14, y: 60 + r * ch + 10, w: cw - 28, h: ch - 20 };
    };

    function reset() {
      slots = new Array(COLS * ROWS).fill(null);
      score = 0; missed = 0; t = ROUND; over = false; combo = 0; shakes = [];
      spawnT = 0.4;
      banner.style.display = 'none';
      api.status('Click the junk meetings to decline them. Leave the gold ones alone. They are the good ones.');
      sync();
    }

    function spawn() {
      const free = [];
      for (let i = 0; i < slots.length; i++) if (!slots[i]) free.push(i);
      if (!free.length) return;
      const i = pick(free);
      const goldChance = clamp(0.14 + (dm - 1) * 0.1, 0.08, 0.34);
      const gold = Math.random() < goldChance;
      const life = (gold ? 2.6 : rand(1.5, 2.9)) / dm;
      slots[i] = {
        gold,
        title: gold ? pick(REAL) : pick(JUNK),
        life, max: life, t: 0,
        who: pick(['R. Patel', 'S. Okafor', 'J. Lindqvist', 'M. Duarte', 'A. Novak', 'THE SYSTEM'])
      };
    }

    function click(px, py) {
      if (over) return;
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (!s) continue;
        const b = slotBox(i);
        if (px < b.x || px > b.x + b.w || py < b.y || py > b.y + b.h) continue;
        if (s.gold) {
          missed++;
          combo = 0;
          shakes.push({ i, t: 0.4 });
          api.sfx.bad();
          slots[i] = null;
          if (missed >= MAXMISS) end('You declined payroll. And your own review.');
        } else {
          combo++;
          score += 10 + Math.min(40, combo * 2);
          api.sfx.tone({ freq: 500 + Math.min(600, combo * 30), to: 260, dur: 0.07, type: 'square', vol: 0.08 });
          slots[i] = null;
        }
        sync();
        return;
      }
      combo = 0;
    }

    function end(why) {
      over = true;
      api.sfx.boom();
      const res = api.submit(score);
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Calendar full.'),
        h('p', null, why + ' Final score ' + score + '.' +
          (res.isRecord ? ' Best ever!' : res.isFirst ? '' : ' Best: ' + res.best + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Clear the week'));
    }

    function sync() {
      pScore.textContent = 'Declined: ' + score;
      pTime.textContent = Math.ceil(t) + 's';
      pMiss.textContent = 'Booked: ' + missed + '/' + MAXMISS;
      pMiss.className = 'pill ' + (missed >= MAXMISS - 1 ? 'bad' : missed > 1 ? 'warn' : '');
    }

    function update(dt) {
      if (over) return;
      t -= dt;
      if (t <= 0) { t = 0; return end('You survived the week.'); }

      spawnT -= dt;
      if (spawnT <= 0) {
        spawn();
        spawnT = rand(0.45, 1.15) / dm;
      }

      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (!s) continue;
        s.t += dt;
        s.life -= dt;
        if (s.life <= 0) {
          if (!s.gold) {
            missed++;
            combo = 0;
            shakes.push({ i, t: 0.4 });
            api.sfx.thud();
            if (missed >= MAXMISS) { slots[i] = null; return end('Your calendar is now solid blue.'); }
          } else {
            score += 25;
            api.sfx.good();
          }
          slots[i] = null;
        }
      }
      for (let i = shakes.length - 1; i >= 0; i--) {
        shakes[i].t -= dt;
        if (shakes[i].t <= 0) shakes.splice(i, 1);
      }
      sync();
    }

    function draw() {
      const doc = Arcade.docMode();
      ctx.fillStyle = doc ? Engine.docPaper() : '#141a26';
      ctx.fillRect(0, 0, W, H);

      /* calendar header */
      if (doc) {
        ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, W - 2, 46);
      } else {
        ctx.fillStyle = '#6f3fa8';
        ctx.fillRect(0, 0, W, 48);
      }
      ctx.fillStyle = doc ? Engine.docInk() : '#fffdf3';
      ctx.font = '22px Impact, Haettenschweiler, Arial Black, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('YOUR WEEK', 16, 25);
      ctx.font = 'bold 13px Verdana, sans-serif';
      ctx.fillStyle = doc ? Engine.docInk() : '#ffcb1f';
      ctx.textAlign = 'right';
      ctx.fillText(combo > 2 ? 'DECLINE STREAK x' + combo : '', W - 16, 25);
      ctx.textAlign = 'left';

      for (let i = 0; i < slots.length; i++) {
        const b0 = slotBox(i);
        /* pixel-snap the box in doc mode — a fractional box edge antialiases
           even with a crisp source pixel, and with nine boxes on screen that
           adds up to a visible wash of grey */
        const b = doc ? { x: Math.round(b0.x), y: Math.round(b0.y), w: Math.round(b0.w), h: Math.round(b0.h) } : b0;
        const shake = shakes.find((s) => s.i === i);
        const ox = shake ? Math.sin(shake.t * 60) * 5 : 0;

        ctx.fillStyle = doc ? Engine.docPaper() : '#1e2635';
        ctx.fillRect(b.x + ox, b.y, b.w, b.h);
        ctx.strokeStyle = doc ? Engine.docInk() : '#333d52';
        ctx.lineWidth = doc ? 1 : 2;
        /* +0.5 centres a 1px stroke exactly on the pixel grid instead of
           straddling it — the classic crisp-hairline trick, needed here
           because a plain integer coordinate with an odd line width still
           antialiases across two rows */
        if (doc) ctx.strokeRect(b.x + ox + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
        else ctx.strokeRect(b.x + ox, b.y, b.w, b.h);

        const s = slots[i];
        if (!s) continue;
        const grow = clamp(s.t * 7, 0, 1);
        const hgt = b.h * grow;
        const y = b.y + b.h - hgt;

        /* gold (keep) cards read as solid ink, junk (decline) cards as a
           paper-and-outline box — the same solid-vs-outline language used
           elsewhere on the site to tell two states apart without colour */
        if (doc) {
          ctx.fillStyle = s.gold ? Engine.docInk() : Engine.docPaper();
          ctx.fillRect(b.x + 4 + ox, y + 2, b.w - 8, hgt - 4);
          ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 2;
          ctx.strokeRect(b.x + 4 + ox, y + 2, b.w - 8, hgt - 4);
        } else {
          ctx.fillStyle = s.gold ? '#ffcb1f' : '#00a6b4';
          ctx.fillRect(b.x + 4 + ox, y + 2, b.w - 8, hgt - 4);
          ctx.strokeStyle = '#0c1119';
          ctx.lineWidth = 3;
          ctx.strokeRect(b.x + 4 + ox, y + 2, b.w - 8, hgt - 4);
        }

        if (grow > 0.55) {
          ctx.fillStyle = doc ? (s.gold ? Engine.docPaper() : Engine.docInk()) : (s.gold ? '#1d1722' : '#fffdf3');
          ctx.font = 'bold 13px Verdana, sans-serif';
          ctx.fillText(s.title.slice(0, 20), b.x + 12 + ox, y + 22);
          ctx.font = '11px Verdana, sans-serif';
          ctx.fillText(s.who, b.x + 12 + ox, y + 40);
          ctx.font = 'bold 10px Verdana, sans-serif';
          ctx.fillText(s.gold ? 'DO NOT DECLINE' : 'click to decline', b.x + 12 + ox, y + 58);

          /* time-left bar */
          const f = clamp(s.life / s.max, 0, 1);
          if (doc) {
            const barCol = s.gold ? Engine.docPaper() : Engine.docInk();
            ctx.strokeStyle = Engine.docInk(); ctx.lineWidth = 1;
            ctx.strokeRect(b.x + 10 + ox, b.y + b.h - 14, b.w - 20, 6);
            ctx.fillStyle = barCol;
            ctx.fillRect(b.x + 10 + ox, b.y + b.h - 14, (b.w - 20) * f, 6);
          } else {
            ctx.fillStyle = 'rgba(0,0,0,.3)';
            ctx.fillRect(b.x + 10 + ox, b.y + b.h - 14, b.w - 20, 6);
            ctx.fillStyle = s.gold ? '#1d1722' : '#fffdf3';
            ctx.fillRect(b.x + 10 + ox, b.y + b.h - 14, (b.w - 20) * f, 6);
          }
        }
      }
      ctx.textBaseline = 'alphabetic';
    }

    bagg.listen(cv.el, 'pointerdown', (e) => {
      const p = cv.pos(e);
      click(p.x, p.y);
    });
    api.button('New week', reset);

    reset();
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'whack',
    title: 'Whack-a-Meeting',
    emoji: 'whack',
    cat: 'goof',
    order: 61,
    lightBoard: true,   // doc mode draws its own paper/ink palette above; the blanket invert would only flip it back
    blurb: 'Meeting invites pop onto your calendar. Click the junk ones to decline them, but leave the gold ones alone. Those are payroll and your own review.',
    scoreLabel: 'Score',
    tags: ['whack a mole', 'calendar', 'meetings', 'reflex'],
    how: [
      'Teal invites are junk. Click them to decline before they book themselves in.',
      'Gold invites are the ones you want. Clicking one counts against you.',
      'Leave a gold invite alone and it is worth 25 points when it expires.',
      'Five bookings ends your week, and you have sixty seconds on the clock.',
      'Declining without a miss builds a streak worth bonus points.'
    ],
    mount
  });
})();
