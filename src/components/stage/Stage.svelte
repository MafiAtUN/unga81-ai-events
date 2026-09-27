<script lang="ts">
  import { onMount, untrack, tick } from 'svelte';
  import { timer, type Timer } from 'd3-timer';
  import { easeCubicInOut, easeCubicOut } from 'd3-ease';
  import { interpolateRgb } from 'd3-interpolate';
  import { Delaunay } from 'd3-delaunay';
  import type { Item, Statement } from '../../lib/types';
  import { longDate, microDate } from '../../lib/data';
  import { floorLayout, pulseLayout, FLOOR, BREAKPOINTS, FACETS, type Facet, type SeatMode } from '../../lib/layout';
  import { MARK, shapeOf, colorOf } from '../../lib/marks';
  import { floorDecor, pulseDecor, constellationDecor, groupRowNumbers, bigNumber } from '../../lib/decor';
  import { SVG_CSS } from '../../lib/svgcss';
  import { copy } from '../../lib/copy';
  import { emptyState, matches, seatMatches, sentence, toQuery, fromQuery, isFiltered, VIEWS, type State, type View } from '../../lib/state';
  import { buildModel, type Model, type StageData } from './model';
  import Filters from './Filters.svelte';
  import Legend from './Legend.svelte';
  import Card from './Card.svelte';
  import CountryCard from './CountryCard.svelte';
  import Search from './Search.svelte';
  import HowTo from './HowTo.svelte';
  import type { Preset } from '../../lib/presets';
  import { indexController } from '../../lib/indexctl';

  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const HIT = 22; // 44 px targets

  // Server rendered text for the status line, so nothing shifts when the island hydrates.
  let { initial }: { initial: { words: string; method: string; headline: string; presets: Preset[] } } = $props();

  let M = $state.raw<Model | null>(null);
  let S = $state<State>(emptyState());
  let W = $state(0);
  let wide = $state(true);
  let coarse = $state(false);
  let reduced = false;
  let view = $derived<View>(S.v ?? (wide ? 'floor' : 'pulse'));

  // ---------------------------------------------------------------- animation state
  type Arr = { x: Float64Array; y: Float64Array; k: Float64Array; o: Float64Array };
  const arr = (n: number): Arr => ({ x: new Float64Array(n), y: new Float64Array(n), k: new Float64Array(n), o: new Float64Array(n) });
  type SArr = Arr & { r: Float64Array; lit: Float64Array };
  const sarr = (n: number): SArr => ({ ...arr(n), r: new Float64Array(n), lit: new Float64Array(n) });
  let cur: Arr = arr(0);
  let to: Arr = arr(0);
  let scur: SArr = sarr(0);
  let sto: SArr = sarr(0);
  let frame = $state(0);
  let H = $state(0);
  let bigN = $state(0);
  let decorOn = $state(true);
  let introduced = false;
  let lastKind = '';
  let anim: Timer | null = null;
  let fading = $state(false);

  // ---------------------------------------------------------------- interaction state
  let hover = $state<{ kind: 'item'; i: number } | { kind: 'seat'; j: number } | null>(null);
  let pinnedSeat = $state<number | null>(null);
  let country = $state<string | null>(null);
  let roving = $state<string | null>(null);
  let focused = $state<string | null>(null);
  let filtersOpen = $state(false);
  let searchOpen = $state(false);
  let exportSize = $state<'portrait' | 'landscape'>('portrait');
  let saving = $state(false);
  let svgEl = $state<SVGSVGElement | null>(null);
  let toolbarEl = $state<HTMLDivElement | null>(null);
  let controlsEl = $state<HTMLDivElement | null>(null);
  let vh = $state(900);
  let chartOffset = $state(0);
  let pinned = $state(false);
  let guideOpen = $state(false);
  let hintHidden = $state(false);
  let stageEl = $state<HTMLDivElement | null>(null);
  let cardReturn: HTMLElement | null = null;
  let idx: ReturnType<typeof indexController> | null = null;

  // ---------------------------------------------------------------- derived data
  let matched = $derived.by(() => (M ? new Set(M.events.filter((e) => matches(e, S)).map((e) => e.id)) : new Set<string>()));
  let seatOn = $derived.by(() => (M ? M.members.map((s) => seatMatches(s, S)) : []));
  let words = $derived(M ? sentence(M.events, M.meta, S) : '');
  let filtered = $derived(isFiltered(S));
  let selItem = $derived(M && S.sel ? M.byId.get(S.sel) ?? null : null);
  let countryObj = $derived(M && country ? M.countries.find((c) => c.statement.country === country) ?? null : null);

  // Use the largest precomputed grid that fits once scaled down by at most 10 percent.
  function bpFor(w: number) {
    let bp: number = BREAKPOINTS[0];
    for (const b of BREAKPOINTS) if (w >= b * 0.9) bp = b;
    return bp;
  }

  // Layout for the current view, in stage pixels.
  let lay = $derived.by(() => {
    if (!M || !W || view === 'index') return null;
    const n = M.nodes.length;
    const t = arr(n);
    const st = sarr(M.members.length);
    let h = 0;
    let decor = '';
    let s = 1;
    let ox = 0;
    let fl = null as ReturnType<typeof floorLayout> | null;
    if (view === 'floor') {
      fl = floorLayout(M.events, M.debate, M.meta, S.seat);
      // Fit the whole Floor in the window below the controls, never wider than the page.
      const fitH = (vh - chartOffset - 16) / FLOOR.crop.h;
      s = Math.min(W / FLOOR.crop.w, Math.max(0.5, fitH));
      ox = (W - FLOOR.crop.w * s) / 2;
      M.nodes.forEach((nd, i) => {
        const p = fl!.items.get(nd.id)!;
        t.x[i] = ox + (p.x - FLOOR.crop.x) * s;
        t.y[i] = (p.y - FLOOR.crop.y) * s;
        t.k[i] = s;
        t.o[i] = nd.copy === 0 ? 1 : 0;
      });
      M.members.forEach((m, j) => {
        const p = fl!.seats.get(m.order)!;
        st.x[j] = ox + (p.x - FLOOR.crop.x) * s;
        st.y[j] = (p.y - FLOOR.crop.y) * s;
        st.r[j] = p.rot;
        st.k[j] = s;
        st.o[j] = 1;
        st.lit[j] = m.raised_ai ? 1 : 0;
      });
      h = FLOOR.crop.h * s;
      decor = `<g transform="translate(${ox.toFixed(2)} 0) scale(${s.toFixed(4)}) translate(${-FLOOR.crop.x} ${-FLOOR.crop.y})">${floorDecor(fl, M.st, M.meta)}${S.seat === 'group' ? groupRowNumbers(fl) : ''}</g>`;
    } else if (view === 'pulse') {
      const pl = pulseLayout(M.events, M.debate, M.meta, W);
      // Desktop calendar: shrink a little, never below 70 percent, when it would not fit the window.
      const fit = pl.mode === 'cols' ? Math.min(1, Math.max(0.7, (vh - chartOffset - 16) / pl.h)) : 1;
      ox = (W - W * fit) / 2;
      const seatK = pl.mode === 'cols' ? 0.72 : 1;
      M.nodes.forEach((nd, i) => {
        const p = pl.items.get(nd.id)!;
        t.x[i] = ox + p.x * fit;
        t.y[i] = p.y * fit;
        t.k[i] = fit;
        t.o[i] = nd.copy === 0 ? 1 : 0;
      });
      M.members.forEach((m, j) => {
        const p = pl.seats.get(m.order)!;
        st.x[j] = ox + p.x * fit;
        st.y[j] = p.y * fit;
        st.r[j] = 0;
        st.k[j] = seatK * fit;
        st.o[j] = 1;
        st.lit[j] = m.raised_ai ? 1 : 0;
      });
      h = pl.h * fit;
      s = fit;
      decor = fit === 1 ? pulseDecor(pl) : `<g transform="translate(${ox.toFixed(2)} 0) scale(${fit.toFixed(4)})">${pulseDecor(pl)}</g>`;
    } else {
      const bp = bpFor(W);
      const L = M.constellation[bp][S.facet];
      const sc = W < bp ? W / bp : 1;
      const ox = W < bp ? 0 : (W - bp) / 2;
      const first = new Map<string, number>();
      M.nodes.forEach((nd, i) => {
        const p = L.pos[nd.key];
        if (p) {
          t.x[i] = ox + p[0] * sc;
          t.y[i] = p[1] * sc;
          t.o[i] = 1;
          if (nd.copy === 0) first.set(nd.id, i);
        } else t.o[i] = 0;
        t.k[i] = sc;
      });
      // Copies not shown in this facet rest on their first copy, so they can grow out of it later.
      M.nodes.forEach((nd, i) => {
        if (!L.pos[nd.key]) {
          const f = first.get(nd.id);
          const p = L.pos[nd.id];
          t.x[i] = f !== undefined ? t.x[f] : p ? ox + p[0] * sc : W / 2;
          t.y[i] = f !== undefined ? t.y[f] : p ? p[1] * sc : 0;
        }
      });
      M.members.forEach((m, j) => {
        st.x[j] = scur.x[j] || W / 2;
        st.y[j] = scur.y[j] || 0;
        st.r[j] = scur.r[j];
        st.k[j] = scur.k[j] || 1;
        st.o[j] = 0;
        st.lit[j] = m.raised_ai ? 1 : 0;
      });
      h = L.h * sc;
      s = sc;
    }
    return { kind: `${view}|${S.facet}|${S.seat}`, view, t, st, h, decor, s, ox, fl };
  });

  // Constellation labels carry live counts, so they are derived separately.
  let constDecor = $derived.by(() => {
    if (!M || !W || view !== 'constellation') return '';
    const bp = bpFor(W);
    const L = M.constellation[bp][S.facet];
    const sc = W < bp ? W / bp : 1;
    const ox = W < bp ? 0 : (W - bp) / 2;
    const counts = new Map(L.clusters.map((c) => [c.key, c.ids.filter((id) => matched.has(id)).length]));
    return `<g transform="translate(${ox} 0) scale(${sc})">${constellationDecor(L.clusters, counts, filtered)}</g>`;
  });

  // ---------------------------------------------------------------- animation
  function stop() {
    anim?.stop();
    anim = null;
  }

  function jump(L: NonNullable<typeof lay>) {
    stop();
    cur = { x: L.t.x.slice(), y: L.t.y.slice(), k: L.t.k.slice(), o: L.t.o.slice() };
    scur = { x: L.st.x.slice(), y: L.st.y.slice(), k: L.st.k.slice(), o: L.st.o.slice(), r: L.st.r.slice(), lit: L.st.lit.slice() };
    bigN = M!.st.membersAi;
    decorOn = true;
    frame++;
  }

  function run(L: NonNullable<typeof lay>, mode: 'intro' | 'morph') {
    stop();
    const n = L.t.x.length;
    const m = L.st.x.length;
    const f = { x: cur.x.slice(), y: cur.y.slice(), k: cur.k.slice(), o: cur.o.slice() };
    const sf = { x: scur.x.slice(), y: scur.y.slice(), k: scur.k.slice(), o: scur.o.slice(), r: scur.r.slice(), lit: scur.lit.slice() };
    const delay = new Float64Array(n);
    const dur = mode === 'intro' ? 320 : 600;
    const litOrder: number[] = [];
    if (mode === 'intro') {
      M!.nodes.forEach((nd, i) => {
        f.x[i] = L.t.x[i];
        f.y[i] = L.t.y[i] - 26 * L.t.k[i];
        f.k[i] = L.t.k[i];
        f.o[i] = 0;
        delay[i] = M!.orderIndex.get(nd.id)! * 8;
      });
      for (let j = 0; j < m; j++) {
        sf.x[j] = L.st.x[j];
        sf.y[j] = L.st.y[j];
        sf.k[j] = L.st.k[j];
        sf.r[j] = L.st.r[j];
        sf.o[j] = L.st.o[j];
        sf.lit[j] = 0;
        if (L.st.lit[j]) litOrder.push(j);
      }
      bigN = 0;
    }
    const litAt = new Float64Array(m).fill(0);
    litOrder.forEach((j, q) => (litAt[j] = 700 + (q * 520) / Math.max(1, litOrder.length)));
    const total = mode === 'intro' ? 1560 : dur;
    decorOn = mode === 'intro';
    anim = timer((el) => {
      for (let i = 0; i < n; i++) {
        const p = Math.min(1, Math.max(0, (el - delay[i]) / dur));
        const e = mode === 'intro' ? easeCubicOut(p) : easeCubicInOut(p);
        cur.x[i] = f.x[i] + (L.t.x[i] - f.x[i]) * e;
        cur.y[i] = f.y[i] + (L.t.y[i] - f.y[i]) * e;
        cur.k[i] = f.k[i] + (L.t.k[i] - f.k[i]) * e;
        cur.o[i] = f.o[i] + (L.t.o[i] - f.o[i]) * e;
      }
      const ps = easeCubicInOut(Math.min(1, el / dur));
      for (let j = 0; j < m; j++) {
        if (mode === 'intro') {
          scur.lit[j] = L.st.lit[j] ? Math.min(1, Math.max(0, (el - litAt[j]) / 90)) : 0;
          scur.x[j] = L.st.x[j];
          scur.y[j] = L.st.y[j];
          scur.k[j] = L.st.k[j];
          scur.r[j] = L.st.r[j];
          scur.o[j] = L.st.o[j];
        } else {
          scur.x[j] = sf.x[j] + (L.st.x[j] - sf.x[j]) * ps;
          scur.y[j] = sf.y[j] + (L.st.y[j] - sf.y[j]) * ps;
          scur.k[j] = sf.k[j] + (L.st.k[j] - sf.k[j]) * ps;
          scur.r[j] = sf.r[j] + (L.st.r[j] - sf.r[j]) * ps;
          scur.o[j] = sf.o[j] + (L.st.o[j] - sf.o[j]) * ps;
          scur.lit[j] = L.st.lit[j];
        }
      }
      if (mode === 'intro') bigN = Math.round(M!.st.membersAi * easeCubicOut(Math.min(1, Math.max(0, (el - 850) / 600))));
      frame++;
      if (el >= total) {
        jump(L);
      }
    });
  }

  $effect(() => {
    const L = lay;
    if (!L) return;
    untrack(() => {
      H = L.h;
      if (!introduced) {
        introduced = true;
        lastKind = L.kind;
        if (reduced) jump(L);
        else {
          jump(L);
          document.fonts.ready.then(() => run(L, 'intro'));
        }
        return;
      }
      const changed = L.kind !== lastKind;
      lastKind = L.kind;
      if (!changed || cur.x.length !== L.t.x.length) return jump(L);
      if (reduced) {
        fading = true;
        setTimeout(() => {
          jump(L);
          fading = false;
        }, 150);
        return;
      }
      run(L, 'morph');
    });
  });

  // ---------------------------------------------------------------- hit layer (Delaunay)
  let hit = $derived.by(() => {
    if (!lay || !M) return null;
    const pts: number[] = [];
    const ref: ({ kind: 'item'; i: number } | { kind: 'seat'; j: number })[] = [];
    M.nodes.forEach((nd, i) => {
      if (lay.t.o[i] > 0.5 && matched.has(nd.id)) {
        pts.push(lay.t.x[i], lay.t.y[i]);
        ref.push({ kind: 'item', i });
      }
    });
    M.members.forEach((_, j) => {
      if (lay.st.o[j] > 0.5 && seatOn[j]) {
        pts.push(lay.st.x[j], lay.st.y[j]);
        ref.push({ kind: 'seat', j });
      }
    });
    return { d: new Delaunay(Float64Array.from(pts)), ref, pts };
  });

  function pick(ev: PointerEvent) {
    if (!hit || !svgEl || !hit.ref.length) return null;
    const r = svgEl.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    const k = hit.d.find(x, y);
    if (k < 0) return null;
    const dx = hit.pts[2 * k] - x;
    const dy = hit.pts[2 * k + 1] - y;
    return dx * dx + dy * dy <= HIT * HIT ? hit.ref[k] : null;
  }

  let down: { x: number; y: number } | null = null;
  function onMove(ev: PointerEvent) {
    if (ev.pointerType !== 'mouse') return;
    hover = pick(ev);
    if (svgEl) svgEl.style.cursor = hover ? 'pointer' : '';
  }
  function onDown(ev: PointerEvent) {
    down = { x: ev.clientX, y: ev.clientY };
  }
  function onUp(ev: PointerEvent) {
    if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 10) return;
    down = null;
    const h = pick(ev);
    if (!h) {
      pinnedSeat = null;
      return;
    }
    if (h.kind === 'item') {
      cardReturn = null;
      select(M!.nodes[h.i].id);
    } else {
      pinnedSeat = h.j;
      hover = null;
    }
  }

  // ---------------------------------------------------------------- selection and keyboard
  function select(id: string | null) {
    S.sel = id;
    pinnedSeat = null;
    if (id) roving = id;
  }
  const navigable = () => (M ? M.order.filter((e) => matched.has(e.id)) : []);
  function step(d: number) {
    const list = navigable();
    if (!list.length || !S.sel) return;
    const i = list.findIndex((e) => e.id === S.sel);
    const next = list[(i + d + list.length) % list.length];
    select(next.id);
  }
  function markKey(ev: KeyboardEvent, id: string) {
    const list = navigable();
    const i = list.findIndex((e) => e.id === id);
    let next: Item | undefined;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = list[Math.min(list.length - 1, i + 1)];
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = list[Math.max(0, i - 1)];
    else if (ev.key === 'Home') next = list[0];
    else if (ev.key === 'End') next = list[list.length - 1];
    else if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      cardReturn = ev.currentTarget as HTMLElement;
      select(id);
      return;
    } else if (ev.key === 'Escape') {
      select(null);
      return;
    }
    if (next) {
      ev.preventDefault();
      roving = next.id;
      queueMicrotask(() => (svgEl?.querySelector(`[data-id="${next!.id}"]`) as SVGGElement | null)?.focus());
    }
  }
  function closeCard() {
    const id = S.sel;
    select(null);
    const back = cardReturn ?? (id ? (svgEl?.querySelector(`[data-id="${id}"]`) as HTMLElement | null) : null);
    back?.focus();
  }

  // ---------------------------------------------------------------- view tabs
  function setView(v: View) {
    S.v = v;
    hover = null;
    pinnedSeat = null;
    toControls();
  }
  // Bring the controls to the top of the window, so the chart fills the screen below them.
  async function toControls() {
    await tick();
    if (!toolbarEl) return;
    const top = toolbarEl.getBoundingClientRect().top;
    if (Math.abs(top) < 4) return;
    window.scrollTo({ top: scrollY + top, behavior: reduced ? 'auto' : 'smooth' });
  }
  function applyPreset(p: Preset) {
    Object.assign(S, emptyState(), { v: S.v, facet: S.facet, seat: S.seat }, p.state);
    pinnedSeat = null;
    toControls();
  }
  const presetOn = (p: Preset) => !!M && toQuery({ ...S, v: null, sel: null, facet: 'convener', seat: 'day' }, M.meta) === p.query;
  function toggleHint() {
    hintHidden = !hintHidden;
    try {
      localStorage.setItem('unga81.hideTips', hintHidden ? '1' : '');
    } catch {
      /* storage can be unavailable, the choice then lasts for this visit */
    }
  }
  function tabKey(ev: KeyboardEvent) {
    const i = VIEWS.indexOf(view);
    let n = -1;
    if (ev.key === 'ArrowRight') n = (i + 1) % VIEWS.length;
    else if (ev.key === 'ArrowLeft') n = (i - 1 + VIEWS.length) % VIEWS.length;
    else if (ev.key === 'Home') n = 0;
    else if (ev.key === 'End') n = VIEWS.length - 1;
    if (n < 0) return;
    ev.preventDefault();
    setView(VIEWS[n]);
    queueMicrotask(() => document.getElementById(`tab-${VIEWS[n]}`)?.focus());
  }

  // ---------------------------------------------------------------- template helpers
  const ink = '#EFEBE1';
  const hair = '#34464A';
  const seatColor = interpolateRgb(hair, ink);
  const tf = (i: number, _f: number) => `translate(${cur.x[i].toFixed(1)} ${cur.y[i].toFixed(1)}) scale(${cur.k[i].toFixed(3)})`;
  const stf = (j: number, _f: number) =>
    `translate(${scur.x[j].toFixed(1)} ${scur.y[j].toFixed(1)}) rotate(${scur.r[j].toFixed(1)}) scale(${scur.k[j].toFixed(3)})`;
  const op = (i: number, _f: number, on: boolean) => (cur.o[i] * (on ? 1 : 0.12)).toFixed(3);
  const sop = (j: number, _f: number, on: boolean) => (scur.o[j] * (on ? 1 : 0.12)).toFixed(3);
  const sfill = (j: number, _f: number) => seatColor(scur.lit[j]);
  const markLabel = (e: Item) =>
    `${e.title}. ${e.date ? longDate(e.date) : ''}. ${M!.label('conveners', e.conv)}. ${M!.label('types', e.type)}.`;

  function nodeIndex(id: string) {
    return M ? M.nodes.findIndex((n) => n.id === id && n.copy === 0) : -1;
  }

  // Theme mode: hairlines between the copies of the hovered item.
  let copyLinks = $derived.by(() => {
    if (!M || view !== 'constellation' || S.facet !== 'theme' || !hover || hover.kind !== 'item') return '';
    const id = M.nodes[hover.i].id;
    const idxs = M.nodes.map((n, i) => (n.id === id && lay && lay.t.o[i] > 0.5 ? i : -1)).filter((i) => i >= 0);
    if (idxs.length < 2) return '';
    return idxs
      .slice(1)
      .map((i) => `M${lay!.t.x[idxs[0]].toFixed(1)},${lay!.t.y[idxs[0]].toFixed(1)}L${lay!.t.x[i].toFixed(1)},${lay!.t.y[i].toFixed(1)}`)
      .join('');
  });
  let hoverCopies = $derived.by(() => {
    if (!M || !lay || view !== 'constellation' || S.facet !== 'theme' || !hover || hover.kind !== 'item') return [] as number[];
    const id = M.nodes[hover.i].id;
    return M.nodes.map((n, i) => (n.id === id && lay.t.o[i] > 0.5 ? i : -1)).filter((i) => i >= 0);
  });

  // Tooltip content
  let tip = $derived.by(() => {
    if (!M) return null;
    if (pinnedSeat !== null) return { kind: 'seat' as const, s: M.members[pinnedSeat], x: scur.x[pinnedSeat], y: scur.y[pinnedSeat], pinned: true };
    if (!hover) return null;
    if (hover.kind === 'item') {
      const nd = M.nodes[hover.i];
      if (S.sel === nd.id) return null;
      return { kind: 'item' as const, e: nd.item, x: cur.x[hover.i], y: cur.y[hover.i], pinned: false };
    }
    return { kind: 'seat' as const, s: M.members[hover.j], x: scur.x[hover.j], y: scur.y[hover.j], pinned: false };
  });
  const tipStyle = (x: number, y: number) => {
    const left = x > W - 300 ? Math.max(8, x - 300) : x + 16;
    return `left:${left}px;top:${Math.max(0, y + 14)}px`;
  };

  // ---------------------------------------------------------------- search and country
  function chooseSearch(kind: 'country' | 'org' | 'item', value: string) {
    searchOpen = false;
    if (kind === 'item') {
      select(value);
    } else if (kind === 'org') {
      S.q = value;
      S.sel = null;
    } else {
      S.q = value;
      S.sel = null;
      country = value;
    }
  }

  // ---------------------------------------------------------------- save image
  async function save() {
    if (!M || saving) return;
    saving = true;
    try {
      const { saveImage } = await import('../../lib/exporter');
      await saveImage({ M, view, S, W, H, svg: svgEl, size: exportSize, coarse });
    } finally {
      saving = false;
    }
  }

  // ---------------------------------------------------------------- URL state
  let lastQuery = '';
  let lastV: View | null = null;
  $effect(() => {
    if (!M) return;
    const q = toQuery(S, M.meta);
    untrack(() => {
      if (q === lastQuery) return;
      const url = `${location.pathname}${q}${location.hash === '#about' ? '' : location.hash}`;
      if (S.v !== lastV) history.pushState(null, '', url);
      else history.replaceState(null, '', url);
      lastQuery = q;
      lastV = S.v;
    });
  });

  // ---------------------------------------------------------------- Index (prerendered, outside the island)
  $effect(() => {
    const m = M;
    const active = view === 'index';
    const set = matched;
    if (!m || !idx) return;
    idx.update(active, set, S, words);
  });

  // Tell the page which view is showing, so the space reserved for the chart follows it.
  $effect(() => {
    document.documentElement.dataset.view = view;
  });

  // ---------------------------------------------------------------- live summary
  let live = $derived(M ? `${copy.viewNames[view]} view. ${words}` : '');

  onMount(() => {
    reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mq = matchMedia('(min-width: 900px)');
    const cq = matchMedia('(pointer: coarse)');
    wide = mq.matches;
    coarse = cq.matches;
    mq.addEventListener('change', () => (wide = mq.matches));
    cq.addEventListener('change', () => (coarse = cq.matches));
    const measure = () =>
      requestAnimationFrame(() => {
        if (stageEl) W = Math.floor(stageEl.clientWidth);
        vh = innerHeight;
        if (controlsEl) chartOffset = Math.round(controlsEl.offsetHeight) + 8;
      });
    const ro = new ResizeObserver(measure);
    if (stageEl) ro.observe(stageEl);
    if (controlsEl) ro.observe(controlsEl);
    addEventListener('resize', measure);
    measure();
    try {
      hintHidden = localStorage.getItem('unga81.hideTips') === '1';
    } catch {
      /* no storage, keep the tips */
    }
    const io = new IntersectionObserver(([e]) => (pinned = !e.isIntersecting && e.boundingClientRect.top < 0));
    if (toolbarEl) io.observe(toolbarEl);

    fetch(`${base}/data/stage.json`)
      .then((r) => r.json())
      .then((d: StageData) => {
        const model = buildModel(d);
        const ids = new Set(d.events.map((e) => e.id));
        S = fromQuery(location.search, d.meta, ids);
        lastQuery = toQuery(S, d.meta);
        lastV = S.v;
        roving = model.order[0].id;
        if (S.sel) roving = S.sel;
        idx = indexController(model);
        cur = arr(model.nodes.length);
        to = arr(model.nodes.length);
        scur = sarr(model.members.length);
        sto = sarr(model.members.length);
        M = model;
        addEventListener('popstate', () => {
          S = fromQuery(location.search, d.meta, ids);
          lastQuery = toQuery(S, d.meta);
          lastV = S.v;
        });
      });

    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement;
      const typing = t.closest('input, textarea, [contenteditable]');
      if (ev.key === '/' && !typing && !searchOpen) {
        ev.preventDefault();
        searchOpen = true;
      }
    };
    addEventListener('keydown', onKey);
    return () => {
      ro.disconnect();
      io.disconnect();
      removeEventListener('resize', measure);
      removeEventListener('keydown', onKey);
      stop();
    };
  });
