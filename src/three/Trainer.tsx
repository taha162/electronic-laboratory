"use client";
import * as THREE from "three";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useBench } from "@/store/bench";
import { useSim } from "@/lab/simController";
import { DVM_RECT, MODULE_SLOT, SCREWS, TRAINER_H, TRAINER_JACKS, TRAINER_KNOBS, TRAINER_METERS, TRAINER_W } from "@/lab/trainer";
import { getModule } from "@/lab/modules";
import type { ModuleDef } from "@/lab/types";
import { BananaJack, JackVisuals, Knob, PinJacks } from "./Controls";
import { MergeStatic } from "./MergeStatic";
import { MAT, PLASTIC_COLORS, plastic } from "./materials";
import { canvas, draw7seg, meterFaceTexture, moduleTexture, toTexture, trainerPanelTexture } from "./draw/textures";
import { anchorWorld, mm, surfaces, useUi } from "./registry";
import { ringGeometry } from "./draw/shapes";
import { plasticNormal } from "./draw/pbr";
import type { CustomPart } from "@/lab/types";
import { removeOnRightClick } from "./interaction";
import { sfx } from "@/audio/audio";

/** KL-21001 case: beige wedge, the panel sits in a raised rim */
export const BODY = { w: 0.61, d: 0.478, hFront: 0.058, hBack: 0.128 };
export const SLOPE = Math.atan((BODY.hBack - BODY.hFront) / BODY.d);
const RIM = 0.013; // rim width around the panel (m)

const P = (u: number, v: number): [number, number] => [mm(u - TRAINER_W / 2), mm(v - TRAINER_H / 2)];
const JACK_SPOTS = TRAINER_JACKS.map((j) => {
  const [x, z] = P(j.x, j.y);
  return { x, z, style: j.style ?? "black" };
});

function useBodyGeometry() {
  return useMemo(() => {
    const s = new THREE.Shape();
    const hd = BODY.d / 2;
    s.moveTo(-hd, 0);
    s.lineTo(hd, 0);
    s.lineTo(hd, BODY.hBack);
    s.lineTo(-hd, BODY.hFront);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: BODY.w - 0.016,
      bevelEnabled: true,
      bevelSize: 0.008,
      bevelThickness: 0.008,
      bevelSegments: 5,
      curveSegments: 4,
    });
    g.translate(0, 0, -(BODY.w - 0.016) / 2);
    g.rotateY(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, []);
}

/** raised beige frame of the case around the printed panel */
function PanelRim() {
  const g = useMemo(
    () => ringGeometry(mm(TRAINER_W) + 2 * RIM, mm(TRAINER_H) + 2 * RIM, mm(TRAINER_W) + 0.001, mm(TRAINER_H) + 0.001, 0.012, 0.004, 0.0035, 0.0012),
    [],
  );
  return <mesh geometry={g} material={MAT.beige()} castShadow receiveShadow />;
}

