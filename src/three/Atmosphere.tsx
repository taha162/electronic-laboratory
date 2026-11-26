"use client";
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useBench } from "@/store/bench";

/** soft vertical gradient used for the light shafts */
function shaftTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "rgba(255,248,232,0.9)");
  g.addColorStop(0.55, "rgba(255,248,232,0.35)");
  g.addColorStop(1, "rgba(255,248,232,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  // soft edges across the width
  const e = ctx.createLinearGradient(0, 0, 64, 0);
  e.addColorStop(0, "rgba(0,0,0,1)");
  e.addColorStop(0.25, "rgba(0,0,0,0)");
  e.addColorStop(0.75, "rgba(0,0,0,0)");
  e.addColorStop(1, "rgba(0,0,0,1)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = e;
  ctx.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  return t;
}

/** light shafts slanting from the window gaps between the blinds (kept for the photo mode) */
export function Shafts() {
  const tex = useMemo(() => shaftTexture(), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.075,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: true,
      }),
    [tex],
  );
  const shafts = useMemo(() => {
    const out: { x: number; w: number; o: number }[] = [];
    let s = 3;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 14; i++) out.push({ x: -1.1 + i * 0.33 + r() * 0.1, w: 0.05 + r() * 0.07, o: 0.5 + r() * 0.6 });
    return out;
  }, []);
  const grp = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    // clouds passing by: the beams breathe very slowly
    mat.opacity = 0.06 + 0.025 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 0.11));
  });
  return (
    <group ref={grp}>
      {shafts.map((s, i) => (
        <mesh key={i} position={[s.x, 1.62, -0.3]} rotation={[-0.62, 0.08, 0]} material={mat} renderOrder={2}>
          <planeGeometry args={[s.w, 1.9 * s.o + 0.6]} />
        </mesh>
      ))}
    </group>
  );
}

/** dust motes drifting in the window light */
function Dust({ count = 420 }) {
  const ref = useRef<THREE.Points>(null);
  const tex = useMemo(() => dotTexture(), []);
  const { pos, seed } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = -1.2 + Math.random() * 4.6;
      pos[i * 3 + 1] = 0.85 + Math.random() * 1.8;
      pos[i * 3 + 2] = -0.62 + Math.random() * 1.3;
      seed[i] = Math.random() * 100;
    }
    return { pos, seed };
  }, [count]);
  const base = useMemo(() => pos.slice(), [pos]);
  useFrame(({ clock }) => {
    const p = ref.current;
    if (!p) return;
    const t = clock.elapsedTime;
    const a = p.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      const sd = seed[i];
      a.array[i * 3] = base[i * 3] + Math.sin(t * 0.07 + sd) * 0.05;
      a.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.05 + sd * 1.7) * 0.06 - ((t * 0.004 + sd) % 0.25);
      a.array[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.06 + sd * 0.7) * 0.05;
    }
    a.needsUpdate = true;
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={tex}
        size={0.0032}
        sizeAttenuation
        color="#fff6e6"
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export function Atmosphere() {
  const quality = useBench((s) => s.quality);
  return (
    <group>
      {quality === "high" && <Dust />}
    </group>
  );
}
