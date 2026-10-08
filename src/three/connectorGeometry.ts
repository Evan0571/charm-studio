import * as THREE from 'three';

// A single folded strip with real thickness and a continuous top and bottom bend.
export const LEATHER_BAND = { top: 1.671, bottom: 1.185, radius: .068, thickness: .024, width: .20 };

export function createLeatherBandGeometry() {
  const { top, bottom, radius, thickness, width } = LEATHER_BAND;
  const capsule = (path: THREE.Path, r: number, clockwise: boolean) => {
    path.moveTo(r, bottom);
    path.lineTo(r, top);
    path.absarc(0, top, r, 0, Math.PI, clockwise);
    path.lineTo(-r, bottom);
    path.absarc(0, bottom, r, Math.PI, Math.PI * 2, clockwise);
    path.closePath();
  };
  const shape = new THREE.Shape();
  capsule(shape, radius + thickness / 2, false);
  const hole = new THREE.Path();
  capsule(hole, radius - thickness / 2, false);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, steps: 1, bevelEnabled: true, bevelSize: .002, bevelThickness: .002, bevelSegments: 2, curveSegments: 24 });
  geometry.translate(0, 0, -width / 2);
  geometry.rotateY(Math.PI / 2);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    // Narrow the lower fold so the metal ring can pass around it without cutting leather.
    const taper = THREE.MathUtils.smoothstep(positions.getY(i), 1.22, 1.43);
    positions.setX(i, positions.getX(i) * (.48 + .52 * taper));
  }
  geometry.computeVertexNormals();
  return geometry;
}
