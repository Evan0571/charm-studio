import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { catalog } from '../shared/catalog';
import { quoteConfig, validateConfig, validateDesignId, validateIdempotencyKey, validateName, ValidationError } from '../shared/domain';
import type { Order, SavedDesign } from '../shared/types';
import type { Storage } from './storage';

const cookieName = 'loop_guest';
const ownerOf = (res: Response): string => res.locals.ownerId as string;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function bodyOf(req: Request): Record<string, unknown> {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new ValidationError('请求格式无效。');
  return req.body;
}

export function createApp(storage: Storage) {
  const app = express();
  app.disable('x-powered-by');
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
  app.use('/api', (req, res, next) => {
    let token = req.cookies?.[cookieName];
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
      token = randomBytes(32).toString('hex');
      res.cookie(cookieName, token, { httpOnly: true, sameSite: 'lax', secure: req.secure || process.env.COOKIE_SECURE === 'true', maxAge: 1000 * 60 * 60 * 24 * 365, path: '/' });
    }
    res.locals.ownerId = hash(token);
    next();
  });
  app.get('/api/health', async (_req, res) => {
    try {
      await storage.checkHealth();
      res.json({ status: 'ok', storage: storage.kind });
    } catch {
      res.status(503).json({ status: 'error', storage: storage.kind, error: '数据库暂时无法连接，请检查服务端配置。' });
    }
  });
  app.get('/api/catalog', (_req, res) => { res.json(catalog); });
  app.post('/api/quote', (req, res) => { res.json(quoteConfig(validateConfig(bodyOf(req).config))); });
  app.get('/api/designs', async (_req, res) => { res.json(await storage.listDesigns(ownerOf(res))); });
  app.post('/api/designs', async (req, res) => {
    const body = bodyOf(req);
    const owner = ownerOf(res);
    const config = validateConfig(body.config);
    const name = validateName(body.name);
    let previous: SavedDesign | undefined;
    if (body.id !== undefined) {
      previous = await storage.getDesign(owner, validateDesignId(body.id));
      if (!previous) throw new ValidationError('没有找到这份设计。', 404);
    }
    const now = new Date().toISOString();
    const design: SavedDesign = { id: previous?.id ?? randomUUID(), name, config, createdAt: previous?.createdAt ?? now, updatedAt: now };
    await storage.putDesign(owner, design);
    res.status(previous ? 200 : 201).json(design);
  });
  app.delete('/api/designs/:id', async (req, res) => {
    const deleted = await storage.deleteDesign(ownerOf(res), validateDesignId(req.params.id));
    if (!deleted) throw new ValidationError('没有找到这份设计。', 404);
    res.status(204).end();
  });
  app.get('/api/orders', async (_req, res) => { res.json(await storage.listOrders(ownerOf(res))); });
  app.post('/api/orders', async (req, res) => {
    const body = bodyOf(req);
    const config = validateConfig(body.config);
    const designName = validateName(body.designName, '我的包挂');
    const key = validateIdempotencyKey(body.idempotencyKey);
    const owner = ownerOf(res);
    const requestHash = hash(JSON.stringify({ designName, config: { ...config, lockedSlots: [...config.lockedSlots].sort() } }));
    const existing = await storage.getOrderByKey(owner, key);
    if (existing) {
      if (existing.requestHash !== requestHash) throw new ValidationError('这次提交的设计已发生变化，请重新确认订单。', 409);
      res.json(existing.order); return;
    }
    const order: Order = { id: randomUUID(), designName, config, quote: quoteConfig(config), status: 'test_confirmed', createdAt: new Date().toISOString() };
    const stored = await storage.createOrder(owner, key, requestHash, order);
    if (stored.requestHash !== requestHash) throw new ValidationError('这次提交的设计已发生变化，请重新确认订单。', 409);
    res.status(stored.order.id === order.id ? 201 : 200).json(stored.order);
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
