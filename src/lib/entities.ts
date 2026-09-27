// Organisations named in the `organisers` field, for the Who took part directory and the `o` filter.
// An item belongs to an entity when its organisers field names the entity, as organiser, partner or
// speaker. Text in brackets is ignored, since it holds notes such as "ILO data cited".
// Patterns match the names exactly as the data writes them. Nothing here adds to the data.
import type { Item } from './types';

export interface Entity {
  key: string;
  label: string;
  /** Tests the organisers field, or the title where noted. */
  test: (e: Item) => boolean;
}

const unbracketed = (s: string) => s.replace(/\([^)]*\)?/g, ' ');
const org = (re: RegExp) => (e: Item) => re.test(unbracketed(e.organisers));

export const ENTITY_GROUPS: { key: string; label: string; entities: Entity[] }[] = [
  {
    key: 'un_organs',
    label: 'UN organs and leadership',
    entities: [
      { key: 'pga', label: 'President of the General Assembly', test: (e) => e.pga || org(/\bPGA\d*\b|President of the GA/)(e) },
      { key: 'ga', label: 'General Assembly', test: org(/^General Assembly\b/) },
      { key: 'sg', label: 'Secretary-General', test: org(/(?<!Deputy )Secretary-General|\bSG\b|\bEOSG\b/) },
      { key: 'dsg', label: 'Deputy Secretary-General', test: org(/Deputy Secretary-General/) },
      { key: 'sc', label: 'Security Council', test: (e) => e.conv === 'un_organs' && /Security Council/.test(e.title) },
      { key: 'panel', label: 'Independent International Scientific Panel on AI', test: org(/Scientific Panel on AI/) },
    ],
  },
  {
    key: 'un_system',
    label: 'UN system entities',
    entities: [
      { key: 'itu', label: 'ITU', test: org(/\bITU\b/) },
      { key: 'odet', label: 'ODET', test: org(/\bODET\b/) },
      { key: 'dgc', label: 'DGC', test: org(/\bDGC\b/) },
      { key: 'unesco', label: 'UNESCO', test: org(/\bUNESCO\b/) },
      { key: 'undp', label: 'UNDP', test: org(/\bUNDP\b/) },
      { key: 'unicef', label: 'UNICEF', test: org(/\bUNICEF\b/) },
      { key: 'ilo', label: 'ILO', test: org(/\bILO\b/) },
      { key: 'unwomen', label: 'UN Women', test: org(/\bUN Women\b/) },
      { key: 'worldbank', label: 'World Bank Group', test: org(/\bWorld Bank\b/) },
      { key: 'undesa', label: 'UN DESA', test: org(/\bUN DESA\b/) },
      { key: 'ohchr', label: 'UN Human Rights (OHCHR)', test: (e) => /\bOHCHR\b|\bUN Human Rights\b/.test(e.organisers) },
      { key: 'globalcompact', label: 'UN Global Compact', test: org(/\bUN Global Compact\b/) },
      { key: 'unu', label: 'UN University (UNU)', test: org(/\bUNU\b/) },
      { key: 'who', label: 'WHO', test: org(/\bWHO\b/) },
      { key: 'wipo', label: 'WIPO', test: org(/\bWIPO\b/) },
      { key: 'unido', label: 'UNIDO', test: org(/\bUNIDO\b/) },
      { key: 'undrr', label: 'UNDRR', test: org(/\bUNDRR\b/) },
      { key: 'globalpulse', label: 'UN Global Pulse', test: org(/\bUN Global Pulse\b/) },
      { key: 'oict', label: 'UN OICT', test: org(/\bOICT\b/) },
      { key: 'partnerships', label: 'UN Office for Partnerships', test: org(/\bUN Office for Partnerships\b/) },
      { key: 'iatf', label: 'UN Inter-Agency Task Force on NCDs', test: org(/\bInter-Agency Task Force on NCDs\b/) },
    ],
  },
  {
    key: 'regional',
    label: 'Regional and intergovernmental bodies',
    entities: [
      { key: 'eu', label: 'European Union', test: org(/\bEuropean Commission\b|\bEU Delegation\b|\bEuropean Union\b/) },
      { key: 'afdb', label: 'African Development Bank Group', test: org(/\bAfrican Development Bank\b/) },
      { key: 'pam', label: 'Parliamentary Assembly of the Mediterranean', test: org(/\bParliamentary Assembly of the Mediterranean\b/) },
    ],
  },
];

export const ENTITIES: Entity[] = ENTITY_GROUPS.flatMap((g) => g.entities);
export const ENTITY_KEYS = ENTITIES.map((e) => e.key);
export const entityByKey = new Map(ENTITIES.map((e) => [e.key, e]));
