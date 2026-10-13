import type { DesignConfig, Part } from '../../shared/types';
import { BANANA_POSE } from './fruitAssembly';

export type XYZ = [number, number, number];
export interface StrandSpec {
  id: string; anchor: XYZ; length: number; beadSlot?: string;
  charmSlot: string; scale: number; chain: boolean; linkRotation?: number; supportTilt?: number;
}

export const MAIN_RING = { centerY: 1.46, radius: .32, wire: .039 };
export const LEATHER_LOOP = { topInnerY: 1.727, bottomRingY: 1.08, bottomRadius: .095 };
export const TRANSFER_RING = { centerY: 1.09, radius: .11, wire: .016 };

export function cordLeadPoints(anchor: XYZ): XYZ[] {
  const [x, y, z] = anchor;
  return [[x * .18, .67, z * .4], [x * .8, .625, z], [x, y + .045, z], [x, y, z]];
}

// Chain pivots sit on the supporting ring's wire, rather than alongside it.
// Alternate link planes let the first link pass through the supporting ring.
export function getStrands(config: Pick<DesignConfig, 'templateId' | 'connectorId'>): StrandSpec[] {
  if (config.templateId === 'cord') return [
    { id: 'left', anchor: [-.225, .56, .035], length: 1.13, beadSlot: 'left-bead', charmSlot: 'left-charm', scale: .64, chain: false },
    { id: 'center', anchor: [0, .56, .07], length: 1.77, beadSlot: 'center-bead', charmSlot: 'center-charm', scale: .72, chain: false },
    { id: 'right', anchor: [.225, .56, .005], length: 1.36, beadSlot: 'right-bead', charmSlot: 'right-charm', scale: .62, chain: false },
  ];
  if (config.templateId === 'chain') {
    const edgeY = MAIN_RING.centerY - Math.sqrt(MAIN_RING.radius ** 2 - .27 ** 2);
    return [
      { id: 'left', anchor: [-.27, edgeY, 0], supportTilt: -Math.asin(.27/MAIN_RING.radius), length: 1.49, charmSlot: 'left', scale: .76, chain: true },
      { id: 'center', anchor: [0, MAIN_RING.centerY - MAIN_RING.radius, 0], length: 2.1, charmSlot: 'center', scale: .8, chain: true },
      { id: 'right', anchor: [.27, edgeY, 0], supportTilt: Math.asin(.27/MAIN_RING.radius), length: 1.68, charmSlot: 'right', scale: .76, chain: true },
    ];
  }
  const leather = config.connectorId === 'leather';
  const radius = leather ? LEATHER_LOOP.bottomRadius : TRANSFER_RING.radius;
  const centerY = leather ? LEATHER_LOOP.bottomRingY : TRANSFER_RING.centerY;
  const pivot = (x: number): XYZ => leather ? [x, centerY - Math.sqrt(radius * radius - x * x), 0] : [0, centerY - Math.sqrt(radius * radius - x * x), -x];
  const linkRotation = leather ? Math.PI / 2 : 0;
  return [
    { id: 'main', anchor: pivot(.04), length: .41, charmSlot: 'main', scale: 1.63, chain: true, linkRotation },
    { id: 'accent', anchor: pivot(-.06), length: .35, charmSlot: 'accent', scale: .45, chain: true, linkRotation },
  ];
}

export function partAttachmentPoint(part: Part | undefined): XYZ {
  if (part?.category === 'bead') return [0, .29, 0];
  if (part?.shape === 'pear') return [.03, .505, .005];
  if (part?.shape === 'orange') return [.01, .458, .005];
  if (part?.shape === 'banana') {
    const angle = BANANA_POSE.rotation[2], [x, y] = BANANA_POSE.position;
    return [Math.cos(angle)*-.424-Math.sin(angle)*.386+x, Math.sin(angle)*-.424+Math.cos(angle)*.386+y, 0];
  }
  const top: Record<string, number> = { cupcake: .48, heart: .286, cherry: .38, star: .396, flower: .41, shell: .4 };
  return [0, top[part?.shape ?? ''] ?? .4, 0];
}

export function pendantOffset(part: Part | undefined, spec: StrandSpec) {
  return -spec.length - .035 - partAttachmentPoint(part)[1] * spec.scale;
}

// Both preview modes place the model's hanging eye at the same chain endpoint.
export function pendantPosition(part: Part | undefined, spec: StrandSpec): XYZ {
  const [x, , z] = partAttachmentPoint(part);
  return [-x * spec.scale, pendantOffset(part, spec), -z * spec.scale];
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
