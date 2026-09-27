// Layouts for the three chart views. Pure functions: the same code runs at build time
// (Open Graph cards, precomputed constellation grids) and in the browser.
import type { Item, Meta, Statement } from './types';
import { day, microDate, stackSort, windowDays, stats } from './data';

// ---------------------------------------------------------------------------
// Shared helpers

export const rad = (deg: number) => (deg * Math.PI) / 180;

/** Greedy word wrap by character budget. Good enough for labels in known fonts. */
export function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (line && (line + ' ' + w).length > maxChars) {
      lines.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines;
}

/** Node keys: one node per item, plus one extra copy per additional theme (used in THEME mode). */
export function nodeKeys(events: Item[]): { key: string; id: string; copy: number; theme: string | null }[] {
  const out: { key: string; id: string; copy: number; theme: string | null }[] = [];
  for (const e of events) {
    const themes = e.themes.length ? e.themes : [null];
    themes.forEach((t, i) => out.push({ key: i === 0 ? e.id : `${e.id}~${t}`, id: e.id, copy: i, theme: t }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Floor: the infographic geometry, in 1080 x 1350 frame units

export const FRAME = { w: 1080, h: 1350 };
export const FLOOR = {
  cx: 540,
  cy: 1098,
  ring: 336,
  stackFrom: 352,
  rowGap: 14,
  colGap: 13,
  seatInner: 170,
  seatOuter: 290,
  /** The part of the frame shown on screen. */
  crop: { x: 0, y: 540, w: 1080, h: 640 },
};

export const polar = (r: number, deg: number) => ({ x: FLOOR.cx + r * Math.cos(rad(deg)), y: FLOOR.cy - r * Math.sin(rad(deg)) });

export function arcPath(r: number, fromDeg: number, toDeg: number) {
  const a = polar(r, fromDeg);
  const b = polar(r, toDeg);
  const large = Math.abs(fromDeg - toDeg) > 180 ? 1 : 0;
  return `M${a.x.toFixed(2)},${a.y.toFixed(2)}A${r},${r} 0 ${large} 1 ${b.x.toFixed(2)},${b.y.toFixed(2)}`;
}

export type SeatMode = 'day' | 'group';

export interface Seat {
  order: number;
  x: number;
  y: number;
  /** rotation in degrees for a capsule drawn vertically */
  rot: number;
}

/** Items that get a callout on the Floor, as on the infographic. Text always comes from `milestone`. */
const FLOOR_CALLOUTS: { id: string; side: 'left' | 'top' | 'right'; x: number; y: number; chars: number }[] = [
  { id: 'e002', side: 'left', x: 64, y: 654, chars: 27 },
  { id: 'e005', side: 'left', x: 64, y: 763, chars: 27 },
  { id: 'e058', side: 'top', x: 676, y: 557, chars: 40 },
  { id: 'e155', side: 'right', x: 1016, y: 604, chars: 34 },
];

export function floorLayout(events: Item[], debate: Statement[], meta: Meta, seatMode: SeatMode) {
  const days = windowDays(meta);
  const slot = 180 / days.length;
  const slotAngle = (i: number) => 180 - (i + 0.5) * slot;
  const slotEdge = (i: number) => 180 - i * slot;
  const sort = stackSort(meta);
  const st = stats(events, debate, meta);

  const items = new Map<string, { x: number; y: number }>();
  const tips: { day: string; x: number; y: number; n: number }[] = [];
  days.forEach((d, i) => {
    const list = events.filter((e) => e.date === d).sort(sort);
    const theta = slotAngle(i);
    const ux = Math.cos(rad(theta));
    const uy = -Math.sin(rad(theta));
    const nx = Math.sin(rad(theta));
    const ny = Math.cos(rad(theta));
    list.forEach((e, k) => {
      const row = Math.floor(k / 2);
      const alone = k === list.length - 1 && k % 2 === 0;
      const off = alone ? 0 : ((k % 2) - 0.5) * FLOOR.colGap;
      const dist = FLOOR.stackFrom + row * FLOOR.rowGap;
      items.set(e.id, { x: FLOOR.cx + ux * dist + nx * off, y: FLOOR.cy + uy * dist + ny * off });
    });
    if (list.length) {
      const rows = Math.ceil(list.length / 2);
      const tipDist = FLOOR.stackFrom + (rows - 1) * FLOOR.rowGap + 20;
      tips.push({ day: d, x: FLOOR.cx + ux * tipDist, y: FLOOR.cy + uy * tipDist, n: list.length });
    }
  });

  // Seats: Member States only, one row per debate day or per regional group.
  const members = debate.filter((s) => s.member_state);
  const rows: { key: string; label: string; seats: Statement[] }[] =
    seatMode === 'day'
      ? st.debateDays.map((d) => ({ key: d, label: microDate(d), seats: members.filter((s) => s.date === d) }))
      : [...meta.debate_groups]
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((g) => ({ key: g.key, label: g.label, seats: members.filter((s) => s.group === g.key) }));
  const seats = new Map<number, Seat>();
  const rowRadii: number[] = [];
  rows.forEach((row, j) => {
    const r = rows.length === 1 ? (FLOOR.seatInner + FLOOR.seatOuter) / 2 : FLOOR.seatOuter - (j * (FLOOR.seatOuter - FLOOR.seatInner)) / (rows.length - 1);
    rowRadii.push(r);
    const n = row.seats.length;
    row.seats.forEach((s, m) => {
      const theta = 180 - ((m + 0.5) * 180) / n;
      const p = polar(r, theta);
      seats.set(s.order, { order: s.order, x: p.x, y: p.y, rot: 90 - theta });
    });
  });

  // Decorations
  const asAtIndex = days.indexOf(meta.as_at);
  const cut = slotEdge(asAtIndex + 1);
  const hlwFrom = slotEdge(days.indexOf(meta.high_level_week.from));
  const hlwTo = slotEdge(days.indexOf(meta.high_level_week.to) + 1);
  const ticks = days.map((_, i) => {
    const a = polar(FLOOR.ring, slotAngle(i));
    const b = polar(FLOOR.ring - 7, slotAngle(i));
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });
  // Mondays outside high level week are labelled inside the ring, first and last day under the baseline.
  const dayLabels = days
    .map((d, i) => ({ d, i }))
    .filter(({ d, i }) => i > 0 && i < days.length - 1 && new Date(`${d}T12:00:00Z`).getUTCDay() === 1 && !(d >= meta.high_level_week.from && d <= meta.high_level_week.to))
    .map(({ d, i }) => {
      const p = polar(FLOOR.ring - 22, slotAngle(i));
      return { text: microDate(d), x: p.x, y: p.y + 4, anchor: p.x < FLOOR.cx ? 'start' : 'end' };
    });
  const ends = [
    { text: microDate(days[0]), x: FLOOR.cx - FLOOR.ring, y: FLOOR.cy + 28, anchor: 'middle' },
    { text: microDate(days[days.length - 1]), x: FLOOR.cx + FLOOR.ring, y: FLOOR.cy + 28, anchor: 'middle' },
  ];
  const hlwEnd = polar(FLOOR.ring, hlwTo);
  const scheduled = polar(FLOOR.ring + 70, slotAngle(asAtIndex + 1) - slot * 1.4);

  const byId = new Map(events.map((e) => [e.id, e]));
  const callouts = FLOOR_CALLOUTS.filter((c) => byId.get(c.id)?.milestone && items.has(c.id)).map((c) => {
    const e = byId.get(c.id)!;
    const n = st.byDay.get(e.date!) ?? 0;
    const head = [microDate(e.date!)];
    if (e.date === st.peakDay) head.push(`THE PEAK, ${n} ITEMS`);
    else if (n >= 5) head.push(`${n} ITEMS`);
    const lines = wrap(e.milestone!, c.chars);
    const target = items.get(c.id)!;
    return { id: c.id, side: c.side, x: c.x, y: c.y, head: head.join('  '), lines, target, conv: e.conv, type: e.type };
  });
  const calloutDays = new Set(callouts.map((c) => byId.get(c.id)!.date));
  const tipLabels = tips.filter((t) => t.n >= 5 && !calloutDays.has(t.day));

  return {
    items,
    seats,
    rows: rows.map((r, j) => ({ key: r.key, label: r.label, radius: rowRadii[j], lit: r.seats.filter((s) => s.raised_ai).length, total: r.seats.length })),
    decor: {
      ringSolid: arcPath(FLOOR.ring, 180, cut),
      ringDashed: arcPath(FLOOR.ring, cut, 0),
      hlw: arcPath(FLOOR.ring, hlwFrom, hlwTo),
      hlwLabel: { x: hlwEnd.x + 22, y: hlwEnd.y - 4 },
      scheduled,
      ticks,
      dayLabels: [...dayLabels, ...ends],
      tips: tipLabels,
      callouts,
      baseline: { x1: 64, x2: 1016, y: FLOOR.cy },
    },
  };
}
export type FloorLayout = ReturnType<typeof floorLayout>;

// ---------------------------------------------------------------------------
// Pulse: calendar swarm, in stage pixels for a stage of width W

export function pulseLayout(events: Item[], debate: Statement[], meta: Meta, W: number) {
  const days = windowDays(meta);
  const sort = stackSort(meta);
  const st = stats(events, debate, meta);
  const members = debate.filter((s) => s.member_state);
  const items = new Map<string, { x: number; y: number }>();
  const seats = new Map<number, { x: number; y: number; rot: number }>();
  const inHlw = (d: string) => d >= meta.high_level_week.from && d <= meta.high_level_week.to;

  type Label = { text: string; x: number; y: number; anchor?: string; cls: string };
  const labels: Label[] = [];
  const milestones: { id: string; lines: string[]; x: number; y: number; tx: number; ty: number; anchor: string }[] = [];
  const lines: { x1: number; y1: number; x2: number; y2: number; cls: string }[] = [];

  if (W < 900) {
    // Phones: one row per day, marks flow right in rows of up to 12.
    const pad = 16;
    const labelW = 70;
    const x0 = pad + labelW;
    const pitch = Math.min(22, (W - x0 - pad) / 12);
    const seatPitch = 10;
    const seatsPerRow = Math.max(1, Math.floor((W - x0 - pad) / seatPitch));
    let y = 8;
    let hlwTop = 0;
    let hlwBottom = 0;
    for (const d of days) {
      if (d === meta.high_level_week.from) {
        labels.push({ text: `HIGH LEVEL WEEK  ${microDate(meta.high_level_week.from).split(' ')[0]} TO ${microDate(meta.high_level_week.to)}  ${st.hlw} ITEMS`, x: pad + 6, y: y + 14, cls: 'gold' });
        hlwTop = y + 2;
        y += 30;
      }
      const list = events.filter((e) => e.date === d).sort(sort);
      const rowsN = Math.max(1, Math.ceil(list.length / 12));
      const top = y;
      labels.push({ text: microDate(d), x: pad + 6, y: top + pitch / 2 + 4, cls: 'micro' });
      if (list.length) labels.push({ text: String(list.length), x: x0 - 10, y: top + pitch / 2 + 4, anchor: 'end', cls: 'count' });
      list.forEach((e, k) => items.set(e.id, { x: x0 + ((k % 12) + 0.5) * pitch, y: top + (Math.floor(k / 12) + 0.5) * pitch }));
      y = top + rowsN * pitch;
      for (const e of list.filter((e) => e.milestone)) {
        const ls = wrap(e.milestone!, Math.floor((W - x0 - pad) / 7.4));
        const p = items.get(e.id)!;
        milestones.push({ id: e.id, lines: ls, x: x0, y: y + 16, tx: p.x, ty: p.y, anchor: 'start' });
        y += 8 + ls.length * 18;
      }
      const daySeats = members.filter((s) => s.date === d);
      if (daySeats.length) {
        labels.push({ text: 'GENERAL DEBATE', x: x0, y: y + 16, cls: 'micro' });
        y += 26;
        daySeats.forEach((s, m) => seats.set(s.order, { x: x0 + ((m % seatsPerRow) + 0.5) * seatPitch, y: y + (Math.floor(m / seatsPerRow) + 0.5) * 20, rot: 0 }));
        y += Math.ceil(daySeats.length / seatsPerRow) * 20;
      }
      y += 10;
      lines.push({ x1: pad, y1: y - 5, x2: W - pad, y2: y - 5, cls: 'hair' });
      if (d === meta.high_level_week.to) hlwBottom = y - 8;
    }
    lines.push({ x1: pad, y1: hlwTop, x2: pad, y2: hlwBottom, cls: 'gold' });
    lines.push({ x1: x0 - 4, y1: 8, x2: x0 - 4, y2: y - 8, cls: 'spine' });
    return { items, seats, labels, milestones, lines, h: y + 8, mode: 'rows' as const };
  }

  // Desktop: one column per day, left to right.
  const pad = 24;
  const colW = (W - 2 * pad) / days.length;
  const per = Math.max(2, Math.floor(colW / 17));
  const pitch = Math.min(17, colW / per);
  const cx = (i: number) => pad + (i + 0.5) * colW;

  // Milestone spine: labels in lanes so they never overlap.
  const labelW = 150;
  const lanes: number[] = [];
  const laneOf: { e: Item; i: number; lane: number; ls: string[]; anchor: string; x0: number }[] = [];
  const ms = events.filter((e) => e.milestone && e.date).sort((a, b) => a.date!.localeCompare(b.date!));
  for (const e of ms) {
    const i = days.indexOf(e.date!);
    const anchor = cx(i) + labelW > W - pad ? 'end' : 'start';
    const x0 = anchor === 'start' ? cx(i) - 4 : cx(i) - labelW + 4;
    let lane = lanes.findIndex((end) => end < x0 - 10);
    if (lane < 0) lane = lanes.push(0) - 1;
    lanes[lane] = x0 + labelW;
    laneOf.push({ e, i, lane, ls: wrap(e.milestone!, 22), anchor, x0 });
  }
  const laneH = laneOf.reduce((m, l) => Math.max(m, l.ls.length), 1) * 17 + 28;
  const spineY = lanes.length * laneH + 12;
  for (const l of laneOf) {
    const y = l.lane * laneH + 14;
    milestones.push({ id: l.e.id, lines: l.ls, x: l.anchor === 'start' ? cx(l.i) - 4 : cx(l.i) + 4, y, tx: cx(l.i), ty: spineY, anchor: l.anchor });
  }
  lines.push({ x1: pad, y1: spineY, x2: W - pad, y2: spineY, cls: 'spine' });

  const hlwY = spineY + 34;
  const counts = days.map((d) => events.filter((e) => e.date === d).length);
  const maxRows = Math.max(...counts.map((n) => Math.ceil(n / per)));
  const baseY = hlwY + 26 + maxRows * pitch;
  days.forEach((d, i) => {
    const list = events.filter((e) => e.date === d).sort(sort);
    list.forEach((e, k) => {
      const row = Math.floor(k / per);
      const inRow = Math.min(per, list.length - row * per);
      const col = k % per;
      items.set(e.id, { x: cx(i) + (col - (inRow - 1) / 2) * pitch, y: baseY - (row + 0.5) * pitch });
    });
    if (list.length) labels.push({ text: String(list.length), x: cx(i), y: baseY - Math.ceil(list.length / per) * pitch - 8, anchor: 'middle', cls: 'count' });
    labels.push({ text: String(day(d)), x: cx(i), y: baseY + 18, anchor: 'middle', cls: inHlw(d) ? 'micro gold' : 'micro' });
  });
  labels.push({ text: microDate(days[0]).split(' ')[1], x: pad, y: baseY + 36, cls: 'micro' });
  lines.push({ x1: pad, y1: baseY, x2: W - pad, y2: baseY, cls: 'hair' });
  const hi = days.indexOf(meta.high_level_week.from);
  const hj = days.indexOf(meta.high_level_week.to);
  const hx1 = pad + hi * colW + 3;
  const hx2 = pad + (hj + 1) * colW - 3;
  lines.push({ x1: hx1, y1: hlwY, x2: hx2, y2: hlwY, cls: 'gold' });
  lines.push({ x1: hx1, y1: hlwY, x2: hx1, y2: hlwY + 8, cls: 'gold thin' });
  lines.push({ x1: hx2, y1: hlwY, x2: hx2, y2: hlwY + 8, cls: 'gold thin' });
  labels.push({ text: `HIGH LEVEL WEEK  ${st.hlw} ITEMS`, x: hx1, y: hlwY - 8, cls: 'gold' });

  // General Debate lane under its days.
  let laneBottom = baseY + 44;
  const gdDays = st.debateDays;
  if (gdDays.length) {
    const gy = baseY + 64;
    const first = days.indexOf(gdDays[0]);
    labels.push({ text: 'GENERAL DEBATE', x: pad + first * colW + 3, y: gy - 6, cls: 'micro' });
    const seatPitchX = Math.max(8, Math.min(10, colW / 5));
    const seatsPer = Math.max(1, Math.floor((colW - 4) / seatPitchX));
    for (const d of gdDays) {
      const i = days.indexOf(d);
      const daySeats = members.filter((s) => s.date === d);
      daySeats.forEach((s, m) => {
        const row = Math.floor(m / seatsPer);
        const col = m % seatsPer;
        seats.set(s.order, { x: cx(i) + (col - (seatsPer - 1) / 2) * seatPitchX, y: gy + 12 + row * 19, rot: 0 });
      });
      laneBottom = Math.max(laneBottom, gy + 12 + Math.ceil(daySeats.length / seatsPer) * 19);
    }
  }
  return { items, seats, labels, milestones, lines, h: laneBottom + 8, mode: 'cols' as const };
}
export type PulseLayout = ReturnType<typeof pulseLayout>;

// ---------------------------------------------------------------------------
// Constellation: clusters by facet, precomputed at build for three breakpoints

export const FACETS = ['convener', 'platform', 'theme', 'where', 'type'] as const;
export type Facet = (typeof FACETS)[number];
export const BREAKPOINTS = [360, 768, 1280] as const;

export interface Cluster {
  key: string;
  label: string[];
  x: number;
  y: number;
  w: number;
  ids: string[];
}
export interface ConstellationLayout {
  pos: Record<string, [number, number]>;
  clusters: Cluster[];
  h: number;
}

export function facetGroups(events: Item[], meta: Meta, facet: Facet): { key: string; label: string; items: Item[]; copyKey: (e: Item) => string }[] {
  const plain = (field: keyof Item, opts: { key: string; label: string }[]) =>
    opts.map((o) => ({ key: o.key, label: o.label, items: events.filter((e) => e[field] === o.key), copyKey: (e: Item) => e.id }));
  if (facet === 'convener') return plain('conv', meta.conveners);
  if (facet === 'platform') return plain('platform', meta.platforms);
  if (facet === 'where') return plain('loc', meta.locations);
  if (facet === 'type') return plain('type', meta.types);
  return meta.themes.map((t) => ({
    key: t.key,
    label: t.label,
    items: events.filter((e) => e.themes.includes(t.key)),
    copyKey: (e: Item) => (e.themes[0] === t.key ? e.id : `${e.id}~${t.key}`),
  }));
}

export function constellationLayout(events: Item[], meta: Meta, facet: Facet, bp: number): ConstellationLayout {
  const sort = stackSort(meta);
  const pitch = 18;
  const per = 12;
  const gridW = per * pitch;
  const gapX = 32;
  const gapY = 30;
  const pad = bp < 500 ? 16 : 24;
  const cols = Math.max(1, Math.floor((bp - 2 * pad + gapX) / (gridW + gapX)));
  const usedW = cols * gridW + (cols - 1) * gapX;
  const left = (bp - usedW) / 2;
  const groups = facetGroups(events, meta, facet).filter((g) => g.items.length);
  const pos: Record<string, [number, number]> = {};
  const clusters: Cluster[] = [];
  let y = 12;
  for (let r = 0; r < groups.length; r += cols) {
    const row = groups.slice(r, r + cols);
    let rowH = 0;
    row.forEach((g, c) => {
      const x = left + c * (gridW + gapX);
      const label = wrap(g.label, 27);
      const gy = y + label.length * 17 + 10;
      const list = [...g.items].sort(sort);
      list.forEach((e, k) => {
        pos[g.copyKey(e)] = [+(x + ((k % per) + 0.5) * pitch).toFixed(1), +(gy + (Math.floor(k / per) + 0.5) * pitch).toFixed(1)];
      });
      clusters.push({ key: g.key, label, x, y, w: gridW, ids: list.map((e) => e.id) });
      rowH = Math.max(rowH, gy - y + Math.ceil(list.length / per) * pitch);
    });
    y += rowH + gapY;
  }
  return { pos, clusters, h: y };
}

export function allConstellations(events: Item[], meta: Meta) {
  const out: Record<string, Record<string, ConstellationLayout>> = {};
  for (const bp of BREAKPOINTS) {
    out[bp] = {};
    for (const f of FACETS) out[bp][f] = constellationLayout(events, meta, f, bp);
  }
  return out;
}
