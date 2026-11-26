"use client";
import * as THREE from "three";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useBench, type DmmMode } from "@/store/bench";
import { useSim, formatDmm } from "@/lab/simController";
import { sfx } from "@/audio/audio";
import { MAT, plastic } from "./materials";
import { canvas, draw7seg, toTexture } from "./draw/textures";
import { registerAnchor, unregisterAnchor, useUi } from "./registry";
import { useDeviceDrag } from "./useDeviceDrag";

export const DMM_MODES: DmmMode[] = ["off", "dcv", "acv", "ohm", "diode", "dca", "aca"];
const MODE_LABEL: Record<DmmMode, string> = { off: "OFF", dcv: "V⎓", acv: "V~", ohm: "Ω", diode: "▶|•))", dca: "mA⎓", aca: "mA~" };
const DIAL_ANG = (i: number) => -2.4 + i * 0.8; // radians, 0 = toward display

function faceTexture() {
  const c = canvas(512, 1024);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#26282c";
  ctx.fillRect(0, 0, 512, 1024);
  ctx.fillStyle = "#3a3d42";
  ctx.fillRect(40, 40, 432, 270);
  ctx.fillStyle = "#e8e8e8";
  ctx.font = "bold 30px Arial";
  ctx.textAlign = "center";
  ctx.fillText("DIGITAL MULTIMETER", 256, 345);
  ctx.fillStyle = "#ffd200";
  ctx.font = "bold italic 34px Arial";
  ctx.fillText("Pro'sKit", 150, 410);
  ctx.fillStyle = "#e8e8e8";
  ctx.font = "bold 26px Arial";
  ctx.fillText("MT-1232", 360, 410);
  ctx.font = "22px Arial";
  ctx.fillText("AUTO RANGE · TRUE RMS · 4000 COUNTS", 256, 378);
  // dial legends
  const cx = 256,
    cy = 600;
  DMM_MODES.forEach((m, i) => {
    const a = DIAL_ANG(i) - Math.PI / 2;
    ctx.fillStyle = m === "off" ? "#ff5a4a" : "#ffffff";
    ctx.font = "bold 30px Arial";
    ctx.textBaseline = "middle";
    ctx.fillText(MODE_LABEL[m], cx + Math.cos(a) * 170, cy + Math.sin(a) * 170);
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 128, cy + Math.sin(a) * 128);
    ctx.lineTo(cx + Math.cos(a) * 140, cy + Math.sin(a) * 140);
    ctx.stroke();
  });
  // jack legends
  ctx.font = "bold 24px Arial";
  ctx.fillStyle = "#fff";
  ctx.fillText("10A", 110, 975);
  ctx.fillText("COM", 256, 975);
  ctx.fillStyle = "#ff5a4a";
  ctx.fillText("VΩmA", 402, 975);
  ctx.fillStyle = "#ffd200";
  ctx.font = "18px Arial";
  ctx.fillText("CAT III 600V", 256, 1006);
  return toTexture(c);
}

