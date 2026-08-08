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

    const pRound = api.pill('Round 0');
    const pMode = api.pill('watch');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);

    /* how long each note plays, and the gap after it */
    const noteLen = () => clamp(0.52 - seq.length * 0.012, 0.16, 0.52) / dm;
    /* how long you get to hit the next pad before it counts as a fumble */
    const patience = () => clamp(3.4 / dm, 0.9, 4);

    function reset() {
      seq = [];
      step = 0;
      over = false;
      flashAll = 0;
      best = 0;
      nextRound();
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
      if (mode !== 'input' || over) return;
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
      ctx.fillText(mode === 'play' ? 'WATCH' : mode === 'input' ? 'REPEAT' : mode === 'over' ? 'OVER' : 'NICE', cx, cy + 24);

      /* how many of the sequence you have entered */
      if (mode === 'input') {
        for (let i = 0; i < seq.length; i++) {
          ctx.fillStyle = i < step ? '#6fcf2f' : '#3a3446';
          ctx.fillRect(cx - seq.length * 6 + i * 12, H - 26, 9, 9);
        }
        const f = clamp(waitT / patience(), 0, 1);
        ctx.fillStyle = f > 0.4 ? '#ded6c2' : '#e8402a';
        ctx.fillRect(cx - 90, 16, 180 * f, 6);
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
    reset();
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'copycat',
    title: 'Copycat',
    emoji: '🎺',
    cat: 'brain',
    order: 24,
    blurb: 'It plays a little tune. You play it back. Then it adds one more note, forever, until your brain gives out.',
    scoreLabel: 'Longest',
    tags: ['simon', 'memory', 'sequence', 'sounds'],
    how: [
      'Watch which pads light up, then click them back in the same order.',
      'Every round adds one more note to the end.',
      'Keys 1 2 3 4 work too, or Q W A S if your hand is already there.',
      'Turn the speaker on. Each pad has its own note and the tune is genuinely easier to remember than the colours.',
      'Harder difficulties play faster and give you less time to answer.'
    ],
    mount
  });
})();
