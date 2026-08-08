/* Bundle the whole arcade into one portable .html file.
   Usage: node tools/build-single-file.mjs
   Output: dist/cubicle-arcade.html — a single, COMPLETE, standards-mode HTML
   document: real <!doctype>, the meta viewport, the favicon, all of it. Every
   script and the stylesheet are inlined, so there are no side-requests. Email
   it, drop it on a USB stick, open it from a file:// path, put it on Google
   Drive, or paste the whole thing into an online HTML playground (OneCompiler,
   CodePen, JSFiddle) — it needs nothing else. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const guardScript = (src, file) => {
  if (src.includes('</script')) throw new Error('literal </script in ' + file);
  return src;
};
const guardStyle = (src, file) => {
  if (src.includes('</style')) throw new Error('literal </style in ' + file);
  return src;
};

/* Start from the real index.html and inline its assets in place, so the bundle
   is the exact same document — doctype, meta viewport, favicon, body and all —
   just with nothing left to fetch. The two can never drift. */
let html = read('index.html');

let cssCount = 0;
html = html.replace(/[ \t]*<link rel="stylesheet" href="([^"]+)">/g, (m, href) => {
  cssCount++;
  return '<style>\n' + guardStyle(read(href), href) + '\n</style>';
});
if (!cssCount) throw new Error('no <link rel="stylesheet"> found in index.html');

let jsCount = 0;
html = html.replace(/[ \t]*<script src="([^"]+)"><\/script>/g, (m, src) => {
  jsCount++;
  return '<script>\n' + guardScript(read(src), src) + '\n</script>';
});
if (!jsCount) throw new Error('no <script src> tags found in index.html');

if (/<script src="/.test(html) || /<link rel="stylesheet"/.test(html)) {
  throw new Error('an external reference survived inlining');
}

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/cubicle-arcade.html'), html);
console.log('dist/cubicle-arcade.html  ' + (html.length / 1024).toFixed(1) +
  ' KB  (' + jsCount + ' scripts + ' + cssCount + ' stylesheet inlined)');
