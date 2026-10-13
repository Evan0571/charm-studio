import { SphereGeometry, Vector3 } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { surfaceStitchPaths } from './leatherGeometry';

export const CHERRY_SEAM_RADIUS = .916;
export const CHERRY_ATTACHMENT = [0, .38, 0] as const;
export const CHERRY_FRUITS = [
  { position: [-.176, -.149, .014] as [number, number, number], scale: 1 },
  { position: [.176, -.188, -.015] as [number, number, number], scale: .97 },
];
export const CHERRY_LEAF_POSE = {
  position: [-.012, .312, .014] as [number, number, number],
  rotation: [.08, -.12, 2.03] as [number, number, number],
  scale: [.78, .79, .9] as [number, number, number],
};

/** Two sewn leather panels retain a softly dimpled stem socket. */
export function cherrySurface(radius: number, angle: number, side = 1) {
  const nx = radius * Math.cos(angle), ny = radius * Math.sin(angle);
  const socket = .013 * Math.exp(-((nx / .25) ** 2)) * Math.pow(Math.max(0, ny), 8);
  const seam = .0016 * Math.exp(-(((radius - CHERRY_SEAM_RADIUS) / .027) ** 2));
  return new Vector3(.18 * nx * (1 + .025 * ny), .189 * ny - socket,
    side * (.147 * Math.sqrt(Math.max(0, 1 - radius * radius)) - seam));
}

export function createCherryBodyGeometry() {
  const geometry = new SphereGeometry(1, 72, 64).rotateX(Math.PI / 2);
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    const direction = new Vector3().fromBufferAttribute(position, i).normalize();
    const radius = Math.sqrt(Math.max(0, 1 - direction.z ** 2));
    const point = cherrySurface(radius, Math.atan2(direction.y, direction.x), direction.z < 0 ? -1 : 1);
    position.setXYZ(i, point.x, point.y, point.z);
    const arc = radius > .00001 ? Math.asin(radius) / (Math.PI / 2) / radius : 2 / Math.PI;
    uv.setXY(i, direction.x * arc * .30 + .5, direction.y * arc * .32 + .5);
  }
  geometry.deleteAttribute('normal');
  const welded = mergeVertices(geometry, .00001); geometry.dispose();
  welded.computeVertexNormals(); return welded;
}

export function cherryStitchPaths() {
  return surfaceStitchPaths((u, side) => cherrySurface(CHERRY_SEAM_RADIUS, u * Math.PI * 2, side), 54);
}
