import { CATEGORIES, type Audience, type Category, type Cost, type Filters, type NewResource, type Resource, AUDIENCES, COSTS } from './types.ts';

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const tokenize = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 1);

export function filterResources(all: Resource[], f: Filters): Resource[] {
  const terms = f.q ? tokenize(f.q) : [];
  const scored: { r: Resource; score: number; dist: number }[] = [];
  for (const r of all) {
    if (f.categories?.length && !f.categories.includes(r.category)) continue;
    if (f.cost && r.cost !== f.cost) continue;
    if (f.audience && r.audience !== f.audience && r.audience !== 'all') continue;
    if (f.language && !r.languages.some((l) => l.toLowerCase() === f.language!.toLowerCase())) continue;
    let dist = 0;
    if (f.near) {
      dist = haversineKm(f.near, r);
      if (dist > f.near.radiusKm) continue;
    }
    let score = 0;
    if (terms.length) {
      const hay = tokenize(`${r.name} ${r.description} ${r.category} ${r.address}`);
      for (const t of terms) {
        if (r.name.toLowerCase().includes(t)) score += 3;
        if (hay.includes(t)) score += 1;
      }
      if (score === 0) continue;
    }
    scored.push({ r, score, dist });
  }
  scored.sort((a, b) => b.score - a.score || a.dist - b.dist || a.r.name.localeCompare(b.r.name));
  return scored.map((s) => s.r);
}

const CATEGORY_WORDS: Record<Category, string[]> = {
  school: ['school', 'college', 'academy'],
  library: ['library', 'libraries', 'books'],
  tutoring: ['tutor', 'tutoring', 'homework', 'maths', 'math'],
  vocational: ['vocational', 'trade', 'apprenticeship', 'job', 'career', 'skills'],
  literacy: ['literacy', 'reading', 'esl', 'english class'],
  stem: ['stem', 'coding', 'robotics', 'science', 'programming'],
  'early-years': ['toddler', 'preschool', 'nursery', 'early years', 'kindergarten'],
  'special-needs': ['special needs', 'dyslexia', 'autism', 'disability', 'send', 'accessible'],
  'study-space': ['study space', 'quiet', 'study room', 'desk'],
  'digital-access': ['wifi', 'wi-fi', 'internet', 'computer', 'laptop', 'online access'],
  scholarship: ['scholarship', 'bursary', 'funding', 'grant'],
};

/** Rule-based question parsing, used when no local model is reachable. */
export function heuristicFilters(question: string, knownLanguages: string[]): Filters {
  const q = question.toLowerCase();
  const f: Filters = {};
  const cats = CATEGORIES.filter((c) => CATEGORY_WORDS[c].some((w) => q.includes(w)));
  if (cats.length) f.categories = [...cats];
  if (/\b(free|no cost|cheap|affordable)\b/.test(q)) f.cost = /\b(cheap|affordable)\b/.test(q) && !/\bfree\b/.test(q) ? 'low' : 'free';
  if (/\b(kid|kids|child|children|primary)\b/.test(q)) f.audience = 'children';
  else if (/\b(teen|teens|teenager|secondary|high school)\b/.test(q)) f.audience = 'teens';
  else if (/\b(adult|adults|grown|mature)\b/.test(q)) f.audience = 'adults';
  const lang = knownLanguages.find((l) => new RegExp(`\\b${l.toLowerCase()}\\b`).test(q));
  if (lang) f.language = lang;
  return f;
}

export function sanitizeFilters(raw: unknown, knownLanguages: string[]): Filters {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const f: Filters = {};
  if (Array.isArray(o.categories)) {
    const cats = o.categories.filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c as string));
    if (cats.length) f.categories = cats;
  }
  if ((COSTS as readonly string[]).includes(o.cost as string)) f.cost = o.cost as Cost;
  if ((AUDIENCES as readonly string[]).includes(o.audience as string)) f.audience = o.audience as Audience;
  if (typeof o.language === 'string') {
    const l = knownLanguages.find((k) => k.toLowerCase() === (o.language as string).toLowerCase());
    if (l) f.language = l;
  }
  if (typeof o.keywords === 'string' && o.keywords.trim()) f.q = o.keywords.trim().slice(0, 120);
  return f;
}

export function validateNewResource(body: unknown): { ok: true; value: NewResource } | { ok: false; error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const str = (k: string, max: number) => (typeof b[k] === 'string' ? (b[k] as string).trim().slice(0, max) : '');
  const name = str('name', 120);
  if (name.length < 3) return { ok: false, error: 'name must be at least 3 characters' };
  if (!(CATEGORIES as readonly string[]).includes(b.category as string)) return { ok: false, error: 'invalid category' };
  if (!(COSTS as readonly string[]).includes(b.cost as string)) return { ok: false, error: 'invalid cost' };
  if (!(AUDIENCES as readonly string[]).includes(b.audience as string)) return { ok: false, error: 'invalid audience' };
  const lat = Number(b.lat);
  const lng = Number(b.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { ok: false, error: 'invalid lat' };
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { ok: false, error: 'invalid lng' };
  const website = str('website', 200);
  if (website && !/^https?:\/\//i.test(website)) return { ok: false, error: 'website must start with http(s)://' };
  const languages = (Array.isArray(b.languages) ? b.languages : [])
    .filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
    .map((l) => l.trim().slice(0, 30))
    .slice(0, 8);
  return {
    ok: true,
    value: {
      name, category: b.category as Category, cost: b.cost as Cost, audience: b.audience as Audience,
      description: str('description', 500), address: str('address', 200), lat, lng,
      languages: languages.length ? languages : ['English'], hours: str('hours', 120), website,
    },
  };
}
