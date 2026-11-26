"use client";
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { anchorWorld } from "./registry";
import { DESK_Y } from "./Cables";
import { ROOM } from "./Room";
import { MAT } from "./materials";

const WALL_X = ROOM.x0 + 0.07;

/** KL-21001 mains cable: out of the back of the unit, along the bench, up the wall to the strip */
function TrainerMains() {
  const geo = useMemo(() => {
    const pts = [
      new THREE.Vector3(-0.27, DESK_Y + 0.045, -0.29),
      new THREE.Vector3(-0.31, DESK_Y + 0.02, -0.33),
      new THREE.Vector3(-0.5, DESK_Y + 0.006, -0.44),
      new THREE.Vector3(-0.85, DESK_Y + 0.006, -0.47),
      new THREE.Vector3(-1.08, DESK_Y + 0.008, -0.42),
      new THREE.Vector3(-1.16, DESK_Y + 0.08, -0.36),
      new THREE.Vector3(WALL_X, 0.9, -0.29),
      new THREE.Vector3(WALL_X - 0.01, 1.0, -0.275),
    ];
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 90, 0.0034, 8, false);
  }, []);
  return (
    <mesh geometry={geo} castShadow>
      <meshPhysicalMaterial color="#111" roughness={0.5} clearcoat={0.2} />
    </mesh>
  );
}

/** the FNIRSI's white USB-C charging cable (follows the scope when it is moved) */
function ScopeUsb() {
  const ref = useRef<THREE.Mesh>(null);
  const last = useRef("");
  useFrame(() => {
    const m = ref.current;
    const a = anchorWorld("osc.usb");
    if (!m || !a) return;
    const key = a.toArray().map((x) => x.toFixed(3)).join();
    if (key === last.current) return;
    last.current = key;
    const pts = [
      a,
      a.clone().add(new THREE.Vector3(0, 0.03, -0.01)),
      new THREE.Vector3(a.x - 0.05, DESK_Y + 0.004, a.z - 0.12),
      new THREE.Vector3(Math.min(a.x - 0.25, -0.62), DESK_Y + 0.004, -0.02),
      new THREE.Vector3(-0.98, DESK_Y + 0.004, -0.3),
      new THREE.Vector3(-1.12, DESK_Y + 0.02, -0.38),
      new THREE.Vector3(WALL_X, 0.92, -0.37),
      new THREE.Vector3(WALL_X - 0.012, 1.0, -0.355),
    ];
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 110, 0.0018, 6, false);
    m.geometry.dispose();
    m.geometry = g;
  });
  return (
    <group>
      <mesh ref={ref} material={MAT.whiteAbs()} castShadow />
      {/* USB charger brick in the strip */}
      <mesh position={[WALL_X - 0.02, 1.02, -0.355]} material={MAT.whiteAbs()} castShadow>
        <boxGeometry args={[0.03, 0.045, 0.028]} />
      </mesh>
    </group>
  );
}

export function PowerCords() {
  return (
    <group>
      <TrainerMains />
      <ScopeUsb />
    </group>
  );
}
