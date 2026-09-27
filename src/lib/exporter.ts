// SAVE IMAGE: the current view as a 1080 x 1350 or 1200 x 627 PNG, with headline, legend,
// as at date, method line, byline and site address, drawn in the site fonts.
import archivoUrl from '../fonts/archivo.woff2?url';
import serifUrl from '../fonts/serif.woff2?url';
import serifItalicUrl from '../fonts/serif-italic.woff2?url';
import monoUrl from '../fonts/mono.woff2?url';
import type { Model } from '../components/stage/model';
import type { State, View } from './state';
import { matches, seatMatches, isFiltered, sentence } from './state';
import { floorLayout, FLOOR, wrap, twoLines } from './layout';
import { floorDecor, bigNumber, groupRowNumbers, esc } from './decor';
import { colorOf, markSvg, seatSvg, shapeOf } from './marks';
import { SVG_CSS } from './svgcss';
import { copy } from './copy';

interface Opts {
  M: Model;
  view: View;
  S: State;
  W: number;
  H: number;
  svg: SVGSVGElement | null;
  size: 'portrait' | 'landscape';
  coarse: boolean;
}

const b64 = async (url: string) => {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
};

async function fontCss() {
  const [a, s, si, m] = await Promise.all([archivoUrl, serifUrl, serifItalicUrl, monoUrl].map(b64));
  return (
    `@font-face{font-family:'Archivo';font-weight:600 800;font-stretch:62% 87%;src:url(data:font/woff2;base64,${a}) format('woff2')}` +
    `@font-face{font-family:'Source Serif';font-weight:400;src:url(data:font/woff2;base64,${s}) format('woff2')}` +
    `@font-face{font-family:'Source Serif';font-style:italic;font-weight:450;src:url(data:font/woff2;base64,${si}) format('woff2')}` +
    `@font-face{font-family:'Martian Mono';font-weight:500;src:url(data:font/woff2;base64,${m}) format('woff2')}`
  );
}

/** The Floor in frame units, exactly as on the infographic. */
function floorChart(M: Model, S: State): string {
  const fl = floorLayout(M.events, M.debate, M.meta, S.seat);
  const parts: string[] = [floorDecor(fl, M.st, M.meta), S.seat === 'group' ? groupRowNumbers(fl) : '', bigNumber(M.st.membersAi)];
  M.members.forEach((m) => {
    const p = fl.seats.get(m.order)!;
    const on = seatMatches(m, S);
    const extra = `${on ? '' : ' opacity="0.12"'}${m.verified ? '' : ' stroke="#7E8B8E" stroke-width="0.8" stroke-dasharray="1.2 1.8"'}`;
    parts.push(seatSvg(p.x, p.y, p.rot, m.raised_ai ? '#EFEBE1' : '#34464A', 1, extra));
  });
  for (const e of M.events) {
    const p = fl.items.get(e.id);
    if (!p) continue;
    const on = matches(e, S);
    parts.push(`<g${on ? '' : ' opacity="0.12"'}>${markSvg(shapeOf(e), colorOf(M.meta, e.conv), p.x, p.y)}${
      e.milestone ? `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="10" fill="none" stroke="#EFEBE1" stroke-width="1"/>` : ''
    }</g>`);
  }
  return parts.join('');
}

/** The live chart for Pulse and Constellation, cloned from the stage. */
function liveChart(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('.rings, style').forEach((n) => n.remove());
  return clone.innerHTML;
}

function legend(M: Model, x: number, y: number, colW: number, rowH: number, cols: number, size: number): string {
  return M.meta.conveners
    .map((c, i) => {
      const cx = x + (i % cols) * colW;
      const cy = y + Math.floor(i / cols) * rowH;
      const shape = c.mark === 'hollow' ? 'ring' : 'circle';
      return `${markSvg(shape, c.color ?? '#7E8B8E', cx + 7, cy - size * 0.33, size / 17)}<text class="t-ui" font-size="${size}" x="${cx + 22}" y="${cy}">${esc(c.label)} <tspan class="t-mute">${M.st.conv[c.key]}</tspan></text>`;
    })
    .join('');
}

function typeKey(M: Model, x: number, y: number, size: number, gap: number): string {
  const shapes: Record<string, 'circle' | 'diamond' | 'square'> = { event: 'circle', launch: 'diamond', official: 'square' };
  let cx = x;
  return M.meta.types
    .map((t) => {
      const label = t.label.toUpperCase();
      const s = `${markSvg(shapes[t.key], '#96A3A5', cx + 5, y - size * 0.36, size / 16)}<text class="t-micro" font-size="${size}" x="${cx + 14}" y="${y}">${esc(label)}</text>`;
      cx += 14 + label.length * size * 0.69 + gap;
      return s;
    })
    .join('');
}

