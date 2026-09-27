// Fails the build if the data differs from the expected counts in section 9 of the brief.
// When the data is updated, edit the JSON and the expected counts below together.
import { readFileSync } from 'node:fs';

const read = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url), 'utf8'));
const events = read('events.json');
const debate = read('debate.json');
const meta = read('meta.json');

const EXPECTED = {
  items: 133,
  type: { event: 118, launch: 9, official: 6 },
  conv: { un_organs: 9, un_system: 50, member_states: 11, civil_society: 52, business: 10, not_shown: 1 },
  loc: { new_york: 101, virtual: 20, outside_ny: 12 },
  platform: { digital_unga: 72, standalone: 42, digital_cooperation_day: 9, sdg_media_zone: 8, science_summit: 2 },
  byDay: { 8: 2, 9: 1, 10: 1, 11: 1, 14: 1, 15: 1, 16: 3, 17: 2, 18: 4, 19: 1, 20: 9, 21: 24, 22: 20, 23: 20, 24: 23, 25: 16, 28: 3, 29: 1 },
  highLevelWeek: 103,
  peakDay: 21,
  peak: 24,
  statements: 143,
  memberStates: 139,
  memberStatesAi: 91,
  groups: {
    western_european_other: [20, 22],
    eastern_european: [14, 20],
    latin_america_caribbean: [16, 25],
    african: [23, 38],
    asia_pacific: [18, 34],
  },
  ldc: [18, 31],
};

const errors = [];
const eq = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) errors.push(`${label}: expected ${e}, got ${a}`);
};
const tally = (list, key, keys) => {
  const out = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const x of list) out[key(x)] = (out[key(x)] ?? 0) + 1;
  return out;
};
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

// Items
eq('items', events.length, EXPECTED.items);
for (const k of ['type', 'conv', 'loc', 'platform']) {
  const counts = Object.fromEntries(Object.entries(tally(events, (x) => x[k], Object.keys(EXPECTED[k]))).filter(([, v]) => v > 0));
  eq(k, sortKeys(counts), sortKeys(EXPECTED[k]));
}
const dated = events.filter((x) => x.date);
const byDay = tally(dated, (x) => String(Number(x.date.slice(8, 10))), []);
eq('by day', sortKeys(byDay), sortKeys(Object.fromEntries(Object.entries(EXPECTED.byDay).map(([k, v]) => [k, v]))));
const hlw = dated.filter((x) => x.date >= meta.high_level_week.from && x.date <= meta.high_level_week.to).length;
eq('high level week', hlw, EXPECTED.highLevelWeek);
const peakEntry = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
eq('peak day', Number(peakEntry[0]), EXPECTED.peakDay);
eq('peak', peakEntry[1], EXPECTED.peak);

// Allowed values and required fields
const allowed = {
  conv: meta.conveners.map((c) => c.key),
  type: meta.types.map((c) => c.key),
  loc: meta.locations.map((c) => c.key),
  platform: meta.platforms.map((c) => c.key),
  centrality: ['dedicated', 'strand'],
  status: ['held', 'ongoing', 'scheduled', 'undated'],
  confidence: ['official', 'reported', 'mixed'],
};
const themeKeys = meta.themes.map((t) => t.key);
const ids = new Set();
for (const x of events) {
  if (ids.has(x.id)) errors.push(`duplicate id ${x.id}`);
  ids.add(x.id);
  for (const [k, vals] of Object.entries(allowed)) if (!vals.includes(x[k])) errors.push(`${x.id} ${k} not allowed: ${x[k]}`);
  for (const t of x.themes) if (!themeKeys.includes(t)) errors.push(`${x.id} theme not allowed: ${t}`);
  if (x.date !== null && !/^2026-09-\d\d$/.test(x.date)) errors.push(`${x.id} bad date ${x.date}`);
  if (typeof x.pga !== 'boolean') errors.push(`${x.id} pga is not boolean`);
}

// Debate
eq('statements', debate.length, EXPECTED.statements);
const ms = debate.filter((d) => d.member_state);
eq('member states that spoke', ms.length, EXPECTED.memberStates);
eq('member states that mentioned AI', ms.filter((d) => d.raised_ai).length, EXPECTED.memberStatesAi);
for (const [g, pair] of Object.entries(EXPECTED.groups)) {
  const inGroup = ms.filter((d) => d.group === g);
  eq(`group ${g}`, [inGroup.filter((d) => d.raised_ai).length, inGroup.length], pair);
}
const ldc = ms.filter((d) => d.ldc);
eq('LDCs', [ldc.filter((d) => d.raised_ai).length, ldc.length], EXPECTED.ldc);
debate.forEach((d, i) => {
  if (d.order !== i + 1) errors.push(`debate order break at position ${i + 1}`);
  if (!d.raised_ai && d.ai_gist !== null) errors.push(`ai_gist present where raised_ai is false: ${d.country}`);
  if (d.raised_ai && !d.ai_gist) errors.push(`raised_ai without gist: ${d.country}`);
});

// Meta expected block must agree
eq('meta.expected.items', meta.expected.items, EXPECTED.items);
eq('meta.expected.statements', meta.expected.statements, EXPECTED.statements);
eq('meta.expected.member_states_spoke', meta.expected.member_states_spoke, EXPECTED.memberStates);
eq('meta.expected.member_states_mentioned_ai', meta.expected.member_states_mentioned_ai, EXPECTED.memberStatesAi);
eq('meta.expected.high_level_week', meta.expected.high_level_week, EXPECTED.highLevelWeek);
eq('meta.expected.peak', meta.expected.peak, EXPECTED.peak);

// No mention counts anywhere
const forbiddenKey = /mention|(^|_)counts?($|_)|^n_|_n$|tally/i;
const walk = (o, path) => {
  if (Array.isArray(o)) return o.forEach((v, i) => walk(v, `${path}[${i}]`));
  if (o && typeof o === 'object')
    for (const [k, v] of Object.entries(o)) {
      if (forbiddenKey.test(k) && path !== 'meta.expected') errors.push(`forbidden field name ${path}.${k}`);
      walk(v, `${path}.${k}`);
    }
};
walk(events, 'events');
walk(debate, 'debate');
walk(meta, 'meta');

// Every source is a valid https URL
const isHttps = (u) => {
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
};
for (const x of events) if (!isHttps(x.source)) errors.push(`${x.id} source is not a valid https URL: ${x.source}`);
for (const d of debate) {
  if (!isHttps(d.transcript_source)) errors.push(`${d.country} transcript_source is not https`);
  if (d.statement_url !== null && !isHttps(d.statement_url)) errors.push(`${d.country} statement_url is not https`);
}
for (const q of meta.quotes) if (!isHttps(q.source)) errors.push(`quote source is not https: ${q.source}`);

if (errors.length) {
  console.error(`validate: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(
  `validate: ok. ${events.length} items, ${hlw} in high level week, peak ${peakEntry[1]} on ${peakEntry[0]} Sep. ` +
    `${debate.length} statements, ${ms.filter((d) => d.raised_ai).length} of ${ms.length} Member States mentioned AI.`,
);
