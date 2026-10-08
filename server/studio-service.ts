import { createHash, randomUUID } from 'node:crypto';
import { quoteConfig, validateConfig, validateDesignId, validateIdempotencyKey, validateName, ValidationError } from '../shared/domain';
import type { Order, SavedDesign } from '../shared/types';
import type { Storage } from './storage';
import { validateStylistRequest, type StylistService } from './stylist';

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');

// REST and MCP use one service, including the same AI concurrency/rate limits.
export function createStudioService(storage: Storage, stylist: StylistService) {
  const aiRequests = new Map<string, number[]>();
  const aiPending = new Set<string>();
  return {
    async suggest(owner: string, body: unknown) {
      const request = validateStylistRequest(body);
      if (!stylist.configured()) throw new ValidationError('AI 搭配尚未启用。请在项目根目录 .env 中设置 OPENAI_API_KEY，并重启服务。', 503);
      const now = Date.now();
      for (const [id, times] of aiRequests) if (times.every(time => time < now - 60000)) aiRequests.delete(id);
      const recent = (aiRequests.get(owner) ?? []).filter(time => time > now - 60000);
      if (aiPending.has(owner) || aiPending.size >= 4 || recent.length >= 6 || aiRequests.size >= 1000) throw new ValidationError('AI 正在搭配中，请稍等片刻再试。', 429);
      aiRequests.set(owner, [...recent, now]);
      aiPending.add(owner);
      try { return await stylist.reply(request); } finally { aiPending.delete(owner); }
    },
    async getDesign(owner: string, id: unknown) {
      const design = await storage.getDesign(owner, validateDesignId(id));
      if (!design) throw new ValidationError('没有找到这份设计。', 404);
      return design;
    },
    async saveDesign(owner: string, body: Record<string, unknown>) {
      const config = validateConfig(body.config), name = validateName(body.name);
      let previous: SavedDesign | undefined;
      if (body.id !== undefined) {
        previous = await storage.getDesign(owner, validateDesignId(body.id));
        if (!previous) throw new ValidationError('没有找到这份设计。', 404);
      }
      const now = new Date().toISOString();
      const design: SavedDesign = { id: previous?.id ?? randomUUID(), name, config, createdAt: previous?.createdAt ?? now, updatedAt: now };
      await storage.putDesign(owner, design);
      return { design, created: !previous };
    },
    async createOrder(owner: string, body: Record<string, unknown>) {
      const config = validateConfig(body.config), designName = validateName(body.designName, '我的包挂');
      const key = validateIdempotencyKey(body.idempotencyKey);
      const requestHash = hash(JSON.stringify({ designName, config: { ...config, lockedSlots: [...config.lockedSlots].sort() } }));
      const existing = await storage.getOrderByKey(owner, key);
      if (existing) {
        if (existing.requestHash !== requestHash) throw new ValidationError('这次提交的设计已发生变化，请重新确认订单。', 409);
        return { order: existing.order, created: false };
      }
      const order: Order = { id: randomUUID(), designName, config, quote: quoteConfig(config), status: 'test_confirmed', createdAt: new Date().toISOString() };
      const stored = await storage.createOrder(owner, key, requestHash, order);
      if (stored.requestHash !== requestHash) throw new ValidationError('这次提交的设计已发生变化，请重新确认订单。', 409);
      return { order: stored.order, created: stored.order.id === order.id };
    },
  };
}
export type StudioService = ReturnType<typeof createStudioService>;
