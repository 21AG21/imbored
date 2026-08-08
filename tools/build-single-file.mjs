/* Bundle the whole arcade into one portable .html file.
   Usage: node tools/build-single-file.mjs
   Output: dist/cubicle-arcade.html  — email it to yourself, drop it on a USB stick,
   open it from a file:// path. No server, no separate assets. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* take the script order straight from index.html so the two can never drift */
const html = read('index.html');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
if (!scripts.length) throw new Error('no <script src> tags found in index.html');

const guard = (src, file) => {
  if (src.includes('</script')) throw new Error('literal </script in ' + file);
  return src;
};

const parts = [
  '<title>Cubicle Arcade</title>',
  '<style>\n' + read('css/arcade.css') + '\n</style>'
];
for (const s of scripts) parts.push('<script>\n' + guard(read(s), s) + '\n</script>');
parts.push('<script>Arcade.start();</script>');

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = parts.join('\n');
fs.writeFileSync(path.join(ROOT, 'dist/cubicle-arcade.html'), out);
console.log('dist/cubicle-arcade.html  ' + (out.length / 1024).toFixed(1) + ' KB  (' + scripts.length + ' scripts inlined)');
