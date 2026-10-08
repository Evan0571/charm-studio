import { catalog } from './catalog';
import { translate } from './localization';
import type { DesignConfig, Quote } from './types';

export class ValidationError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = 'ValidationError'; }
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function validateConfig(value: unknown): DesignConfig {
  if (!object(value)) throw new ValidationError('请提供完整的设计。');
  const allowed = ['templateId', 'connectorId', 'cordColor', 'metalTone', 'slots', 'lockedSlots'];
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new ValidationError('设计包含不支持的字段。');
  const template = catalog.templates.find(item => item.id === value.templateId);
  if (!template) throw new ValidationError('请选择有效的基础样式。');
  if (typeof value.connectorId !== 'string' || !template.connectorIds.includes(value.connectorId)) throw new ValidationError('这个挂扣不适用于当前样式。');
  if (!catalog.cordColors.some(color => color.id === value.cordColor)) throw new ValidationError('请选择有效的绳带颜色。');
  if (value.metalTone !== 'gold' && value.metalTone !== 'silver') throw new ValidationError('请选择金色或银色配件。');
  if (!object(value.slots)) throw new ValidationError('设计缺少零件位置。');
  const slots: Record<string, string | null> = {};
  const slotIds = template.slots.map(slot => slot.id);
  if (Object.keys(value.slots).length !== slotIds.length || Object.keys(value.slots).some(id => !slotIds.includes(id))) throw new ValidationError('零件位置与基础样式不匹配。');
  let charmCount = 0;
  for (const slot of template.slots) {
    const partId = value.slots[slot.id];
    if (partId === null) { slots[slot.id] = null; continue; }
    const part = catalog.parts.find(item => item.id === partId);
    if (!part || !slot.categories.includes(part.category)) throw new ValidationError(`${slot.name}的零件不兼容，请重新选择。`);
    if (part.category === 'charm') charmCount++;
    slots[slot.id] = part.id;
  }
  if (!charmCount) throw new ValidationError('请至少选择一个挂饰。');
  if (template.id === 'hero' && !slots.main) throw new ValidationError('今日主角需要一个主挂饰。');
  if (!Array.isArray(value.lockedSlots) || value.lockedSlots.some(id => typeof id !== 'string' || !slotIds.includes(id)) || new Set(value.lockedSlots).size !== value.lockedSlots.length) throw new ValidationError('锁定的位置无效。');
  return { templateId: template.id, connectorId: value.connectorId, cordColor: value.cordColor as string, metalTone: value.metalTone, slots, lockedSlots: [...value.lockedSlots] as string[] };
}

export function quoteConfig(config: DesignConfig): Quote {
  const valid = validateConfig(config);
  const template = catalog.templates.find(item => item.id === valid.templateId)!;
  const connector = catalog.connectors.find(item => item.id === valid.connectorId)!;
  const lines: Quote['lines'] = [
    { id: `base:${template.id}`, name: `${template.name}基础结构`, quantity: 1, unitPrice: template.basePrice, subtotal: template.basePrice },
    { id: `connector:${connector.id}`, name: connector.name, quantity: 1, unitPrice: connector.price, subtotal: connector.price },
  ];
  for (const partId of Object.values(valid.slots)) {
    if (!partId) continue;
    const part = catalog.parts.find(item => item.id === partId)!;
    const existing = lines.find(item => item.id === `part:${part.id}`);
    if (existing) { existing.quantity++; existing.subtotal += part.price; }
    else lines.push({ id: `part:${part.id}`, name: part.name, quantity: 1, unitPrice: part.price, subtotal: part.price });
  }
  return { lines: lines.map(line => ({ ...line, name: translate(line.name, 'en') })), total: lines.reduce((sum, line) => sum + line.subtotal, 0), currency: catalog.currency };
}

export function validateName(value: unknown, fallback?: string): string {
  const name = value === undefined && fallback ? fallback : value;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 50) throw new ValidationError('设计名称应为 1–50 个字符。');
  return name.trim();
}
export function validateDesignId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new ValidationError('设计编号无效。');
  return value;
}
export function validateIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(value)) throw new ValidationError('订单提交标识无效，请重新提交。');
  return value;
}
