import { Vector3 } from 'three';

export function previewTarget(bag: boolean): [number, number, number] {
  return bag ? [.1, .3, 0] : [0, .05, 0];
}

/** Move camera and orbit center together, retaining the viewing angle at the boundary. */
export function constrainPan(target: Vector3, cameraPosition: Vector3, origin: Vector3, bag: boolean) {
  const offset = target.clone().sub(origin);
  const radius = bag ? 1.85 : 1.35;
  if (offset.lengthSq() <= radius * radius) return;
  const bounded = offset.clampLength(0, radius).add(origin);
  cameraPosition.add(bounded.clone().sub(target));
  target.copy(bounded);
}
