/* Drawn icon set. No emoji anywhere in this build.
   Everything is a 24x24 flat shape with a heavy 2px outline, to match the
   chunky bevelled furniture the rest of the page is built from. */
(function (global) {
  'use strict';

  const INK = '#1d1722';
  const P = {
    yellow: '#ffcb1f', pink: '#ff2d87', teal: '#00a6b4', grape: '#6f3fa8',
    lime: '#6fcf2f', tomato: '#e8402a', paper: '#fffdf3', grey: '#a79e88',
    blue: '#2a4bbd', brown: '#8a6a3a', green: '#1c7a4a', dark: '#3a3446'
  };

  /* helpers keep the path soup readable */
  const r = (x, y, w, h, f, extra) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + f + '"' + (extra || '') + '/>';
  const c = (cx, cy, rad, f) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + rad + '" fill="' + f + '"/>';
  const p = (d, f) => '<path d="' + d + '" fill="' + f + '"/>';
  const line = (x1, y1, x2, y2, w, col) => '<path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '" stroke="' + (col || INK) + '" stroke-width="' + (w || 2) + '" stroke-linecap="round"/>';

  const ICONS = {
    /* ---------- simulations ---------- */
    gridlock:
      r(7, 2, 10, 20, P.dark) +
      c(12, 6.5, 2.4, P.tomato) + c(12, 12, 2.4, P.yellow) + c(12, 17.5, 2.4, P.lime) +
      r(10.5, 21, 3, 2, INK),
    elevator:
      r(3, 3, 18, 18, P.grey) + r(5, 5, 6, 14, P.paper) + r(13, 5, 6, 14, P.paper) +
      p('M8 8l2 3H6z', INK) + p('M16 16l2-3h-4z', INK),
    powergrid:
      p('M13 2L5 13h5l-1 9 8-11h-5z', P.yellow),
    atc:
      p('M12 2l2 8 8 3-8 1v3l3 2v2l-5-2-5 2v-2l3-2v-3l-8-1 8-3z', P.paper),
    /* ---------- puzzles ---------- */
    minesweeper:
      c(12, 14, 7, P.dark) + line(12, 7, 12, 3, 2, P.brown) + p('M15 4l3-2 1 3z', P.tomato) +
      c(9.5, 11.5, 1.6, P.paper),
    '2048':
      r(2, 2, 9, 9, P.yellow) + r(13, 2, 9, 9, P.paper) +
      r(2, 13, 9, 9, P.paper) + r(13, 13, 9, 9, P.tomato),
    jam:
      p('M3 14h18v5H3z', P.tomato) + p('M6 14l2-5h8l2 5z', P.tomato) +
      c(7, 19, 2, INK) + c(17, 19, 2, INK) + r(8.5, 10, 7, 3, P.paper),
    sokoban:
      r(3, 6, 18, 14, P.brown) + p('M3 6l9-4 9 4z', '#c9a06a') +
      line(4, 7, 20, 19, 2) + line(20, 7, 4, 19, 2),
    pipes:
      p('M2 10h9v4H2z', P.teal) + p('M10 10h4v12h-4z', P.teal) +
      p('M13 10h9v4h-9z', P.grey) + c(12, 12, 2.6, P.yellow),
    solitaire:
      r(3, 4, 12, 16, P.paper, ' transform="rotate(-10 9 12)"') +
      r(9, 4, 12, 16, P.paper) +
      p('M15 9c-2 0-3 3 0 5 3-2 2-5 0-5z', P.tomato),
    /* ---------- brain ---------- */
    wordguess:
      r(2, 5, 6, 6, P.lime) + r(9, 5, 6, 6, P.yellow) + r(16, 5, 6, 6, P.grey) +
      r(2, 13, 6, 6, P.grey) + r(9, 13, 6, 6, P.lime) + r(16, 13, 6, 6, P.yellow),
    lightsout:
      c(12, 10, 6, P.yellow) + r(9, 16, 6, 3, P.grey) + r(10, 19, 4, 2, INK) +
      line(12, 1, 12, 3, 2) + line(3, 5, 5, 6, 2) + line(21, 5, 19, 6, 2),
    reflex:
      c(12, 12, 10, P.paper) + c(12, 12, 6.5, P.tomato) + c(12, 12, 3, P.paper) + c(12, 12, 1.4, INK),
    copycat:
      p('M12 2a10 10 0 0 1 10 10h-10z', P.lime) +
      p('M22 12a10 10 0 0 1-10 10v-10z', P.yellow) +
      p('M12 22a10 10 0 0 1-10-10h10z', P.teal) +
      p('M2 12a10 10 0 0 1 10-10v10z', P.tomato) +
      c(12, 12, 3.4, P.paper),
    connect4:
      r(2, 4, 20, 18, P.blue) +
      c(7, 10, 2.6, P.yellow) + c(12, 10, 2.6, '#141a26') + c(17, 10, 2.6, '#141a26') +
      c(7, 17, 2.6, P.tomato) + c(12, 17, 2.6, P.yellow) + c(17, 17, 2.6, '#141a26'),
    /* ---------- action ---------- */
    snake:
      p('M4 18h8v-6h6V6h4', 'none').replace('fill="none"', 'fill="none" stroke="' + P.lime + '" stroke-width="4" stroke-linecap="square"') +
      c(21, 6, 2.4, P.lime) + c(6, 8, 2, P.tomato),
    breakout:
      r(2, 3, 6, 4, P.tomato) + r(9, 3, 6, 4, P.yellow) + r(16, 3, 6, 4, P.teal) +
      r(2, 8, 6, 4, P.yellow) + r(9, 8, 6, 4, P.teal) + r(16, 8, 6, 4, P.tomato) +
      c(15, 16, 2.2, P.paper) + r(6, 19, 12, 3, P.paper),
    tetris:
      r(2, 8, 7, 7, P.teal) + r(9, 8, 7, 7, P.teal) + r(16, 8, 7, 7, P.teal) + r(9, 1, 7, 7, P.grape),
    asteroids:
      p('M12 3l7 16-7-4-7 4z', P.paper) + c(19, 6, 2.4, P.grey) + c(4, 15, 1.8, P.grey),
    commute:
      c(12, 5, 3, P.teal) + p('M9 9h6v7h-2v6h-2v-6H9z', P.teal) +
      r(1, 18, 22, 2, P.yellow),
    /* ---------- goofy ---------- */
    coffee:
      p('M4 8h13v8a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z', P.paper) +
      p('M17 10h2a3 3 0 0 1 0 6h-2z', 'none').replace('fill="none"', 'fill="none" stroke="' + INK + '" stroke-width="2"') +
      r(4, 8, 13, 3, P.brown) +
      line(8, 2, 8, 5, 2, P.grey) + line(13, 2, 13, 5, 2, P.grey),
    whack:
      r(2, 4, 20, 18, P.paper) + r(2, 4, 20, 5, P.grape) +
      r(5, 11, 4, 4, P.teal) + r(10, 11, 4, 4, P.yellow) + r(15, 11, 4, 4, P.teal) +
      r(5, 16, 4, 4, P.tomato) + r(10, 16, 4, 4, P.teal),
    desktoss:
      p('M6 9h12l-1.5 12h-9z', P.grey) + r(5, 6, 14, 3, P.dark) +
      c(12, 3, 2.6, P.paper),
    deskgolf:
      c(6, 20, 3, P.paper) + line(17, 20, 17, 4, 2) + p('M17 4l7 3-7 3z', P.tomato) +
      r(1, 21, 22, 2, P.green),
    sudoku:
      r(3, 3, 18, 18, P.paper) +
      line(9, 3, 9, 21, 1.4, P.grey) + line(15, 3, 15, 21, 1.4, P.grey) +
      line(3, 9, 21, 9, 1.4, P.grey) + line(3, 15, 21, 15, 1.4, P.grey) +
      '<text x="5" y="8.4" font-size="5.5" fill="' + INK + '" stroke="none" font-family="Verdana">5</text>' +
      '<text x="11" y="14.4" font-size="5.5" fill="' + P.teal + '" stroke="none" font-family="Verdana">3</text>' +
      '<text x="17" y="20.4" font-size="5.5" fill="' + INK + '" stroke="none" font-family="Verdana">8</text>' +
      '<text x="17" y="8.4" font-size="5.5" fill="' + P.teal + '" stroke="none" font-family="Verdana">1</text>',
    memory:
      r(2, 4, 9, 16, P.grape) + r(13, 4, 9, 16, P.paper) +
      p('M17.5 9c-1.4 0-2 2 0 3.4C19.4 11 18.9 9 17.5 9z', P.tomato) +
      c(6.5, 12, 2.4, 'rgba(255,255,255,.5)'),
    maze:
      r(2, 2, 20, 20, P.paper) +
      line(2, 7, 15, 7, 1.8, INK) + line(19, 7, 22, 7, 1.8, INK) +
      line(7, 7, 7, 13, 1.8, INK) + line(11, 11, 17, 11, 1.8, INK) +
      line(7, 17, 22, 17, 1.8, INK) + line(11, 13, 11, 22, 1.8, INK) +
      c(4.5, 4.5, 1.4, P.teal) + c(19, 19.5, 1.4, P.tomato),
    reactdiff:
      r(2, 2, 20, 20, P.dark) +
      c(8, 8, 3.2, P.teal) + c(16, 9, 2.2, P.lime) + c(9, 16, 2.4, P.yellow) +
      c(16, 16, 3.4, P.teal) + c(12, 12, 1.6, P.lime) + c(19, 14, 1.6, P.yellow),
    music:
      c(7, 17, 2.6, P.lime) + c(16, 15, 2.6, P.lime) +
      p('M9.4 17V6l9-2v11', 'none').replace('fill="none"', 'fill="none" stroke="' + INK + '" stroke-width="2"'),
    /* ---------- sims wave 2 ---------- */
    vicsek: "<rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" fill=\"#0f1420\"/><path d=\"M6 6l4 2-4 2z\" fill=\"#6fcf2f\"/><path d=\"M12 5l4 2-4 2z\" fill=\"#6fcf2f\"/><path d=\"M7 13l4 2-4 2z\" fill=\"#00a6b4\"/><path d=\"M13 12l4 2-4 2z\" fill=\"#00a6b4\"/>",
    kuramoto: "<circle cx=\"12\" cy=\"12\" r=\"9\" fill=\"none\" stroke=\"#a79e88\" stroke-width=\"1.5\"/><circle cx=\"12\" cy=\"3\" r=\"1.7\" fill=\"#e8402a\"/><circle cx=\"20\" cy=\"10\" r=\"1.7\" fill=\"#ffcb1f\"/><circle cx=\"16\" cy=\"19\" r=\"1.7\" fill=\"#6fcf2f\"/><path d=\"M12 12 L18 8\" fill=\"none\" stroke=\"#fffdf3\" stroke-width=\"1.6\"/>",
    /* ---------- sims wave ---------- */
    schelling: "<rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" fill=\"#141019\"/><rect x=\"3\" y=\"3\" width=\"8\" height=\"18\" fill=\"#00a6b4\"/><rect x=\"13\" y=\"3\" width=\"8\" height=\"18\" fill=\"#e8402a\"/><rect x=\"9\" y=\"7\" width=\"3\" height=\"3\" fill=\"#e8402a\"/><rect x=\"12\" y=\"14\" width=\"3\" height=\"3\" fill=\"#00a6b4\"/>",
    sir: "<rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" fill=\"#d9c9a0\"/><circle cx=\"12\" cy=\"12\" r=\"6\" fill=\"#e8402a\"/><circle cx=\"12\" cy=\"12\" r=\"2.6\" fill=\"#6b6350\"/>",
    sandpile: "<rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" fill=\"#1b2430\"/><rect x=\"9\" y=\"9\" width=\"6\" height=\"6\" fill=\"#e8402a\"/><rect x=\"5\" y=\"9\" width=\"4\" height=\"4\" fill=\"#c7a637\"/><rect x=\"15\" y=\"12\" width=\"4\" height=\"4\" fill=\"#2d5f6b\"/><rect x=\"10\" y=\"4\" width=\"4\" height=\"4\" fill=\"#c7a637\"/><rect x=\"11\" y=\"16\" width=\"3\" height=\"3\" fill=\"#2d5f6b\"/>",
    /* ---------- wave 1b ---------- */
    firedrill: "<rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" fill=\"#141019\"/><rect x=\"4\" y=\"14\" width=\"4\" height=\"4\" fill=\"#d9c9a0\"/><rect x=\"10\" y=\"15\" width=\"4\" height=\"4\" fill=\"#d9c9a0\"/><rect x=\"16\" y=\"6\" width=\"4\" height=\"4\" fill=\"#a79e88\"/><path d=\"M8 12 C7 8 12 7 11 3 C15 6 14 10 12 12 Z\" fill=\"#e8402a\"/><path d=\"M9.6 12 C9.2 9.6 11 9 10.6 6.6 C12.4 8.4 12 10.6 11 12 Z\" fill=\"#ffcb1f\"/>",
    battleship: "<rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" fill=\"#1c3a5c\"/><path d=\"M2 8h20M2 14h20M8 2v20M14 2v20\" fill=\"none\" stroke=\"#0c1119\" stroke-width=\"1\"/><circle cx=\"5\" cy=\"5\" r=\"1.7\" fill=\"#e8402a\"/><circle cx=\"17\" cy=\"11\" r=\"1.7\" fill=\"#fffdf3\"/><circle cx=\"11\" cy=\"17\" r=\"1.7\" fill=\"#e8402a\"/>",
    /* ---------- wave 1 ---------- */
    mastermind: "<path d=\"M8 8 V5.5 a4 4 0 0 1 8 0 V8\" fill=\"none\"/><rect x=\"3\" y=\"8\" width=\"18\" height=\"11\" rx=\"2\" fill=\"#ffcb1f\"/><circle cx=\"7\" cy=\"13.5\" r=\"1.9\" fill=\"#e8402a\"/><circle cx=\"11\" cy=\"13.5\" r=\"1.9\" fill=\"#00a6b4\"/><circle cx=\"15\" cy=\"13.5\" r=\"1.9\" fill=\"#6f3fa8\"/><circle cx=\"19\" cy=\"13.5\" r=\"1.9\" fill=\"#fffdf3\"/>",
    blackjack: "<rect x=\"3\" y=\"6\" width=\"11\" height=\"15\" rx=\"1.6\" fill=\"#fffdf3\"/><path d=\"M8.2 14.4 C4.8 11.6 6.2 9.4 8.2 11.2 C10.2 9.4 11.6 11.6 8.2 14.4 Z\" fill=\"#e8402a\"/><rect x=\"10\" y=\"4\" width=\"11\" height=\"15\" rx=\"1.6\" fill=\"#fffdf3\"/><path d=\"M15.6 6.6 C12.2 9.4 13.6 11.6 15.6 9.8 C17.6 11.6 19 9.4 15.6 6.6 Z\" fill=\"#1d1722\"/><path d=\"M15.6 10 L14.7 13.4 H16.5 Z\" fill=\"#1d1722\"/>",
    invaders: "<rect x=\"3\" y=\"6\" width=\"18\" height=\"13\" rx=\"1\" fill=\"#6fcf2f\"/><path d=\"M3 6 L12 13 L21 6\" fill=\"none\"/><circle cx=\"9\" cy=\"14\" r=\"1.4\" fill=\"#1d1722\"/><circle cx=\"15\" cy=\"14\" r=\"1.4\" fill=\"#1d1722\"/><rect x=\"7\" y=\"2\" width=\"2\" height=\"3\" fill=\"#e8402a\"/><rect x=\"15\" y=\"2\" width=\"2\" height=\"3\" fill=\"#e8402a\"/>",
    match3: "<rect x=\"2.5\" y=\"2.5\" width=\"8.5\" height=\"8.5\" rx=\"2\" fill=\"#ffcb1f\"/><rect x=\"13\" y=\"2.5\" width=\"8.5\" height=\"8.5\" rx=\"2\" fill=\"#00a6b4\"/><rect x=\"2.5\" y=\"13\" width=\"8.5\" height=\"8.5\" rx=\"2\" fill=\"#e8402a\"/><rect x=\"13\" y=\"13\" width=\"8.5\" height=\"8.5\" rx=\"2\" fill=\"#6f3fa8\"/><circle cx=\"6.75\" cy=\"6.75\" r=\"1.7\" fill=\"#fffdf3\"/><circle cx=\"17.25\" cy=\"17.25\" r=\"1.7\" fill=\"#fffdf3\"/>",
    checkers: "<rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" fill=\"#8a6a3a\"/><rect x=\"2\" y=\"2\" width=\"10\" height=\"10\" fill=\"#fffdf3\"/><rect x=\"12\" y=\"12\" width=\"10\" height=\"10\" fill=\"#fffdf3\"/><circle cx=\"7\" cy=\"17\" r=\"3.6\" fill=\"#e8402a\"/><circle cx=\"17\" cy=\"7\" r=\"3.6\" fill=\"#1d1722\"/>",
    nonogram: "<rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" fill=\"#fffdf3\"/><rect x=\"2\" y=\"2\" width=\"20\" height=\"5\" fill=\"#a79e88\"/><rect x=\"2\" y=\"2\" width=\"5\" height=\"20\" fill=\"#a79e88\"/><rect x=\"7\" y=\"7\" width=\"5\" height=\"5\" fill=\"#00a6b4\"/><rect x=\"12\" y=\"7\" width=\"5\" height=\"5\" fill=\"#fffdf3\"/><rect x=\"17\" y=\"7\" width=\"5\" height=\"5\" fill=\"#ffcb1f\"/><rect x=\"7\" y=\"12\" width=\"5\" height=\"5\" fill=\"#fffdf3\"/><rect x=\"12\" y=\"12\" width=\"5\" height=\"5\" fill=\"#e8402a\"/><rect x=\"17\" y=\"12\" width=\"5\" height=\"5\" fill=\"#fffdf3\"/><rect x=\"7\" y=\"17\" width=\"5\" height=\"5\" fill=\"#6f3fa8\"/><rect x=\"12\" y=\"17\" width=\"5\" height=\"5\" fill=\"#fffdf3\"/><rect x=\"17\" y=\"17\" width=\"5\" height=\"5\" fill=\"#6fcf2f\"/>",
    /* ---------- added arcade ---------- */
    pong:
      r(3, 7, 3, 10, P.paper) + r(18, 7, 3, 10, P.paper) +
      c(12, 12, 2.4, P.paper) + line(12, 3, 12, 21, 1.2, P.grey),
    flap:
      r(2, 2, 5, 8, P.lime) + r(2, 14, 5, 8, P.lime) +
      c(14, 12, 6, P.yellow) + c(16, 10, 1.7, INK) + p('M20 12l3-1v2z', P.tomato),
    stack:
      r(4, 15, 16, 5, P.teal) + r(6, 10, 12, 5, P.yellow) + r(8, 5, 8, 5, P.tomato),
    climb:
      r(3, 18, 8, 3, P.lime) + r(13, 12, 8, 3, P.lime) + r(6, 5, 8, 3, P.lime) +
      c(9, 15, 2.6, P.yellow),
    fifteen:
      r(3, 3, 8, 8, P.paper) + r(13, 3, 8, 8, P.paper) +
      r(3, 13, 8, 8, P.paper) + r(13, 13, 8, 8, P.dark),
    flood:
      r(3, 3, 7, 7, P.tomato) + r(11, 3, 7, 7, P.yellow) +
      r(3, 11, 7, 7, P.teal) + r(11, 11, 7, 7, P.grape),
    noughts:
      line(9, 3, 9, 21, 1.6, P.grey) + line(15, 3, 15, 21, 1.6, P.grey) +
      line(3, 9, 21, 9, 1.6, P.grey) + line(3, 15, 21, 15, 1.6, P.grey) +
      line(4.5, 4.5, 7.5, 7.5, 2, P.tomato) + line(7.5, 4.5, 4.5, 7.5, 2, P.tomato) +
      '<circle cx="18" cy="18" r="2.4" fill="none" stroke="' + P.teal + '" stroke-width="2"/>',
    reversi:
      r(2, 2, 20, 20, P.green) +
      c(8, 8, 2.6, INK) + c(16, 8, 2.6, P.paper) + c(8, 16, 2.6, P.paper) + c(16, 16, 2.6, INK),
    /* ---------- gridlock shop ---------- */
    smart: r(4, 4, 16, 16, P.teal) + p('M9 9h6v2h-4v2h4v2H9z', P.paper) + r(4, 4, 16, 16, 'none').replace('fill="none"', 'fill="none" stroke="' + INK + '" stroke-width="2"'),
    circle: '<circle cx="12" cy="12" r="8" fill="none" stroke="' + P.grey + '" stroke-width="5"/>' + c(12, 12, 4, P.green),
    over: r(2, 9, 20, 6, P.grey) + r(9, 2, 6, 20, P.dark) + r(2, 9, 20, 6, 'none').replace('fill="none"', 'fill="none" stroke="' + INK + '" stroke-width="2"'),
    wider: line(3, 12, 21, 12, 2) + p('M3 12l5-4v8z', INK) + p('M21 12l-5-4v8z', INK),
    priority: r(3, 9, 15, 8, P.paper) + p('M18 11h3l2 3v3h-5z', P.paper) + c(7, 18, 2, INK) + c(18, 18, 2, INK) + r(8, 11, 5, 4, P.tomato),
    reports: p('M3 19l5-6 4 3 5-8 4 5', 'none').replace('fill="none"', 'fill="none" stroke="' + P.tomato + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"'),
    /* ---------- chrome ---------- */
    dice: r(3, 3, 18, 18, P.paper) + c(8, 8, 1.9, INK) + c(16, 16, 1.9, INK) + c(12, 12, 1.9, INK) + c(16, 8, 1.9, INK) + c(8, 16, 1.9, INK),
    expand: p('M3 3h8v3H6v5H3zM21 21h-8v-3h5v-5h3z', P.paper),
    sound: p('M4 9h4l5-4v14l-5-4H4z', P.paper) + p('M16 8a5 5 0 0 1 0 8', 'none').replace('fill="none"', 'fill="none" stroke="' + P.lime + '" stroke-width="2" stroke-linecap="round"'),
    mute: p('M4 9h4l5-4v14l-5-4H4z', P.paper) + line(16, 9, 22, 15, 2.4, P.tomato) + line(22, 9, 16, 15, 2.4, P.tomato),
    panic: c(12, 5, 3.4, P.paper) + p('M8 10h8l2 8h-3l-1 5h-4l-1-5H6z', P.dark),
    /* ---------- panic screens ---------- */
    docs: r(4, 2, 14, 20, P.paper) + p('M18 2l4 4h-4z', P.grey) + line(7, 8, 15, 8, 1.6, P.teal) + line(7, 12, 15, 12, 1.6, P.grey) + line(7, 16, 12, 16, 1.6, P.grey),
    sheet: r(3, 3, 18, 18, P.paper) + r(3, 3, 18, 4, P.green) + line(9, 7, 9, 21, 1.4, P.grey) + line(15, 7, 15, 21, 1.4, P.grey) + line(3, 12, 21, 12, 1.4, P.grey) + line(3, 17, 21, 17, 1.4, P.grey),
    inbox: r(2, 5, 20, 14, P.paper) + p('M2 5l10 8 10-8', 'none').replace('fill="none"', 'fill="none" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"'),
    term: r(2, 4, 20, 16, P.dark) + r(2, 4, 20, 3.5, P.grey) + p('M6 12l3 2.5-3 2.5', 'none').replace('fill="none"', 'fill="none" stroke="' + P.lime + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"') + line(12, 17, 17, 17, 2, P.lime),
    palette: p('M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2 0-1.4 1-2 2.2-2H18a4 4 0 0 0 4-4c0-5-4.5-8-10-8z', P.paper) +
      c(7.5, 11, 1.5, P.tomato) + c(11, 8, 1.5, P.yellow) + c(15.5, 9, 1.5, P.teal) + c(16.5, 13.5, 1.5, P.grape),
    web: c(12, 12, 9, P.teal) + '<ellipse cx="12" cy="12" rx="4" ry="9" fill="none" stroke="' + INK + '" stroke-width="1.6"/>' + line(3, 12, 21, 12, 1.6) + line(4.5, 7, 19.5, 7, 1.4) + line(4.5, 17, 19.5, 17, 1.4),
    /* ---------- misc ---------- */
    road: p('M7 2h4l-1 20H5zM17 2h-4l1 20h5z', P.grey) + line(12, 3, 12, 7, 2.5, P.yellow) + line(12, 11, 12, 15, 2.5, P.yellow) + line(12, 19, 12, 22, 2.5, P.yellow),
    mine: c(12, 12, 6.5, INK) + line(12, 2, 12, 5.5, 2) + line(12, 18.5, 12, 22, 2) + line(2, 12, 5.5, 12, 2) + line(18.5, 12, 22, 12, 2) + c(9.5, 9.5, 1.5, P.paper),
    flag: line(7, 3, 7, 21, 2) + p('M7 4l11 4-11 4z', P.tomato),
    boom: p('M12 1l3 6 6-3-3 6 6 3-6 3 3 6-6-3-3 6-3-6-6 3 3-6-6-3 6-3-3-6 6 3z', P.tomato) + c(12, 12, 3, P.yellow),
    ising: r(3, 3, 18, 18, P.dark) + r(3, 3, 6, 6, P.tomato) + r(15, 3, 6, 6, P.tomato) + r(9, 9, 6, 6, P.tomato) + r(3, 15, 6, 6, P.tomato) + r(15, 15, 6, 6, P.tomato),
    traffic: r(8, 2, 8, 20, P.dark) + line(12, 3, 12, 8, 1.6, P.yellow) + line(12, 12, 12, 18, 1.6, P.yellow) + r(9, 4, 6, 3.4, P.tomato) + r(9, 10, 6, 3.4, P.yellow) + r(9, 16, 6, 3.4, P.lime),
    frost: line(12, 2, 12, 22, 1.6, P.teal) + line(3, 7, 21, 17, 1.6, P.teal) + line(3, 17, 21, 7, 1.6, P.teal) + line(9, 4, 12, 7, 1.4, P.teal) + line(15, 4, 12, 7, 1.4, P.teal) + line(4, 12, 8, 12, 1.4, P.teal) + line(20, 12, 16, 12, 1.4, P.teal) + c(12, 12, 2, P.paper),
    boom: line(3, 12, 9, 12, 1.7, P.teal) + line(9, 12, 15, 7, 1.5, P.teal) + line(9, 12, 15, 17, 1.5, P.teal) + line(15, 7, 21, 4, 1.3, P.tomato) + line(15, 7, 21, 10, 1.3, P.tomato) + line(15, 17, 21, 14, 1.3, P.tomato) + line(15, 17, 21, 20, 1.3, P.tomato),
    life: r(9, 3, 5, 5, P.lime) + r(15, 9, 5, 5, P.lime) + r(3, 15, 5, 5, P.lime) + r(9, 15, 5, 5, P.lime) + r(15, 15, 5, 5, P.lime),
    powder: p('M6 4h12l-6 8z', P.yellow) + p('M6 20h12l-6-8z', P.grey) + c(12, 13, 1.1, P.yellow) + c(12, 16, 1, P.yellow) + line(5, 4, 19, 4, 2, P.grey) + line(5, 20, 19, 20, 2, P.grey),
    keys: r(2, 7, 20, 11, P.dark) + r(4, 9, 2.4, 2, P.paper) + r(7.5, 9, 2.4, 2, P.paper) + r(11, 9, 2.4, 2, P.paper) + r(14.5, 9, 2.4, 2, P.paper) + r(18, 9, 1.8, 2, P.paper) + r(4, 12, 2.4, 2, P.paper) + r(7.5, 12, 2.4, 2, P.paper) + r(11, 12, 2.4, 2, P.paper) + r(14.5, 12, 2.4, 2, P.paper) + r(7, 15, 10, 2, P.paper),
    busywork: p('M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', P.paper) + p('M14 3l4 4h-4z', P.grey) + line(8, 10, 16, 10, 1.4, P.teal) + line(8, 13, 16, 13, 1.4, P.grey) + line(8, 16, 13, 16, 1.4, P.grey) + p('M15 15l5-2 2 3-5 3-2 1 .5-2z', P.yellow),
    spam: r(3, 6, 18, 13, P.paper) + p('M3 6l9 7 9-7', 'none').replace('fill="none"', 'fill="none" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"') + c(18, 7, 4.5, P.tomato) + line(18, 5, 18, 8, 1.6, P.paper) + c(18, 9.6, 0.9, P.paper),
    turf: line(8, 7, 16, 7, 1.6, INK) + line(16, 7, 12, 17, 1.6, INK) + line(12, 17, 8, 7, 1.6, INK) + c(8, 7, 3.2, P.tomato) + c(16, 7, 3.2, P.lime) + c(12, 17, 3.2, P.teal),
    find: r(3, 3, 18, 18, P.paper) + r(4.5, 4.5, 4, 4, P.banana) + r(9.5, 9.5, 4, 4, P.banana) + r(14.5, 14.5, 4, 4, P.banana) + line(9, 3, 9, 21, 1, P.grey) + line(15, 3, 15, 21, 1, P.grey) + line(3, 9, 21, 9, 1, P.grey) + line(3, 15, 21, 15, 1, P.grey),
    bubble: c(8, 7, 3.4, P.tomato) + c(15, 7, 3.4, P.teal) + c(11.5, 13, 3.4, P.banana) + c(7, 15, 3.4, P.lime) + c(16, 15, 3.4, P.grape) + c(7, 6, 1, P.paper) + c(14, 6, 1, P.paper),
    cards: r(5, 6, 11, 15, P.paper, ' transform="rotate(-10 10 13)"') + r(9, 4, 11, 15, P.paper, ' transform="rotate(8 14 11)"') + p('M14 8l2 3-2 3-2-3z', P.tomato) + line(14, 4, 14, 6, 1.4, P.grey)
  };

  const Icons = {
    has: (name) => Object.prototype.hasOwnProperty.call(ICONS, name),
    svg(name, size, cls) {
      const body = ICONS[name];
      const s = size || 24;
      if (!body) return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="' + P.grey + '"/></svg>';
      /* one dark outline over the whole set keeps pale shapes readable on pale
         panels, and matches the heavy borders everywhere else on the page */
      return '<svg class="ico' + (cls ? ' ' + cls : '') + '" width="' + s + '" height="' + s +
        '" viewBox="0 0 24 24" aria-hidden="true">' +
        '<g stroke="' + INK + '" stroke-width="1.4" stroke-linejoin="round">' + body + '</g></svg>';
    },
    /* an <span> wrapper, for places that want a node rather than markup */
    el(name, size, cls) {
      return Engine.h('span', { class: 'ico-wrap ' + (cls || ''), html: Icons.svg(name, size) });
    },
    palette: P
  };

  global.Icons = Icons;
})(window);
