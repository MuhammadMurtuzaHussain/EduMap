import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { AUDIENCES, CATEGORIES, COSTS, type Audience, type Category, type Cost, type Filters } from '../shared/types.ts';
import { filterResources, validateNewResource } from '../shared/search.ts';
import type { Store } from './db.ts';
import { ask, ollamaAvailable, type AiConfig } from './ai.ts';

export interface AppOptions {
  store: Store;
  ai: AiConfig;
  readOnly?: boolean;
  fetch?: typeof fetch;
}

const pick = <T extends string>(allowed: readonly T[], v: string | undefined): T | undefined =>
  allowed.includes(v as T) ? (v as T) : undefined;

export function createApp({ store, ai, readOnly = false, fetch: f = fetch }: AppOptions) {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.get('/api/meta', async (c) => {
    const all = store.all();
    return c.json({
      categories: CATEGORIES, costs: COSTS, audiences: AUDIENCES,
      languages: store.languages(), total: all.length, readOnly,
      ai: { available: await ollamaAvailable(ai, f), model: ai.model },
    });
  });

  app.get('/api/resources', (c) => {
    const q = c.req.query();
    const filters: Filters = {
      q: q.q?.slice(0, 120) || undefined,
      categories: q.category ? q.category.split(',').map((x) => pick(CATEGORIES, x)).filter((x): x is Category => !!x) : undefined,
      cost: pick<Cost>(COSTS, q.cost),
      audience: pick<Audience>(AUDIENCES, q.audience),
      language: q.language || undefined,
    };
    const lat = Number(q.lat);
    const lng = Number(q.lng);
    if (q.lat && q.lng && Number.isFinite(lat) && Number.isFinite(lng)) {
      filters.near = { lat, lng, radiusKm: Math.min(Number(q.radius) || 10, 200) };
    }
    return c.json(filterResources(store.all(), filters));
  });

  app.post('/api/resources', bodyLimit({ maxSize: 16 * 1024 }), async (c) => {
    if (readOnly) return c.json({ error: 'This demo is read-only. Run EduMap locally to add resources.' }, 403);
    const body = await c.req.json().catch(() => null);
    const v = validateNewResource(body);
    if (!v.ok) return c.json({ error: v.error }, 400);
    return c.json(store.insert(v.value), 201);
  });

  app.post('/api/ask', bodyLimit({ maxSize: 4 * 1024 }), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { question?: unknown; lat?: unknown; lng?: unknown };
    const question = typeof body.question === 'string' ? body.question.trim().slice(0, 300) : '';
    if (question.length < 3) return c.json({ error: 'question is required' }, 400);
    const near = Number.isFinite(body.lat) && Number.isFinite(body.lng) ? { lat: Number(body.lat), lng: Number(body.lng) } : undefined;
    return c.json(await ask(question, store.all(), ai, { near, fetch: f }));
  });

  return app;
}
