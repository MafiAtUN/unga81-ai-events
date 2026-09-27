// Extracts Appendix A, B and C of the build brief into src/data, byte for byte.
// Usage: node scripts/extract-data.mjs "path/to/UNGA81 AI site build brief.md"
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const briefPath = process.argv[2] ?? 'UNGA81 AI site build brief.md';
const text = readFileSync(resolve(briefPath), 'utf8');

const targets = [
  ['## Appendix A: events.json', 'events.json'],
  ['## Appendix B: debate.json', 'debate.json'],
  ['## Appendix C: meta.json', 'meta.json'],
];

mkdirSync('src/data', { recursive: true });
for (const [heading, file] of targets) {
  const at = text.indexOf(heading);
  if (at < 0) throw new Error(`Missing heading: ${heading}`);
  const open = text.indexOf('```json\n', at);
  if (open < 0) throw new Error(`Missing json fence after ${heading}`);
  const start = open + '```json\n'.length;
  const end = text.indexOf('\n```', start);
  if (end < 0) throw new Error(`Unclosed fence after ${heading}`);
  const body = text.slice(start, end + 1); // keep the final newline of the block
  JSON.parse(body); // must be valid JSON, never repaired
  writeFileSync(`src/data/${file}`, body);
  console.log(`${file}: ${Buffer.byteLength(body)} bytes`);
}
