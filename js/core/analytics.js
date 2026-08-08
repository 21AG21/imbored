/* Vercel Web Analytics.

   The one thing in the whole build that talks to a network, and it only wakes
   up where it actually works: a Vercel deployment. The insights script is
   served by Vercel's own edge, so anywhere else it simply would not exist —
   a file://, localhost, Google Drive / DriveToWeb, GitHub Pages, the
   single-file bundle. Rather than chase an endless list of "not Vercel" hosts,
   we allow-list Vercel and stay completely silent (and network-free) everywhere
   else. That keeps the console clean off-Vercel and means the Drive copy on a
   work laptop makes no outbound request at all.

   It records anonymous page views only. No scores, no settings, and none of the
   text you type into a panic screen is ever sent. Collection still has to be
   switched on in the Vercel project dashboard for anything to record.

   Default Vercel URLs all end in .vercel.app (production, branch and preview
   deploys alike). If you put a custom domain in front of a Vercel project, set
     window.__ARCADE_VERCEL__ = true
   before this script loads and analytics will run there too. */
(function () {
  'use strict';
  var host = location.hostname || '';
  var onVercel = host.endsWith('.vercel.app') || window.__ARCADE_VERCEL__ === true;
  if (!onVercel) return;

  /* queue stub so any va() call before the script arrives is not lost */
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  var s = document.createElement('script');
  s.defer = true;
  s.src = '/_vercel/insights/script.js';
  s.onerror = function () { /* not actually served by Vercel; stay silent */ };
  (document.head || document.documentElement).appendChild(s);
})();
