import type { Catalog, DesignConfig, TemplateId } from './types';

// USD unit prices are the original CNY prices divided by 7, rounded to whole dollars.
// Quotes sum these rounded unit prices so displayed line items always match the total.
export const catalog: Catalog = {
  currency: 'USD',
  templates: [
    { id: 'cord', name: '三重奏', subtitle: '编绳 · 三股垂坠', description: '把喜欢的颜色、珠子和小物，串成只属于你的节奏。', basePrice: 4,
      connectorIds: ['ring', 'leather'],
      slots: [
        { id: 'left-bead', name: '左侧珠子', categories: ['bead'] },
        { id: 'left-charm', name: '左侧挂饰', categories: ['charm'] },
        { id: 'center-bead', name: '中间珠子', categories: ['bead'] },
        { id: 'center-charm', name: '中间挂饰', categories: ['charm'] },
        { id: 'right-bead', name: '右侧珠子', categories: ['bead'] },
        { id: 'right-charm', name: '右侧挂饰', categories: ['charm'] },
      ] },
    { id: 'chain', name: '小小交响', subtitle: '金属链 · 自由组合', description: '长短交错的链条，让小巧的细节自在碰撞。', basePrice: 5,
      connectorIds: ['ring'],
      slots: [
        { id: 'left', name: '左侧挂饰', categories: ['bead', 'charm'] },
        { id: 'center', name: '中间挂饰', categories: ['charm'] },
        { id: 'right', name: '右侧挂饰', categories: ['bead', 'charm'] },
      ] },
    { id: 'hero', name: '今日主角', subtitle: '单品 · 一眼心动', description: '一件让你开心的小物，就是今天出门的好理由。', basePrice: 3,
      connectorIds: ['ring', 'leather'],
      slots: [
        { id: 'main', name: '主挂饰', categories: ['charm'] },
        { id: 'accent', name: '点缀', categories: ['bead', 'charm'] },
      ] },
  ],
  connectors: [
    { id: 'ring', name: '经典圆环', price: 2 },
    { id: 'leather', name: '皮革挂带', price: 3 },
  ],
  cordColors: [
    { id: 'sage', name: '鼠尾草绿', hex: '#99A98D' },
    { id: 'cream', name: '燕麦奶白', hex: '#E5D8BE' },
    { id: 'rose', name: '雾感玫瑰', hex: '#CA929A' },
    { id: 'cocoa', name: '可可棕', hex: '#956B50' },
    { id: 'ink', name: '午夜蓝', hex: '#41495C' },
  ],
  parts: [
    { id: 'banana', name: '慢熟香蕉', category: 'charm', price: 5, color: '#EDC74B', shape: 'banana', material: '绣线皮革', tags: ['活泼', '水果', '暖色'] },
    { id: 'orange', name: '一颗甜橙', category: 'charm', price: 4, color: '#EF964C', shape: 'orange', material: '绣线皮革', tags: ['活泼', '水果', '暖色'] },
    { id: 'pear', name: '青梨假日', category: 'charm', price: 4, color: '#A6BA65', shape: 'pear', material: '绣线皮革', tags: ['清新', '水果', '自然'] },
    { id: 'cupcake', name: '草莓小蛋糕', category: 'charm', price: 5, color: '#DEA2AA', shape: 'cupcake', material: '皮革', tags: ['甜美', '甜点', '粉色'] },
    { id: 'cherry', name: '双生樱桃', category: 'charm', price: 4, color: '#BD5F63', shape: 'cherry', material: '绣线皮革', tags: ['活泼', '水果', '红色'] },
    { id: 'star', name: '口袋星光', category: 'charm', price: 2, color: '#D6B87A', shape: 'star', material: '抛光合金', tags: ['简约', '优雅', '金属'] },
    { id: 'heart', name: '一点心意', category: 'charm', price: 3, color: '#CD8A94', shape: 'heart', material: '珐琅合金', tags: ['甜美', '粉色'] },
    { id: 'shell', name: '海边来信', category: 'charm', price: 3, color: '#E8D8C4', shape: 'shell', material: '珠光树脂', tags: ['自然', '优雅', '奶白'] },
    { id: 'flower', name: '小朵春天', category: 'charm', price: 3, color: '#ECE3CD', shape: 'flower', material: '珐琅合金', tags: ['清新', '花朵', '奶白'] },
    { id: 'pearl', name: '柔光珍珠', category: 'bead', price: 2, color: '#E8E3D5', shape: 'pearl', material: '仿珍珠', tags: ['优雅', '简约', '奶白'] },
    { id: 'amethyst', name: '雾紫晶珠', category: 'bead', price: 2, color: '#AC98C2', shape: 'amethyst', material: '玻璃', tags: ['优雅', '紫色'] },
    { id: 'jade', name: '青苔玉珠', category: 'bead', price: 2, color: '#9FB8A0', shape: 'jade', material: '树脂', tags: ['自然', '清新', '绿色'] },
    { id: 'clear', name: '晨露透珠', category: 'bead', price: 1, color: '#D7E7E5', shape: 'clear', material: '玻璃', tags: ['简约', '清新', '透明'] },
    { id: 'wood', name: '暖木圆珠', category: 'bead', price: 1, color: '#BC9774', shape: 'wood', material: '榉木', tags: ['自然', '暖色', '简约'] },
  ],
};

export function createDefaultConfig(templateId: TemplateId = 'cord'): DesignConfig {
  const defaults: Record<TemplateId, Record<string, string | null>> = {
    cord: { 'left-bead': 'pearl', 'left-charm': 'flower', 'center-bead': 'jade', 'center-charm': 'pear', 'right-bead': 'clear', 'right-charm': 'star' },
    chain: { left: 'pearl', center: 'star', right: 'cherry' },
    hero: { main: 'banana', accent: 'pearl' },
  };
  return { templateId, connectorId: templateId === 'hero' ? 'leather' : 'ring', cordColor: 'sage', metalTone: 'gold', slots: { ...defaults[templateId] }, lockedSlots: [] };
}
