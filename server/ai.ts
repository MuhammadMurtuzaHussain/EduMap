import { AUDIENCES, CATEGORIES, COSTS, type AskResult, type Filters, type Resource } from '../shared/types.ts';
import { filterResources, haversineKm, heuristicFilters, sanitizeFilters } from '../shared/search.ts';

export interface AiConfig {
  url: string;
  model: string;
  timeoutMs: number;
}

export const defaultAiConfig = (): AiConfig => ({
  url: process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434',
  model: process.env.EDUMAP_MODEL ?? 'gemma4:e4b',
  timeoutMs: Number(process.env.EDUMAP_AI_TIMEOUT_MS ?? 90_000),
});

type Fetch = typeof fetch;

async function chat(cfg: AiConfig, f: Fetch, system: string, user: string, schema: object): Promise<unknown> {
  const res = await f(`${cfg.url}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(cfg.timeoutMs),
    body: JSON.stringify({
      model: cfg.model,
      stream: false,
      think: false,
      format: schema,
      options: { temperature: 0.1 },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const body = (await res.json()) as { message?: { content?: string } };
  return JSON.parse(body.message?.content ?? '');
}

export async function ollamaAvailable(cfg: AiConfig, f: Fetch = fetch): Promise<boolean> {
  try {
    const res = await f(`${cfg.url}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return false;
    const body = (await res.json()) as { models?: { name: string }[] };
    return !!body.models?.some((m) => m.name === cfg.model || m.name.startsWith(`${cfg.model}:`));
  } catch {
    return false;
  }
}

const FILTER_SCHEMA = {
  type: 'object',
  properties: {
    categories: { type: 'array', items: { type: 'string', enum: [...CATEGORIES] } },
    cost: { type: 'string', enum: [...COSTS, 'any'] },
    audience: { type: 'string', enum: [...AUDIENCES, 'any'] },
    language: { type: 'string' },
    keywords: { type: 'string' },
  },
  required: ['categories', 'cost', 'audience', 'language', 'keywords'],
};

const PICKS_SCHEMA = {
  type: 'object',
  properties: {
    picks: {
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'integer' }, why: { type: 'string' } }, required: ['id', 'why'] },
    },
  },
  required: ['picks'],
};

/**
 * Two grounded steps: (1) Gemma turns the question into structured filters, (2) the
 * filters are applied in code, then Gemma explains why the best matches fit. Any id it
 * returns that is not in the matched set is dropped, so it cannot invent places.
 */
export async function ask(
  question: string,
  all: Resource[],
  cfg: AiConfig,
  opts: { near?: { lat: number; lng: number }; fetch?: Fetch } = {},
): Promise<AskResult> {
  const f = opts.fetch ?? fetch;
  const languages = [...new Set(all.flatMap((r) => r.languages))].sort();
  const withNear = (filters: Filters): Filters => (opts.near ? { ...filters, near: { ...opts.near, radiusKm: 25 } } : filters);

  try {
    const raw = await chat(
      cfg, f,
      `You convert a person's question about local education resources into search filters. Use only the allowed values; use "any" or an empty string when the question does not say. Category hints: learning English or reading skills = literacy; coding or robotics = stem; homework or exam help = tutoring; jobs, trades or careers = vocational; free internet or computers = digital-access; funding = scholarship. language: set only if the person wants staff or classes in a specific language (known: ${languages.join(', ')}); it is not the language they want to learn. keywords: at most 2 extra plain words not already covered, or empty.`,
      question,
      FILTER_SCHEMA,
    );
    const filters = sanitizeFilters(raw, languages);
    // Model output is a hint, not a hard constraint: relax the fuzziest filters first until something matches.
    const ladder: Filters[] = [filters, { ...filters, q: undefined }, { ...filters, q: undefined, language: undefined }, { ...filters, q: undefined, language: undefined, audience: undefined }];
    let matched: Resource[] = [];
    let used = filters;
    for (const step of ladder) {
      matched = filterResources(all, withNear(step));
      used = step;
      if (matched.length) break;
    }
    const top = matched.slice(0, 8);
    let picks: AskResult['picks'] = [];
    if (top.length) {
      const listing = top
        .map((r) => `#${r.id} ${r.name} [${r.category}, ${r.cost}, ${r.audience}, ${r.languages.join('/')}] ${r.description}${opts.near ? ` (${haversineKm(opts.near, r).toFixed(1)} km away)` : ''}`)
        .join('\n');
      const out = (await chat(
        cfg, f,
        'You help people find local education resources. Choose up to 3 of the listed resources that best answer the question and give a one-sentence reason for each, using only facts in the listing. Never mention a resource that is not listed.',
        `Question: ${question}\n\nListed resources:\n${listing}`,
        PICKS_SCHEMA,
      )) as { picks?: { id?: unknown; why?: unknown }[] };
      const ids = new Set(top.map((r) => r.id));
      picks = (out.picks ?? [])
        .filter((p): p is { id: number; why: string } => typeof p.id === 'number' && ids.has(p.id) && typeof p.why === 'string')
        .slice(0, 3);
    }
    return { mode: 'gemma', model: cfg.model, filters: used, picks, results: matched };
  } catch {
    const filters = heuristicFilters(question, languages);
    return { mode: 'fallback', filters, picks: [], results: filterResources(all, withNear(filters)) };
  }
}