export function Multimeter() {
  const pose = useBench((s) => s.devices.dmm);
  const mode = useBench((s) => s.dmmMode);
  const grp = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const drag = useDeviceDrag("dmm", grp);
  const face = useMemo(() => faceTexture(), []);
  const { lcd, ctx, c } = useMemo(() => {
    const c = canvas(400, 220);
    return { lcd: toTexture(c), ctx: c.getContext("2d")!, c };
  }, []);
  const last = useRef("");
  // a real DMM samples ~3 times per second and the last digit flickers
  const disp = useRef({ t: 0, text: "", unit: "", hold: false, light: false });
  const [hold, setHold] = useState(false);
  const [light, setLight] = useState(false);
  disp.current.hold = hold;
  disp.current.light = light;
  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    const D = disp.current;
    const m = useBench.getState().dmmMode;
    if (now - D.t > 0.33 && !D.hold) {
      D.t = now;
      const r = useSim.getState().readings.dmm;
      let v = r.value;
      if (v !== null && m !== "off") {
        // input noise / quantisation: about ±1 count
        const f0 = formatDmm(m, v);
        const dec = (f0.text.split(".")[1] ?? "").length;
        const lsd = Math.pow(10, -dec) * (f0.unit === "mV" ? 1e-3 : f0.unit === "kΩ" ? 1e3 : f0.unit === "MΩ" ? 1e6 : 1);
        v = v + (Math.random() - 0.5) * 1.6 * lsd;
      }
      const f = formatDmm(m, v);
      D.text = f.text;
      D.unit = f.unit;
    }
    const key = `${m}|${D.text}|${D.unit}|${D.hold}|${D.light}`;
    if (key === last.current) return;
    last.current = key;
    ctx.fillStyle = D.light ? "#8fd7a4" : "#9ba98f";
    ctx.fillRect(0, 0, c.width, c.height);
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0.08)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    if (m !== "off") {
      draw7seg(ctx, D.text === "OL" ? " OL" : D.text.replace("-", "-"), 46, 46, 120, "#15170f", "rgba(0,0,0,0.05)", 4);
      ctx.fillStyle = "#15170f";
      ctx.font = "bold 30px Arial";
      ctx.textAlign = "right";
      ctx.fillText(D.unit, 388, 196);
      ctx.textAlign = "left";
      ctx.font = "bold 20px Arial";
      ctx.fillText(m === "acv" || m === "aca" ? "AC" : m === "ohm" || m === "diode" ? "" : "DC", 14, 30);
      ctx.fillText("AUTO", 70, 30);
      if (m === "diode") ctx.fillText("▶|  •))", 150, 30);
      if (D.hold) ctx.fillText("H", 360, 30);
      // battery & bar-graph segment row
      ctx.fillRect(14, 190, 8, 2);
    }
    lcd.needsUpdate = true;
    lcdMat.emissiveIntensity = D.light ? 0.9 : 0.2;
  });
  const lcdMat = useMemo(() => new THREE.MeshStandardMaterial({ map: lcd, roughness: 0.3, emissiveMap: lcd, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.2 }), [lcd]);
  useLayoutEffect(() => {
    const g = body.current;
    if (!g) return;
    registerAnchor("dmm.com.src", g, new THREE.Vector3(0, 0.026, 0.058));
    registerAnchor("dmm.v.src", g, new THREE.Vector3(0.022, 0.026, 0.058));
    return () => {
      unregisterAnchor("dmm.com.src");
      unregisterAnchor("dmm.v.src");
    };
  }, []);
  const idx = DMM_MODES.indexOf(mode);
  const step = (d: number) => {
    const i = (DMM_MODES.indexOf(useBench.getState().dmmMode) + d + DMM_MODES.length) % DMM_MODES.length;
    useBench.getState().setDmmMode(DMM_MODES[i]);
  };
  return (
    <group ref={grp} position={[pose.x, 0.762, pose.z]} rotation={[0, pose.rot, 0]} {...drag}>
      {/* tilt stand: display end slightly raised */}
      <group ref={body} rotation={[0.16, 0, 0]} position={[0, 0.012, 0]}>
        <RoundedBox args={[0.084, 0.034, 0.162]} radius={0.012} smoothness={4} material={MAT.rubberGreen()} castShadow receiveShadow />
        <RoundedBox args={[0.07, 0.03, 0.146]} radius={0.006} smoothness={3} position={[0, 0.004, 0]} material={MAT.darkGrey()} />
        <mesh position={[0, 0.0192, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.066, 0.142]} />
          <meshStandardMaterial map={face} roughness={0.6} />
        </mesh>
        {/* LCD */}
        <mesh position={[0, 0.0196, -0.044]} rotation={[-Math.PI / 2, 0, 0]} material={lcdMat}>
          <planeGeometry args={[0.052, 0.0286]} />
        </mesh>
        {/* function buttons: HOLD and backlight */}
        {[
          { x: -0.02, label: "HOLD", on: hold, act: () => setHold((h) => !h) },
          { x: 0.02, label: "LIGHT", on: light, act: () => setLight((l) => !l) },
        ].map((b) => (
          <group key={b.label} position={[b.x, 0.0195, -0.0215]}>
            <RoundedBox
              args={[0.016, 0.004, 0.0075]}
              radius={0.0015}
              position={[0, b.on ? 0.0008 : 0.0015, 0]}
              material={b.label === "HOLD" ? MAT.blackPlastic() : plastic("#e0b21a")}
              onClick={(e) => {
                e.stopPropagation();
                b.act();
                sfx("button");
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                useUi.getState().setHover({ id: "dmm.btn", label: b.label });
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                useUi.getState().setHover(null);
                document.body.style.cursor = "auto";
              }}
            />
          </group>
        ))}
        <mesh position={[0, 0.0199, -0.044]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.glass()}>
          <planeGeometry args={[0.054, 0.03]} />
        </mesh>
        {/* rotary dial */}
        <group
          position={[0, 0.02, 0.013]}
          onClick={(e) => {
            e.stopPropagation();
            step(1);
          }}
          onContextMenu={(e) => {
            e.stopPropagation();
            e.nativeEvent.preventDefault();
            step(-1);
          }}
          onWheel={(e) => {
            e.stopPropagation();
            step(e.deltaY > 0 ? 1 : -1);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            useUi.getState().setHover({ id: "dmm.dial", label: "DMM" });
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            useUi.getState().setHover(null);
            document.body.style.cursor = "auto";
          }}
        >
          <mesh material={MAT.blackPlastic()} castShadow>
            <cylinderGeometry args={[0.019, 0.02, 0.006, 32]} />
          </mesh>
          <group rotation={[0, -DIAL_ANG(idx), 0]}>
            <mesh position={[0, 0.005, 0]} material={MAT.blackPlastic()}>
              <boxGeometry args={[0.008, 0.007, 0.036]} />
            </mesh>
            <mesh position={[0, 0.0087, -0.013]} material={plastic("white")}>
              <boxGeometry args={[0.0018, 0.0006, 0.008]} />
            </mesh>
          </group>
        </group>
        {/* input jacks */}
        {[
          [-0.022, "red"],
          [0, "black"],
          [0.022, "red"],
        ].map(([x, col], i) => (
          <group key={i} position={[x as number, 0.0195, 0.058]}>
            <mesh material={plastic(col as string)}>
              <cylinderGeometry args={[0.0042, 0.0042, 0.003, 18]} />
            </mesh>
            <mesh position={[0, 0.0016, 0]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.hole()}>
              <circleGeometry args={[0.0021, 14]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
