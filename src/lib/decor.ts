// Non interactive parts of each chart, as SVG strings. Shared by the stage, SAVE IMAGE and the share cards.
import type { Meta } from './types';
import type { Stats } from './data';
import { day, microDate } from './data';
import type { Cluster, FloorLayout, PulseLayout } from './layout';
import { FLOOR, polar } from './layout';
import { colorOf, markSvg, shapeOf } from './marks';
import { copy } from './copy';

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f = (n: number) => n.toFixed(1);

/** Floor decorations in frame units. `withCaption` adds the seat caption under the baseline. */
export function floorDecor(fl: FloorLayout, st: Stats, meta: Meta, withCaption = true): string {
  const d = fl.decor;
  const out: string[] = [];
  out.push(`<line class="l-hair" x1="${d.baseline.x1}" y1="${d.baseline.y}" x2="${d.baseline.x2}" y2="${d.baseline.y}"/>`);
  out.push(`<path class="l-tick" d="${d.ringSolid}"/>`);
  out.push(`<path class="l-tick" d="${d.ringDashed}" stroke-dasharray="2 5"/>`);
  for (const t of d.ticks) out.push(`<line class="l-tick" x1="${f(t.x1)}" y1="${f(t.y1)}" x2="${f(t.x2)}" y2="${f(t.y2)}"/>`);
  out.push(`<path class="l-gold" stroke-width="4" d="${d.hlw}"/>`);
  out.push(
    `<text class="t-micro t-gold" font-size="12.5" x="${f(d.hlwLabel.x)}" y="${f(d.hlwLabel.y)}">HIGH LEVEL WEEK</text>` +
      `<text class="t-micro t-gold" font-size="12.5" x="${f(d.hlwLabel.x)}" y="${f(d.hlwLabel.y + 18)}">${esc(`${day(meta.high_level_week.from)} TO ${microDate(meta.high_level_week.to)}`)}</text>`,
  );
  out.push(`<text class="t-micro" font-size="11.5" x="${f(d.scheduled.x)}" y="${f(d.scheduled.y)}">SCHEDULED</text>`);
  for (const l of d.dayLabels) out.push(`<text class="t-micro" font-size="11.5" text-anchor="${l.anchor}" x="${f(l.x)}" y="${f(l.y)}">${esc(l.text)}</text>`);
  for (const t of d.tips) out.push(`<text class="t-count" font-size="13" text-anchor="middle" x="${f(t.x)}" y="${f(t.y + 4)}">${t.n}</text>`);
  const lineY = (c: (typeof d.callouts)[number]) => c.y + 26 + (c.lines.length - 1) * 24 + 16;
  const left = d.callouts.filter((c) => c.side === 'left');
  const leftRule = Math.max(...left.map(lineY));
  if (left.length) {
    const reach = Math.max(...left.map((c) => c.target.x), left[0].x + 200);
    out.push(`<path class="l-lead" d="M${left[0].x},${f(leftRule)}H${f(reach)}"/>`);
  }
  for (const c of d.callouts) {
    const right = c.side !== 'left';
    const anchor = right ? 'end' : 'start';
    const icon = markSvg(shapeOf({ type: c.type, conv: c.conv }), colorOf(meta, c.conv), right ? c.x - measureMono(c.head) - 12 : c.x + 5, c.y - 4.5, 0.62);
    const hx = right ? c.x : c.x + 18;
    out.push(icon);
    out.push(`<text class="t-micro" font-size="12.5" text-anchor="${anchor}" x="${hx}" y="${c.y}">${esc(c.head)}</text>`);
    c.lines.forEach((line, i) => out.push(`<text class="t-callout" font-size="18" text-anchor="${anchor}" x="${c.x}" y="${c.y + 26 + i * 24}">${esc(line)}</text>`));
    const ruleY = lineY(c);
    const tx = c.target.x;
    const ty = c.target.y - 13;
    if (c.side === 'left') {
      out.push(`<path class="l-lead" d="M${f(tx)},${f(leftRule)}V${f(ty)}"/>`);
    } else if (c.side === 'top') {
      out.push(`<path class="l-lead" d="M${c.x - 344},${f(ruleY)}H${f(tx)}V${f(ty)}"/>`);
    } else {
      out.push(`<path class="l-lead" d="M${c.x},${f(ruleY)}H${f(tx)}V${f(ty)}"/>`);
    }
  }
  if (withCaption) {
    out.push(`<text class="t-ui" font-size="20" text-anchor="middle" x="${FLOOR.cx}" y="${FLOOR.cy + 34}">${esc(copy.seatCaption1(st))}</text>`);
    out.push(`<text class="t-ui t-mute" font-size="20" text-anchor="middle" x="${FLOOR.cx}" y="${FLOOR.cy + 60}">${esc(copy.seatCaption2)}</text>`);
  }
  return out.join('');
}

