import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { surfaceStitchPaths } from './leatherGeometry';

/** A padded curved leather body, with a continuous oval section and closed tips. */
export function bananaSurface(t: number, angle: number) {
  const a = -.32 + t * 1.82;
  const center = new Vector3(.11 + Math.sin(a) * .58 - .34, .38 - (1 - Math.cos(a)) * .84, 0);
  const tangent = new Vector3(Math.cos(a) * .58, -Math.sin(a) * .84, 0).normalize();
  const side = new Vector3(-tangent.y, tangent.x, 0);
  const width = .012 + Math.pow(Math.sin(Math.PI * t), .7) * .137;
  const ridge = 1 + .025 * Math.cos(angle * 3) * Math.sin(Math.PI * t);
  const point = center.addScaledVector(side, Math.cos(angle) * width * ridge);
  point.z = Math.sin(angle) * width * .73;
  return point;
}

export function createBananaBodyGeometry() {
  const along = 96, around = 48, stride = around + 1;
  const position: number[] = [], uv: number[] = [], index: number[] = [];
  for (let i = 0; i <= along; i++) for (let j = 0; j <= around; j++) {
    const point = bananaSurface(i / along, j / around * Math.PI * 2);
    position.push(point.x, point.y, point.z);
    uv.push(i / along * 1.4, j / around * .48);
    if (i < along && j < around) {
      const a = i * stride + j;
      index.push(a, a + 1, a + stride, a + 1, a + stride + 1, a + stride);
    }
  }
  // Real end caps prevent the open tubes visible when the pendant is rotated.
  for (const end of [0, 1]) {
    const t = end, a = -.32 + t * 1.82;
    const cap = position.length / 3;
    position.push(.11 + Math.sin(a) * .58 - .34, .38 - (1 - Math.cos(a)) * .84, 0);
    uv.push(t * 1.4, .24);
    const start = end * along * stride;
    for (let j = 0; j < around; j++) {
      if (end) index.push(cap, start + j, start + j + 1);
      else index.push(cap, start + j + 1, start + j);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2)); geometry.setIndex(index);
  const welded = mergeVertices(geometry, .00001); geometry.dispose();
  welded.computeVertexNormals(); return welded;
}

export function bananaSeam(u: number, side = 1) {
  const quarter = u * 4, section = Math.min(3, Math.floor(quarter)), fraction = quarter - section;
  const edge = .59;
  let t: number, angle: number;
  if (section === 0) { t = .055 + fraction * .89; angle = edge; }
  else if (section === 1) { t = .945 + .035 * Math.sin(fraction * Math.PI); angle = edge + fraction * (Math.PI - edge * 2); }
  else if (section === 2) { t = .945 - fraction * .89; angle = Math.PI - edge; }
  else { t = .055 - .035 * Math.sin(fraction * Math.PI); angle = Math.PI - edge - fraction * (Math.PI - edge * 2); }
  const point = bananaSurface(t, angle); point.z *= side; return point;
}

export function bananaStitchPaths() {
  return surfaceStitchPaths(bananaSeam, 92);
}
