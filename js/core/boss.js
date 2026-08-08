/* The panic screen. Four disguises, all of them typeable.
   Hit the key, land in something that looks like work, and actually type in it. */
(function (global) {
  'use strict';
  const h = Engine.h;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('cubicle:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cubicle:' + k, JSON.stringify(v)); } catch (e) { } }
  };

  let skinId = store.get('bossskin', 'docs');
  let host = null;
  let on = false;
  let current = null;

  /* ============================ DOCS ============================ */
  const DOC_TITLE = 'Q3 Planning Notes';
  const DOC_BODY =
    '<h1>Q3 Planning Notes</h1>' +
    '<p class="sub">Draft. Shared with the working group. Comments welcome by Friday.</p>' +
    '<h2>Where we landed</h2>' +
    '<p>Carrying three workstreams into Q3 rather than five. The two we are pausing were not failing, they were just competing for the same two people. We will revisit both at the September checkpoint.</p>' +
    '<h2>Open questions</h2>' +
    '<ul>' +
    '<li>Who owns the migration once the contractor rolls off?</li>' +
    '<li>Do we still need the weekly sync, or is the written update enough?</li>' +
    '<li>Budget line for tooling has not been confirmed. Chasing.</li>' +
    '</ul>' +
    '<h2>Actions</h2>' +
    '<ol>' +
    '<li>Draft the one-pager and circulate before the review.</li>' +
    '<li>Confirm headcount assumptions with Finance.</li>' +
    '<li>Book the follow-up. Thirty minutes, not sixty.</li>' +
    '</ol>' +
    '<h2>Notes from the room</h2>' +
    '<p>General agreement that scope crept because nobody was empowered to say no. Proposal is to name a single decision owner per workstream. No objections raised.</p>' +
    '<p><br></p>';

  function buildDocs() {
    const body = h('div', {
      class: 'doc-body', contenteditable: 'true', spellcheck: 'false',
      html: DOC_BODY
    });
    const words = h('span', null, '0 words');
    const recount = () => {
      const t = (body.innerText || '').trim();
      words.textContent = (t ? t.split(/\s+/).length : 0) + ' words';
    };
    body.addEventListener('input', recount);
    setTimeout(recount, 0);

    const tool = (label, cls) => h('span', { class: 'dtool ' + (cls || '') }, label);

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
      el: h('div', { class: 'skin docs' },
        h('div', { class: 'doc-top' },
          h('div', { class: 'doc-ident' },
            h('span', { class: 'doc-icon' }, '📄'),
            h('div', null,
              h('div', { class: 'doc-name' }, DOC_TITLE),
              h('div', { class: 'doc-menu' }, ['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'Extensions', 'Help'].map((m) => h('span', null, m))))),
          h('div', { class: 'doc-actions' },
            h('span', { class: 'doc-saved' }, '✓ Saved to Drive'),
            h('span', { class: 'doc-share' }, '🔒 Share'))),
        h('div', { class: 'doc-tools' },
          tool('↶'), tool('↷'), tool('🖨'), tool('🔍'),
          h('span', { class: 'dsep' }),
          h('span', { class: 'dtool wide' }, 'Normal text ▾'),
          h('span', { class: 'dsep' }),
          h('span', { class: 'dtool wide' }, 'Arial ▾'),
          h('span', { class: 'dsep' }),
          tool('−'), h('span', { class: 'dtool num' }, '11'), tool('+'),
          h('span', { class: 'dsep' }),
          tool('B', 'b'), tool('I', 'i'), tool('U', 'u'),
          h('span', { class: 'dsep' }),
          tool('☰'), tool('•'), tool('1.')),
        h('div', { class: 'doc-page-wrap' }, h('div', { class: 'doc-page' }, body)),
        h('div', { class: 'doc-status' }, words, h('span', null, 'Page 1 of 1'), h('span', null, 'Last edit was seconds ago')))
    };
  }

  /* ============================ SHEET ============================ */
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
        onfocus: () => {
          cellRef.textContent = COLS[col] + row;
          formula.textContent = td.textContent;
          td.classList.add('sel');
        },
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
      rows.push(h('tr', null,
        h('td', { class: 'rowhead' }, rn),
        mkCell(r[0], '', 0, rn),
        mkCell(r[1], '', 1, rn),
        mkCell(money(r[2]), 'num', 2, rn),
        mkCell(money(r[3]), 'num', 3, rn),
        mkCell((r[4] > 0 ? '+' : '') + r[4].toFixed(1) + '%', 'num ' + (r[4] < 0 ? 'neg' : 'pos'), 4, rn),
        mkCell(r[5], '', 5, rn),
        mkCell('', '', 6, rn)));
    });

    const tot = ROWS_DATA.length + 2;
    rows.push(h('tr', { class: 'total' },
      h('td', { class: 'rowhead' }, tot),
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
          h('span', { class: 'tab active' }, 'Summary'),
          h('span', { class: 'tab' }, 'By Region'),
          h('span', { class: 'tab' }, 'Pipeline'),
          h('span', { class: 'tab' }, 'Assumptions'),
          h('span', { class: 'tab' }, 'Sheet4')))
    };
  }

  /* ============================ INBOX ============================ */
  const MAIL = [
    { f: 'Facilities', s: 'Kitchen fridge will be emptied Friday', t: '9:14 AM', p: 'Anything left after 5pm goes in the bin, including the containers. This is the fourth notice.' },
    { f: 'R. Patel', s: 'RE: RE: RE: quick question', t: '9:02 AM', p: 'Sorry, resending with the right attachment this time. Ignore the last two.' },
    { f: 'IT Helpdesk', s: 'Scheduled maintenance window', t: '8:47 AM', p: 'Systems may be unavailable Saturday 02:00 to 06:00. No action needed from you.' },
    { f: 'S. Okafor', s: 'Notes from yesterday', t: '8:31 AM', p: 'Wrote up what we agreed. Shout if I mangled anything.' },
    { f: 'All Staff', s: 'Reminder: complete your training module', t: 'Yesterday', p: 'The deadline has been extended. Again. Please do it.' },
    { f: 'M. Duarte', s: 'Lunch?', t: 'Yesterday', p: 'The place with the soup. 12:15?' },
    { f: 'Payroll', s: 'Your payslip is available', t: 'Yesterday', p: 'Log in to view. Do not reply to this address.' },
    { f: 'J. Lindqvist', s: 'Draft for review, no rush', t: 'Mon', p: 'Whenever you get a minute this week is fine.' }
  ];

  function buildInbox() {
    const reply = h('div', {
      class: 'mail-reply', contenteditable: 'true', spellcheck: 'false',
      html: '<p>Thanks for flagging this.</p><p><br></p>'
    });
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
          h('span', { class: 'mail-logo' }, '✉ Mail'),
          h('span', { class: 'mail-search' }, 'Search mail'),
          h('span', { class: 'mail-avatar' }, 'K')),
        h('div', { class: 'mail-cols' },
          h('div', { class: 'mail-side' },
            h('div', { class: 'mail-compose' }, '✏ Compose'),
            ['Inbox 3', 'Starred', 'Snoozed', 'Sent', 'Drafts 2', 'Archive', 'Spam'].map((f, i) =>
              h('div', { class: 'mail-folder' + (i === 0 ? ' active' : '') }, f))),
          list,
          h('div', { class: 'mail-read' },
            subject,
            from,
            bodyText,
            h('div', { class: 'mail-reply-wrap' },
              h('div', { class: 'mail-reply-head' }, 'Reply to ' + MAIL[3].f),
              reply,
              h('div', { class: 'mail-reply-foot' }, h('span', { class: 'mail-send' }, 'Send'), h('span', null, '📎'), h('span', null, '🙂'))))))
    };
  }

  /* ============================ TERMINAL ============================ */
  const BOOT = [
    '$ npm run build',
    '',
    '> platform@4.12.0 build',
    '> tsc -p tsconfig.json && vite build',
    '',
    'vite v5.4.2 building for production...',
    'transforming (412) src/index.ts',
    '✓ 1284 modules transformed.',
    'dist/assets/index-9f2a1c.css     42.18 kB │ gzip:  8.02 kB',
    'dist/assets/index-4b71ee.js     612.44 kB │ gzip: 184.91 kB',
    '✓ built in 7.42s',
    '',
    '$ npm test -- --run',
    '',
    ' PASS  src/lib/parser.test.ts (24 tests) 412ms',
    ' PASS  src/lib/queue.test.ts (18 tests) 288ms',
    ' PASS  src/api/routes.test.ts (31 tests) 1.02s',
    '',
    'Test Files  3 passed (3)',
    '     Tests  73 passed (73)',
    '  Duration  2.31s',
    ''
  ];
  const REPLIES = [
    'ok',
    'done.',
    'nothing to commit, working tree clean',
    'Already up to date.',
    'warning: 1 deprecation notice (use --verbose for details)',
    'Compiled successfully in 1.8s',
    'no changes added to commit',
    '2 files changed, 47 insertions(+), 12 deletions(-)',
    'Watching for file changes...'
  ];

  function buildTerm() {
    const out = h('div', { class: 'term-out' }, BOOT.map((l) => h('div', { class: 'tline' }, l || ' ')));
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

    return {
      focus: () => { input.focus(); scroller.scrollTop = scroller.scrollHeight; },
      el: h('div', { class: 'skin term' },
        h('div', { class: 'term-bar' },
          h('span', { class: 'tdots' }, h('i'), h('i'), h('i')),
          h('span', null, 'bash - 118x34 - ~/work/platform')),
        scroller)
    };
  }

  /* ============================ shell ============================ */
  const SKINS = [
    { id: 'docs', label: '📄 Doc', title: 'Q3 Planning Notes - Docs', build: buildDocs },
    { id: 'sheet', label: '📊 Spreadsheet', title: 'Q3_Regional_Forecast_v7_FINAL.xlsx', build: buildSheet },
    { id: 'inbox', label: '✉️ Inbox', title: 'Inbox (3) - Mail', build: buildInbox },
    { id: 'term', label: '💻 Terminal', title: 'bash - ~/work/platform', build: buildTerm }
  ];
  const skin = () => SKINS.find((s) => s.id === skinId) || SKINS[0];

  const Boss = {
    SKINS,
    skinId: () => skinId,
    title: () => skin().title,
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
    host.replaceChildren(current.el, h('div', { class: 'boss-hint' }, 'press ` to resume'));
  }

  Boss.build = function build() {
    host = h('div', { class: 'boss hidden', id: 'boss', 'aria-hidden': 'true' });
    return host;
  };

  Boss.toggle = function toggle(force) {
    on = force === undefined ? !on : force;
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