/** Martian Mono is monospaced: advance 0.65 em at this width, plus 0.04 em letter spacing. */
const measureMono = (s: string, size = 12.5) => s.length * size * 0.69;

export function bigNumber(n: number | string, size = 190): string {
  return `<text class="t-big" font-size="${size}" text-anchor="middle" x="${FLOOR.cx}" y="${FLOOR.cy - 14}">${n}</text>`;
}

export function pulseDecor(pl: PulseLayout): string {
  const out: string[] = [];
  for (const l of pl.lines) {
    const cls = l.cls.includes('gold') ? 'l-gold' : l.cls === 'spine' ? 'l-tick' : 'l-hair';
    const w = l.cls.includes('gold') ? (l.cls.includes('thin') ? 1.5 : 3) : 1;
    out.push(`<line class="${cls}" stroke-width="${w}" x1="${f(l.x1)}" y1="${f(l.y1)}" x2="${f(l.x2)}" y2="${f(l.y2)}"/>`);
  }
  for (const l of pl.labels) {
    const cls = l.cls.includes('gold') ? 't-micro t-gold' : l.cls === 'count' ? 't-count' : 't-micro';
    out.push(`<text class="${cls}" font-size="${l.cls === 'count' ? 11.5 : 11}" text-anchor="${l.anchor ?? 'start'}" x="${f(l.x)}" y="${f(l.y)}">${esc(l.text)}</text>`);
  }
  for (const m of pl.milestones) {
    m.lines.forEach((line, i) =>
      out.push(`<text class="t-callout" font-size="14" text-anchor="${m.anchor}" x="${f(m.x)}" y="${f(m.y + i * 17)}">${esc(line)}</text>`),
    );
    if (pl.mode === 'cols') {
      const y0 = m.y + (m.lines.length - 1) * 17 + 7;
      out.push(`<line class="l-lead" x1="${f(m.tx)}" y1="${f(y0)}" x2="${f(m.tx)}" y2="${f(m.ty)}"/>`);
      out.push(`<circle cx="${f(m.tx)}" cy="${f(m.ty)}" r="2.5" fill="#EFEBE1"/>`);
    } else {
      out.push(`<path class="l-lead" d="M${f(m.x - 10)},${f(m.y - 5)}h6"/>`);
    }
  }
  return out.join('');
}

export function constellationDecor(clusters: Cluster[], counts: Map<string, number>, filtered: boolean): string {
  const out: string[] = [];
  for (const c of clusters) {
    c.label.forEach((line, i) => out.push(`<text class="t-ui" font-size="14" x="${f(c.x)}" y="${f(c.y + 12 + i * 17)}">${esc(line)}</text>`));
    const n = counts.get(c.key) ?? 0;
    const text = filtered ? `${n} OF ${c.ids.length}` : String(c.ids.length);
    out.push(`<text class="t-count" font-size="11.5" text-anchor="end" x="${f(c.x + c.w)}" y="${f(c.y + 12)}">${text}</text>`);
  }
  return out.join('');
}

/** The seat ring label in regional group mode, placed at the left end of each row. */
export function groupRowNumbers(fl: FloorLayout): string {
  return fl.rows
    .map((r, i) => {
      const p = polar(r.radius, 180);
      return `<text class="t-micro" font-size="11" text-anchor="middle" x="${f(p.x)}" y="${f(p.y + 16)}">${i + 1}</text>`;
    })
    .join('');
}
