import assert from 'node:assert/strict';
import test from 'node:test';
import { getStrands, LEATHER_LOOP, MAIN_RING } from '../src/three/assemblyLayout';

test('both hero chains start on their supporting loop for either connector', () => {
  for (const connectorId of ['ring', 'leather']) {
    const radius = connectorId === 'leather' ? LEATHER_LOOP.bottomRadius : .087;
    const centerY = connectorId === 'leather' ? LEATHER_LOOP.bottomRingY : 1.09;
    for (const strand of getStrands({ templateId: 'hero', connectorId })) {
      const [x, y, z] = strand.anchor;
      assert.ok(Math.abs(Math.hypot(x, y - centerY) - radius) < 1e-8, `${connectorId}/${strand.id} floats outside its supporting loop`);
      assert.equal(z, 0);
      assert.ok(y < centerY, 'chains must hang from the lower half of the loop');
    }
  }
});

test('all metal-chain pivots follow the main ring lower arc', () => {
  for (const strand of getStrands({ templateId: 'chain', connectorId: 'ring' })) {
    const [x, y] = strand.anchor;
    assert.ok(Math.abs(Math.hypot(x, y - MAIN_RING.centerY) - MAIN_RING.radius) < 1e-8);
  }
});
