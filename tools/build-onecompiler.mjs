/* Build a three-file version for online HTML playgrounds that block inline
   <script> via CSP (OneCompiler, some CodePen configs, corp sandboxes).
   Usage: node tools/build-onecompiler.mjs
   Output: dist/onecompiler/{index.html, style.css, script.js}

   Why three files: a full-page paste puts every script inline, and a preview
   that serves `script-src 'self'` (no 'unsafe-inline') silently blocks all of
   it — the stylesheet still applies, so you get the background and nothing
   else. An EXTERNAL script.js is same-origin to the playground and runs anyway.
   Paste each file into the matching tab. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* take the script order straight from index.html so the two can never drift */
const src = read('index.html');
const scripts = [...src.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
if (!scripts.length) throw new Error('no <script src> tags found in index.html');

/* concatenate every module. Each file is a self-contained IIFE; a leading
   semicolon before each guards against any ASI hazard at the joins. */
const js = scripts.map((s) => ';\n/* ' + s + ' */\n' + read(s).trim() + '\n').join('\n') +
  '\n;\n/* boot */\nArcade.start();\n';

const indexHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5">
<meta name="theme-color" content="#6f3fa8">
<title>CUBICLE ARCADE 98</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<noscript><p style="padding:24px;font-family:Verdana,sans-serif">This needs JavaScript. It is all client side.</p></noscript>
<script src="script.js"></script>
</body>
</html>
`;

const outDir = path.join(ROOT, 'dist/onecompiler');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml);
fs.writeFileSync(path.join(outDir, 'style.css'), read('css/arcade.css'));
fs.writeFileSync(path.join(outDir, 'script.js'), js);
console.log('dist/onecompiler/index.html   ' + (indexHtml.length / 1024).toFixed(1) + ' KB');
console.log('dist/onecompiler/style.css    ' + (read('css/arcade.css').length / 1024).toFixed(1) + ' KB');
console.log('dist/onecompiler/script.js    ' + (js.length / 1024).toFixed(1) + ' KB  (' + scripts.length + ' modules)');
