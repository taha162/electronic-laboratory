"use client";
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useBench } from "@/store/bench";
import type { LeadId, Wire } from "@/lab/types";
import { anchorNormal, anchorWorld, pointerHit, surfaces, useUi } from "./registry";
import { MAT, PLASTIC_COLORS, plastic } from "./materials";
import { RoundedBox } from "@react-three/drei";
import { plasticNormal } from "./draw/pbr";
import { nodeVoltage, voltageColor } from "./simView";
import { sfx } from "@/audio/audio";
import { removeOnRightClick, setCursor } from "./interaction";

export const DESK_Y = 0.762;
const UP = new THREE.Vector3(0, 1, 0);

/* ---------------------------------------------------------------- */
/* geometry helpers                                                   */
/* ---------------------------------------------------------------- */
/** KL-21001 footprint on the bench (world) — cables are draped over it */
const TR = { x0: -0.285, x1: 0.345, z0: -0.318, z1: 0.178, front: 0.169, cx: 0.03, cz: -0.07 };
function trainerTop(x: number, z: number): number | null {
  if (x < TR.x0 || x > TR.x1 || z < TR.z0 || z > TR.z1) return null;
  // panel plane: 66 mm at the front edge rising 70 mm over the 478 mm depth
  const y = DESK_Y + 0.066 + (Math.max(TR.front - z, 0) / 0.478) * 0.07;
  // module plate + jacks/knobs stand proud of the panel
  const onModule = x > -0.148 && x < 0.21 && z > -0.167 && z < 0.087;
  return y + (onModule ? 0.03 : 0.022);
}
function drape(p: THREE.Vector3) {
  const top = trainerTop(p.x, p.z);
  if (top !== null && p.y < top) p.y = top;
  if (p.y < DESK_Y + 0.003) p.y = DESK_Y + 0.003;
  return p;
}

export function cableCurve(a: THREE.Vector3, na: THREE.Vector3, b: THREE.Vector3, nb: THREE.Vector3, rise = 0.03, sagK = 0.2) {
  const p1 = a.clone().addScaledVector(na, rise);
  const p3 = b.clone().addScaledVector(nb, rise);
  const d = p1.distanceTo(p3);
  // catenary-like sag between the two raised points, then drape over obstacles
  const N = Math.max(6, Math.min(16, Math.round(d / 0.035)));
  const pts: THREE.Vector3[] = [a, a.clone().addScaledVector(na, rise * 0.5)];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const p = p1.clone().lerp(p3, u);
    p.y -= (sagK * d + 0.004) * 4 * u * (1 - u);
    if (i > 0 && i < N) drape(p);
    pts.push(p);
  }
  pts.push(b.clone().addScaledVector(nb, rise * 0.5), b);
  return new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
}

function useTube(radius: number, segs = 56) {
  const mesh = useRef<THREE.Mesh>(null);
  const last = useRef<number[]>([]);
  const update = (curve: THREE.Curve<THREE.Vector3> | null, key: number[]) => {
    const m = mesh.current;
    if (!m) return;
    if (!curve) {
      m.visible = false;
      return;
    }
    m.visible = true;
    const L = last.current;
    let same = L.length === key.length;
    if (same) for (let i = 0; i < key.length; i++) if (Math.abs(L[i] - key[i]) > 1e-5) same = false;
    if (same) return;
    last.current = key;
    const g = new THREE.TubeGeometry(curve, segs, radius, 8, false);
    m.geometry.dispose();
    m.geometry = g;
  };
  return { mesh, update };
}

function orient(obj: THREE.Object3D | null, pos: THREE.Vector3, dir: THREE.Vector3) {
  if (!obj) return;
  obj.position.copy(pos);
  obj.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
}

/* ---------------------------------------------------------------- */
/* patch cords                                                        */
/* ---------------------------------------------------------------- */
function Plug({ color, small, refFn }: { color: string; small: boolean; refFn: (o: THREE.Group | null) => void }) {
  const s = small ? 0.68 : 1;
  return (
    <group ref={refFn}>
      <mesh position={[0, -0.0035 * s, 0]} material={MAT.chrome()}>
        <cylinderGeometry args={[0.0019 * s, 0.0019 * s, 0.007 * s, 10]} />
      </mesh>
      <mesh position={[0, 0.006 * s, 0]} material={plastic(color)} castShadow>
        <cylinderGeometry args={[0.0042 * s, 0.0048 * s, 0.013 * s, 18]} />
      </mesh>
      <mesh position={[0, 0.0145 * s, 0]} material={plastic(color)}>
        <cylinderGeometry args={[0.0024 * s, 0.0038 * s, 0.006 * s, 14]} />
      </mesh>
      {!small && (
        <mesh position={[0, 0.0127, 0]} material={plastic(color)}>
          <torusGeometry args={[0.0044, 0.0006, 6, 18]} />
        </mesh>
      )}
    </group>
  );
}

