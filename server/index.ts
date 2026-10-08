import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import express from 'express';
import { createApp } from './app';
import { storageFromEnvironment } from './storage';

const storage = storageFromEnvironment();
const app = createApp(storage);
const port = Number(process.env.PORT || 3000);
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  app.use(vite.middlewares);
  app.use(async (req, res, next) => {
    try {
      const html = await vite.transformIndexHtml(req.originalUrl, await readFile(resolve('index.html'), 'utf8'));
      res.status(200).type('html').send(html);
    } catch (error) { vite.ssrFixStacktrace(error as Error); next(error); }
  });
}
const server = app.listen(port, process.env.HOST || '127.0.0.1', () => {
  console.log(`LOOP Studio is ready at http://localhost:${port} (${storage.kind} storage)`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(() => { storage.close?.(); process.exit(0); }));
}
