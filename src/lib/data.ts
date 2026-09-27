// Derived figures. Every number shown anywhere on the site comes from here.
import type { Item, Meta, Statement } from './types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const day = (iso: string) => Number(iso.slice(8, 10));
export const monthName = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1];
/** "21 SEP" */
export const microDate = (iso: string) => `${day(iso)} ${monthName(iso).slice(0, 3).toUpperCase()}`;
/** "21 September 2026" */
export const longDate = (iso: string) => `${day(iso)} ${monthName(iso)} ${iso.slice(0, 4)}`;
/** "21 September" */
export const shortDate = (iso: string) => `${day(iso)} ${monthName(iso)}`;

export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Every day of the window, as ISO strings. */
export function windowDays(meta: Meta): string[] {
  const out: string[] = [];
  for (let d = meta.window.from; d <= meta.window.to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Remove diacritics and lower case, for search. */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

export const slugify = (s: string) =>
  fold(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Lower case the first letter unless the label starts with an acronym. */
export const lcFirst = (s: string) => (/^[A-Z][A-Z@]/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

export function stats(events: Item[], debate: Statement[], meta: Meta) {
  const days = windowDays(meta);
  const byDay = new Map<string, number>(days.map((d) => [d, 0]));
  for (const e of events) if (e.date) byDay.set(e.date, (byDay.get(e.date) ?? 0) + 1);
  let peakDay = days[0];
  for (const d of days) if ((byDay.get(d) ?? 0) > (byDay.get(peakDay) ?? 0)) peakDay = d;
  const hlw = events.filter((e) => e.date && e.date >= meta.high_level_week.from && e.date <= meta.high_level_week.to).length;
  const members = debate.filter((s) => s.member_state);
  const membersAi = members.filter((s) => s.raised_ai);
  const debateDays = [...new Set(members.map((s) => s.date))].sort();
  const groups = meta.debate_groups.map((g) => {
    const inGroup = members.filter((s) => s.group === g.key);
    return { ...g, lit: inGroup.filter((s) => s.raised_ai).length, total: inGroup.length };
  });
  const count = (key: keyof Item, value: string) => events.filter((e) => e[key] === value).length;
  return {
    items: events.length,
    hlw,
    byDay,
    peakDay,
    peak: byDay.get(peakDay) ?? 0,
    statements: debate.length,
    members: members.length,
    membersAi: membersAi.length,
    debateDays,
    debateFrom: debateDays[0],
    debateTo: debateDays[debateDays.length - 1],
    groups,
    conv: Object.fromEntries(meta.conveners.map((c) => [c.key, count('conv', c.key)])),
    unverified: debate.filter((s) => !s.verified).length,
  };
}
export type Stats = ReturnType<typeof stats>;

/** Order used to stack marks: convener, then type, then title. */
export function stackSort(meta: Meta) {
  const convOrder = new Map(meta.conveners.map((c, i) => [c.key, i]));
  const typeOrder = new Map(['official', 'launch', 'event'].map((t, i) => [t, i]));
  return (a: Item, b: Item) =>
    (convOrder.get(a.conv)! - convOrder.get(b.conv)!) ||
    (typeOrder.get(a.type)! - typeOrder.get(b.type)!) ||
    a.title.localeCompare(b.title);
}

/** Items in date order, then stack order. Used for keyboard order and prev and next. */
export function dateOrder(events: Item[], meta: Meta): Item[] {
  const s = stackSort(meta);
  return [...events].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || s(a, b));
}

/**
 * Items a country convened or co hosted: the country name appears in `organisers`
 * as a whole phrase, and is not only part of a longer country name that also matches.
 */
export function countryItems(country: string, allCountries: string[], events: Item[]): Item[] {
  const re = (name: string) => new RegExp(`(^|[^\\p{L}])${fold(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'u');
  const longer = allCountries.filter((c) => c !== country && fold(c).includes(fold(country)));
  const own = re(country);
  return events.filter((e) => {
    const text = fold(e.organisers);
    if (!own.test(text)) return false;
    let stripped = text;
    for (const l of longer) stripped = stripped.replace(new RegExp(re(l).source, 'gu'), ' ');
    return own.test(stripped);
  });
}

/** Countries shown in the country search and pages: Member States and observers, never UN officials. */
export const isCountry = (s: Statement) => s.group !== 'un_official';
