/* Solitaire (Klondike). It has been on office computers since 1990 and it is not leaving. */
(function () {
  'use strict';
  const { h, clamp, randInt, shuffle } = Engine;

  const CW = 80, CH = 112, GAP = 12;
  const MX = 34, TOPY = 16, TABY = 152;
  const FANUP = 26, FANDOWN = 12;
  const W = MX * 2 + CW * 7 + GAP * 6;
  const H = 640;

  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const isRed = (s) => s === 1 || s === 2;
  const DOC = () => !!(window.Arcade && Arcade.docMode && Arcade.docMode());

  const colX = (i) => MX + i * (CW + GAP);

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;

    const DRAW = api.hard ? 3 : 1;
    const REDEALS = api.hard ? (api.diffId === 'nightmare' ? 1 : 2) : Infinity;

    let stock, waste, found, tab, drag, undoStack, moves, redealsLeft, won, startedAt, winAnim;
    let wins = api.load('wins', 0);

    const pMoves = api.pill('Moves: 0');
    const pStock = api.pill('');
    const pWins = api.pill('Games won: ' + wins);
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.appendChild(banner);

    function deal() {
      const deck = [];
      for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) deck.push({ r, s, up: false });
      const d = shuffle(deck);
      tab = [];
      let k = 0;
      for (let i = 0; i < 7; i++) {
        const pile = [];
        for (let j = 0; j <= i; j++) {
          const c = d[k++];
          c.up = j === i;
          pile.push(c);
        }
        tab.push(pile);
      }
      stock = d.slice(k);
      stock.forEach((c) => { c.up = false; });
      waste = [];
      found = [[], [], [], []];
      drag = null;
      undoStack = [];
      moves = 0;
      redealsLeft = REDEALS;
      won = false;
      winAnim = 0;
      startedAt = Date.now();
      banner.style.display = 'none';
      api.status('Drag cards onto a card one higher and the other colour. Aces start the piles up top. A plain click with no drag sends a card home.');
      sync();
    }

    function snapshot() {
      /* redealsLeft is Infinity on the easier tiers, and JSON turns Infinity
         into null — which then reads as <= 0 and softlocks the stock. Stash it
         as a sentinel and restore it on undo. */
      return JSON.stringify({ stock, waste, found, tab, moves, redealsLeft: redealsLeft === Infinity ? -1 : redealsLeft });
    }
    function pushUndo() {
      undoStack.push(snapshot());
      if (undoStack.length > 80) undoStack.shift();
    }
    function undo() {
      if (!undoStack.length || won) return;
      const s = JSON.parse(undoStack.pop());
      stock = s.stock; waste = s.waste; found = s.found; tab = s.tab;
      moves = s.moves; redealsLeft = s.redealsLeft === -1 ? Infinity : s.redealsLeft;
      drag = null;
      api.sfx.click();
      sync();
    }

    function sync() {
      pMoves.textContent = 'Moves: ' + moves;
      pStock.textContent = DRAW === 3
        ? 'Draw 3  ·  redeals ' + (redealsLeft === Infinity ? '∞' : redealsLeft)
        : 'Draw 1';
      pWins.textContent = 'Games won: ' + wins;
    }

    /* ---------------- rules ---------------- */
    const canFound = (c, f) => {
      const top = found[f][found[f].length - 1];
      if (!top) return c.r === 0;
      return top.s === c.s && c.r === top.r + 1;
    };
    const canTab = (c, t) => {
      const top = tab[t][tab[t].length - 1];
      if (!top) return c.r === 12;
      return top.up && isRed(top.s) !== isRed(c.s) && c.r === top.r - 1;
    };

    /* a run you are allowed to pick up: descending, alternating colours, all face up */
    function grabbable(pile, i) {
      for (let k = i; k < pile.length; k++) {
        if (!pile[k].up) return false;
        if (k > i) {
          const a = pile[k - 1], b = pile[k];
          if (b.r !== a.r - 1 || isRed(a.s) === isRed(b.s)) return false;
        }
      }
      return true;
    }

    function flipExposed() {
      for (const pile of tab) {
        const t = pile[pile.length - 1];
        if (t && !t.up) { t.up = true; api.sfx.click(); }
      }
    }

    function checkWin() {
      if (found.every((f) => f.length === 13)) {
        won = true;
        winAnim = 0.001;
        wins++;
        api.save('wins', wins);
        api.submit(wins);
        api.sfx.great();
        const secs = Math.round((Date.now() - startedAt) / 1000);
        setTimeout(() => {
          banner.style.display = '';
          banner.replaceChildren(
            h('h3', null, 'All of it. Home.'),
            h('p', null, 'Won in ' + moves + ' moves and ' + Engine.fmtTime(secs) + '. That is ' + wins + ' game' + (wins === 1 ? '' : 's') + ' won.'),
            h('button', { class: 'btn primary', type: 'button', onclick: deal }, 'Deal again'));
        }, 1400);
        sync();
      }
    }

    /* ---------------- stock ---------------- */
    function drawFromStock() {
      pushUndo();
      if (stock.length) {
        for (let i = 0; i < DRAW && stock.length; i++) {
          const c = stock.pop();
          c.up = true;
          waste.push(c);
        }
        api.sfx.blip(420);
      } else if (waste.length) {
        if (redealsLeft <= 0) { api.sfx.bad(); undoStack.pop(); return; }
        redealsLeft--;
        while (waste.length) {
          const c = waste.pop();
          c.up = false;
          stock.push(c);
        }
        api.sfx.blip(240);
      } else { undoStack.pop(); return; }
      moves++;
      sync();
    }

    /* ---------------- hit testing ---------------- */
    function pileRects() {
      const out = [];
      out.push({ kind: 'stock', x: colX(0), y: TOPY, w: CW, h: CH });
      out.push({ kind: 'waste', x: colX(1), y: TOPY, w: CW, h: CH });
      for (let f = 0; f < 4; f++) out.push({ kind: 'found', i: f, x: colX(3 + f), y: TOPY, w: CW, h: CH });
      for (let t = 0; t < 7; t++) {
        const pile = tab[t];
        let hgt = CH;
        let y = TABY;
        for (let k = 0; k < pile.length; k++) y += k ? (pile[k - 1].up ? FANUP : FANDOWN) : 0;
        hgt = y - TABY + CH;
        out.push({ kind: 'tab', i: t, x: colX(t), y: TABY, w: CW, h: Math.max(CH, hgt) });
      }
      return out;
    }

    function cardY(t, k) {
      let y = TABY;
      const pile = tab[t];
      for (let j = 0; j < k; j++) y += pile[j].up ? FANUP : FANDOWN;
      return y;
    }

    function hit(p) {
      for (const r of pileRects()) {
        if (p.x < r.x || p.x > r.x + r.w || p.y < r.y || p.y > r.y + r.h) continue;
        if (r.kind !== 'tab') return r;
        const pile = tab[r.i];
        for (let k = pile.length - 1; k >= 0; k--) {
          const y = cardY(r.i, k);
          const bottom = k === pile.length - 1 ? y + CH : cardY(r.i, k + 1);
          if (p.y >= y && p.y < bottom) return { kind: 'tab', i: r.i, k };
        }
        return { kind: 'tab', i: r.i, k: -1 };
      }
      return null;
    }

    /* ---------------- moving ---------------- */
    function autoSend(c, fromKind, fromI) {
      for (let f = 0; f < 4; f++) {
        if (!canFound(c, f)) continue;
        pushUndo();
        if (fromKind === 'waste') waste.pop();
        else tab[fromI].pop();
        found[f].push(c);
        moves++;
        flipExposed();
        api.sfx.good();
        sync();
        checkWin();
        return true;
      }
      return false;
    }

    bagg.listen(cv.el, 'pointerdown', (e) => {
      if (won) return;
      const p = cv.pos(e);
      const t = hit(p);
      if (!t) return;
      try { if (cv.el.setPointerCapture) cv.el.setPointerCapture(e.pointerId); } catch (err) { /* no active pointer; harmless */ }

      if (t.kind === 'stock') { drawFromStock(); return; }

      if (t.kind === 'waste') {
        const c = waste[waste.length - 1];
        if (!c) return;
        drag = { cards: [c], from: 'waste', fromI: 0, dx: p.x - colX(1), dy: p.y - TOPY, x: p.x, y: p.y, moved: false };
        return;
      }
      if (t.kind === 'found') {
        const c = found[t.i][found[t.i].length - 1];
        if (!c) return;
        drag = { cards: [c], from: 'found', fromI: t.i, dx: p.x - colX(3 + t.i), dy: p.y - TOPY, x: p.x, y: p.y, moved: false };
        return;
      }
      if (t.kind === 'tab' && t.k >= 0) {
        const pile = tab[t.i];
        const c = pile[t.k];
        if (!c.up) {
          if (t.k === pile.length - 1) { pushUndo(); c.up = true; moves++; api.sfx.click(); sync(); }
          return;
        }
        if (!grabbable(pile, t.k)) return;
        drag = {
          cards: pile.slice(t.k), from: 'tab', fromI: t.i, fromK: t.k,
          dx: p.x - colX(t.i), dy: p.y - cardY(t.i, t.k), x: p.x, y: p.y, moved: false
        };
      }
    });

    bagg.listen(cv.el, 'pointermove', (e) => {
      if (!drag) return;
      const p = cv.pos(e);
      if (Math.abs(p.x - drag.x) > 3 || Math.abs(p.y - drag.y) > 3) drag.moved = true;
      drag.x = p.x; drag.y = p.y;
    });

    function dropDrag() {
      if (!drag) return;
      const d = drag;
      drag = null;

      /* a click with no movement means "send it home if you can" */
      if (!d.moved) {
        if (d.from === 'waste') autoSend(d.cards[0], 'waste');
        else if (d.from === 'tab' && d.cards.length === 1) autoSend(d.cards[0], 'tab', d.fromI);
        return;
      }

      const cx = d.x - d.dx + CW / 2;
      const cy = d.y - d.dy + CH / 2;
      const lead = d.cards[0];

      /* foundations take exactly one card */
      if (d.cards.length === 1) {
        for (let f = 0; f < 4; f++) {
          const x = colX(3 + f);
          if (cx < x - 20 || cx > x + CW + 20 || cy > TOPY + CH + 40) continue;
          if (!canFound(lead, f)) continue;
          pushUndo();
          removeFrom(d);
          found[f].push(lead);
          moves++;
          flipExposed();
          api.sfx.good();
          sync();
          checkWin();
          return;
        }
      }

      for (let t = 0; t < 7; t++) {
        const x = colX(t);
        if (cx < x - 26 || cx > x + CW + 26) continue;
        if (!canTab(lead, t)) continue;
        pushUndo();
        removeFrom(d);
        for (const c of d.cards) tab[t].push(c);
        moves++;
        flipExposed();
        api.sfx.tone({ freq: 300, to: 200, dur: 0.07, type: 'triangle', vol: 0.07 });
        sync();
        checkWin();
        return;
      }
      api.sfx.thud();
    }

    function removeFrom(d) {
      if (d.from === 'waste') waste.pop();
      else if (d.from === 'found') found[d.fromI].pop();
      else tab[d.fromI].splice(d.fromK);
    }

    bagg.listen(cv.el, 'pointerup', dropDrag);
    bagg.listen(cv.el, 'pointercancel', dropDrag);

    /* send everything that can go home, repeatedly */
    function autoFinish() {
      let did = true, guard = 0;
      while (did && guard++ < 200) {
        did = false;
        const w = waste[waste.length - 1];
        if (w && autoSend(w, 'waste')) { did = true; continue; }
        for (let t = 0; t < 7; t++) {
          const pile = tab[t];
          const c = pile[pile.length - 1];
          if (c && c.up && autoSend(c, 'tab', t)) { did = true; break; }
        }
      }
    }

    api.button('New deal', deal);
    api.button('Undo', undo);
    api.button('Send home', autoFinish, 'primary');

    /* ---------------- keyboard play ----------------
       Every real move was reachable only by dragging a card with a mouse or
       finger — a keyboard-only player following the "Z undoes, Space draws"
       how-to text could undo and draw, but could never actually move a
       card. Left/Right cycle a cursor through all 13 piles (stock, waste,
       4 foundations, 7 tableau columns); Enter picks up the pile under the
       cursor (or flips a face-down top card, or draws the stock) and, with
       a run already held, Enter on a different pile attempts to place it
       there using the exact same legality checks the mouse path uses.
       Enter again on the pile you picked up from cancels the hold. */
    let kbCursor = 0, kbHeld = null;
    function findGrabStart(pile) {
      let firstUp = pile.length;
      for (let i = pile.length - 1; i >= 0; i--) { if (pile[i].up) firstUp = i; else break; }
      if (firstUp >= pile.length) return -1;
      for (let i = firstUp; i < pile.length; i++) if (grabbable(pile, i)) return i;
      return -1;
    }
    function kbPileAt(idx) { return pileRects()[Engine.clamp(idx, 0, 12)]; }
    function kbSamePile(a, b) { return a.kind === b.kind && a.i === b.i; }
    function kbPickUp(r) {
      if (r.kind === 'stock') { drawFromStock(); return; }
      if (r.kind === 'waste') {
        const c = waste[waste.length - 1];
        if (c) kbHeld = { cards: [c], from: 'waste', fromI: 0 };
        return;
      }
      if (r.kind === 'found') {
        const c = found[r.i][found[r.i].length - 1];
        if (c) kbHeld = { cards: [c], from: 'found', fromI: r.i };
        return;
      }
      const pile = tab[r.i];
      if (!pile.length) return;
      const top = pile[pile.length - 1];
      if (!top.up) { pushUndo(); top.up = true; moves++; api.sfx.click(); sync(); return; }
      const start = findGrabStart(pile);
      if (start >= 0) kbHeld = { cards: pile.slice(start), from: 'tab', fromI: r.i, fromK: start };
    }
    function kbRemoveHeld() {
      if (kbHeld.from === 'waste') waste.pop();
      else if (kbHeld.from === 'found') found[kbHeld.fromI].pop();
      else tab[kbHeld.fromI].splice(kbHeld.fromK);
    }
    function kbPlace(r) {
      const d = kbHeld, lead = d.cards[0];
      if (r.kind === 'found' && d.cards.length === 1 && canFound(lead, r.i)) {
        pushUndo(); kbRemoveHeld(); found[r.i].push(lead);
        moves++; flipExposed(); api.sfx.good(); sync(); checkWin(); kbHeld = null; return;
      }
      if (r.kind === 'tab' && canTab(lead, r.i)) {
        pushUndo(); kbRemoveHeld();
        for (const c of d.cards) tab[r.i].push(c);
        moves++; flipExposed(); api.sfx.tone({ freq: 300, to: 200, dur: 0.07, type: 'triangle', vol: 0.07 }); sync(); checkWin(); kbHeld = null; return;
      }
      api.sfx.thud();   // an illegal target — nothing moves, hold stays selected
    }
    function kbActivate() {
      if (won) return;
      const r = kbPileAt(kbCursor);
      if (!kbHeld) { kbPickUp(r); return; }
      if (kbSamePile(r, { kind: kbHeld.from === 'tab' ? 'tab' : kbHeld.from, i: kbHeld.fromI })) { kbHeld = null; api.sfx.click(); return; }
      kbPlace(r);
    }

    bagg.add(Engine.onKey((e) => {
      if ((e.key === 'z' || e.key === 'Z') && !e.ctrlKey && !e.metaKey) { undo(); return true; }
      if (e.key === ' ') { drawFromStock(); return true; }
      if (e.key === 'ArrowLeft') { kbCursor = (kbCursor + 12) % 13; return true; }
      if (e.key === 'ArrowRight') { kbCursor = (kbCursor + 1) % 13; return true; }
      if (e.key === 'Enter') { kbActivate(); return true; }
      /* Escape is deliberately left alone here — it's already the site-wide
         "back to shelf" shortcut (js/core/arcade.js), and Engine.onKey
         handlers can't stop that from also firing, so claiming Escape here
         too would silently exit the game instead of just cancelling a hold */
    }));

    /* ---------------- drawing ---------------- */
    function card(x, y, c, dim) {
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      Engine.roundRect(ctx, x + 3, y + 4, CW, CH, 7);
      ctx.fill();

      if (!c.up) {
        const doc = DOC();
        ctx.fillStyle = doc ? '#e5e8ec' : '#2a4bbd';
        Engine.roundRect(ctx, x, y, CW, CH, 7);
        ctx.fill();
        ctx.strokeStyle = doc ? '#2b2f36' : '#0c1119';
        ctx.lineWidth = 3;
        Engine.roundRect(ctx, x, y, CW, CH, 7);
        ctx.stroke();
        ctx.strokeStyle = doc ? 'rgba(43,47,54,.28)' : 'rgba(255,255,255,.28)';
        ctx.lineWidth = 1.5;
        for (let i = -CH; i < CW; i += 9) {
          ctx.beginPath();
          ctx.moveTo(x + Math.max(0, i), y + Math.max(0, -i));
          ctx.lineTo(x + Math.min(CW, i + CH), y + Math.min(CH, CH - i + (i < 0 ? i : 0)));
          ctx.stroke();
        }
        ctx.strokeStyle = doc ? 'rgba(43,47,54,.5)' : 'rgba(255,255,255,.5)';
        ctx.lineWidth = 2;
        Engine.roundRect(ctx, x + 6, y + 6, CW - 12, CH - 12, 4);
        ctx.stroke();
        return;
      }

      ctx.fillStyle = dim ? '#e6e2d5' : '#fffdf3';
      Engine.roundRect(ctx, x, y, CW, CH, 7);
      ctx.fill();
      ctx.strokeStyle = '#0c1119';
      ctx.lineWidth = 3;
      Engine.roundRect(ctx, x, y, CW, CH, 7);
      ctx.stroke();

      const col = isRed(c.s) ? '#d1252b' : '#1d1722';
      ctx.fillStyle = col;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 19px Verdana, sans-serif';
      ctx.fillText(RANKS[c.r], x + 7, y + 6);
      ctx.font = '17px Verdana, sans-serif';
      ctx.fillText(SUITS[c.s], x + 7, y + 26);

      ctx.font = '38px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(SUITS[c.s], x + CW / 2 + 6, y + CH / 2 + 12);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    function slot(x, y, label) {
      const doc = DOC();
      ctx.strokeStyle = doc ? 'rgba(43,47,54,.4)' : 'rgba(255,255,255,.4)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 6]);
      Engine.roundRect(ctx, x, y, CW, CH, 7);
      ctx.stroke();
      ctx.setLineDash([]);
      if (label) {
        ctx.fillStyle = doc ? 'rgba(43,47,54,.5)' : 'rgba(255,255,255,.35)';
        ctx.font = '34px Verdana, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + CW / 2, y + CH / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    }

    function draw(dt) {
      if (winAnim > 0) winAnim += dt;
      const doc = DOC();
      ctx.fillStyle = doc ? '#f2f3f5' : '#1c7a4a';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = doc ? 'rgba(0,0,0,.03)' : 'rgba(0,0,0,.05)';
      for (let y = 0; y < H; y += 8) ctx.fillRect(0, y, W, 3);

      /* stock */
      if (stock.length) card(colX(0), TOPY, { up: false });
      else slot(colX(0), TOPY, redealsLeft > 0 ? '↺' : '✕');
      if (stock.length) {
        ctx.fillStyle = doc ? '#2b2f36' : '#fffdf3';
        ctx.font = 'bold 12px Verdana, sans-serif';
        ctx.fillText(String(stock.length), colX(0) + 4, TOPY + CH + 15);
      }

      /* waste, fanned when drawing three */
      if (waste.length) {
        const show = Math.min(DRAW === 3 ? 3 : 1, waste.length);
        for (let i = show - 1; i >= 0; i--) {
          const c = waste[waste.length - 1 - i];
          const hidden = drag && drag.from === 'waste' && i === 0;
          if (hidden) continue;
          card(colX(1) + (show - 1 - i) * 18, TOPY, c);
        }
      } else slot(colX(1), TOPY);

      /* foundations */
      for (let f = 0; f < 4; f++) {
        const pile = found[f];
        const hidden = drag && drag.from === 'found' && drag.fromI === f;
        const top = pile[pile.length - (hidden ? 2 : 1)];
        if (top) card(colX(3 + f), TOPY, top);
        else slot(colX(3 + f), TOPY, SUITS[f]);
      }

      /* tableau */
      for (let t = 0; t < 7; t++) {
        const pile = tab[t];
        const cut = (drag && drag.from === 'tab' && drag.fromI === t) ? drag.fromK : pile.length;
        if (!cut) slot(colX(t), TABY);
        for (let k = 0; k < cut; k++) card(colX(t), cardY(t, k), pile[k]);
      }

      /* keyboard cursor + held-run highlight */
      const kbRect = pileRects()[kbCursor];
      ctx.save();
      ctx.strokeStyle = '#ffcb1f';
      ctx.lineWidth = 4;
      Engine.roundRect(ctx, kbRect.x - 4, kbRect.y - 4, kbRect.w + 8, kbRect.h + 8, 10);
      ctx.stroke();
      ctx.restore();
      if (kbHeld) {
        ctx.save();
        ctx.strokeStyle = '#33c0d0';
        ctx.lineWidth = 4;
        if (kbHeld.from === 'tab') {
          const y0 = cardY(kbHeld.fromI, kbHeld.fromK);
          const yEnd = cardY(kbHeld.fromI, tab[kbHeld.fromI].length - 1) + CH;
          Engine.roundRect(ctx, colX(kbHeld.fromI) - 4, y0 - 4, CW + 8, yEnd - y0 + 8, 10);
        } else if (kbHeld.from === 'waste') {
          Engine.roundRect(ctx, colX(1) - 4, TOPY - 4, CW + 8, CH + 8, 10);
        } else if (kbHeld.from === 'found') {
          Engine.roundRect(ctx, colX(3 + kbHeld.fromI) - 4, TOPY - 4, CW + 8, CH + 8, 10);
        }
        ctx.stroke();
        ctx.restore();
      }

      /* the card(s) in hand */
      if (drag) {
        drag.cards.forEach((c, i) => {
          card(drag.x - drag.dx, drag.y - drag.dy + i * FANUP, c);
        });
      }

      if (won) {
        ctx.fillStyle = 'rgba(12,17,25,' + clamp(winAnim * 0.5, 0, 0.66).toFixed(2) + ')';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffcb1f';
        ctx.font = '58px Impact, Haettenschweiler, Arial Black, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('YOU WIN', W / 2, H / 2);
        ctx.textAlign = 'left';
      }
    }

    deal();
    bagg.add(Engine.loop(draw));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'solitaire',
    lightBoard: true,   // light card faces would invert to solid black under the figure flip
    title: 'Solitaire',
    emoji: 'solitaire',
    cat: 'puzzle',
    order: 15,
    blurb: 'Klondike solitaire. Build the four foundations up from Ace to King, one suit each.',
    scoreLabel: 'Games won',
    tags: ['klondike', 'cards', 'patience', 'classic'],
    how: [
      'Build the four foundations from Ace to King, one suit each.',
      'In the columns, stack down in alternating colours. Only a King fills an empty column.',
      'Drag a card and any proper run on top of it moves too.',
      'Click a card without dragging to send it home. Send home clears everything that can go.',
      'Z undoes, Space draws. Keyboard only: Left/Right move a cursor between piles, Enter picks up or places a run, Enter again on the same pile cancels the hold.',
      'Chill and normal draw one card with unlimited redeals. Hard draws three with two redeals, nightmare with one.'
    ],
    mount
  });
})();
