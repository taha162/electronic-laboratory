"use client";
import * as THREE from "three";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useBench } from "@/store/bench";
import { MAT, plastic } from "./materials";
import { blindsTexture, clockFaceTexture, deskTexture, floorTexture, manualTexture, noticeTexture, outdoorTexture, wallTexture, waveformPaperTexture } from "./draw/textures";
import { fabricNormal, laminateMaps, plasterNormal, terrazzoMaps } from "./draw/pbr";
import { useFrame } from "@react-three/fiber";
import { surfaces } from "./registry";
import { Trainer } from "./Trainer";
import { DESK_Y } from "./Cables";

/** room extents */
export const ROOM = { x0: -1.25, x1: 7.6, z0: -0.72, z1: 6.4, h: 3.0 };
const WIN = { y0: 0.86, y1: 2.68 };

function Walls() {
  const wall = wallTexture();
  const wallMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: wall,
        color: "#f1eee8",
        roughness: 0.93,
        normalMap: plasterNormal([7, 3]),
        normalScale: new THREE.Vector2(0.45, 0.45),
      }),
    [wall],
  );
  const terr = terrazzoMaps();
  const W = ROOM.x1 - ROOM.x0,
    D = ROOM.z1 - ROOM.z0;
  const cx = (ROOM.x0 + ROOM.x1) / 2,
    cz = (ROOM.z0 + ROOM.z1) / 2;
  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={floorTexture()} roughness={1} roughnessMap={terr.rough} normalMap={terr.normal} normalScale={[0.3, 0.3]} metalness={0.02} />
      </mesh>
      {/* skirting */}
      <mesh position={[cx, 0.05, ROOM.z0 + 0.006]} material={MAT.beigeDark()}>
        <boxGeometry args={[W, 0.1, 0.012]} />
      </mesh>
      {/* ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[cx, ROOM.h, cz]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#f4f3ef" roughness={0.95} />
      </mesh>
      {/* window wall: below and above the window band */}
      <mesh position={[cx, WIN.y0 / 2, ROOM.z0]} material={wallMat} receiveShadow>
        <planeGeometry args={[W, WIN.y0]} />
      </mesh>
      <mesh position={[cx, (WIN.y1 + ROOM.h) / 2, ROOM.z0]} material={wallMat}>
        <planeGeometry args={[W, ROOM.h - WIN.y1]} />
      </mesh>
      {/* left wall (next to the bench, with the power strip) */}
      <mesh position={[ROOM.x0, ROOM.h / 2, cz]} rotation={[0, Math.PI / 2, 0]} material={wallMat} receiveShadow>
        <planeGeometry args={[D, ROOM.h]} />
      </mesh>
      <mesh position={[ROOM.x1, ROOM.h / 2, cz]} rotation={[0, -Math.PI / 2, 0]} material={wallMat}>
        <planeGeometry args={[D, ROOM.h]} />
      </mesh>
      <mesh position={[cx, ROOM.h / 2, ROOM.z1]} rotation={[0, Math.PI, 0]} material={wallMat}>
        <planeGeometry args={[W, ROOM.h]} />
      </mesh>
      {/* door on the back wall */}
      <group position={[5.6, 0, ROOM.z1 - 0.02]}>
        <mesh position={[0, 1.05, 0]}>
          <boxGeometry args={[1.0, 2.1, 0.04]} />
          <meshStandardMaterial color="#8a6a48" roughness={0.6} />
        </mesh>
        <mesh position={[0.38, 1.0, -0.04]} material={MAT.aluminium()}>
          <boxGeometry args={[0.14, 0.02, 0.03]} />
        </mesh>
      </group>
      {/* whiteboard */}
      <group position={[2.2, 1.55, ROOM.z1 - 0.02]} rotation={[0, Math.PI, 0]}>
        <mesh>
          <boxGeometry args={[2.6, 1.15, 0.02]} />
          <meshStandardMaterial color="#fafafa" roughness={0.15} />
        </mesh>
        <mesh position={[0, 0, -0.012]} material={MAT.aluminium()}>
          <boxGeometry args={[2.66, 1.21, 0.01]} />
        </mesh>
      </group>
      {/* ceiling fluorescent fixtures: white steel housing, diffuser, louvers */}
      {[0, 2.4, 4.8].flatMap((x) =>
        [0.4, 2.6, 4.8].map((z) => (
          <group key={`${x}-${z}`} position={[x, ROOM.h - 0.03, z]}>
            <mesh material={MAT.whiteAbs()}>
              <boxGeometry args={[1.26, 0.06, 0.36]} />
            </mesh>
            <mesh position={[0, -0.031, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[1.18, 0.3]} />
              <meshStandardMaterial color="#ffffff" emissive="#f6f9ff" emissiveIntensity={3.2} />
            </mesh>
            {Array.from({ length: 9 }).map((_, i) => (
              <mesh key={i} position={[-0.56 + i * 0.14, -0.04, 0]} material={MAT.aluminium()}>
                <boxGeometry args={[0.004, 0.018, 0.3]} />
              </mesh>
            ))}
          </group>
        )),
      )}
      {/* split air-conditioner on the left wall */}
      <group position={[ROOM.x0 + 0.12, 2.45, 1.7]} rotation={[0, Math.PI / 2, 0]}>
        <RoundedBox args={[0.95, 0.3, 0.22]} radius={0.04} smoothness={4} material={MAT.whiteAbs()} castShadow />
        <mesh position={[0, -0.12, 0.1]} rotation={[0.5, 0, 0]} material={MAT.whiteAbs()}>
          <boxGeometry args={[0.86, 0.06, 0.01]} />
        </mesh>
        <mesh position={[0.36, 0.05, 0.111]}>
          <circleGeometry args={[0.008, 16]} />
          <meshStandardMaterial color="#39d86b" emissive="#39d86b" emissiveIntensity={2} />
        </mesh>
        {/* condensate pipe */}
        <mesh position={[-0.5, -0.6, -0.08]} material={MAT.whiteAbs()}>
          <cylinderGeometry args={[0.012, 0.012, 1.0, 10]} />
        </mesh>
      </group>
      <WallClock />
      {/* safety notice board (cork) */}
      <group position={[ROOM.x0 + 0.015, 1.55, 3.4]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <boxGeometry args={[1.2, 0.8, 0.02]} />
          <meshStandardMaterial color="#a77b4c" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0, 0.012]}>
          <planeGeometry args={[1.12, 0.72]} />
          <meshStandardMaterial color="#b98a58" roughness={1} normalMap={plasterNormal([2, 2])} />
        </mesh>
        <mesh position={[-0.27, 0, 0.014]} rotation={[0, 0, 0.02]}>
          <planeGeometry args={[0.36, 0.5]} />
          <meshStandardMaterial map={noticeTexture()} roughness={0.9} />
        </mesh>
        <mesh position={[0.2, 0.08, 0.014]} rotation={[0, 0, -0.04]}>
          <planeGeometry args={[0.3, 0.42]} />
          <meshStandardMaterial map={waveformPaperTexture(0)} roughness={0.9} />
        </mesh>
        {[
          [-0.27, 0.24],
          [0.2, 0.28],
        ].map(([x, y], i) => (
          <mesh key={i} position={[x, y, 0.02]}>
            <sphereGeometry args={[0.008, 10, 8]} />
            <meshStandardMaterial color={i ? "#2a62d8" : "#d82a2a"} roughness={0.3} />
          </mesh>
        ))}
      </group>
      {/* fire extinguisher by the door */}
      <group position={[4.85, 0, ROOM.z1 - 0.15]}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.5, 24]} />
          <meshPhysicalMaterial color="#c8141a" roughness={0.3} clearcoat={0.8} />
        </mesh>
        <mesh position={[0, 0.58, 0]} material={MAT.blackPlastic()}>
          <cylinderGeometry args={[0.025, 0.04, 0.07, 16]} />
        </mesh>
        <mesh position={[0.05, 0.62, 0]} rotation={[0, 0, -0.4]} material={MAT.chrome()}>
          <boxGeometry args={[0.1, 0.012, 0.025]} />
        </mesh>
        <mesh position={[0, 0.03, 0]} material={MAT.blackPlastic()}>
          <cylinderGeometry args={[0.07, 0.07, 0.06, 16]} />
        </mesh>
      </group>
      {/* light switch by the door */}
      <mesh position={[5.0, 1.3, ROOM.z1 - 0.01]} rotation={[0, Math.PI, 0]} material={MAT.whiteAbs()}>
        <boxGeometry args={[0.08, 0.12, 0.012]} />
      </mesh>
      {/* waste bin next to our bench */}
      <mesh position={[-1.0, 0.17, 0.78]} castShadow>
        <cylinderGeometry args={[0.15, 0.12, 0.34, 28, 1, true]} />
        <meshStandardMaterial color="#3b4a5a" roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function WindowAndBlinds() {
  const W = ROOM.x1 - ROOM.x0 - 0.3;
  const cx = (ROOM.x0 + ROOM.x1) / 2;
  const slatW = 0.089;
  const pitch = 0.082;
  const n = Math.floor(W / pitch);
  const H = WIN.y1 - WIN.y0 + 0.02;
  const inst = useRef<THREE.InstancedMesh>(null);
  const tex = blindsTexture();
  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const x = cx - W / 2 + i * pitch;
      // most slats half-open like in the photographs, a few twisted / bunched
      const ang = 1.05 + Math.sin(i * 12.9898) * 0.12 + (i % 23 === 7 ? 0.45 : 0);
      o.position.set(x, (WIN.y0 + WIN.y1) / 2 - 0.01, ROOM.z0 + 0.14);
      o.rotation.set(0, ang, Math.sin(i * 3.1) * 0.006);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [n, W, cx]);
  const slatMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: tex,
        side: THREE.DoubleSide,
        roughness: 0.92,
        normalMap: fabricNormal([2, 14]),
        normalScale: new THREE.Vector2(0.5, 0.5),
        sheen: 0.6,
        sheenRoughness: 0.7,
        sheenColor: new THREE.Color("#fff2d6"),
        // translucent fabric: glows with the daylight behind it
        emissive: new THREE.Color("#f0d29a"),
        emissiveMap: tex,
        emissiveIntensity: 0.7,
      }),
    [tex],
  );
  return (
    <group>
      {/* bright outdoor light */}
      <mesh position={[cx, (WIN.y0 + WIN.y1) / 2 + 0.1, ROOM.z0 - 0.6]}>
        <planeGeometry args={[W + 1.4, H + 0.9]} />
        <meshBasicMaterial map={outdoorTexture()} color={new THREE.Color(1.9, 1.9, 1.9)} />
      </mesh>
      {/* frames */}
      {Array.from({ length: Math.ceil(W / 1.25) + 1 }).map((_, i) => (
        <mesh key={i} position={[cx - W / 2 + i * 1.25, (WIN.y0 + WIN.y1) / 2, ROOM.z0 - 0.05]} material={MAT.aluminium()}>
          <boxGeometry args={[0.05, H, 0.07]} />
        </mesh>
      ))}
      <mesh position={[cx, WIN.y0 - 0.02, ROOM.z0 + 0.02]} material={MAT.whiteAbs()} receiveShadow>
        <boxGeometry args={[W + 0.3, 0.04, 0.2]} />
      </mesh>
      <mesh position={[cx, WIN.y1 + 0.03, ROOM.z0 - 0.03]} material={MAT.aluminium()}>
        <boxGeometry args={[W + 0.3, 0.06, 0.08]} />
      </mesh>
      {/* blinds head-rail */}
      <mesh position={[cx, WIN.y1 + 0.02, ROOM.z0 + 0.14]} material={MAT.whiteAbs()}>
        <boxGeometry args={[W, 0.05, 0.06]} />
      </mesh>
      <instancedMesh ref={inst} args={[undefined, undefined, n]} material={slatMat}>
        <planeGeometry args={[slatW, H - 0.06]} />
      </instancedMesh>
      {/* bottom chain */}
      <mesh position={[cx, WIN.y0 + 0.07, ROOM.z0 + 0.14]}>
        <boxGeometry args={[W, 0.003, 0.003]} />
        <meshStandardMaterial color="#cfcabb" />
      </mesh>
    </group>
  );
}

