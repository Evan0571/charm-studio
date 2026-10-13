import { BufferGeometry, Color, Float32BufferAttribute, Shape, Vector2, Vector3 } from 'three';

export type JewelryOutline = 'star' | 'heart' | 'petal';
const OUTLINE_STEPS = 160;

/** Rounded outlines are shared by the casting, enamel and its bezel. */
export function jewelryContour(kind: JewelryOutline) {
  const shape = new Shape();
  if (kind === 'star') {
    const corners = Array.from({ length: 10 }, (_, i) => {
      const angle = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? .196 : .402;
      return new Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
    });
    for (let i = 0; i < corners.length; i++) {
      const corner = corners[i], inset = i % 2 ? .08 : .075;
      const before = corner.clone().lerp(corners[(i + 9) % 10], inset);
      const after = corner.clone().lerp(corners[(i + 1) % 10], inset);
      if (i === 0) shape.moveTo(before.x, before.y); else shape.lineTo(before.x, before.y);
      shape.quadraticCurveTo(corner.x, corner.y, after.x, after.y);
    }
    shape.closePath();
  } else if (kind === 'heart') {
    shape.moveTo(0, -.302);
    shape.bezierCurveTo(-.078, -.255, -.357, -.035, -.351, .172);
    shape.bezierCurveTo(-.346, .376, -.147, .435, 0, .286);
    shape.bezierCurveTo(.147, .435, .346, .376, .351, .172);
    shape.bezierCurveTo(.357, -.035, .078, -.255, 0, -.302);
    shape.closePath();
  } else {
    shape.moveTo(0, -.197);
    shape.bezierCurveTo(-.087, -.168, -.122, -.018, -.105, .094);
    shape.bezierCurveTo(-.091, .240, .091, .240, .105, .094);
    shape.bezierCurveTo(.122, -.018, .087, -.168, 0, -.197);
    shape.closePath();
  }
  // Six small oval petals do not need the star's corner density. Retain the
  // same cross-section rings for smooth enamel reflections at close range.
  const contour = shape.getSpacedPoints(kind === 'petal' ? 64 : OUTLINE_STEPS).slice(0, -1);
  const area = contour.reduce((sum, point, i) => sum + point.cross(contour[(i + 1) % contour.length]), 0);
  if (area < 0) contour.reverse();
  if (kind === 'star') {
    const scale = .396 / Math.max(...contour.map(point => point.y));
    contour.forEach(point => point.multiplyScalar(scale));
  }
  return contour;
}

export const JEWELRY_DEPTH: Record<JewelryOutline, number> = { star: .052, heart: .077, petal: .044 };

export function jewelrySurface(contour: Vector2[], depth: number, radius: number, index: number, side = 1) {
  const point = contour[index % contour.length];
  return new Vector3(point.x * radius, point.y * radius,
    side * depth * Math.sqrt(Math.max(0, 1 - radius * radius)) * (1 + .45 * radius * radius));
}

function finishGeometry(positions: number[], uv: number[], indices: number[]) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** A single closed casting, with a smooth dome on both faces and a rounded edge.
 * Pole fans and a shared equator avoid coincident faces or zero-area triangles. */
export function createJewelryBody(kind: JewelryOutline) {
  const contour = jewelryContour(kind), depth = JEWELRY_DEPTH[kind], count = contour.length, rows = 32;
  const positions = [0, 0, depth], uv = [.5, .5], indices: number[] = [];
  for (let row = 1; row < rows; row++) {
    const angle = row / rows * Math.PI;
    for (let i = 0; i < count; i++) {
      const point = jewelrySurface(contour, depth, Math.sin(angle), i, Math.sign(Math.cos(angle)));
      positions.push(point.x, point.y, point.z); uv.push(point.x + .5, point.y + .5);
    }
  }
  const bottom = positions.length / 3;
  positions.push(0, 0, -depth); uv.push(.5, .5);
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    indices.push(0, 1 + i, 1 + next);
    for (let row = 0; row < rows - 2; row++) {
      const a = 1 + row * count + i, b = 1 + (row + 1) * count + i;
      const c = 1 + (row + 1) * count + next, d = 1 + row * count + next;
      indices.push(a, b, c, a, c, d);
    }
    indices.push(bottom, 1 + (rows - 2) * count + next, 1 + (rows - 2) * count + i);
  }
  return finishGeometry(positions, uv, indices);
}