export function buildSvg(o: Opts, fonts: string): { svg: string; w: number; h: number } {
  const { M, view, S } = o;
  const portrait = o.size === 'portrait';
  const w = portrait ? 1080 : 1200;
  const h = portrait ? 1350 : 627;
  const floor = view === 'floor';
  const chart = floor ? floorChart(M, S) : o.svg ? liveChart(o.svg) : '';
  const vb = floor ? `${FLOOR.crop.x} ${FLOOR.crop.y} ${FLOOR.crop.w} ${FLOOR.crop.h}` : `0 0 ${o.W} ${o.H}`;
  const note = isFiltered(S) ? sentence(M.events, M.meta, S) : '';
  const kicker = copy.kicker(M.meta).replace(/  /g, '\u00a0\u00a0');
  const [h1, h2] = twoLines(M.meta.headline);
  const author = M.meta.author;
  const site = M.meta.site.replace(/^https:\/\//, '').replace(/\/$/, '');
  const out: string[] = [];
  out.push(`<rect width="${w}" height="${h}" fill="#0B1719"/>`);

  if (portrait) {
    out.push(`<rect x="64" y="40" width="372" height="46" fill="#F8C534"/>`);
    out.push(`<text class="t-display" font-size="30" x="78" y="74" style="fill:#0B1719">${esc(copy.tag)}</text>`);
    out.push(`<text class="t-micro" font-size="15" x="462" y="70" style="fill:#96A3A5">${esc(kicker)}</text>`);
    out.push(`<text class="t-display" font-size="162" x="58" y="232">${esc(h1)}</text>`);
    out.push(`<text class="t-display" font-size="162" x="58" y="370">${esc(h2 ?? '')}</text>`);
    out.push(`<text class="t-deck" font-size="36" x="64" y="446">${esc(copy.deck1(M.st))}</text>`);
    out.push(`<text class="t-deck t-mute" font-size="36" x="64" y="492">${esc(copy.deck2(M.st))}</text>`);
    if (note) wrap(note, 90).slice(0, 2).forEach((l, i) => out.push(`<text class="t-callout" font-size="17" x="64" y="${528 + i * 20}" style="fill:#96A3A5">${esc(l)}</text>`));
    const top = note ? 566 : 540;
    const boxH = 1172 - top;
    out.push(`<svg x="${floor ? 0 : 64}" y="${top}" width="${floor ? 1080 : 952}" height="${boxH}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" overflow="visible">${chart}</svg>`);
    out.push(legend(M, 64, 1194, 318, 28, 3, 19));
    out.push(typeKey(M, 64, 1244, 11, 22));
    out.push(`<line class="l-hair" x1="64" x2="1016" y1="1258" y2="1258"/>`);
    out.push(`<text class="t-ui" font-size="22" x="64" y="1284">${esc(author.name)}</text>`);
    out.push(`<text class="t-ui" font-size="17" text-anchor="end" x="1016" y="1284">${esc(`Explore all ${M.st.items} at ${site}`)}</text>`);
    out.push(`<text class="t-deck t-mute" font-size="14" x="64" y="1304">${esc(`${author.title}, ${author.office}`)}</text>`);
    out.push(`<text class="t-deck t-mute" font-size="13" x="64" y="1322">${esc(copy.methodLine(M.meta))}</text>`);
    out.push(`<text class="t-deck t-mute" font-size="13" x="64" y="1340">${esc(M.meta.disclaimer)}</text>`);
  } else {
    out.push(`<rect x="48" y="34" width="256" height="34" fill="#F8C534"/>`);
    out.push(`<text class="t-display" font-size="22" x="58" y="59" style="fill:#0B1719">${esc(copy.tag)}</text>`);
    out.push(`<text class="t-micro" font-size="11" x="48" y="94" style="fill:#96A3A5">${esc(kicker)}</text>`);
    out.push(`<text class="t-display" font-size="96" x="44" y="186">${esc(h1)}</text>`);
    out.push(`<text class="t-display" font-size="96" x="44" y="268">${esc(h2 ?? '')}</text>`);
    wrap(copy.deck1(M.st), 40).forEach((l, i) => out.push(`<text class="t-deck" font-size="22" x="48" y="${314 + i * 27}">${esc(l)}</text>`));
    const dy = 314 + wrap(copy.deck1(M.st), 40).length * 27;
    out.push(`<text class="t-deck t-mute" font-size="22" x="48" y="${dy}">${esc(copy.deck2(M.st))}</text>`);
    if (note) wrap(note, 62).slice(0, 2).forEach((l, i) => out.push(`<text class="t-callout" font-size="14" x="48" y="${dy + 30 + i * 17}" style="fill:#96A3A5">${esc(l)}</text>`));
    out.push(legend(M, 48, 446, 250, 25, 2, 15));
    out.push(typeKey(M, 48, 530, 9, 12));
    out.push(`<svg x="560" y="24" width="610" height="512" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" overflow="visible">${chart}</svg>`);
    out.push(`<line class="l-hair" x1="48" x2="1152" y1="552" y2="552"/>`);
    out.push(`<text class="t-ui" font-size="16" x="48" y="578">${esc(author.name)}</text>`);
    out.push(`<text class="t-deck t-mute" font-size="11.5" x="48" y="596">${esc(`${author.title}, ${author.office}`)}</text>`);
    out.push(`<text class="t-deck t-mute" font-size="11.5" x="48" y="613">${esc(copy.methodLine(M.meta))}</text>`);
    out.push(`<text class="t-ui" font-size="15" text-anchor="end" x="1152" y="578">${esc(`Explore all ${M.st.items} at ${site}`)}</text>`);
    wrap(M.meta.disclaimer, 70).forEach((l, i) =>
      out.push(`<text class="t-deck t-mute" font-size="11.5" text-anchor="end" x="1152" y="${596 + i * 17}">${esc(l)}</text>`),
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>${fonts}${SVG_CSS}</style>${out.join('')}</svg>`;
  return { svg, w, h };
}

export async function saveImage(o: Opts) {
  await document.fonts.ready;
  const fonts = await fontCss();
  const { svg, w, h } = buildSvg(o, fonts);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  // Give embedded fonts a moment in WebKit before drawing.
  await new Promise((r) => setTimeout(r, 120));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('export failed'))), 'image/png'));
  const name = `unga81-ai-${o.view}-${w}x${h}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  if (o.coarse && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${o.M.meta.headline}: AI at UNGA81` });
      return;
    } catch {
      /* fall back to a download */
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

