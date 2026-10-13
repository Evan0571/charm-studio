type XYZ = [number, number, number];
type Pose = { position: XYZ; rotation: XYZ; scale?: XYZ };

export const BANANA_POSE: Pose = { position: [.16, -.03, 0], rotation: [0, 0, -.55] };
export const FRUIT_LEAF_POSES: Record<'orange' | 'pear' | 'banana', Pose> = {
  orange: { position: [.008, .378, .006], rotation: [.07, -.14, -.98] },
  pear: { position: [.01, .435, .009], rotation: [.14, -.2, -1.18], scale: [.85, .73, 1] },
  banana: { position: [-.424, .375, .013], rotation: [.15, -.15, -.15], scale: [.62, .54, .75] },
};
