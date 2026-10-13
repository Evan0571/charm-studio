import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { Group, Mesh, MeshBasicMaterial, Quaternion, Raycaster, SphereGeometry, Vector3 } from 'three';
import { catalog, createDefaultConfig } from '../shared/catalog';
import { getStrands, partAttachmentPoint, pendantOffset } from '../src/three/assemblyLayout';
import { placeHangingAssembly } from '../src/three/assemblyPlacement';
import { createOrangeBodyGeometry } from '../src/three/orangeGeometry';
import { createPearBodyGeometry } from '../src/three/pearGeometry';
import { createBananaBodyGeometry } from '../src/three/bananaGeometry';
import { createLeatherLeafGeometry } from '../src/three/leatherGeometry';
import { BANANA_POSE, FRUIT_LEAF_POSES } from '../src/three/fruitAssembly';
import { collectPartColliders } from '../src/three/partCollisionGeometry';

before(async () => { await RAPIER.init(); });
const makers = { orange: createOrangeBodyGeometry, pear: createPearBodyGeometry, banana: createBananaBodyGeometry };
const zero = { x: 0, y: 0, z: 0 };
function fruitMeshes(shape: keyof typeof makers) {
  const root = new Group(), surface = new Mesh(makers[shape]());
  // Construct from the same authored surface and leaf transforms as the preview.
  surface.userData.colliderDensity = 1;
  root.add(surface);
  const leaf = new Mesh(createLeatherLeafGeometry()), pose = FRUIT_LEAF_POSES[shape];
  leaf.position.fromArray(pose.position); leaf.rotation.set(...pose.rotation); leaf.scale.fromArray(pose.scale ?? [1,1,1]);
  leaf.userData.colliderDensity = .2; root.add(leaf);
  if (shape === 'banana') { root.position.fromArray(BANANA_POSE.position); root.rotation.set(...BANANA_POSE.rotation); }
  return { root, surface, leaf, dispose: () => { surface.geometry.dispose(); leaf.geometry.dispose(); } };
}

for (const shape of Object.keys(makers) as (keyof typeof makers)[]) {
  test(`${shape} leather leaf stays outside the actual fruit surface`, () => {
    const { root, surface, leaf, dispose } = fruitMeshes(shape);
    const material = new MeshBasicMaterial(); surface.material = material;
    root.updateWorldMatrix(true, true);
    const local = surface.matrixWorld.clone().invert().multiply(leaf.matrixWorld), ray = new Raycaster();
    try {
      const points = leaf.geometry.getAttribute('position');
      // Work in the body mesh frame so rotations cannot conceal penetration.
      const body = new Mesh(surface.geometry, material);
      for (let i = 0; i < points.count; i++) {
        const point = new Vector3().fromBufferAttribute(points, i).applyMatrix4(local);
        ray.set(new Vector3(point.x, point.y, 2), new Vector3(0,0,-1));
        const front = ray.intersectObject(body)[0];
        ray.set(new Vector3(point.x, point.y, -2), new Vector3(0,0,1));
        const back = ray.intersectObject(body)[0];
        assert.ok(!front || !back || point.z > front.point.z + .001 || point.z < back.point.z - .001, `leaf intersects ${shape} at ${point.toArray()}`);
      }
    } finally { dispose(); material.dispose(); }
  });

  test(`${shape} balances below its own joint without pulling the chain sideways`, () => {
    for (const scale of [1, .52]) {
      const { root, dispose } = fruitMeshes(shape), physical = new Group(), world = new RAPIER.World({x:0,y:-9.81,z:0});
      world.integrationParameters.numSolverIterations = 12;
      try {
        const spec = getStrands(createDefaultConfig('hero'))[0], part = catalog.parts.find(p=>p.shape===shape)!;
        const attachment = partAttachmentPoint(part);
        const model = new Group(); model.scale.setScalar(spec.scale*scale);
        model.position.set(-attachment[0]*spec.scale*scale,(pendantOffset(part,spec)+spec.length)*scale,-attachment[2]*spec.scale*scale);
        model.add(root); physical.add(model);
        const anchor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setLinearDamping(1.7).setAngularDamping(4.5).setAdditionalSolverIterations(8));
        world.createCollider(RAPIER.ColliderDesc.capsule(.14*scale,.024*scale).setTranslation(0,-spec.length/2*scale,0).setMass(.006),body);
        const pendant = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setAngularDamping(4.5).setLinearDamping(1.7).setAdditionalSolverIterations(8));
        for (const {vertices,density} of collectPartColliders(physical)) world.createCollider(RAPIER.ColliderDesc.convexHull(vertices)!.setDensity(density),pendant);
        world.createImpulseJoint(RAPIER.JointData.spherical(zero,zero),anchor,body,true);
        world.createImpulseJoint(RAPIER.JointData.spherical({x:0,y:-spec.length*scale,z:0},zero),body,pendant,true).setContactsEnabled(false);
        placeHangingAssembly(world,[{body,anchor,side:1,pendant:{body:pendant,offset:[0,-spec.length*scale,0]}}]);
        const initial=pendant.rotation();
        for(let i=0;i<300;i++)world.step();
        const up=new Vector3(0,1,0).applyQuaternion(new Quaternion().copy(body.rotation()));
        assert.ok(Math.acos(Math.min(1,up.y)) < .006, 'chain must stay vertical under an off-center fruit');
        const com=pendant.worldCom(),pivot=pendant.translation();
        assert.ok(Math.hypot(com.x-pivot.x,com.z-pivot.z)<.001*scale,'fruit mass must hang beneath its stem');
        const q=pendant.rotation(), dot=Math.abs(q.x*initial.x+q.y*initial.y+q.z*initial.z+q.w*initial.w);
        assert.ok(2*Math.acos(Math.min(1,dot))<.01,'first visible pose must already be at rest');
      } finally {world.free();dispose();}
    }
  });
}

test('decorative meshes add neither convex-hull volume nor mass, including on scaled bags', () => {
  const root=new Group(),model=new Group(); root.scale.setScalar(.52);model.position.set(.2,-.8,.01);model.scale.setScalar(1.63);root.add(model);
  const geometry=new SphereGeometry(.26,12,8),body=new Mesh(geometry);body.userData.colliderDensity=1;model.add(body);
  const before=collectPartColliders(root);
  for(let i=0;i<12;i++){const trim=new Mesh(geometry);trim.scale.setScalar(3);model.add(trim);}
  const after=collectPartColliders(root);
  assert.equal(after.length,1); assert.deepEqual(after,before);
  assert.ok(after[0].vertices.every(Number.isFinite)); geometry.dispose();
});
