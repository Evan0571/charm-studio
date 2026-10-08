import type { RapierRigidBody } from '@react-three/rapier';

/** A revolute joint owns all angular constraints: do not combine this with body axis locks. */
export const STRAND_SWING_LIMIT = .18;
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
