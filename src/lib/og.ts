// Open Graph cards (1200 x 627), rendered at build time with Satori and resvg.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { meta, S } from './load';
import { copy } from './copy';

const font = (f: string) => readFileSync(resolve(process.cwd(), 'og-fonts', f));
const fonts = [
  { name: 'Archivo75', data: font('archivo-800-75.ttf'), weight: 800 as const, style: 'normal' as const },
  { name: 'Archivo62', data: font('archivo-800-62.ttf'), weight: 800 as const, style: 'normal' as const },
  { name: 'Archivo87', data: font('archivo-600-87.ttf'), weight: 600 as const, style: 'normal' as const },
  { name: 'Serif', data: font('serif-400-36.ttf'), weight: 400 as const, style: 'normal' as const },
  { name: 'SerifItalic', data: font('serif-italic-450-18.ttf'), weight: 400 as const, style: 'italic' as const },
  { name: 'Mono', data: font('mono-500-87.ttf'), weight: 500 as const, style: 'normal' as const },
];

type Node = { type: string; props: Record<string, unknown> };
export const h = (type: string, style: Record<string, unknown>, ...children: (Node | string | null | false)[]): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.filter(Boolean) },
});
const img = (svg: string, w: number, hgt: number): Node => ({
  type: 'img',
  props: { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, width: w, height: hgt },
});

const C = { bg: '#0B1719', ink: '#EFEBE1', mute: '#96A3A5', micro: '#7E8B8E', hair: '#34464A', gold: '#F8C534' };
const micro = (text: string, color = C.micro, size = 15) => h('div', { fontFamily: 'Mono', fontSize: size, letterSpacing: '0.04em', color }, text.toUpperCase());
const site = meta.site.replace(/^https:\/\//, '').replace(/\/$/, '');

/** The shared frame: mini hemicycle on the left, the story on the right, credits at the bottom. */
export async function card(opts: { hemicycle: string; kicker: string; title: string; titleSize: number; lines: (Node | string)[] }): Promise<Buffer> {
  const tree = h(
    'div',
    { width: 1200, height: 627, background: C.bg, color: C.ink, flexDirection: 'column', padding: '40px 48px 28px' },
    h(
      'div',
      { flex: 1, flexDirection: 'row', gap: 36 },
      h('div', { width: 520, flexDirection: 'column', justifyContent: 'center' }, img(opts.hemicycle, 520, 373)),
      h(
        'div',
        { flex: 1, flexDirection: 'column' },
        h(
          'div',
          { flexDirection: 'row', alignItems: 'center', gap: 14 },
          h('div', { background: C.gold, color: C.bg, fontFamily: 'Archivo75', fontSize: 24, padding: '5px 9px 3px' }, copy.tag),
        ),
        h('div', { marginTop: 16 }, micro(opts.kicker, C.mute)),
        h('div', { marginTop: 12, fontFamily: 'Archivo75', fontSize: opts.titleSize, lineHeight: 0.98, letterSpacing: '-0.01em' }, opts.title),
        h('div', { marginTop: 18, flexDirection: 'column', gap: 8 }, ...opts.lines),
      ),
    ),
    h('div', { height: 1, background: C.hair, marginTop: 14 }),
    h(
      'div',
      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12, gap: 24 },
      h(
        'div',
        { flexDirection: 'column', width: 640 },
        h('div', { fontFamily: 'Serif', fontSize: 14, color: C.mute }, copy.methodLine(meta)),
        h('div', { fontFamily: 'Serif', fontSize: 14, color: C.mute, marginTop: 2 }, meta.disclaimer),
      ),
      h(
        'div',
        { flexDirection: 'column', alignItems: 'flex-end' },
        h('div', { fontFamily: 'Archivo87', fontSize: 18 }, meta.author.name),
        h('div', { fontFamily: 'Archivo87', fontSize: 16, color: C.mute }, `Explore all ${S.items} at ${site}`),
      ),
    ),
  );
  const svg = await satori(tree as never, { width: 1200, height: 627, fonts });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

export const line = (text: string, style: Record<string, unknown> = {}) => h('div', { fontFamily: 'Serif', fontSize: 22, color: C.ink, lineHeight: 1.25, ...style }, text);
export const italic = (text: string) => h('div', { fontFamily: 'SerifItalic', fontStyle: 'italic', fontSize: 22, color: C.ink, lineHeight: 1.25 }, text);
export const microLine = (text: string, color = C.micro) => micro(text, color, 14);
export const clampChars = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : s);
export const titleSize = (s: string) => (s.length > 150 ? 30 : s.length > 110 ? 34 : s.length > 70 ? 40 : 48);