/** black cross-head screws on the border line */
function PanelScrews() {
  const head = useMemo(() => new THREE.SphereGeometry(0.0028, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), []);
  return (
    <group>
      {SCREWS.map(([u, v], i) => {
        const [x, z] = P(u, v);
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, i * 0.7, 0]}>
            <mesh geometry={head} scale={[1, 0.45, 1]} material={MAT.blackPlastic()} castShadow />
            <mesh position={[0, 0.00128, 0]} material={MAT.hole()}>
              <boxGeometry args={[0.0034, 0.0003, 0.0007]} />
            </mesh>
            <mesh position={[0, 0.00128, 0]} rotation={[0, Math.PI / 2, 0]} material={MAT.hole()}>
              <boxGeometry args={[0.0034, 0.0003, 0.0007]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/**
 * KL-DVM-6005A digital DC meter: black bezel, range label plate with two yellow
 * slide switches (function V / mA and resolution), red 3-digit LED display.
 */
function DigitalMeter() {
  const PX = 4; // px per mm
  const { tex, ctx, c } = useMemo(() => {
    const c = canvas(DVM_RECT.w * PX, DVM_RECT.h * PX);
    const ctx = c.getContext("2d")!;
    return { tex: toTexture(c), ctx, c };
  }, []);
  const last = useRef("");
  const sel = useBench((s) => (s.knobs["dvm.sel"] ?? 0) > 0.5);
  const fine = useBench((s) => (s.knobs["dvm.rng"] ?? 0) > 0.5);
  useFrame(() => {
    const st = useBench.getState();
    const r = useSim.getState().readings;
    const v = sel ? r.dvm.a : r.dvm.v;
    let s = "";
    if (st.power) {
      const a = Math.abs(v);
      if (fine) s = a >= 9.995 ? "1  " : (v < -0.005 ? "-" : "") + a.toFixed(2);
      else s = a >= 99.95 ? "1  " : (v < -0.05 ? "-" : "") + a.toFixed(1).padStart(4, "0");
    }
    const key = s + sel + fine;
    if (key === last.current) return;
    last.current = key;
    ctx.setTransform(PX, 0, 0, PX, 0, 0);
    // bezel interior
    ctx.fillStyle = "#0d0d0e";
    ctx.fillRect(0, 0, DVM_RECT.w, DVM_RECT.h);
    // range label plate (left)
    ctx.fillStyle = "#1b1c1e";
    ctx.fillRect(4, 6, 36, 48);
    ctx.strokeStyle = "#d8d8d8";
    ctx.lineWidth = 0.35;
    ctx.strokeRect(6, 9, 15, 13);
    ctx.strokeRect(23, 9, 15, 13);
    ctx.fillStyle = "#e8e8e8";
    ctx.font = "bold 3.1px Arial";
    ctx.textAlign = "center";
    ctx.fillText("V", 10.2, 13.6);
    ctx.fillText("mA", 16.6, 13.6);
    ctx.fillText("x.xx", 27.4, 13.6);
    ctx.fillText("xx.x", 33.8, 13.6);
    ctx.font = "2.6px Arial";
    ctx.fillText("FUNC", 13.5, 19.8);
    ctx.fillText("RANGE", 30.5, 19.8);
    // red LED window
    ctx.fillStyle = "#1a0303";
    ctx.fillRect(46, 9, 77, 38);
    draw7seg(ctx, s, 53, 14, 26, "#ff2410", st.power ? "#2c0604" : "#1d0403", 3);
    ctx.fillStyle = "#8c8c8c";
    ctx.font = "2.9px Arial";
    ctx.fillText("KL-DVM-6005A", 84.5, 53);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    tex.needsUpdate = true;
  });
  const [x, z] = P(DVM_RECT.x + DVM_RECT.w / 2, DVM_RECT.y + DVM_RECT.h / 2);
  const bezel = useMemo(() => ringGeometry(mm(DVM_RECT.w + 6), mm(DVM_RECT.h + 6), mm(DVM_RECT.w - 1), mm(DVM_RECT.h - 1), 0.002, 0.0008, 0.0042, 0.0006), []);
  const W = mm(DVM_RECT.w),
    H = mm(DVM_RECT.h);
  const sw = (on: boolean, id: string, cx: number) => (
    <group
      position={[-W / 2 + mm(cx), 0.0018, -H / 2 + mm(39)]}
      onClick={(e) => {
        e.stopPropagation();
        const k = useBench.getState().knobs[id] ?? 0;
        useBench.getState().setKnob(id, k > 0.5 ? 0 : 1);
        sfx("button");
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        useUi.getState().setHover({ id: `dvm:${id}`, label: id === "dvm.sel" ? "V / mA" : "RANGE" });
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        useUi.getState().setHover(null);
        document.body.style.cursor = "auto";
      }}
    >
      <mesh material={MAT.hole()}>
        <boxGeometry args={[mm(13), mm(1.2), mm(8)]} />
      </mesh>
      <mesh position={[on ? mm(3.2) : -mm(3.2), mm(1.6), 0]} castShadow>
        <boxGeometry args={[mm(6), mm(3.2), mm(6.6)]} />
        <meshPhysicalMaterial color="#e5bd2b" roughness={0.35} clearcoat={0.4} />
      </mesh>
    </group>
  );
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={bezel} material={MAT.blackPlastic()} castShadow />
      <mesh position={[0, 0.0006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={2.4} roughness={0.25} />
      </mesh>
      {sw(sel, "dvm.sel", 13.5)}
      {sw(fine, "dvm.rng", 30.5)}
      {/* red filter window */}
      <mesh position={[-W / 2 + mm(84.5), 0.0036, -H / 2 + mm(28)]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.glass()}>
        <planeGeometry args={[mm(77), mm(38)]} />
      </mesh>
    </group>
  );
}

/** moving-coil panel meter: grey frame, recessed white dial, glass, damped needle */
function AnalogMeter({ m }: { m: (typeof TRAINER_METERS)[number] }) {
  const needle = useRef<THREE.Group>(null);
  const face = meterFaceTexture(m.full, m.unit, m.kind.startsWith("ac"));
  // moving-coil movement: J·θ'' + D·θ' + K·θ = torque  (ω0 ≈ 2π·1.6 Hz, ζ ≈ 0.55)
  const st = useRef({ x: 0, v: 0 });
  useFrame((_, dtRaw) => {
    const r = useSim.getState().readings.meters;
    const val = r[m.id as keyof typeof r] ?? 0;
    const target = Math.min(Math.max(val / m.full, -0.04), 1.08); // mechanical end stops
    const w0 = 2 * Math.PI * 1.6,
      zeta = 0.55;
    const dt = Math.min(dtRaw, 0.05);
    const S = st.current;
    for (let i = 0; i < 4; i++) {
      const h = dt / 4;
      const acc = w0 * w0 * (target - S.x) - 2 * zeta * w0 * S.v;
      S.v += acc * h;
      S.x += S.v * h;
      if (S.x < -0.04) {
        S.x = -0.04;
        S.v = Math.abs(S.v) * 0.2;
      }
      if (S.x > 1.08) {
        S.x = 1.08;
        S.v = -Math.abs(S.v) * 0.2;
      }
    }
    if (needle.current) needle.current.rotation.y = 0.72 - S.x * 1.44;
  });
  const [x, z] = P(m.x + m.w / 2, m.y + m.h / 2);
  const W = mm(m.w),
    H = mm(m.h);
  const frame = useMemo(() => ringGeometry(W + mm(7), H + mm(7), W, H, 0.0022, 0.0012, 0.0062, 0.0006), [W, H]);
  const walls = useMemo(() => ringGeometry(W + 0.0002, H + 0.0002, W - mm(1.6), H - mm(1.6), 0.0012, 0.0008, 0.0056, 0), [W, H]);
  const pivotZ = H / 2 + mm(9);
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={frame} castShadow>
        <meshPhysicalMaterial color="#3c3e43" roughness={0.45} clearcoat={0.3} />
      </mesh>
      {/* light-grey inner walls of the movement housing */}
      <mesh geometry={walls}>
        <meshStandardMaterial color="#c9ccd0" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W - mm(1.6), H - mm(1.6)]} />
        <meshStandardMaterial map={face} roughness={0.6} />
      </mesh>
      <group ref={needle} position={[0, 0.0018, pivotZ]}>
        <mesh position={[0, 0, -mm(29)]} material={MAT.blackPlastic()}>
          <boxGeometry args={[mm(0.5), mm(0.35), mm(48)]} />
        </mesh>
      </group>
      {/* movement cover hiding the pivot */}
      <mesh position={[0, 0.0016, H / 2 - mm(3.5)]} material={MAT.blackPlastic()}>
        <boxGeometry args={[mm(24), mm(1.6), mm(6)]} />
      </mesh>
      <mesh position={[0, 0.0058, 0]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.glass()}>
        <planeGeometry args={[W, H]} />
      </mesh>
      {/* zero-adjust screw below the window */}
      <group position={[0, 0.0004, H / 2 + mm(16)]}>
        <mesh material={MAT.blackPlastic()}>
          <cylinderGeometry args={[mm(2.2), mm(2.2), mm(0.8), 16]} />
        </mesh>
        <mesh position={[0, mm(0.45), 0]} rotation={[0, 0.5, 0]} material={MAT.hole()}>
          <boxGeometry args={[mm(3.2), mm(0.2), mm(0.6)]} />
        </mesh>
      </group>
    </group>
  );
}

function PowerSwitch() {
  const power = useBench((s) => s.power);
  return (
    <group
      position={[BODY.w / 2 + 0.006, 0.05, 0.12]}
      onClick={(e) => {
        e.stopPropagation();
        useBench.getState().setPower(!useBench.getState().power);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        useUi.getState().setHover({ id: "power", label: "POWER" });
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        useUi.getState().setHover(null);
        document.body.style.cursor = "auto";
      }}
    >
      <mesh material={MAT.blackPlastic()}>
        <boxGeometry args={[0.006, 0.026, 0.034]} />
      </mesh>
      <mesh position={[0.0042, 0, 0]} rotation={[0, 0, power ? 0.18 : -0.18]}>
        <boxGeometry args={[0.004, 0.02, 0.028]} />
        <meshStandardMaterial color="#c4150f" emissive="#ff2200" emissiveIntensity={power ? 0.9 : 0} roughness={0.4} />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- */
/* Module plate                                                      */
/* ---------------------------------------------------------------- */
function Led({ id, color, x, z }: { id: string; color: string; x: number; z: number }) {
  // emissive epoxy only: no per-LED point light (adding lights recompiles every material in the
  // scene — the stall when switching boards) and no transmission (an extra scene pass per frame)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0, roughness: 0.2 }), [color]);
  useFrame(() => {
    const i = useSim.getState().readings.led[id] ?? 0;
    const b = Math.min(Math.max(i / 0.01, 0), 1.6);
    mat.emissiveIntensity = b * 3.2;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.0035, 0]} material={mat}>
        <cylinderGeometry args={[0.0027, 0.0029, 0.005, 20]} />
      </mesh>
      <mesh position={[0, 0.006, 0]} material={mat}>
        <sphereGeometry args={[0.0027, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- */
/* overheating: smoke from parts above their rating, scorch when burnt */
/* ---------------------------------------------------------------- */
function smokeTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.5, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
let smokeTex: THREE.Texture | null = null;

function Smoke({ x, z, strength }: { x: number; z: number; strength: number }) {
  const N = 60;
  const ref = useRef<THREE.Points>(null);
  const tex = useMemo(() => (smokeTex ??= smokeTexture()), []);
  const st = useMemo(() => {
    const pos = new Float32Array(N * 3);
    const life = new Float32Array(N).map(() => Math.random());
    return { pos, life };
  }, []);
  useFrame((_, dt) => {
    const p = ref.current;
    if (!p) return;
    const a = p.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      st.life[i] += dt * (0.35 + 0.25 * strength);
      if (st.life[i] > 1) st.life[i] -= 1;
      const L = st.life[i];
      const sway = Math.sin((i * 13.1 + L * 6) * 0.7) * 0.006 * L;
      a.array[i * 3] = x + sway + Math.sin(i) * 0.002;
      a.array[i * 3 + 1] = 0.004 + L * 0.09;
      a.array[i * 3 + 2] = z + Math.cos(i * 1.7) * 0.002 + L * 0.01;
    }
    a.needsUpdate = true;
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[st.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial map={tex} size={0.016} sizeAttenuation transparent opacity={0.22 * Math.min(1, strength)} color="#cfcac2" depthWrite={false} />
    </points>
  );
}

function PartFx({ mod }: { mod: ModuleDef }) {
  const stress = useSim((s) => s.readings.stress);
  const damaged = useBench((s) => s.damaged ?? []);
  const custom = useBench((s) => s.customParts);
  const [W, H] = mod.size;
  const posOf = (gid: string): [number, number] | null => {
    let pins: string[] | undefined;
    let at: [number, number] | undefined;
    if (gid.startsWith("m.")) {
      const p = mod.parts.find((x) => `m.${x.id}` === gid);
      pins = p?.pins;
      at = p?.at;
    } else {
      const p = custom.find((x) => `u.${x.id}` === gid);
      pins = p?.gpins.map((g) => g.replace(/^m:/, ""));
    }
    if (at) return [mm(at[0] - W / 2), mm(at[1] - H / 2)];
    const js = (pins ?? []).map((id) => mod.jacks.find((j) => j.id === id)).filter(Boolean) as { x: number; y: number }[];
    if (!js.length) return null;
    const cx = js.reduce((s, j) => s + j.x, 0) / js.length,
      cy = js.reduce((s, j) => s + j.y, 0) / js.length;
    return [mm(cx - W / 2), mm(cy - H / 2)];
  };
  const scorch = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, "rgba(20,12,6,0.95)");
    g.addColorStop(0.45, "rgba(60,36,14,0.55)");
    g.addColorStop(1, "rgba(90,60,20,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  return (
    <group>
      {stress.map((s) => {
        const p = posOf(s.id);
        if (!p) return null;
        return <Smoke key={s.id} x={p[0]} z={p[1]} strength={Math.min(2, s.power / s.rating / 2)} />;
      })}
      {damaged.map((id) => {
        const p = posOf(id);
        if (!p) return null;
        return (
          <mesh key={id} position={[p[0], 0.0006, p[1]]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.026, 0.026]} />
            <meshBasicMaterial map={scorch} transparent depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

export function ModulePlate({ mod }: { mod: ModuleDef }) {
  const ref = useRef<THREE.Group>(null);
  const tex = moduleTexture(mod);
  const [W, H] = mod.size;
  const plateMats = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ color: "#d6d6d0", roughness: 0.5, normalMap: plasticNormal([2, 2]), normalScale: new THREE.Vector2(0.2, 0.2) });
    // matte screen-printed board: no sheen washing out the print under the lights
    const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.93, envMapIntensity: 0.5 });
    return [side, side, top, side, side, side];
  }, [tex]);
  const plateRef = useRef<THREE.Mesh>(null);
  useEffect(() => {
    const p = plateRef.current;
    if (p) surfaces.add(p);
    return () => {
      if (p) surfaces.delete(p);
    };
  }, []);
  const jp = (id: string) => mod.jacks.find((j) => j.id === id);
  const leds = mod.parts.filter((p) => p.kind === "LED");
  const knobs = mod.parts.filter((p) => p.knob);
  const customParts = useBench((s) => s.customParts);
  return (
    <group ref={ref}>
      <mesh ref={plateRef} position={[0, -0.0015, 0]} material={plateMats} castShadow receiveShadow>
        <boxGeometry args={[mm(W), 0.003, mm(H)]} />
      </mesh>
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * mm(W / 2 - 8), -0.011, sz * mm(H / 2 - 8)]} material={MAT.aluminium()}>
          <cylinderGeometry args={[0.004, 0.004, 0.016, 12]} />
        </mesh>
      ))}
      <PinJacks jacks={mod.jacks} prefix="m:" width={W} height={H} owner={ref} />
      {leds.map((p) => {
        const a = jp(p.pins[0]),
          b = jp(p.pins[1]);
        if (!a || !b) return null;
        return <Led key={p.id} id={`m.${p.id}`} color={p.color ?? "#ff2020"} x={mm((a.x + b.x) / 2 - W / 2)} z={mm((a.y + b.y) / 2 - H / 2)} />;
      })}
      {knobs.map((p) => {
        const a = jp(p.pins[0]),
          b = jp(p.pins[p.pins.length - 1]);
        const at = p.at ?? (a && b ? [(a.x + b.x) / 2 + 8, (a.y + b.y) / 2] : [0, 0]);
        return <Knob key={p.id} id={p.knob!} x={mm(at[0] - W / 2 + (p.kind === "POT" ? -9 : 0))} z={mm(at[1] - H / 2)} r={5} style="trimmer" />;
      })}
      {customParts.map((p) => (
        <CustomPart3D key={p.id} part={p} />
      ))}
      <PartFx mod={mod} />
    </group>
  );
}

/* ---------------------------------------------------------------- */
/* Components placed by the user on the breadboard                    */
/* ---------------------------------------------------------------- */

const BAND = ["#111", "#7a3b12", "#d21f1f", "#f07b12", "#f5d212", "#1c9a3a", "#1f4fd8", "#8a2fc2", "#888", "#f3f3f3"];
function resistorBands(r: number) {
  const exp = Math.floor(Math.log10(r)) - 1;
  const sig = Math.round(r / Math.pow(10, exp));
  const d1 = Math.floor(sig / 10) % 10,
    d2 = sig % 10;
  return [BAND[d1], BAND[d2], BAND[Math.max(0, Math.min(9, exp))], "#c9a03a"];
}

function CustomPart3D({ part }: { part: CustomPart }) {
  const grp = useRef<THREE.Group>(null);
  const [pinPos, setPinPos] = useState<THREE.Vector3[]>([]);
  const pinKey = part.gpins.join(",");
  useLayoutEffect(() => {
    const g = grp.current;
    if (!g || !g.parent) return;
    g.parent.updateWorldMatrix(true, false);
    const v = part.gpins.map((id) => anchorWorld(id) ?? new THREE.Vector3());
    setPinPos(v.map((p) => g.parent!.worldToLocal(p.clone())));
  }, [pinKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const pins = { current: pinPos };
  const a = pins.current[0] ?? new THREE.Vector3();
  const b = pins.current[1] ?? a;
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const len = Math.max(a.distanceTo(b), 0.001);
  const ang = Math.atan2(b.z - a.z, b.x - a.x);
  const lift = 0.008;
  const body = (() => {
    switch (part.kind) {
      case "R":
        return (
          <group>
            <mesh rotation={[0, 0, Math.PI / 2]} material={plastic("#d8c39a")}>
              <capsuleGeometry args={[0.0022, 0.007, 4, 12]} />
            </mesh>
            {resistorBands(part.value ?? 1000).map((c, i) => (
              <mesh key={i} position={[-0.0028 + i * 0.0017, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.00232, 0.00232, 0.0007, 12]} />
                <meshStandardMaterial color={c} roughness={0.5} />
              </mesh>
            ))}
          </group>
        );
      case "C":
        return (
          <mesh material={plastic("#d48a2a")}>
            <sphereGeometry args={[0.0032, 16, 10]} />
          </mesh>
        );
      case "CP":
        return (
          <mesh position={[0, 0.004, 0]} material={plastic("#1d3fa8")}>
            <cylinderGeometry args={[0.004, 0.004, 0.011, 20]} />
          </mesh>
        );
      case "L":
        return (
          <mesh rotation={[0, 0, Math.PI / 2]} material={plastic("#2f7a3a")}>
            <cylinderGeometry args={[0.0035, 0.0035, 0.009, 16]} />
          </mesh>
        );
      case "D":
      case "Z":
        return (
          <group>
            <mesh rotation={[0, 0, Math.PI / 2]} material={plastic(part.kind === "Z" ? "#d24a2a" : "#151515")}>
              <cylinderGeometry args={[0.0017, 0.0017, 0.006, 12]} />
            </mesh>
            <mesh position={[0.0022, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={MAT.white()}>
              <cylinderGeometry args={[0.00175, 0.00175, 0.0009, 12]} />
            </mesh>
          </group>
        );
      case "LED":
        return <Led id={`u.${part.id}`} color={part.color ?? "#ff2020"} x={0} z={0} />;
      default:
        return (
          <mesh position={[0, 0.003, 0]} material={MAT.blackPlastic()}>
            <cylinderGeometry args={[0.0025, 0.0025, 0.005, 16, 1, false, 0, Math.PI]} />
          </mesh>
        );
    }
  })();
  return (
    <group ref={grp} onContextMenu={removeOnRightClick(() => useBench.getState().removeCustomPart(part.id))}>
      {/* leads */}
      {pins.current.map((p, i) => (
        <mesh key={i} position={[p.x, p.y + lift / 2, p.z]} material={MAT.chrome()}>
          <cylinderGeometry args={[0.0003, 0.0003, lift, 6]} />
        </mesh>
      ))}
      {pins.current.length >= 2 && (
        <mesh position={[mid.x, mid.y + lift, mid.z]} rotation={[0, -ang, 0]} material={MAT.chrome()}>
          <boxGeometry args={[len, 0.0005, 0.0005]} />
        </mesh>
      )}
      <group position={[mid.x, mid.y + lift + 0.001, mid.z]} rotation={[0, -ang, 0]}>
        {body}
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- */
export function Trainer({ position = [0, 0, 0] as [number, number, number], rotationY = 0, interactive = true }) {
  const bodyGeo = useBodyGeometry();
  const panelTex = trainerPanelTexture();
  const moduleId = useBench((s) => s.moduleId);
  const mod = getModule(moduleId);
  const panelRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  useEffect(() => {
    if (!interactive) return;
    const a = panelRef.current,
      b = bodyRef.current;
    if (a) surfaces.add(a);
    if (b) surfaces.add(b);
    return () => {
      if (a) surfaces.delete(a);
      if (b) surfaces.delete(b);
    };
  }, [interactive]);
  const cy = (BODY.hFront + BODY.hBack) / 2;
  const nrm = new THREE.Vector3(0, Math.cos(SLOPE), Math.sin(SLOPE)).multiplyScalar(0.0082);
  const [mx, mz] = P(MODULE_SLOT.x + MODULE_SLOT.w / 2, MODULE_SLOT.y + MODULE_SLOT.h / 2);
  // the experiment boards are drawn at 368 x 252 mm; fit them to the slot
  const ms = Math.min(MODULE_SLOT.w / 368, MODULE_SLOT.h / 252);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh ref={bodyRef} geometry={bodyGeo} material={MAT.beige()} castShadow receiveShadow />
      {/* rubber feet */}
      {[
        [-0.27, -0.2],
        [0.27, -0.2],
        [-0.27, 0.2],
        [0.27, 0.2],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, -0.003, z]} material={MAT.blackPlastic()}>
          <cylinderGeometry args={[0.012, 0.012, 0.006, 16]} />
        </mesh>
      ))}
      {interactive && <PowerSwitch />}
      <group position={[0, cy + nrm.y, nrm.z]} rotation={[SLOPE, 0, 0]}>
        <mesh ref={panelRef} position={[0, 0.0004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[mm(TRAINER_W), mm(TRAINER_H)]} />
          {/* matte printed aluminium: the legends stay readable under the ceiling lights */}
          <meshStandardMaterial map={panelTex} roughness={0.92} envMapIntensity={0.5} />
        </mesh>
        <PanelRim />
        {interactive ? (
          <>
            {TRAINER_JACKS.map((j) => {
              const [x, z] = P(j.x, j.y);
              return <BananaJack key={j.id} gid={`tr:${j.id}`} x={x} z={z} style={j.style ?? "black"} label={j.label ?? j.id} />;
            })}
            <JackVisuals jacks={JACK_SPOTS} />
            {TRAINER_KNOBS.map((k) => {
              const [x, z] = P(k.x, k.y);
              return <Knob key={k.id} id={k.id} x={x} z={z} r={k.r} detents={k.detents} bare={k.bare} />;
            })}
            <DigitalMeter />
            {TRAINER_METERS.map((m) => (
              <AnalogMeter key={m.id} m={m} />
            ))}
            <MergeStatic>
              <PanelScrews />
            </MergeStatic>
            <group position={[mx, 0.017 * ms, mz]} scale={[ms, ms, ms]}>
              <ModulePlate key={mod.id} mod={mod} />
            </group>
          </>
        ) : (
          <StaticDecor />
        )}
      </group>
    </group>
  );
}

/** shared instanced geometry for the far benches' decor */
const decorGeo = {
  jack: new THREE.CylinderGeometry(0.0046, 0.005, 0.006, 10),
  knob: new THREE.CylinderGeometry(0.9, 1.1, 0.015, 20),
  cap: new THREE.CylinderGeometry(0.78, 0.78, 0.0006, 20),
  frame: new THREE.BoxGeometry(1, 0.006, 1),
};
const decorMat = {
  jack: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.45 }),
  cap: new THREE.MeshStandardMaterial({ color: "#e9e5da", roughness: 0.4 }),
};

/** cheaper non-interactive dressing for the other benches: a handful of draw calls per trainer */
function StaticDecor() {
  const tex = moduleTexture(getModule("kl23001"));
  const [mx, mz] = P(MODULE_SLOT.x + MODULE_SLOT.w / 2, MODULE_SLOT.y + MODULE_SLOT.h / 2);
  const ms = Math.min(MODULE_SLOT.w / 368, MODULE_SLOT.h / 252);
  const jacks = useRef<THREE.InstancedMesh>(null);
  const knobs = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const frames = useRef<THREE.InstancedMesh>(null);
  const capped = TRAINER_KNOBS.filter((k) => !k.bare);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    const J = jacks.current,
      K = knobs.current,
      C = caps.current,
      F = frames.current;
    if (!J || !K || !C || !F) return;
    TRAINER_JACKS.forEach((j, i) => {
      const [x, z] = P(j.x, j.y);
      const small = j.style === "brass";
      o.position.set(x, 0.003, z);
      o.scale.set(small ? 0.68 : 1, 1, small ? 0.68 : 1);
      o.updateMatrix();
      J.setMatrixAt(i, o.matrix);
      J.setColorAt(i, col.set(small ? "#1b1a18" : (PLASTIC_COLORS[j.style ?? "black"] ?? "#151515")));
    });
    TRAINER_KNOBS.forEach((k, i) => {
      const [x, z] = P(k.x, k.y);
      o.position.set(x, 0.0075, z);
      o.scale.set(mm(k.r), 1, mm(k.r));
      o.updateMatrix();
      K.setMatrixAt(i, o.matrix);
    });
    capped.forEach((k, i) => {
      const [x, z] = P(k.x, k.y);
      o.position.set(x, 0.0152, z);
      o.scale.set(mm(k.r), 1, mm(k.r));
      o.updateMatrix();
      C.setMatrixAt(i, o.matrix);
    });
    TRAINER_METERS.forEach((m, i) => {
      const [x, z] = P(m.x + m.w / 2, m.y + m.h / 2);
      o.position.set(x, 0.003, z);
      o.scale.set(mm(m.w + 7), 1, mm(m.h + 7));
      o.updateMatrix();
      F.setMatrixAt(i, o.matrix);
    });
    for (const m of [J, K, C, F]) {
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
    if (J.instanceColor) J.instanceColor.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <instancedMesh ref={jacks} args={[decorGeo.jack, decorMat.jack, TRAINER_JACKS.length]} />
      <instancedMesh ref={knobs} args={[decorGeo.knob, MAT.blackPlastic(), TRAINER_KNOBS.length]} />
      <instancedMesh ref={caps} args={[decorGeo.cap, decorMat.cap, capped.length]} />
      <instancedMesh ref={frames} args={[decorGeo.frame, MAT.darkGrey(), TRAINER_METERS.length]} />
      {TRAINER_METERS.map((m) => {
        const [x, z] = P(m.x + m.w / 2, m.y + m.h / 2);
        return (
          <group key={m.id} position={[x, 0, z]}>
            <mesh position={[0, 0.0062, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[mm(m.w), mm(m.h)]} />
              <meshStandardMaterial map={meterFaceTexture(m.full, m.unit, m.kind.startsWith("ac"))} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[mx, 0.017, mz]} castShadow>
        <boxGeometry args={[0.368 * ms, 0.003, 0.252 * ms]} />
        <meshStandardMaterial attach="material-2" map={tex} />
        <meshStandardMaterial attach="material-0" color="#d9d9d4" />
        <meshStandardMaterial attach="material-1" color="#d9d9d4" />
        <meshStandardMaterial attach="material-3" color="#d9d9d4" />
        <meshStandardMaterial attach="material-4" color="#d9d9d4" />
        <meshStandardMaterial attach="material-5" color="#d9d9d4" />
      </mesh>
      <PanelRim />
    </>
  );
}
