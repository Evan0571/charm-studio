import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createPearBodyGeometry, pearStitchPaths } from '../src/three/pearGeometry';
import { createBananaBodyGeometry, bananaStitchPaths, bananaSurface } from '../src/three/bananaGeometry';

for (const [name, create, stitches] of [
  ['pear', createPearBodyGeometry, pearStitchPaths],
  ['banana', createBananaBodyGeometry, bananaStitchPaths],
] as const) {
  test(`${name} front and back stitches follow a closed, outward-facing padded surface`, () => {
    const geometry = create(), material = new MeshBasicMaterial(), mesh = new Mesh(geometry, material), ray = new Raycaster();
    try {
      for (const path of stitches()) for (const point of path) {
        const side = Math.sign(point.z);
        ray.set(new Vector3(point.x, point.y, side), new Vector3(0, 0, -side));
        const hit = ray.intersectObject(mesh)[0];
        assert.ok(hit, `${name} stitch must have an outward-facing leather surface behind it`);
        const gap = side * (point.z - hit.point.z);
        assert.ok(gap > -.0015 && gap < .004, `${name} stitch floats or sinks, gap=${gap}`);
      }
      for (const attribute of ['position', 'normal', 'uv']) assert.ok(geometry.getAttribute(attribute).array.every(Number.isFinite));
      geometry.computeBoundingBox();
      const size = geometry.boundingBox!.getSize(new Vector3());
      assert.ok(size.z > (name === 'pear' ? .42 : .20), 'padding remains visible from the side');
      assert.ok(size.x < .9 && size.y < .95, 'geometry stays inside its assembly footprint');
    } finally { geometry.dispose(); material.dispose(); }
  });
}

test('banana end caps close the swept body from both directions', () => {
  const geometry = createBananaBodyGeometry(), material = new MeshBasicMaterial(), mesh = new Mesh(geometry, material);
  try {
    for (const t of [0, 1]) {
      const center = bananaSurface(t, 0).add(bananaSurface(t, Math.PI)).multiplyScalar(.5);
      const a = -.32 + t * 1.82;
      const outward = new Vector3(Math.cos(a) * .58, -Math.sin(a) * .84, 0).normalize().multiplyScalar(t ? 1 : -1);
      const hit = new Raycaster(center.clone().addScaledVector(outward, .1), outward.clone().negate()).intersectObject(mesh)[0];
      assert.ok(hit && hit.point.distanceTo(center) < .002, 'tip meets its cap rather than looking through the body');
    }
  } finally { geometry.dispose(); material.dispose(); }
});
