/* Soundboard. A grid of buttons that make ridiculous noises, all synthesised on
 * the fly with the Web Audio API — no sound files, nothing downloaded. For
 * punctuating meetings you are only half-attending. */
(function () {
  'use strict';
  const { h } = Engine;
  const A = Engine.audio;

  const SOUNDS = [
    { label: 'Air horn', emoji: '📢', key: '1', play: () => { [0, -5, 4].forEach((d) => A.tone({ freq: 233 * Math.pow(2, d / 12), to: 320, dur: 0.6, type: 'sawtooth', vol: 0.12 })); A.tone({ freq: 466, to: 640, dur: 0.6, type: 'square', vol: 0.05 }); } },
    { label: 'Sad trombone', emoji: '🎺', key: '2', play: () => { [[311, 277], [277, 247], [247, 220], [220, 165]].forEach((n, i) => A.tone({ freq: n[0], to: n[1], dur: i === 3 ? 0.55 : 0.26, type: 'sawtooth', vol: 0.14, delay: i * 0.27 })); } },
    { label: 'Rimshot', emoji: '🥁', key: '3', play: () => { A.tone({ freq: 180, to: 80, dur: 0.12, type: 'sine', vol: 0.2 }); A.tone({ freq: 180, to: 80, dur: 0.12, type: 'sine', vol: 0.2, delay: 0.16 }); A.noise({ dur: 0.4, cutoff: 9000, vol: 0.12 }); A.noise({ dur: 0.5, cutoff: 9000, vol: 0.12 }); setTimeout(() => A.noise({ dur: 0.5, cutoff: 9000, vol: 0.14 }), 320); } },
    { label: 'Applause', emoji: '👏', key: '4', play: () => { for (let i = 0; i < 22; i++) A.noise({ dur: 0.12, cutoff: 3000, vol: 0.06, delay: i * 0.06 + Math.random() * 0.03 }); } },
    { label: 'Boing', emoji: '🤸', key: '5', play: () => { A.tone({ freq: 620, to: 180, dur: 0.28, type: 'sine', vol: 0.16 }); A.tone({ freq: 180, to: 380, dur: 0.2, type: 'sine', vol: 0.1, delay: 0.26 }); } },
    { label: 'Vine boom', emoji: '💥', key: '6', play: () => { A.tone({ freq: 74, to: 36, dur: 0.55, type: 'sine', vol: 0.3 }); A.noise({ dur: 0.22, cutoff: 220, vol: 0.16 }); } },
    { label: 'Coin', emoji: '🪙', key: '7', play: () => { A.tone({ freq: 988, dur: 0.08, type: 'square', vol: 0.12 }); A.tone({ freq: 1319, dur: 0.5, type: 'square', vol: 0.1, delay: 0.08 }); } },
    { label: 'Wrong!', emoji: '❌', key: '8', play: () => { A.tone({ freq: 130, dur: 0.5, type: 'sawtooth', vol: 0.16 }); A.tone({ freq: 123, dur: 0.5, type: 'sawtooth', vol: 0.16 }); } },
    { label: 'Ding!', emoji: '🛎️', key: '9', play: () => { A.tone({ freq: 1047, dur: 0.5, type: 'sine', vol: 0.14 }); A.tone({ freq: 2093, dur: 0.4, type: 'sine', vol: 0.05 }); } },
    { label: 'Fanfare', emoji: '🎉', key: 'q', play: () => { [392, 523, 659, 784].forEach((f, i) => A.tone({ freq: f, dur: i === 3 ? 0.6 : 0.14, type: 'triangle', vol: 0.12, delay: i * 0.11 })); } },
    { label: 'Toot', emoji: '💨', key: 'w', play: () => { A.tone({ freq: 116, to: 70, dur: 0.4, type: 'sawtooth', vol: 0.16 }); A.tone({ freq: 118, to: 74, dur: 0.4, type: 'square', vol: 0.06 }); } },
    { label: 'Scratch', emoji: '💿', key: 'e', play: () => { A.noise({ dur: 0.16, cutoff: 2400, vol: 0.14 }); A.tone({ freq: 800, to: 200, dur: 0.15, type: 'sawtooth', vol: 0.1 }); A.tone({ freq: 260, to: 900, dur: 0.15, type: 'sawtooth', vol: 0.1, delay: 0.16 }); A.noise({ dur: 0.16, cutoff: 2400, vol: 0.14, delay: 0.16 }); } },
    { label: 'Crickets', emoji: '🦗', key: 'r', play: () => { for (let i = 0; i < 4; i++) { A.tone({ freq: 4200, dur: 0.015, type: 'square', vol: 0.08, delay: i * 0.5 }); A.tone({ freq: 4200, dur: 0.015, type: 'square', vol: 0.08, delay: i * 0.5 + 0.08 }); } } },
    { label: 'Bruh', emoji: '😐', key: 't', play: () => { A.tone({ freq: 164, to: 120, dur: 0.42, type: 'sawtooth', vol: 0.16 }); } },
    { label: 'Drumroll', emoji: '🥁', key: 'a', play: () => { for (let i = 0; i < 24; i++) A.noise({ dur: 0.05, cutoff: 2000, vol: 0.05 + i * 0.003, delay: i * 0.05 }); A.noise({ dur: 0.6, cutoff: 9000, vol: 0.16, delay: 1.25 }); A.tone({ freq: 120, to: 60, dur: 0.3, type: 'sine', vol: 0.2, delay: 1.25 }); } },
    { label: 'Quack', emoji: '🦆', key: 's', play: () => { A.tone({ freq: 300, to: 240, dur: 0.12, type: 'sawtooth', vol: 0.16 }); A.tone({ freq: 280, to: 200, dur: 0.14, type: 'sawtooth', vol: 0.16, delay: 0.14 }); } },
    { label: 'Level up', emoji: '⬆️', key: 'd', play: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => A.tone({ freq: f, dur: 0.1, type: 'square', vol: 0.1, delay: i * 0.07 })); } },
    { label: 'Alarm', emoji: '🚨', key: 'f', play: () => { for (let i = 0; i < 4; i++) { A.tone({ freq: 880, dur: 0.18, type: 'square', vol: 0.12, delay: i * 0.36 }); A.tone({ freq: 660, dur: 0.18, type: 'square', vol: 0.12, delay: i * 0.36 + 0.18 }); } } }
  ];

  function mount(root, api) {
    const bagg = Engine.bag();

    /* the whole point is noise, so make sure sound is on and the top-bar icon agrees */
    if (Engine.audio.muted) { const b = document.querySelector('button[title="Noise on/off"]'); if (b) b.click(); else Engine.audio.muted = false; }

    const grid = h('div', { class: 'sb-grid' });
    const pads = SOUNDS.map((s) => {
      const pad = h('button', { class: 'sb-pad', type: 'button' },
        h('span', { class: 'sb-emoji' }, s.emoji),
        h('span', { class: 'sb-label' }, s.label),
        h('span', { class: 'sb-key' }, s.key.toUpperCase()));
      const hit = () => { s.play(); pad.classList.remove('lit'); void pad.offsetWidth; pad.classList.add('lit'); };
      pad.addEventListener('click', hit);
      s._hit = hit;
      grid.appendChild(pad);
      return pad;
    });
    root.appendChild(grid);

    bagg.add(Engine.onKey((e) => {
      const k = (e.key || '').toLowerCase();
      const s = SOUNDS.find((x) => x.key === k);
      if (s) { s._hit(); return true; }
    }));

    api.button('Panic (sound off)', () => { if (!Engine.audio.muted) { const b = document.querySelector('button[title="Noise on/off"]'); if (b) b.click(); else Engine.audio.muted = true; } api.status('Muted. The room is quiet again.'); });
    api.status('Tap a pad — or press its letter/number key — to fire the noise. Everything is generated live in your browser; nothing is downloaded. The air horn is load-bearing.');

    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'soundboard',
    lightBoard: true,   // plain light button grid, not a dark canvas scene
    usesDigits: true,    // number keys fire pads — the "1 = Docs" shortcut yields here
    usesLetters: true,   // and q/w/e/r/t/a/s/d/f fire pads too — keep 'r' from restarting
    title: 'Soundboard',
    emoji: 'speaker',
    cat: 'goof',
    order: 43,
    blurb: 'Eighteen unserious noises: air horn, sad trombone, rimshot, vine boom and more. Everything is synthesized live in the browser, with no sound files at all.',
    scoreLabel: 'Noises made',
    tags: ['soundboard', 'noise', 'toy'],
    how: [
      'Tap any pad to play its sound, or press the key shown in its corner (1-9, then Q W E R T, A S D F).',
      'Every sound is built from oscillators and noise at press time. No audio files, so nothing loads or phones home.',
      'Sound has to be on. Opening the board turns it on and syncs the speaker button up top.',
      'The air horn and sad trombone earn their keep. Use with restraint.',
      'Panic (sound off) mutes everything at once if footsteps approach.'
    ],
    mount
  });
})();
