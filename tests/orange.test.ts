import test from 'node:test';
import assert from 'node:assert/strict';
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createOrangeBodyGeometry, createOrangeNeedleHoles, createOrangeStitches, orangeStitchPaths } from '../src/three/orangeGeometry';
import { createLeatherLeafGeometry } from '../src/three/leatherGeometry';

test('orange saddle stitches contact the actual front and back leather surfaces', () => {
  const geometry = createOrangeBodyGeometry(), material = new MeshBasicMaterial({ side: DoubleSide });
  const mesh = new Mesh(geometry, material), ray = new Raycaster();
  try {
    for (const path of orangeStitchPaths()) for (const point of path) {
      const side = Math.sign(point.z);
      ray.set(new Vector3(point.x, point.y, side), new Vector3(0, 0, -side));
      const hit = ray.intersectObject(mesh)[0];
      assert.ok(hit, 'every stitch has leather behind it');
      const gap = side * (point.z - hit.point.z);
      assert.ok(gap >= -.001 && gap < .0035, `thread stays on the panel, gap=${gap}`);
    }
  } finally { geometry.dispose(); material.dispose(); }
});

test('orange detail geometry has finite normals and UVs, including panel centers and needle holes', () => {
  const geometries = [createOrangeBodyGeometry(), createLeatherLeafGeometry(), createOrangeNeedleHoles(), createOrangeStitches()];
  try {
    for (const geometry of geometries) {
      for (const name of ['position', 'normal', 'uv']) {
        assert.ok(geometry.getAttribute(name).array.every(Number.isFinite), `${name} contains invalid values`);
      }
      geometry.computeBoundingBox();
      const size = geometry.boundingBox!.getSize(new Vector3());
      assert.ok(size.x > 0 && size.y > 0 && size.z > 0, 'all components retain real thickness');
    }
    const body = geometries[0].boundingBox!;
    assert.ok(body.max.z - body.min.z > .46, 'orange keeps its padded depth');
    assert.ok(body.max.x < .37 && body.max.y < .38, 'polish preserves the assembly footprint');
  } finally { geometries.forEach(geometry => geometry.dispose()); }
});

test('leather leaf has a closed shell with outward front and back faces', () => {
  const geometry = createLeatherLeafGeometry(), material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material);
  try {
    for (const side of [-1, 1]) for (const y of [.025, .10, .20, .28]) {
      const hits = new Raycaster(new Vector3(0, y, side), new Vector3(0, 0, -side)).intersectObject(mesh);
      assert.ok(hits.length > 0, `leaf visible from side ${side} at ${y}`);
    }
    const edges = new Map<string, number>(), index = geometry.index!;
    for (let i = 0; i < index.count; i += 3) for (let j = 0; j < 3; j++) {
      const a = index.getX(i + j), b = index.getX(i + (j + 1) % 3);
      const key = a < b ? `${a}/${b}` : `${b}/${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
    assert.ok([...edges.values()].every(count => count === 2), 'leaf has no open border or non-manifold edge');
  } finally { geometry.dispose(); material.dispose(); }
});
