export type ConvKey = 'un_organs' | 'un_system' | 'member_states' | 'civil_society' | 'business' | 'not_shown';
export type TypeKey = 'event' | 'launch' | 'official';
export type LocKey = 'new_york' | 'virtual' | 'outside_ny';

export interface Item {
  id: string;
  title: string;
  date: string | null;
  conv: ConvKey;
  platform: string;
  type: TypeKey;
  loc: LocKey;
  centrality: 'dedicated' | 'strand';
  themes: string[];
  organisers: string;
  detail: string;
  pga: boolean;
  status: 'held' | 'ongoing' | 'scheduled' | 'undated';
  confidence: 'official' | 'reported' | 'mixed';
  source: string;
  milestone: string | null;
}

export interface Statement {
  order: number;
  date: string;
  session: string;
  country: string;
  speaker: string;
  group: string;
  member_state: boolean;
  ldc: boolean;
  raised_ai: boolean;
  ai_gist: string | null;
  transcript_source: string;
  statement_url: string | null;
  verified: boolean;
}

export interface Keyed {
  key: string;
  label: string;
  long?: string;
  color?: string;
  mark?: string;
  shape?: string;
}

export interface Meta {
  as_at: string;
  window: { from: string; to: string };
  site: string;
  author: { name: string; title: string; office: string };
  disclaimer: string;
  headline: string;
  deck: string;
  conveners: Keyed[];
  types: Keyed[];
  locations: Keyed[];
  platforms: Keyed[];
  themes: Keyed[];
  debate_groups: Keyed[];
  method: string;
  quotes: { text: string; who: string; date: string; source: string; verified: boolean }[];
  expected: Record<string, number | string>;
  high_level_week: { from: string; to: string };
}

/** A point on the stage. x, y in stage pixels, k is the mark scale. */
export interface Pos {
  x: number;
  y: number;
  k: number;
}
