"use client";
import * as THREE from "three";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { surfaces } from "./registry";

/**
 * Batches the static scenery below it: meshes that share a material (and shadow
 * flags) are merged into one geometry, so hundreds of furniture pieces cost a
 * handful of draw calls. Anything interactive (event handlers), registered as a
 * placement surface, instanced, multi-material or flagged `userData.noMerge`
 * (e.g. the clock with moving hands) is left as it is.
 */
export function MergeStatic({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const g = root.current;
    if (!g) return;
    g.updateMatrixWorld(true);
    const toLocal = g.matrixWorld.clone().invert();
    const buckets = new Map<string, { mat: THREE.Material; cast: boolean; receive: boolean; items: THREE.Mesh[] }>();
    const skip = (o: THREE.Object3D) => {
      for (let p: THREE.Object3D | null = o; p && p !== g; p = p.parent) {
        if (p.userData.noMerge) return true;
        const h = (p as unknown as { __r3f?: { handlers?: Record<string, unknown> } }).__r3f?.handlers;
        if (h && Object.keys(h).length) return true;
      }
      return false;
    };
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material) || !m.visible) return;
      if (surfaces.has(m) || skip(m) || !m.geometry.attributes.position) return;
      const mat = m.material as THREE.Material;
      if (mat.transparent) return;
      const key = `${mat.uuid}|${m.castShadow}|${m.receiveShadow}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { mat, cast: m.castShadow, receive: m.receiveShadow, items: [] }));
      b.items.push(m);
    });
    const added: THREE.Mesh[] = [];
    const hidden: THREE.Mesh[] = [];
    for (const b of buckets.values()) {
      if (b.items.length < 2) continue;
      const geos: THREE.BufferGeometry[] = [];
      for (const m of b.items) {
        const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        const q = new THREE.BufferGeometry();
        q.setAttribute("position", src.attributes.position);
        if (src.attributes.normal) q.setAttribute("normal", src.attributes.normal);
        else q.computeVertexNormals();
        q.setAttribute("uv", src.attributes.uv ?? new THREE.BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
        q.applyMatrix4(m.matrixWorld.clone().premultiply(toLocal));
        geos.push(q);
      }
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, b.mat);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.receive;
      mesh.matrixAutoUpdate = false;
      g.add(mesh);
      added.push(mesh);
      for (const m of b.items) {
        m.visible = false;
        hidden.push(m);
      }
    }
    return () => {
      for (const m of added) {
        g.remove(m);
        m.geometry.dispose();
      }
      for (const m of hidden) m.visible = true;
    };
  }, []);
  return <group ref={root}>{children}</group>;
}