/** PVC insulation of the patch cords */
function cordMaterial(color: string) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.42,
    clearcoat: 0.35,
    clearcoatRoughness: 0.3,
    normalMap: plasticNormal([24, 1]),
    normalScale: new THREE.Vector2(0.12, 0.12),
    emissive: color,
    emissiveIntensity: 0,
  });
}

function PatchCord({ w, stackA, stackB }: { w: Wire; stackA: number; stackB: number }) {
  const selected = useBench((s) => s.selectedWire === w.id);
  const tube = useTube(0.0017, 72);
  const pa = useRef<THREE.Group | null>(null);
  const pb = useRef<THREE.Group | null>(null);
  const smallA = w.a.startsWith("m:"),
    smallB = w.b.startsWith("m:");
  const lenA = smallA ? 0.0125 : 0.018,
    lenB = smallB ? 0.0125 : 0.018;
  const va = useMemo(() => new THREE.Vector3(), []);
  const vb = useMemo(() => new THREE.Vector3(), []);
  const col = PLASTIC_COLORS[w.color] ?? w.color;
  const mat = useMemo(() => cordMaterial(col), [col]);
  const insightCol = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const a = anchorWorld(w.a, va),
      b = anchorWorld(w.b, vb);
    if (!a || !b) return tube.update(null, []);
    const na = anchorNormal(w.a),
      nb = anchorNormal(w.b);
    // stacked banana plugs sit in the rear socket of the plug below
    a.addScaledVector(na, stackA);
    b.addScaledVector(nb, stackB);
    orient(pa.current, a, na);
    orient(pb.current, b, nb);
    const ta = a.clone().addScaledVector(na, lenA),
      tb = b.clone().addScaledVector(nb, lenB);
    tube.update(cableCurve(ta, na, tb, nb, 0.02, 0.22), [...ta.toArray(), ...tb.toArray()]);
    // X-ray mode: cords glow with the colour of their potential
    if (useUi.getState().insight) {
      const v = nodeVoltage(w.a);
      voltageColor(v, insightCol);
      mat.emissive.copy(insightCol);
      mat.emissiveIntensity = 0.55 + 0.25 * Math.sin(clock.elapsedTime * 3);
    } else {
      mat.emissive.set(col);
      mat.emissiveIntensity = selected ? 0.55 : 0;
    }
  });
  const handlers = {
    onClick: (e: { stopPropagation(): void }) => {
      e.stopPropagation();
      useBench.getState().selectWire(selected ? null : w.id);
    },
    onDoubleClick: (e: { stopPropagation(): void }) => {
      e.stopPropagation();
      useBench.getState().removeWire(w.id);
      sfx("unplug");
    },
    onContextMenu: removeOnRightClick(() => {
      useBench.getState().removeWire(w.id);
      sfx("unplug");
    }),
    onPointerOver: (e: { stopPropagation(): void }) => {
      e.stopPropagation();
      setCursor("pointer");
    },
    onPointerOut: () => setCursor("auto"),
  };
  return (
    <group {...handlers}>
      <mesh ref={tube.mesh} material={mat} castShadow />
      <Plug color={w.color} small={smallA} refFn={(o) => (pa.current = o)} />
      <Plug color={w.color} small={smallB} refFn={(o) => (pb.current = o)} />
    </group>
  );
}