/** Enamel is a thin surface layer on the casting; its boundary leaves a real
 * metal lip. It never becomes a second physical hull in the suspension model. */
export function createJewelryInlay(kind: JewelryOutline, radius = .925) {
  const contour = jewelryContour(kind), depth = JEWELRY_DEPTH[kind], count = contour.length;
  // Reuse the casting's radial rings so the enamel cannot dip through a
  // coarser triangle on the casting between otherwise correctly seated points.
  const radii = Array.from({ length: 15 }, (_, i) => Math.sin((i + 1) / 32 * Math.PI)).filter(value => value < radius);
  radii.push(radius);
  const rows = radii.length;
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (const side of [1, -1]) {
    const start = positions.length / 3;
    positions.push(0, 0, side * (depth + .0008)); uv.push(.5, .5);
    for (let row = 1; row <= rows; row++) for (let i = 0; i < count; i++) {
      const point = jewelrySurface(contour, depth, radii[row - 1], i, side);
      point.z += side * .0008;
      positions.push(point.x, point.y, point.z); uv.push(point.x + .5, point.y + .5);
    }
    const triangle = (a: number, b: number, c: number) => side === 1 ? indices.push(a, b, c) : indices.push(a, c, b);
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      triangle(start, start + 1 + i, start + 1 + next);
      for (let row = 0; row < rows - 1; row++) {
        const a = start + 1 + row * count + i, b = a + count;
        const c = start + 1 + (row + 1) * count + next, d = start + 1 + row * count + next;
        triangle(a, b, c); triangle(a, c, d);
      }
    }
  }
  return finishGeometry(positions, uv, indices);
}

export function jewelryRimPaths(kind: JewelryOutline, radius = .933) {
  const contour = jewelryContour(kind);
  return [1, -1].map(side => contour.map((_, i) => jewelrySurface(contour, JEWELRY_DEPTH[kind], radius, i, side)));
}

/** The ribs belong to one nacre casting: they converge into the hinge, rather
 * than being separate capsules that intersect one another. */
export function shellSurface(radial: number, across: number, side = 1) {
  const angle = across * .98, phase = (across + 1) * Math.PI * 4.5;
  const outer = .685 + .011 * Math.cos(phase) ** 2;
  const r = .022 + radial * (outer - .022);
  const fade = Math.sin(Math.PI * radial) ** .65;
  const edge = Math.sin((across + 1) * Math.PI / 2) ** .5;
  const rib = .010 * Math.cos(phase) ** 2 * fade;
  const thickness = .006 + (.058 * fade + rib) * edge;
  const camber = .012 * Math.sin(Math.PI * radial) * edge;
  return new Vector3(Math.sin(angle) * r * .57, .318 - Math.cos(angle) * r, camber + side * thickness);
}

export function createShellBody() {
  const rows = 56, cols = 112, stride = cols + 1, layer = (rows + 1) * stride;
  const positions: number[] = [], uv: number[] = [], colors: number[] = [], indices: number[] = [];
  const valley = new Color('#ded0bc'), crest = new Color('#fff5df'), color = new Color();
  for (const side of [1, -1]) for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
    const radial = row / rows, across = col / cols * 2 - 1, point = shellSurface(radial, across, side);
    positions.push(point.x, point.y, point.z); uv.push((across + 1) / 2, radial);
    const rib = Math.cos((across + 1) * Math.PI * 4.5) ** 2;
    color.copy(valley).lerp(crest, .40 + rib * .24 + radial * .12);
    if (side < 0) color.multiplyScalar(.96);
    colors.push(color.r, color.g, color.b);
  }
  const quad = (a: number, b: number, c: number, d: number) => indices.push(a, b, c, a, c, d);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const a = row * stride + col, b = a + stride, c = b + 1, d = a + 1;
    quad(a, b, c, d); quad(d + layer, c + layer, b + layer, a + layer);
  }
  for (let row = 0; row < rows; row++) {
    const a = row * stride, b = a + stride, c = a + cols, d = b + cols;
    quad(a, a + layer, b + layer, b); quad(d, d + layer, c + layer, c);
  }
  for (let col = 0; col < cols; col++) {
    quad(col + 1, col + 1 + layer, col + layer, col);
    const a = rows * stride + col; quad(a, a + layer, a + layer + 1, a + 1);
  }
  const geometry = finishGeometry(positions, uv, indices);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}
