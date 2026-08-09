/* Copycat. It plays a tune. You play it back. It adds one. Forever. */
(function () {
  'use strict';
  const { h, clamp, randInt } = Engine;

  const W = 560, H = 560;
  const PADS = [
    { col: '#e8402a', lit: '#ff8f7d', freq: 262, a0: Math.PI, a1: Math.PI * 1.5 },
    { col: '#ffcb1f', lit: '#fff29a', freq: 330, a0: Math.PI * 1.5, a1: Math.PI * 2 },
    { col: '#00a6b4', lit: '#7ce8f2', freq: 392, a0: Math.PI * 0.5, a1: Math.PI },
    { col: '#6fcf2f', lit: '#c4ff9a', freq: 523, a0: 0, a1: Math.PI * 0.5 }
  ];

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;
    const dm = api.dm;

    let seq, step, mode, litIdx, litT, waitT, over, best, flashAll;
    let twoP = false, turn2 = 1, inp = 0, winner2 = 0;

    const pRound = api.pill('Round 0');
    const pMode = api.pill('watch');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);

    /* how long each note plays, and the gap after it */
    const noteLen = () => clamp(0.52 - seq.length * 0.012, 0.16, 0.52) / dm;
    /* how long you get to hit the next pad before it counts as a fumble */
    const patience = () => clamp(3.4 / dm, 1.6, 4);

    function reset() {
      seq = [];
      step = 0;
      over = false;
      flashAll = 0;
      best = 0;
      winner2 = 0;
      if (twoP) {
        turn2 = 1; inp = 0; mode = 'input'; litIdx = -1; litT = 0;
        sync();
        api.status('Hotseat: take turns. Repeat the whole sequence so far, then add one new pad. Miss the sequence and the other player wins.');
        return;
      }
      nextRound();
    }

    /* two-player: replay the sequence, then append one; a wrong replay loses */
    function press2p(i) {
      if (over) return;
      hit(i, true);
      if (inp < seq.length) {
        if (seq[inp] !== i) return fail2p();
        inp++;
      } else {
        seq.push(i);
        turn2 = turn2 === 1 ? 2 : 1;
        inp = 0;
        api.sfx.good();
        sync();
        api.status('Player ' + turn2 + ': repeat all ' + seq.length + ', then add one.');
      }
    }

    function fail2p() {
      over = true;
      winner2 = turn2 === 1 ? 2 : 1;
      api.sfx.bad();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Player ' + winner2 + ' wins.'),
        h('p', null, 'Player ' + turn2 + ' broke the chain at ' + seq.length + ' notes.'),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Rematch'));
      sync();
    }

    function nextRound() {
      seq.push(randInt(0, 3));
      step = 0;
      mode = 'play';
      litIdx = -1;
      litT = 0;
      waitT = 0.6;
      sync();
      api.status('Watch the sequence, then click it back in the same order.');
    }

    function sync() {
      if (twoP) {
        pRound.textContent = 'Chain ' + seq.length;
        pMode.textContent = over ? 'Player ' + winner2 + ' wins' : 'Player ' + turn2;
        pMode.className = 'pill ' + (over ? '' : 'good');
        return;
      }
      pRound.textContent = 'Round ' + seq.length;
      pMode.textContent = mode === 'play' ? 'watch' : mode === 'input' ? 'your turn' : 'done';
      pMode.className = 'pill ' + (mode === 'input' ? 'good' : '');
    }

    function hit(i, fromPlayer) {
      litIdx = i;
      litT = noteLen() * (fromPlayer ? 0.85 : 1);
      api.sfx.tone({ freq: PADS[i].freq, dur: Math.max(0.09, litT * 0.9), type: 'triangle', vol: 0.13 });
    }

    function press(i) {
      if (over) return;
      if (twoP) return press2p(i);
      if (mode !== 'input') return;
      hit(i, true);
      if (seq[step] !== i) return fail('Wrong pad.');
      step++;
      waitT = patience();
      if (step >= seq.length) {
        mode = 'done';
        best = Math.max(best, seq.length);
        flashAll = 0.45;
        api.sfx.good();
        setTimeout(() => { if (!over) nextRound(); }, 700);
      }
      sync();
    }

    function fail(why) {
      over = true;
      mode = 'over';
      api.sfx.bad();
      const reached = seq.length - 1;
      const res = api.submit(reached);
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Nope.'),
        h('p', null, why + ' You copied ' + reached + ' in a row.' +
          (res.isRecord ? ' Longest yet!' : res.isFirst ? '' : ' Best: ' + res.best + '.')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Try again'));
      sync();
    }

    function update(dt) {
      if (over) return;
      if (litT > 0) litT -= dt;
      else litIdx = -1;
      if (flashAll > 0) flashAll -= dt;
      if (twoP) return;

      if (mode === 'play') {
        waitT -= dt;
        if (waitT <= 0) {
          if (step < seq.length) {
            hit(seq[step], false);
            step++;
            waitT = noteLen() + clamp(0.22 / dm, 0.07, 0.22);
          } else {
            mode = 'input';
            step = 0;
            waitT = patience();
            sync();
          }
        }
      } else if (mode === 'input') {
        waitT -= dt;
        if (waitT <= 0) fail('You froze.');
      }
    }

    function draw() {
      ctx.fillStyle = '#141a26';
      ctx.fillRect(0, 0, W, H);

      const cx = W / 2, cy = H / 2, R = 232, gap = 0.045;
      PADS.forEach((p, i) => {
        const on = litIdx === i || flashAll > 0;
        ctx.fillStyle = on ? p.lit : p.col;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, p.a0 + gap, p.a1 - gap);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#0c1119';
        ctx.lineWidth = 6;
        ctx.stroke();
        if (on) {
          ctx.strokeStyle = 'rgba(255,255,255,.85)';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        /* colour-safe: a number on each pad so it never depends on the colour */
        if (document.body.classList.contains('colorsafe')) {
          const mid = (p.a0 + p.a1) / 2, rr = R * 0.62;
          ctx.fillStyle = '#0c1119';
          ctx.font = 'bold 42px Impact, Haettenschweiler, Arial Black, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(i + 1), cx + Math.cos(mid) * rr, cy + Math.sin(mid) * rr);
          ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        }
      });

      /* hub */
      ctx.fillStyle = '#1d1722';
      ctx.beginPath();
      ctx.arc(cx, cy, 78, 0, 7);
      ctx.fill();
      ctx.strokeStyle = '#ded6c2';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#ded6c2';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '46px Impact, Haettenschweiler, Arial Black, sans-serif';
      ctx.fillText(String(seq.length), cx, cy - 8);
      ctx.font = 'bold 11px Verdana, sans-serif';
      ctx.fillStyle = '#ffcb1f';
      ctx.fillText(twoP ? (over ? 'OVER' : 'PLAYER ' + turn2)
        : mode === 'play' ? 'WATCH' : mode === 'input' ? 'REPEAT' : mode === 'over' ? 'OVER' : 'NICE',
        cx, cy + 24);

      /* how many of the sequence you have entered */
      if (mode === 'input' && !twoP) {
        for (let i = 0; i < seq.length; i++) {
          ctx.fillStyle = i < step ? '#6fcf2f' : '#3a3446';
          ctx.fillRect(cx - seq.length * 6 + i * 12, H - 26, 9, 9);
        }
        const f = clamp(waitT / patience(), 0, 1);
        ctx.fillStyle = f > 0.4 ? '#ded6c2' : '#e8402a';
        ctx.fillRect(cx - 90, 16, 180 * f, 6);
      } else if (twoP && !over) {
        /* progress through the replay before you get to add a note */
        for (let i = 0; i < seq.length; i++) {
          ctx.fillStyle = i < inp ? '#6fcf2f' : '#3a3446';
          ctx.fillRect(cx - seq.length * 6 + i * 12, H - 26, 9, 9);
        }
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    bagg.listen(cv.el, 'pointerdown', (e) => {
      const p = cv.pos(e);
      const dx = p.x - W / 2, dy = p.y - H / 2;
      const d = Math.hypot(dx, dy);
      if (d > 232 || d < 78) return;
      let a = Math.atan2(dy, dx);
      if (a < 0) a += Math.PI * 2;
      const i = PADS.findIndex((q) => a >= q.a0 && a < q.a1);
      if (i >= 0) press(i);
    });

    bagg.add(Engine.onKey((e) => {
      const i = { '1': 0, '2': 1, '3': 2, '4': 3, q: 0, w: 1, a: 2, s: 3 }[e.key];
      if (i !== undefined) { press(i); return true; }
    }));

    api.button('Start over', reset);
    api.select('Players', [
      { value: '1p', label: '1 player (vs game)' },
      { value: '2p', label: '2 players (hotseat)' }
    ], '1p', (v) => { twoP = (v === '2p'); reset(); });
    reset();
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'copycat',
    usesDigits: true,   // 1-4 press the pads — the "1 = Docs" shortcut yields here
    title: 'Copycat',
    emoji: 'copycat',
    cat: 'brain',
    order: 24,
    blurb: 'The game lights a sequence of pads, adding one each round. Watch it, then tap the whole sequence back from memory.',
    scoreLabel: 'Longest',
    tags: ['simon', 'memory', 'sequence', 'sounds'],
    how: [
      'Watch which pads light, then click them back in the same order.',
      'Each round adds one more note to the end of the sequence.',
      'Use the mouse, keys 1 2 3 4, or Q W A S.',
      'Turn the speaker on. Each pad has its own note, which is easier to track than the colours.',
      'Higher difficulty plays the notes faster and shortens your window to answer.',
      'Set Players to 2 for hotseat with no computer tune. Take turns on one shared chain: replay the whole thing, then add one pad and pass the device. Miss a note and the other player wins.'
    ],
    mount
  });
})();
