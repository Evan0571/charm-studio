import type { RapierRigidBody } from '@react-three/rapier';

export const STRAND_SWAY_SPEED = .18;
export const BAG_FLOOR_Y = -2.2;

/**
 * Start a small physical pendulum motion without applying a mass-dependent impulse.
 * Collider.setMass() is deferred by Rapier until the next step; synchronizing here
 * prevents a newly replaced tiny collider from temporarily having near-zero inertia.
 * COM velocity follows the angular velocity so the attachment point stays still.
 */
export function beginGentleSway(body: RapierRigidBody, direction: -1 | 1 = 1) {
  body.recomputeMassPropertiesFromColliders();
  const center = body.worldCom();
  const pivot = body.translation();
  const speed = STRAND_SWAY_SPEED * direction;
  body.setAngvel({ x: 0, y: 0, z: speed }, true);
  body.setLinvel({ x: -speed * (center.y - pivot.y), y: speed * (center.x - pivot.x), z: 0 }, true);
}

/** Initial effects (including React Strict Mode's replay) are not design changes. */
export function consumeSignatureChange(previous: { current: string }, next: string): boolean {
  if (previous.current === next) return false;
  previous.current = next;
  return true;
}

/** Contact resolution may displace overlapping replacements, but must never spin them. */
export function limitStrandSpeed(body: RapierRigidBody) {
  const w=body.angvel(), speed=Math.hypot(w.x,w.y,w.z);
  if(speed>.85)body.setAngvel({x:w.x*.85/speed,y:w.y*.85/speed,z:w.z*.85/speed},false);
}
