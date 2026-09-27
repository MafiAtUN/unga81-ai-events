import type { APIRoute } from 'astro';
import { events, debate, meta, countryPages } from '../../../lib/load';
import { card, clampChars, italic, line, microLine } from '../../../lib/og';
import { miniHemicycle } from '../../../lib/mini';
import { copy } from '../../../lib/copy';
import { longDate } from '../../../lib/data';

export const getStaticPaths = () => countryPages().map((c) => ({ params: { slug: c.slug } }));

export const GET: APIRoute = async ({ params }) => {
  const c = countryPages().find((x) => x.slug === params.slug)!;
  const s = c.statement;
  const lines = [];
  if (s.raised_ai && s.ai_gist) lines.push(italic(clampChars(s.ai_gist, 50)));
  if (c.items.length) {
    lines.push(microLine(copy.countryItems));
    for (const e of c.items.slice(0, 2)) lines.push(line(clampChars(e.title, 52), { fontSize: 18 }));
    if (c.items.length > 2) lines.push(line(`and ${c.items.length - 2} more`, { fontSize: 18, color: '#96A3A5' }));
  }
  lines.push(microLine(copy.kicker(meta).split('  ')[1]));
  const png = await card({
    hemicycle: miniHemicycle(events, debate, meta, { items: c.items.map((e) => e.id), seat: s.member_state && s.raised_ai ? s.order : null }),
    kicker: `General Debate  ${longDate(s.date)}`,
    title: s.country,
    titleSize: s.country.length > 28 ? 52 : 72,
    lines,
  });
  return new Response(png, { headers: { 'content-type': 'image/png' } });
};
