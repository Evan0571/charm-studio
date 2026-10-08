import type { DesignConfig, Part } from '../../shared/types';

export type XYZ = [number, number, number];
export interface StrandSpec {
  id: string; anchor: XYZ; length: number; beadSlot?: string;
  charmSlot: string; scale: number; chain: boolean;
}

export const MAIN_RING = { centerY: 1.46, radius: .32, wire: .039 };
export const LEATHER_LOOP = { topInnerY: 1.739, bottomRingY: 1.08, bottomRadius: .095 };

// Chain pivots sit on the supporting ring's wire, rather than alongside it.
// Alternate link planes let the first link pass through the supporting ring.
export function getStrands(config: Pick<DesignConfig, 'templateId' | 'connectorId'>): StrandSpec[] {
  if (config.templateId === 'cord') return [
    { id: 'left', anchor: [-.225, .56, .035], length: 1.13, beadSlot: 'left-bead', charmSlot: 'left-charm', scale: .64, chain: false },
    { id: 'center', anchor: [0, .56, .07], length: 1.77, beadSlot: 'center-bead', charmSlot: 'center-charm', scale: .72, chain: false },
    { id: 'right', anchor: [.225, .56, .005], length: 1.36, beadSlot: 'right-bead', charmSlot: 'right-charm', scale: .62, chain: false },
  ];
  if (config.templateId === 'chain') {
    const edgeY = MAIN_RING.centerY - Math.sqrt(MAIN_RING.radius ** 2 - .22 ** 2);
    return [
      { id: 'left', anchor: [-.22, edgeY, 0], length: 1.49, charmSlot: 'left', scale: .76, chain: true },
      { id: 'center', anchor: [0, MAIN_RING.centerY - MAIN_RING.radius, 0], length: 2.1, charmSlot: 'center', scale: .8, chain: true },
      { id: 'right', anchor: [.22, edgeY, 0], length: 1.68, charmSlot: 'right', scale: .76, chain: true },
    ];
  }
  const radius = config.connectorId === 'leather' ? LEATHER_LOOP.bottomRadius : .087;
  const centerY = config.connectorId === 'leather' ? LEATHER_LOOP.bottomRingY : 1.09;
  const pivot = (x: number): XYZ => [x, centerY - Math.sqrt(radius * radius - x * x), 0];
  return [
    { id: 'main', anchor: pivot(-.04), length: .41, charmSlot: 'main', scale: 1.63, chain: true },
    { id: 'accent', anchor: pivot(.06), length: .35, charmSlot: 'accent', scale: .45, chain: true },
  ];
}

export function pendantOffset(part: Part | undefined, spec: StrandSpec) {
  const top = part?.category === 'bead' ? .29 : part?.shape === 'pear' ? .5 : part?.shape === 'orange' ? .45 : part?.shape === 'banana' ? .5 : part?.shape === 'cupcake' ? .48 : .4;
  return -spec.length - .035 - top * spec.scale;
}

export const BAG_OFFSET: XYZ = [-.35, 0, -.36];
export const BAG_CHARM_SCALE = .52;
export const MOUNT_LINK = { radius: .06, wire: .012 };

// A perpendicular steel link connects two front-facing rings. A leather loop
// already turns around the bag hardware, and needs no extra metal link.
export function getMountedAssembly(contact: XYZ, connectorId: string) {
  const linkCenter: XYZ = [contact[0], contact[1] - MOUNT_LINK.radius * .56, contact[2]];
  const topInner = connectorId === 'leather' ? LEATHER_LOOP.topInnerY : MAIN_RING.centerY + MAIN_RING.radius - MAIN_RING.wire;
  const contactY = connectorId === 'leather' ? contact[1] : linkCenter[1] - MOUNT_LINK.radius * .75;
  return {
    position: [contact[0] + BAG_OFFSET[0], contactY - topInner * BAG_CHARM_SCALE, contact[2] + BAG_OFFSET[2]] as XYZ,
    linkCenter,
  };
}
