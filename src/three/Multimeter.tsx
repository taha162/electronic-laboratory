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
import { ringGeometry, roundedSlab } from "./draw/shapes";
import { registerAnchor, unregisterAnchor, useUi } from "./registry";
import { useDeviceDrag } from "./useDeviceDrag";

/**
 * Pro'sKit MT-1232 3¾-digit auto-ranging multimeter in its teal holster —
 * 74 x 145 x 36 mm. Black face: logo and model at the top, large 4000-count
 * LCD, SELECT / HOLD / backlight keys, rotary selector, 10A · COM · VΩmA inputs.
 * Lying on the bench, display end away from the student (local -z).
 */
export const DMM_MODES: DmmMode[] = ["off", "dcv", "acv", "ohm", "diode", "dca", "aca"];
const DIAL_ANG = (i: number) => -2.4 + i * 0.8; // radians, 0 = toward display
/** SELECT toggles the second function printed on a dial position */
const SELECT_PAIR: Partial<Record<DmmMode, DmmMode>> = { dcv: "acv", acv: "dcv", dca: "aca", aca: "dca", ohm: "diode", diode: "ohm" };

const BODY = { w: 0.074, l: 0.145, h: 0.036 };
const FACE = { w: 0.0635, l: 0.134 }; // black face plate inside the holster lip
const TOP = BODY.h / 2; // holster top (local y)
const FACE_Y = TOP + 0.0004;
/** face coordinates (mm from the face's top-left) -> local x, z */
const fx = (u: number) => u / 1000 - FACE.w / 2;
const fz = (v: number) => v / 1000 - FACE.l / 2;
const LCD_WIN = { u: 4, v: 10.6, w: 55.5, h: 35 };
const DIAL = { u: 31.75, v: 89, r: 16.5 };
const JACK_V = 123;
const JACK_U = [10.75, 31.75, 52.75];
const KEY_V = 51.6;
const KEY_U = [12.5, 31.75, 51];
/** tilt stand raises the display end; the jack-end edge rests on the bench */
const TILT = 0.16;
const LIFT = 0.0289;

