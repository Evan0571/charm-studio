import { BufferGeometry, Float32BufferAttribute, IcosahedronGeometry, LatheGeometry, SphereGeometry, Vector2, Vector3 } from 'three';

export const BEAD_RADIUS = .26;

/** Round cut glass: enough small facets to catch light without a polygonal silhouette. */
export function createBeadBodyGeometry(shape: string): BufferGeometry {
  if (shape === 'clear' || shape === 'amethyst') {
    const geometry = new IcosahedronGeometry(BEAD_RADIUS, 3);
    const positions = geometry.getAttribute('position');
    const normals = new Float32Array(positions.count * 3);
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), face = new Vector3(), radial = new Vector3();
    for (let index = 0; index < positions.count; index += 3) {
      a.fromBufferAttribute(positions, index); b.fromBufferAttribute(positions, index + 1); c.fromBufferAttribute(positions, index + 2);
      face.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
      for (let vertex = 0; vertex < 3; vertex++) {
        radial.fromBufferAttribute(positions, index + vertex).normalize().lerp(face, .38).normalize();
        radial.toArray(normals, (index + vertex) * 3);
      }
    }
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    return geometry;
  }
  const geometry = new SphereGeometry(BEAD_RADIUS, 64, 48);
  if (shape === 'pearl') {
    const positions = geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index);
      // A tiny organic departure from a perfect ball; the mounting pole stays at y=.26.
      const swell = 1 + .005 * Math.sin(x * 17 + z * 9) * Math.sin(y * 12) * (1 - (y / BEAD_RADIUS) ** 2);
      positions.setXYZ(index, x * swell, y, z * swell);
    }
    // Preserve the sphere's smooth normals at duplicated UV poles and the seam.
    // This sub-percent swell should never introduce a faceted nacre highlight.
  }
  return geometry;
}

/** A shallow, closed stamped cup seated over the bead's top pole. */
export function createBeadCapGeometry() {
  const profile = [
    [.087, .244], [.085, .248], [.069, .254], [.048, .261], [.026, .266],
    [.010, .267], [.007, .264], [.024, .263], [.047, .258], [.067, .251], [.083, .245], [.087, .244],
  ];
  return new LatheGeometry(profile.map(([radius, height]) => new Vector2(radius, height)), 48);
}
