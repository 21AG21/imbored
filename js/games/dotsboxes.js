/* Dots and Boxes — claim edges, complete squares, beat the deskmate. */
(function () {
  'use strict';
  const { h, randInt, clamp } = Engine;
  const BR = 4, BC = 4;   // 4x4 boxes (5x5 dots)

  function mount(root, api) {
    const bagg = Engine.bag();
    let hE, vE, box, turn, s1, s2, over, disposed = false;

    const pScore = api.pill('you 0 · 0 cpu');
    const pTurn = api.pill('your move');
    const msg = h('div', { class: 'db-msg' }, '');
    const grid = h('div', { class: 'db-grid', style: { gridTemplateColumns: 'repeat(' + (2 * BC + 1) + ', auto)' } });
    root.appendChild(h('div', { class: 'dotsboxes' }, msg, grid));
    api.button('New game', reset);

    function reset() {
      hE = Array.from({ length: BR + 1 }, () => new Array(BC).fill(false));
      vE = Array.from({ length: BR }, () => new Array(BC + 1).fill(false));
      box = Array.from({ length: BR }, () => new Array(BC).fill(0));
      turn = 1; s1 = 0; s2 = 0; over = false;
      msg.textContent = 'Draw a line between two dots. Close a box to claim it and go again.'; msg.className = 'db-msg';
      build(); sync();
      api.status('Tap the gap between two dots to draw a line. Completing the fourth side of a box claims it and gives you another turn. Most boxes wins.');
    }
    function build() {
      grid.replaceChildren();
      for (let r = 0; r <= 2 * BR; r++) {
        for (let c = 0; c <= 2 * BC; c++) {
          const er = r % 2, ec = c % 2;
          if (!er && !ec) { grid.appendChild(h('span', { class: 'db-dot' })); }
          else if (!er && ec) { const rr = r / 2, cc = (c - 1) / 2; grid.appendChild(edge('h', rr, cc)); }
          else if (er && !ec) { const rr = (r - 1) / 2, cc = c / 2; grid.appendChild(edge('v', rr, cc)); }
          else { const rr = (r - 1) / 2, cc = (c - 1) / 2; grid.appendChild(h('span', { class: 'db-box', 'data-b': rr + '_' + cc })); }
        }
      }
      paint();
    }
    function edge(t, r, c) {
      const el = h('button', { class: 'db-edge ' + t, type: 'button', 'data-e': t + r + '_' + c, onclick: () => claim(t, r, c, 1) });
      return el;
    }
    function edgeFilled(t, r, c) { return t === 'h' ? hE[r][c] : vE[r][c]; }
    function setEdge(t, r, c) { if (t === 'h') hE[r][c] = true; else vE[r][c] = true; }
    function boxSides(r, c) { return (hE[r][c] ? 1 : 0) + (hE[r + 1][c] ? 1 : 0) + (vE[r][c] ? 1 : 0) + (vE[r][c + 1] ? 1 : 0); }

    /* apply an edge for player p; returns number of boxes completed */
    function apply(t, r, c, p) {
      setEdge(t, r, c);
      let made = 0;
      const boxesOf = t === 'h'
        ? [[r - 1, c], [r, c]]
        : [[r, c - 1], [r, c]];
      for (const [br, bc] of boxesOf) {
        if (br < 0 || bc < 0 || br >= BR || bc >= BC) continue;
        if (box[br][bc] === 0 && boxSides(br, bc) === 4) { box[br][bc] = p; made++; }
      }
      return made;
    }
    function claim(t, r, c, p) {
      if (over || edgeFilled(t, r, c)) return;
      if (p === 1 && turn !== 1) return;
      const made = apply(t, r, c, p);
      api.sfx[made ? 'good' : 'click']();
      paint(); sync();
      if (done()) return finish();
      if (!made) { turn = turn === 1 ? 2 : 1; if (turn === 2) { pTurn.textContent = 'deskmate…'; setTimeout(cpu, 420); } }
      else if (turn === 2) setTimeout(cpu, 420);
    }
    function done() { return hE.every((row, r) => row.every((_, c) => hE[r][c])) && vE.every((row, r) => row.every((_, c) => vE[r][c])); }

    function legalEdges() {
      const out = [];
      for (let r = 0; r <= BR; r++) for (let c = 0; c < BC; c++) if (!hE[r][c]) out.push(['h', r, c]);
      for (let r = 0; r < BR; r++) for (let c = 0; c <= BC; c++) if (!vE[r][c]) out.push(['v', r, c]);
      return out;
    }
    /* would drawing this edge leave some box with exactly 3 sides (a gift)? */
    function isSafe(t, r, c) {
      const boxesOf = t === 'h' ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
      for (const [br, bc] of boxesOf) {
        if (br < 0 || bc < 0 || br >= BR || bc >= BC) continue;
        if (boxSides(br, bc) === 2) return false;   // this move makes it a 3-sided gift
      }
      return true;
    }
    function completes(t, r, c) {
      const boxesOf = t === 'h' ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
      for (const [br, bc] of boxesOf) {
        if (br < 0 || bc < 0 || br >= BR || bc >= BC) continue;
        if (boxSides(br, bc) === 3) return true;
      }
      return false;
    }
    function cpu() {
      if (disposed || over || turn !== 2) return;
      const edges = legalEdges();
      if (!edges.length) return;
      const blunder = clamp((1 - api.dm) * 0.55, 0, 0.5);
      let pick;
      const grab = edges.filter((e) => completes(e[0], e[1], e[2]));
      const safe = edges.filter((e) => isSafe(e[0], e[1], e[2]));
      if (grab.length && Math.random() > blunder) pick = grab[randInt(0, grab.length - 1)];
      else if (safe.length && Math.random() > blunder) pick = safe[randInt(0, safe.length - 1)];
      else pick = edges[randInt(0, edges.length - 1)];
      const made = apply(pick[0], pick[1], pick[2], 2);
      api.sfx[made ? 'good' : 'blip'](made ? undefined : 300);
      paint(); sync();
      if (done()) return finish();
      if (made) setTimeout(cpu, 380);
      else { turn = 1; pTurn.textContent = 'your move'; }
    }

    function paint() {
      [...grid.querySelectorAll('.db-edge')].forEach((el) => {
        const [t, rc] = [el.dataset.e[0], el.dataset.e.slice(1)];
        const [r, c] = rc.split('_').map(Number);
        el.classList.toggle('on', edgeFilled(t, r, c));
      });
      [...grid.querySelectorAll('.db-box')].forEach((el) => {
        const [r, c] = el.dataset.b.split('_').map(Number);
        el.className = 'db-box' + (box[r][c] === 1 ? ' you' : box[r][c] === 2 ? ' cpu' : '');
      });
    }
    function sync() {
      s1 = box.flat().filter((v) => v === 1).length;
      s2 = box.flat().filter((v) => v === 2).length;
      pScore.textContent = 'you ' + s1 + ' · ' + s2 + ' cpu';
      pTurn.textContent = over ? '' : turn === 1 ? 'your move' : 'deskmate…';
    }
    function finish() {
      over = true; sync();
      const win = s1 > s2;
      api.sfx[win ? 'great' : 'bad']();
      if (win) { const w = api.load('wins', 0) + 1; api.save('wins', w); api.submit(w); }
      msg.textContent = win ? ('You win ' + s1 + '–' + s2 + '.') : s1 === s2 ? ('Tied ' + s1 + '–' + s2 + '.') : ('Deskmate wins ' + s2 + '–' + s1 + '.');
      msg.className = 'db-msg ' + (win ? 'win' : 'lose');
    }

    reset();
    return () => { disposed = true; bagg.dispose(); };
  }

  Arcade.register({
    id: 'dotsboxes', title: 'Dots and Boxes', emoji: 'nonogram', cat: 'brain', order: 33,
    blurb: 'The margin-of-the-notebook game. Take turns drawing lines between dots; close a box to claim it and take another turn. Most boxes wins.',
    scoreLabel: 'Wins', tags: ['strategy', 'board', 'classic'],
    how: [
      'Tap the gap between two dots to draw a line.',
      'Completing the fourth side of a box claims it and gives you another turn.',
      'Try not to hand the deskmate the third side of a box.',
      'When every line is drawn, whoever owns more boxes wins.'
    ],
    mount
  });
})();
