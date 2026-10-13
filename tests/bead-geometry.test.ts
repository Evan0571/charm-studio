import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { BEAD_RADIUS, createBeadBodyGeometry, createBeadCapGeometry } from '../src/three/beadGeometry';
import { createBeadTextures } from '../src/three/beadMaterials';

test('all bead bodies retain a centered, closed suspension footprint and outward normals', () => {
  for (const shape of ['pearl', 'amethyst', 'jade', 'clear', 'wood']) {
    const geometry = createBeadBodyGeometry(shape), material = new MeshBasicMaterial(), mesh = new Mesh(geometry, material);
    try {
      for (const attribute of ['position', 'normal', 'uv']) assert.ok(geometry.getAttribute(attribute).array.every(Number.isFinite));
      const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
      for (let index = 0; index < positions.count; index++) {
        const position = new Vector3().fromBufferAttribute(positions, index);
        assert.ok(position.length() > .255 && position.length() < .263, `${shape} altered assembly clearance`);
        assert.ok(position.normalize().dot(new Vector3().fromBufferAttribute(normals, index)) > .9, `${shape} has inward or discontinuous surface normals`);
      }
      for (const direction of [new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)]) {
        const hit = new Raycaster(direction.clone(), direction.clone().negate()).intersectObject(mesh)[0];
        assert.ok(hit && Math.abs(hit.point.length() - BEAD_RADIUS) < .004, `${shape} is open from a principal view`);
      }
    } finally { geometry.dispose(); material.dispose(); }
  }
});

test('bead caps meet the top pole without increasing the pendant mounting height', () => {
  const geometry = createBeadCapGeometry();
  try {
    geometry.computeBoundingBox();
    assert.ok(geometry.boundingBox!.min.y < BEAD_RADIUS && geometry.boundingBox!.max.y > BEAD_RADIUS);
    assert.ok(geometry.boundingBox!.max.y < .29 && geometry.boundingBox!.max.x < .09);
  } finally { geometry.dispose(); }
});

test('wood and mineral maps meet continuously at their seams and poles', () => {
  for (const shape of ['wood', 'jade', 'pearl']) {
    const textures = createBeadTextures(shape);
    try {
      for (const texture of Object.values(textures)) {
        const { data, width, height } = texture.image;
        assert.ok(data, 'generated textures retain their pixel data');
        for (let row = 0; row < height; row++) {
          const start = row * width * 4, end = start + (width - 1) * 4;
          assert.deepEqual([...data.slice(start, start + 4)], [...data.slice(end, end + 4)], `${shape} texture longitude seam`);
        }
        for (const row of [0, height - 1]) for (let column = 1; column < width; column++) {
          const start = row * width * 4, sample = start + column * 4;
          assert.deepEqual([...data.slice(start, start + 4)], [...data.slice(sample, sample + 4)], `${shape} texture pole pinching`);
        }
      }
    } finally { Object.values(textures).forEach(texture => texture.dispose()); }
  }
});
