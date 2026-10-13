import { SphereGeometry, Vector3 } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

import { joinGeometry, tubeGeometry } from './leatherGeometry';

export const ORANGE = { width: .36, height: .37, depth: .238, seamRadius: .935 };

/** The same padded surface is used by the leather panels and both stitch rows. */
export function orangeSurface(radius: number, angle: number, side = 1) {
  const { width, height, depth, seamRadius } = ORANGE;
  const fullness = 1 + .007 * Math.sin(angle * 3) * radius + .004 * Math.cos(angle * 5) * radius;
  const inset = .004 * Math.exp(-(((radius - seamRadius) / .018) ** 2));
  const z = depth * Math.sqrt(Math.max(0, 1 - radius * radius)) - inset;
  return new Vector3(width * radius * Math.cos(angle) * fullness, height * radius * Math.sin(angle) * fullness, side * z);
}

export function createOrangeBodyGeometry() {
  const geometry = new SphereGeometry(1, 96, 80).rotateX(Math.PI / 2);
  const positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), side = positions.getZ(i) < 0 ? -1 : 1;
    const normalizedZ = positions.getZ(i) / Math.hypot(x, y, positions.getZ(i));
    const radius = Math.sqrt(Math.max(0, 1 - normalizedZ * normalizedZ));
    const point = orangeSurface(radius, Math.atan2(y, x), side);
    positions.setXYZ(i, point.x, point.y, point.z);
    // Each panel unwraps radially by arc length, keeping the texture continuous
    // at its center and preventing the grain from stretching at the rolled edge.
    const r = Math.min(1, Math.hypot(x, y));
    const arcScale = r > .00001 ? Math.asin(r) / (Math.PI / 2) / r : 2 / Math.PI;
    uv.setXY(i, x * arcScale * .5 + .5, y * arcScale * .5 + .5);
  }
  // Weld the old sphere's duplicated longitude edge after the panel unwrap.
  // This avoids a hairline opening and a normal discontinuity at that edge.
  geometry.deleteAttribute('normal');
  const welded = mergeVertices(geometry, .00001);
  geometry.dispose();
  welded.computeVertexNormals();
  return welded;
}

export function orangeStitchPaths() {
  return [-1, 1].flatMap(side => Array.from({ length: 82 }, (_, index) => {
    const start = index / 82 * Math.PI * 2;
    return Array.from({ length: 5 }, (_, step) => {
      const t = step / 4, angle = start + t * .62 / 82 * Math.PI * 2;
      const point = orangeSurface(ORANGE.seamRadius, angle, side);
      // Ends enter the needle holes; the middle arches just above the leather.
      point.z += side * (.0003 + Math.sin(t * Math.PI) * .0016);
      return point;
    });
  }));
}

export function createOrangeStitches() {
  return joinGeometry(orangeStitchPaths().map(points => tubeGeometry(points, .00145)));
}

export function createOrangeNeedleHoles() {
  return joinGeometry(orangeStitchPaths().flatMap(points => [points[0], points.at(-1)!].map(point => {
    const geometry = new SphereGeometry(1, 6, 4);
    geometry.scale(.0022, .0022, .0009);
    geometry.translate(point.x, point.y, point.z);
    return geometry;
  })));
}

