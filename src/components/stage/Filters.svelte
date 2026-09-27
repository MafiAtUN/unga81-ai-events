<script lang="ts">
  import type { Model } from './model';
  import { matches, emptyState, type State, type FacetKey } from '../../lib/state';
  import { copy } from '../../lib/copy';
  import { day, longDate, microDate, windowDays } from '../../lib/data';
  import { swatchSvg } from '../../lib/marks';

  let { M, S = $bindable(), open, wide, onclose }: { M: Model; S: State; open: boolean; wide: boolean; onclose: () => void } = $props();

  type ListKey = 'theme' | 'platform' | 'type' | 'loc';
  const groups: { key: ListKey; head: string; opts: { key: string; label: string }[]; field: 'themes' | 'platform' | 'type' | 'loc' }[] = [
    { key: 'theme', head: copy.facetHeads.theme, opts: M.meta.themes, field: 'themes' },
    { key: 'platform', head: copy.facetHeads.platform, opts: M.meta.platforms, field: 'platform' },
    { key: 'type', head: copy.facetHeads.type, opts: M.meta.types, field: 'type' },
    { key: 'loc', head: copy.facetHeads.loc, opts: M.meta.locations, field: 'loc' },
  ];
  const typeShape: Record<string, 'circle' | 'diamond' | 'square'> = { event: 'circle', launch: 'diamond', official: 'square' };

  function count(g: (typeof groups)[number], key: string) {
    return M.events.filter((e) => matches(e, S, g.key as FacetKey) && (g.field === 'themes' ? e.themes.includes(key) : e[g.field] === key)).length;
  }
  function toggle(g: ListKey, key: string) {
    const list = S[g];
    S[g] = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
  }
  let pgaCount = $derived(M.events.filter((e) => matches(e, S, 'pga') && e.pga).length);

  // Date brush
  const days = windowDays(M.meta);
  let dayCounts = $derived(days.map((d) => M.events.filter((e) => e.date === d && matches(e, S, 'd')).length));
  let maxCount = $derived(Math.max(1, ...days.map((d) => M.events.filter((e) => e.date === d).length)));
  let from = $derived(S.d ? days.indexOf(S.d[0]) : 0);
  let to = $derived(S.d ? days.indexOf(S.d[1]) : days.length - 1);
  let track = $state<HTMLDivElement | null>(null);
  let dragFrom: number | null = null;

  function setRange(a: number, b: number) {
    const lo = Math.max(0, Math.min(a, b));
    const hi = Math.min(days.length - 1, Math.max(a, b));
    S.d = lo === 0 && hi === days.length - 1 ? null : [days[lo], days[hi]];
  }
  function cellAt(ev: PointerEvent) {
    const r = track!.getBoundingClientRect();
    return Math.max(0, Math.min(days.length - 1, Math.floor(((ev.clientX - r.left) / r.width) * days.length)));
  }
  function bdown(ev: PointerEvent) {
    if ((ev.target as HTMLElement).closest('[role="slider"]')) return;
    dragFrom = cellAt(ev);
    track!.setPointerCapture(ev.pointerId);
    setRange(dragFrom, dragFrom);
  }
  function bmove(ev: PointerEvent) {
    if (dragFrom === null) return;
    setRange(dragFrom, cellAt(ev));
  }
  function bup() {
    dragFrom = null;
  }
  let handleDrag: 'from' | 'to' | null = null;
  function hdown(ev: PointerEvent, which: 'from' | 'to') {
    handleDrag = which;
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    ev.stopPropagation();
  }
  function hmove(ev: PointerEvent) {
    if (!handleDrag) return;
    const c = cellAt(ev);
    if (handleDrag === 'from') setRange(Math.min(c, to), to);
    else setRange(from, Math.max(c, from));
  }
  function hkey(ev: KeyboardEvent, which: 'from' | 'to') {
    const d = ev.key === 'ArrowRight' || ev.key === 'ArrowUp' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? -1 : 0;
    if (ev.key === 'Home' || ev.key === 'End') {
      ev.preventDefault();
      const edge = ev.key === 'Home' ? 0 : days.length - 1;
      if (which === 'from') setRange(Math.min(edge, to), to);
      else setRange(from, Math.max(edge, from));
      return;
    }
    if (!d) return;
    ev.preventDefault();
    if (which === 'from') setRange(Math.min(from + d, to), to);
    else setRange(from, Math.max(to + d, from));
  }
  const pct = (i: number) => `${(i / days.length) * 100}%`;

  function clear() {
    const keep = { v: S.v, facet: S.facet, seat: S.seat };
    Object.assign(S, emptyState(), keep);
  }

  let sheet = $state<HTMLDivElement | null>(null);
  $effect(() => {
    if (open && !wide) queueMicrotask(() => sheet?.querySelector<HTMLElement>('button')?.focus());
  });
  function sheetKey(ev: KeyboardEvent) {
    if (ev.key === 'Escape') onclose();
  }
