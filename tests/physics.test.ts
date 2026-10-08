import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import type { RapierRigidBody } from '@react-three/rapier';
import RAPIER from '@dimforge/rapier3d-compat';
import { catalog, createDefaultConfig } from '../shared/catalog';
import { getStrands, pendantOffset, getMountedAssembly, BAG_CHARM_SCALE, type XYZ } from '../src/three/assemblyLayout';
import { bagAttachmentPose, type BagStyle } from '../src/three/bagAttachment';
import type { DesignConfig } from '../shared/types';
import { beginGentleSway, consumeSignatureChange, limitStrandSpeed, BAG_FLOOR_Y } from '../src/three/physics';

before(async () => { await RAPIER.init(); });
const vec = (x = 0, y = 0, z = 0) => ({ x, y, z });

function fixture(scale: number, small: boolean) {
  const world = new RAPIER.World(vec(0, -9.81, 0));
  world.integrationParameters.numSolverIterations = 8;
  const anchor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 1.03, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1.03, 0).setLinearDamping(1.7).setAngularDamping(3.8));
  const length = small ? .35 : .41, partScale = small ? .45 : 1.63;
  const centerY = -length - .035 - (small ? .29 : .5) * partScale;
  const cord = world.createCollider(RAPIER.ColliderDesc.ball(.01 * scale).setTranslation(0, -length * .5 * scale, 0), body);
  cord.setMass(.006);
  const pendant = world.createCollider(RAPIER.ColliderDesc.ball(.13 * partScale * scale).setTranslation(0, centerY * scale, 0), body);
  pendant.setMass(.07);
  const joint = RAPIER.JointData.spherical(vec(), vec());
  world.createImpulseJoint(joint, anchor, body, true);
  return { world, body, pendant, scale };
}
function simulate(world: InstanceType<typeof RAPIER.World>, body: RapierRigidBody, steps = 360) {
  let maxAngle = 0, maxSpeed = 0;
  for (let i = 0; i < steps; i++) {
    world.step();
    const q = body.rotation(), w = body.angvel();
    const angle = Math.acos(Math.min(1, Math.abs(q.w))) * 2;
    assert.ok(Number.isFinite(angle) && [w.x, w.y, w.z].every(Number.isFinite), 'solver stays finite');
    maxAngle = Math.max(maxAngle, angle);
    maxSpeed = Math.max(maxSpeed, Math.hypot(w.x, w.y, w.z));
    assert.ok(Math.abs(Math.hypot(q.x,q.y,q.z,q.w)-1)<1e-5,'orientation remains normalized');
  }
  return { maxAngle, maxSpeed };
}

test('Strict Mode effect replay and scene remount never count as a component replacement', () => {
  const previous = { current: 'banana:pearl:gold' };
  assert.equal(consumeSignatureChange(previous, previous.current), false);
  assert.equal(consumeSignatureChange(previous, previous.current), false);
  assert.equal(consumeSignatureChange(previous, 'pear:pearl:gold'), true);
  assert.equal(consumeSignatureChange(previous, 'pear:pearl:gold'), false);
  const remounted = { current: previous.current };
  assert.equal(consumeSignatureChange(remounted, previous.current), false);
});

test('large and tiny pendants stay at rest on initial load at full and bag-preview scales', () => {
  for (const scale of [1, .52]) for (const small of [false, true]) {
    const { world, body } = fixture(scale, small);
    try { const result = simulate(world, body); assert.ok(result.maxAngle < .001); assert.ok(result.maxSpeed < .001); }
    finally { world.free(); }
  }
});

test('replacement cue synchronizes tiny-collider mass and produces a bounded gentle sway', () => {
  for (const scale of [1, .52]) for (const small of [false, true]) {
    const { world, body } = fixture(scale, small);
    try {
      // Intentionally cue before the first step: the former torque-impulse implementation
      // applied to stale density-based inertia and flipped the tiny pendant at ~158 rad/s.
      beginGentleSway(body);
      assert.ok(Math.abs(body.mass() - .076) < 1e-6, 'all collider masses are synchronized');
      const result = simulate(world, body);
      assert.ok(result.maxAngle > .005, 'a real visible pendulum movement occurs');
      assert.ok(result.maxAngle < .07, `gentle sway stays under four degrees: ${result.maxAngle}`);
      assert.ok(result.maxSpeed < .25, 'no high-speed startup spin');
    } finally { world.free(); }
  }
});

test('repeated component swaps reset bounded velocity instead of accumulating impulses', () => {
  const { world, body, pendant } = fixture(.52, true);
  try {
    for (let i = 0; i < 24; i++) {
      pendant.setMass(i % 2 ? .014 : .07);
      beginGentleSway(body, i % 2 ? -1 : 1);
      const result = simulate(world, body, 18);
      assert.ok(result.maxAngle <= .35);
      assert.ok(result.maxSpeed < .5);
    }
    const result = simulate(world, body);
    assert.ok(result.maxAngle <= .35);
  } finally { world.free(); }
});


