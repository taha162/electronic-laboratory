"use client";
import * as THREE from "three";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useBench } from "@/store/bench";
import { useSim } from "@/lab/simController";
import { SCREEN_H, SCREEN_W } from "@/scope/renderScope";
import { drawScopeTo, screenTouch } from "@/scope/scopeState";
import { MAT } from "./materials";
import { canvas, toTexture } from "./draw/textures";
import { roundedPlane, roundedSlab } from "./draw/shapes";
import { registerAnchor, unregisterAnchor, useUi } from "./registry";
import { useDeviceDrag } from "./useDeviceDrag";

/**
 * FNIRSI-1013D 7" tablet oscilloscope — 184 x 124 x 25 mm.
 * White front frame with large corner radii, dark rear shell, edge-to-edge black
 * glass with the logo printed under it; BNC inputs on the top edge (left half),
 * USB-C and power key on the top edge (right half), fold-out stand at the back.
 */
const DEV = { w: 0.184, h: 0.124, d: 0.025, r: 0.0125 };
const FRONT_D = 0.0095; // white front frame depth
const GLASS = { w: 0.1792, h: 0.1192, r: 0.0098 };
/** active area 154.2 x 92.6 mm: 12.4 mm side margins, 9 mm top, 17.4 mm bottom */
const LCD = { w: 0.1542, h: 0.0926, dy: 0.0042 };
const BNC_X = [-0.046, -0.019];
/** connectors sit on the top of the rear shell, mid-depth */
const TOP_Y = DEV.h - 0.003;
const TOP_Z = -0.0048;
/** the shell's lower rear edge rests on the bench (lift for the lean) */
const LIFT = 0.0079;
/** lean of the tablet from vertical (it rests on its kickstand) */
export const SCOPE_TILT = 0.95;

const glassZ = DEV.d / 2 + 0.0002;

function bezelTexture() {
  const PX = 1024 / (GLASS.w * 1000); // px per mm
  const c = canvas(1024, Math.round(GLASS.h * 1000 * PX));
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#060709";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.setTransform(PX, 0, 0, PX, 0, 0);
  // inactive LCD border: a hair lighter than the printed black
  ctx.fillStyle = "#0b0c0f";
  ctx.fillRect(11.6, 8.2, 155.8, 94.2);
  ctx.textBaseline = "middle";
  // FNIRSI logo (wide, bold) + "oscilloscope"
  ctx.save();
  ctx.translate(13.2, 110.6);
  ctx.scale(1.18, 1);
  ctx.fillStyle = "#f4f4f4";
  ctx.font = "bold 7.4px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("FNIRSI", 0, 0);
  ctx.restore();
  ctx.fillStyle = "#d9d9d9";
  ctx.font = "4.3px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("oscilloscope", 47.6, 111.2);
  // performance badge (bottom right)
  ctx.textAlign = "right";
  ctx.fillStyle = "#a9abb0";
  ctx.font = "2.5px Arial, sans-serif";
  ctx.fillText("100MHz", 172, 107.4);
  ctx.fillText("1 GSa/s", 172, 111.2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return toTexture(c, { aniso: 8 });
}

/** CH1 / CH2 legends printed on the top edge next to the inputs */
function edgeLabelTexture() {
  const c = canvas(512, 32);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f1f1ef";
  ctx.fillRect(0, 0, 512, 32);
  ctx.fillStyle = "#4d4f55";
  ctx.font = "bold 17px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const u = (x: number) => ((x + DEV.w / 2) / DEV.w) * 512;
  ctx.fillText("CH1", u(BNC_X[0]) + 34, 17);
  ctx.fillText("CH2", u(BNC_X[1]) + 34, 17);
  ctx.fillText("5V ⎓ 2A", u(0.046) - 46, 17);
  return toTexture(c);
}

/** BNC socket on the case + the probe's BNC plug and grey strain-relief boot */
function ProbeBnc({ x, label }: { x: number; label: string }) {
  const ridges = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    // boot profile from the plug up to the cable (radius, height) in metres
    const prof: [number, number][] = [
      [0.0061, 0],
      [0.0061, 0.004],
      [0.0055, 0.006],
      [0.0055, 0.016],
      [0.0047, 0.019],
      [0.0042, 0.03],
      [0.0034, 0.034],
      [0.0025, 0.036],
    ];
    for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(pts, 28);
  }, []);
  const sticker = useMemo(() => {
    const c = canvas(128, 64);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#e9efe6";
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = "#1f7a46";
    ctx.fillRect(0, 0, 128, 18);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("P6100", 64, 14);
    ctx.fillStyle = "#222";
    ctx.font = "bold 22px Arial";
    ctx.fillText(label, 64, 46);
    return toTexture(c);
  }, [label]);
  return (
    <group position={[x, TOP_Y, TOP_Z]}>
      {/* panel nut + socket barrel */}
      <mesh position={[0, 0.0012, 0]} material={MAT.chrome()}>
        <cylinderGeometry args={[0.0062, 0.0062, 0.0024, 6]} />
      </mesh>
      <mesh position={[0, 0.006, 0]} material={MAT.chrome()}>
        <cylinderGeometry args={[0.0047, 0.0047, 0.0075, 22]} />
      </mesh>
      {/* bayonet sleeve of the plug */}
      <mesh position={[0, 0.0102, 0]} material={MAT.chrome()}>
        <cylinderGeometry args={[0.0059, 0.0059, 0.0062, 24]} />
      </mesh>
      <group position={[0, 0.0133, 0]}>
        <mesh geometry={ridges} castShadow>
          <meshStandardMaterial color="#8c9196" roughness={0.62} />
        </mesh>
        {/* grip rings */}
        {[0.007, 0.0095, 0.012, 0.0145].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <torusGeometry args={[0.0056, 0.00045, 6, 24]} />
            <meshStandardMaterial color="#7d8287" roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 0.0235, 0.0046]} rotation={[-0.1, 0, 0]}>
          <planeGeometry args={[0.0075, 0.0085]} />
          <meshStandardMaterial map={sticker} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

