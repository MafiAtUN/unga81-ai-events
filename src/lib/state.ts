// Filter state, matching, the plain words selection sentence and the URL codec.
import type { Item, Meta, Statement } from './types';
import type { Facet, SeatMode } from './layout';
import { FACETS } from './layout';
import { fold, lcFirst, shortDate, day } from './data';
import { ENTITY_KEYS, entityByKey } from './entities';

export const VIEWS = ['floor', 'pulse', 'constellation', 'index'] as const;
export type View = (typeof VIEWS)[number];

export interface State {
  v: View | null;
  conv: string[];
  theme: string[];
  platform: string[];
  type: string[];
  loc: string[];
  org: string[];
  d: [string, string] | null;
  pga: boolean;
  q: string;
  sel: string | null;
  facet: Facet;
  seat: SeatMode;
}

export const emptyState = (): State => ({
  v: null,
  conv: [],
  theme: [],
  platform: [],
  type: [],
  loc: [],
  org: [],
  d: null,
  pga: false,
  q: '',
  sel: null,
  facet: 'convener',
  seat: 'day',
});

export type FacetKey = 'conv' | 'theme' | 'platform' | 'type' | 'loc' | 'org' | 'd' | 'pga' | 'q';

export function matches(e: Item, s: State, except?: FacetKey): boolean {
  if (except !== 'conv' && s.conv.length && !s.conv.includes(e.conv)) return false;
  if (except !== 'theme' && s.theme.length && !e.themes.some((t) => s.theme.includes(t))) return false;
  if (except !== 'platform' && s.platform.length && !s.platform.includes(e.platform)) return false;
  if (except !== 'type' && s.type.length && !s.type.includes(e.type)) return false;
  if (except !== 'loc' && s.loc.length && !s.loc.includes(e.loc)) return false;
  if (except !== 'org' && s.org.length && !s.org.some((k) => entityByKey.get(k)?.test(e))) return false;
  if (except !== 'd' && s.d && (!e.date || e.date < s.d[0] || e.date > s.d[1])) return false;
  if (except !== 'pga' && s.pga && !e.pga) return false;
  if (except !== 'q' && s.q && !fold(`${e.title} ${e.organisers} ${e.detail}`).includes(fold(s.q))) return false;
  return true;
}

/** Seats respond only to the date range and the country search. */
export function seatMatches(st: Statement, s: State): boolean {
  if (s.d && (st.date < s.d[0] || st.date > s.d[1])) return false;
  if (s.q && !fold(st.country).includes(fold(s.q))) return false;
  return true;
}

export const isFiltered = (s: State) =>
  !!(s.conv.length || s.theme.length || s.platform.length || s.type.length || s.loc.length || s.org.length || s.d || s.pga || s.q);

const joinOr = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);

/** "Showing 33 of 133 items: education and children, in New York." */
export function sentence(events: Item[], meta: Meta, s: State): string {
  const n = events.filter((e) => matches(e, s)).length;
  if (n === 0) return 'No items match these filters. Clear one to see more.';
  const lab = (list: { key: string; label: string }[], keys: string[]) => list.filter((o) => keys.includes(o.key)).map((o) => o.label);
  const parts: string[] = [];
  if (s.theme.length) parts.push(joinOr(lab(meta.themes, s.theme).map(lcFirst)));
  if (s.conv.length) parts.push(`convened by ${joinOr(lab(meta.conveners, s.conv).map(lcFirst))}`);
  if (s.type.length) parts.push(joinOr(lab(meta.types, s.type).map(lcFirst)));
  if (s.platform.length) parts.push(`on ${joinOr(lab(meta.platforms, s.platform))}`);
  if (s.loc.length)
    parts.push(
      joinOr(
        s.loc.map((k) => {
          const l = meta.locations.find((o) => o.key === k)!.label;
          return k === 'new_york' ? `in ${l}` : lcFirst(l);
        }),
      ),
    );
  if (s.org.length) parts.push(`naming ${joinOr(s.org.map((k) => entityByKey.get(k)!.label))} among the organisers`);
  if (s.d) parts.push(s.d[0] === s.d[1] ? `on ${shortDate(s.d[0])}` : `from ${day(s.d[0])} to ${shortDate(s.d[1])}`);
  if (s.pga) parts.push('with the President of the General Assembly taking part');
  if (s.q) parts.push(`matching “${s.q}”`);
  return `Showing ${n} of ${events.length} items${parts.length ? `: ${parts.join(', ')}` : ''}.`;
}

