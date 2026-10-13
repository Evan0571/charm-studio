import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createJewelryBody, createJewelryInlay, createShellBody, jewelryContour, jewelryRimPaths, shellSurface, type JewelryOutline } from '../src/three/jewelryGeometry';

function assertClosedSolid(geometry: BufferGeometry) {
  for (const name of ['position', 'normal', 'uv']) assert.ok(geometry.getAttribute(name).array.every(Number.isFinite), `${name} is finite`);
  const position = geometry.getAttribute('position'), indices = geometry.index!, edges = new Map<string, number>();
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), ab = new Vector3(), ac = new Vector3();
  let volume = 0;
  for (let i = 0; i < indices.count; i += 3) {
    const triangle = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
    a.fromBufferAttribute(position, triangle[0]); b.fromBufferAttribute(position, triangle[1]); c.fromBufferAttribute(position, triangle[2]);
    const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length();
    assert.ok(area > 1e-10, `nondegenerate triangle at ${i / 3}: ${area}`);
    volume += a.dot(ab.copy(b).cross(c)) / 6;
    for (let edge = 0; edge < 3; edge++) {
      const first = triangle[edge], second = triangle[(edge + 1) % 3];
      const key = `${Math.min(first, second)}:${Math.max(first, second)}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok([...edges.values()].every(count => count === 2), 'each edge belongs to exactly two triangles, including the back and perimeter');
  assert.ok(volume > .001, `outward winding encloses positive volume: ${volume}`);
  return volume;
}

for (const kind of ['star', 'heart', 'petal'] as JewelryOutline[]) {
  test(`${kind} casting is closed, rounded on both faces, and its bezel sits on the casting`, () => {
    const body = createJewelryBody(kind), inlay = createJewelryInlay(kind), material = new MeshBasicMaterial(), mesh = new Mesh(body, material);
    try {
      assertClosedSolid(body);
      for (const name of ['position', 'normal', 'uv']) assert.ok(inlay.getAttribute(name).array.every(Number.isFinite));
      const ray = new Raycaster();
      for (const path of jewelryRimPaths(kind)) for (const point of path) {
        const side = Math.sign(point.z);
        ray.set(new Vector3(point.x, point.y, side), new Vector3(0, 0, -side));
        const hit = ray.intersectObject(mesh)[0];
        assert.ok(hit, 'both faces remain outward-facing under the bezel');
        const gap = side * (point.z - hit.point.z);
        assert.ok(gap > -.0001 && gap < .0016, `bezel is seated, gap = ${gap}`);
      }
      const inlayPosition = inlay.getAttribute('position'), inlayIndex = inlay.index!;
      const centroid = new Vector3(), vertex = new Vector3();
      for (let index = 0; index < inlayIndex.count; index += 57) {
        centroid.set(0, 0, 0);
        for (let corner = 0; corner < 3; corner++) centroid.add(vertex.fromBufferAttribute(inlayPosition, inlayIndex.getX(index + corner)));
        centroid.multiplyScalar(1 / 3);
        const side = Math.sign(centroid.z);
        ray.set(new Vector3(centroid.x, centroid.y, side), new Vector3(0, 0, -side));
        const hit = ray.intersectObject(mesh)[0];
        assert.ok(hit, 'inlay triangles remain supported by the casting');
        const gap = side * (centroid.z - hit.point.z);
        assert.ok(gap > .0006 && gap < .002, `enamel cannot disappear inside the underlying mesh, gap = ${gap}`);
      }
      body.computeBoundingBox();
      const size = body.boundingBox!.getSize(new Vector3());
      assert.ok(size.z > .08 && size.z < .16, 'real casting thickness remains visible from the side');
      assert.ok(size.x < .8 && size.y < .8, 'casting keeps its assembly footprint');
      const normal = body.getAttribute('normal');
      assert.ok(normal.getZ(0) > .99 && normal.getZ(normal.count - 1) < -.99, 'front and back have opposite exterior normals');
    } finally { body.dispose(); inlay.dispose(); material.dispose(); }
  });
}

test('shell is a single closed ribbed surface with a solid hinge and outward-facing front and back', () => {
  const geometry = createShellBody(), material = new MeshBasicMaterial(), mesh = new Mesh(geometry, material);
  try {
    assertClosedSolid(geometry);
    assert.ok(geometry.getAttribute('color').array.every(Number.isFinite));
    for (const side of [1, -1]) for (const radial of [.13, .41, .73, .92]) for (const across of [-.87, -.43, .04, .56, .91]) {
      const point = shellSurface(radial, across, side);
      const hit = new Raycaster(new Vector3(point.x, point.y, side), new Vector3(0, 0, -side)).intersectObject(mesh)[0];
      assert.ok(hit, 'fan is continuous between ribs and remains visible from either side');
      assert.ok(Math.abs(hit.point.z - point.z) < .0015, 'ribbed surface matches the authored relief');
    }
    geometry.computeBoundingBox();
    const size = geometry.boundingBox!.getSize(new Vector3());
    assert.ok(size.x < .67 && size.y < .71 && size.z > .12);
    assert.ok(geometry.boundingBox!.max.y < .31, 'hinge cap and eyelet can connect above the shell without competing with its fan');
  } finally { geometry.dispose(); material.dispose(); }
});

test('jewelry silhouettes preserve the existing suspension contacts and left-right balance', () => {
  const star = jewelryContour('star'), heart = jewelryContour('heart'), petal = jewelryContour('petal');
  assert.ok(Math.abs(Math.max(...star.map(point => point.y)) - .396) < .0001);
  const heartNotch = heart.filter(point => Math.abs(point.x) < .009 && point.y > 0);
  assert.ok(heartNotch.length && heartNotch.every(point => Math.abs(point.y - .286) < .012));
  assert.ok(Math.abs(Math.max(...petal.map(point => point.y)) + .203 - .41) < .008);
  for (const contour of [star, heart, petal]) {
    const averageX = contour.reduce((sum, point) => sum + point.x, 0) / contour.length;
    assert.ok(Math.abs(averageX) < .0005, 'manufactured symmetric charms keep their mass below the centered attachment');
  }
});