/** short-circuit clip bridging two neighbouring sockets on a module */
function ShortClip({ w }: { w: Wire }) {
  const g = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const pinA = useRef<THREE.Mesh>(null);
  const pinB = useRef<THREE.Mesh>(null);
  const selected = useBench((s) => s.selectedWire === w.id);
  const va = useMemo(() => new THREE.Vector3(), []);
  const vb = useMemo(() => new THREE.Vector3(), []);
  const col = PLASTIC_COLORS[w.color] ?? w.color;
  const mat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.25, emissive: col, emissiveIntensity: 0 }),
    [col],
  );
  mat.emissiveIntensity = selected ? 0.5 : 0;
  useFrame(() => {
    const a = anchorWorld(w.a, va),
      b = anchorWorld(w.b, vb);
    if (!a || !b || !g.current || !body.current) return;
    const n = anchorNormal(w.a);
    const mid = a.clone().add(b).multiplyScalar(0.5).addScaledVector(n, 0.0046);
    g.current.position.copy(mid);
    // x axis along a->b, y along normal
    const xAxis = b.clone().sub(a).normalize();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, n).normalize();
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis);
    g.current.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    const L = a.distanceTo(b);
    body.current.scale.set(L + 0.0072, 1, 1);
    pinA.current?.position.set(-L / 2, -0.0046, 0);
    pinB.current?.position.set(L / 2, -0.0046, 0);
  });
  return (
    <group
      ref={g}
      onClick={(e) => {
        e.stopPropagation();
        useBench.getState().selectWire(selected ? null : w.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        useBench.getState().removeWire(w.id);
        sfx("unplug");
      }}
      onContextMenu={removeOnRightClick(() => {
        useBench.getState().removeWire(w.id);
        sfx("unplug");
      })}
    >
      <group ref={body}>
        <RoundedBox args={[1, 0.0064, 0.0056]} radius={0.0011} smoothness={2} material={mat} castShadow />
        {/* moulded grip ridges */}
        {[-0.22, 0, 0.22].map((x) => (
          <mesh key={x} position={[x, 0.0033, 0]} material={mat}>
            <boxGeometry args={[0.06, 0.0008, 0.0056]} />
          </mesh>
        ))}
      </group>
      <mesh ref={pinA} material={MAT.chrome()}>
        <cylinderGeometry args={[0.0007, 0.0007, 0.003, 8]} />
      </mesh>
      <mesh ref={pinB} material={MAT.chrome()}>
        <cylinderGeometry args={[0.0007, 0.0007, 0.003, 8]} />
      </mesh>
    </group>
  );
}

export function Wires() {
  const wires = useBench((s) => s.wires);
  // stacking order: clips first (they sit in the socket), then cords in order of insertion
  const stacks = useMemo(() => {
    const h = new Map<string, number>();
    const out: Record<string, [number, number]> = {};
    for (const w of wires) if (w.kind === "clip") for (const j of [w.a, w.b]) h.set(j, Math.max(h.get(j) ?? 0, 0.0085));
    for (const w of wires) {
      if (w.kind === "clip") continue;
      const ha = h.get(w.a) ?? 0,
        hb = h.get(w.b) ?? 0;
      out[w.id] = [ha, hb];
      h.set(w.a, ha + (w.a.startsWith("m:") ? 0.0105 : 0.0155));
      h.set(w.b, hb + (w.b.startsWith("m:") ? 0.0105 : 0.0155));
    }
    return out;
  }, [wires]);
  return (
    <group>
      {wires.map((w) =>
        w.kind === "clip" ? <ShortClip key={w.id} w={w} /> : <PatchCord key={w.id} w={w} stackA={stacks[w.id]?.[0] ?? 0} stackB={stacks[w.id]?.[1] ?? 0} />,
      )}
      <GhostWire />
    </group>
  );
}

/* ---------------------------------------------------------------- */
/* Pointer tracking + ghost wire                                      */
/* ---------------------------------------------------------------- */
const deskPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DESK_Y);
export function PointerTracker() {
  const { raycaster, camera, pointer } = useThree();
  useFrame(() => {
    const s = useBench.getState();
    if (!s.pending && !s.heldLead) {
      pointerHit.valid = false;
      return;
    }
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...surfaces], false);
    if (hits.length) pointerHit.point.copy(hits[0].point);
    else raycaster.ray.intersectPlane(deskPlane, pointerHit.point);
    pointerHit.valid = true;
  });
  return null;
}

function GhostWire() {
  const tube = useTube(0.0015, 40);
  const color = useBench((s) => s.wireColor);
  const plug = useRef<THREE.Group | null>(null);
  const va = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const p = useBench.getState().pending;
    if (!p || !pointerHit.valid) {
      tube.update(null, []);
      if (plug.current) plug.current.visible = false;
      return;
    }
    const a = anchorWorld(p, va);
    if (!a) return tube.update(null, []);
    const na = anchorNormal(p);
    const b = pointerHit.point.clone().add(new THREE.Vector3(0, 0.025, 0));
    if (plug.current) {
      plug.current.visible = true;
      orient(plug.current, b, UP);
    }
    const ta = a.clone().addScaledVector(na, 0.016);
    tube.update(cableCurve(ta, na, b.clone().add(new THREE.Vector3(0, 0.015, 0)), UP, 0.02, 0.15), [...ta.toArray(), ...b.toArray()]);
  });
  const col = PLASTIC_COLORS[color];
  return (
    <group raycast={() => null}>
      <mesh ref={tube.mesh} raycast={() => null}>
        <meshStandardMaterial color={col} transparent opacity={0.75} roughness={0.4} />
      </mesh>
      <Plug color={color} small refFn={(o) => (plug.current = o)} />
    </group>
  );
}