// ---------------------------------------------------------------------------
// URL codec. Keys: v c t p y w o d pga sel q f s

const LIST_KEYS: [keyof State, string][] = [
  ['conv', 'c'],
  ['theme', 't'],
  ['platform', 'p'],
  ['type', 'y'],
  ['loc', 'w'],
  ['org', 'o'],
];

function allowed(meta: Meta): Record<string, string[]> {
  return {
    conv: meta.conveners.map((o) => o.key),
    theme: meta.themes.map((o) => o.key),
    platform: meta.platforms.map((o) => o.key),
    type: meta.types.map((o) => o.key),
    loc: meta.locations.map((o) => o.key),
    org: ENTITY_KEYS,
  };
}

/** Put list values in the canonical meta order, without duplicates or unknown values. */
export function canonical(s: State, meta: Meta): State {
  const a = allowed(meta);
  const out = { ...s };
  for (const [k] of LIST_KEYS) out[k] = a[k].filter((v) => (s[k] as string[]).includes(v)) as never;
  return out;
}

export function toQuery(s: State, meta: Meta): string {
  const c = canonical(s, meta);
  const p = new URLSearchParams();
  if (c.v) p.set('v', c.v);
  for (const [k, short] of LIST_KEYS) if ((c[k] as string[]).length) p.set(short, (c[k] as string[]).join('.'));
  if (c.d) p.set('d', `${c.d[0].slice(5).replace('-', '')}-${c.d[1].slice(5).replace('-', '')}`);
  if (c.pga) p.set('pga', '1');
  if (c.facet !== 'convener') p.set('f', c.facet);
  if (c.seat !== 'day') p.set('s', c.seat);
  if (c.sel) p.set('sel', c.sel);
  if (c.q) p.set('q', c.q);
  const str = p.toString().replace(/%2C/g, ',');
  return str ? `?${str}` : '';
}

export function fromQuery(search: string, meta: Meta, ids: Set<string>): State {
  const p = new URLSearchParams(search);
  const s = emptyState();
  const v = p.get('v');
  if (v && (VIEWS as readonly string[]).includes(v)) s.v = v as View;
  const a = allowed(meta);
  for (const [k, short] of LIST_KEYS) {
    const raw = p.get(short);
    if (raw) (s[k] as string[]) = a[k].filter((x) => raw.split('.').includes(x));
  }
  const d = p.get('d');
  const year = meta.window.from.slice(0, 4);
  if (d && /^\d{4}-\d{4}$/.test(d)) {
    const iso = (m: string) => `${year}-${m.slice(0, 2)}-${m.slice(2)}`;
    let from = iso(d.slice(0, 4));
    let to = iso(d.slice(5));
    if (from > to) [from, to] = [to, from];
    if (from < meta.window.from) from = meta.window.from;
    if (to > meta.window.to) to = meta.window.to;
    if (from <= to && !(from === meta.window.from && to === meta.window.to)) s.d = [from, to];
  }
  s.pga = p.get('pga') === '1';
  const f = p.get('f');
  if (f && (FACETS as readonly string[]).includes(f)) s.facet = f as Facet;
  if (p.get('s') === 'group') s.seat = 'group';
  const sel = p.get('sel');
  if (sel && ids.has(sel)) s.sel = sel;
  s.q = (p.get('q') ?? '').slice(0, 80);
  return s;
}
