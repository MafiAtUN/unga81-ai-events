// Build time data access (Astro pages and endpoints).
import eventsJson from '../data/events.json';
import debateJson from '../data/debate.json';
import metaJson from '../data/meta.json';
import type { Item, Meta, Statement } from './types';
import { countryItems, isCountry, slugify, stats } from './data';

export const events = eventsJson as unknown as Item[];
export const debate = debateJson as unknown as Statement[];
export const meta = metaJson as unknown as Meta;
export const S = stats(events, debate, meta);

export const countryNames = debate.filter(isCountry).map((s) => s.country);

/** Countries that get their own page: mentioned AI in the General Debate, or convened an item. */
export function countryPages() {
  return debate
    .filter(isCountry)
    .map((s) => ({ statement: s, slug: slugify(s.country), items: countryItems(s.country, countryNames, events) }))
    .filter((c) => c.statement.raised_ai || c.items.length > 0);
}

export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const abs = (path: string) => `${meta.site.replace(/\/$/, '')}${path}`;
