/* Vercel Web Analytics.

   This is the ONE thing in the whole build that talks to a network, and it is
   deliberately kept on a leash: it only loads when the page is served from a
   real deployed host. Opened from a file://, from localhost, or as the
   single-file bundle, it does nothing at all — so the "runs off the disk,
   nothing leaves the browser" promise still holds everywhere except a live
   Vercel deployment, and the console stays clean (no 404 on the Vercel script
   when there is no Vercel serving it).

   It collects anonymous page views only. No scores, no typed panic-screen text,
   nothing you do inside a game is ever sent. You still have to flip on
   "Web Analytics" in the Vercel project dashboard for any of it to record. */
(function () {
  'use strict';
  var proto = location.protocol;
  var host = location.hostname;
  var offline =
    proto === 'file:' ||
    host === '' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    host.endsWith('.local');
  if (offline) return;

  /* queue stub so va() calls before the script loads are not lost */
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  var s = document.createElement('script');
  s.defer = true;
  s.src = '/_vercel/insights/script.js';
  s.onerror = function () { /* host is not Vercel; stay silent */ };
  (document.head || document.documentElement).appendChild(s);
})();
