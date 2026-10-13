import assert from 'node:assert/strict';
import test from 'node:test';
import { cordLeadPoints, getStrands, LEATHER_LOOP, MAIN_RING, TRANSFER_RING, partAttachmentPoint, pendantPosition } from '../src/three/assemblyLayout';
import { catalog } from '../shared/catalog';
import { createLeatherBandGeometry, leatherBandEdgePaths, leatherBandStitchPaths } from '../src/three/connectorGeometry';
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

test('static previews keep every pendant eye attached at full size and on a bag', () => {
  for (const templateId of ['cord', 'chain', 'hero'] as const) {
    for (const spec of getStrands({templateId, connectorId:'ring'})) {
      for (const part of catalog.parts) for (const assemblyScale of [1, .52]) {
        const eye = new Vector3(...partAttachmentPoint(part)).multiplyScalar(spec.scale);
        eye.add(new Vector3(...pendantPosition(part, spec))).multiplyScalar(assemblyScale);
        const expected = new Vector3(0, -spec.length - .035, 0).multiplyScalar(assemblyScale);
        assert.ok(eye.distanceTo(expected) < 1e-8, `${templateId}/${part.id}: hanging eye misses the terminal ring`);
      }
    }
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

test('leather strap edge paint and saddle stitches stay on the tapered faces and upper fold', () => {
  const geometry = createLeatherBandGeometry(), material = new MeshBasicMaterial({side: DoubleSide});
  const mesh = new Mesh(geometry, material), ray = new Raycaster();
  try {
    for (const path of [...leatherBandEdgePaths(), ...leatherBandStitchPaths()]) for (const point of path) {
      const face = Math.sign(point.z);
      ray.set(new Vector3(point.x, point.y, face), new Vector3(0, 0, -face));
      const hit = ray.intersectObject(mesh)[0];
      assert.ok(hit, `detail floats outside the strap at ${point.x}, ${point.y}`);
      const gap = face * (point.z - hit.point.z);
      assert.ok(gap > -.002 && gap < .0025, `detail stays against the leather, gap=${gap}`);
    }
  } finally { geometry.dispose(); material.dispose(); }
});
