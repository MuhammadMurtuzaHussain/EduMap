import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { NewResource, Resource } from '../shared/types.ts';
import { seedResources } from './seed.ts';

export class Store {
  private db: DatabaseSync;

  constructor(path = ':memory:') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL,
      address TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
      cost TEXT NOT NULL, languages TEXT NOT NULL, audience TEXT NOT NULL,
      hours TEXT NOT NULL, website TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'community'
    )`);
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM resources').get() as { n: number }).n;
  }

  seedIfEmpty(): void {
    if (this.count() > 0) return;
    for (const r of seedResources) this.insert(r, 'seed');
  }

  insert(r: NewResource, source: Resource['source'] = 'community'): Resource {
    const res = this.db
      .prepare(`INSERT INTO resources (name, category, description, address, lat, lng, cost, languages, audience, hours, website, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(r.name, r.category, r.description, r.address, r.lat, r.lng, r.cost, JSON.stringify(r.languages), r.audience, r.hours, r.website, source);
    return { ...r, id: Number(res.lastInsertRowid), source };
  }

  all(): Resource[] {
    const rows = this.db.prepare('SELECT * FROM resources ORDER BY id').all() as Record<string, unknown>[];
    return rows.map((row) => ({ ...(row as unknown as Resource), languages: JSON.parse(row.languages as string) }));
  }

  languages(): string[] {
    return [...new Set(this.all().flatMap((r) => r.languages))].sort();
  }
}
