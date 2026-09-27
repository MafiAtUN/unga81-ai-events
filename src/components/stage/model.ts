// Everything the island needs, built once from stage.json.
import type { Item, Meta, Statement } from '../../lib/types';
import type { ConstellationLayout } from '../../lib/layout';
import { nodeKeys } from '../../lib/layout';
import { countryItems, dateOrder, fold, isCountry, slugify, stats } from '../../lib/data';

export interface StageData {
  events: Item[];
  debate: Statement[];
  meta: Meta;
  constellation: Record<string, Record<string, ConstellationLayout>>;
}

export function buildModel(d: StageData) {
  const { events, debate, meta } = d;
  const byId = new Map(events.map((e) => [e.id, e]));
  const nodes = nodeKeys(events).map((n) => ({ ...n, item: byId.get(n.id)! }));
  const order = dateOrder(events, meta);
  const orderIndex = new Map(order.map((e, i) => [e.id, i]));
  const members = debate.filter((s) => s.member_state);
  const countryNames = debate.filter(isCountry).map((s) => s.country);
  const countries = debate.filter(isCountry).map((s) => {
    const items = countryItems(s.country, countryNames, events);
    return { statement: s, items, slug: slugify(s.country), hasPage: s.raised_ai || items.length > 0, folded: fold(s.country) };
  });
  // Organisation names for search: split the organisers field into its named parts.
  const orgCount = new Map<string, number>();
  for (const e of events) {
    const parts = e.organisers
      .replace(/\([^)]*\)/g, ' ')
      .split(/,|;| and | with | \/ |\bco-?hosted by\b|\bhosted by\b/i)
      .map((p) => p.trim().replace(/^(the|with|by)\s+/i, ''))
      .filter((p) => p.length > 2);
    for (const p of new Set(parts)) orgCount.set(p, (orgCount.get(p) ?? 0) + 1);
  }
  const orgs = [...orgCount.entries()].map(([name]) => ({
    name,
    folded: fold(name),
    n: events.filter((e) => fold(e.organisers).includes(fold(name))).length,
  }));
  return {
    ...d,
    st: stats(events, debate, meta),
    byId,
    nodes,
    order,
    orderIndex,
    members,
    countries,
    orgs,
    label: (list: 'conveners' | 'types' | 'locations' | 'platforms' | 'themes', key: string) => meta[list].find((o) => o.key === key)?.label ?? key,
  };
}
export type Model = ReturnType<typeof buildModel>;