/* ---------------------------------------------------------------- */
/* Instrument leads (scope probes + DMM pens)                         */
/* ---------------------------------------------------------------- */
function restPos(lead: LeadId, out: THREE.Vector3) {
  const d = useBench.getState().devices;
  const local: Record<LeadId, [number, number, "osc" | "dmm"]> = {
    "osc.ch1": [-0.075, 0.17, "osc"],
    "osc.ch1g": [-0.1, 0.19, "osc"],
    "osc.ch2": [-0.01, 0.2, "osc"],
    "osc.ch2g": [0.02, 0.22, "osc"],
    "dmm.v": [0.07, 0.12, "dmm"],
    "dmm.com": [-0.07, 0.13, "dmm"],
  };
  const [lx, lz, dev] = local[lead];
  const p = d[dev];
  const c = Math.cos(p.rot),
    s = Math.sin(p.rot);
  out.set(p.x + lx * c + lz * s, DESK_Y + 0.006, Math.min(p.z - lx * s + lz * c, 0.39));
  return out;
}

interface LeadSpec {
  id: LeadId;
  src: string | null; // anchor id where the cable starts (null = from another lead's body)
  kind: "probe" | "ground" | "pen";
  color: string;
  radius: number;
}
const LEADS: LeadSpec[] = [
  { id: "osc.ch1", src: "osc.ch1.src", kind: "probe", color: "#4a4e52", radius: 0.0022 },
  { id: "osc.ch2", src: "osc.ch2.src", kind: "probe", color: "#4a4e52", radius: 0.0022 },
  { id: "osc.ch1g", src: null, kind: "ground", color: "#111111", radius: 0.0008 },
  { id: "osc.ch2g", src: null, kind: "ground", color: "#111111", radius: 0.0008 },
  { id: "dmm.v", src: "dmm.v.src", kind: "pen", color: "#c11818", radius: 0.0016 },
  { id: "dmm.com", src: "dmm.com.src", kind: "pen", color: "#151515", radius: 0.0016 },
];

function ProbeTipModel({ ch }: { ch: number }) {
  return (
    <group>
      {/* hook tip */}
      <mesh position={[0, 0.004, 0]} material={MAT.chrome()}>
        <cylinderGeometry args={[0.0005, 0.0005, 0.008, 6]} />
      </mesh>
      <mesh position={[0, 0.016, 0]}>
        <cylinderGeometry args={[0.0028, 0.0018, 0.018, 16]} />
        <meshStandardMaterial color="#5b5f63" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.027, 0]}>
        <torusGeometry args={[0.0042, 0.0012, 8, 20]} />
        <meshStandardMaterial color="#3a3d40" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.0042, 0.0034, 0.042, 18]} />
        <meshStandardMaterial color="#6c7075" roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.072, 0]}>
        <cylinderGeometry args={[0.0028, 0.0028, 0.004, 12]} />
        <meshStandardMaterial color={ch === 0 ? "#e8cf18" : "#1fb6e0"} roughness={0.4} />
      </mesh>
    </group>
  );
}
function GroundClipModel() {
  return (
    <group>
      <mesh position={[0, 0.006, 0]} rotation={[0, 0, 0.12]} castShadow>
        <boxGeometry args={[0.0038, 0.013, 0.0026]} />
        <meshStandardMaterial color="#181818" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.0005, 0]} material={MAT.chrome()}>
        <boxGeometry args={[0.0028, 0.002, 0.0018]} />
      </mesh>
    </group>
  );
}
function PenModel({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.007, 0]} material={MAT.chrome()}>
        <cylinderGeometry args={[0.0006, 0.0009, 0.014, 8]} />
      </mesh>
      <mesh position={[0, 0.017, 0]} castShadow>
        <cylinderGeometry args={[0.0042, 0.0028, 0.008, 16]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.0042, 0.0042, 0.08, 16]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
    </group>
  );
}

const TIP_LEN: Record<LeadSpec["kind"], number> = { probe: 0.074, ground: 0.012, pen: 0.1 };

