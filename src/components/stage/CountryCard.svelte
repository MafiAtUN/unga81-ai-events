<script lang="ts">
  import type { Model } from './model';
  import { copy } from '../../lib/copy';
  import { longDate, microDate } from '../../lib/data';
  import { colorOf, shapeOf, swatchSvg } from '../../lib/marks';

  let { M, c, wide, onclose, onitem }: { M: Model; c: Model['countries'][number]; wide: boolean; onclose: () => void; onitem: (id: string) => void } =
    $props();
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  let heading = $state<HTMLHeadingElement | null>(null);
  $effect(() => {
    c.slug;
    queueMicrotask(() => heading?.focus({ preventScroll: true }));
  });
  const s = $derived(c.statement);
</script>

<div
  class="card"
  class:sheet={!wide}
  role="dialog"
  aria-modal="false"
  aria-labelledby="country-title"
  tabindex="-1"
  onkeydown={(ev) => {
    if (ev.key === 'Escape') onclose();
  }}
>
  <div class="bar">
    <p class="micro">{copy.countryStatement}</p>
    <button class="mbtn sm" type="button" onclick={onclose}>{copy.close}</button>
  </div>
  <h2 id="country-title" bind:this={heading} tabindex="-1">{s.country}</h2>
  <p class="micro">{microDate(s.date)}</p>
  <p>{s.speaker}</p>
  {#if s.raised_ai}
    <p class="gist">{s.ai_gist}</p>
    <a class="mbtn sm" href={s.transcript_source} target="_blank" rel="noopener">{copy.transcript}</a>
  {:else if s.statement_url}
    <a class="mbtn sm" href={s.statement_url} target="_blank" rel="noopener">{copy.statement}</a>
  {/if}

  {#if c.items.length}
    <p class="micro head">{copy.countryItems}</p>
    <ul>
      {#each c.items as e}
        <li>
          <button type="button" onclick={() => onitem(e.id)}>
            {@html swatchSvg(shapeOf(e), colorOf(M.meta, e.conv), 14)}
            <span><span class="micro">{e.date ? microDate(e.date) : ''}</span><span class="t">{e.title}</span></span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  {#if c.hasPage}
    <p><a class="mbtn" href={`${base}/country/${c.slug}/`}>{copy.openCountry}</a></p>
  {/if}
  <p class="micro">{longDate(M.meta.as_at)}</p>
</div>

<style>
  .card {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(420px, 100%);
    z-index: 41;
    background: var(--panel);
    border-left: 1px solid var(--hair);
    overflow-y: auto;
    padding: 12px 20px 24px;
  }
  .card:focus,
  h2:focus {
    outline: none;
  }
  .sheet {
    top: auto;
    left: 0;
    width: 100%;
    height: 60vh;
    border-left: 0;
    border-top: 1px solid var(--hair);
    padding: 8px 16px 24px;
  }
  .bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .bar p {
    margin: 0;
  }
  h2 {
    font-family: var(--display);
    font-weight: 800;
    font-stretch: 75%;
    font-size: 40px;
    line-height: 0.95;
    margin: 10px 0 4px;
  }
  .gist {
    font-size: 17px;
  }
  .head {
    margin-top: 22px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li button {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    width: 100%;
    min-height: 44px;
    background: none;
    border: 0;
    border-bottom: 1px solid var(--hair);
    padding: 8px 0;
    text-align: left;
    cursor: pointer;
  }
  li button :global(svg) {
    margin-top: 4px;
    flex: none;
  }
  .t {
    display: block;
    font-family: var(--display);
    font-weight: 600;
    font-stretch: 87%;
    font-size: 16px;
    line-height: 1.25;
  }
</style>
