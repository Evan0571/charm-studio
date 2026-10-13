import * as THREE from 'three';

// A single folded strip with real thickness and a continuous top and bottom bend.
export const LEATHER_BAND = { top: 1.671, bottom: 1.185, radius: .068, thickness: .024, width: .20 };

/** Follow the rendered strip: the long extruded side is linear between its
 * tapered bottom and full-width top vertices, then follows the curved fold. */
export function leatherBandDetailPoint(y: number, edge: number, face: number, inset: number) {
  const { top, bottom, radius, thickness, width } = LEATHER_BAND;
  const taper = .48 + .52 * THREE.MathUtils.clamp((y - bottom) / (top - bottom), 0, 1);
  const outer = radius + thickness / 2;
  const z = y > top ? Math.sqrt(outer ** 2 - (y - top) ** 2) + .002 : outer + .002;
  return new THREE.Vector3(edge * (width / 2 * taper - inset), y, face * z);
}

export function leatherBandStitchPaths() {
  return [-1, 1].flatMap(face => [-1, 1].flatMap(edge => Array.from({ length: 24 }, (_, i) =>
    Array.from({ length: 4 }, (_, j) => {
      const y = 1.235 + (i + j / 3 * .55) / 24 * .486;
      const point = leatherBandDetailPoint(y, edge, face, .017);
      point.z += face * Math.sin(j / 3 * Math.PI) * .001;
      return point;
    }))));
}

export function leatherBandEdgePaths() {
  return [-1, 1].flatMap(face => [-1, 1].map(edge => Array.from({ length: 60 }, (_, i) => {
    const y = 1.23 + i / 59 * .493;
    const point = leatherBandDetailPoint(y, edge, face, .002);
    point.z -= face * .001;
    return point;
  })));
}

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
