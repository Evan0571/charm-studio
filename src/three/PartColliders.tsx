import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ConvexHullCollider } from '@react-three/rapier';
import { Group } from 'three';
import { collectPartColliders } from './partCollisionGeometry';

export function PartColliders({ id, children }: { id?: string; children: ReactNode }) {
  const root = useRef<Group>(null);
  const [colliders, setColliders] = useState<ReturnType<typeof collectPartColliders>>([]);
  useLayoutEffect(() => {
    if (root.current) setColliders(collectPartColliders(root.current));
  }, [id]);
  return <group ref={root}>{children}{colliders.map(({ vertices, density }, i) =>
    <ConvexHullCollider key={i} args={[vertices]} density={density}/>
  )}</group>;
}