function PowerStrip() {
  // white multi-socket strip screwed to the left wall + cable
  return (
    <group position={[ROOM.x0 + 0.025, 1.02, -0.32]} rotation={[0, Math.PI / 2, 0]}>
      <RoundedBox args={[0.34, 0.07, 0.045]} radius={0.008} material={MAT.whiteAbs()} castShadow />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-0.12 + i * 0.075, 0, 0.024]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.017, 0.017, 0.004, 24]} />
          <meshStandardMaterial color="#e4e4e0" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0.15, 0, 0.026]}>
        <boxGeometry args={[0.018, 0.026, 0.006]} />
        <meshStandardMaterial color="#d0201a" emissive="#ff3010" emissiveIntensity={0.4} />
      </mesh>
      {/* plug + cable going down */}
      <mesh position={[-0.12, 0, 0.045]} material={MAT.whiteAbs()}>
        <boxGeometry args={[0.035, 0.045, 0.035]} />
      </mesh>
      <mesh position={[-0.12, -0.12, 0.06]} material={MAT.whiteAbs()}>
        <cylinderGeometry args={[0.004, 0.004, 0.22, 8]} />
      </mesh>
    </group>
  );
}

/** a lab bench: white laminate top on a steel frame */
export function LabBench({ position, w = 2.1, d = 0.9, main = false }: { position: [number, number, number]; w?: number; d?: number; main?: boolean }) {
  const top = useRef<THREE.Mesh>(null);
  useEffect(() => {
    const t = top.current;
    if (main && t) surfaces.add(t);
    return () => {
      if (t) surfaces.delete(t);
    };
  }, [main]);
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
    <group position={position}>
      <mesh
        ref={top}
        position={[0, DESK_Y - 0.015, 0]}
        material={mats}
        receiveShadow
        castShadow
        onClick={(e) => {
          if (!main) return;
          e.stopPropagation();
          useBench.getState().cancel();
        }}
      >
        <boxGeometry args={[w, 0.03, d]} />
      </mesh>
      {/* frame */}
      {[
        [-w / 2 + 0.05, -d / 2 + 0.05],
        [w / 2 - 0.05, -d / 2 + 0.05],
        [-w / 2 + 0.05, d / 2 - 0.08],
        [w / 2 - 0.05, d / 2 - 0.08],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, (DESK_Y - 0.03) / 2, z]} material={MAT.aluminium()} castShadow>
          <boxGeometry args={[0.04, DESK_Y - 0.03, 0.04]} />
        </mesh>
      ))}
      <mesh position={[0, DESK_Y - 0.08, -d / 2 + 0.05]} material={MAT.aluminium()}>
        <boxGeometry args={[w - 0.1, 0.06, 0.03]} />
      </mesh>
      <mesh position={[0, 0.1, 0]} material={MAT.aluminium()}>
        <boxGeometry args={[w - 0.1, 0.03, 0.03]} />
      </mesh>
      {/* modesty panel */}
      <mesh position={[0, 0.45, -d / 2 + 0.07]}>
        <boxGeometry args={[w - 0.12, 0.55, 0.012]} />
        <meshStandardMaterial color="#d8d5cc" roughness={0.6} />
      </mesh>
    </group>
  );
}

