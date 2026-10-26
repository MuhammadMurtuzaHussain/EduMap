import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync } from 'node:fs';
import { createApp } from './app.ts';
import { Store } from './db.ts';
import { defaultAiConfig, ollamaAvailable } from './ai.ts';

const port = Number(process.env.PORT ?? 3000);
const store = new Store(process.env.EDUMAP_DB ?? 'data/edumap.db');
store.seedIfEmpty();
const ai = defaultAiConfig();
const app = createApp({ store, ai, readOnly: process.env.EDUMAP_READONLY === '1' });

if (existsSync('dist/index.html')) {
  app.use('/*', serveStatic({ root: './dist' }));
} else {
  app.get('/', (c) => c.text('Client not built. Run `npm run build` (or `npm start`).', 503));
}

serve({ fetch: app.fetch, port }, async () => {
  const up = await ollamaAvailable(ai);
  console.log(`EduMap running at http://localhost:${port}`);
  console.log(up ? `AI assistant: ${ai.model} via Ollama` : `AI assistant off (start Ollama and run: ollama pull ${ai.model}). Search still works.`);
});
