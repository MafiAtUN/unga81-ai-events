<script lang="ts">
  import type { Model } from './model';
  import { matches, type State } from '../../lib/state';
  import { copy } from '../../lib/copy';
  import { swatchSvg } from '../../lib/marks';

  let { M, S = $bindable() }: { M: Model; S: State } = $props();
  const typeShape: Record<string, 'circle' | 'diamond' | 'square'> = { event: 'circle', launch: 'diamond', official: 'square' };
  const count = (key: string) => M.events.filter((e) => e.conv === key && matches(e, S, 'conv')).length;
  function toggle(key: string) {
    S.conv = S.conv.includes(key) ? S.conv.filter((k) => k !== key) : [...S.conv, key];
  }
</script>

<div class="legend">
  <div role="group" aria-labelledby="legend-title">
    <p class="micro" id="legend-title">{copy.legendTitle}</p>
    <div class="convs">
      {#each M.meta.conveners as c}
        {@const on = S.conv.includes(c.key)}
        <button class="conv" type="button" aria-pressed={on} class:off={S.conv.length > 0 && !on} onclick={() => toggle(c.key)}>
          {@html swatchSvg(c.mark === 'hollow' ? 'ring' : 'circle', c.color ?? '#7E8B8E', 14)}
          <span class="lab">{c.label}</span>
          <span class="n">{count(c.key)}</span>
        </button>
      {/each}
    </div>
  </div>
  <div class="types" aria-label={copy.marksTitle} role="group">
    {#each M.meta.types as t}
      <span class="micro t">{@html swatchSvg(typeShape[t.key], '#96A3A5', 11)} {t.label}</span>
    {/each}
    <span class="micro t"
      ><svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><circle r="3" fill="#96A3A5" /><circle r="6.2" fill="none" stroke="#EFEBE1" stroke-width="1" /></svg> Milestone</span
    >
  </div>
</div>

<style>
  .legend {
    border-top: 1px solid var(--hair);
    margin-top: 14px;
    padding-top: 10px;
  }
  .legend p {
    margin: 0 0 2px;
  }
  .convs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    column-gap: 24px;
  }
  .conv {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    background: none;
    border: 0;
    border-bottom: 1px solid transparent;
    padding: 0;
    cursor: pointer;
    text-align: left;
    font-family: var(--display);
    font-weight: 600;
    font-stretch: 87%;
    font-size: 18px;
    color: var(--ink);
  }
  .conv .n {
    color: var(--mute);
    font-variant-numeric: tabular-nums;
  }
  .conv[aria-pressed='true'] {
    border-bottom-color: var(--ink);
  }
  .conv.off {
    color: var(--mute);
  }
  .conv.off :global(svg) {
    opacity: 0.35;
  }
  .types {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 20px;
    margin-top: 10px;
    padding-bottom: 8px;
  }
  .t {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
</style>
