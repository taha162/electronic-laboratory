"use client";
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useBench } from "@/store/bench";
import { deskTexture } from "./draw/textures";
import { laminateMaps } from "./draw/pbr";
import { surfaces } from "./registry";
import { DESK_Y } from "./Cables";

/**
 * The work surface only: the white laminate bench top the trainer and the
 * instruments stand on. It is a placement surface (leads are put down on it)
 * and tapping it cancels a half-made connection.
 */
export function Bench() {
  const top = useRef<THREE.Mesh>(null);
  useEffect(() => {
    const t = top.current;
    if (t) surfaces.add(t);
    return () => {
      if (t) surfaces.delete(t);
    };
  }, []);
  const tex = deskTexture();
  const mats = useMemo(() => {
    const lam = laminateMaps();
    const edge = new THREE.MeshStandardMaterial({ color: "#d8d6cf", roughness: 0.45 });
    const t = new THREE.MeshPhysicalMaterial({
      map: tex,
      roughness: 1,
      roughnessMap: lam.rough,
      normalMap: lam.normal,
      normalScale: new THREE.Vector2(0.25, 0.25),
      clearcoat: 0.15,
      clearcoatRoughness: 0.5,
    });
    return [edge, edge, t, edge, edge, edge];
  }, [tex]);
  return (
    <mesh
      ref={top}
      position={[0.02, DESK_Y - 0.015, -0.02]}
      material={mats}
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        useBench.getState().cancel();
      }}
    >
      <boxGeometry args={[1.7, 0.03, 0.92]} />
    </mesh>
  );
}
