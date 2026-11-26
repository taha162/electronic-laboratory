"use client";
import * as THREE from "three";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useBench } from "@/store/bench";
import { registerAnchor, unregisterAnchor, useUi, mm } from "./registry";
import { MAT, plastic, geo } from "./materials";
import { knobAngle } from "./draw/textures";
import type { JackDef } from "@/lab/types";

function setCursor(c: string) {
  if (typeof document !== "undefined") document.body.style.cursor = c;
}

/* ---------------------------------------------------------------- */
/* 4 mm banana socket (main unit)                                     */
/* ---------------------------------------------------------------- */
export function BananaJack({ gid, x, z, style, label }: { gid: string; x: number; z: number; style: string; label: string }) {
  const ref = useRef<THREE.Group>(null);
  const active = useBench((s) => s.pending === gid);
  const hovered = useUi((s) => s.hover?.id === gid);
  useLayoutEffect(() => {
    if (ref.current) registerAnchor(gid, ref.current, new THREE.Vector3(0, 0.0075, 0));
    return () => unregisterAnchor(gid);
  }, [gid]);
  const hex = geo("jack-hex", () => new THREE.CylinderGeometry(0.0062, 0.0062, 0.0025, 6));
  const body = geo("jack-body", () => new THREE.CylinderGeometry(0.0046, 0.005, 0.0068, 20));
  const ring = geo("jack-ring", () => new THREE.CylinderGeometry(0.0023, 0.0023, 0.0072, 16, 1, true));
  const holeG = geo("jack-hole", () => new THREE.CircleGeometry(0.002, 16));
  return (
    <group
      ref={ref}
      position={[x, 0, z]}
      onClick={(e) => {
        e.stopPropagation();
        useBench.getState().clickJack(gid);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        useUi.getState().setHover({ id: gid, label });
        setCursor("pointer");
      }}
      onPointerOut={() => {
        if (useUi.getState().hover?.id === gid) useUi.getState().setHover(null);
        setCursor("auto");
      }}
    >
      <mesh geometry={hex} material={MAT.chrome()} position={[0, 0.0012, 0]} castShadow />
      <mesh geometry={body} material={plastic(style, active ? 0.8 : hovered ? 0.35 : 0)} position={[0, 0.0055, 0]} castShadow />
      <mesh geometry={ring} material={MAT.chrome()} position={[0, 0.0055, 0]} />
      <mesh geometry={holeG} material={MAT.hole()} position={[0, 0.0088, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      {/* generous invisible hit target */}
      <mesh visible={false} position={[0, 0.005, 0]}>
        <cylinderGeometry args={[0.0075, 0.0075, 0.012, 8]} />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- */
/* 2 mm pin sockets on a module plate (instanced)                    */
/* ---------------------------------------------------------------- */
export function PinJacks({
  jacks,
  prefix,
  width,
  height,
  owner,
}: {
  jacks: JackDef[];
  prefix: string;
  width: number;
  height: number;
  owner: React.RefObject<THREE.Group | null>;
}) {
  const visible = useMemo(() => jacks.filter((j) => !j.hidden), [jacks]);
  const own = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const holeRef = useRef<THREE.InstancedMesh>(null);
  const pending = useBench((s) => s.pending);
  const hover = useUi((s) => s.hover);
  const ringG = geo("pin-ring", () => new THREE.CylinderGeometry(0.0026, 0.0028, 0.0024, 18));
  const holeG = geo("pin-hole", () => new THREE.CylinderGeometry(0.0012, 0.0012, 0.0002, 12));
  const hiMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffd24a", emissive: "#ffb000", emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.6 }), []);

  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    visible.forEach((j, i) => {
      o.position.set(mm(j.x - width / 2), 0.0012, mm(j.y - height / 2));
      o.updateMatrix();
      ringRef.current?.setMatrixAt(i, o.matrix);
      o.position.y = 0.0025;
      o.updateMatrix();
      holeRef.current?.setMatrixAt(i, o.matrix);
    });
    if (ringRef.current) {
      ringRef.current.instanceMatrix.needsUpdate = true;
      ringRef.current.computeBoundingSphere();
    }
    if (holeRef.current) holeRef.current.instanceMatrix.needsUpdate = true;
    // anchors
    // anchor to our own group (refs of ancestors are not attached yet at this point)
    const anchorObj = own.current ?? owner.current;
    if (anchorObj) for (const j of jacks) registerAnchor(prefix + j.id, anchorObj, new THREE.Vector3(mm(j.x - width / 2), 0.0028, mm(j.y - height / 2)));
    return () => {
      for (const j of jacks) unregisterAnchor(prefix + j.id);
    };
  }, [visible, jacks, prefix, width, height, owner]);

  const highlight = [...new Set([pending, hover?.id])].filter((id): id is string => !!id && id.startsWith(prefix));
  return (
    <group ref={own}>
      <instancedMesh
        ref={ringRef}
        args={[ringG, MAT.brass(), visible.length]}
        castShadow={false}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.instanceId === undefined) return;
          useBench.getState().clickJack(prefix + visible[e.instanceId].id);
        }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          if (e.instanceId === undefined) return;
          const j = visible[e.instanceId];
          const id = prefix + j.id;
          if (useUi.getState().hover?.id !== id) useUi.getState().setHover({ id, label: j.label || j.id });
          setCursor("pointer");
        }}
        onPointerOut={() => {
          useUi.getState().setHover(null);
          setCursor("auto");
        }}
      />
      <instancedMesh ref={holeRef} args={[holeG, MAT.hole(), visible.length]} />
      {highlight.map((id) => {
        const j = jacks.find((x) => prefix + x.id === id);
        if (!j) return null;
        return (
          <mesh key={id} position={[mm(j.x - width / 2), 0.0016, mm(j.y - height / 2)]} rotation={[Math.PI / 2, 0, 0]} material={hiMat}>
            <torusGeometry args={[0.0034, 0.0007, 8, 24]} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ---------------------------------------------------------------- */
/* Rotary knob                                                        */
/* ---------------------------------------------------------------- */
const knobGeoCache = new Map<number, THREE.LatheGeometry>();
function knobGeometry(r: number) {
  let g = knobGeoCache.get(r);
  if (!g) {
    const R = r / 1000;
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(R * 1.18, 0),
      new THREE.Vector2(R * 1.18, 0.0022),
      new THREE.Vector2(R * 1.0, 0.003),
      new THREE.Vector2(R * 0.98, R * 1.15),
      new THREE.Vector2(R * 0.9, R * 1.25),
      new THREE.Vector2(0, R * 1.27),
    ];
    g = new THREE.LatheGeometry(pts, 40);
    g.computeVertexNormals();
    knobGeoCache.set(r, g);
  }
  return g;
}

export function Knob({
  id,
  x,
  z,
  r,
  detents = 0,
  style = "black",
}: {
  id: string;
  x: number;
  z: number;
  r: number;
  detents?: number;
  style?: "black" | "trimmer";
}) {
  const value = useBench((s) => s.knobs[id] ?? 0);
  const drag = useRef<{ x: number; y: number; v: number } | null>(null);
  const angle = knobAngle(detents, value);
  const R = r / 1000;
  const g = knobGeometry(r);
  const knurl = useMemo(() => {
    const items = [];
    const n = 24;
    for (let i = 0; i < n; i++) items.push((i / n) * Math.PI * 2);
    return items;
  }, []);
  const set = (v: number) => {
    const max = detents > 1 ? detents - 1 : 1;
    let nv = Math.min(Math.max(v, 0), max);
    if (detents > 1) nv = Math.round(nv);
    useBench.getState().setKnob(id, nv);
  };
  const capMat = style === "trimmer" ? plastic("#2f62c9") : MAT.blackPlastic();
  return (
    <group
      position={[x, 0, z]}
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.target as unknown as { setPointerCapture(id: number): void }).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, v: value };
        useUi.getState().setDragging(true);
        setCursor("grabbing");
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        e.stopPropagation();
        const d = (e.clientX - drag.current.x - (e.clientY - drag.current.y)) / (e.shiftKey ? 2400 : 260);
        const max = detents > 1 ? detents - 1 : 1;
        set(drag.current.v + d * max * (detents > 1 ? 1.6 : 1));
      }}
      onPointerUp={(e) => {
        if (!drag.current) return;
        e.stopPropagation();
        (e.target as unknown as { releasePointerCapture(id: number): void }).releasePointerCapture(e.pointerId);
        drag.current = null;
        useUi.getState().setDragging(false);
        setCursor("auto");
      }}
      onWheel={(e) => {
        e.stopPropagation();
        const step = detents > 1 ? 1 : e.shiftKey ? 0.002 : 0.01;
        set(value - Math.sign(e.deltaY) * step);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        useUi.getState().setHover({ id: `knob:${id}`, label: id });
        setCursor("grab");
      }}
      onPointerOut={() => {
        useUi.getState().setHover(null);
        if (!drag.current) setCursor("auto");
      }}
    >
      <group rotation={[0, -angle, 0]}>
        <mesh geometry={g} material={capMat} castShadow />
        {knurl.map((a, i) => (
          <mesh key={i} position={[Math.sin(a) * R * 0.985, R * 0.62, Math.cos(a) * R * 0.985]} rotation={[0, a, 0]} material={capMat}>
            <boxGeometry args={[R * 0.12, R * 1.0, R * 0.08]} />
          </mesh>
        ))}
        {/* pointer line */}
        <mesh position={[0, R * 1.275, -R * 0.5]} material={MAT.white()}>
          <boxGeometry args={[R * 0.13, 0.0004, R * 0.8]} />
        </mesh>
        <mesh position={[0, R * 1.272, 0]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.aluminium()}>
          <circleGeometry args={[R * 0.42, 24]} />
        </mesh>
      </group>
    </group>
  );
}
