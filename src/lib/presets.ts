// "Start with" presets: ready made views for first time visitors. Each is also a shareable link.
import type { Meta } from './types';
import type { Stats } from './data';
import { shortDate } from './data';
import { emptyState, toQuery, type State } from './state';
import { copy } from './copy';

export type Preset = { key: string; label: string; state: Partial<State>; query: string };

export function presets(meta: Meta, st: Stats): Preset[] {
  const list: Omit<Preset, 'query'>[] = [
    { key: 'peak', label: copy.starts.peak(shortDate(st.peakDay)), state: { d: [st.peakDay, st.peakDay] } },
    { key: 'hlw', label: copy.starts.hlw, state: { d: [meta.high_level_week.from, meta.high_level_week.to] } },
    { key: 'pga', label: copy.starts.pga, state: { pga: true } },
    { key: 'launch', label: copy.starts.launches, state: { type: ['launch'] } },
    { key: 'education', label: meta.themes.find((t) => t.key === 'education_children')!.label, state: { theme: ['education_children'] } },
  ];
  return list.map((p) => ({ ...p, query: toQuery({ ...emptyState(), ...p.state }, meta) }));
}
