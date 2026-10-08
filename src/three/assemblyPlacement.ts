import type { Collider, RigidBody, World } from '@dimforge/rapier3d-compat';
import { Euler, Quaternion } from 'three';
import type { DesignConfig } from '../../shared/types';

export interface HangingBody {
  body: RigidBody;
  anchor: RigidBody;
  side: -1 | 1;
}

/** Rebuild all interacting strands for a geometry change, never for a color or selection. */
export function assemblyPhysicsKey(config: DesignConfig) {
  return JSON.stringify([config.templateId, config.connectorId, Object.entries(config.slots).sort(([a], [b]) => a.localeCompare(b))]);
}

const collidersOf = (body: RigidBody) => Array.from({ length: body.numColliders() }, (_, i) => body.collider(i));

/**
 * Run once before gravity, after all new mesh colliders exist. Each strand rotates
 * about its real suspension point, keeping the chain connected. Search starts
 * upright and moves outward from the bag, never through it. No old pose or momentum
 * participates, so swapping to a design and opening it fresh have the same start.
 */
export function placeHangingAssembly(world: World, strands: HangingBody[]) {
  const obstacles: Collider[] = [];
  world.forEachCollider(collider => { if (!collider.parent() || collider.parent()!.isFixed()) obstacles.push(collider); });
  const zero = { x: 0, y: 0, z: 0 };
  for (const { body, anchor, side } of strands) {
    body.setTranslation(anchor.translation(), true);
    body.setLinvel(zero, true); body.setAngvel(zero, true);
    body.resetForces(true); body.resetTorques(true);
    body.recomputeMassPropertiesFromColliders();
    const own = collidersOf(body);
    const candidates = [0, .04, .08, .12, .18, .25, .34, .44, .56, .7].flatMap(pitch =>
      [0, .04, -.04, .08, -.08, .14, .22, .3].map(roll => ({ pitch, roll: roll * side, cost: pitch ** 2 + roll ** 2 * 1.5 }))
    ).sort((a, b) => a.cost - b.cost);
    let best = new Quaternion(), bestPenetration = Infinity;
    for (const { pitch, roll } of candidates) {
      const rotation = new Quaternion().setFromEuler(new Euler(-pitch, 0, roll));
      body.setRotation(rotation, true);
      world.propagateModifiedBodyPositionsToColliders();
      let penetration = 0;
      for (const collider of own) for (const obstacle of obstacles) {
        const contact = collider.contactCollider(obstacle, .002);
        if (contact) penetration = Math.max(penetration, .002 - contact.distance);
      }
      if (penetration < bestPenetration) { bestPenetration = penetration; best.copy(rotation); }
      if (penetration <= .0001) break;
    }
    body.setRotation(best, true);
    world.propagateModifiedBodyPositionsToColliders();
    obstacles.push(...own);
  }
}
