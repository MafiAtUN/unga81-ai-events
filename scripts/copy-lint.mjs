// Copy lint over the built site: every HTML page (visible text, alt, aria and meta text),
// the stage data and the interface copy. Fails on the author's style and diplomatic rules.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const RULES = [
  ['semicolon', /;/],
  ['dash used as punctuation', /\s[-–—]\s|[–—]|--/],
  ['emoji', /\p{Extended_Pictographic}/u],
  ['hashtag', /(^|\s)#(?![0-9A-Fa-f]{6}\b)[\p{L}\d_]/u],
  ['exclamation mark', /!/],
  ['banned word', /\b(did not|didn't|failed|silent|absent|Advisory Group)\b/i],
];

// Style rule for interface copy only (section 2). Organiser event titles are quoted as published.
export const CONTRACTION = ['contraction', /\b\w+(n't|'re|'ve|'ll|'m)\b|\b(it|that|there|what|let|here|he|she)'s\b/i];

export function lintText(text, where, interfaceCopy = false) {
  const out = [];
  for (const [name, re] of interfaceCopy ? [...RULES, CONTRACTION] : RULES) {
    const m = text.match(re);
    if (m) out.push(`${where}: ${name}: "${text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')}"`);
  }
  return out;
}

const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

export function htmlText(html) {
  const attrs = [...html.matchAll(/\s(?:alt|aria-label|title|placeholder|content)="([^"]*)"/g)]
    .map((m) => m[1])
    .filter((v) => !/^(width=|https?:|#|\d|text\/|utf-8|dark|summary_large_image|website)/i.test(v));
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<!doctype[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '\n');
  return decode([body, ...attrs].join('\n'));
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = [];
  const files = walk('dist');
  let pages = 0;
  for (const f of files.filter((f) => f.endsWith('.html'))) {
    pages++;
    for (const line of htmlText(readFileSync(f, 'utf8')).split('\n')) if (line.trim()) problems.push(...lintText(line, f));
  }
  const stage = JSON.parse(readFileSync('dist/data/stage.json', 'utf8'));
  const strings = [];
  const collect = (o) => (typeof o === 'string' ? strings.push(o) : o && typeof o === 'object' && Object.values(o).forEach(collect));
  collect({ events: stage.events, debate: stage.debate, meta: stage.meta });
  for (const s of strings) if (!/^https?:/.test(s)) problems.push(...lintText(s, 'stage.json'));
  // Interface strings in source: every quoted or template literal in the copy file.
  const src = readFileSync('src/lib/copy.ts', 'utf8');
  for (const m of src.matchAll(/'([^'\n]*)'|`([^`]*)`/g)) {
    const s = (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, 'X');
    problems.push(...lintText(s, 'copy.ts', true));
  }
  const unique = [...new Set(problems)];
  if (unique.length) {
    console.error(`copy lint: ${unique.length} problem(s)`);
    for (const p of unique.slice(0, 60)) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`copy lint: ok. ${pages} pages, ${strings.length} data strings, interface copy clean.`);
}
