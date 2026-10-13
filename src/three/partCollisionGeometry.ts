import { Mesh, Object3D, Vector3 } from 'three';

/** Only authored physical surfaces contribute mass; stitching and trim never do. */
export function collectPartColliders(root: Object3D) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const colliders: { vertices: Float32Array; density: number }[] = [];
  root.traverse(object => {
    if (!(object instanceof Mesh) || typeof object.userData.colliderDensity !== 'number') return;
    const positions = object.geometry.getAttribute('position');
    const transform = inverse.clone().multiply(object.matrixWorld);
    const vertices = new Float32Array(positions.count * 3), point = new Vector3();
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(transform).toArray(vertices, i * 3);
    }
    colliders.push({ vertices, density: object.userData.colliderDensity });
  });
  return colliders;
}
