import { BufferGeometry, Float32BufferAttribute } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { XYZ } from './bagAttachment';

export const MINI_BODY = { width: 2.3, height: 1.63, depth: .82, radius: .25, centerY: -.56 };
const coreX = MINI_BODY.width / 2 - MINI_BODY.radius;
const coreY = MINI_BODY.height / 2 - MINI_BODY.radius;
const coreZ = MINI_BODY.depth / 2 - MINI_BODY.radius;
const topY = MINI_BODY.centerY + coreY;
const flapHalfWidth = 1.035, flapBottom = -.65, flapCorner = .18;
export const MINI_FLAP_THICKNESS = .036;

export function createMiniBodyGeometry() {
  return new RoundedBoxGeometry(MINI_BODY.width, MINI_BODY.height, MINI_BODY.depth, 14, MINI_BODY.radius).translate(0, MINI_BODY.centerY, 0);
}

/** Front surface of the rounded shell, including the three-way corner fillets. */
export function miniFrontZ(x: number, y: number): number | undefined {
  const dx = Math.max(0, Math.abs(x) - coreX);
  const dy = Math.max(0, Math.abs(y - MINI_BODY.centerY) - coreY);
  const square = MINI_BODY.radius ** 2 - dx ** 2 - dy ** 2;
  return square >= 0 ? coreZ + Math.sqrt(square) : undefined;
}

function flapLowerY(x: number) {
  const dx = Math.max(0, Math.abs(x) - (flapHalfWidth - flapCorner));
  return flapBottom + flapCorner - Math.sqrt(Math.max(0, flapCorner ** 2 - dx ** 2));
}

/** A continuous leather sheet: down the front, over the crown, and onto the back. */
export function createMiniFlapGeometry() {
  const across = 80, frontSteps = 24, bendSteps = 24, topSteps = 16, backSteps = 16;
  const along = frontSteps + bendSteps + topSteps + backSteps;
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let side = 0; side < 2; side++) {
    // The underside is embedded slightly, so tessellation cannot expose a light gap.
    const thickness = side ? MINI_FLAP_THICKNESS : -.002;
    for (let row = 0; row <= along; row++) for (let col = 0; col <= across; col++) {
      const x = (col / across * 2 - 1) * flapHalfWidth;
      const dx = Math.max(0, Math.abs(x) - coreX);
      const r = Math.sqrt(MINI_BODY.radius ** 2 - dx ** 2);
      let y: number, z: number, ny = 0, nz = 1;
      if (row <= frontSteps) {
        y = flapLowerY(x) + (topY - flapLowerY(x)) * row / frontSteps;
        z = coreZ + r;
      } else if (row <= frontSteps + bendSteps) {
        const a = (row - frontSteps) / bendSteps * Math.PI / 2;
        ny = Math.sin(a); nz = Math.cos(a); y = topY + r * ny; z = coreZ + r * nz;
      } else if (row <= frontSteps + bendSteps + topSteps) {
        ny = 1; nz = 0; y = topY + r;
        z = coreZ - 2 * coreZ * (row - frontSteps - bendSteps) / topSteps;
      } else {
        const a = (row - frontSteps - bendSteps - topSteps) / backSteps * Math.PI / 3;
        ny = Math.cos(a); nz = -Math.sin(a); y = topY + r * ny; z = -coreZ + r * nz;
      }
      positions.push(x + Math.sign(x) * dx / MINI_BODY.radius * thickness, y + ny * r / MINI_BODY.radius * thickness, z + nz * r / MINI_BODY.radius * thickness);
      uvs.push(col / across, row / along);
    }
  }
  const stride = across + 1, layer = stride * (along + 1);
  const quad = (a: number, b: number, c: number, d: number) => indices.push(a, b, c, a, c, d);
  for (let row = 0; row < along; row++) for (let col = 0; col < across; col++) {
    const a = row * stride + col, b = a + 1, c = b + stride, d = a + stride;
    quad(d, c, b, a); quad(a + layer, b + layer, c + layer, d + layer);
  }
  for (let col = 0; col < across; col++) {
    quad(col, col + 1, col + 1 + layer, col + layer);
    const end = along * stride + col;
    quad(end + 1, end, end + layer, end + 1 + layer);
  }
  for (let row = 0; row < along; row++) {
    const left = row * stride, right = left + across;
    quad(left + stride, left, left + layer, left + stride + layer);
    quad(right, right + stride, right + stride + layer, right + layer);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Stitches stop under the flap and follow the body around both lower corners. */
export function miniQuiltLines(): XYZ[][] {
  const lines: XYZ[][] = [];
  for (const slope of [-1, 1]) for (let intercept = -2.6; intercept < 2.6; intercept += .34) {
    let points: XYZ[] = [];
    const flush = () => { if (points.length > 2) lines.push(points); points = []; };
    for (let i = 0; i <= 240; i++) {
      const x = -1.07 + 2.14 * i / 240, y = slope * x + intercept, z = miniFrontZ(x, y);
      // Keep the final stitch away from the silhouette and tuck its upper end under the flap.
      if (z !== undefined && z > .245 && y > -1.315 && y < flapLowerY(Math.min(flapHalfWidth, Math.max(-flapHalfWidth, x))) + .012) points.push([x, y, z + .001]);
      else flush();
    }
    flush();
  }
  return lines;
}
