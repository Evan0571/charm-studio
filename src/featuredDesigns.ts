import type { DesignConfig } from '../shared/types';
import type { BagStyle } from './three/bagAttachment';

export interface FeaturedDesign {
  id: string;
  name: { en: string; zh: string };
  description: { en: string; zh: string };
  config: DesignConfig;
  /** A rendered still of this exact configuration, using the studio models. */
  image: string;
  bagStyle: BagStyle;
}

export const featuredDesigns: FeaturedDesign[] = [
  {
    id: 'cocoa-trio',
    name: { en: 'Cocoa Trio', zh: '可可三重奏' },
    description: { en: 'Cocoa cord, warm wood and a green pear. A quiet touch of nature.', zh: '可可色编绳、暖木圆珠与青梨，为日常添一点自然。' },
    config: {
      templateId: 'cord', connectorId: 'leather', cordColor: 'cocoa', metalTone: 'gold',
      slots: { 'left-bead': 'wood', 'left-charm': null, 'center-bead': 'pearl', 'center-charm': 'pear', 'right-bead': 'wood', 'right-charm': 'shell' },
      lockedSlots: [],
    },
    image: '/assets/collection/cocoa-trio.jpg',
    bagStyle: 'tote',
  },
  {
    id: 'golden-hour',
    name: { en: 'Golden Hour', zh: '金色时刻' },
    description: { en: 'A stitched leather banana, a soft pearl and a little sunshine.', zh: '绣线皮革香蕉与柔光珍珠，带上一点明亮好心情。' },
    config: {
      templateId: 'hero', connectorId: 'leather', cordColor: 'cream', metalTone: 'gold',
      slots: { main: 'banana', accent: 'pearl' }, lockedSlots: [],
    },
    image: '/assets/collection/golden-hour.jpg',
    bagStyle: 'tote',
  },
  {
    id: 'silver-notes',
    name: { en: 'Silver Notes', zh: '银色音符' },
    description: { en: 'Polished silver, a pocket star and luminous pearls. Light, understated, yours.', zh: '月光银链、口袋星光与珍珠，轻盈的日常细节。' },
    config: {
      templateId: 'chain', connectorId: 'ring', cordColor: 'cream', metalTone: 'silver',
      slots: { left: 'pearl', center: 'star', right: 'pearl' }, lockedSlots: [],
    },
    image: '/assets/collection/silver-notes.jpg',
    bagStyle: 'shoulder',
  },
];
