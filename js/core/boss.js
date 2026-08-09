/* The panic screen. Five disguises, all typeable, plus one that loads any site you name.
   Hit the key and land in something that looks like work. */
(function (global) {
  'use strict';
  const h = Engine.h;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('cubicle:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cubicle:' + k, JSON.stringify(v)); } catch (e) { } }
  };

  let skinId = store.get('bossskin', 'docs');
  let webUrl = store.get('bossurl', '');
  let webMode = store.get('bossmode', 'jump');
  let host = null, on = false, current = null;

  /* tiny inline glyphs so the toolbars are drawn, not typed */
  const g = (d, o) => '<svg viewBox="0 0 24 24" width="' + (o && o.s || 20) + '" height="' + (o && o.s || 20) + '" fill="none" stroke="' + (o && o.c || '#444746') + '" stroke-width="' + (o && o.w || 1.7) + '" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  const GL = {
    undo: g('<path d="M4 9h11a5 5 0 0 1 0 10h-6"/><path d="M8 5L4 9l4 4"/>'),
    redo: g('<path d="M20 9H9a5 5 0 0 0 0 10h6"/><path d="M16 5l4 4-4 4"/>'),
    print: g('<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="1"/><path d="M7 16h10v5H7z"/>'),
    spell: g('<path d="M5 17L9 6l4 11"/><path d="M6.4 13.5h5.2"/><path d="M15 15l2.5 2.5L22 12"/>'),
    paint: g('<rect x="4" y="4" width="12" height="6" rx="1"/><path d="M10 10v4H8v7h4v-7h-2"/>'),
    zoom: g('<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L21 21"/>'),
    link: g('<path d="M9.5 14.5l5-5"/><path d="M11 7l1.5-1.5a3.5 3.5 0 0 1 5 5L16 12"/><path d="M13 17l-1.5 1.5a3.5 3.5 0 0 1-5-5L8 12"/>'),
    comment: g('<path d="M4 5h16v11H9l-5 4z"/>'),
    image: g('<rect x="3" y="5" width="18" height="14" rx="1"/><circle cx="8.5" cy="10" r="1.5"/><path d="M4 17l5-5 4 4 3-3 4 4"/>'),
    alignLeft: g('<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'),
    spacing: g('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M5 8l0 8"/><path d="M3 9l2-2 2 2"/><path d="M3 15l2 2 2-2"/>'),
    check: g('<path d="M4 7l2 2 3-3"/><path d="M4 15l2 2 3-3"/><path d="M12 8h8M12 16h8"/>'),
    bullet: g('<circle cx="5" cy="7" r="1.4" fill="#444746"/><circle cx="5" cy="12" r="1.4" fill="#444746"/><circle cx="5" cy="17" r="1.4" fill="#444746"/><path d="M10 7h10M10 12h10M10 17h10"/>'),
    number: g('<path d="M10 7h10M10 12h10M10 17h10"/><text x="3" y="9" font-size="7" fill="#444746" stroke="none">1</text><text x="3" y="14" font-size="7" fill="#444746" stroke="none">2</text><text x="3" y="19" font-size="7" fill="#444746" stroke="none">3</text>'),
    outdent: g('<path d="M4 6h16M9 10h11M9 14h11M4 18h16"/><path d="M7 12l-3-2v4z" fill="#444746"/>'),
    indent: g('<path d="M4 6h16M9 10h11M9 14h11M4 18h16"/><path d="M4 12l3-2v4z" fill="#444746"/>'),
    clear: g('<path d="M6 18h12"/><path d="M8 15L15 5l4 3-6 7z"/>'),
    pencil: g('<path d="M4 20l4-1L20 7l-3-3L5 16z"/>'),
    star: g('<path d="M12 4l2.4 5 5.6.7-4 3.9 1 5.4-5-2.7-5 2.7 1-5.4-4-3.9 5.6-.7z"/>'),
    folder: g('<path d="M3 7h6l2 2h10v10H3z"/>'),
    cloud: g('<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.7 1.6A3.5 3.5 0 0 0 7 18z"/>'),
    lock: g('<rect x="6" y="11" width="12" height="9" rx="1.5" stroke="#001d35"/><path d="M9 11V8a3 3 0 0 1 6 0v3" stroke="#001d35"/>', { c: '#001d35' }),
    menu: g('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    sidebar: g('<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M9 5v14"/>')
  };
  const DOC_BLUE = '#3a6ea5';

  /* ============================ 1. DOC ============================ */
  const DOC_TITLE = 'Q3 Planning Notes';
  const DOC_BODY =
    '<h1>Q3 Planning Notes</h1>' +
    '<p><span class="muted"><i>Draft. Shared with the working group. Comments welcome by Friday.</i></span></p>' +
    '<h2>Where we landed</h2>' +
    '<p>Carrying three workstreams into Q3 rather than five. The two we are pausing were not failing, they were competing for the same two people. Both get revisited at the September checkpoint.</p>' +
    '<h2>Open questions</h2>' +
    '<ul><li>Who owns the migration once the contractor rolls off?</li>' +
    '<li>Do we still need the weekly sync, or is the written update enough?</li>' +
    '<li>Budget line for tooling has not been confirmed. Chasing.</li></ul>' +
    '<h2>Actions</h2>' +
    '<ol><li>Draft the one-pager and circulate it before the review.</li>' +
    '<li>Confirm headcount assumptions with Finance.</li>' +
    '<li>Book the follow-up. Thirty minutes, not sixty.</li></ol>' +
    '<h2>Notes from the room</h2>' +
    '<p>General agreement that scope crept because nobody was empowered to say no. Proposal is to name a single decision owner per workstream. No objections raised.</p>' +
    '<p><br></p>';

  function buildDocs() {
    const body = h('div', { class: 'gd-body', contenteditable: 'true', spellcheck: 'false', html: DOC_BODY });
    const editNote = h('span', { class: 'gd-editnote' }, 'Last edit was seconds ago');
    body.addEventListener('input', () => { editNote.textContent = 'Last edit was seconds ago'; });

    const tb = (glyph, extra) => h('span', { class: 'gd-tb' + (extra ? ' ' + extra : ''), html: glyph });
    const sep = () => h('span', { class: 'gd-sep' });
    const dd = (label, wide) => h('span', { class: 'gd-dd' + (wide ? ' wide' : '') }, label, h('i', { class: 'gd-caret' }));

    return {
      focus: () => {
        body.focus();
        const r = document.createRange();
        r.selectNodeContents(body);
        r.collapse(false);
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(r);
      },
      el: h('div', { class: 'skin gdocs' },
        h('div', { class: 'gd-head' },
          h('span', {
            class: 'gd-logo', html:
              '<svg viewBox="0 0 40 54" width="34" height="40"><path d="M4 0h22l14 14v36a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4z" fill="#3a6ea5"/><path d="M26 0l14 14H30a4 4 0 0 1-4-4z" fill="#9db8d8"/><g fill="#fff"><rect x="9" y="22" width="22" height="2.6" rx="1.3"/><rect x="9" y="29" width="22" height="2.6" rx="1.3"/><rect x="9" y="36" width="22" height="2.6" rx="1.3"/><rect x="9" y="43" width="14" height="2.6" rx="1.3"/></g></svg>'
          }),
          h('div', { class: 'gd-headmid' },
            h('div', { class: 'gd-titlerow' },
              h('span', { class: 'gd-title' }, DOC_TITLE),
              h('span', { class: 'gd-mini', html: GL.star }),
              h('span', { class: 'gd-mini', html: GL.folder }),
              h('span', { class: 'gd-mini', html: GL.cloud })),
            h('div', { class: 'gd-menu' },
              ['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'Extensions', 'Help'].map((m) => h('span', null, m)))),
          h('div', { class: 'gd-headright' },
            h('span', { class: 'gd-mini', html: GL.comment }),
            h('span', { class: 'gd-share' }, h('span', { class: 'gd-lock', html: GL.lock }), 'Share'),
            h('span', { class: 'gd-avatar' }, 'K'))),

        h('div', { class: 'gd-toolwrap' },
          h('div', { class: 'gd-tools' },
            tb(GL.undo), tb(GL.redo), tb(GL.print), tb(GL.spell), tb(GL.paint),
            h('span', { class: 'gd-zoom' }, '100%', h('i', { class: 'gd-caret' })),
            sep(),
            dd('Normal text', true),
            sep(),
            dd('Arial', true),
            sep(),
            h('span', { class: 'gd-tb' }, '−'),
            h('span', { class: 'gd-fontsize' }, '11'),
            h('span', { class: 'gd-tb' }, '+'),
            sep(),
            h('span', { class: 'gd-tb bold' }, 'B'),
            h('span', { class: 'gd-tb ital' }, 'I'),
            h('span', { class: 'gd-tb undl' }, 'U'),
            h('span', { class: 'gd-tb tcol' }, 'A'),
            sep(),
            tb(GL.link), tb(GL.comment), tb(GL.image),
            sep(),
            tb(GL.alignLeft), tb(GL.spacing), tb(GL.check), tb(GL.bullet), tb(GL.number),
            tb(GL.outdent), tb(GL.indent), tb(GL.clear),
            h('span', { class: 'gd-mode' }, h('span', { html: GL.pencil }), h('i', { class: 'gd-caret' })))),

        h('div', { class: 'gd-ruler' },
          h('div', { class: 'gd-rulerinner' },
            h('span', { class: 'gd-margin left' }),
            h('span', { class: 'gd-margin right' }))),

        h('div', { class: 'gd-canvas' },
          h('div', { class: 'gd-page' }, body)),

        h('div', { class: 'gd-foot' }, editNote))
    };
  }

  /* ============================ 2. SHEET ============================ */
  const ROWS_DATA = [
    ['Northeast', 'Enterprise', 1284900, 1402350, 9.1, 'On track'],
    ['Northeast', 'Mid-Market', 842100, 811200, -3.7, 'At risk'],
    ['Southeast', 'Enterprise', 977400, 1055800, 8.0, 'On track'],
    ['Southeast', 'SMB', 431050, 468990, 8.8, 'On track'],
    ['Midwest', 'Enterprise', 1120600, 1098450, -2.0, 'Watch'],
    ['Midwest', 'Mid-Market', 655300, 702110, 7.1, 'On track'],
    ['Mountain', 'SMB', 288750, 301400, 4.4, 'On track'],
    ['Pacific', 'Enterprise', 1640200, 1822900, 11.1, 'Ahead'],
    ['Pacific', 'Mid-Market', 903800, 889700, -1.6, 'Watch'],
    ['Pacific', 'SMB', 512400, 559330, 9.2, 'On track'],
    ['International', 'Enterprise', 1345000, 1290500, -4.1, 'At risk'],
    ['International', 'Mid-Market', 720900, 764480, 6.0, 'On track'],
    ['International', 'SMB', 398200, 425610, 6.9, 'On track'],
    ['Public Sector', 'Enterprise', 1088000, 1141200, 4.9, 'On track'],
    ['Public Sector', 'Mid-Market', 470300, 455900, -3.1, 'Watch']
  ];
  const money = (n) => '$' + n.toLocaleString('en-US');
  const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  function buildSheet() {
    const cellRef = h('span', { class: 'cellref' }, 'A1');
    const formula = h('span', { class: 'fbar' }, '');
    let firstCell = null;

    const mkCell = (txt, cls, col, row) => {
      const td = h('td', {
        class: cls || '', contenteditable: 'true', spellcheck: 'false',
        onfocus: () => { cellRef.textContent = COLS[col] + row; formula.textContent = td.textContent; td.classList.add('sel'); },
        onblur: () => td.classList.remove('sel'),
        oninput: () => { formula.textContent = td.textContent; }
      }, txt);
      if (!firstCell) firstCell = td;
      return td;
    };

    const head = h('tr', null, h('th', { class: 'rowhead' }, ''), COLS.map((l) => h('th', null, l)));
    const rows = [h('tr', null, h('td', { class: 'rowhead' }, '1'),
      ['Region', 'Segment', 'FY Plan', 'FY Actual', 'Var %', 'Status', 'Owner'].map((t, i) => mkCell(t, 'hcell', i, 1)))];
    ROWS_DATA.forEach((r, i) => {
      const rn = i + 2;
      rows.push(h('tr', null, h('td', { class: 'rowhead' }, rn),
        mkCell(r[0], '', 0, rn), mkCell(r[1], '', 1, rn),
        mkCell(money(r[2]), 'num', 2, rn), mkCell(money(r[3]), 'num', 3, rn),
        mkCell((r[4] > 0 ? '+' : '') + r[4].toFixed(1) + '%', 'num ' + (r[4] < 0 ? 'neg' : 'pos'), 4, rn),
        mkCell(r[5], '', 5, rn), mkCell('', '', 6, rn)));
    });
    const tot = ROWS_DATA.length + 2;
    rows.push(h('tr', { class: 'total' }, h('td', { class: 'rowhead' }, tot),
      mkCell('TOTAL', '', 0, tot), mkCell('', '', 1, tot),
      mkCell(money(ROWS_DATA.reduce((a, r) => a + r[2], 0)), 'num', 2, tot),
      mkCell(money(ROWS_DATA.reduce((a, r) => a + r[3], 0)), 'num', 3, tot),
      mkCell('+3.4%', 'num pos', 4, tot), mkCell('', '', 5, tot), mkCell('', '', 6, tot)));
    for (let i = 0; i < 10; i++) {
      const rn = tot + 1 + i;
      rows.push(h('tr', null, h('td', { class: 'rowhead' }, rn), COLS.map((_, c) => mkCell('', '', c, rn))));
    }

    return {
      focus: () => { if (firstCell) firstCell.focus(); },
      el: h('div', { class: 'skin sheet' },
        h('div', { class: 'sh-bar' },
          h('span', { class: 'sh-file' }, 'Q3_Regional_Forecast_v7_FINAL.xlsx'),
          h('span', { class: 'sh-menu' }, ['File', 'Home', 'Insert', 'Formulas', 'Data', 'Review', 'View'].map((m) => h('span', null, m)))),
        h('div', { class: 'sh-formula' }, cellRef, h('span', { class: 'fx' }, 'fx'), formula),
        h('div', { class: 'sh-grid' }, h('table', null, h('thead', null, head), h('tbody', null, rows))),
        h('div', { class: 'sh-tabs' },
          h('span', { class: 'tab active' }, 'Summary'), h('span', { class: 'tab' }, 'By Region'),
          h('span', { class: 'tab' }, 'Pipeline'), h('span', { class: 'tab' }, 'Assumptions'),
          h('span', { class: 'tab' }, 'Sheet4')))
    };
  }

  /* ============================ 3. INBOX ============================ */
  const MAIL = [
    { f: 'Facilities', s: 'Kitchen fridge will be emptied Friday', t: '9:14 AM', p: 'Anything left after 5pm goes in the bin, including the containers. Fourth notice.' },
    { f: 'R. Patel', s: 'RE: RE: RE: quick question', t: '9:02 AM', p: 'Resending with the right attachment this time. Ignore the last two.' },
    { f: 'IT Helpdesk', s: 'Scheduled maintenance window', t: '8:47 AM', p: 'Systems may be unavailable Saturday 02:00 to 06:00. No action needed.' },
    { f: 'S. Okafor', s: 'Notes from yesterday', t: '8:31 AM', p: 'Wrote up what we agreed. Shout if I mangled anything.' },
    { f: 'All Staff', s: 'Reminder: complete your training module', t: 'Yesterday', p: 'The deadline has been extended. Again. Please do it.' },
    { f: 'M. Duarte', s: 'Lunch?', t: 'Yesterday', p: 'The place with the soup. 12:15?' },
    { f: 'Payroll', s: 'Your payslip is available', t: 'Yesterday', p: 'Log in to view. Do not reply to this address.' },
    { f: 'J. Lindqvist', s: 'Draft for review, no rush', t: 'Mon', p: 'Whenever you get a minute this week is fine.' }
  ];

  function buildInbox() {
    const reply = h('div', { class: 'mail-reply', contenteditable: 'true', spellcheck: 'false', html: '<p>Thanks for flagging this.</p><p><br></p>' });
    const subject = h('div', { class: 'mail-subject' }, MAIL[3].s);
    const from = h('div', { class: 'mail-from' }, MAIL[3].f, h('span', null, ' to me'));
    const bodyText = h('div', { class: 'mail-body' },
      h('p', null, MAIL[3].p),
      h('p', null, 'Main thing is whether we keep the Friday slot or move it. I do not have a strong view, but a few people have said the current time clashes with the other standing meeting.'),
      h('p', null, 'Happy either way. Let me know what you prefer and I will send the update.'),
      h('p', null, 'Thanks'));

    const list = h('div', { class: 'mail-list' }, MAIL.map((m, i) =>
      h('div', {
        class: 'mail-item' + (i === 3 ? ' active' : '') + (i < 3 ? ' unread' : ''),
        onclick: () => {
          [...list.children].forEach((c) => c.classList.remove('active'));
          list.children[i].classList.add('active');
          list.children[i].classList.remove('unread');
          subject.textContent = m.s;
          from.replaceChildren(m.f, h('span', null, ' to me'));
          bodyText.replaceChildren(h('p', null, m.p), h('p', null, 'Let me know what you think when you get a chance.'), h('p', null, 'Thanks'));
        }
      },
        h('div', { class: 'mi-top' }, h('span', { class: 'mi-from' }, m.f), h('span', { class: 'mi-time' }, m.t)),
        h('div', { class: 'mi-sub' }, m.s),
        h('div', { class: 'mi-prev' }, m.p))));

    return {
      focus: () => {
        reply.focus();
        const r = document.createRange();
        r.selectNodeContents(reply);
        r.collapse(false);
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(r);
      },
      el: h('div', { class: 'skin inbox' },
        h('div', { class: 'mail-top' },
          h('span', { class: 'mail-logo' }, 'Mail'),
          h('span', { class: 'mail-search' }, 'Search mail'),
          h('span', { class: 'mail-avatar' }, 'K')),
        h('div', { class: 'mail-cols' },
          h('div', { class: 'mail-side' },
            h('div', { class: 'mail-compose' }, 'Compose'),
            ['Inbox 3', 'Starred', 'Snoozed', 'Sent', 'Drafts 2', 'Archive', 'Spam'].map((f, i) =>
              h('div', { class: 'mail-folder' + (i === 0 ? ' active' : '') }, f))),
          list,
          h('div', { class: 'mail-read' }, subject, from, bodyText,
            h('div', { class: 'mail-reply-wrap' },
              h('div', { class: 'mail-reply-head' }, 'Reply to ' + MAIL[3].f),
              reply,
              h('div', { class: 'mail-reply-foot' }, h('span', { class: 'mail-send' }, 'Send'))))))
    };
  }

  /* ============================ 4. TERMINAL ============================ */
  const BOOT = [
    '$ npm run build', '',
    '> platform@4.12.0 build', '> tsc -p tsconfig.json && vite build', '',
    'vite v5.4.2 building for production...', 'transforming (412) src/index.ts',
    '1284 modules transformed.',
    'dist/assets/index-9f2a1c.css     42.18 kB | gzip:  8.02 kB',
    'dist/assets/index-4b71ee.js     612.44 kB | gzip: 184.91 kB',
    'built in 7.42s', '',
    '$ npm test -- --run', '',
    ' PASS  src/lib/parser.test.ts (24 tests) 412ms',
    ' PASS  src/lib/queue.test.ts (18 tests) 288ms',
    ' PASS  src/api/routes.test.ts (31 tests) 1.02s', '',
    'Test Files  3 passed (3)', '     Tests  73 passed (73)', '  Duration  2.31s', ''
  ];
  const REPLIES = ['ok', 'done.', 'nothing to commit, working tree clean', 'Already up to date.',
    'warning: 1 deprecation notice (use --verbose for details)', 'Compiled successfully in 1.8s',
    'no changes added to commit', '2 files changed, 47 insertions(+), 12 deletions(-)', 'Watching for file changes...'];

  function buildTerm() {
    const out = h('div', { class: 'term-out' }, BOOT.map((l) => h('div', { class: 'tline' }, l || ' ')));
    const input = h('span', { class: 'term-in', contenteditable: 'true', spellcheck: 'false' });
    const line = h('div', { class: 'term-line' }, h('span', { class: 'term-ps' }, '~/work/platform $ '), input, h('span', { class: 'term-caret' }));
    const scroller = h('div', { class: 'term-scroll' }, out, line);
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const cmd = input.textContent.trim();
      out.appendChild(h('div', { class: 'tline' }, '~/work/platform $ ' + cmd));
      if (cmd) out.appendChild(h('div', { class: 'tline dim' }, REPLIES[Math.floor(Math.random() * REPLIES.length)]));
      input.textContent = '';
      scroller.scrollTop = scroller.scrollHeight;
    });

    /* Autopilot: keep the terminal streaming plausible output on a jittered
       timer, so an unattended screen reads as a long-running job. Appends above
       the prompt and self-stops the moment the skin leaves the DOM. */
    const AP_LOGS = [
      '  ✓ src/api/routes.test.ts  (31)  1.02s', 'transforming (512) src/index.ts',
      '  info  Deploying to production...', '  [INFO] request handled in 42ms',
      'npm warn deprecated glob@7.2.3: no longer supported', '  ✓ compiled successfully',
      'Watching for file changes...', '  → GET  /api/health          200  3ms',
      '  ✓ src/lib/queue.test.ts  (18)  288ms', 'docker: pulled layer 4f2c9a... done',
      '  info  Uploaded 1284 files (18.2 MB)', '  ~ update in-place  aws_instance.web',
      '  + create           aws_lb_listener.https', 'Apply complete! Resources: 3 added, 1 changed.',
      '  → POST /api/jobs            202  11ms', '  hint: waiting for lock on .terraform.tfstate',
      '1284 modules transformed.', '  ✓ built in 6.91s'
    ];
    const AP_CMDS = ['npm run build', 'pytest -x -q', 'terraform apply -auto-approve',
      'git pull --rebase', 'docker compose up -d', 'tail -f logs/app.log',
      'kubectl rollout status deploy/web', 'npm run deploy -- --prod'];
    let apLeft = 0;
    function apTick() {
      if (!scroller.isConnected) return;                 // skin removed -> stop
      if (apLeft > 0) { out.appendChild(h('div', { class: 'tline dim' }, AP_LOGS[Math.floor(Math.random() * AP_LOGS.length)])); apLeft--; }
      else { out.appendChild(h('div', { class: 'tline' }, '~/work/platform $ ' + AP_CMDS[Math.floor(Math.random() * AP_CMDS.length)])); apLeft = 4 + Math.floor(Math.random() * 8); }
      while (out.children.length > 240) out.removeChild(out.firstChild);
      scroller.scrollTop = scroller.scrollHeight;
      setTimeout(apTick, 650 + Math.random() * 950);
    }
    setTimeout(apTick, 500);                              // wait until render() attaches the skin
    return {
      focus: () => { input.focus(); scroller.scrollTop = scroller.scrollHeight; },
      el: h('div', { class: 'skin term' },
        h('div', { class: 'term-bar' }, h('span', { class: 'tdots' }, h('i'), h('i'), h('i')), h('span', null, 'bash - 118x34 - ~/work/platform')),
        scroller)
    };
  }

  /* ============================ 5. ANY WEBSITE ============================ */
  function buildWeb() {
    const url = normalise(webUrl);
    if (!url) {
      return {
        focus: () => { },
        el: h('div', { class: 'skin webskin empty' },
          h('div', { class: 'web-empty' },
            h('h3', null, 'No site set yet'),
            h('p', null, 'Put a web address in the PANIC SCREEN box at the bottom of the arcade and this becomes that site.')))
      };
    }
    const frame = h('iframe', {
      class: 'web-frame', src: url, title: 'workspace',
      referrerpolicy: 'no-referrer'
    });
    /* most real sites refuse to be framed, so say so rather than showing a white void */
    const note = h('div', { class: 'web-note' },
      h('b', null, 'If this stayed blank, that site blocks embedding.'),
      ' Nearly all big sites do. Switch the panic screen mode to "Open the site" and the key will load it properly instead.');
    setTimeout(() => note.classList.add('show'), 2600);
    return { focus: () => { }, el: h('div', { class: 'skin webskin' }, frame, note) };
  }

  function normalise(u) {
    u = (u || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { new URL(u); return u; } catch (e) { return ''; }
  }
  function hostOf(u) {
    try { return new URL(normalise(u)).hostname.replace(/^www\./, ''); } catch (e) { return 'workspace'; }
  }

  /* ============================ 6. CALENDAR ============================ */
  const CAL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const CAL_EVENTS = [
    { d: 0, s: 9, e: 9.5, t: '1:1 // Katz', c: '#7986cb' },
    { d: 0, s: 11, e: 12, t: 'Sprint planning', c: '#3a6ea5' },
    { d: 0, s: 14, e: 15.5, t: 'HOLD — do not book', c: '#a79b8e' },
    { d: 1, s: 8.5, e: 9, t: 'Standup', c: '#33b679' },
    { d: 1, s: 10, e: 11, t: 'Design review', c: '#f4511e' },
    { d: 1, s: 13, e: 14, t: 'Lunch w/ Priya', c: '#f6bf26' },
    { d: 2, s: 9.5, e: 11, t: 'Focus block', c: '#616161' },
    { d: 2, s: 15, e: 16, t: 'Vendor call', c: '#039be5' },
    { d: 3, s: 10, e: 10.5, t: '1:1 // Okafor', c: '#7986cb' },
    { d: 3, s: 12, e: 13, t: 'Lunch', c: '#f6bf26' },
    { d: 3, s: 14, e: 15.5, t: 'Roadmap sync', c: '#3a6ea5' },
    { d: 4, s: 9, e: 9.5, t: 'Standup', c: '#33b679' },
    { d: 4, s: 11, e: 12, t: 'Interview: Backend', c: '#8e24aa' },
    { d: 4, s: 16, e: 17, t: 'Wind-down / notes', c: '#616161' }
  ];
  function calHalf(v) { const hh = Math.floor(v); const m = Math.round((v - hh) * 60); const ap = hh < 12 ? 'a' : 'p'; const h12 = hh % 12 === 0 ? 12 : hh % 12; return h12 + (m ? ':' + String(m).padStart(2, '0') : '') + ap; }

  function buildCalendar() {
    const now = new Date();
    const H0 = 8, H1 = 19, PXH = 46;
    const hours = [];
    for (let hh = H0; hh < H1; hh++) hours.push(hh);
    const fmtH = (hh) => (hh % 12 === 0 ? 12 : hh % 12) + (hh < 12 ? ' AM' : ' PM');
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const nowH = now.getHours() + now.getMinutes() / 60;
    const nowDayIdx = (now.getDay() + 6) % 7;
    const gridH = hours.length * PXH;

    const timeGutter = h('div', { class: 'cal-times' },
      hours.map((hh) => h('div', { class: 'cal-timelabel', style: { height: PXH + 'px' } }, fmtH(hh))));

    const cols = dayNames.map((dn, di) => {
      const col = h('div', { class: 'cal-col', style: { height: gridH + 'px' } });
      CAL_EVENTS.filter((e) => e.d === di).forEach((e) => {
        col.appendChild(h('div', {
          class: 'cal-event',
          style: { top: ((e.s - H0) * PXH) + 'px', height: ((e.e - e.s) * PXH - 3) + 'px', background: e.c }
        }, h('span', { class: 'cal-ev-t' }, e.t), h('span', { class: 'cal-ev-time' }, calHalf(e.s) + ' – ' + calHalf(e.e))));
      });
      if (di === nowDayIdx && nowH >= H0 && nowH <= H1) {
        col.appendChild(h('div', { class: 'cal-now', style: { top: ((nowH - H0) * PXH) + 'px' } }));
      }
      return col;
    });

    const dayHead = h('div', { class: 'cal-dayhead' },
      h('div', { class: 'cal-corner' }),
      dayNames.map((dn, di) => {
        const d = new Date(monday); d.setDate(monday.getDate() + di);
        return h('div', { class: 'cal-dcol' + (di === nowDayIdx ? ' today' : '') },
          h('span', { class: 'cal-dn' }, dn), h('span', { class: 'cal-dnum' }, String(d.getDate())));
      }));

    return {
      focus: () => { },
      el: h('div', { class: 'skin cal' },
        h('div', { class: 'cal-head' },
          h('span', { class: 'cal-logo' }, h('span', { class: 'cal-logo-day' }, String(now.getDate())), 'Calendar'),
          h('span', { class: 'cal-todaybtn' }, 'Today'),
          h('span', { class: 'cal-title' }, CAL_MONTHS[now.getMonth()] + ' ' + now.getFullYear()),
          h('span', { class: 'cal-viewbtn' }, 'Week')),
        dayHead,
        h('div', { class: 'cal-scroll' },
          h('div', { class: 'cal-grid' }, timeGutter,
            h('div', { class: 'cal-cols', style: { backgroundSize: '100% ' + PXH + 'px' } }, cols))))
    };
  }

  /* ============================ shell ============================ */
  const SKINS = [
    { id: 'docs', label: 'Doc', icon: 'docs', title: () => DOC_TITLE + ' - Docs', build: buildDocs },
    { id: 'sheet', label: 'Spreadsheet', icon: 'sheet', title: () => 'Q3_Regional_Forecast_v7_FINAL.xlsx', build: buildSheet },
    { id: 'inbox', label: 'Inbox', icon: 'inbox', title: () => 'Inbox (3) - Mail', build: buildInbox },
    { id: 'term', label: 'Terminal', icon: 'term', title: () => 'bash - ~/work/platform', build: buildTerm },
    { id: 'cal', label: 'Calendar', icon: 'sheet', title: () => 'Calendar - ' + CAL_MONTHS[new Date().getMonth()] + ' ' + new Date().getFullYear(), build: buildCalendar },
    { id: 'web', label: 'Any website', icon: 'web', title: () => hostOf(webUrl), build: buildWeb }
  ];
  const skin = () => SKINS.find((s) => s.id === skinId) || SKINS[0];

  const Boss = {
    SKINS,
    skinId: () => skinId,
    title: () => skin().title(),
    url: () => webUrl,
    mode: () => webMode,
    setUrl(u) { webUrl = u; store.set('bossurl', u); if (on && skinId === 'web') { render(); } },
    setMode(m) { webMode = m === 'embed' ? 'embed' : 'jump'; store.set('bossmode', webMode); },
    setSkin(id) {
      if (!SKINS.some((s) => s.id === id)) return;
      skinId = id;
      store.set('bossskin', id);
      if (on) { render(); if (current && current.focus) current.focus(); }
      if (Boss.onChange) Boss.onChange(id);
    },
    cycle() {
      const i = SKINS.findIndex((s) => s.id === skinId);
      Boss.setSkin(SKINS[(i + 1) % SKINS.length].id);
    },
    isOn: () => on
  };

  function render() {
    current = skin().build();
    /* A secret way out for when your hands are already on the mouse (or you are
       on a phone with no backtick key): the app logo in the top-left corner is
       a live button that drops you straight back into the arcade. */
    const exit = h('button', {
      class: 'boss-exit', type: 'button', title: 'Back to the arcade',
      'aria-label': 'Back to the arcade',
      onclick: (e) => {
        e.preventDefault(); e.stopPropagation();
        if (global.Arcade && global.Arcade.toggleBoss) global.Arcade.toggleBoss(false);
        else Boss.toggle(false);
      }
    });
    host.replaceChildren(current.el, exit,
      h('div', { class: 'boss-hint' }, 'press ` or click the corner logo to resume'));
  }

  Boss.build = function build() {
    host = h('div', { class: 'boss hidden', id: 'boss', 'aria-hidden': 'true' });
    return host;
  };

  Boss.toggle = function toggle(force) {
    const want = force === undefined ? !on : force;
    /* "open the site" mode genuinely navigates, which is the only thing that
       works for sites that refuse to be embedded */
    if (want && skinId === 'web' && webMode === 'jump') {
      const u = normalise(webUrl);
      if (u) { location.href = u; return false; }
    }
    on = want;
    if (on) render();
    host.classList.toggle('hidden', !on);
    host.setAttribute('aria-hidden', on ? 'false' : 'true');
    document.body.classList.toggle('boss-on', on);
    if (on && current && current.focus) setTimeout(current.focus, 0);
    if (!on) host.replaceChildren();
    return on;
  };

  global.Boss = Boss;
})(window);
