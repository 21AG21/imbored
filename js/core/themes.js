/* Themes. The whole page is driven by CSS variables, so a theme is just a set
   of overrides. Ships with a handful of presets plus a custom colour you pick. */
(function (global) {
  'use strict';
  const h = Engine.h;
  /* in-memory only — see arcade.js. Persists nothing across reloads. */
  const mem = (window.__cubicleMem = window.__cubicleMem || {});
  const store = {
    get(k, d) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : d; },
    set(k, v) { mem[k] = v; }
  };

  /* a theme overrides the paper/ink family and, for the louder ones, the accent
     colours and the CRT the games sit in — so they read as genuinely different
     skins, not just tinted backgrounds. */
  const THEMES = {
    /* --- the polished set: high contrast, restrained palettes --- */
    paper: {
      name: 'Paper (refined)',
      vars: {
        '--paper': '#efece4', '--paper2': '#e1ddd1', '--label': '#ffffff',
        '--chrome': '#c9c3b4', '--shade': '#9a9280', '--hilite': '#ffffff',
        '--ink': '#191713', '--ink2': '#46423a', '--ink3': '#6d685c',
        '--teal': '#2f7c86', '--hotpink': '#b25574', '--banana': '#d7a13c',
        '--grape': '#33506c', '--lime': '#4e8a52', '--tomato': '#bf4a34'
      }
    },
    mono: {
      name: 'Mono (minimal)',
      vars: {
        '--paper': '#f3f3f5', '--paper2': '#e7e7ea', '--label': '#ffffff',
        '--chrome': '#d3d3d8', '--shade': '#9f9fa6', '--hilite': '#ffffff',
        '--ink': '#151518', '--ink2': '#45454b', '--ink3': '#6e6e75',
        '--teal': '#2b8a97', '--hotpink': '#5f6b7a', '--banana': '#d3ddec',
        '--grape': '#1f242e', '--lime': '#cdd8cf', '--tomato': '#d6493a'
      }
    },
    ink: {
      name: 'Ink (bold)',
      vars: {
        '--paper': '#e4ddcb', '--paper2': '#d5ccb5', '--label': '#fffdf4',
        '--chrome': '#a99f86', '--shade': '#726a52', '--hilite': '#fffef8',
        '--ink': '#14110b', '--ink2': '#3b3527', '--ink3': '#675e48',
        '--teal': '#0c8a97', '--hotpink': '#df2d78', '--banana': '#f2b60c',
        '--grape': '#582b84', '--lime': '#4e9c37', '--tomato': '#d83a22'
      }
    },
    graphite: {
      name: 'Graphite (dark)',
      vars: {
        '--paper': '#1b1d22', '--paper2': '#262933', '--label': '#333744',
        '--chrome': '#3b3f4a', '--shade': '#0f1014', '--hilite': '#41454f',
        '--ink': '#f2f4f8', '--ink2': '#c0c4ce', '--ink3': '#888d9a',
        '--brandink': '#f2f4f8',
        '--teal': '#33c0d0', '--hotpink': '#ff6b9d', '--banana': '#3f4c8c',
        '--grape': '#23262f', '--lime': '#54c46e', '--tomato': '#ff6a54',
        /* banana is a dark blue here, and grape collapses into the neutrals, so
           flip the on-banana text light and give the focus ring its own bright teal */
        '--onbanana': '#f2f4f8', '--focus': '#33c0d0',
        '--crt': '#0a0d12'
      }
    },
    /* Night: warm, dim, low blue light. For reading in a dark room or winding
       down before bed — parchment text on warm charcoal, muted accents, nothing
       that glares. Paired with the 'soft' UI for calm edges. */
    night: {
      name: 'Night (kind to eyes)',
      vars: {
        '--paper': '#211a12', '--paper2': '#2b2318', '--label': '#352b1d',
        '--chrome': '#473a27', '--shade': '#130e08', '--hilite': '#4e4130',
        '--ink': '#ecdcc2', '--ink2': '#c9b591', '--ink3': '#b09b76',
        '--brandink': '#ecdcc2',
        '--teal': '#5fb2a2', '--hotpink': '#df9090', '--banana': '#e4ba62',
        '--grape': '#584a34', '--lime': '#a7bd6a', '--tomato': '#df8a5f',
        /* grape is a muted brown here, so the focus ring needs its own warm glow */
        '--focus': '#e4ba62',
        '--crt': '#160f08'
      }
    },
    beige: { name: 'Beige', vars: {} },
    slate: {
      name: 'Slate',
      vars: {
        '--paper': '#c3ccd8', '--paper2': '#b0bccb', '--label': '#f4f7fb',
        '--chrome': '#8b98a9', '--shade': '#5f6b7c', '--hilite': '#ffffff',
        '--ink': '#161d29', '--ink2': '#3b475a', '--ink3': '#475263'
      }
    },
    mint: {
      name: 'Mint',
      vars: {
        '--paper': '#c4e4d4', '--paper2': '#b0d8c3', '--label': '#f2fbf6',
        '--chrome': '#88b39d', '--shade': '#5b8571', '--hilite': '#ffffff',
        '--ink': '#132218', '--ink2': '#345043', '--ink3': '#486556'
      }
    },
    rose: {
      name: 'Rose',
      vars: {
        '--paper': '#f0cdd6', '--paper2': '#e8b9c6', '--label': '#fdf1f5',
        '--chrome': '#c894a4', '--shade': '#9c6675', '--hilite': '#ffffff',
        '--ink': '#2a141c', '--ink2': '#5a3644', '--ink3': '#714f5c'
      }
    },
    ice: {
      name: 'Ice',
      vars: {
        '--paper': '#d6e6f0', '--paper2': '#c2d8e8', '--label': '#f2f9ff',
        '--chrome': '#92aec8', '--shade': '#5a7690', '--hilite': '#ffffff',
        '--ink': '#12283a', '--ink2': '#34506a', '--ink3': '#456783', '--brandink': '#14110b',
        '--teal': '#1aa6c0', '--hotpink': '#e05a9a', '--banana': '#e0c84a',
        '--grape': '#7a7ad0', '--lime': '#5ac09a', '--tomato': '#e06a5a'
      }
    },
    pumpkin: {
      name: 'Pumpkin',
      vars: {
        '--paper': '#f0d9b8', '--paper2': '#e6c99e', '--label': '#fbf1df',
        '--chrome': '#c79a68', '--shade': '#9a6a3a', '--hilite': '#fffbf0',
        '--ink': '#3a1e0e', '--ink2': '#6a3e22', '--ink3': '#7f5535', '--brandink': '#fbf1df',
        '--teal': '#2a9a8a', '--hotpink': '#e0567a', '--banana': '#f0a828',
        '--grape': '#8f549c', '--lime': '#8aa82a', '--tomato': '#e0492a'
      }
    },
    bubblegum: {
      name: 'Bubblegum',
      vars: {
        '--paper': '#f6cfe0', '--paper2': '#efb9d2', '--label': '#fdf0f6',
        '--chrome': '#d896b8', '--shade': '#a85f88', '--hilite': '#ffffff',
        '--ink': '#3a0f28', '--ink2': '#6a2450', '--ink3': '#894470', '--brandink': '#14110b',
        '--teal': '#2ac0d0', '--hotpink': '#ff3d97', '--banana': '#ffd23a',
        '--grape': '#a05fd8', '--lime': '#6fdf6a', '--tomato': '#ff6a5a'
      }
    },
    newsprint: {
      name: 'Newsprint',
      vars: {
        '--paper': '#e7dfca', '--paper2': '#dbd1b6', '--label': '#f6f1e2',
        '--chrome': '#b0a480', '--shade': '#7a6e50', '--hilite': '#fffef8',
        '--ink': '#201a12', '--ink2': '#4a4030', '--ink3': '#6a5f4b',
        '--teal': '#4a7a6a', '--hotpink': '#b05a6a', '--banana': '#c89a3a',
        '--grape': '#6a5a8a', '--lime': '#7a8a3a', '--tomato': '#b0503a'
      }
    },
    noir: {
      name: 'Noir',
      vars: {
        '--paper': '#cfcfcf', '--paper2': '#bebebe', '--label': '#f2f2f2',
        '--chrome': '#949494', '--shade': '#626262', '--hilite': '#ffffff',
        '--ink': '#161616', '--ink2': '#444444', '--ink3': '#555555',
        '--teal': '#8a8a8a', '--hotpink': '#d83a3a', '--banana': '#b0b0b0',
        '--grape': '#5a5a5a', '--lime': '#9a9a9a', '--tomato': '#b02020'
      }
    },
    dusk: {
      name: 'Dusk',
      vars: {
        '--paper': '#242a3d', '--paper2': '#2e3650', '--label': '#333c58',
        '--chrome': '#454f6e', '--shade': '#151a28', '--hilite': '#4a5578',
        '--ink': '#eef1fb', '--ink2': '#b9c2dd', '--ink3': '#8b96b5', '--brandink': '#f4f6ff'
      }
    },
    carbon: {
      name: 'Carbon',
      vars: {
        '--paper': '#1c1c22', '--paper2': '#26262e', '--label': '#2c2c36',
        '--chrome': '#3a3a46', '--shade': '#0e0e12', '--hilite': '#43434f',
        '--ink': '#f2f2f5', '--ink2': '#c2c2cc', '--ink3': '#8a8a98', '--brandink': '#f4f6ff'
      }
    },
    terminal: {
      name: 'Terminal',
      vars: {
        '--paper': '#0e1a10', '--paper2': '#13251a', '--label': '#17311f',
        '--chrome': '#1f4a2b', '--shade': '#060f09', '--hilite': '#256034',
        '--ink': '#7dff92', '--ink2': '#46b862', '--ink3': '#3d9252',
        '--teal': '#29e0c2', '--hotpink': '#ff5f8f', '--banana': '#b6ff4a',
        '--grape': '#4dffab', '--lime': '#57ff42', '--tomato': '#ff8a3a',
        '--crt': '#04120a'
      }
    },
    amber: {
      name: 'Amber',
      vars: {
        '--paper': '#17110a', '--paper2': '#221809', '--label': '#2e230d',
        '--chrome': '#4a3814', '--shade': '#0c0803', '--hilite': '#5c481c',
        '--ink': '#ffcf6b', '--ink2': '#d69a3a', '--ink3': '#a67320',
        '--teal': '#ffb02e', '--hotpink': '#ff7a5a', '--banana': '#ffd94a',
        '--grape': '#ff9a3a', '--lime': '#ffe07a', '--tomato': '#ff5a2a',
        '--crt': '#0f0a03'
      }
    },
    blueprint: {
      name: 'Blueprint',
      vars: {
        '--paper': '#123a63', '--paper2': '#0f3252', '--label': '#164c7e',
        '--chrome': '#2c609a', '--shade': '#08213a', '--hilite': '#3c74ac',
        '--ink': '#eef4ff', '--ink2': '#b8d4f0', '--ink3': '#86aad0', '--brandink': '#14110b',
        '--teal': '#5fe0ff', '--hotpink': '#ff8ac0', '--banana': '#ffe15a',
        '--grape': '#b08aff', '--lime': '#7affc0', '--tomato': '#ff9a6a',
        '--crt': '#06172a'
      }
    },
    miami: {
      name: 'Miami',
      vars: {
        '--paper': '#241234', '--paper2': '#2f1644', '--label': '#3c1c54',
        '--chrome': '#52306e', '--shade': '#140a1e', '--hilite': '#603c82',
        '--ink': '#ffe6ff', '--ink2': '#e0a0e8', '--ink3': '#b070c0', '--brandink': '#14110b',
        '--teal': '#21e6d4', '--hotpink': '#ff4fb0', '--banana': '#ffe15a',
        '--grape': '#a05fff', '--lime': '#5affc0', '--tomato': '#ff6a8a',
        '--crt': '#120820'
      }
    },
    forest: {
      name: 'Forest',
      vars: {
        '--paper': '#2b3f2a', '--paper2': '#223421', '--label': '#35492e',
        '--chrome': '#48603f', '--shade': '#16220f', '--hilite': '#55704a',
        '--ink': '#f0f4e2', '--ink2': '#c4d0a8', '--ink3': '#99ab7e', '--brandink': '#14110b',
        '--teal': '#35b58a', '--hotpink': '#e86a9a', '--banana': '#e8c34a',
        '--grape': '#a07acc', '--lime': '#8fcf3a', '--tomato': '#e0632f',
        '--crt': '#0e1a0c'
      }
    },
    grapesoda: {
      name: 'Grape soda',
      vars: {
        '--paper': '#4a2a6a', '--paper2': '#3f2258', '--label': '#5a3a7e',
        '--chrome': '#6e4e92', '--shade': '#2a1640', '--hilite': '#7e5aa2',
        '--ink': '#f4ecff', '--ink2': '#d0b8ee', '--ink3': '#b498d1', '--brandink': '#14110b',
        '--teal': '#3ad0d0', '--hotpink': '#ff6ac0', '--banana': '#ffd84a',
        '--grape': '#c89aff', '--lime': '#9aef5a', '--tomato': '#ff7a5a',
        '--crt': '#1c0f2c'
      }
    },
    hazard: {
      name: 'Hazard',
      vars: {
        '--paper': '#1c1c14', '--paper2': '#26261a', '--label': '#33301c',
        '--chrome': '#4a4620', '--shade': '#0c0c08', '--hilite': '#5c5620',
        '--ink': '#ffe14a', '--ink2': '#c8a82a', '--ink3': '#9a8326',
        '--teal': '#2ac0a0', '--hotpink': '#ff7a3a', '--banana': '#ffd21f',
        '--grape': '#c89aff', '--lime': '#b6e02a', '--tomato': '#ff5a1f',
        '--crt': '#0d0d06'
      }
    }
  };

  let themeId = store.get('theme', 'paper');
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

  /* each theme also picks one of five UI "personalities" — different fonts,
     corner radius, shadow style and background texture — so themes restyle the
     whole layout, not just the colours */
  const UI = {
    paper: 'chunky', ink: 'chunky', graphite: 'chunky', mono: 'soft', night: 'soft',
    beige: 'chunky', slate: 'chunky', pumpkin: 'chunky', dusk: 'chunky', carbon: 'chunky',
    mint: 'soft', rose: 'soft', forest: 'soft', ice: 'soft',
    bubblegum: 'neon', miami: 'neon', grapesoda: 'neon',
    newsprint: 'print', noir: 'print', blueprint: 'print',
    terminal: 'terminal', amber: 'terminal', hazard: 'terminal'
  };

  function apply() {
    const root = document.documentElement;
    /* clear anything a previous theme set */
    const all = new Set();
    Object.values(THEMES).forEach((t) => Object.keys(t.vars).forEach((k) => all.add(k)));
    Object.keys(customVars('#888888')).forEach((k) => all.add(k));
    all.forEach((k) => root.style.removeProperty(k));

    const vars = themeId === 'custom' ? customVars(custom) : (THEMES[themeId] || THEMES.beige).vars;
    for (const k in vars) root.style.setProperty(k, vars[k]);
    root.setAttribute('data-ui', UI[themeId] || 'chunky');
    /* flag dark themes so CSS can calm the page texture and lift contrast */
    const pp = hexRGB(vars['--paper'] || '#eeeeee');
    root.setAttribute('data-dark', (pp.r * 0.299 + pp.g * 0.587 + pp.b * 0.114) < 128 ? '1' : '0');

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--grape').trim() || '#6f3fa8');
  }

  const Themes = {
    list: () => Object.keys(THEMES).map((id) => ({ id, name: THEMES[id].name })).concat([{ id: 'custom', name: 'Custom colour' }]),
    current: () => themeId,
    custom: () => custom,
    set(id) { themeId = id; store.set('theme', id); apply(); },
    setCustom(hex) { custom = hex; themeId = 'custom'; store.set('themeCustom', hex); store.set('theme', 'custom'); apply(); },
    /* [surface, accent] for a theme's picker swatch, from its own tokens so every
       theme (not just the hand-listed ones) previews correctly */
    swatch(id) {
      if (id === 'custom') return [custom, custom];
      const v = (THEMES[id] || THEMES.beige).vars || {};
      return [v['--paper'] || '#ded6c2', v['--grape'] || v['--teal'] || v['--banana'] || '#6f3fa8'];
    },
    apply
  };
  global.Themes = Themes;

  /* apply as early as possible so there is no beige flash */
  apply();
})(window);
