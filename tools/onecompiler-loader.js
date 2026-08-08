(function () {
  'use strict';

  var SCRIPT_URL = 'script.js';
  var EXPECT_LEN = 209070;   // our known-good minified bundle size
  var TRUNC_HINT = 100000;   // below this, a paste was almost certainly cut short
  var EMPTY_FLOOR = 2000;    // below this, treat the tab as empty/wrong -> report now
  var BASE_SEED = 4096;      // > ~315 real loop sites; wide margin for a fresh pass
  var SEED_CAP = 50000;      // ceiling when sizing pins from a model-B scan
  var CHUNK = 1000;          // pin block size (bounds apply() arg count + recursion depth)

  var fetchedLen = -1;
  var fetchedHasLp = false;
  var fetchedMaxLp = 0;
  var lpErr = '';            // an __lp / ReferenceError message from an injected script
  var lastRuntimeErr = '';   // most recent window 'error' message
  var lastThrown = '';       // caught DOM / blob / eval error text

  // Record injected-script throws (they surface on window 'error', NOT in our
  // try/catch). Installed first so the __lp fingerprint is captured whenever it
  // happens. Resource errors (no .message) are ignored.
  try {
    window.addEventListener('error', function (ev) {
      var m = (ev && ev.message) || (ev && ev.error && ev.error.message) || '';
      if (!m) { return; }
      m = String(m);
      lastRuntimeErr = m;
      if (/__lp/.test(m)) { lpErr = m; }
    }, true);
  } catch (e0) {}

  // Pin one name as a global accessor: reads -> 0 (no ReferenceError), writes ->
  // no-op (no strict-mode TypeError on ++/assignment). Reading 0 keeps upward
  // counter guards (++__lpN>LIMIT) false forever, so loops end on their real
  // condition. Pure no-op under models A/C, where the app has zero __lp reads.
  function pin(name) {
    try {
      if (Object.prototype.hasOwnProperty.call(window, name)) { return; }
      Object.defineProperty(window, name, {
        configurable: true,
        get: function () { return 0; },
        set: function () {}
      });
    } catch (e) {
      try { window[name] = 0; } catch (e2) {}
    }
  }

  // Seed [start, stop) of __lp<index>. NO for/while/do -- uses Array.forEach (a
  // call, invisible to loop-protection) plus shallow recursion over CHUNK blocks.
  function seedBlock(start, stop) {
    if (start >= stop) { return; }
    var end = Math.min(start + CHUNK, stop);
    Array.apply(null, { length: end - start }).forEach(function (_u, k) {
      pin('__lp' + (start + k));
    });
    seedBlock(end, stop);
  }
  function seedRange(maxIndex) {
    if (maxIndex < 1) { return; }
    if (maxIndex > SEED_CAP) { maxIndex = SEED_CAP; }
    pin('__lp');
    pin('__lp0');
    seedBlock(1, maxIndex + 1);
  }

  // Boot signal: the bundle does e.Arcade=u with e===window (5x "}(window)").
  function booted() {
    try { return typeof window.Arcade !== 'undefined' && window.Arcade !== null; }
    catch (e) { return false; }
  }

  // Execute via a RUNTIME-created inline <script> (script-src 'unsafe-inline',
  // OBSERVED-2). Exec errors surface on window 'error', so outcome is read with
  // booted(), not this try/catch (which only guards DOM insertion).
  function injectInline(code) {
    try {
      var s = document.createElement('script');
      s.textContent = code;   // verbatim; preserves the bundle's own "use strict"
      (document.body || document.head || document.documentElement).appendChild(s);
    } catch (e) { lastThrown = String(e && e.message ? e.message : e); }
  }

  // Alternate channel: blob: URL <script> (async; may be CSP-blocked -> onerror).
  function injectBlob(code, done) {
    var urlApi = window.URL || window.webkitURL, url = null;
    try {
      url = urlApi.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    } catch (e) { lastThrown = String(e && e.message ? e.message : e); done(); return; }
    var s = document.createElement('script');
    function cleanup() { try { urlApi.revokeObjectURL(url); } catch (e) {} }
    s.onload = function () { cleanup(); done(); };
    s.onerror = function () { cleanup(); done(); };
    s.src = url;
    try {
      (document.body || document.head || document.documentElement).appendChild(s);
    } catch (e) { lastThrown = String(e && e.message ? e.message : e); cleanup(); done(); }
  }

  // Last resort: new Function (needs 'unsafe-eval'; throws if blocked). The
  // bundle invokes its IIFEs as "}(window)", so window.Arcade is still set.
  function tryEval(code) {
    try { (new Function(code)).call(window); }
    catch (e) { lastThrown = String(e && e.message ? e.message : e); }
  }

  function inferModel() {
    if (fetchedLen >= 0 && fetchedLen < TRUNC_HINT) {
      return 'TRUNCATED / EMPTY / WRONG JS TAB -- script.js came back ' + fetchedLen +
        ' chars (expected ~' + EXPECT_LEN + '). Re-paste the full script.js into the JS tab.';
    }
    if (fetchedHasLp) {
      return 'MODEL B (VFS-INSTRUMENTED): fetch itself returned bytes that ALREADY ' +
        'contain __lp guards (max index ~' + fetchedMaxLp + '). Upward-counter guards ' +
        'were neutralized by pinning __lp*->0, but the app still did not boot, so the ' +
        'guard is not a plain counter (e.g. a Date.now()-__lpN timestamp guard, which ' +
        'needs the OPPOSITE value). A VFS-level rewrite of that shape cannot be undone ' +
        'client-side; host on a preview that does not rewrite loops, or pre-split the file.';
    }
    if (/__lp/.test(lpErr)) {
      return 'MODEL C WORST CASE: fetched code was CLEAN (no __lp) yet a runtime error ' +
        'references __lp ("' + lpErr + '") -- the runtime-injected <script> ITSELF got ' +
        'loop-instrumented, and neither pinning, blob:, nor eval escaped it (blob:/eval ' +
        'likely CSP-blocked). This environment cannot host the un-split bundle.';
    }
    return 'CLEAN FETCH, NO __lp: script.js was fetched intact and carries no guards, but ' +
      'execution never defined window.Arcade. Likely a genuine runtime error in the bundle, ' +
      'or blob:/eval channels were CSP-blocked. Last error: ' +
      (lastRuntimeErr || lastThrown || '(none captured)');
  }
  function report() {
    var text =
      'CUBICLE ARCADE - LOADER DIAGNOSTIC\n' +
      '==================================\n\n' +
      inferModel() + '\n\n' +
      'fetched script.js length : ' + fetchedLen +
        (fetchedLen >= 0 ? ' chars (expected ~' + EXPECT_LEN + ')' : ' (fetch failed)') + '\n' +
      'contains /__lp\\d/        : ' + fetchedHasLp +
        (fetchedHasLp ? '  (max index ~' + fetchedMaxLp + ')' : '') + '\n' +
      'window.Arcade defined    : ' + booted() + '\n' +
      'injected-script error    : ' + (lpErr || lastRuntimeErr || '(none)') + '\n' +
      'caught (dom/blob/eval)   : ' + (lastThrown || '(none)') + '\n';
    var pre = document.createElement('pre');
    pre.style.cssText = 'margin:0;padding:16px;white-space:pre-wrap;word-break:break-word;' +
      'font:13px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#ffe3e3;' +
      'background:#5a1111;min-height:100vh;box-sizing:border-box';
    pre.textContent = text;
    try {
      var root = document.body || document.documentElement;
      root.innerHTML = '';
      root.appendChild(pre);
    } catch (e) {
      try { document.documentElement.appendChild(pre); } catch (e2) {}
    }
    try { console.error(text); } catch (e3) {}
  }

  // Clean fetched code that did not boot via raw inline -> threat-ii / channels.
  function cleanFallback(code) {
    // Our injected element may have been instrumented (indices restart at 1);
    // pin a wide range, then re-inject.
    seedRange(BASE_SEED);
    injectInline(code);
    if (booted()) { return; }
    // Different channel: blob: URL may dodge inline instrumentation (or be blocked).
    injectBlob(code, function () {
      if (booted()) { return; }
      // Absolute last resort.
      tryEval(code);
      if (booted()) { return; }
      report();
    });
  }

  function start(code) {
    fetchedLen = code ? code.length : 0;
    fetchedHasLp = /__lp\d/.test(code || '');
    if (fetchedHasLp) {
      (code.match(/__lp\d+/g) || []).forEach(function (s) {
        var n = +s.slice(4);
        if (n > fetchedMaxLp) { fetchedMaxLp = n; }
      });
    }

    if (fetchedLen < EMPTY_FLOOR) { report(); return; }   // nothing runnable

    // STRATEGY 1a: raw runtime inline inject -- the model-A/C happy path, no pins.
    injectInline(code);
    if (booted()) { return; }

    // MODEL B: raw inject just threw on unpinned __lp. Pin the scanned range
    // (plus margin) and re-inject (STRATEGY 1b). Counter guards now all read 0.
    if (fetchedHasLp) {
      seedRange(Math.max(fetchedMaxLp + 256, BASE_SEED));
      injectInline(code);
      if (booted()) { return; }
      report();   // guards present but not counter-shaped -> unrecoverable client-side
      return;
    }

    // Clean code that didn't boot -> alternate channels.
    cleanFallback(code);
  }

  function fetchAndBoot() {
    var haveFetch;
    try { haveFetch = (typeof fetch === 'function'); } catch (e) { haveFetch = false; }
    if (!haveFetch) { lastThrown = 'fetch() is unavailable in this preview'; report(); return; }

    fetch(SCRIPT_URL, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status + ' fetching ' + SCRIPT_URL); }
      return r.text();
    }).then(function (code) {
      start(code);
    })['catch'](function (err) {
      lastThrown = String(err && err.message ? err.message : err) +
        ' (a CSP connect-src block would stop the same-origin fetch of the sibling tab file)';
      report();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchAndBoot);
  } else {
    fetchAndBoot();
  }
})();