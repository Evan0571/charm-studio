import test from 'node:test';
import assert from 'node:assert/strict';
import { DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial, Raycaster, Texture, Vector3 } from 'three';
import { createMiniBodyGeometry, createMiniFlapGeometry, miniQuiltLines } from '../src/three/miniBagGeometry';
import { cloneBagMaterial } from '../src/three/bagMaterials';
import { normalizeBagColor } from '../src/three/bagColors';

test('mini quilt stitches contact the actual rounded mesh, including its side and bottom corners', () => {
  const geometry = createMiniBodyGeometry(), material = new MeshBasicMaterial({ side: DoubleSide });
  const mesh = new Mesh(geometry, material), ray = new Raycaster();
  const lines = miniQuiltLines();
  assert.ok(lines.length > 10);
  for (const line of lines) for (const [x, y, z] of line) {
    ray.set(new Vector3(x, y, 1), new Vector3(0, 0, -1));
    const hit = ray.intersectObject(mesh)[0];
    assert.ok(hit, `stitch at ${x}, ${y} must have leather behind it`);
    assert.ok(Math.abs(z - hit.point.z) < .0025, `stitch tube must touch leather, gap=${z - hit.point.z}`);
  }
  geometry.dispose(); material.dispose();
});

test('mini flap wraps from the front over the crown and back with only leather thickness above the body', () => {
  const body = createMiniBodyGeometry(), flap = createMiniFlapGeometry();
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const shellMesh = new Mesh(body, material), flapMesh = new Mesh(flap, material);
  const probes = [
    ...[-1, -.8, 0, .8, 1].flatMap(x => [-.4, -.1, .10].map(y => ({ origin: new Vector3(x, y, 1), dir: new Vector3(0, 0, -1) }))),
    ...[-1, 0, 1].flatMap(x => [-.2, 0, .2].map(z => ({ origin: new Vector3(x, 1, z), dir: new Vector3(0, -1, 0) }))),
    { origin: new Vector3(0, .2, -1), dir: new Vector3(0, 0, 1) },
  ];
  for (const { origin, dir } of probes) {
    const ray = new Raycaster(origin, dir), shellHit = ray.intersectObject(shellMesh)[0];
    const hits = ray.intersectObject(flapMesh);
    assert.ok(shellHit && hits.length >= 2, 'every front/top/back probe meets a closed leather sheet');
    assert.ok(shellHit.distance - hits[0].distance < .065, 'flap does not bulge or hover above the shell');
    assert.ok(hits.some(hit => Math.abs(hit.distance - shellHit.distance) < .006), 'underside stays in contact with the shell');
  }
  body.dispose(); flap.dispose(); material.dispose();
});

test('bag colors preserve grain and isolate cached materials, hardware, lining, and original appearance', () => {
  const normal = new Texture(), roughness = new Texture(), albedo = new Texture();
  const leather = new MeshStandardMaterial({ color: '#865134', map: albedo, normalMap: normal, roughnessMap: roughness });
  leather.name = 'Cognac leather — Poly Haven normal and color';
  const ivory = cloneBagMaterial(leather, '#eee6d8');
  assert.notEqual(ivory, leather);
  assert.equal(ivory.color.getHexString(), 'eee6d8');
  assert.equal(ivory.map, null, 'brown albedo must not contaminate custom colors');
  assert.equal(ivory.normalMap, normal); assert.equal(ivory.roughnessMap, roughness);
  assert.equal(leather.color.getHexString(), '865134'); assert.equal(leather.map, albedo);
  const original = cloneBagMaterial(leather);
  assert.equal(original.color.getHexString(), '865134'); assert.equal(original.map, albedo);
  for (const name of ['Brushed warm brass', 'Champagne hardware', 'Suede lining', 'Dark suede interior']) {
    const source = new MeshStandardMaterial({ color: '#98764f', metalness: .88 }); source.name = name;
    const tinted = cloneBagMaterial(source, '#792e42');
    assert.equal(tinted.color.getHexString(), source.color.getHexString());
    assert.equal(tinted.metalness, source.metalness);
    source.dispose(); tinted.dispose();
  }
  for (const name of ['Hand-painted leather edges', 'Sand edge paint', 'Saddle stitching', 'Ivory stitching']) {
    leather.name = name; const tinted = cloneBagMaterial(leather, '#792e42');
    assert.notEqual(tinted.color.getHexString(), leather.color.getHexString()); tinted.dispose();
  }
  [leather, ivory, original, normal, roughness, albedo].forEach(resource => resource.dispose());
});

test('custom bag colors accept complete hex values and reject incomplete or invalid input', () => {
  assert.equal(normalizeBagColor(' #Ab12EF '), '#ab12ef');
  assert.equal(normalizeBagColor('abcdef'), '#abcdef');
  for (const value of ['', '#', '#abcd', '#abcdeg', '#1234567', 'red']) assert.equal(normalizeBagColor(value), undefined);
});
