import assert from 'node:assert/strict';
import test from 'node:test';
import { cordLeadPoints, getStrands, LEATHER_LOOP, MAIN_RING, TRANSFER_RING } from '../src/three/assemblyLayout';
import { createLeatherBandGeometry } from '../src/three/connectorGeometry';
import { Raycaster, Mesh, MeshBasicMaterial, DoubleSide, Vector3 } from 'three';

test('both hero chains start on their supporting loop for either connector', () => {
  for (const connectorId of ['ring', 'leather']) {
    const radius = connectorId === 'leather' ? LEATHER_LOOP.bottomRadius : TRANSFER_RING.radius;
    const centerY = connectorId === 'leather' ? LEATHER_LOOP.bottomRingY : TRANSFER_RING.centerY;
    for (const strand of getStrands({ templateId: 'hero', connectorId })) {
      const [x, y, z] = strand.anchor;
      assert.ok(Math.abs(Math.hypot(x, y - centerY, z) - radius) < 1e-8, `${connectorId}/${strand.id} floats outside its supporting loop`);
      assert.equal(connectorId === 'leather' ? z : x, 0);
      assert.ok(y < centerY, 'chains must hang from the lower half of the loop');
    }
  }
});

test('all three braided cords meet their fixed leads in every axis', () => {
  for (const strand of getStrands({templateId:'cord',connectorId:'ring'})) {
    assert.deepEqual(cordLeadPoints(strand.anchor).at(-1),strand.anchor);
  }
});

test('perpendicular transfer ring interlocks without touching the main metal ring', () => {
  let clearance=Infinity;
  for(let i=0;i<360;i++)for(let j=0;j<360;j++){
    const a=i*Math.PI/180,b=j*Math.PI/180;
    clearance=Math.min(clearance,Math.hypot(MAIN_RING.radius*Math.cos(a),MAIN_RING.centerY+MAIN_RING.radius*Math.sin(a)-TRANSFER_RING.centerY-TRANSFER_RING.radius*Math.sin(b),TRANSFER_RING.radius*Math.cos(b)));
  }
  assert.ok(clearance>MAIN_RING.wire+TRANSFER_RING.wire,`metal surfaces overlap: ${clearance}`);
  assert.ok(TRANSFER_RING.centerY+TRANSFER_RING.radius>MAIN_RING.centerY-MAIN_RING.radius+MAIN_RING.wire,'upper arc must pass inside the main ring');
});

test('folded leather has continuous curved ends and a hollow interior', () => {
  const geometry=createLeatherBandGeometry(),material=new MeshBasicMaterial({side:DoubleSide}),mesh=new Mesh(geometry,material);
  const hit=(from:Vector3,to:Vector3)=>new Raycaster(from,to).intersectObject(mesh).length;
  assert.ok(hit(new Vector3(0,1.5,.3),new Vector3(0,0,-1))>=4,'front and back both have thickness');
  assert.ok(hit(new Vector3(0,1.5,0),new Vector3(0,1,0))>0,'top fold closes the strip');
  assert.ok(hit(new Vector3(0,1.5,0),new Vector3(0,-1,0))>0,'bottom fold closes the strip');
  assert.equal(hit(new Vector3(.3,1.5,0),new Vector3(-1,0,0)),0,'side opening stays hollow');
  geometry.dispose();material.dispose();
});

test('all metal-chain pivots follow the main ring lower arc', () => {
  for (const strand of getStrands({ templateId: 'chain', connectorId: 'ring' })) {
    const [x, y] = strand.anchor;
    assert.ok(Math.abs(Math.hypot(x, y - MAIN_RING.centerY) - MAIN_RING.radius) < 1e-8);
  }
});