export function Leads() {
  const tips = useRef<Record<string, THREE.Group | null>>({});
  const tubes = LEADS.map((l) => useTube(l.radius, l.kind === "ground" ? 28 : 90)); // eslint-disable-line react-hooks/rules-of-hooks
  const leads = useBench((s) => s.leads);
  const held = useBench((s) => s.heldLead);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), []);
  const bodyTop = useRef<Record<string, THREE.Vector3>>({});

  useFrame(() => {
    const st = useBench.getState();
    LEADS.forEach((l, i) => {
      const jack = st.leads[l.id];
      const isHeld = st.heldLead === l.id;
      let pos: THREE.Vector3;
      let dir: THREE.Vector3;
      if (jack && anchorWorld(jack, tmp.a)) {
        pos = tmp.a.clone();
        dir = anchorNormal(jack).clone();
        if (l.kind === "probe" || l.kind === "pen") dir.add(new THREE.Vector3(0, 0, 0.35)).normalize();
      } else if (isHeld && pointerHit.valid) {
        pos = pointerHit.point.clone().add(new THREE.Vector3(0, 0.03, 0));
        dir = UP.clone();
      } else if (l.kind === "ground") {
        // unattached ground clip dangles from its probe
        const parent = l.id === "osc.ch1g" ? "osc.ch1" : "osc.ch2";
        const ptip = tips.current[parent]?.position;
        pos = ptip ? drape(ptip.clone().add(new THREE.Vector3(0.025, -0.06, 0.03))) : restPos(l.id, tmp.b).clone();
        dir = UP.clone();
      } else {
        pos = restPos(l.id, tmp.b).clone();
        // lying on the desk, pointing away from the instrument
        const dev = l.id.startsWith("osc") ? st.devices.osc : st.devices.dmm;
        dir = new THREE.Vector3(pos.x - dev.x, 0, pos.z - dev.z).normalize().negate();
        dir.y = 0.06;
        dir.normalize();
      }
      orient(tips.current[l.id], pos, dir);
      const top = pos.clone().addScaledVector(dir, TIP_LEN[l.kind]);
      bodyTop.current[l.id] = top;
      // cable
      let src: THREE.Vector3 | null = null;
      let srcN = UP.clone();
      if (l.src) {
        src = anchorWorld(l.src, new THREE.Vector3());
        if (l.src.startsWith("osc")) srcN = anchorNormal(l.src);
      } else {
        // ground lead starts on the probe body
        const parent = l.id === "osc.ch1g" ? "osc.ch1" : "osc.ch2";
        const pt = bodyTop.current[parent];
        const ptip = tips.current[parent]?.position;
        if (pt && ptip) src = ptip.clone().lerp(pt, 0.35);
      }
      if (!src) return tubes[i].update(null, []);
      const curve = cableCurve(top, dir, src, srcN, l.kind === "ground" ? 0.01 : 0.03, l.kind === "ground" ? 0.35 : 0.45);
      tubes[i].update(curve, [...top.toArray(), ...src.toArray()]);
    });
  });

  return (
    <group>
      {LEADS.map((l, i) => (
        <group key={l.id}>
          <mesh ref={tubes[i].mesh} castShadow>
            <meshStandardMaterial color={l.color} roughness={l.kind === "probe" ? 0.55 : 0.4} />
          </mesh>
          <group
            ref={(o) => {
              tips.current[l.id] = o;
            }}
            onClick={(e) => {
              e.stopPropagation();
              const s = useBench.getState();
              if (s.heldLead === l.id) s.attachLead(l.id, null);
              else s.pickLead(l.id);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              useUi.getState().setHover({ id: `lead:${l.id}`, label: l.id });
              setCursor("grab");
            }}
            onPointerOut={() => {
              useUi.getState().setHover(null);
              setCursor("auto");
            }}
          >
            {l.kind === "probe" && <ProbeTipModel ch={l.id === "osc.ch1" ? 0 : 1} />}
            {l.kind === "ground" && <GroundClipModel />}
            {l.kind === "pen" && <PenModel color={l.id === "dmm.v" ? "#c11818" : "#151515"} />}
            {/* bigger invisible grab target */}
            <mesh visible={false} position={[0, TIP_LEN[l.kind] / 2, 0]}>
              <cylinderGeometry args={[0.008, 0.008, TIP_LEN[l.kind] + 0.01, 8]} />
            </mesh>
          </group>
        </group>
      ))}
      {/* keep react aware of lead state for re-render of highlight */}
      <group userData={{ leads, held }} />
    </group>
  );
}
