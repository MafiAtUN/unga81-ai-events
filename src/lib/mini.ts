// A mini hemicycle for share pages and Open Graph cards: every item and seat in place,
// with the chosen items enlarged and ringed.
import type { Item, Meta, Statement } from './types';
import { floorLayout, FLOOR, arcPath } from './layout';
import { colorOf, markSvg, seatSvg, shapeOf } from './marks';

export function miniHemicycle(events: Item[], debate: Statement[], meta: Meta, opts: { items?: string[]; seat?: number | null } = {}): string {
  const fl = floorLayout(events, debate, meta, 'day');
  const hi = new Set(opts.items ?? []);
  const any = hi.size > 0 || opts.seat != null;
  const out: string[] = [];
  const vb = { x: 150, y: 560, w: 780, h: 560 };
  out.push(`<path d="${arcPath(FLOOR.ring, 180, 0)}" fill="none" stroke="#55625F" stroke-width="1.5"/>`);
  out.push(`<line x1="150" x2="930" y1="${FLOOR.cy}" y2="${FLOOR.cy}" stroke="#34464A" stroke-width="1.5"/>`);
  out.push(`<path d="${fl.decor.hlw}" fill="none" stroke="#F8C534" stroke-width="4"/>`);
  debate
    .filter((s) => s.member_state)
    .forEach((s) => {
      const p = fl.seats.get(s.order)!;
      const fill = s.raised_ai ? '#EFEBE1' : '#34464A';
      out.push(seatSvg(p.x, p.y, p.rot, fill, 1, any && opts.seat !== s.order ? ' opacity="0.55"' : ''));
    });
  for (const e of events) {
    const p = fl.items.get(e.id);
    if (!p || hi.has(e.id)) continue;
    out.push(markSvg(shapeOf(e), colorOf(meta, e.conv), p.x, p.y, 1, any ? ' opacity="0.45"' : ''));
  }
  for (const e of events) {
    const p = fl.items.get(e.id);
    if (!p || !hi.has(e.id)) continue;
    out.push(markSvg(shapeOf(e), colorOf(meta, e.conv), p.x, p.y, 1.9));
    out.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="20" fill="none" stroke="#EFEBE1" stroke-width="2.5"/>`);
  }
  if (opts.seat != null) {
    const p = fl.seats.get(opts.seat);
    if (p) out.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="16" fill="none" stroke="#F8C534" stroke-width="3"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="${vb.w}" height="${vb.h}">${out.join('')}</svg>`;
}
