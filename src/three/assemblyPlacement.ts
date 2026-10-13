import type { Collider, RigidBody, World } from '@dimforge/rapier3d-compat';
import { Euler, Quaternion, Vector3 } from 'three';
import type { DesignConfig } from '../../shared/types';

export interface HangingBody {
  body: RigidBody;
  anchor: RigidBody;
  side: -1 | 1;
  pendant?: { body: RigidBody; offset: [number, number, number] };
}

/** Rebuild all interacting strands for a geometry change, never for a color or selection. */
export function assemblyPhysicsKey(config: DesignConfig) {
  return JSON.stringify([config.templateId, config.connectorId, Object.entries(config.slots).sort(([a], [b]) => a.localeCompare(b))]);
}

const collidersOf = (body: RigidBody) => Array.from({ length: body.numColliders() }, (_, i) => body.collider(i));

/**
 * Run once before gravity, after all new mesh colliders exist. Each strand rotates
 * about its real suspension point, keeping the chain connected. Search starts
 * at gravitational equilibrium and moves outward from the bag. No old pose or momentum
 * participates, so swapping to a design and opening it fresh have the same start.
 */
export function placeHangingAssembly(world: World, strands: HangingBody[]) {
  const obstacles: Collider[] = [];
  world.forEachCollider(collider => { if (!collider.parent() || collider.parent()!.isFixed()) obstacles.push(collider); });
  const zero = { x: 0, y: 0, z: 0 };
  for (const { body, anchor, side, pendant } of strands) {
    body.setEnabled(true);
    body.setTranslation(anchor.translation(), true);
    body.setLinvel(zero, true); body.setAngvel(zero, true);
    body.resetForces(true); body.resetTorques(true);
    body.recomputeMassPropertiesFromColliders();
    let pendantRest = new Quaternion();
    if (pendant) {
      pendant.body.setEnabled(true);
      pendant.body.setLinvel(zero, true); pendant.body.setAngvel(zero, true);
      pendant.body.resetForces(true); pendant.body.resetTorques(true);
      pendant.body.recomputeMassPropertiesFromColliders();
      const center = pendant.body.localCom();
      // A banana rotates about its stem, independently of the chain carrying it.
      pendantRest = new Quaternion().setFromUnitVectors(new Vector3(center.x, center.y, center.z).normalize(), new Vector3(0, -1, 0));
    }
    const setPose = (rotation: Quaternion) => {
      body.setRotation(rotation, true);
      if (pendant) {
        const offset = new Vector3(...pendant.offset).applyQuaternion(rotation);
        const origin = anchor.translation();
        pendant.body.setTranslation(offset.add(new Vector3(origin.x, origin.y, origin.z)), true);
        pendant.body.setRotation(rotation.clone().multiply(pendantRest), true);
      }
      world.propagateModifiedBodyPositionsToColliders();
    };
    const own = [...collidersOf(body), ...(pendant ? collidersOf(pendant.body) : [])];
    const candidates = [0, .04, .08, .12, .18, .25, .34, .44, .56, .7].flatMap(pitch =>
      [0, .04, -.04, .08, -.08, .14, .22, .3].map(roll => ({ pitch, roll: roll * side, cost: pitch ** 2 + roll ** 2 * 1.5 }))
    ).sort((a, b) => a.cost - b.cost);
    let best = new Quaternion(), bestPenetration = Infinity;
    for (const { pitch, roll } of candidates) {
      const rotation = new Quaternion().setFromEuler(new Euler(-pitch, 0, roll));
      setPose(rotation);
      let penetration = 0;
      for (const collider of own) for (const obstacle of obstacles) {
        const contact = collider.contactCollider(obstacle, .002);
        if (contact) penetration = Math.max(penetration, .002 - contact.distance);
      }
      if (penetration < bestPenetration) { bestPenetration = penetration; best.copy(rotation); }
      if (penetration <= .0001) break;
    }
    setPose(best);
    obstacles.push(...own);
  }
  if (strands.some(strand => strand.pendant)) {
    // Resolve bag/adjacent-part contacts before the first visible frame. This is
    // the same solver and geometry as the live preview, independent of frame rate.
    const bodies = strands.flatMap(({ body, pendant }) => pendant ? [body, pendant.body] : [body]);
    const timestep = world.timestep;
    world.timestep = 1 / 60;
    let quietSteps = 0;
    for (let step = 0; step < 1200; step++) {
      world.step();
      const quiet = bodies.every(body => {
        const w = body.angvel(), v = body.linvel();
        return Math.hypot(w.x, w.y, w.z) < .003 && Math.hypot(v.x, v.y, v.z) < .001;
      });
      quietSteps = quiet ? quietSteps + 1 : 0;
      if (step >= 180 && quietSteps >= 30) break;
    }
    world.timestep = timestep;
    for (const body of bodies) {
      body.setLinvel(zero, false); body.setAngvel(zero, false);
      body.sleep();
    }
  }
}
