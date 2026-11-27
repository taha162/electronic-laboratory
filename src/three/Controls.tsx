"use client";
import * as THREE from "three";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useBench } from "@/store/bench";
import { registerAnchor, unregisterAnchor, useUi, mm } from "./registry";
import { MAT, plastic, geo } from "./materials";
import { knobAngle } from "./draw/textures";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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
  const brass = style === "brass";
  // mouth height above the panel (where a plug seats)
  const mouth = brass ? 0.0032 : 0.0046;
  useLayoutEffect(() => {
    if (ref.current) registerAnchor(gid, ref.current, new THREE.Vector3(0, mouth, 0));
    return () => unregisterAnchor(gid);
  }, [gid, mouth]);
  const g = jackGeometries();
  const glow = active ? 0.8 : hovered ? 0.35 : 0;
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
      {/* the socket itself is drawn by <JackVisuals> (instanced); only the highlight is per jack */}
      {glow > 0 && <mesh geometry={brass ? g.bBody : g.collar} material={plastic(brass ? "#1b1a18" : style, glow)} scale={[1.04, 1.03, 1.04]} />}
      {/* generous invisible hit target */}
      <mesh visible={false} position={[0, 0.004, 0]}>
        <cylinderGeometry args={[brass ? 0.006 : 0.0075, brass ? 0.006 : 0.0075, 0.01, 8]} />
      </mesh>
    </group>
  );
}

/** socket geometry with the part offsets baked in (shared by the instanced visuals and highlights) */
function jackGeometries() {
  return {
    // 4 mm socket: low moulded coloured collar with a rounded top (profile bottom -> top -> into the hole,
    // so the lathe faces point outward), metal contact sleeve inside
    collar: geo(
      "jack-collar2",
      () =>
        new THREE.LatheGeometry(
          [
            new THREE.Vector2(0.005, 0),
            new THREE.Vector2(0.005, 0.0029),
            new THREE.Vector2(0.00485, 0.0037),
            new THREE.Vector2(0.0044, 0.0043),
            new THREE.Vector2(0.0036, 0.0046),
            new THREE.Vector2(0.0026, 0.0045),
            new THREE.Vector2(0.0022, 0.0042),
            new THREE.Vector2(0.0022, 0.0036),
          ],
          32,
        ),
    ),
    sleeve: geo(
      "jack-sleeve",
      () =>
        new THREE.LatheGeometry(
          [new THREE.Vector2(0.00215, 0.0039), new THREE.Vector2(0.00205, 0.0036), new THREE.Vector2(0.00205, 0.0016)],
          20,
        ),
    ),
    hole: geo("jack-hole2", () => new THREE.CircleGeometry(0.0021, 18).rotateX(-Math.PI / 2).translate(0, 0.0017, 0)),
    // small brass socket (meters, potentiometers, speaker)
    bBody: geo("brass-body2", () => new THREE.CylinderGeometry(0.0031, 0.0034, 0.0028, 20).translate(0, 0.0014, 0)),
    bRing: geo("brass-ring2", () => new THREE.TorusGeometry(0.00175, 0.00055, 8, 20).rotateX(Math.PI / 2).translate(0, 0.0029, 0)),
    bHole: geo("brass-hole2", () => new THREE.CircleGeometry(0.0012, 14).rotateX(-Math.PI / 2).translate(0, 0.00285, 0)),
  };
}

/**
 * All the trainer's sockets in a few instanced draw calls (one per colour and
 * part) instead of three meshes per socket. Positions are local (metres).
 */
export function JackVisuals({ jacks }: { jacks: { x: number; z: number; style: string }[] }) {
  const g = jackGeometries();
  const groups = useMemo(() => {
    const big = jacks.filter((j) => j.style !== "brass");
    const small = jacks.filter((j) => j.style === "brass");
    const byStyle = new Map<string, typeof jacks>();
    for (const j of big) byStyle.set(j.style, [...(byStyle.get(j.style) ?? []), j]);
    return { big, small, byStyle: [...byStyle.entries()] };
  }, [jacks]);
  return (
    <>
      {groups.byStyle.map(([style, list]) => (
        <Instances key={style} geometry={g.collar} material={plastic(style)} at={list} shadow />
      ))}
      <Instances geometry={g.sleeve} material={MAT.chrome()} at={groups.big} />
      <Instances geometry={g.hole} material={MAT.hole()} at={groups.big} />
      <Instances geometry={g.bBody} material={plastic("#1b1a18")} at={groups.small} shadow />
      <Instances geometry={g.bRing} material={MAT.brass()} at={groups.small} />
      <Instances geometry={g.bHole} material={MAT.hole()} at={groups.small} />
    </>
  );
}

