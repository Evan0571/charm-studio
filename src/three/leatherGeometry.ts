import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function tubeGeometry(points: Vector3[], radius: number, closed = false, steps = Math.max(8, points.length * 3)) {
  return new TubeGeometry(new CatmullRomCurve3(points, closed, 'centripetal'), steps, radius, 6, closed);
}

export function joinGeometry(geometries: BufferGeometry[]) {
  const merged = mergeGeometries(geometries, false)!;
  geometries.forEach(geometry => geometry.dispose());
  return merged;
}

/** Space stitches by arc length, while evaluating each point on the actual
 * leather surface rather than an interpolated curve that can float above it. */
export function surfaceStitchPaths(surface: (u: number, side: number) => Vector3, count: number) {
  const steps = 720, lengths = [0];
  let previous = surface(0, 1);
  for (let i = 1; i <= steps; i++) {
    const point = surface(i / steps, 1);
    lengths.push(lengths[i - 1] + point.distanceTo(previous)); previous = point;
  }
  const parameter = (fraction: number) => {
    const distance = fraction * lengths[steps];
    let low = 0, high = steps;
    while (high - low > 1) { const mid = (low + high) >> 1; if (lengths[mid] < distance) low = mid; else high = mid; }
    return (low + (distance - lengths[low]) / (lengths[high] - lengths[low])) / steps;
  };
  return [-1, 1].flatMap(side => Array.from({ length: count }, (_, index) => Array.from({ length: 5 }, (_, j) => {
    const point = surface(parameter((index + j / 4 * .61) / count), side);
    point.z += side * (.0003 + Math.sin(j / 4 * Math.PI) * .0015);
    return point;
  })));
}

export function createSaddleDetails(paths: Vector3[][], radius = .0014) {
  return {
    stitches: joinGeometry(paths.map(points => tubeGeometry(points, radius))),
    holes: joinGeometry(paths.flatMap(points => [points[0], points.at(-1)!].map(point => {
      const hole = new SphereGeometry(1, 6, 4).scale(radius * 1.5, radius * 1.5, .0008);
      return hole.translate(point.x, point.y, point.z);
    }))),
  };
}

/** A closed, bent leather leaf, with its ridged face and edges sharing a surface. */
export function leafSurface(t: number, across: number, back = false) {
  const width = .079 * Math.pow(Math.sin(Math.PI * t), .85);
  return new Vector3(across * width, t * .30,
    .036 * Math.sin(Math.PI * t) + .018 * t * t - .019 * Math.abs(across) * Math.sin(Math.PI * t) - (back ? .009 : 0));
}

export function createLeatherLeafGeometry() {
  const rows = 32, cols = 14, stride = cols + 1, layer = (rows + 1) * stride;
  const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let side = 0; side < 2; side++) for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
    const t = .003 + row / rows * .994, across = col / cols * 2 - 1;
    const point = leafSurface(t, across, Boolean(side));
    vertices.push(point.x, point.y, point.z); uv.push(point.x / .72 + .5, point.y / .74);
  }
  const quad = (a: number, b: number, c: number, d: number) => indices.push(a, b, c, a, c, d);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const a = row * stride + col, b = a + 1, c = b + stride, d = a + stride;
    quad(a, b, c, d); quad(d + layer, c + layer, b + layer, a + layer);
  }
  for (let row = 0; row < rows; row++) {
    const left = row * stride, right = left + cols;
    quad(left + stride, left + layer + stride, left + layer, left);
    quad(right, right + layer, right + layer + stride, right + stride);
  }
  for (let col = 0; col < cols; col++) {
    quad(col, col + layer, col + layer + 1, col + 1);
    const a = rows * stride + col; quad(a + 1, a + 1 + layer, a + layer, a);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function createLeatherLeafDetails() {
  const veins: Vector3[][] = [Array.from({ length: 24 }, (_, i) => leafSurface(.06 + i / 23 * .88, 0))];
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    veins.push(Array.from({ length: 10 }, (_, j) => leafSurface(.13 + i * .17 + j / 9 * .15, side * j / 9 * .74)));
  }
  const stitches = [-1, 1].flatMap(side => Array.from({ length: 23 }, (_, i) =>
    Array.from({ length: 4 }, (_, j) => {
      const point = leafSurface(.06 + (i + j / 3 * .55) / 23 * .87, side * .83);
      point.z += .001; return point;
    })));
  return { veins: joinGeometry(veins.map(points => tubeGeometry(points, .00125))), leafStitches: joinGeometry(stitches.map(points => tubeGeometry(points, .00095))) };
}
