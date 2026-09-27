// Size budgets from section 8 (gzip): JavaScript 85 KB, data 45 KB, CSS 12 KB, fonts 90 KB.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const html = readFileSync('dist/index.html', 'utf8');
const assets = readdirSync('dist/_assets');

const js = assets.filter((f) => f.endsWith('.js')).reduce((n, f) => n + gz(readFileSync(`dist/_assets/${f}`)), 0) +
  [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].reduce((n, m) => n + gz(Buffer.from(m[1])), 0);
const css = assets.filter((f) => f.endsWith('.css')).reduce((n, f) => n + gz(readFileSync(`dist/_assets/${f}`)), 0) +
  [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].reduce((n, m) => n + gz(Buffer.from(m[1])), 0);
const data = gz(readFileSync('dist/data/stage.json'));
// Fonts the home page always loads (the tiny extension files load only for a few names).
const fonts = assets.filter((f) => f.endsWith('.woff2') && !f.includes('-ext')).reduce((n, f) => n + readFileSync(`dist/_assets/${f}`).length, 0);

const rows = [
  ['JavaScript', js, 85],
  ['Data', data, 45],
  ['CSS', css, 12],
  ['Fonts', fonts, 90],
];
let fail = false;
for (const [name, bytes, budget] of rows) {
  const ok = bytes <= budget * KB;
  if (!ok) fail = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(10)} ${(bytes / KB).toFixed(1).padStart(6)} KB of ${budget} KB`);
}
if (fail) process.exit(1);