function Stool({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.19, 0.19, 0.05, 28]} />
        <meshStandardMaterial color="#1e2a44" roughness={0.6} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + 0.4;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.15, 0.3, Math.sin(a) * 0.15]} rotation={[Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]} material={MAT.aluminium()}>
            <cylinderGeometry args={[0.012, 0.012, 0.62, 8]} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ---------------------------------------------------------------- */
/* desk props from the photographs                                   */
/* ---------------------------------------------------------------- */
function WireBox() {
  const wires = useMemo(() => {
    const cols = ["#c8161a", "#151515", "#e8c414", "#1d4fd0", "#178a3c", "#e9e9e6", "#9fc21c", "#c8161a", "#151515"];
    const out: { curve: THREE.CatmullRomCurve3; color: string }[] = [];
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
    for (let k = 0; k < 16; k++) {
      const pts = [];
      for (let i = 0; i < 6; i++) pts.push(new THREE.Vector3(r() * 0.17, 0.012 + Math.abs(r()) * 0.05 + (i === 5 ? 0.03 : 0), r() * 0.12));
      out.push({ curve: new THREE.CatmullRomCurve3(pts), color: cols[k % cols.length] });
    }
    return out;
  }, []);
  const boxMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2b4a3c", roughness: 0.55 }), []);
  return (
    <group position={[-0.06, DESK_Y, 0.3]} rotation={[0, -0.08, 0]}>
      <mesh position={[0, 0.003, 0]} material={boxMat} receiveShadow>
        <boxGeometry args={[0.21, 0.006, 0.16]} />
      </mesh>
      {[
        [0, 0.03, -0.08, 0.21, 0.06, 0.006],
        [0, 0.03, 0.08, 0.21, 0.06, 0.006],
        [-0.105, 0.03, 0, 0.006, 0.06, 0.16],
        [0.105, 0.03, 0, 0.006, 0.06, 0.16],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x, y, z]} material={boxMat} castShadow>
          <boxGeometry args={[w, h, d]} />
        </mesh>
      ))}
      {wires.map((w, i) => (
        <mesh key={i} castShadow>
          <tubeGeometry args={[w.curve, 40, 0.0016, 6, false]} />
          <meshStandardMaterial color={w.color} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

function Props() {
  const manual = manualTexture();
  return (
    <group>
      {/* open lab manual (front-left, partly under the oscilloscope) */}
      <group position={[-0.62, DESK_Y + 0.004, 0.3]} rotation={[0, 0.42, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
          <planeGeometry args={[0.42, 0.3]} />
          <meshStandardMaterial map={manual} roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.002, 0]}>
          <boxGeometry args={[0.425, 0.004, 0.302]} />
          <meshStandardMaterial color="#e8e6df" />
        </mesh>
      </group>
      {/* hand-drawn waveform sheets (right) */}
      {[0, 1].map((k) => (
        <mesh key={k} position={[0.62 + k * 0.1, DESK_Y + 0.0008 + k * 0.0006, 0.12 + k * 0.04]} rotation={[-Math.PI / 2, 0, 0.32 - k * 0.2]} receiveShadow>
          <planeGeometry args={[0.21, 0.297]} />
          <meshStandardMaterial map={waveformPaperTexture(k)} roughness={0.9} />
        </mesh>
      ))}
      {/* pen */}
      <group position={[0.34, DESK_Y + 0.005, 0.34]} rotation={[0, 1.2, Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.0045, 0.0045, 0.14, 12]} />
          <meshPhysicalMaterial color="#dfe3e8" transparent opacity={0.85} roughness={0.15} />
        </mesh>
        <mesh position={[0, 0.072, 0]} material={MAT.blackPlastic()}>
          <coneGeometry args={[0.0045, 0.012, 12]} />
        </mesh>
        <mesh position={[0, -0.05, 0]} material={MAT.blackPlastic()}>
          <cylinderGeometry args={[0.0048, 0.0048, 0.04, 12]} />
        </mesh>
      </group>
      {/* plastic cup (far left) */}
      <mesh position={[-0.96, DESK_Y + 0.05, 0.22]} castShadow>
        <cylinderGeometry args={[0.04, 0.032, 0.1, 28, 1, true]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.25} roughness={0.08} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-0.96, DESK_Y + 0.105, 0.22]} castShadow>
        <cylinderGeometry args={[0.042, 0.042, 0.01, 28]} />
        <meshStandardMaterial color="#c4161c" roughness={0.5} />
      </mesh>
      <WireBox />
      {/* spare test leads coiled at the back right */}
      {[0, 1].map((k) => (
        <mesh key={k} position={[0.72 + k * 0.08, DESK_Y + 0.012, -0.33]} rotation={[-Math.PI / 2 + 0.2, 0, k]} castShadow>
          <torusGeometry args={[0.05, 0.005, 10, 40]} />
          <meshStandardMaterial color={k ? "#c11818" : "#1d7a4a"} roughness={0.5} />
        </mesh>
      ))}
      {/* pink sticky-note pad behind the trainer */}
      <mesh position={[0.46, DESK_Y + 0.008, -0.38]} rotation={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.076, 0.016, 0.076]} />
        <meshStandardMaterial color="#c873c9" roughness={0.7} />
      </mesh>
      <mesh position={[0.36, DESK_Y + 0.01, -0.42]} rotation={[0, -0.2, 0]} castShadow>
        <boxGeometry args={[0.07, 0.02, 0.05]} />
        <meshStandardMaterial color="#e8e05a" roughness={0.6} />
      </mesh>
    </group>
  );
}

