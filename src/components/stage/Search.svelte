<script lang="ts">
  import { onMount } from 'svelte';
  import type { Model } from './model';
  import { copy } from '../../lib/copy';
  import { fold, microDate } from '../../lib/data';

  let { M, onclose, onchoose }: { M: Model; onclose: () => void; onchoose: (kind: 'country' | 'org' | 'item', value: string) => void } = $props();

  let q = $state('');
  let active = $state(0);
  let input = $state<HTMLInputElement | null>(null);
  const opener = document.activeElement as HTMLElement | null;

  type R = { kind: 'country' | 'org' | 'item'; value: string; label: string; sub: string };
  let groups = $derived.by(() => {
    const f = fold(q.trim());
    if (!f) return [] as { key: string; head: string; rs: R[] }[];
    const countries: R[] = M.countries
      .filter((c) => c.folded.includes(f))
      .slice(0, 6)
      .map((c) => ({ kind: 'country', value: c.statement.country, label: c.statement.country, sub: microDate(c.statement.date) }));
    const orgs: R[] = M.orgs
      .filter((o) => o.folded.includes(f))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
      .slice(0, 6)
      .map((o) => ({ kind: 'org', value: o.name, label: o.name, sub: `${o.n} ITEMS` }));
    const items: R[] = M.order
      .filter((e) => fold(`${e.title} ${e.organisers}`).includes(f))
      .slice(0, 8)
      .map((e) => ({ kind: 'item', value: e.id, label: e.title, sub: e.date ? microDate(e.date) : '' }));
    return [
      { key: 'countries', head: copy.searchGroups.countries, rs: countries },
      { key: 'orgs', head: copy.searchGroups.organisations, rs: orgs },
      { key: 'items', head: copy.searchGroups.items, rs: items },
    ].filter((g) => g.rs.length);
  });
  let flat = $derived(groups.flatMap((g) => g.rs));
  $effect(() => {
    q;
    active = 0;
  });

  function close() {
    onclose();
    opener?.focus();
  }
  function key(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      close();
    } else if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      active = Math.min(flat.length - 1, active + 1);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      active = Math.max(0, active - 1);
    } else if (ev.key === 'Enter' && flat[active]) {
      ev.preventDefault();
      onchoose(flat[active].kind, flat[active].value);
    } else if (ev.key === 'Tab') {
      ev.preventDefault();
    }
  }
  onMount(() => input?.focus());
  const optId = (r: R) => `opt-${r.kind}-${fold(r.value).replace(/[^a-z0-9]+/g, '-')}`;
</script>

<div class="scrim" onclick={close} aria-hidden="true"></div>
<div class="palette" role="dialog" aria-modal="true" aria-label="Search">
  <div class="row">
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"
      ><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M11.6 11.6L16 16" stroke="currentColor" stroke-width="1.6" /></svg
    >
    <input
      bind:this={input}
      bind:value={q}
      type="text"
      role="combobox"
      aria-expanded={flat.length > 0}
      aria-controls="search-list"
      aria-autocomplete="list"
      aria-activedescendant={flat[active] ? optId(flat[active]) : undefined}
      aria-label={copy.searchPlaceholder}
      placeholder={copy.searchPlaceholder}
      autocomplete="off"
      spellcheck="false"
      onkeydown={key}
    />
    <button class="mbtn sm" type="button" onclick={close}>{copy.close}</button>
  </div>
  <div id="search-list" role="listbox" aria-label="Results">
    {#each groups as g}
      <div role="group" aria-label={g.head}>
        <p class="micro head" aria-hidden="true">{g.head}</p>
        {#each g.rs as r}
          {@const i = flat.indexOf(r)}
          <div
            class="opt"
            class:on={i === active}
            role="option"
            id={optId(r)}
            aria-selected={i === active}
            tabindex="-1"
            onclick={() => onchoose(r.kind, r.value)}
            onkeydown={() => {}}
            onpointermove={() => (active = i)}
          >
            <span class="lab">{r.label}</span>
            <span class="micro">{r.sub}</span>
          </div>
        {/each}
      </div>
    {/each}
    {#if q.trim() && !flat.length}<p class="none">{copy.searchNone}</p>{/if}
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: rgba(11, 23, 25, 0.78);
  }
  .palette {
    position: fixed;
    z-index: 81;
    left: 50%;
    top: 10vh;
    transform: translateX(-50%);
    width: min(640px, calc(100% - 24px));
    max-height: 76vh;
    overflow-y: auto;
    background: var(--panel);
    border: 1px solid var(--hair);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px 6px 14px;
    border-bottom: 1px solid var(--hair);
    position: sticky;
    top: 0;
    background: var(--panel);
  }
  input {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    background: transparent;
    border: 0;
    color: var(--ink);
    font-family: var(--display);
    font-weight: 600;
    font-stretch: 87%;
    font-size: 19px;
  }
  input::placeholder {
    color: var(--mute);
  }
  input:focus {
    outline: none;
  }
  .row:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .head {
    margin: 12px 14px 4px;
  }
  .opt {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    min-height: 44px;
    padding: 10px 14px;
    cursor: pointer;
    border-top: 1px solid var(--hair);
  }
  .opt.on {
    background: var(--bg);
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .lab {
    font-family: var(--display);
    font-weight: 600;
    font-stretch: 87%;
    font-size: 16px;
    line-height: 1.25;
  }
  .none {
    padding: 14px;
    color: var(--mute);
    margin: 0;
  }
</style>