</script>

{#if open}
  {#if !wide}<div class="scrim" onclick={onclose} aria-hidden="true"></div>{/if}
  <div
    class="filters"
    class:sheet={!wide}
    id="filters"
    bind:this={sheet}
    role={wide ? 'region' : 'dialog'}
    aria-modal={wide ? undefined : 'true'}
    aria-label="Filters"
    onkeydown={sheetKey}
    tabindex="-1"
  >
    <div class="head">
      <p class="micro">{copy.filter}</p>
      <div class="head-actions">
        <button class="mbtn sm" type="button" onclick={clear}>{copy.clear}</button>
        <button class="mbtn sm" type="button" onclick={onclose}>{copy.close}</button>
      </div>
    </div>

    <p class="micro note">{copy.legendTitle}: use the legend under the chart.</p>

    {#each groups as g}
      <fieldset>
        <legend class="micro">{g.head}</legend>
        <div class="opts">
          {#each g.opts as o}
            {@const n = count(g, o.key)}
            {@const on = S[g.key].includes(o.key)}
            <button class="opt" type="button" aria-pressed={on} disabled={n === 0 && !on} onclick={() => toggle(g.key, o.key)}>
              {#if g.key === 'type'}{@html swatchSvg(typeShape[o.key], '#EFEBE1', 12)}{/if}
              <span class="lab">{o.label}</span>
              <span class="n">{n}</span>
            </button>
          {/each}
        </div>
      </fieldset>
    {/each}

    <fieldset>
      <legend class="micro">{copy.facetHeads.d}</legend>
      <p class="range">
        {#if S.d}{S.d[0] === S.d[1] ? longDate(S.d[0]) : `${day(S.d[0])} to ${longDate(S.d[1])}`}{:else}{copy.allDates.toLowerCase().replace(/^a/, 'A')}{/if}
      </p>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="brush" bind:this={track} onpointerdown={bdown} onpointermove={(e) => (handleDrag ? hmove(e) : bmove(e))} onpointerup={() => { bup(); handleDrag = null; }}>
        {#each days as d, i}
          <div class="cell" class:in={i >= from && i <= to} aria-hidden="true">
            <span class="bar" style={`height:${(dayCounts[i] / maxCount) * 100}%`}></span>
          </div>
        {/each}
        <div class="sel" style={`left:${pct(from)};width:${pct(to - from + 1)}`} aria-hidden="true"></div>
        <span
          class="handle"
          style={`left:${pct(from)}`}
          role="slider"
          tabindex="0"
          aria-label="First day"
          aria-valuemin={day(days[0])}
          aria-valuemax={day(days[days.length - 1])}
          aria-valuenow={day(days[from])}
          aria-valuetext={longDate(days[from])}
          onpointerdown={(e) => hdown(e, 'from')}
          onkeydown={(e) => hkey(e, 'from')}
        ></span>
        <span
          class="handle end"
          style={`left:${pct(to + 1)}`}
          role="slider"
          tabindex="0"
          aria-label="Last day"
          aria-valuemin={day(days[0])}
          aria-valuemax={day(days[days.length - 1])}
          aria-valuenow={day(days[to])}
          aria-valuetext={longDate(days[to])}
          onpointerdown={(e) => hdown(e, 'to')}
          onkeydown={(e) => hkey(e, 'to')}
        ></span>
      </div>
      <div class="ends micro" aria-hidden="true"><span>{microDate(days[0])}</span><span>{microDate(days[days.length - 1])}</span></div>
      {#if S.d}<button class="mbtn sm" type="button" onclick={() => (S.d = null)}>{copy.allDates}</button>{/if}
    </fieldset>

    <fieldset>
      <legend class="micro">{copy.facetHeads.pga}</legend>
      <div class="opts">
        <button class="opt" type="button" aria-pressed={S.pga} onclick={() => (S.pga = !S.pga)}>
          <span class="lab">{copy.pgaToggle}</span><span class="n">{pgaCount}</span>
        </button>
      </div>
    </fieldset>
  </div>
{/if}

<style>
  .filters {
    border: 1px solid var(--hair);
    padding: 12px 16px 16px;
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 4px 28px;
    background: var(--bg);
  }
  .filters:focus {
    outline: none;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 82vh;
    overflow-y: auto;
    z-index: 70;
    margin: 0;
    background: var(--panel);
    border-width: 1px 0 0;
    grid-template-columns: 1fr;
  }
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 65;
    background: rgba(11, 23, 25, 0.72);
  }
  .head {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .head p {
    margin: 0;
    color: var(--ink);
  }
  .head-actions {
    display: flex;
    gap: 6px;
  }
  .note {
    grid-column: 1 / -1;
    margin: 0;
    text-transform: none;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 10px 0 0;
    min-width: 0;
  }
  legend {
    padding: 0;
    margin-bottom: 4px;
  }
  .opts {
    display: flex;
    flex-direction: column;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 4px 0;
    background: none;
    border: 0;
    border-bottom: 1px solid var(--hair);
    text-align: left;
    cursor: pointer;
    font-family: var(--display);
    font-weight: 600;
    font-stretch: 87%;
    font-size: 15px;
    line-height: 1.2;
    color: var(--ink);
  }
  .opt .lab {
    flex: 1;
  }
  .opt .n {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.04em;
    color: var(--micro);
    font-variant-numeric: tabular-nums;
  }
  .opt::before {
    content: '';
    width: 12px;
    height: 12px;
    border: 1px solid var(--micro);
    flex: none;
    order: -1;
  }
  .opt[aria-pressed='true']::before {
    background: var(--ink);
    border-color: var(--ink);
  }
  .opt[aria-pressed='true'] .n {
    color: var(--ink);
  }
  .opt:disabled {
    color: var(--micro);
    cursor: default;
  }
  .opt:disabled::before {
    border-style: dotted;
  }
  .range {
    margin: 0 0 6px;
    font-size: 15px;
  }
  .brush {
    position: relative;
    height: 56px;
    display: flex;
    align-items: flex-end;
    border-bottom: 1px solid var(--hair);
    touch-action: none;
    cursor: crosshair;
    user-select: none;
  }
  .cell {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .bar {
    width: 60%;
    background: var(--hair);
    min-height: 1px;
  }
  .cell.in .bar {
    background: var(--mute);
  }
  .sel {
    position: absolute;
    top: 0;
    bottom: -1px;
    border-top: 2px solid var(--ink);
    border-bottom: 2px solid var(--ink);
    pointer-events: none;
  }
  .handle {
    position: absolute;
    top: 6px;
    width: 44px;
    height: 44px;
    margin-left: -22px;
    cursor: ew-resize;
    touch-action: none;
  }
  .handle::after {
    content: '';
    position: absolute;
    left: 21px;
    top: -6px;
    bottom: -6px;
    width: 2px;
    background: var(--ink);
  }
  .handle:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -8px;
  }
  .ends {
    display: flex;
    justify-content: space-between;
    margin: 4px 0 8px;
  }
</style>
