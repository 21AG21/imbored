/* Themes. The whole page is driven by CSS variables, so a theme is just a set
   of overrides. Ships with a handful of presets plus a custom colour you pick. */
(function (global) {
  'use strict';
  const h = Engine.h;
  const store = {
    get(k, d) { try { const v = localStorage.getItem('cubicle:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cubicle:' + k, JSON.stringify(v)); } catch (e) { } }
  };

  /* each theme overrides the paper/ink family; the loud accent colours stay put */
  const THEMES = {
    beige: { name: 'Beige (classic)', vars: {} },
    slate: {
      name: 'Cool slate',
      vars: {
        '--paper': '#c3ccd8', '--paper2': '#b0bccb', '--label': '#f4f7fb',
        '--chrome': '#8b98a9', '--shade': '#5f6b7c', '--hilite': '#ffffff',
        '--ink': '#161d29', '--ink2': '#3b475a', '--ink3': '#6d7b90'
      }
    },
    mint: {
      name: 'Mint',
      vars: {
        '--paper': '#c4e4d4', '--paper2': '#b0d8c3', '--label': '#f2fbf6',
        '--chrome': '#88b39d', '--shade': '#5b8571', '--hilite': '#ffffff',
        '--ink': '#132218', '--ink2': '#345043', '--ink3': '#5f8271'
      }
    },
    rose: {
      name: 'Rose',
      vars: {
        '--paper': '#f0cdd6', '--paper2': '#e8b9c6', '--label': '#fdf1f5',
        '--chrome': '#c894a4', '--shade': '#9c6675', '--hilite': '#ffffff',
        '--ink': '#2a141c', '--ink2': '#5a3644', '--ink3': '#8a6472'
      }
    },
    dusk: {
      name: 'Dusk (dark)',
      vars: {
        '--paper': '#242a3d', '--paper2': '#2e3650', '--label': '#333c58',
        '--chrome': '#454f6e', '--shade': '#151a28', '--hilite': '#4a5578',
        '--ink': '#eef1fb', '--ink2': '#b9c2dd', '--ink3': '#8590b0'
      }
    },
    carbon: {
      name: 'Carbon (dark)',
      vars: {
        '--paper': '#1c1c22', '--paper2': '#26262e', '--label': '#2c2c36',
        '--chrome': '#3a3a46', '--shade': '#0e0e12', '--hilite': '#43434f',
        '--ink': '#f2f2f5', '--ink2': '#c2c2cc', '--ink3': '#8a8a98'
      }
    }
  };

  let themeId = store.get('theme', 'beige');
  let custom = store.get('themeCustom', '#5b8cff');

  /* build a full theme from a single accent colour the user picks */
  function customVars(hex) {
    const { r, g, b } = hexRGB(hex);
    const dark = (r * 0.299 + g * 0.587 + b * 0.114) < 150;
    const mix = (t) => rgbHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
    const shade = (t) => rgbHex(r * t, g * t, b * t);
    if (dark) {
      return {
        '--paper': shade(0.5), '--paper2': shade(0.62), '--label': shade(0.72),
        '--chrome': shade(0.85), '--shade': shade(0.3), '--hilite': shade(1.0),
        '--ink': '#f4f5fb', '--ink2': mix(0.72), '--ink3': mix(0.5)
      };
    }
    return {
      '--paper': mix(0.62), '--paper2': mix(0.5), '--label': mix(0.86),
      '--chrome': mix(0.32), '--shade': shade(0.55), '--hilite': '#ffffff',
      '--ink': shade(0.22), '--ink2': shade(0.42), '--ink3': mix(0.2)
    };
  }
  function hexRGB(hex) {
    hex = (hex || '').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex, 16) || 0;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));
  function rgbHex(r, g, b) {
    return '#' + [r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('');
  }

  function apply() {
    const root = document.documentElement;
    /* clear anything a previous theme set */
    const all = new Set();
    Object.values(THEMES).forEach((t) => Object.keys(t.vars).forEach((k) => all.add(k)));
    Object.keys(customVars('#888888')).forEach((k) => all.add(k));
    all.forEach((k) => root.style.removeProperty(k));

    const vars = themeId === 'custom' ? customVars(custom) : (THEMES[themeId] || THEMES.beige).vars;
    for (const k in vars) root.style.setProperty(k, vars[k]);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--grape').trim() || '#6f3fa8');
  }

  const Themes = {
    list: () => Object.keys(THEMES).map((id) => ({ id, name: THEMES[id].name })).concat([{ id: 'custom', name: 'Custom colour' }]),
    current: () => themeId,
    custom: () => custom,
    set(id) { themeId = id; store.set('theme', id); apply(); },
    setCustom(hex) { custom = hex; themeId = 'custom'; store.set('themeCustom', hex); store.set('theme', 'custom'); apply(); },
    apply
  };
  global.Themes = Themes;

  /* apply as early as possible so there is no beige flash */
  apply();
})(window);
