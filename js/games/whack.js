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
      ctx.fillStyle = '#141a26';
      ctx.fillRect(0, 0, W, H);

      /* calendar header */
      ctx.fillStyle = '#6f3fa8';
      ctx.fillRect(0, 0, W, 48);
      ctx.fillStyle = '#fffdf3';
      ctx.font = '22px Impact, Haettenschweiler, Arial Black, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('YOUR WEEK', 16, 25);
      ctx.font = 'bold 13px Verdana, sans-serif';
      ctx.fillStyle = '#ffcb1f';
      ctx.textAlign = 'right';
      ctx.fillText(combo > 2 ? 'DECLINE STREAK x' + combo : '', W - 16, 25);
      ctx.textAlign = 'left';

      for (let i = 0; i < slots.length; i++) {
        const b = slotBox(i);
        const shake = shakes.find((s) => s.i === i);
        const ox = shake ? Math.sin(shake.t * 60) * 5 : 0;

        ctx.fillStyle = '#1e2635';
        ctx.fillRect(b.x + ox, b.y, b.w, b.h);
        ctx.strokeStyle = '#333d52';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x + ox, b.y, b.w, b.h);

        const s = slots[i];
        if (!s) continue;
        const grow = clamp(s.t * 7, 0, 1);
        const hgt = b.h * grow;
        const y = b.y + b.h - hgt;

        ctx.fillStyle = s.gold ? '#ffcb1f' : '#00a6b4';
        ctx.fillRect(b.x + 4 + ox, y + 2, b.w - 8, hgt - 4);
        ctx.strokeStyle = '#0c1119';
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x + 4 + ox, y + 2, b.w - 8, hgt - 4);

        if (grow > 0.55) {
          ctx.fillStyle = s.gold ? '#1d1722' : '#fffdf3';
          ctx.font = 'bold 13px Verdana, sans-serif';
          ctx.fillText(s.title.slice(0, 20), b.x + 12 + ox, y + 22);
          ctx.font = '11px Verdana, sans-serif';
          ctx.fillText(s.who, b.x + 12 + ox, y + 40);
          ctx.font = 'bold 10px Verdana, sans-serif';
          ctx.fillText(s.gold ? 'DO NOT DECLINE' : 'click to decline', b.x + 12 + ox, y + 58);

          /* time-left bar */
          const f = clamp(s.life / s.max, 0, 1);
          ctx.fillStyle = 'rgba(0,0,0,.3)';
          ctx.fillRect(b.x + 10 + ox, b.y + b.h - 14, b.w - 20, 6);
          ctx.fillStyle = s.gold ? '#1d1722' : '#fffdf3';
          ctx.fillRect(b.x + 10 + ox, b.y + b.h - 14, (b.w - 20) * f, 6);
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
    emoji: '📅',
    cat: 'goof',
    order: 61,
    blurb: 'Meeting invites pop up. Click them to decline. But the gold ones are payroll and your own review, so leave those alone.',
    scoreLabel: 'Score',
    tags: ['whack a mole', 'calendar', 'meetings', 'reflex'],
    how: [
      'Teal invites are junk. Click them to decline before they book themselves in.',
      'Gold invites are the ones you actually want. Clicking those counts against you.',
      'A gold invite you leave alone is worth 25 points when it expires.',
      'Five bookings and your week is gone. Sixty seconds on the clock.',
      'Declining without a miss builds a streak, and the streak is worth real points.'
    ],
    mount
  });
})();
