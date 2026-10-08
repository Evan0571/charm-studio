// Dedicated ChatGPT demo process: the host model designs from the catalog.
// No separate model API is exposed through this temporary public endpoint.
import 'dotenv/config';
import express from 'express';
import { resolve } from 'node:path';
import { createApp } from './app';
import { storageFromEnvironment } from './storage';
import { mcpOptionsFromEnvironment } from './mcp/auth';
import { ValidationError } from '../shared/domain';

if (!process.env.MCP_PUBLIC_URL) throw new Error('Start with pnpm chatgpt:connect or configure MCP_PUBLIC_URL.');
const storage = storageFromEnvironment();
const app = createApp(storage, { configured: () => false, reply: async () => { throw new ValidationError('请由当前对话助手读取 loop_get_catalog 并调用 loop_preview_design；此接入不使用额外的 AI API。', 503); } }, mcpOptionsFromEnvironment());
app.use('/assets', (_req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); next(); }, express.static(resolve('public/assets')));
app.use(express.static(resolve('dist')));
app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
const server = app.listen(Number(process.env.PORT || 3004), '127.0.0.1', () => console.log('LOOP ChatGPT endpoint ready.'));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
  server.closeAllConnections(); server.close(() => { app.locals.closeMcp(); storage.close?.(); process.exit(0); });
});
