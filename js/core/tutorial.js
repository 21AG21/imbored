/* A tiny looping "how to play" animation for the how-to panel. One small canvas
 * that mimes the game's controls — arrow keys pressing, a cursor clicking, a
 * finger tapping, letters typing, a brush dragging. Driven by a control scheme
 * string so every game gets one; the arcade maps each game to a scheme + goal.
 * Reads theme CSS variables so it recolours with the rest of the site, and
 * falls still (single frame) under prefers-reduced-motion. */
(function () {
  'use strict';
  const { h, roundRect } = Engine;
  const W = 340, H = 128;

  function palette() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name, d) => { const s = cs.getPropertyValue(name).trim(); return s || d; };
    return {
      ink: v('--ink', '#2a2118'),
      panel: v('--panel', '#efe7d6'),
      label: v('--label', '#e7dcc4'),
      accent: v('--lime', '') || v('--accent', '') || '#5aa64b',
      warn: v('--banana', '#f2c14e'),
      dim: v('--ink3', '#8a8172')
    };
  }

  /* --- little primitives --- */
  function cap(ctx, x, y, w, hh, label, down, c) {
    const r = 6;
    ctx.fillStyle = c.ink; roundRect(ctx, x, y + 3, w, hh, r); ctx.fill();      // drop
    const oy = down ? 2 : 0;
    ctx.fillStyle = down ? c.accent : c.panel; roundRect(ctx, x, y + oy, w, hh, r); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = c.ink; roundRect(ctx, x, y + oy, w, hh, r); ctx.stroke();
    ctx.fillStyle = down ? '#fff' : c.ink;
    ctx.font = '700 15px system-ui, "Segoe UI", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + oy + hh / 2 + 1);
  }
  function cursor(ctx, x, y, c) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 17); ctx.lineTo(4.5, 12.5);
    ctx.lineTo(8, 19); ctx.lineTo(10.5, 18); ctx.lineTo(7, 11.5); ctx.lineTo(13, 11); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = c.ink; ctx.stroke();
    ctx.restore();
  }
  function ripple(ctx, x, y, p, c) {   // p 0..1
    if (p <= 0 || p >= 1) return;
    ctx.beginPath(); ctx.arc(x, y, 4 + p * 20, 0, 7);
    ctx.strokeStyle = c.accent; ctx.globalAlpha = 1 - p; ctx.lineWidth = 3; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const saw = (t, period) => (t % period) / period;              // 0..1 ramp
  const pulse = (t, period, duty) => (t % period) < (duty || period * 0.35);

  /* --- per-scheme frames --- */
  function drawArrows(ctx, t, c, letters) {
    const seq = letters ? ['W', 'A', 'S', 'D'] : ['▲', '◀', '▼', '▶'];
    const dirs = letters ? [[0, -1], [-1, 0], [0, 1], [1, 0]] : [[0, -1], [-1, 0], [0, 1], [1, 0]];
    const active = Math.floor(saw(t, 3.2) * 4) % 4;
    const cx = 96, y0 = 24, kw = 30, kh = 30, gap = 4;
    // inverted-T: up top-centre, left/down/right bottom row
    const pos = [
      [cx, y0], [cx - kw - gap, y0 + kh + gap], [cx, y0 + kh + gap], [cx + kw + gap, y0 + kh + gap]
    ];
    for (let i = 0; i < 4; i++) cap(ctx, pos[i][0], pos[i][1], kw, kh, seq[i], i === active, c);
    // a token that nudges in the active direction
    const bx = 232, by = 58, d = dirs[active];
    ctx.fillStyle = c.ink; roundRect(ctx, bx - 15, by - 15, 30, 30, 6); ctx.fill();
    ctx.fillStyle = c.accent;
    roundRect(ctx, bx - 12 + d[0] * 7, by - 12 + d[1] * 7, 24, 24, 5); ctx.fill();
  }
  function drawLeftRight(ctx, t, c) {
    const active = pulse(t, 1.4, 0.7) ? 0 : 1;
    const cy = 40, kw = 40, kh = 34;
    cap(ctx, 44, cy, kw, kh, '◀', active === 0, c);
    cap(ctx, 44 + kw + 8, cy, kw, kh, '▶', active === 1, c);
    const path = 150, x = 210 + Math.sin(t * 2.6) * 42;
    ctx.strokeStyle = c.dim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(168, 92); ctx.lineTo(168 + 92, 92); ctx.stroke();
    ctx.fillStyle = c.accent; roundRect(ctx, x - 13, 74, 26, 14, 4); ctx.fill();
    ctx.strokeStyle = c.ink; ctx.lineWidth = 2; roundRect(ctx, x - 13, 74, 26, 14, 4); ctx.stroke();
  }
  function drawSpace(ctx, t, c) {
    const down = pulse(t, 1.0, 0.3);
    cap(ctx, 70, 82, 200, 30, 'SPACE', down, c);
    // a hopper that rises on press
    const hop = down ? 1 - Math.abs(0.5 - saw(t, 1.0)) * 2 : 0;
    const y = 60 - hop * 30;
    ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(170, y, 11, 0, 7); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = c.ink; ctx.stroke();
    ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(174, y - 2, 2.2, 0, 7); ctx.fill();
  }
  function drawClick(ctx, t, c) {
    // a target that relocates each cycle; the cursor eases in and clicks
    const spots = [[110, 44], [230, 40], [190, 86], [96, 88]];
    const per = 1.5, idx = Math.floor(t / per) % spots.length;
    const nxt = spots[idx], prv = spots[(idx + spots.length - 1) % spots.length];
    const p = saw(t, per), e = p < 0.7 ? (p / 0.7) : 1;               // ease to target by 70%
    const ee = e * e * (3 - 2 * e);
    const cxp = prv[0] + (nxt[0] - prv[0]) * ee, cyp = prv[1] + (nxt[1] - prv[1]) * ee;
    // target
    ctx.strokeStyle = c.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(nxt[0], nxt[1], 15, 0, 7); ctx.stroke();
    ctx.fillStyle = c.warn; ctx.beginPath(); ctx.arc(nxt[0], nxt[1], 8, 0, 7); ctx.fill();
    ctx.strokeStyle = c.ink; ctx.beginPath(); ctx.arc(nxt[0], nxt[1], 8, 0, 7); ctx.stroke();
    if (p > 0.72) ripple(ctx, nxt[0], nxt[1], (p - 0.72) / 0.28, c);
    cursor(ctx, cxp, cyp, c);
  }
  function drawTap(ctx, t, c) {
    const spots = [[120, 52], [220, 48], [170, 92]];
    const per = 0.9, idx = Math.floor(t / per) % spots.length, s = spots[idx], p = saw(t, per);
    ripple(ctx, s[0], s[1], p, c);
    // a finger: a rounded blob dipping toward the spot
    const dip = Math.max(0, 1 - Math.abs(0.25 - p) * 4);
    const fy = s[1] + 30 - dip * 14;
    ctx.fillStyle = c.panel; ctx.strokeStyle = c.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(s[0], fy + 14, 12, 18, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(s[0], fy, 9, 0, 7); ctx.fillStyle = c.panel; ctx.fill(); ctx.stroke();
  }
  function drawType(ctx, t, c) {
    const word = 'TYPE'; const per = 3.4; const p = saw(t, per);
    const shown = Math.min(word.length, Math.floor(p * (word.length + 2)));
    const box = { x: 70, y: 44, w: 200, h: 40 };
    ctx.fillStyle = c.panel; roundRect(ctx, box.x, box.y, box.w, box.h, 6); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = c.ink; roundRect(ctx, box.x, box.y, box.w, box.h, 6); ctx.stroke();
    ctx.fillStyle = c.ink; ctx.font = '700 20px "Courier New", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const txt = word.slice(0, shown); ctx.fillText(txt, box.x + 14, box.y + box.h / 2 + 1);
    const cw = ctx.measureText(txt).width;
    if (pulse(t, 0.7, 0.5)) { ctx.fillStyle = c.accent; ctx.fillRect(box.x + 14 + cw + 2, box.y + 9, 3, box.h - 18); }
  }
  function drawDrag(ctx, t, c) {
    const per = 3.0, p = saw(t, per);
    // a wandering path the cursor draws
    const N = 40, upto = Math.floor(p * N);
    ctx.lineWidth = 7; ctx.strokeStyle = c.accent; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    let px = 0, py = 0;
    for (let i = 0; i <= upto; i++) {
      const u = i / N;
      const x = 60 + u * 220, y = 64 + Math.sin(u * 7) * 26 + Math.cos(u * 3) * 8;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      px = x; py = y;
    }
    ctx.stroke();
    if (upto >= 0 && upto < N) cursor(ctx, px, py, c);
  }

  const SCHEMES = {
    arrows: (ctx, t, c) => drawArrows(ctx, t, c, false),
    wasd: (ctx, t, c) => drawArrows(ctx, t, c, true),
    leftright: drawLeftRight,
    space: drawSpace,
    click: drawClick,
    aim: drawClick,
    tap: drawTap,
    type: drawType,
    drag: drawDrag
  };

  Engine.tutorial = function tutorial(spec) {
    spec = spec || {};
    const draw = SCHEMES[spec.scheme] || SCHEMES.click;
    const wrap = h('div', { class: 'tut' });
    const cv = document.createElement('canvas');
    cv.className = 'tut-canvas';
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * DPR; cv.height = H * DPR;
    const ctx = cv.getContext('2d');
    ctx.scale(DPR, DPR);
    wrap.appendChild(cv);
    if (spec.goal) wrap.appendChild(h('div', { class: 'tut-goal' }, spec.goal));

    function frame(t) {
      const c = palette();
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = c.label; ctx.fillRect(0, 0, W, H);
      try { draw(ctx, t, c); } catch (e) { /* never let the demo break the panel */ }
    }

    let stop = null, base = 0;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function start() {
      if (reduced) { frame(0.6); return; }
      if (stop) return;
      base = performance.now();
      stop = Engine.loop(() => frame((performance.now() - base) / 1000));
    }
    function halt() { if (stop) { stop(); stop = null; } }
    frame(0.6);                       // a still first frame so it isn't blank before opening
    return { el: wrap, start, halt, dispose: halt };
  };
})();
