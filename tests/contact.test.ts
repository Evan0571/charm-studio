import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { SphereGeometry } from 'three';
import { beginGentleSway, limitStrandSpeed } from '../src/three/physics';

before(async()=>{await RAPIER.init();});
const v=(x=0,y=0,z=0)=>({x,y,z});

test('full-size pearl and neighboring chain separate and settle even with dynamic effects off',()=>{
  for(const scale of [1,.52])for(const motion of [false,true]){
    const world=new RAPIER.World(v(0,-9.81,0));
    world.integrationParameters.numSolverIterations=12;
    world.integrationParameters.maxCcdSubsteps=4;
    const bodies: RAPIER.RigidBody[]=[],colliders:RAPIER.Collider[][]=[];
    try{
      for(const [x,length,pearl] of [[-.18,.9,true],[0,1.65,false]] as const){
        const anchor=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x*scale,1.2*scale,0));
        const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x*scale,1.2*scale,0).setLinearDamping(1.7).setAngularDamping(4.5).setCcdEnabled(true));
        const strand=[world.createCollider(RAPIER.ColliderDesc.capsule((length-.09)/2*scale,.034*scale).setTranslation(0,-length/2*scale,0).setMass(.006).setFriction(.4),body)];
        if(pearl){
          // Same sphere vertices and hull generation as the visible pearl's MeshCollider.
          const geometry=new SphereGeometry(.26*scale,36,24);
          strand.push(world.createCollider(RAPIER.ColliderDesc.convexHull(geometry.getAttribute('position').array as Float32Array)!.setTranslation(0,(-length-.035-.29)*scale,0).setFriction(.45),body));
          geometry.dispose();
        }
        world.createImpulseJoint(RAPIER.JointData.spherical(v(),v()),anchor,body,true);
        bodies.push(body);colliders.push(strand);
      }
      // Reproduce the old visible overlap, then let collision response find a resting pose.
      const initial=colliders[0][1].contactCollider(colliders[1][0],0);
      assert.ok(initial&&initial.distance<-.05*scale,'fixture really starts intersecting');
      for(let frame=0;frame<900;frame++){
        if(frame===2&&motion)bodies.forEach(body=>beginGentleSway(body));
        world.step();
        for(const body of bodies){
          limitStrandSpeed(body);
          const w=body.angvel(),q=body.rotation();
          assert.ok([q.x,q.y,q.z,q.w].every(Number.isFinite));
          assert.ok(Math.hypot(w.x,w.y,w.z)<=.851,'contact never causes violent spinning');
        }
      }
      for(const a of colliders[0])for(const b of colliders[1]){
        const contact=a.contactCollider(b,.01*scale);
        assert.ok(!contact||contact.distance>-.005*scale,`resting penetration ${contact?.distance}; scale=${scale}, motion=${motion}`);
      }
      for(const body of bodies){const w=body.angvel();assert.ok(Math.hypot(w.x,w.y,w.z)<.03,'collision settles with no continuing motion');}
    } finally {world.free();}
  }
});
