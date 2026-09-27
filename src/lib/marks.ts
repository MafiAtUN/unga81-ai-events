// The mark system, identical to the infographic. Shapes are centred on 0,0 at scale 1.
import type { Item, Meta } from './types';

export const MARK = {
  eventR: 5.5,
  launchHalf: 6.5,
  officialHalf: 5,
  ringR: 4.5,
  ringStroke: 1.8,
  milestoneR: 10,
  seatW: 6.5,
  seatL: 15,
};

export type Shape = 'circle' | 'diamond' | 'square' | 'ring';

export const shapeOf = (e: Pick<Item, 'type' | 'conv'>): Shape =>
  e.conv === 'not_shown' ? 'ring' : e.type === 'launch' ? 'diamond' : e.type === 'official' ? 'square' : 'circle';

export const colorOf = (meta: Meta, conv: string) => meta.conveners.find((c) => c.key === conv)?.color ?? '#7E8B8E';

/** SVG markup for one mark at x, y with scale k. Used for static SVG (Astro, exports, Open Graph). */
export function markSvg(shape: Shape, color: string, x = 0, y = 0, k = 1, extra = ''): string {
  const t = `translate(${x.toFixed(2)} ${y.toFixed(2)})${k !== 1 ? ` scale(${k.toFixed(3)})` : ''}`;
  if (shape === 'circle') return `<circle transform="${t}" r="${MARK.eventR}" fill="${color}"${extra}/>`;
  if (shape === 'diamond') {
    const h = MARK.launchHalf;
    return `<path transform="${t}" d="M0,${-h}L${h},0L0,${h}L${-h},0Z" fill="${color}"${extra}/>`;
  }
  if (shape === 'square') {
    const h = MARK.officialHalf;
    return `<rect transform="${t}" x="${-h}" y="${-h}" width="${2 * h}" height="${2 * h}" fill="${color}"${extra}/>`;
  }
  return `<circle transform="${t}" r="${MARK.ringR}" fill="none" stroke="#7E8B8E" stroke-width="${MARK.ringStroke}"${extra}/>`;
}

/** A small standalone swatch, 14 px square, for legends and tables. */
export function swatchSvg(shape: Shape, color: string, size = 14): string {
  return `<svg width="${size}" height="${size}" viewBox="-7 -7 14 14" aria-hidden="true" focusable="false">${markSvg(shape, color)}</svg>`;
}

/** A capsule seat, drawn vertically and rotated. */
export function seatSvg(x: number, y: number, rot: number, fill: string, k = 1, extra = ''): string {
  const w = MARK.seatW * k;
  const l = MARK.seatL * k;
  return `<rect x="${(-w / 2).toFixed(2)}" y="${(-l / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${l.toFixed(2)}" rx="${(w / 2).toFixed(2)}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(2)})" fill="${fill}"${extra}/>`;
}