function assemblyFixture(config: DesignConfig, bagStyle?: BagStyle) {
  const world = new RAPIER.World(vec(0, -9.81, 0));
  world.integrationParameters.numSolverIterations = 8;
  const scale = bagStyle ? BAG_CHARM_SCALE : 1;
  const offset: XYZ = bagStyle ? getMountedAssembly(bagAttachmentPose(bagStyle).innerContact, config.connectorId).position : [0, .08, 0];
  // A rendering plane must not push long strands through their joint. Match the
  // scene's floor, below the lowest mini-bag mount and its longest hanging part.
  world.createCollider(RAPIER.ColliderDesc.cuboid(8, .1, 8).setTranslation(0, (bagStyle ? BAG_FLOOR_Y : -1.95) - .1, 0));
  if (bagStyle) {
    const half: XYZ = bagStyle === 'tote' ? [1.56, 1.06, .53] : bagStyle === 'shoulder' ? [1.42, .77, .51] : [.97, .68, .39];
    world.createCollider(RAPIER.ColliderDesc.cuboid(...half).setTranslation(-.35, -.65, -.36));
  }
  const bodies = getStrands(config).map(spec => {
    const pos = spec.anchor.map((v, i) => v * scale + offset[i]) as XYZ;
    const anchor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...pos));
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...pos).setLinearDamping(1.7).setAngularDamping(3.8));
    const part = catalog.parts.find(p => p.id === config.slots[spec.charmSlot]);
    const bead = catalog.parts.find(p => spec.beadSlot && p.id === config.slots[spec.beadSlot]);
    const add = (radius: number, y: number, mass: number) => {
      const collider = world.createCollider(RAPIER.ColliderDesc.ball(radius * scale).setTranslation(0, y * scale, 0), body);
      collider.setMass(mass);
    };
    add(.01, -spec.length * .5, .006);
    if (part) add(.13 * spec.scale, pendantOffset(part, spec), .07);
    if (bead) add(.11, -spec.length * .66, .018);
    const joint = RAPIER.JointData.spherical(vec(), vec());
      world.createImpulseJoint(joint, anchor, body, true);
    return body;
  });
  return { world, bodies };
}

test('all three templates remain stable through startup, swap and scene remount on all bags', () => {
  for (const template of catalog.templates) for (const connectorId of template.connectorIds) {
    for (const bagStyle of [undefined, 'tote', 'shoulder', 'mini'] as const) {
      const config = { ...createDefaultConfig(template.id), connectorId };
      const { world, bodies } = assemblyFixture(config, bagStyle);
      try {
        for (let step = 0; step < 720; step++) {
          if (step === 2 || step === 360) bodies.forEach((body, i) => beginGentleSway(body, getStrands(config)[i].anchor[0] < 0 ? -1 : 1));
          world.step();
          for (const body of bodies) {
            const q = body.rotation(), w = body.angvel();
            const angle = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
            const name = `${template.id}/${connectorId}/${bagStyle ?? 'standalone'} step ${step}`;
            assert.ok(Number.isFinite(angle), name);
            assert.ok(angle < .35, `bounded swing: ${name}: ${angle}`);
            assert.ok(Math.hypot(w.x, w.y, w.z) < .6, `no startup spin: ${name}`);
            if (step < 2) assert.ok(angle < .002, `initial placement has no collision-driven rotation: ${name}`);
            if (step < 360) assert.ok(angle < .07, `startup cue is a gentle sway, not a spin: ${name}`);
          }
        }
      } finally { world.free(); }
      // Toggling motion or changing bags remounts a fresh assembly at rest.
      const remount = assemblyFixture(config, bagStyle);
      try { for (let step = 0; step < 360; step++) { if (step === 2) remount.bodies.forEach((body, i) => beginGentleSway(body, getStrands(config)[i].anchor[0] < 0 ? -1 : 1)); remount.world.step(); for (const body of remount.bodies) assert.ok(2 * Math.acos(Math.min(1, Math.abs(body.rotation().w))) < .07); } }
      finally { remount.world.free(); }
    }
  }
});

test('empty optional positions do not leave phantom collision masses or destabilize a replacement', () => {
  for (const template of catalog.templates) {
    const config = createDefaultConfig(template.id);
    for (const slot of Object.keys(config.slots)) config.slots[slot] = null;
    const { world, bodies } = assemblyFixture(config, 'mini');
    try {
      world.step();
      for (const body of bodies) { assert.ok(Math.abs(body.mass() - .006) < 1e-6); beginGentleSway(body); }
      for (let step = 0; step < 360; step++) {
        world.step();
        for (const body of bodies) {
          const q = body.rotation();
          assert.ok(Number.isFinite(q.w));
          assert.ok(2 * Math.acos(Math.min(1, Math.abs(q.w))) <= .35);
        }
      }
    } finally { world.free(); }
  }
});
