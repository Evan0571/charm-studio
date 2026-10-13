import { BufferGeometry, Float32BufferAttribute, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { joinGeometry, tubeGeometry } from './leatherGeometry';

export const CUPCAKE_ATTACHMENT = [0, .48, 0] as const;
const TAU = Math.PI * 2;

function pleatedPoint(radius: number, y: number, angle: number) {
  const height = Math.max(0, Math.min(1, (y + .36) / .329));
  const pleat = 1 + .011 * Math.cos(angle * 20) * Math.pow(Math.sin(Math.PI * height), .6);
  return new Vector3(Math.cos(angle) * radius * pleat, y, Math.sin(angle) * radius * pleat);
}

/** The side is a single softly fluted leather panel, with rounded folded rims. */
export function cupcakeWrapperSurface(y: number, angle: number) {
  return pleatedPoint(.24 + (y + .342) / .299 * .061, y, angle);
}

function closeSurface(rows: Vector3[][], uvs: number[]) {
  const columns = rows[0].length, positions = rows.flatMap(row => row.flatMap(point => point.toArray())), indices: number[] = [];
  for (let row = 0; row < rows.length - 1; row++) for (let col = 0; col < columns - 1; col++) {
    const a = row * columns + col, b = a + 1, d = a + columns, c = d + 1;
    // Increasing rows run from the lower pole to the upper pole.
    indices.push(a, d, b, b, d, c);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
  const welded = mergeVertices(geometry, .000001); geometry.dispose();
  welded.computeVertexNormals(); return welded;
}

export function createCupcakeWrapperGeometry() {
  const profile: [number, number][] = [];
  for (let i = 0; i <= 10; i++) profile.push([.222 * i / 10, -.36]);
  for (let i = 1; i <= 12; i++) { const angle = i / 12 * Math.PI / 2; profile.push([.222 + .018 * Math.sin(angle), -.342 - .018 * Math.cos(angle)]); }
  for (let i = 1; i <= 28; i++) profile.push([.24 + i / 28 * .061, -.342 + i / 28 * .299]);
  for (let i = 1; i <= 12; i++) { const angle = i / 12 * Math.PI / 2; profile.push([.289 + .012 * Math.cos(angle), -.043 + .012 * Math.sin(angle)]); }
  for (let i = 1; i <= 10; i++) profile.push([.289 * (1 - i / 10), -.031]);
  const columns = 120, uvs: number[] = [];
  const rows = profile.map(([radius, y]) => Array.from({ length: columns + 1 }, (_, index) => {
    uvs.push(index / columns * 1.8, (y + .36) * 2.1);
    return pleatedPoint(radius, y, index / columns * TAU);
  }));
  return closeSurface(rows, uvs);
}

/** A continuous padded spiral crown avoids intersecting stacks of spheres. */
export function cupcakeFrostingSurface(t: number, angle: number) {
  const roundBase = 1 - .05 * Math.exp(-((t / .07) ** 2));
  const spiral = angle - t * TAU * 2.8 - .65;
  const fold = .11 * Math.pow(Math.max(0, Math.sin(Math.PI * t)), .4);
  const radius = .307 * Math.pow(Math.max(0, 1 - t), .66) * roundBase * (1 - fold * Math.cos(spiral));
  return new Vector3(Math.cos(angle) * radius + .018 * t ** 3, -.04 + .383 * t, Math.sin(angle) * radius);
}

export function cupcakeFrostingNormal(t: number, angle: number) {
  const tangent = cupcakeFrostingSurface(t, angle + .0001).sub(cupcakeFrostingSurface(t, angle - .0001));
  const vertical = cupcakeFrostingSurface(Math.min(.99999, t + .0001), angle).sub(cupcakeFrostingSurface(Math.max(0, t - .0001), angle));
  return vertical.cross(tangent).normalize();
}

export function createCupcakeFrostingGeometry() {
  const columns = 112, sections = 104, uvs: number[] = [];
  const bottom = Array.from({ length: columns + 1 }, (_, index) => { uvs.push(index / columns * 1.6, 0); return new Vector3(0, -.04, 0); });
  const rows = [bottom];
  for (let row = 0; row <= sections; row++) rows.push(Array.from({ length: columns + 1 }, (_, index) => {
    const t = row / sections, angle = index / columns * TAU;
    uvs.push(index / columns * 1.6, t * 1.3);
    return cupcakeFrostingSurface(t, angle);
  }));
  return closeSurface(rows, uvs);
}

export function cupcakeWrapperStitchPaths() {
  return [-.319, -.068].flatMap(y => Array.from({ length: 88 }, (_, index) => Array.from({ length: 5 }, (_, step) => {
    const angle = (index + step / 4 * .57) / 88 * TAU;
    return cupcakeWrapperSurface(y, angle).addScaledVector(new Vector3(Math.cos(angle), -.204, Math.sin(angle)).normalize(), .0003 + Math.sin(step / 4 * Math.PI) * .0011);
  })));
}

export function cupcakeFrostingSeam(t: number) {
  const height = .035 + t * .89, angle = .65 + height * TAU * 2.8;
  return { point: cupcakeFrostingSurface(height, angle), normal: cupcakeFrostingNormal(height, angle) };
}

export function cupcakeFrostingStitchPaths() {
  // Arc-length spacing keeps the stitches even as the cone narrows.
  const steps = 900, distance = [0];
  let previous = cupcakeFrostingSeam(0).point;
  for (let i = 1; i <= steps; i++) { const point = cupcakeFrostingSeam(i / steps).point; distance.push(distance[i - 1] + point.distanceTo(previous)); previous = point; }
  const parameter = (fraction: number) => {
    const target = fraction * distance[steps]; let low = 0, high = steps;
    while (high - low > 1) { const middle = (low + high) >> 1; if (distance[middle] < target) low = middle; else high = middle; }
    return (low + (target - distance[low]) / (distance[high] - distance[low])) / steps;
  };
  return Array.from({ length: 142 }, (_, index) => Array.from({ length: 5 }, (_, step) => {
    const { point, normal } = cupcakeFrostingSeam(parameter((index + step / 4 * .56) / 142));
    return point.addScaledVector(normal, .0004 + Math.sin(step / 4 * Math.PI) * .001);
  }));
}

export function createCupcakeStitchDetails(paths: Vector3[][], normalAt: (point: Vector3) => Vector3, radius = .00115) {
  return {
    stitches: joinGeometry(paths.map(points => tubeGeometry(points, radius))),
    holes: joinGeometry(paths.flatMap(points => [points[0], points.at(-1)!].map(point => {
      const hole = new SphereGeometry(1, 6, 4).scale(radius * 1.5, radius * 1.5, .0006);
      hole.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normalAt(point)));
      return hole.translate(point.x, point.y, point.z);
    }))),
  };
}

export function cupcakeFrostingNormalAtPoint(point: Vector3) {
  const t = (point.y + .04) / .383;
  return cupcakeFrostingNormal(t, Math.atan2(point.z, point.x - .018 * t ** 3));
}