function faceTexture() {
  const PX = 10; // px per mm
  const c = canvas(FACE.w * 1000 * PX, FACE.l * 1000 * PX);
  const ctx = c.getContext("2d")!;
  ctx.setTransform(PX, 0, 0, PX, 0, 0);
  ctx.fillStyle = "#151619";
  ctx.fillRect(0, 0, 63.5, 134);
  // faint moulding texture
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`;
    ctx.fillRect(Math.random() * 63.5, Math.random() * 134, 0.25, 0.25);
  }
  ctx.textBaseline = "middle";
  // logo + model
  ctx.save();
  ctx.translate(4.6, 6.4);
  ctx.transform(1, 0, -0.18, 1, 0, 0);
  ctx.fillStyle = "#f3f3f3";
  ctx.font = "bold 5.6px Arial, Helvetica, sans-serif";
  ctx.fillText("Pro'sKit", 0, 0);
  ctx.restore();
  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 0.28;
  ctx.beginPath();
  ctx.roundRect(42.4, 3.9, 17.2, 5.2, 0.8);
  ctx.stroke();
  ctx.fillStyle = "#f3f3f3";
  ctx.font = "bold 3.5px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("MT-1232", 51, 6.6);
  // LCD window surround
  ctx.fillStyle = "#2b2d32";
  ctx.beginPath();
  ctx.roundRect(LCD_WIN.u - 0.9, LCD_WIN.v - 0.9, LCD_WIN.w + 1.8, LCD_WIN.h + 1.8, 2.4);
  ctx.fill();
  // key legends
  ctx.fillStyle = "#e9e9e9";
  ctx.font = "bold 2.6px Arial, sans-serif";
  ctx.fillText("SELECT", KEY_U[0], KEY_V + 6.3);
  ctx.fillText("HOLD", KEY_U[1], KEY_V + 6.3);
  ctx.fillText("☀", KEY_U[2], KEY_V + 6.4);
  // selector ring and legends
  ctx.strokeStyle = "#5d6068";
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.arc(DIAL.u, DIAL.v, DIAL.r + 1.6, 0, Math.PI * 2);
  ctx.stroke();
  const legend: Record<DmmMode, [string, string?]> = {
    off: ["OFF"],
    dcv: ["V", "⎓"],
    acv: ["V", "~"],
    ohm: ["Ω", "•))"],
    diode: ["▶|", "•))"],
    dca: ["mA", "⎓"],
    aca: ["mA", "~"],
  };
  DMM_MODES.forEach((m, i) => {
    const a = DIAL_ANG(i) - Math.PI / 2;
    const r1 = DIAL.r + 2.4,
      r2 = DIAL.r + 3.8;
    ctx.strokeStyle = "#e6e6e6";
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(DIAL.u + Math.cos(a) * r1, DIAL.v + Math.sin(a) * r1);
    ctx.lineTo(DIAL.u + Math.cos(a) * r2, DIAL.v + Math.sin(a) * r2);
    ctx.stroke();
    const [main, sub] = legend[m];
    const R = DIAL.r + 7.5;
    const x = DIAL.u + Math.cos(a) * R,
      y = DIAL.v + Math.sin(a) * R;
    ctx.fillStyle = "#f3f3f3";
    ctx.font = `bold ${m === "off" ? 2.9 : 3.6}px Arial, sans-serif`;
    ctx.fillText(main, x, sub ? y - 1.2 : y);
    if (sub) {
      ctx.fillStyle = m === "dcv" || m === "dca" ? "#f3f3f3" : "#f2c230";
      ctx.font = "bold 2.6px Arial, sans-serif";
      ctx.fillText(sub, x, y + 2.1);
    }
  });
  // input jacks: printed rings and legends
  const jl: [string, string][] = [
    ["10A", "#f3f3f3"],
    ["COM", "#f3f3f3"],
    ["VΩmA", "#f3f3f3"],
  ];
  JACK_U.forEach((u, i) => {
    ctx.fillStyle = jl[i][1];
    ctx.font = "bold 2.9px Arial, sans-serif";
    ctx.fillText(jl[i][0], u, JACK_V - 7.4);
    ctx.strokeStyle = i === 1 ? "#9a9da3" : "#d23a2c";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(u, JACK_V, 5.6, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.font = "1.9px Arial, sans-serif";
  ctx.fillStyle = "#c8c8c8";
  ctx.fillText("10A MAX", JACK_U[0], JACK_V + 7.6);
  ctx.fillText("FUSED", JACK_U[0], JACK_V + 9.8);
  ctx.fillText("600V MAX", JACK_U[2], JACK_V + 7.6);
  ctx.fillText("CAT III 600V", JACK_U[1], JACK_V + 8.7);
  ctx.fillStyle = "#f2c230";
  ctx.beginPath();
  const tx = JACK_U[1] - 10.4,
    ty = JACK_V + 8.6;
  ctx.moveTo(tx, ty - 1.4);
  ctx.lineTo(tx + 1.5, ty + 1.2);
  ctx.lineTo(tx - 1.5, ty + 1.2);
  ctx.closePath();
  ctx.fill();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return toTexture(c, { aniso: 8 });
}

/** big-digit LCD: annunciator row, four tall narrow digits, unit at the bottom right */
function drawLcd(ctx: CanvasRenderingContext2D, W: number, H: number, m: DmmMode, text: string, unit: string, hold: boolean, light: boolean) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  if (light) {
    bg.addColorStop(0, "#d4eef3");
    bg.addColorStop(1, "#b5dde6");
  } else {
    bg.addColorStop(0, "#a9ae9f");
    bg.addColorStop(1, "#979c8e");
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  if (m === "off") return;
  const ink = "#0b0c07";
  const ghost = "rgba(0,0,0,0.03)";
  ctx.fillStyle = ink;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = "bold 22px Arial, sans-serif";
  ctx.fillText("AUTO", 14, 22);
  const kind = m === "acv" || m === "aca" ? "AC" : m === "dcv" || m === "dca" ? "DC" : "";
  if (kind) ctx.fillText(kind, 92, 22);
  if (m === "diode") ctx.fillText("▶|", 140, 22);
  if (m === "diode" || m === "ohm") ctx.fillText("•))", m === "diode" ? 186 : 140, 22);
  if (hold) {
    ctx.fillRect(330, 10, 30, 25);
    ctx.fillStyle = light ? "#d4eef3" : "#a3a899";
    ctx.fillText("H", 337, 23);
    ctx.fillStyle = ink;
  }
  // battery
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(460, 12, 40, 19);
  ctx.fillRect(500, 17, 5, 9);
  ctx.fillRect(464, 16, 26, 11);
  const disp = text === "OL" ? " OL" : text;
  draw7seg(ctx, disp, 40, 44, 214, ink, ghost, 4, { w: 0.43, t: 0.088, gap: 0.135, skew: 0.06 });
  ctx.fillStyle = ink;
  ctx.textAlign = "right";
  ctx.font = "bold 46px Arial, sans-serif";
  ctx.fillText(unit, W - 14, H - 32);
}

export function Multimeter() {
  const pose = useBench((s) => s.devices.dmm);
  const mode = useBench((s) => s.dmmMode);
  const grp = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const drag = useDeviceDrag("dmm", grp);
  const face = useMemo(() => faceTexture(), []);
  const geo = useMemo(
    () => ({
      holster: roundedSlab(BODY.w, BODY.l, 0.012, BODY.h, 0.003).rotateX(-Math.PI / 2),
      // soft raised lip on the flat top, around the recessed face
      lip: ringGeometry(BODY.w - 0.006, BODY.l - 0.006, FACE.w, FACE.l, 0.009, 0.0065, 0.0016, 0.0007),
    }),
    [],
  );
  const { lcd, ctx, c } = useMemo(() => {
    const c = canvas(520, 320);
    return { lcd: toTexture(c, { aniso: 4 }), ctx: c.getContext("2d")!, c };
  }, []);
  const last = useRef("");
  // a real DMM samples ~3 times per second and the last digit flickers
  const disp = useRef({ t: 0, text: "", unit: "", hold: false, light: false });
  const [hold, setHold] = useState(false);
  const [light, setLight] = useState(false);
  disp.current.hold = hold;
  disp.current.light = light;
  // matte polariser: little environment reflection so the segments stay black
  const lcdMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: lcd, roughness: 0.7, envMapIntensity: 0.35, emissiveMap: lcd, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.05 }),
    [lcd],
  );
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
    drawLcd(ctx, c.width, c.height, m, D.text, D.unit, D.hold, D.light && m !== "off");
    lcd.needsUpdate = true;
    lcdMat.emissiveIntensity = D.light && m !== "off" ? 0.95 : 0.05;
  });
  useLayoutEffect(() => {
    const g = body.current;
    if (!g) return;
    registerAnchor("dmm.com.src", g, new THREE.Vector3(fx(JACK_U[1]), FACE_Y + 0.0062, fz(JACK_V)));
    registerAnchor("dmm.v.src", g, new THREE.Vector3(fx(JACK_U[2]), FACE_Y + 0.0062, fz(JACK_V)));
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
  const keys = [
    {
      label: "SELECT",
      on: false,
      mat: plastic("#e8b81a"),
      act: () => {
        const m = useBench.getState().dmmMode;
        const n = SELECT_PAIR[m];
        if (n) useBench.getState().setDmmMode(n);
      },
    },
    { label: "HOLD", on: hold, mat: MAT.darkGrey(), act: () => setHold((h) => !h) },
    { label: "☀ LIGHT", on: light, mat: MAT.darkGrey(), act: () => setLight((l) => !l) },
  ];
  return (
    <group ref={grp} position={[pose.x, 0.762, pose.z]} rotation={[0, pose.rot, 0]} {...drag}>
      {/* tilt stand: display end slightly raised */}
      <group ref={body} rotation={[TILT, 0, 0]} position={[0, LIFT, 0]}>
        {/* teal holster with its raised lip */}
        <mesh geometry={geo.holster} material={MAT.rubberTeal()} castShadow receiveShadow />
        <mesh geometry={geo.lip} position={[0, TOP - 0.0002, 0]} material={MAT.rubberTeal()} castShadow />
        {/* black face */}
        <mesh position={[0, FACE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[FACE.w, FACE.l]} />
          <meshStandardMaterial map={face} roughness={0.55} />
        </mesh>
        {/* LCD + window */}
        <mesh position={[fx(LCD_WIN.u + LCD_WIN.w / 2), FACE_Y + 0.0002, fz(LCD_WIN.v + LCD_WIN.h / 2)]} rotation={[-Math.PI / 2, 0, 0]} material={lcdMat}>
          <planeGeometry args={[0.052, 0.031]} />
        </mesh>
        <mesh position={[fx(LCD_WIN.u + LCD_WIN.w / 2), FACE_Y + 0.0009, fz(LCD_WIN.v + LCD_WIN.h / 2)]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.glass()}>
          <planeGeometry args={[0.0555, 0.035]} />
        </mesh>
        {/* function keys */}
        {keys.map((b, i) => (
          <group key={b.label} position={[fx(KEY_U[i]), FACE_Y, fz(KEY_V)]}>
            <RoundedBox
              args={[0.0148, 0.0036, 0.0072]}
              radius={0.0014}
              position={[0, b.on ? 0.0008 : 0.0014, 0]}
              material={b.mat}
              castShadow
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
        {/* rotary selector */}
        <group
          position={[fx(DIAL.u), FACE_Y, fz(DIAL.v)]}
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
            useUi.getState().setHover({ id: "dmm.dial", label: "MT-1232" });
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            useUi.getState().setHover(null);
            document.body.style.cursor = "auto";
          }}
        >
          <mesh position={[0, 0.0022, 0]} material={MAT.blackPlastic()} castShadow>
            <cylinderGeometry args={[DIAL.r / 1000, DIAL.r / 1000 + 0.0004, 0.0044, 40]} />
          </mesh>
          <group rotation={[0, -DIAL_ANG(idx), 0]}>
            {/* grip bar across the knob with a white pointer at the display end */}
            <RoundedBox args={[0.0085, 0.0062, 0.031]} radius={0.002} position={[0, 0.0062, 0]} material={MAT.blackPlastic()} castShadow />
            <mesh position={[0, 0.0094, -0.0112]} material={plastic("white")}>
              <boxGeometry args={[0.0016, 0.0004, 0.0068]} />
            </mesh>
          </group>
        </group>
        {/* input jacks */}
        {JACK_U.map((u, i) => (
          <group key={u} position={[fx(u), FACE_Y, fz(JACK_V)]}>
            <mesh position={[0, 0.0011, 0]} material={i === 1 ? MAT.blackPlastic() : plastic("#c41f17")}>
              <cylinderGeometry args={[0.0046, 0.0049, 0.0022, 24]} />
            </mesh>
            <mesh position={[0, 0.00225, 0]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.hole()}>
              <circleGeometry args={[0.0021, 18]} />
            </mesh>
          </group>
        ))}
        {/* tilt bail at the back of the holster */}
        <mesh position={[0, -0.027, -0.0383]} rotation={[0.347, 0, 0]} material={MAT.rubberTeal()} castShadow>
          <boxGeometry args={[0.05, 0.0191, 0.003]} />
        </mesh>
      </group>
    </group>
  );
}