</script>

<div class="stage-root">
  <!-- Pinned bar: appears once the toolbar scrolls out of view -->
  <div class="pin" class:on={pinned} inert={!pinned} aria-hidden={!pinned}>
    <div class="wrap pin-in">
      <a class="pin-title" href="#top">{M ? M.meta.headline : initial.headline}</a>
      {#if wide}
        <div class="pin-tabs" role="group" aria-label="Views">
          {#each VIEWS as v}
            <button class="mbtn sm" type="button" aria-pressed={view === v} onclick={() => setView(v)}>{copy.tabs[v]}</button>
          {/each}
        </div>
      {/if}
      <button class="mbtn icon" type="button" onclick={() => (searchOpen = true)} aria-label="Search" aria-haspopup="dialog">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false"
            ><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" /><path
              d="M11.6 11.6L16 16"
              stroke="currentColor"
              stroke-width="1.6"
            /></svg
          >
      </button>
      <button class="mbtn" type="button" aria-expanded={filtersOpen} aria-controls="filters" onclick={() => (filtersOpen = !filtersOpen)}
        >{copy.filter}{#if filtered}<span class="dot" aria-hidden="true"></span>{/if}</button
      >
    </div>
  </div>

  <div class="wrap controls" bind:this={controlsEl}>
    <div class="toolbar" bind:this={toolbarEl}>
      <div class="tabs" role="tablist" aria-label="Views">
        {#each VIEWS as v}
          <button
            class="mbtn tab"
            role="tab"
            id={`tab-${v}`}
            aria-selected={view === v}
            aria-controls={v === 'index' ? 'index' : 'stage-panel'}
            tabindex={view === v ? 0 : -1}
            onclick={() => setView(v)}
            onkeydown={tabKey}>{copy.tabs[v]}</button
          >
        {/each}
      </div>
      <div class="tools">
        <button class="mbtn icon" type="button" onclick={() => (searchOpen = true)} aria-label="Search, or press slash" aria-haspopup="dialog">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false"
            ><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" /><path
              d="M11.6 11.6L16 16"
              stroke="currentColor"
              stroke-width="1.6"
            /></svg
          >
        </button>
        <button class="mbtn" type="button" aria-expanded={filtersOpen} aria-controls="filters" onclick={() => (filtersOpen = !filtersOpen)}
          >{copy.filter}{#if filtered}<span class="dot" aria-hidden="true"></span><span class="sr-only">, filters on</span>{/if}</button
        >
        {#if view !== 'index'}
          <span class="save">
            <button class="mbtn" type="button" onclick={save} disabled={saving || !M}>{saving ? copy.saving : copy.saveImage}</button>
            <span class="sizes" role="group" aria-label="Image size">
              <button class="mbtn sm" type="button" aria-pressed={exportSize === 'portrait'} onclick={() => (exportSize = 'portrait')}>{copy.portrait}</button>
              <button class="mbtn sm" type="button" aria-pressed={exportSize === 'landscape'} onclick={() => (exportSize = 'landscape')}>{copy.landscape}</button>
            </span>
          </span>
        {/if}
      </div>
    </div>

    {#if M}
      <Filters {M} bind:S open={filtersOpen} {wide} onclose={() => (filtersOpen = false)} />
    {/if}

    <div class="info">
      <div class="status">
        <p class="sentence" class:empty={M && matched.size === 0}>{M ? words : initial.words}</p>
        {#if S.q}
          <button class="mbtn sm" type="button" onclick={() => (S.q = '')}>{copy.clear} &ldquo;{S.q}&rdquo;</button>
        {/if}
        <p class="micro method">{M ? copy.methodLine(M.meta) : initial.method}</p>
        {#if !hintHidden}<p class="hint">{coarse ? copy.hintTouch : copy.hint}</p>{/if}
      </div>
      <div class="guide-actions">
        <button class="mbtn sm" type="button" aria-haspopup="dialog" onclick={() => (guideOpen = true)} disabled={!M}>{copy.howTo}</button>
        <button class="mbtn sm" type="button" aria-pressed={hintHidden} onclick={toggleHint}>{hintHidden ? copy.showTips : copy.hideTips}</button>
      </div>
    </div>
    <p class="sr-only" aria-live="polite">{live}</p>

    <div class="starts" role="group" aria-labelledby="starts-title">
      <p class="micro" id="starts-title">{copy.startWith}</p>
      <div class="starts-row">
      <button class="mbtn sm" type="button" aria-haspopup="dialog" onclick={() => (searchOpen = true)}>{copy.starts.country}</button>
      {#each initial.presets as p}
        <a
          class="mbtn sm"
          href={p.query || './'}
          aria-current={presetOn(p) ? 'true' : undefined}
          onclick={(e) => {
            if (!M) return;
            e.preventDefault();
            applyPreset(p);
          }}>{p.label}</a
        >
      {/each}
      </div>
    </div>

    {#if view === 'constellation'}
      <div class="facets" role="group" aria-label="Group items by">
        {#each FACETS as f}
          <button class="mbtn sm" type="button" aria-pressed={S.facet === f} onclick={() => (S.facet = f as Facet)}>{copy.facets[f]}</button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="wrap">
    <div
      class="stage"
      class:hidden={view === 'index'}
      class:fading
      id="stage-panel"
      role="tabpanel"
      aria-labelledby={`tab-${view}`}
      bind:this={stageEl}
    >
      {#if M && lay}
        <p class="sr-only" id="stage-desc">
          {view === 'floor' ? copy.chartSummary.floor(M.st, M.meta) : view === 'pulse' ? copy.chartSummary.pulse(M.st, M.meta) : copy.chartSummary.constellation(copy.facets[S.facet])}
        </p>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <svg
          bind:this={svgEl}
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="group"
          aria-label={`${copy.viewNames[view]} chart`}
          aria-describedby="stage-desc"
          onpointermove={onMove}
          onpointerleave={() => (hover = null)}
          onpointerdown={onDown}
          onpointerup={onUp}
        >
          {@html `<style>${SVG_CSS}</style>`}
          <g class="decor" class:on={decorOn} aria-hidden="true">
            {@html view === 'constellation' ? constDecor : lay.decor}
            {#if view === 'floor'}
              <g transform={`translate(${lay.ox.toFixed(2)} 0) scale(${lay.s.toFixed(4)}) translate(${-FLOOR.crop.x} ${-FLOOR.crop.y})`}>
                {@html bigNumber(bigN)}
              </g>
            {/if}
          </g>
          {#if copyLinks}<path d={copyLinks} class="l-lead" aria-hidden="true" />{/if}
          <g class="seats" aria-hidden="true">
            {#each M.members as s, j (s.order)}
              <rect
                x={-MARK.seatW / 2}
                y={-MARK.seatL / 2}
                width={MARK.seatW}
                height={MARK.seatL}
                rx={MARK.seatW / 2}
                transform={stf(j, frame)}
                fill={sfill(j, frame)}
                opacity={sop(j, frame, seatOn[j])}
                stroke={s.verified ? 'none' : '#7E8B8E'}
                stroke-width={s.verified ? 0 : 0.8}
                stroke-dasharray={s.verified ? undefined : '1.2 1.8'}
                vector-effect="non-scaling-stroke"
              />
            {/each}
          </g>
          <g class="marks">
            {#each M.nodes as n, i (n.key)}
              {@const on = matched.has(n.id)}
              {@const shape = shapeOf(n.item)}
              {@const col = colorOf(M.meta, n.item.conv)}
              {#if n.copy === 0}
                <g
                  class="mark"
                  data-id={n.id}
                  transform={tf(i, frame)}
                  opacity={op(i, frame, on)}
                  role="button"
                  tabindex={on && roving === n.id ? 0 : -1}
                  aria-label={markLabel(n.item)}
                  aria-disabled={!on}
                  onfocus={() => {
                    focused = n.id;
                    roving = n.id;
                  }}
                  onblur={() => (focused = null)}
                  onkeydown={(ev) => markKey(ev, n.id)}
                >
                  {#if shape === 'circle'}<circle r={MARK.eventR} fill={col} />
                  {:else if shape === 'diamond'}<path d="M0,-6.5L6.5,0L0,6.5L-6.5,0Z" fill={col} />
                  {:else if shape === 'square'}<rect x="-5" y="-5" width="10" height="10" fill={col} />
                  {:else}<circle r={MARK.ringR} fill="none" stroke="#7E8B8E" stroke-width={MARK.ringStroke} />{/if}
                  {#if n.item.milestone}<circle r={MARK.milestoneR} fill="none" stroke={ink} stroke-width="1" vector-effect="non-scaling-stroke" />{/if}
                </g>
              {:else}
                <g transform={tf(i, frame)} opacity={op(i, frame, on)} aria-hidden="true">
                  {#if shape === 'circle'}<circle r={MARK.eventR} fill={col} />
                  {:else if shape === 'diamond'}<path d="M0,-6.5L6.5,0L0,6.5L-6.5,0Z" fill={col} />
                  {:else if shape === 'square'}<rect x="-5" y="-5" width="10" height="10" fill={col} />
                  {:else}<circle r={MARK.ringR} fill="none" stroke="#7E8B8E" stroke-width={MARK.ringStroke} />{/if}
                  {#if n.item.milestone}<circle r={MARK.milestoneR} fill="none" stroke={ink} stroke-width="1" vector-effect="non-scaling-stroke" />{/if}
                </g>
              {/if}
            {/each}
          </g>
          <g class="rings" aria-hidden="true" pointer-events="none">
            {#each hoverCopies as i}
              <circle cx={cur.x[i]} cy={cur.y[i]} r="11" fill="none" stroke={ink} stroke-width="1" />
            {/each}
            {#if hover && hover.kind === 'item'}
              <circle cx={cur.x[hover.i]} cy={cur.y[hover.i]} r={Math.max(9, 11 * cur.k[hover.i])} fill="none" stroke={ink} stroke-width="1.5" />
            {/if}
            {#if hover && hover.kind === 'seat'}
              <circle cx={scur.x[hover.j]} cy={scur.y[hover.j]} r={Math.max(8, 10 * scur.k[hover.j])} fill="none" stroke={ink} stroke-width="1.5" />
            {/if}
            {#if pinnedSeat !== null}
              <circle cx={scur.x[pinnedSeat]} cy={scur.y[pinnedSeat]} r={Math.max(8, 10 * scur.k[pinnedSeat])} fill="none" stroke="#F8C534" stroke-width="2" />
            {/if}
            {#if S.sel && nodeIndex(S.sel) >= 0}
              {@const i = nodeIndex(S.sel)}
              <circle cx={cur.x[i]} cy={cur.y[i]} r={Math.max(10, 13 * cur.k[i]) + frame * 0} fill="none" stroke="#F8C534" stroke-width="2" />
            {/if}
            {#if focused && nodeIndex(focused) >= 0}
              {@const i = nodeIndex(focused)}
              <circle cx={cur.x[i]} cy={cur.y[i]} r={Math.max(12, 15 * cur.k[i]) + frame * 0} fill="none" stroke="#F8C534" stroke-width="2" stroke-dasharray="3 2" />
            {/if}
          </g>
        </svg>

        {#if tip}
          <div class="tip" class:pinned={tip.pinned} style={tipStyle(tip.x, tip.y)} role={tip.pinned ? 'dialog' : 'tooltip'} aria-label={tip.kind === 'seat' ? tip.s.country : tip.e.title}>
            {#if tip.kind === 'item'}
              <p class="micro">{tip.e.date ? microDate(tip.e.date) : ''}</p>
              <p class="tt">{tip.e.title}</p>
              <p class="sw ui">
                <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true">
                  {#if shapeOf(tip.e) === 'ring'}<circle r="4.5" fill="none" stroke="#7E8B8E" stroke-width="1.8" />{:else}<circle r="5.5" fill={colorOf(M.meta, tip.e.conv)} />{/if}
                </svg>
                {M.label('conveners', tip.e.conv)}
              </p>
              <p class="meta-line">{M.label('platforms', tip.e.platform)}. {M.label('types', tip.e.type)}. {M.label('locations', tip.e.loc)}.</p>
            {:else}
              {@const s = tip.s as Statement}
              <p class="micro">{microDate(s.date)}</p>
              <p class="tt">{s.country}</p>
              <p class="meta-line">{s.speaker}</p>
              {#if s.raised_ai}
                <p class="gist">{s.ai_gist}</p>
                {#if tip.pinned}<a class="mbtn sm" href={s.transcript_source} target="_blank" rel="noopener">{copy.transcript}</a>{/if}
              {:else if s.statement_url && tip.pinned}
                <a class="mbtn sm" href={s.statement_url} target="_blank" rel="noopener">{copy.statement}</a>
              {/if}
              {#if tip.pinned}
                <button class="mbtn sm close" type="button" onclick={() => (pinnedSeat = null)}>{copy.close}</button>
              {/if}
            {/if}
          </div>
        {/if}
      {:else}
        <div class="placeholder" aria-hidden="true"></div>
      {/if}
    </div>

    {#if M && view === 'floor'}
      <div class="seat-controls">
        <div role="group" aria-label="Seat rows">
          <button class="mbtn sm" type="button" aria-pressed={S.seat === 'day'} onclick={() => (S.seat = 'day' as SeatMode)}>{copy.seatModes.day}</button>
          <button class="mbtn sm" type="button" aria-pressed={S.seat === 'group'} onclick={() => (S.seat = 'group' as SeatMode)}>{copy.seatModes.group}</button>
        </div>
        {#if S.seat === 'group' && lay?.fl}
          <p class="micro">{copy.groupCaption}</p>
          <ol class="groups">
            {#each lay.fl.rows as r}
              <li><span class="ui">{r.label}</span> <span class="micro">{r.lit} of {r.total}</span></li>
            {/each}
          </ol>
        {/if}
        {#if copy.pending(M.st)}<p class="micro pending">{copy.pending(M.st)}</p>{/if}
      </div>
    {/if}

    {#if M && view !== 'index'}
      <Legend {M} bind:S />
    {/if}
  </div>

  {#if M && selItem}
    <Card
      {M}
      item={selItem}
      {coarse}
      {wide}
      onclose={closeCard}
      onprev={() => step(-1)}
      onnext={() => step(1)}
    />
  {/if}
  {#if M && countryObj}
    <CountryCard {M} c={countryObj} {wide} onclose={() => (country = null)} onitem={(id: string) => { country = null; select(id); }} />
  {/if}
  {#if M && guideOpen}
    <HowTo {M} onclose={() => (guideOpen = false)} />
  {/if}
  {#if M && searchOpen}
    <Search {M} onclose={() => (searchOpen = false)} onchoose={chooseSearch} />
  {/if}
</div>

<style>
  :global(html:not([data-view='index'])) .stage-root {
    min-height: 100vh;
  }
  .pin {
    position: fixed;
    inset: 0 0 auto 0;
    z-index: 30;
    background: var(--bg);
    border-bottom: 1px solid var(--hair);
    transform: translateY(-100%);
    visibility: hidden;
    transition:
      transform 0.2s,
      visibility 0.2s;
  }
  .pin.on {
    transform: none;
    visibility: visible;
  }
  .pin-in {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 56px;
  }
  .pin-title {
    font-family: var(--headline);
    font-weight: 800;
    font-stretch: 75%;
    font-size: 22px;
    line-height: 1;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-decoration: none;
    padding: 12px 0;
  }
  .pin-tabs {
    display: flex;
  }
  .pin-tabs .mbtn + .mbtn {
    border-left: 0;
  }
  .info {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 8px 24px;
    padding: 12px 0 8px;
  }
  .info .status {
    flex: 1 1 520px;
    padding: 0;
  }
  .hint {
    margin: 2px 0 0;
    flex: 1 1 100%;
    font-size: 15px;
    color: var(--mute);
  }
  .guide-actions {
    display: flex;
    gap: 6px;
  }
  .starts {
    display: flex;
    align-items: center;
    gap: 6px 10px;
    padding: 0 0 6px;
    min-width: 0;
  }
  .starts p {
    margin: 0;
    white-space: nowrap;
  }
  .starts-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
  }
  /* Phones: presets sit in one row that swipes sideways */
  @media (max-width: 599px) {
    .starts {
      flex-direction: column;
      align-items: stretch;
    }
    .starts-row {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      margin-right: calc(-1 * var(--gutter));
      padding-right: var(--gutter);
    }
    .starts-row::-webkit-scrollbar {
      display: none;
    }
    .starts-row > * {
      flex: none;
    }
    .tools .save .sizes {
      display: none;
    }
  }
  .starts a[aria-current='true'] {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }
  @media (prefers-reduced-motion: reduce) {
    .pin {
      transition: none;
    }
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--hair);
    padding-top: 12px;
  }
  .tabs {
    display: flex;
    flex-wrap: wrap;
  }
  .tabs .tab + .tab {
    border-left: 0;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .save {
    display: inline-flex;
    gap: 8px;
    align-items: center;
  }
  .sizes {
    display: inline-flex;
  }
  .sizes .mbtn + .mbtn {
    border-left: 0;
  }
  :global(.mbtn.sm) {
    font-size: 11px;
    padding: 0 10px;
  }
  .dot {
    width: 7px;
    height: 7px;
    background: var(--focus);
    display: inline-block;
  }
  .status {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 16px;
    padding: 14px 0 6px;
  }
  .sentence {
    margin: 0;
    font-size: 19px;
    flex: 1 1 420px;
  }
  .sentence.empty {
    color: var(--mute);
  }
  .method {
    margin: 0;
    flex: 1 1 100%;
  }
  .facets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px 0 4px;
  }
  .stage {
    position: relative;
    margin-top: 8px;
    transition: opacity 150ms;
    touch-action: manipulation;
  }
  .stage.fading {
    opacity: 0;
  }
  .stage.hidden {
    display: none;
  }
  .stage svg {
    display: block;
    overflow: visible;
    -webkit-tap-highlight-color: transparent;
  }
  .placeholder {
    min-height: 60vh;
  }
  .decor {
    opacity: 0;
    transition: opacity 250ms;
  }
  .decor.on {
    opacity: 1;
  }
  .mark:focus {
    outline: none;
  }
  .tip {
    position: absolute;
    z-index: 5;
    width: 290px;
    background: var(--panel);
    border: 1px solid var(--hair);
    padding: 10px 12px 12px;
    pointer-events: none;
  }
  .tip.pinned {
    pointer-events: auto;
  }
  .tip p {
    margin: 0;
  }
  .tt {
    font-family: var(--display);
    font-weight: 600;
    font-stretch: 87%;
    font-size: 17px;
    line-height: 1.2;
    margin: 2px 0 6px !important;
  }
  .meta-line {
    font-size: 14px;
    color: var(--mute);
  }
  .gist {
    font-size: 15px;
    margin-top: 6px !important;
  }
  .tip .mbtn {
    margin-top: 10px;
    margin-right: 6px;
  }
  .sw {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 15px;
  }
  .seat-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin: 8px 0 4px;
    text-align: center;
  }
  .seat-controls [role='group'] {
    display: flex;
  }
  .seat-controls [role='group'] .mbtn + .mbtn {
    border-left: 0;
  }
  .seat-controls p {
    margin: 0;
  }
  .groups {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px 18px;
    counter-reset: g;
  }
  .groups li {
    counter-increment: g;
    font-size: 15px;
  }
  .groups li::before {
    content: counter(g) ' ';
    font-family: var(--mono);
    font-size: 11px;
    color: var(--micro);
  }
  @media (max-width: 899px) {
    .sentence {
      font-size: 17px;
    }
    .tabs {
      width: 100%;
    }
    .tabs .tab {
      flex: 1 1 auto;
      padding: 0 6px;
      font-size: 11px;
    }
  }
</style>
