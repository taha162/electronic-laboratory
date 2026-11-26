"use client";
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useBench } from "@/store/bench";
import { EXPERIMENT_BY_ID } from "@/lab/experiments";
import { checkStep } from "@/lab/experimentActions";
import { jackVoltage, useSim } from "@/lab/simController";
import { anchorNormal, anchorWorld, useUi } from "./registry";
import { cableCurve } from "./Cables";
import { fmtVolt } from "./simView";

/* ---------------------------------------------------------------- */
/* Guide: where does the next cord go?                               */
/* ---------------------------------------------------------------- */
function useMissingPairs(): [string, string][] {
  const [pairs, setPairs] = useState<[string, string][]>([]);
  useEffect(() => {
    const compute = () => {
      const s = useBench.getState();
      const exp = s.experimentId ? EXPERIMENT_BY_ID[s.experimentId] : null;
      const step = exp?.steps[s.step];
      if (!exp || !step || !useUi.getState().guide || s.moduleId !== exp.module) return setPairs([]);
      setPairs(checkStep(exp.module, step).pairs);
    };
    compute();
    const a = useBench.subscribe(compute);
    const b = useUi.subscribe(compute);
    return () => {
      a();
      b();
    };
  }, []);
  return pairs;
}

function Ring({ id, phase }: { id: string; phase: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const arrow = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.0, 0.5), transparent: true, opacity: 0.9, depthTest: false }),
    [],
  );
  const arrowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.0, 0.5), depthTest: false, transparent: true, opacity: 0.95 }), []);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    // a lead id (osc.ch1 ...) points at the instrument lead tip -> no ring
    const p = anchorWorld(id);
    if (!p) {
      m.visible = false;
      return;
    }
    m.visible = true;
    const n = anchorNormal(id);
    m.position.copy(p).addScaledVector(n, 0.003);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    const k = (clock.elapsedTime * 1.4 + phase) % 1;
    m.scale.setScalar(1 + k * 1.8);
    mat.opacity = 0.95 * (1 - k);
    // bobbing arrow pointing into the socket
    const a = arrow.current;
    if (a) {
      a.visible = true;
      a.position.copy(p).addScaledVector(n, 0.028 + 0.008 * Math.sin(clock.elapsedTime * 4 + phase * 6));
      a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().negate());
    }
  });
  return (
    <>
      <mesh ref={ref} material={mat} renderOrder={10}>
        <ringGeometry args={[0.0055, 0.0078, 36]} />
      </mesh>
      <mesh ref={arrow} material={arrowMat} renderOrder={10} visible={false}>
        <coneGeometry args={[0.0045, 0.012, 16]} />
      </mesh>
    </>
  );
}

function GhostCord({ a, b }: { a: string; b: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#ffcf3a", transparent: true, opacity: 0.45, depthTest: false, toneMapped: false }),
    [],
  );
  const last = useRef("");
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const pa = anchorWorld(a),
      pb = anchorWorld(b);
    if (!pa || !pb) {
      m.visible = false;
      return;
    }
    m.visible = true;
    mat.opacity = 0.3 + 0.2 * Math.sin(clock.elapsedTime * 4);
    const key = [...pa.toArray(), ...pb.toArray()].map((x) => x.toFixed(4)).join();
    if (key === last.current) return;
    last.current = key;
    const g = new THREE.TubeGeometry(cableCurve(pa, anchorNormal(a), pb, anchorNormal(b), 0.03, 0.12), 60, 0.0009, 6, false);
    m.geometry.dispose();
    m.geometry = g;
  });
  return <mesh ref={ref} material={mat} renderOrder={9} />;
}

export function Guide() {
  const pairs = useMissingPairs();
  if (!pairs.length) return null;
  const [a, b] = pairs[0];
  const isLead = (id: string) => !id.includes(":");
  return (
    <group>
      {!isLead(a) && <Ring id={a} phase={0} />}
      {!isLead(b) && <Ring id={b} phase={0.5} />}
      {!isLead(a) && !isLead(b) && <GhostCord a={a} b={b} />}
    </group>
  );
}

/* ---------------------------------------------------------------- */
/* Insight ("X-ray"): live potentials on every connected socket       */
/* ---------------------------------------------------------------- */
/** voltage tag drawn into a canvas sprite (always faces the camera, no DOM) */
function VoltLabel({ jack }: { jack: string }) {
  const spr = useRef<THREE.Sprite>(null);
  const version = useSim((s) => s.version);
  const { tex, ctx, mat } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    // brighter than 1.0 so the tag survives the filmic tone mapping of the composer
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, color: new THREE.Color(2.4, 2.4, 2.4) });
    return { tex, ctx: c.getContext("2d")!, mat };
  }, []);
  useEffect(() => {
    const v = jackVoltage(jack);
    let txt = "float",
      col = "#9aa4b2";
    if (v) {
      const pp = v.max - v.min;
      txt = pp > 0.05 ? `${fmtVolt(v.mean)} ~${fmtVolt(pp)}` : fmtVolt(v.mean);
      col = v.mean > 0.05 ? "#ff9a80" : v.mean < -0.05 ? "#8fbcff" : "#eef2f7";
    }
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = "rgba(6,8,11,0.94)";
    ctx.beginPath();
    ctx.roundRect(6, 14, 500, 100, 24);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = "700 54px ui-monospace, Menlo, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(txt, 256, 66);
    tex.needsUpdate = true;
  }, [jack, version, ctx, tex]);
  useFrame(() => {
    const p = anchorWorld(jack);
    if (p && spr.current) spr.current.position.copy(p).addScaledVector(anchorNormal(jack), 0.026);
  });
  return <sprite ref={spr} material={mat} scale={[0.044, 0.011, 1]} renderOrder={20} />;
}

export function Insight() {
  const on = useUi((s) => s.insight);
  const wires = useBench((s) => s.wires);
  const leads = useBench((s) => s.leads);
  const jacks = useMemo(() => {
    const set = new Set<string>();
    for (const w of wires) {
      set.add(w.a);
      set.add(w.b);
    }
    for (const j of Object.values(leads)) if (j) set.add(j);
    return [...set].slice(0, 48);
  }, [wires, leads]);
  if (!on) return null;
  return (
    <group>
      {jacks.map((j) => (
        <VoltLabel key={j} jack={j} />
      ))}
    </group>
  );
}