/** analog wall clock showing the real local time */
function WallClock() {
  const hr = useRef<THREE.Group>(null);
  const mn = useRef<THREE.Group>(null);
  const sc = useRef<THREE.Group>(null);
  useFrame(() => {
    const d = new Date();
    const s = d.getSeconds() + d.getMilliseconds() / 1000;
    const m = d.getMinutes() + s / 60;
    const h = (d.getHours() % 12) + m / 60;
    if (hr.current) hr.current.rotation.z = -(h / 12) * Math.PI * 2;
    if (mn.current) mn.current.rotation.z = -(m / 60) * Math.PI * 2;
    // quartz movement: ticks once per second
    if (sc.current) sc.current.rotation.z = -(Math.floor(s) / 60) * Math.PI * 2;
  });
  return (
    <group position={[ROOM.x0 + 0.02, 2.35, 2.95]} rotation={[0, Math.PI / 2, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={MAT.blackPlastic()}>
        <cylinderGeometry args={[0.17, 0.17, 0.035, 48]} />
      </mesh>
      <mesh position={[0, 0, 0.018]}>
        <circleGeometry args={[0.155, 48]} />
        <meshStandardMaterial map={clockFaceTexture()} roughness={0.6} />
      </mesh>
      <group ref={hr} position={[0, 0, 0.022]}>
        <mesh position={[0, 0.045, 0]} material={MAT.blackPlastic()}>
          <boxGeometry args={[0.012, 0.09, 0.002]} />
        </mesh>
      </group>
      <group ref={mn} position={[0, 0, 0.024]}>
        <mesh position={[0, 0.065, 0]} material={MAT.blackPlastic()}>
          <boxGeometry args={[0.008, 0.13, 0.002]} />
        </mesh>
      </group>
      <group ref={sc} position={[0, 0, 0.026]}>
        <mesh position={[0, 0.055, 0]}>
          <boxGeometry args={[0.002, 0.14, 0.001]} />
          <meshStandardMaterial color="#c4141a" />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.03]} material={MAT.glass()}>
        <circleGeometry args={[0.158, 48]} />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- */
export function Room() {
  return (
    <group>
      <Walls />
      <WindowAndBlinds />
      <PowerStrip />
      {/* main bench (ours) */}
      <LabBench position={[-0.15, 0, -0.06]} w={2.15} d={0.92} main />
      <Props />
      <Stool position={[0.05, 0, 0.75]} />
      {/* neighbouring work stations along the window */}
      {[2.35, 4.85].map((x) => (
        <group key={x}>
          <LabBench position={[x, 0, -0.06]} w={2.15} d={0.92} />
          <Trainer position={[x - 0.1, DESK_Y, -0.08]} interactive={false} />
          <Stool position={[x - 0.1, 0, 0.78]} />
        </group>
      ))}
      {/* second row facing the window */}
      {[0.4, 2.9, 5.4].map((x) => (
        <group key={x}>
          <LabBench position={[x, 0, 2.3]} w={2.15} d={0.92} />
          <Trainer position={[x, DESK_Y, 2.28]} interactive={false} />
          <Stool position={[x, 0, 3.1]} />
        </group>
      ))}
    </group>
  );
}

export { plastic };
