import test from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3 } from 'three';
import { CHERRY_ATTACHMENT, CHERRY_FRUITS, CHERRY_LEAF_POSE, cherryStitchPaths, createCherryBodyGeometry } from '../src/three/cherryGeometry';
import { createLeatherLeafGeometry } from '../src/three/leatherGeometry';
import { CUPCAKE_ATTACHMENT, createCupcakeFrostingGeometry, createCupcakeWrapperGeometry, cupcakeFrostingNormalAtPoint, cupcakeFrostingStitchPaths, cupcakeWrapperStitchPaths } from '../src/three/cupcakeGeometry';

test('cherry saddle stitches sit on both padded leather panels', () => {
  const geometry = createCherryBodyGeometry(), material = new MeshBasicMaterial(), mesh = new Mesh(geometry, material);
  try {
    for (const path of cherryStitchPaths()) for (const point of path) {
      const side = Math.sign(point.z), ray = new Raycaster(new Vector3(point.x, point.y, side), new Vector3(0, 0, -side));
      const hit = ray.intersectObject(mesh)[0];
      assert.ok(hit, 'both panels are outward facing and support the entire seam');
      const gap = side * (point.z - hit.point.z);
      assert.ok(gap > -.001 && gap < .003, `a cherry stitch floats or sinks: ${gap}`);
    }
  } finally { geometry.dispose(); material.dispose(); }
});

test('cherry leaf stays clear of both fruits and the upward suspension path', () => {
  const leaf = createLeatherLeafGeometry(), fruit = createCherryBodyGeometry();
  try {
    leaf.applyMatrix4(new Matrix4().compose(new Vector3(...CHERRY_LEAF_POSE.position), new Quaternion().setFromEuler(new Euler(...CHERRY_LEAF_POSE.rotation)), new Vector3(...CHERRY_LEAF_POSE.scale)));
    leaf.computeBoundingBox(); fruit.computeBoundingBox();
    for (const { position, scale } of CHERRY_FRUITS) assert.ok(leaf.boundingBox!.min.y > fruit.boundingBox!.max.y * scale + position[1] + .08);
    assert.ok(leaf.boundingBox!.max.y < CHERRY_ATTACHMENT[1] - .025, 'leaf cannot enter the chain above its anchor');
  } finally { leaf.dispose(); fruit.dispose(); }
});

for (const [name, create, paths, normal] of [
  ['cupcake wrapper', createCupcakeWrapperGeometry, cupcakeWrapperStitchPaths, (point: Vector3) => new Vector3(point.x, -.204 * Math.hypot(point.x, point.z), point.z).normalize()],
  ['cupcake crown', createCupcakeFrostingGeometry, cupcakeFrostingStitchPaths, cupcakeFrostingNormalAtPoint],
] as const) test(`${name} stitches follow the actual curved surface without floating`, () => {
  const geometry = create(), material = new MeshBasicMaterial(), mesh = new Mesh(geometry, material);
  try {
    for (const path of paths()) for (const point of path) {
      const outward = normal(point), ray = new Raycaster(point.clone().addScaledVector(outward, .1), outward.clone().negate());
      const hit = ray.intersectObject(mesh)[0];
      assert.ok(hit, `${name} has outward geometry behind each stitch`);
      const gap = point.clone().sub(hit.point).dot(outward);
      assert.ok(gap > -.001 && gap < .003, `${name} stitch floats or sinks: ${gap}`);
    }
    for (const attribute of ['position', 'normal', 'uv']) assert.ok(geometry.getAttribute(attribute).array.every(Number.isFinite));
  } finally { geometry.dispose(); material.dispose(); }
});

test('cupcake wrapper and crown are capped solids whose joining surfaces overlap', () => {
  const wrapper = createCupcakeWrapperGeometry(), crown = createCupcakeFrostingGeometry(), material = new MeshBasicMaterial();
  try {
    for (const geometry of [wrapper, crown]) {
      const mesh = new Mesh(geometry, material);
      for (const side of [-1, 1]) {
        const ray = new Raycaster(new Vector3(.04, side, .03), new Vector3(0, -side, 0));
        assert.ok(ray.intersectObject(mesh)[0], 'vertical ray must hit a closed outward cap');
      }
      geometry.computeBoundingBox();
    }
    assert.ok(crown.boundingBox!.min.y < wrapper.boundingBox!.max.y, 'no floating gap between cup and crown');
    assert.ok(crown.boundingBox!.max.y > .328 && crown.boundingBox!.max.y < .446, 'cherry bottom embeds in crown while the hardware anchor stays clear');
    assert.deepEqual(CUPCAKE_ATTACHMENT, [0, .48, 0]);
  } finally { wrapper.dispose(); crown.dispose(); material.dispose(); }
});