function Instances({ geometry, material, at, shadow = false }: { geometry: THREE.BufferGeometry; material: THREE.Material; at: { x: number; z: number }[]; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    at.forEach((p, i) => {
      o.position.set(p.x, 0, p.z);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [at]);
  if (!at.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, at.length]} castShadow={shadow} receiveShadow />;
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
const knobGeoCache = new Map<number, THREE.BufferGeometry>();
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
    const body = new THREE.LatheGeometry(pts, 40);
    body.computeVertexNormals();
    // knurled grip ribs merged into the body: one draw call per knob
    const parts: THREE.BufferGeometry[] = [body];
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rib = new THREE.BoxGeometry(R * 0.1, R * 0.95, R * 0.07);
      rib.rotateY(a);
      rib.translate(Math.sin(a) * R * 0.955, R * 0.6, Math.cos(a) * R * 0.955);
      parts.push(rib);
    }
    g = mergeGeometries(parts.map((q) => (q.index ? q.toNonIndexed() : q)), false)!;
    g.computeBoundingSphere();
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
  bare = false,
}: {
  id: string;
  x: number;
  z: number;
  r: number;
  detents?: number;
  style?: "black" | "trimmer";
  bare?: boolean;
}) {
  const value = useBench((s) => s.knobs[id] ?? 0);
  const drag = useRef<{ x: number; y: number; v: number; t: number; moved: boolean } | null>(null);
  const angle = knobAngle(detents, value);
  const R = r / 1000;
  const g = knobGeometry(r);
  const shaftRibs = geo("shaft-ribs", () => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 28; i += 2) {
      const a = (i / 28) * Math.PI * 2;
      const rib = new THREE.BoxGeometry(0.0004, 0.007, 0.0003);
      rib.rotateY(a);
      rib.translate(Math.sin(a) * 0.003, 0.0125, Math.cos(a) * 0.003);
      parts.push(rib.toNonIndexed());
    }
    return mergeGeometries(parts, false)!;
  });
  const set = (v: number) => {
    const max = detents > 1 ? detents - 1 : 1;
    let nv = Math.min(Math.max(v, 0), max);
    if (detents > 1) nv = Math.round(nv);
    useBench.getState().setKnob(id, nv);
  };
  const capMat = style === "trimmer" ? plastic("#2f62c9") : MAT.blackPlastic();
  // the KL-21001 knobs have a cream-white top insert with a black pointer line
  const topMat = style === "trimmer" ? capMat : knobCapMaterial();
  return (
    <group
      position={[x, 0, z]}
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.target as unknown as { setPointerCapture(id: number): void }).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, v: value, t: performance.now(), moved: false };
        useUi.getState().setDragging(true);
        setCursor("grabbing");
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        e.stopPropagation();
        if (!drag.current.moved && Math.hypot(e.clientX - drag.current.x, e.clientY - drag.current.y) < 6) return;
        drag.current.moved = true;
        const d = (e.clientX - drag.current.x - (e.clientY - drag.current.y)) / (e.shiftKey ? 2400 : 260);
        const max = detents > 1 ? detents - 1 : 1;
        set(drag.current.v + d * max * (detents > 1 ? 1.6 : 1));
      }}
      onPointerUp={(e) => {
        if (!drag.current) return;
        e.stopPropagation();
        (e.target as unknown as { releasePointerCapture(id: number): void }).releasePointerCapture(e.pointerId);
        // a tap (no drag) opens the large on-screen control for this knob
        if (!drag.current.moved && performance.now() - drag.current.t < 450) useUi.getState().setCtrl(id);
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
      {bare ? (
        // missing knob: knurled steel D-shaft and its fixing nut, still turnable
        <group rotation={[0, -angle, 0]}>
          <mesh position={[0, 0.001, 0]} material={MAT.chrome()} castShadow>
            <cylinderGeometry args={[0.0058, 0.0058, 0.002, 6]} />
          </mesh>
          <mesh position={[0, 0.0034, 0]} material={MAT.chrome()}>
            <cylinderGeometry args={[0.0042, 0.0042, 0.003, 20]} />
          </mesh>
          <mesh position={[0, 0.0105, 0]} material={MAT.aluminium()} castShadow>
            <cylinderGeometry args={[0.003, 0.003, 0.012, 24]} />
          </mesh>
          <mesh geometry={shaftRibs} material={MAT.chrome()} />
          {/* the D flat shows where it points */}
          <mesh position={[0, 0.0165, -0.0018]} material={MAT.darkGrey()}>
            <boxGeometry args={[0.0042, 0.0002, 0.0012]} />
          </mesh>
        </group>
      ) : (
        <group rotation={[0, -angle, 0]}>
          <mesh geometry={g} material={capMat} castShadow />
          {/* top insert */}
          <mesh position={[0, R * 1.262, 0]} material={topMat}>
            <cylinderGeometry args={[R * 0.8, R * 0.83, R * 0.06, 32]} />
          </mesh>
          {/* pointer line */}
          <mesh position={[0, R * 1.296, -R * 0.42]} material={style === "trimmer" ? MAT.white() : MAT.blackPlastic()}>
            <boxGeometry args={[R * 0.11, 0.0003, R * 0.72]} />
          </mesh>
        </group>
      )}
    </group>
  );
}

let capMaterial: THREE.MeshPhysicalMaterial | null = null;
function knobCapMaterial() {
  if (!capMaterial)
    capMaterial = new THREE.MeshPhysicalMaterial({ color: "#ebe7dc", roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  return capMaterial;
}
