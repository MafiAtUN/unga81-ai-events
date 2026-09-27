// Drives the prerendered Index (outside the island): visibility, filtering, sorting, tabs and CSV.
import type { Model } from '../components/stage/model';
import { seatMatches, type State } from './state';

export function indexController(M: Model) {
  const section = document.getElementById('index');
  if (!section) return { update() {} };
  const tbody = section.querySelector<HTMLTableSectionElement>('#idx-items tbody')!;
  const rows = [...tbody.querySelectorAll<HTMLTableRowElement>('tr')];
  const srows = [...section.querySelectorAll<HTMLTableRowElement>('#idx-statements tbody tr')];
  const count = section.querySelector<HTMLElement>('#index-count')!;
  const byOrder = new Map(M.debate.map((s) => [String(s.order), s]));

  // Tabs inside the Index
  const tabs = [...section.querySelectorAll<HTMLButtonElement>('.index-tabs [role="tab"]')];
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')!)!);
  const showTab = (i: number, focus = false) => {
    tabs.forEach((t, j) => {
      t.setAttribute('aria-selected', String(i === j));
      t.tabIndex = i === j ? 0 : -1;
      panels[j].hidden = i !== j;
    });
    if (focus) tabs[i].focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => showTab(i));
    t.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        ev.preventDefault();
        showTab((i + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length, true);
      }
    });
  });
  showTab(0);

  // Sorting
  let sortKey = 'date';
  let dir = 1;
  const ths = [...section.querySelectorAll<HTMLTableCellElement>('#idx-items th[data-key]')];
  // Sort keys come from the row itself: the date order is the prerendered order, other columns by cell text.
  const col: Record<string, number> = { title: 1, platform: 3, type: 4, loc: 5, org: 7 };
  const val = (r: HTMLTableRowElement, k: string) =>
    k === 'date' ? r.dataset.i!.padStart(4, '0') : k === 'conv' ? r.dataset.conv! : (r.cells[col[k]]?.textContent ?? '').trim();
  const sort = () => {
    const sorted = [...rows].sort((a, b) => {
      const va = val(a, sortKey);
      const vb = val(b, sortKey);
      const c = sortKey === 'conv' ? Number(va) - Number(vb) : va.localeCompare(vb, 'en', { sensitivity: 'base' });
      return c * dir || Number(a.dataset.i) - Number(b.dataset.i);
    });
    tbody.append(...sorted);
    ths.forEach((th) => {
      if (th.dataset.key === sortKey) th.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
  };
  ths.forEach((th) =>
    th.querySelector('button')!.addEventListener('click', () => {
      if (sortKey === th.dataset.key) dir = -dir;
      else {
        sortKey = th.dataset.key!;
        dir = 1;
      }
      sort();
    }),
  );

  // CSV of the filtered items, in the current sort order
  let current = new Set<string>();
  section.querySelector('#csv')!.addEventListener('click', () => {
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['id', 'date', 'title', 'convener', 'platform', 'type', 'where', 'ai_focus', 'themes', 'organisers', 'detail', 'pga_took_part', 'status', 'confidence', 'source', 'milestone'];
    const lines = [head.join(',')];
    for (const r of tbody.querySelectorAll<HTMLTableRowElement>('tr')) {
      const id = r.dataset.id!;
      if (!current.has(id)) continue;
      const e = M.byId.get(id)!;
      lines.push(
        [
          e.id,
          e.date,
          e.title,
          M.label('conveners', e.conv),
          M.label('platforms', e.platform),
          M.label('types', e.type),
          M.label('locations', e.loc),
          e.centrality,
          e.themes.map((t) => M.label('themes', t)).join(' | '),
          e.organisers,
          e.detail,
          e.pga ? 'yes' : 'no',
          e.status,
          e.confidence,
          e.source,
          e.milestone,
        ]
          .map(q)
          .join(','),
      );
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'unga81-ai-items.csv';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  return {
    update(active: boolean, matched: Set<string>, S: State, _words?: string) {
      current = matched;
      section.classList.toggle('is-active', active);
      for (const r of rows) r.classList.toggle('dim', !matched.has(r.dataset.id!));
      for (const r of srows) r.classList.toggle('dim', !seatMatches(byOrder.get(r.dataset.order!)!, S));
      count.textContent = `${matched.size} ITEMS`;
    },
  };
}
