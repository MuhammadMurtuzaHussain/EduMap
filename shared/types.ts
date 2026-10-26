export const CATEGORIES = [
  'school', 'library', 'tutoring', 'vocational', 'literacy', 'stem',
  'early-years', 'special-needs', 'study-space', 'digital-access', 'scholarship',
] as const;
export const COSTS = ['free', 'low', 'paid'] as const;
export const AUDIENCES = ['children', 'teens', 'adults', 'all'] as const;

export type Category = (typeof CATEGORIES)[number];
export type Cost = (typeof COSTS)[number];
export type Audience = (typeof AUDIENCES)[number];

export interface Resource {
  id: number;
  name: string;
  category: Category;
  description: string;
  address: string;
  lat: number;
  lng: number;
  cost: Cost;
  languages: string[];
  audience: Audience;
  hours: string;
  website: string;
  source: 'seed' | 'community';
}

export type NewResource = Omit<Resource, 'id' | 'source'>;

export interface Filters {
  q?: string;
  categories?: Category[];
  cost?: Cost;
  audience?: Audience;
  language?: string;
  near?: { lat: number; lng: number; radiusKm: number };
}

export interface AskResult {
  mode: 'gemma' | 'fallback';
  model?: string;
  filters: Filters;
  picks: { id: number; why: string }[];
  results: Resource[];
}
