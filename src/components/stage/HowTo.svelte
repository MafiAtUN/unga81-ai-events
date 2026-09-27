<script lang="ts">
  import { onMount } from 'svelte';
  import type { Model } from './model';
  import { copy } from '../../lib/copy';
  import { swatchSvg } from '../../lib/marks';

  let { M, onclose }: { M: Model; onclose: () => void } = $props();
  const g = copy.guide;
  const opener = document.activeElement as HTMLElement | null;
  let panel = $state<HTMLDivElement | null>(null);
  let heading = $state<HTMLHeadingElement | null>(null);
  const typeShape: Record<string, 'circle' | 'diamond' | 'square'> = { event: 'circle', launch: 'diamond', official: 'square' };

  function close() {
    onclose();
    opener?.focus();
  }
  function key(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      close();
    } else if (ev.key === 'Tab' && panel) {
      const f = [...panel.querySelectorAll<HTMLElement>('a[href], button')];
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (ev.shiftKey && (document.activeElement === first || document.activeElement === heading)) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    }
  }
  onMount(() => heading?.focus({ preventScroll: true }));
</script>

<div class="scrim" onclick={close} aria-hidden="true"></div>
<div class="howto" role="dialog" aria-modal="true" aria-labelledby="howto-title" bind:this={panel} onkeydown={key} tabindex="-1">
  <button class="mbtn sm close" type="button" onclick={close}>{copy.close}</button>
  <h2 id="howto-title" bind:this={heading} tabindex="-1">{g.title}</h2>

  <h3 class="micro">{g.marksHead}</h3>
  <p>{g.marks[0]}</p>
  <p>{g.marks[1]}</p>
  <ul class="key">
    {#each M.meta.conveners as c}
      <li>{@html swatchSvg(c.mark === 'hollow' ? 'ring' : 'circle', c.color ?? '#7E8B8E', 14)} <span>{c.label}</span></li>
    {/each}
  </ul>
  <p>{g.marks[2]}</p>
  <ul class="key">
    {#each M.meta.types as t}
      <li>{@html swatchSvg(typeShape[t.key], '#EFEBE1', 14)} <span>{t.label}</span></li>
    {/each}
  </ul>
  <p>
    <svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true"><circle r="5.5" fill="#009EDB" /><circle r="10" fill="none" stroke="#EFEBE1" stroke-width="1" /></svg>
    {g.marks[3]}
  </p>

  <h3 class="micro">{g.seatsHead}</h3>
  <p class="seats" aria-hidden="true">
    <svg width="120" height="22" viewBox="0 0 120 22">
      {#each [1, 1, 0, 1, 0, 1, 1, 1, 0, 1] as lit, i}
        <rect x={4 + i * 11.5} y="3.5" width="6.5" height="15" rx="3.25" fill={lit ? '#EFEBE1' : '#34464A'} stroke="#7E8B8E" stroke-width="0.8" stroke-dasharray="1.2 1.8" />
      {/each}
    </svg>
  </p>
  {#each g.seats(M.st) as line}<p>{line}</p>{/each}

  <h3 class="micro">{g.viewsHead}</h3>
  <dl>
    {#each g.views as [name, text]}
      <dt class="micro">{name}</dt>
      <dd>{text}</dd>
    {/each}
  </dl>

  <h3 class="micro">{g.exploreHead}</h3>
  {#each g.explore as line}<p>{line}</p>{/each}

  <h3 class="micro">{g.shareHead}</h3>
  {#each g.share as line}<p>{line}</p>{/each}

  <p class="micro foot">{copy.methodLine(M.meta)}</p>
  <p><a class="mbtn sm" href="#about" onclick={() => onclose()}>{copy.about}</a></p>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 85;
    background: rgba(11, 23, 25, 0.72);
  }
  .howto {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 86;
    width: min(520px, 100%);
    overflow-y: auto;
    background: var(--panel);
    border-left: 1px solid var(--hair);
    padding: 16px var(--gutter) 40px;
  }
  .howto:focus,
  h2:focus {
    outline: none;
  }
  .close {
    float: right;
  }
  h2 {
    font-family: var(--headline);
    font-weight: 800;
    font-stretch: 75%;
    font-size: 40px;
    line-height: 0.95;
    margin: 8px 0 12px;
  }
  h3 {
    margin: 26px 0 6px;
    padding-top: 10px;
    border-top: 1px solid var(--hair);
  }
  p,
  dd {
    font-size: 16px;
    margin: 6px 0;
  }
  p svg {
    vertical-align: middle;
    margin-right: 6px;
  }
  .key {
    list-style: none;
    padding: 0;
    margin: 4px 0 10px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 2px 16px;
  }
  .key li {
    display: flex;
    gap: 8px;
    align-items: center;
    font-family: var(--display);
    font-weight: 600;
    font-stretch: 87%;
    font-size: 15px;
  }
  dl {
    margin: 0;
  }
  dt {
    margin-top: 10px;
    color: var(--ink);
  }
  dd {
    margin: 2px 0 0;
  }
  .foot {
    margin-top: 28px;
  }
</style>
