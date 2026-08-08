/* Load Balance. Hold a power grid on frequency through a whole day. */
(function () {
  'use strict';
  const { h, clamp, rand, randInt, pick } = Engine;

  const W = 900, H = 340;
  const HOURS_PER_SEC = 0.4;          // a 24h day every 60 seconds
  const HIST = 220;

  function mount(root, api) {
    const bagg = Engine.bag();
    const cv = Engine.canvas(root, W, H);
    const ctx = cv.ctx;
    const dm = api.dm;

    const pClock = api.pill('06:00');
    const pFreq = api.pill('50.00 Hz');
    const pScore = api.pill('Day 1 · 0 h');
    const banner = h('div', { class: 'banner', style: { display: 'none' } });

    const panels = h('div', { class: 'panelrow' });
    root.appendChild(panels);
    root.appendChild(banner);

    let S, hist, over;

    /* controllable plants */
    const SPECS = [
      { id: 'coal', name: 'Coal', icon: 'over', cap: 62, ramp: 4.5, cost: 26, co2: 0.95, min: 22, note: 'cheap, slow, filthy' },
      { id: 'gas', name: 'Gas peaker', icon: 'boom', cap: 46, ramp: 34, cost: 78, co2: 0.42, min: 0, note: 'instant, expensive' },
      { id: 'hydro', name: 'Hydro', icon: 'reports', cap: 30, ramp: 16, cost: 12, co2: 0, min: 0, note: 'limited reservoir' }
    ];

    function reset() {
      S = {
        hour: 6, day: 1, hours: 0,
        set: { coal: 55, gas: 0, hydro: 30 },
        out: { coal: 55 * 0.62, gas: 0, hydro: 9 },
        reservoir: 100,
        battery: 62, batterySet: 0,
        wind: 0.5, windTrend: 0, cloud: 1, cloudT: 0,
        surge: 0, surgeT: 0, tripT: 0,
        freq: 50, stability: 100,
        cost: 0, co2: 0,
        eventText: '', eventT: 0
      };
      /* open the day already balanced, so the first move is yours and not a rescue */
      const need = demandAt(S.hour, S.day) - S.out.hydro - solar() - windOut();
      S.set.coal = Math.round(clamp(need / 62 * 100, 22, 100));
      S.out.coal = 62 * S.set.coal / 100;
      S.freq = 50;

      hist = [];
      over = false;
      banner.style.display = 'none';
      syncControls();
      api.status('Match generation to demand. Frequency drifts the moment they disagree.');
    }

    /* ---------------- demand model ---------------- */
    const bell = (x, mu, s) => Math.exp(-((x - mu) * (x - mu)) / s);
    function demandAt(hour, day) {
      const h24 = ((hour % 24) + 24) % 24;
      let d = 46
        + 26 * bell(h24, 8.5, 7)
        + 40 * bell(h24, 19.5, 11)
        + 10 * bell(h24, 13, 14)
        - 16 * bell(h24, 3.5, 10);
      d *= 1 + (day - 1) * 0.09 * dm;
      return d;
    }
    const sunAt = (hour) => {
      const h24 = ((hour % 24) + 24) % 24;
      return clamp(Math.sin((h24 - 6) / 12 * Math.PI), 0, 1);
    };

    /* ---------------- controls ---------------- */
    const sliders = {};
    function buildControls() {
      SPECS.forEach((sp) => {
        const range = h('input', {
          class: 'slider', type: 'range', min: 0, max: 100, value: 50,
          oninput: () => { S.set[sp.id] = +range.value; syncControls(); }
        });
        sliders[sp.id] = range;
        const outEl = h('span', { class: 'val' }, '0');
        const setEl = h('span', { class: 'val' }, '0%');
        sliders[sp.id + ':out'] = outEl;
        sliders[sp.id + ':set'] = setEl;
        panels.appendChild(h('div', { class: 'panel plant' },
          h('h4', null, Engine.h('span', { class: 'ico-wrap', html: Icons.svg(sp.icon, 16) }), ' ' + sp.name),
          range,
          h('div', { class: 'row' }, h('span', null, 'setpoint'), setEl),
          h('div', { class: 'row' }, h('span', null, 'output'), outEl),
          h('div', { class: 'row' }, h('span', null, sp.note), h('span', { class: 'val' }, sp.cap + ' MW'))));
      });

      const bat = h('input', {
        class: 'slider', type: 'range', min: -100, max: 100, value: 0,
        oninput: () => { S.batterySet = +bat.value; syncControls(); }
      });
      sliders.bat = bat;
      const batOut = h('span', { class: 'val' }, '0');
      const batCharge = h('span', { class: 'val' }, '100%');
      sliders['bat:out'] = batOut;
      sliders['bat:charge'] = batCharge;
      panels.appendChild(h('div', { class: 'panel plant' },
        h('h4', null, 'Battery'),
        bat,
        h('div', { class: 'row' }, h('span', null, 'charge ⟷ discharge'), batOut),
        h('div', { class: 'row' }, h('span', null, 'state of charge'), batCharge),
        h('div', { class: 'row' }, h('span', null, 'fast but small'), h('span', { class: 'val' }, '34 MW')),
        h('button', {
          class: 'btn', type: 'button', style: { marginTop: '8px', width: '100%' },
          onclick: () => { bat.value = 0; S.batterySet = 0; syncControls(); }
        }, 'Idle battery')));

      const ren = h('div', { class: 'panel plant' },
        h('h4', null, 'Renewables'),
        h('div', { class: 'row' }, h('span', null, 'solar'), h('span', { class: 'val', id: 'pg-solar' }, '0')),
        h('div', { class: 'row' }, h('span', null, 'wind'), h('span', { class: 'val', id: 'pg-wind' }, '0')),
        h('div', { class: 'row' }, h('span', null, 'reservoir'), h('span', { class: 'val', id: 'pg-res' }, '100%')),
        h('div', { class: 'row' }, h('span', null, 'not yours to command'), h('span', { class: 'val' }, '--')));
      panels.appendChild(ren);
    }

    function syncControls() {
      SPECS.forEach((sp) => {
        sliders[sp.id].value = S.set[sp.id];
        sliders[sp.id + ':set'].textContent = Math.round(S.set[sp.id]) + '%';
        sliders[sp.id + ':out'].textContent = S.out[sp.id].toFixed(1) + ' MW';
      });
      sliders['bat:out'].textContent = (S.batterySet === 0 ? 'idle' :
        (S.batterySet > 0 ? '+' : '') + (34 * S.batterySet / 100).toFixed(1) + ' MW');
      sliders['bat:charge'].textContent = Math.round(S.battery) + '%';
      const so = document.getElementById('pg-solar');
      const wi = document.getElementById('pg-wind');
      const re = document.getElementById('pg-res');
      if (so) so.textContent = solar().toFixed(1) + ' MW';
      if (wi) wi.textContent = windOut().toFixed(1) + ' MW';
      if (re) re.textContent = Math.round(S.reservoir) + '%';
    }

    const solar = () => 54 * sunAt(S.hour) * S.cloud;
    const windOut = () => 38 * S.wind;

    /* ---------------- events ---------------- */
    const EVENTS = [
      { text: 'Cloud front rolling in. Solar is dropping.', run: () => { S.cloud = 0.18; S.cloudT = 16; } },
      { text: 'Wind is dying off.', run: () => { S.wind = 0.08; S.windTrend = 0.02; } },
      { text: 'Gusty front. Wind is surging.', run: () => { S.wind = 0.95; S.windTrend = -0.03; } },
      { text: 'Smelter kicked on. Demand spike incoming.', run: () => { S.surge = 26; S.surgeT = 18; } },
      { text: 'Coal unit tripped offline! Restart it.', run: () => { S.tripT = 9; S.out.coal = 0; } },
      { text: 'Cold snap. Everyone turned the heat up.', run: () => { S.surge = 18; S.surgeT = 26; } }
    ];
    let eventTimer = 14;

    /* ---------------- simulation ---------------- */
    function update(dt) {
      if (over) return;

      const prevHour = S.hour;
      S.hour += dt * HOURS_PER_SEC;
      S.hours += dt * HOURS_PER_SEC;
      if (Math.floor(S.hour / 24) > Math.floor(prevHour / 24)) {
        S.day++;
        S.reservoir = Math.min(100, S.reservoir + 25);
        flash('Day ' + S.day + '. Demand is up again.');
      }

      /* weather drifts */
      S.windTrend += rand(-0.5, 0.5) * dt;
      S.windTrend = clamp(S.windTrend, -0.25, 0.25);
      S.wind = clamp(S.wind + S.windTrend * dt, 0.03, 1);
      if (S.cloudT > 0) { S.cloudT -= dt; if (S.cloudT <= 0) S.cloud = 1; }
      else S.cloud = clamp(S.cloud + rand(-0.3, 0.3) * dt, 0.55, 1);
      if (S.surgeT > 0) { S.surgeT -= dt; if (S.surgeT <= 0) S.surge = 0; }
      if (S.tripT > 0) S.tripT -= dt;

      eventTimer -= dt;
      if (eventTimer <= 0) {
        const ev = pick(EVENTS);
        ev.run();
        flash(ev.text);
        eventTimer = rand(16, 30) / dm;
      }

      /* dispatchable ramps */
      for (const sp of SPECS) {
        let target = sp.cap * S.set[sp.id] / 100;
        if (sp.id === 'coal') {
          if (S.tripT > 0) target = 0;
          else if (S.set[sp.id] > 0) target = Math.max(sp.cap * sp.min / 100, target);
        }
        if (sp.id === 'hydro' && S.reservoir <= 0) target = 0;
        const step = sp.cap * sp.ramp / 100 * dt;
        S.out[sp.id] += clamp(target - S.out[sp.id], -step, step);
        S.out[sp.id] = clamp(S.out[sp.id], 0, sp.cap);
        S.cost += S.out[sp.id] * sp.cost * dt * HOURS_PER_SEC / 1000;
        S.co2 += S.out[sp.id] * sp.co2 * dt * HOURS_PER_SEC / 100;
      }
      S.reservoir = clamp(S.reservoir - S.out.hydro * dt * HOURS_PER_SEC * 0.12, 0, 100);

      /* battery */
      let batPower = 34 * S.batterySet / 100;
      if (batPower > 0 && S.battery <= 0) batPower = 0;
      if (batPower < 0 && S.battery >= 100) batPower = 0;
      S.battery = clamp(S.battery - batPower * dt * HOURS_PER_SEC * 1.6, 0, 100);

      const supply = S.out.coal + S.out.gas + S.out.hydro + solar() + windOut() + Math.max(0, batPower);
      const demand = demandAt(S.hour, S.day) + S.surge + Math.max(0, -batPower);

      const imbalance = (supply - demand) / Math.max(20, demand);
      const targetFreq = 50 + clamp(imbalance, -0.35, 0.35) * 7.5;
      S.freq += (targetFreq - S.freq) * Math.min(1, dt * 2.2);

      const dev = Math.abs(S.freq - 50);
      if (dev > 0.45) S.stability = clamp(S.stability - (dev - 0.45) * 46 * dm * dt, 0, 100);
      else S.stability = clamp(S.stability + 11 * dt, 0, 100);
      if (S.stability <= 0) return blackout();

      hist.push({ d: demand, s: supply, f: S.freq, sun: sunAt(S.hour) });
      if (hist.length > HIST) hist.shift();

      if (S.eventT > 0) S.eventT -= dt;

      pClock.textContent = String(Math.floor(S.hour % 24)).padStart(2, '0') + ':' +
        String(Math.floor((S.hour % 1) * 60)).padStart(2, '0');
      pFreq.textContent = S.freq.toFixed(2) + ' Hz';
      pFreq.className = 'pill ' + (dev > 0.8 ? 'bad' : dev > 0.45 ? 'warn' : 'good');
      pScore.textContent = 'Day ' + S.day + ' · ' + Math.floor(S.hours) + ' h online';
      syncControls();
    }

    function flash(text) { S.eventText = text; S.eventT = 6; api.sfx.blip(420); }

    function blackout() {
      over = true;
      api.sfx.boom();
      const hours = Math.floor(S.hours);
      const res = api.submit(hours);
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, 'Blackout.'),
        h('p', null, 'You held the grid for ' + hours + ' hours (' + (hours / 24).toFixed(1) + ' days), ' +
          'spent $' + S.cost.toFixed(1) + 'M and vented ' + S.co2.toFixed(1) + ' kt of CO₂.' +
          (res.isRecord ? ' New personal best!' : res.isFirst ? '' : ' Best: ' + res.best + ' h.')),
        h('button', { class: 'btn primary', type: 'button', onclick: reset }, 'Restore power'));
    }

    /* ---------------- render ---------------- */
    function draw() {
      ctx.fillStyle = '#0a1020';
      ctx.fillRect(0, 0, W, H);

      const gx = 56, gy = 26, gw = W - 200, gh = H - 80;
      let maxV = 120;
      for (const p of hist) maxV = Math.max(maxV, p.d, p.s);
      maxV *= 1.08;

      /* night shading */
      for (let i = 0; i < hist.length; i++) {
        const x = gx + i / HIST * gw;
        ctx.fillStyle = 'rgba(255,200,60,' + (hist[i].sun * 0.07).toFixed(3) + ')';
        ctx.fillRect(x, gy, gw / HIST + 1, gh);
      }

      ctx.strokeStyle = '#1e2740';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) {
        const y = gy + gh * i / 4;
        ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y);
      }
      ctx.stroke();
      ctx.fillStyle = '#5f6a86';
      ctx.font = '11px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        ctx.fillText(Math.round(maxV * (1 - i / 4)) + '', gx - 8, gy + gh * i / 4 + 4);
      }

      const line = (key, color, width) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        hist.forEach((p, i) => {
          const x = gx + i / HIST * gw;
          const y = gy + gh * (1 - p[key] / maxV);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.stroke();
      };
      line('d', '#ff5c8f', 2.4);
      line('s', '#38e1ff', 2.4);

      ctx.textAlign = 'left';
      ctx.font = 'bold 12px system-ui';
      ctx.fillStyle = '#ff5c8f'; ctx.fillText('demand', gx + 6, gy + 16);
      ctx.fillStyle = '#38e1ff'; ctx.fillText('generation', gx + 74, gy + 16);

      /* frequency dial */
      const cx = W - 100, cy = 118, R = 62;
      ctx.strokeStyle = '#1e2740';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(cx, cy, R, Math.PI * 0.75, Math.PI * 2.25);
      ctx.stroke();
      ctx.strokeStyle = '#2c8f4a';
      ctx.beginPath();
      ctx.arc(cx, cy, R, Math.PI * 1.42, Math.PI * 1.58);
      ctx.stroke();
      const t = clamp((S.freq - 48) / 4, 0, 1);
      const ang = Math.PI * 0.75 + t * Math.PI * 1.5;
      const dev = Math.abs(S.freq - 50);
      ctx.strokeStyle = dev > 0.8 ? '#ff4d5e' : dev > 0.45 ? '#ffc043' : '#4ade5e';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * (R - 8), cy + Math.sin(ang) * (R - 8));
      ctx.stroke();
      ctx.fillStyle = '#e8ecf7';
      ctx.font = 'bold 19px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(S.freq.toFixed(2), cx, cy + 40);
      ctx.fillStyle = '#5f6a86';
      ctx.font = '11px system-ui';
      ctx.fillText('grid frequency (Hz)', cx, cy + 56);

      /* stability bar */
      ctx.fillStyle = '#141c30';
      Engine.roundRect(ctx, W - 168, H - 46, 140, 14, 7);
      ctx.fill();
      ctx.fillStyle = S.stability > 55 ? '#4ade5e' : S.stability > 25 ? '#ffc043' : '#ff4d5e';
      Engine.roundRect(ctx, W - 168, H - 46, 140 * S.stability / 100, 14, 7);
      ctx.fill();
      ctx.fillStyle = '#8f9ab8';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('grid stability', W - 98, H - 54);

      /* event ticker */
      if (S.eventT > 0) {
        ctx.globalAlpha = clamp(S.eventT / 1.4, 0, 1);
        ctx.fillStyle = 'rgba(20,28,48,.94)';
        Engine.roundRect(ctx, gx, H - 52, gw, 30, 8);
        ctx.fill();
        ctx.fillStyle = '#ffd98a';
        ctx.font = 'bold 13px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(S.eventText, gx + 14, H - 32);
        ctx.globalAlpha = 1;
      }
      ctx.textAlign = 'left';
    }

    buildControls();
    api.button('Restart', () => { reset(); eventTimer = 14; });
    api.button('Balance now', () => {
      /* one-shot nudge: throw gas at whatever gap exists right now */
      const demand = demandAt(S.hour, S.day) + S.surge;
      const others = S.out.coal + S.out.hydro + solar() + windOut();
      const need = clamp((demand - others) / 46 * 100, 0, 100);
      S.set.gas = Math.round(need);
      syncControls();
    }, 'primary');

    reset();
    bagg.add(Engine.loop((dt) => { update(dt); draw(); }));
    let rafId = 0;
    (function paint() { rafId = requestAnimationFrame(paint); if (Engine.paused) draw(); })();
    bagg.add(() => cancelAnimationFrame(rafId));
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'powergrid',
    title: 'Load Balance',
    emoji: 'powergrid',
    cat: 'sim',
    order: 3,
    blurb: 'Generation has to equal demand every single second or the lights go out. Solar and wind will not be helping.',
    scoreLabel: 'Hours online',
    tags: ['power', 'grid', 'energy', 'frequency'],
    how: [
      'Keep the cyan generation line sitting on top of the pink demand line.',
      'Coal is cheap and slow. Gas is instant and costs a fortune. Hydro drains a reservoir that only refills overnight.',
      'Solar and wind do whatever they want. Plan around them, not with them.',
      'The battery pushes 34 MW either way but it is tiny. Fill it overnight, spend it at the evening peak.',
      'Frequency drifts off 50 Hz the moment supply and demand disagree. Stability drains while it is off band. At zero, blackout.'
    ],
    mount
  });
})();