export function Oscilloscope() {
  const pose = useBench((s) => s.devices.osc);
  const grp = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const drag = useDeviceDrag("osc", grp);
  // drawn above native resolution for crisp text; lighter on phones/tablets
  const { tex, ctx } = useMemo(() => {
    const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    const q = coarse ? 1.25 : 2;
    const c = canvas(SCREEN_W * q, SCREEN_H * q);
    return { tex: toTexture(c, { aniso: 8 }), ctx: c.getContext("2d")! };
  }, []);
  const bezel = useMemo(() => bezelTexture(), []);
  const edgeTex = useMemo(() => edgeLabelTexture(), []);
  const geo = useMemo(
    () => ({
      front: roundedSlab(DEV.w, DEV.h, DEV.r, FRONT_D, 0.0024),
      shell: roundedSlab(DEV.w - 0.006, DEV.h - 0.006, DEV.r - 0.002, DEV.d - FRONT_D + 0.003, 0.0045),
      glass: roundedPlane(GLASS.w, GLASS.h, GLASS.r),
    }),
    [],
  );
  // IPS panel: unlit backlit pixels, with the RGB sub-pixel structure resolving when you lean in
  const lcdMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ map: tex });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRes = { value: new THREE.Vector2(SCREEN_W, SCREEN_H) };
      sh.fragmentShader =
        "uniform vec2 uRes;\n" +
        sh.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          {
            vec2 px = vMapUv * uRes;
            vec2 fw = fwidth(px);
            float zoom = 1.0 / max(max(fw.x, fw.y), 1e-5);   // screen pixels per LCD pixel
            float k = smoothstep(2.2, 7.0, zoom);
            float sub = fract(px.x) * 3.0;
            vec3 stripe = vec3(1.0 - step(1.0, sub), step(1.0, sub) * (1.0 - step(2.0, sub)), step(2.0, sub));
            float rowGap = smoothstep(0.0, 0.14, fract(px.y)) * smoothstep(1.0, 0.86, fract(px.y));
            vec3 mask = mix(vec3(1.0), stripe * 2.7 * rowGap + 0.04, k);
            diffuseColor.rgb = diffuseColor.rgb * mask * 1.55 + vec3(0.010, 0.012, 0.018);
          }`,
        );
    };
    return m;
  }, [tex]);
  const lastDraw = useRef(0);
  const lastVer = useRef(-1);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const ver = useSim.getState().version;
    if (t - lastDraw.current < 1 / 24 && ver === lastVer.current) return;
    lastDraw.current = t;
    lastVer.current = ver;
    drawScopeTo(ctx, t);
    tex.needsUpdate = true;
  });
  // probe cable anchors at the top of the boots
  useLayoutEffect(() => {
    const g = tilt.current;
    if (!g) return;
    registerAnchor("osc.ch1.src", g, new THREE.Vector3(BNC_X[0], TOP_Y + 0.049, TOP_Z));
    registerAnchor("osc.ch2.src", g, new THREE.Vector3(BNC_X[1], TOP_Y + 0.049, TOP_Z));
    registerAnchor("osc.usb", g, new THREE.Vector3(0.046, TOP_Y + 0.012, TOP_Z));
    return () => {
      unregisterAnchor("osc.ch1.src");
      unregisterAnchor("osc.ch2.src");
      unregisterAnchor("osc.usb");
    };
  }, []);

  return (
    <group ref={grp} position={[pose.x, 0.762, pose.z]} rotation={[0, pose.rot, 0]} {...drag}>
      <group ref={tilt} rotation={[-SCOPE_TILT, 0, 0]} position={[0, LIFT, 0.03]}>
        {/* white front frame */}
        <mesh geometry={geo.front} position={[0, DEV.h / 2, DEV.d / 2 - FRONT_D / 2]} material={MAT.whiteAbs()} castShadow receiveShadow />
        {/* dark rear shell (battery housing) */}
        <mesh geometry={geo.shell} position={[0, DEV.h / 2, DEV.d / 2 - FRONT_D - (DEV.d - FRONT_D + 0.003) / 2 + 0.0015]} castShadow receiveShadow>
          <meshPhysicalMaterial color="#2b2d31" roughness={0.58} clearcoat={0.15} />
        </mesh>
        {/* CH1 / CH2 legends on the top edge */}
        <mesh position={[0, DEV.h + 0.00005, DEV.d / 2 - FRONT_D / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[DEV.w - 0.03, 0.0044]} />
          <meshStandardMaterial map={edgeTex} roughness={0.4} transparent opacity={0.95} />
        </mesh>
        {/* front black glass with the printed logo */}
        <mesh geometry={geo.glass} position={[0, DEV.h / 2, glassZ]}>
          <meshPhysicalMaterial map={bezel} roughness={0.05} clearcoat={0.6} clearcoatRoughness={0.02} envMapIntensity={0.55} />
        </mesh>
        {/* LCD */}
        <mesh
          position={[0, DEV.h / 2 + LCD.dy, glassZ + 0.0003]}
          onClick={(e) => {
            e.stopPropagation();
            if (!e.uv) return;
            const px = e.uv.x * SCREEN_W,
              py = (1 - e.uv.y) * SCREEN_H;
            if (!screenTouch(px, py)) useBench.getState().setPanel("scope");
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            useUi.getState().setHover({ id: "osc.screen", label: "FNIRSI-1013D" });
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            useUi.getState().setHover(null);
            document.body.style.cursor = "auto";
          }}
        >
          <planeGeometry args={[LCD.w, LCD.h]} />
          <primitive object={lcdMat} attach="material" />
        </mesh>
        {/* cover-glass reflection over the LCD (the printed glass carries its own) */}
        <mesh position={[0, DEV.h / 2 + LCD.dy, glassZ + 0.0007]}>
          <planeGeometry args={[LCD.w + 0.002, LCD.h + 0.002]} />
          {/* black base + additive blending: only the glass reflection is added over the backlit pixels */}
          <meshPhysicalMaterial color="#000" transparent blending={THREE.AdditiveBlending} roughness={0.04} clearcoat={0.6} clearcoatRoughness={0.02} envMapIntensity={0.55} depthWrite={false} />
        </mesh>
        {/* BNC inputs with the probes plugged in */}
        <ProbeBnc x={BNC_X[0]} label="CH1" />
        <ProbeBnc x={BNC_X[1]} label="CH2" />
        {/* USB-C charging lead (white) */}
        <group position={[0.046, TOP_Y, TOP_Z]}>
          <mesh position={[0, 0.0006, 0]} material={MAT.hole()}>
            <boxGeometry args={[0.009, 0.0012, 0.0034]} />
          </mesh>
          <mesh position={[0, 0.0072, 0]} material={MAT.whiteAbs()} castShadow>
            <boxGeometry args={[0.0105, 0.0125, 0.0058]} />
          </mesh>
          <mesh position={[0, 0.0158, 0]} material={MAT.whiteAbs()}>
            <cylinderGeometry args={[0.0019, 0.0026, 0.005, 12]} />
          </mesh>
        </group>
        {/* power key */}
        <mesh position={[0.07, TOP_Y + 0.0009, TOP_Z]} material={MAT.darkGrey()}>
          <boxGeometry args={[0.011, 0.0018, 0.0042]} />
        </mesh>
        {/* fold-out stand: hinged on the back, its foot just reaches the bench */}
        <group position={[0, 0.075, -0.014]} rotation={[0.31, 0, 0]}>
          <mesh position={[0, -0.025, -0.0015]} castShadow>
            <boxGeometry args={[0.112, 0.05, 0.003]} />
            <meshPhysicalMaterial color="#2b2d31" roughness={0.6} clearcoat={0.1} />
          </mesh>
          <mesh position={[0, 0, -0.0015]} rotation={[0, 0, Math.PI / 2]} material={MAT.darkGrey()}>
            <cylinderGeometry args={[0.0028, 0.0028, 0.116, 12]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
