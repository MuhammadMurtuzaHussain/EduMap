import type { AskResult, Filters, NewResource, Resource } from '../shared/types.ts';
import { AUDIENCES, CATEGORIES, COSTS } from '../shared/types.ts';
import { filterResources, heuristicFilters } from '../shared/search.ts';

export interface Meta {
  categories: readonly string[]; costs: readonly string[]; audiences: readonly string[]; languages: string[];
  total: number; readOnly: boolean; static?: boolean; ai: { available: boolean; model: string };
}

/** Set at build time (`npm run build:static`): no server, seed data bundled, keyword search only. */
const STATIC = import.meta.env.VITE_STATIC === '1';

let staticData: Promise<Resource[]> | null = null;
const loadStatic = () =>
  (staticData ??= import('../server/seed.ts').then((m) => m.seedResources.map((r, i): Resource => ({ ...r, id: i + 1, source: 'seed' }))));

const post = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export async function getMeta(): Promise<Meta> {
  if (!STATIC) return (await fetch('/api/meta')).json();
  const all = await loadStatic();
  return {
    categories: CATEGORIES, costs: COSTS, audiences: AUDIENCES,
    languages: [...new Set(all.flatMap((r) => r.languages))].sort(),
    total: all.length, readOnly: true, static: true, ai: { available: false, model: '' },
  };
}

export async function getResources(f: Filters & { category?: string }): Promise<Resource[]> {
  if (STATIC) {
    const { category, ...rest } = f;
    return filterResources(await loadStatic(), { ...rest, categories: category ? (category.split(',') as Filters['categories']) : undefined });
  }
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.category) p.set('category', f.category);
  if (f.cost) p.set('cost', f.cost);
  if (f.audience) p.set('audience', f.audience);
  if (f.language) p.set('language', f.language);
  return (await fetch(`/api/resources?${p}`)).json();
}

export async function askQuestion(question: string): Promise<AskResult> {
  if (STATIC) {
    const all = await loadStatic();
    const filters = heuristicFilters(question, [...new Set(all.flatMap((r) => r.languages))]);
    return { mode: 'fallback', filters, picks: [], results: filterResources(all, filters) };
  }
  return (await post('/api/ask', { question })).json();
}

export async function addResource(body: NewResource): Promise<{ ok: boolean; error?: string }> {
  const res = await post('/api/resources', body);
  return res.ok ? { ok: true } : { ok: false, error: (await res.json()).error };
}
