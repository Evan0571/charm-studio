export type BagStyle = 'tote' | 'shoulder' | 'mini';
export type XYZ = [number, number, number];

export interface BagAttachmentPose {
  ringBarCenter: XYZ;
  innerContact: XYZ;
  ringRadius: number;
  wireRadius: number;
  ringNormal: XYZ;
}

/** Bag-local Y-up coordinates. The keeper wraps the horizontal top bar of the D. */
export function bagAttachmentPose(style: BagStyle): BagAttachmentPose {
  const ringBarCenter: XYZ = style === 'tote' ? [1.72, .45, .69] : style === 'shoulder' ? [1.55, .40, .70] : [.82, -.16, .525];
  const ringRadius = .14;
  const wireRadius = .022;
  const innerContact: XYZ = [ringBarCenter[0], ringBarCenter[1] - ringRadius + wireRadius, ringBarCenter[2]];
  const ringNormal: XYZ = [0, 0, 1];
  return { ringBarCenter, innerContact, ringRadius, wireRadius, ringNormal };
}

/** The lower inside D-ring surface is where a hanging connector bears weight. */
export function bagAnchor(style: BagStyle): XYZ {
  return bagAttachmentPose(style).innerContact;
}
