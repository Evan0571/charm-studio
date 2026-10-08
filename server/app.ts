import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { catalog } from '../shared/catalog';
import { quoteConfig, validateConfig, validateDesignId, ValidationError } from '../shared/domain';
import type { Storage } from './storage';
import { createStylistService, type StylistService } from './stylist';
import { createStudioService } from './studio-service';
import { createMcpHttp } from './mcp/http';
import type { McpOptions } from './mcp/auth';
import { visitor } from './visitor';

const ownerOf = (res: Response): string => res.locals.ownerId as string;
function bodyOf(req: Request): Record<string, unknown> {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new ValidationError('请求格式无效。');
  return req.body;
}

export function createApp(storage: Storage, stylist: StylistService = createStylistService(), mcpOptions: McpOptions = {}) {
  const app = express();
  const service = createStudioService(storage, stylist);
  const mcp = createMcpHttp(storage, service, mcpOptions);
  app.disable('x-powered-by');
  app.locals.closeMcp = mcp.close;
  app.use((req, res, next) => {
    if (/^\/(?:\.well-known(?:\/|$)|authorize(?:\/|$)|token(?:\/|$)|register(?:\/|$)|revoke(?:\/|$)|oauth(?:\/|$))/.test(req.path)) mcp.oauthRouter(req, res, next);
    else next();
  });
  app.use('/mcp', mcp.router);
  app.use('/api/mcp', ...mcp.guards);
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      if (origin) {
        try {
          if (new URL(origin).host !== req.get('host')) throw new Error('Origin mismatch');
        } catch { res.status(403).json({ error: '请在本站页面中提交操作。' }); return; }
      }
      if (req.get('sec-fetch-site') === 'cross-site') { res.status(403).json({ error: '不允许跨站提交。' }); return; }
      if (req.method !== 'DELETE' && !req.is('application/json')) { res.status(415).json({ error: '请使用 JSON 格式提交。' }); return; }
    }
    next();
  });
  app.use('/api', express.json({ limit: '48kb' }));
  app.use('/api', cookieParser());
  app.use('/api', visitor);
  app.get('/api/health', async (_req, res) => {
    try {
      await storage.checkHealth();
      res.json({ status: 'ok', storage: storage.kind });
    } catch {
      res.status(503).json({ status: 'error', storage: storage.kind, error: '数据库暂时无法连接，请检查服务端配置。' });
    }
  });
  app.get('/api/catalog', (_req, res) => { res.json(catalog); });
  app.post('/api/mcp/token', (req, res) => { res.json(mcp.issueAccessToken(req, ownerOf(res))); });
  app.get('/api/ai/status', (_req, res) => { res.json({ configured: stylist.configured() }); });
  app.post('/api/ai/design', async (req, res) => {
    res.json(await service.suggest(ownerOf(res), bodyOf(req)));
  });
  app.post('/api/quote', (req, res) => { res.json(quoteConfig(validateConfig(bodyOf(req).config))); });
  app.get('/api/designs', async (_req, res) => { res.json(await storage.listDesigns(ownerOf(res))); });
  app.post('/api/designs', async (req, res) => {
    const saved = await service.saveDesign(ownerOf(res), bodyOf(req));
    res.status(saved.created ? 201 : 200).json(saved.design);
  });
  app.delete('/api/designs/:id', async (req, res) => {
    const deleted = await storage.deleteDesign(ownerOf(res), validateDesignId(req.params.id));
    if (!deleted) throw new ValidationError('没有找到这份设计。', 404);
    res.status(204).end();
  });
  app.get('/api/orders', async (_req, res) => { res.json(await storage.listOrders(ownerOf(res))); });
  app.post('/api/orders', async (req, res) => {
    const saved = await service.createOrder(ownerOf(res), bodyOf(req));
    res.status(saved.created ? 201 : 200).json(saved.order);
  });
  app.use('/api', (_req, res) => { res.status(404).json({ error: '接口不存在。' }); });
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ValidationError) { res.status(error.status).json({ error: error.message }); return; }
    if (error?.type === 'entity.too.large') { res.status(413).json({ error: '设计内容过大。' }); return; }
    if (error instanceof SyntaxError && 'body' in error) { res.status(400).json({ error: 'JSON 格式无效。' }); return; }
    // Database errors may contain record values. Log only safe diagnostic fields.
    console.error('API operation failed', { name: error?.name ?? 'Error', code: error?.code ?? 'unknown' });
    res.status(503).json({ error: '暂时无法连接数据服务，请稍后重试。你的当前设计仍在页面中。' });
  };
  app.use(errorHandler);
  return app;
}
