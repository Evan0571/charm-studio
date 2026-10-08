import type { BagStyle } from './bagAttachment';

export const BAG_DEFAULT_COLORS: Record<BagStyle, string> = { tote: '#896247', shoulder: '#e5ded0', mini: '#b7a793' };
export const BAG_COLOR_PRESETS = [
  { name: '奶油白', color: '#eee6d8' },
  { name: '经典黑', color: '#292624' },
  { name: '焦糖棕', color: '#956344' },
  { name: '巧克力', color: '#50362a' },
  { name: '酒红色', color: '#792e42' },
  { name: '鼠尾草绿', color: '#77846d' },
] as const;

export function normalizeBagColor(value: string): string | undefined {
  const hex = value.trim().replace(/^#/, '');
  return /^[a-f\d]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : undefined;
}
