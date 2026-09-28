<script lang="ts">
  import type { Model } from './model';
  import type { Item } from '../../lib/types';
  import { copy } from '../../lib/copy';
  import { longDate, microDate } from '../../lib/data';
  import { colorOf, shapeOf, swatchSvg } from '../../lib/marks';

  let { M, item, coarse, wide, onclose, onprev, onnext }: { M: Model; item: Item; coarse: boolean; wide: boolean; onclose: () => void; onprev: () => void; onnext: () => void } =
    $props();

  let heading = $state<HTMLHeadingElement | null>(null);
  let root = $state<HTMLDivElement | null>(null);
  let shared = $state('');
  let cited = $state(false);
  const sheet = $derived(coarse || !wide);
  const url = $derived(`${M.meta.site}e/${item.id}/`);

  $effect(() => {
    item.id;
    shared = '';
    cited = false;
    queueMicrotask(() => {
      heading?.focus({ preventScroll: true });
      root?.scrollTo({ top: 0 });
    });
  });

  async function share() {
    if (navigator.share && coarse) {
      try {
        await navigator.share({ title: item.title, text: copy.itemLine(M.events.length), url });
        return;
      } catch {
        /* the visitor closed the share sheet */
      }
    }
    await navigator.clipboard?.writeText(url);
    shared = copy.linkCopied;
  }
  async function cite() {
    await navigator.clipboard?.writeText(copy.citation(M.meta));
    cited = true;
  }
  function key(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      onclose();
    }
  }
  // Escape closes the card even when focus has moved back to the chart
  function winkey(ev: KeyboardEvent) {
    if (ev.key !== 'Escape' || document.querySelector('[aria-modal="true"]')) return;
    if ((ev.target as Element | null)?.closest?.('[role="dialog"], .filters')) return;
    onclose();
  }
  let sx: number | null = null;
  let sy = 0;
  function tstart(ev: TouchEvent) {
    sx = ev.touches[0].clientX;
    sy = ev.touches[0].clientY;
  }
  function tend(ev: TouchEvent) {
    if (sx === null) return;
    const dx = ev.changedTouches[0].clientX - sx;
    const dy = ev.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? onnext : onprev)();
  }
  const lab = M.label;
</script>

<svelte:window onkeydown={winkey} />

<div
  bind:this={root}
  class="card"
  class:sheet
  role="dialog"
  aria-modal="false"
  aria-labelledby="card-title"
  tabindex="-1"
  onkeydown={key}
  ontouchstart={tstart}
  ontouchend={tend}
>
  <div class="bar">
    <p class="micro">{item.date ? microDate(item.date) : copy.status[item.status]}{item.status === 'scheduled' ? `  ${copy.status.scheduled.toUpperCase()}` : ''}</p>
    <button class="mbtn sm" type="button" onclick={onclose}>{copy.close}</button>
  </div>
  <h2 id="card-title" bind:this={heading} tabindex="-1">{item.title}</h2>
  <p class="sw">
    {@html swatchSvg(shapeOf(item), colorOf(M.meta, item.conv), 16)}
    <span class="ui">{lab('conveners', item.conv)}</span>
  </p>
  <dl>
    <dt class="micro">{copy.fields.platform}</dt>
    <dd>{lab('platforms', item.platform)}</dd>
    <dt class="micro">{copy.fields.type}</dt>
    <dd>{lab('types', item.type)}</dd>
    <dt class="micro">{copy.fields.loc}</dt>
    <dd>{lab('locations', item.loc)}</dd>
    {#if item.organisers}
      <dt class="micro">{copy.fields.organisers}</dt>
      <dd>{item.organisers}</dd>
    {/if}
    {#if item.milestone}
      <dt class="micro">{copy.fields.milestone}</dt>
      <dd class="callout">{item.milestone}</dd>
    {/if}
    {#if item.detail}
      <dt class="micro">{copy.fields.detail}</dt>
      <dd>{item.detail}</dd>
    {/if}
    <dt class="micro">{copy.fields.themes}</dt>
    <dd>{item.themes.map((t) => lab('themes', t)).join(', ')}</dd>
    <dt class="micro">{copy.fields.status}</dt>
    <dd>{copy.status[item.status]}{item.date ? `, ${longDate(item.date)}` : ''}</dd>
    <dt class="micro">{copy.fields.confidence}</dt>
    <dd>{copy.confidence[item.confidence]}</dd>
    {#if item.pga}
      <dt class="micro">{copy.fields.pga}</dt>
      <dd>Yes</dd>
    {/if}
  </dl>
  <div class="actions">
    <a class="mbtn" href={item.source} target="_blank" rel="noopener">{copy.source}</a>
    <button class="mbtn" type="button" onclick={share}>{shared || copy.shareItem}</button>
    <button class="mbtn" type="button" onclick={cite}>{cited ? copy.copied : copy.copyCitation}</button>
  </div>
  <div class="steps">
    <button class="mbtn sm" type="button" onclick={onprev}>{copy.prev}</button>
    <button class="mbtn sm" type="button" onclick={onnext}>{copy.next}</button>
  </div>
  <p class="sr-only" aria-live="polite">{shared || (cited ? 'Citation copied' : '')}</p>
</div>

<style>
  .card {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(420px, 100%);
    z-index: 40;
    background: var(--panel);
    border-left: 1px solid var(--hair);
    overflow-y: auto;
    padding: 12px 20px 24px;
  }
  .card:focus {
    outline: none;
  }
  .sheet {
    top: auto;
    left: 0;
    width: 100%;
    height: 50vh;
    border-left: 0;
    border-top: 1px solid var(--hair);
    padding: 8px 16px 24px;
  }
  .sheet .bar {
    top: -8px;
    margin: -8px -16px 0;
    padding: 8px 16px 8px;
  }
  .bar {
    position: sticky;
    top: -12px;
    z-index: 1;
    margin: -12px -20px 0;
    padding: 12px 20px 8px;
    background: var(--panel);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .bar p {
    margin: 0;
  }
  h2 {
    font-family: var(--display);
    font-weight: 600;
    font-stretch: 87%;
    font-size: 24px;
    line-height: 1.15;
    margin: 8px 0 10px;
  }
  h2:focus {
    outline: none;
  }

  .sw {
    display: flex;
    gap: 10px;
    align-items: center;
    margin: 0 0 8px;
    font-size: 17px;
  }
  dl {
    margin: 0;
  }
  dt {
    margin-top: 10px;
  }
  dd {
    margin: 0;
    font-size: 16px;
  }
  .callout {
    font-style: italic;
    font-weight: 450;
  }
  .actions,
  .steps {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 18px;
  }
</style>
