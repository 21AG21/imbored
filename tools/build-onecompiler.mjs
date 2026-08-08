/* Build a three-file version for online HTML playgrounds (OneCompiler, CodePen,
   corp sandboxes).
   Usage: node tools/build-onecompiler.mjs
   Output: dist/onecompiler/{index.html, style.css, script.js}

   Why three files: playgrounds cap how much text a single tab will hold —
   OneCompiler silently truncates a paste at ~256 KB. The full inlined single
   file (~406 KB) gets chopped mid-script and nothing runs. Splitting the code
   into an external script.js keeps each tab small; the stylesheet still applies
   either way, which is why a broken paste shows only the background.

   Even split out, the concatenated JS (~362 KB) is over the cap, so this tool
   MINIFIES script.js with terser when it is available (`npm i terser`, or run
   `npx terser` by hand). Minified it is ~209 KB — comfortably under 256 KB.
   Without terser it writes the readable version and warns that it will be
   truncated by size-capped playgrounds. Paste each file into the matching tab. */
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
let js = scripts.map((s) => ';\n/* ' + s + ' */\n' + read(s).trim() + '\n').join('\n') +
  '\n;\n/* boot */\nArcade.start();\n';

/* Minify to fit under playground paste caps (OneCompiler ~256 KB). Optional:
   if terser is not installed we ship the readable file and warn. */
let minified = false;
try {
  const terser = await import('terser');
  const out = await terser.minify(js, { compress: true, mangle: true });
  if (out && out.code) { js = out.code; minified = true; }
} catch (e) {
  /* terser not available — fall through and warn below */
}

/* NOTE the loader (tools/onecompiler-loader.js): OneCompiler runs an
   infinite-loop-guard rewriter that injects __lp counters into scripts. It
   breaks on the minified bundle (ReferenceError: __lp1 is not defined) and
   instruments not just tab <script src> but ALSO scripts injected into the main
   document at runtime. The loader escapes it by fetching styles.css + script.js
   as text and running the whole arcade inside a runtime-built <iframe srcdoc>:
   the iframe's scripts are parsed in its own realm, out of the main-document
   rewriter's reach. If it still cannot boot, it paints an on-screen diagnostic
   rather than a blank preview. Validated against a local reproduction that
   injects the exact __lp breakage into runtime + parser scripts: the naive
   loader reproduces the failure, the iframe loader renders 27 games. Because
   the arcade lives in the iframe (CSS inlined there), the outer page needs no
   stylesheet link. */
const loader = read('tools/onecompiler-loader.js');
if (loader.includes('</script')) throw new Error('literal </script in loader');
const indexHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5">
<meta name="theme-color" content="#6f3fa8">
<title>CUBICLE ARCADE 98</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23ffcb1f'/%3E%3Crect x='4' y='9' width='24' height='15' fill='%231d1722'/%3E%3Ccircle cx='11' cy='16' r='3' fill='%23ffcb1f'/%3E%3Crect x='18' y='13' width='4' height='4' fill='%2300a6b4'/%3E%3Crect x='23' y='17' width='4' height='4' fill='%23ff2d87'/%3E%3C/svg%3E">
</head>
<body>
<noscript><p style="padding:24px;font-family:Verdana,sans-serif">This needs JavaScript. It is all client side.</p></noscript>
<script>
${loader}
</script>
</body>
</html>
`;

const outDir = path.join(ROOT, 'dist/onecompiler');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml);
fs.writeFileSync(path.join(outDir, 'styles.css'), read('css/arcade.css'));
fs.writeFileSync(path.join(outDir, 'script.js'), js);
console.log('dist/onecompiler/index.html   ' + (indexHtml.length / 1024).toFixed(1) + ' KB');
console.log('dist/onecompiler/styles.css   ' + (read('css/arcade.css').length / 1024).toFixed(1) + ' KB');
console.log('dist/onecompiler/script.js    ' + (js.length / 1024).toFixed(1) + ' KB  (' + scripts.length +
  ' modules, ' + (minified ? 'minified' : 'NOT minified') + ')');
if (!minified) {
  console.warn('\n  WARNING: terser not found, script.js is ~' + (js.length / 1024).toFixed(0) +
    ' KB and will be TRUNCATED by size-capped playgrounds (OneCompiler caps at ~256 KB).' +
    '\n  Fix: `npm i terser` then re-run, or `npx terser dist/onecompiler/script.js -c -m -o dist/onecompiler/script.js`.');
}
