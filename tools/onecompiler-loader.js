/* OneCompiler / sandboxed-playground loader for Cubicle Arcade.

   The problem: OneCompiler runs an infinite-loop-guard rewriter that injects
   __lp counters into scripts. It breaks on the minified bundle
   (ReferenceError: __lp1 is not defined) and — critically — it instruments not
   only tab <script src> but ALSO scripts injected into the main document at
   runtime (observed: "index.html line 93 > injectedScript:1"). So neither
   <script src="script.js"> nor a runtime-created inline <script> runs our code
   untouched.

   The escape: build a same-origin <iframe srcdoc> at runtime and run the whole
   arcade inside it. The iframe's scripts are parsed by the iframe's own HTML
   parser in a separate realm, so the main document's rewriter never sees them.
   CSS + the 209 KB bundle are fetched as text and inlined into the srcdoc, which
   is assembled in JS and therefore never sat in a size-capped tab.

   If the arcade still fails to boot, the loader paints an on-screen diagnostic
   instead of a blank preview, naming the likely cause.

   NOTE: this file contains ZERO for/while/do statements on purpose — if the
   rewriter instruments this bootstrap, it finds no loop to guard, so the
   bootstrap itself can never self-brick. */
(function () {
  'use strict';

  var EXPECT_LEN = 209070;   // known-good minified bundle size
  var EMPTY_FLOOR = 2000;    // below this, the JS tab is empty/truncated/wrong
  var CSS_NAMES = ['styles.css', 'style.css'];   // OneCompiler default is styles.css

  function esc(s) { return String(s); }

  function paint(title, body) {
    try {
      var pre = document.createElement('pre');
      pre.style.cssText = 'margin:0;padding:16px;white-space:pre-wrap;word-break:break-word;' +
        'font:13px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#ffe3e3;' +
        'background:#5a1111;min-height:100vh;box-sizing:border-box';
      pre.textContent = 'CUBICLE ARCADE — LOADER DIAGNOSTIC\n==================================\n\n' +
        title + '\n\n' + body;
      var root = document.body || document.documentElement;
      root.innerHTML = '';
      root.appendChild(pre);
    } catch (e) {}
  }

  function boot(css, js) {
    if (!js || js.length < EMPTY_FLOOR) {
      paint('TRUNCATED / EMPTY / WRONG JS TAB',
        'script.js came back ' + (js ? js.length : 0) + ' chars (expected ~' + EXPECT_LEN +
        ').\nRe-paste the full script.js into the JS tab (watch the ~256 KB cap).');
      return;
    }

    /* Assemble the arcade as its own document. The build guarantees css and js
       carry no closing style or script tag sequences, so inlining is safe. */
    var doc =
      '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5">' +
      '<style>' + css + '</style></head><body>' +
      '<' + 'script>' + js + '<\/script></body></html>';

    var frame = document.createElement('iframe');
    frame.setAttribute('title', 'Cubicle Arcade');
    frame.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:0;margin:0;padding:0;display:block';
    frame.srcdoc = doc;
    (document.body || document.documentElement).appendChild(frame);

    /* Verify it actually booted; srcdoc is same-origin so we can look inside. */
    var checkedOnce = false;
    function verify() {
      if (checkedOnce) { return; }
      checkedOnce = true;
      var ok = false, reason = '';
      try {
        var w = frame.contentWindow;
        if (w && typeof w.Arcade !== 'undefined' && w.Arcade !== null) { ok = true; }
        if (!ok) {
          var d = frame.contentDocument;
          var txt = (d && d.body && d.body.innerText) || '';
          if (/\bGAMES\b/.test(txt)) { ok = true; }
          if (!ok && /__lp/.test(txt)) { reason = 'the iframe script was ALSO instrumented (__lp): ' + txt.slice(0, 200); }
        }
      } catch (e) { reason = 'could not inspect the iframe (' + esc(e && e.message) + ') — it may be sandboxed here.'; }
      if (!ok) {
        paint('IFRAME DID NOT BOOT THE ARCADE',
          (reason || 'The arcade did not initialize inside the iframe.') +
          '\n\nfetched script.js length : ' + js.length + ' (expected ~' + EXPECT_LEN + ')' +
          '\nfetched styles.css length : ' + css.length +
          '\n\nIf this says the iframe was instrumented too, this sandbox rewrites nested-frame\n' +
          'scripts as well — use the Vercel copy instead (imverybored.vercel.app).');
      }
    }
    if (frame.addEventListener) { frame.addEventListener('load', function () { setTimeout(verify, 300); }); }
    setTimeout(verify, 2500);
  }

  function grab(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status + ' for ' + url); }
      return r.text();
    });
  }

  /* Try styles.css then style.css; missing CSS -> unstyled but still playable. */
  function grabCss() {
    return grab(CSS_NAMES[0])['catch'](function () {
      return grab(CSS_NAMES[1])['catch'](function () { return ''; });
    });
  }

  function start() {
    var haveFetch = false;
    try { haveFetch = (typeof fetch === 'function'); } catch (e) {}
    if (!haveFetch) { paint('fetch() UNAVAILABLE', 'This sandbox has no fetch(); cannot load script.js.'); return; }

    Promise.all([grabCss(), grab('script.js')])
      .then(function (res) { boot(res[0], res[1]); })
      ['catch'](function (err) {
        paint('COULD NOT LOAD script.js', esc(err && err.message ? err.message : err) +
          '\n\nMake sure the full script.js is pasted into the JS tab.');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
