import type { APIRoute } from 'astro';
import { events, debate, meta, S } from '../../../lib/load';
import { card, italic, line, microLine, titleSize } from '../../../lib/og';
import { miniHemicycle } from '../../../lib/mini';
import { copy } from '../../../lib/copy';
import { microDate } from '../../../lib/data';

export const getStaticPaths = () => events.map((e) => ({ params: { id: e.id } }));

export const GET: APIRoute = async ({ params }) => {
  const e = events.find((x) => x.id === params.id)!;
  const conv = meta.conveners.find((c) => c.key === e.conv)!;
  const png = await card({
    hemicycle: miniHemicycle(events, debate, meta, { items: [e.id] }),
    kicker: `${e.date ? microDate(e.date) : ''}  ${conv.label}`,
    title: e.title,
    titleSize: titleSize(e.title),
    lines: [italic(copy.itemLine(S.items)), microLine(copy.kicker(meta).split('  ')[1])],
  });
  return new Response(png, { headers: { 'content-type': 'image/png' } });
};
