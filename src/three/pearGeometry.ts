import { SphereGeometry, Vector3 } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { surfaceStitchPaths } from './leatherGeometry';

export const PEAR = { height: .425, radius: .278, depth: .72, seamRadius: .932 };

/** A continuous pear profile: full lower belly, gently narrowing shoulder,
 * rounded neck and base. No straight lathe segments or flat bottom disk. */
export function pearSurface(radius: number, angle: number, side = 1) {
  const ny = radius * Math.sin(angle), nx = radius * Math.cos(angle);
  // A softly concave shoulder makes the short neck distinct from the belly.
  const shoulder = -.10 * Math.exp(-(((ny - .5) / .20) ** 2));
  const neck = .06 * Math.exp(-(((ny - .8) / .13) ** 2));
  const width = PEAR.radius * (1 - .5 * ny + shoulder + neck);
  const inset = .0028 * Math.exp(-(((radius - PEAR.seamRadius) / .022) ** 2));
  return new Vector3(width * nx, PEAR.height * ny,
    side * (width * PEAR.depth * Math.sqrt(Math.max(0, 1 - radius * radius)) - inset));
}

export function createPearBodyGeometry() {
  const geometry = new SphereGeometry(1, 96, 88).rotateX(Math.PI / 2);
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    const direction = new Vector3().fromBufferAttribute(position, i).normalize();
    const radius = Math.sqrt(Math.max(0, 1 - direction.z ** 2));
    const point = pearSurface(radius, Math.atan2(direction.y, direction.x), direction.z < 0 ? -1 : 1);
    position.setXYZ(i, point.x, point.y, point.z);
    const arc = radius > .00001 ? Math.asin(radius) / (Math.PI / 2) / radius : 2 / Math.PI;
    uv.setXY(i, direction.x * arc * .44 + .5, direction.y * arc * .59 + .5);
  }
  geometry.deleteAttribute('normal');
  const welded = mergeVertices(geometry, .00001); geometry.dispose();
  welded.computeVertexNormals(); return welded;
}

export function pearStitchPaths() {
  return surfaceStitchPaths((u, side) => pearSurface(PEAR.seamRadius, u * Math.PI * 2, side), 86);
}
