import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app.ts';
import { Store } from '../server/db.ts';
import type { AiConfig } from '../server/ai.ts';
import type { Resource } from '../shared/types.ts';

const ai: AiConfig = { url: 'http://ollama.test', model: 'gemma4:e4b', timeoutMs: 1000 };
const ollamaReply = (obj: unknown) => new Response(JSON.stringify({ message: { content: JSON.stringify(obj) } }));

let store: Store;
beforeEach(() => {
  store = new Store(':memory:');
  store.seedIfEmpty();
});

const json = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('API', () => {
  it('seeds and lists resources with filters', async () => {
    const app = createApp({ store, ai });
    const all = (await (await app.request('/api/resources')).json()) as Resource[];
    expect(all.length).toBe(store.count());
    const free = (await (await app.request('/api/resources?category=stem&cost=free')).json()) as Resource[];
    expect(free.length).toBeGreaterThan(0);
    expect(free.every((r) => r.category === 'stem' && r.cost === 'free')).toBe(true);
  });

  it('adds a community resource, or rejects it when read-only or invalid', async () => {
    const body = { name: 'New Hub', category: 'library', cost: 'free', audience: 'all', lat: 53.48, lng: -2.24, languages: ['English'] };
    const app = createApp({ store, ai });
    const before = store.count();
    const res = await app.request('/api/resources', json(body));
    expect(res.status).toBe(201);
    expect(store.count()).toBe(before + 1);
    expect((await app.request('/api/resources', json({ ...body, cost: 'huge' }))).status).toBe(400);
    const ro = createApp({ store, ai, readOnly: true });
    expect((await ro.request('/api/resources', json(body))).status).toBe(403);
  });

  it('uses Gemma filters and drops picks that are not in the matched set', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const req = JSON.parse(String(init?.body));
      calls.push(req.model);
      if (calls.length === 1) return ollamaReply({ categories: ['stem'], cost: 'free', audience: 'children', language: '', keywords: '' });
      return ollamaReply({ picks: [{ id: 99999, why: 'invented' }, { id: store.all().find((r) => r.name === 'Little Coders Club')!.id, why: 'Free Scratch club for kids.' }] });
    });
    const app = createApp({ store, ai, fetch: fetchMock as unknown as typeof fetch });
    const out = await (await app.request('/api/ask', json({ question: 'free coding for my 9 year old' }))).json();
    expect(out.mode).toBe('gemma');
    expect(out.results.map((r: Resource) => r.name)).toContain('Little Coders Club');
    expect(out.picks).toHaveLength(1);
    expect(out.picks[0].why).toMatch(/Scratch/);
    expect(calls).toEqual(['gemma4:e4b', 'gemma4:e4b']);
  });

  it('relaxes over-specific model filters instead of returning nothing', async () => {
    const fetchMock = vi.fn(async () => ollamaReply({ categories: ['library'], cost: 'free', audience: 'any', language: '', keywords: 'dragons' }));
    const app = createApp({ store, ai, fetch: fetchMock as unknown as typeof fetch });
    const out = await (await app.request('/api/ask', json({ question: 'library with dragons' }))).json();
    expect(out.results.length).toBeGreaterThan(0);
    expect(out.filters.q).toBeUndefined();
  });

  it('falls back to keyword parsing when Ollama is unreachable', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('ECONNREFUSED'); });
    const app = createApp({ store, ai, fetch: fetchMock as unknown as typeof fetch });
    const out = await (await app.request('/api/ask', json({ question: 'free wifi and computers' }))).json();
    expect(out.mode).toBe('fallback');
    expect(out.results.every((r: Resource) => r.category === 'digital-access' && r.cost === 'free')).toBe(true);
    const meta = await (await app.request('/api/meta')).json();
    expect(meta.ai.available).toBe(false);
  });

  it('requires a question', async () => {
    const app = createApp({ store, ai });
    expect((await app.request('/api/ask', json({ question: '' }))).status).toBe(400);
  });
});
