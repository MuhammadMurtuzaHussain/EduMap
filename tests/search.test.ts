import { describe, expect, it } from 'vitest';
import { filterResources, haversineKm, heuristicFilters, sanitizeFilters, validateNewResource } from '../shared/search.ts';
import { seedResources } from '../server/seed.ts';
import type { Resource } from '../shared/types.ts';

const all: Resource[] = seedResources.map((r, i) => ({ ...r, id: i + 1, source: 'seed' }));
const langs = [...new Set(all.flatMap((r) => r.languages))];

describe('filterResources', () => {
  it('filters by category and cost', () => {
    const out = filterResources(all, { categories: ['library'], cost: 'free' });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((r) => r.category === 'library' && r.cost === 'free')).toBe(true);
  });
  it('audience "all" resources match any audience', () => {
    const out = filterResources(all, { audience: 'adults' });
    expect(out.some((r) => r.audience === 'all')).toBe(true);
    expect(out.every((r) => r.audience === 'adults' || r.audience === 'all')).toBe(true);
  });
  it('ranks name matches first for keyword search', () => {
    expect(filterResources(all, { q: 'robotics' })[0].name).toBe('Spark STEM Studio');
  });
  it('limits by radius', () => {
    const centre = { lat: all[0].lat, lng: all[0].lng };
    const near = filterResources(all, { near: { ...centre, radiusKm: 0.5 } });
    expect(near[0].id).toBe(all[0].id);
    expect(near.length).toBeLessThan(all.length);
  });
});

describe('haversineKm', () => {
  it('is ~111km per degree of latitude', () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1);
  });
});

describe('heuristicFilters', () => {
  it('parses a plain question', () => {
    const f = heuristicFilters('free coding club for kids in Spanish', langs);
    expect(f).toMatchObject({ categories: ['stem'], cost: 'free', audience: 'children', language: 'Spanish' });
  });
});

describe('sanitizeFilters', () => {
  it('drops values the model invented', () => {
    const f = sanitizeFilters({ categories: ['library', 'spaceship'], cost: 'any', audience: 'robots', language: 'Klingon', keywords: ' math ' }, langs);
    expect(f).toEqual({ categories: ['library'], q: 'math' });
  });
});

describe('validateNewResource', () => {
  const ok = { name: 'Test Place', category: 'library', cost: 'free', audience: 'all', lat: 1, lng: 2, languages: ['Urdu'] };
  it('accepts a valid body and defaults language', () => {
    const v = validateNewResource({ ...ok, languages: [] });
    expect(v.ok && v.value.languages).toEqual(['English']);
  });
  it.each([
    [{ ...ok, name: 'x' }], [{ ...ok, category: 'bogus' }], [{ ...ok, lat: 99 }], [{ ...ok, website: 'javascript:alert(1)' }], [null],
  ])('rejects bad input %#', (body) => {
    expect(validateNewResource(body).ok).toBe(false);
  });
});
