import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { assemblyPhysicsKey, placeHangingAssembly, type HangingBody } from '../src/three/assemblyPlacement';
import { createDefaultConfig } from '../shared/catalog';
import { limitStrandSpeed } from '../src/three/physics';

before(async () => { await RAPIER.init(); });
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });

function crowdedFixture(scale: number, oldPose: boolean, radius: number) {
  const world = new RAPIER.World(v(0, -9.81, 0));
  world.integrationParameters.numSolverIterations = 12;
  // A front-facing leather panel, with only a small clearance at the suspension.
  const bag = world.createCollider(RAPIER.ColliderDesc.cuboid(2 * scale, 2 * scale, .2 * scale).setTranslation(0, -.8 * scale, -.2 * scale));
  const strands: HangingBody[] = [-1, 1].map(side => {
    const anchor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(side * .15 * scale, .8 * scale, .09 * scale));
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(anchor.translation().x, anchor.translation().y, anchor.translation().z).setLinearDamping(1.7).setAngularDamping(4.5).setCcdEnabled(true));
    world.createCollider(RAPIER.ColliderDesc.capsule(.3 * scale, .025 * scale).setTranslation(0, -.34 * scale, 0).setMass(.006), body);
    world.createCollider(RAPIER.ColliderDesc.ball(radius * scale).setTranslation(0, -.92 * scale, 0).setFriction(.45), body);
    world.createImpulseJoint(RAPIER.JointData.spherical(v(), v()), anchor, body, true);
    if (oldPose) {
      body.setRotation({ x: .24, y: .58, z: .1, w: Math.sqrt(1 - .24 ** 2 - .58 ** 2 - .1 ** 2) }, true);
      body.setAngvel(v(2, -4, 1), true); body.setLinvel(v(.2, 0, -.3), true);
    }
    return { body, anchor, side: side as -1 | 1 };
  });
  world.propagateModifiedBodyPositionsToColliders();
  return { world, bag, strands };
}

test('large replacements start clear of the bag and each other without breaking their suspension points', () => {
  for (const scale of [1, .52]) for (const radius of [.08, .28]) {
    const { world, bag, strands } = crowdedFixture(scale, true, radius);
    try {
      assert.ok(strands.some(({ body }) => (body.collider(1).contactCollider(bag, 0)?.distance ?? 0) < -.03 * scale), 'old pose reproduces insertion into the bag');
      placeHangingAssembly(world, strands);
      strands.forEach(({ body, anchor }, index) => {
        assert.deepEqual(body.translation(), anchor.translation());
        assert.deepEqual({ ...body.linvel() }, v()); assert.deepEqual({ ...body.angvel() }, v());
        for (let i = 0; i < body.numColliders(); i++) {
          assert.ok((body.collider(i).contactCollider(bag, .01)?.distance ?? .01) > -.0001);
          for (const earlier of strands.slice(0, index)) for (let j = 0; j < earlier.body.numColliders(); j++) {
            assert.ok((body.collider(i).contactCollider(earlier.body.collider(j), .01)?.distance ?? .01) > -.0001);
          }
        }
      });
      for (let i = 0; i < 900; i++) { world.step(); strands.forEach(({ body }) => limitStrandSpeed(body)); }
      for (const { body, anchor } of strands) {
        const p = body.translation(), a = anchor.translation(), w = body.angvel();
        assert.ok(Math.hypot(p.x-a.x, p.y-a.y, p.z-a.z) < .004 * scale, 'joint remains attached after settling');
        assert.ok(Math.hypot(w.x, w.y, w.z) < .025, 'replacement reaches rest');
        assert.ok((body.collider(1).contactCollider(bag, .01)?.distance ?? .01) > -.004 * scale, 'no resting penetration into the bag');
      }
    } finally { world.free(); }
  }
});

test('fresh previews and replacements converge to the same pose regardless of old rotation and momentum', () => {
  const fresh = crowdedFixture(.52, false, .28), replaced = crowdedFixture(.52, true, .28);
  try {
    for (const fixture of [fresh, replaced]) {
      placeHangingAssembly(fixture.world, fixture.strands);
      for (let i = 0; i < 600; i++) { fixture.world.step(); fixture.strands.forEach(({ body }) => limitStrandSpeed(body)); }
    }
    fresh.strands.forEach(({ body }, i) => {
      const expected = body.rotation(), actual = replaced.strands[i].body.rotation();
      assert.ok(Math.hypot(expected.x-actual.x, expected.y-actual.y, expected.z-actual.z, expected.w-actual.w) < .001);
    });
  } finally { fresh.world.free(); replaced.world.free(); }
});

test('geometry changes restart the assembly while color and lock changes preserve its state', () => {
  const config = createDefaultConfig('hero'), key = assemblyPhysicsKey(config);
  assert.notEqual(assemblyPhysicsKey({ ...config, slots: { ...config.slots, main: 'cherry' } }), key);
  assert.equal(assemblyPhysicsKey({ ...config, metalTone: 'silver', cordColor: 'cocoa', lockedSlots: ['main'] }), key);
  assert.equal(assemblyPhysicsKey({ ...config, slots: Object.fromEntries(Object.entries(config.slots).reverse()) }), key);
});
