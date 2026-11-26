"use client";
import * as THREE from "three";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useBench } from "@/store/bench";
import { useSim } from "@/lab/simController";
import { SCREEN_H, SCREEN_W } from "@/scope/renderScope";
import { drawScopeTo, screenTouch, useScopeUi } from "@/scope/scopeState";
import { MAT } from "./materials";
import { canvas, toTexture } from "./draw/textures";
import { registerAnchor, unregisterAnchor, useUi } from "./registry";
import { useDeviceDrag } from "./useDeviceDrag";

const DEV = { w: 0.184, h: 0.116, d: 0.022 };
/** lean of the tablet from vertical (it rests on its kickstand) */
export const SCOPE_TILT = 0.95;

function bezelTexture() {
  const c = canvas(1024, 660);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#050607";
  ctx.fillRect(0, 0, 1024, 660);
  ctx.fillStyle = "#f2f2f2";
  ctx.font = "bold 46px 'Arial Black', Arial";
  ctx.textBaseline = "middle";
  ctx.fillText("FNIRSI", 70, 615);
  ctx.font = "30px Arial";
  ctx.fillText("oscilloscope", 268, 618);
  ctx.font = "18px Arial";
  ctx.fillStyle = "#bbb";
  ctx.fillText("100MHz", 905, 598);
  ctx.fillText("1 GSa/s", 905, 622);
  return toTexture(c);
}

export function Oscilloscope() {
  const pose = useBench((s) => s.devices.osc);
  const grp = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const drag = useDeviceDrag("osc", grp);
  const { tex, ctx } = useMemo(() => {
    const c = canvas(SCREEN_W, SCREEN_H);
    return { tex: toTexture(c, { aniso: 8 }), ctx: c.getContext("2d")! };
  }, []);
  const bezel = useMemo(() => bezelTexture(), []);
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
  // probe BNC anchors
  useLayoutEffect(() => {
    const g = tilt.current;
    if (!g) return;
    registerAnchor("osc.ch1.src", g, new THREE.Vector3(-0.058, DEV.h + 0.026, 0));
    registerAnchor("osc.ch2.src", g, new THREE.Vector3(-0.024, DEV.h + 0.026, 0));
    registerAnchor("osc.usb", g, new THREE.Vector3(0.045, DEV.h + 0.012, 0));
    return () => {
      unregisterAnchor("osc.ch1.src");
      unregisterAnchor("osc.ch2.src");
      unregisterAnchor("osc.usb");
    };
  }, []);
  void useScopeUi;

  return (
    <group ref={grp} position={[pose.x, 0.762, pose.z]} rotation={[0, pose.rot, 0]} {...drag}>
      <group ref={tilt} rotation={[-SCOPE_TILT, 0, 0]} position={[0, 0, 0.03]}>
        <RoundedBox args={[DEV.w, DEV.h, DEV.d]} radius={0.009} smoothness={5} position={[0, DEV.h / 2, 0]} material={MAT.whiteAbs()} castShadow receiveShadow />
        {/* front black glass with printed bezel */}
        <mesh position={[0, DEV.h / 2, DEV.d / 2 + 0.0003]}>
          <planeGeometry args={[DEV.w - 0.009, DEV.h - 0.009]} />
          <meshPhysicalMaterial map={bezel} roughness={0.08} clearcoat={1} clearcoatRoughness={0.04} />
        </mesh>
        {/* LCD */}
        <mesh
          position={[-0.0035, DEV.h / 2 + 0.0055, DEV.d / 2 + 0.0006]}
          onClick={(e) => {
            e.stopPropagation();
            if (!e.uv) return;
            const px = e.uv.x * SCREEN_W,
              py = (1 - e.uv.y) * SCREEN_H;
            if (!screenTouch(px, py)) useBench.getState().setPanel("scope");
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            useUi.getState().setHover({ id: "osc.screen", label: "FNIRSI" });
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            useUi.getState().setHover(null);
            document.body.style.cursor = "auto";
          }}
        >
          <planeGeometry args={[0.154, 0.0902]} />
          <primitive object={lcdMat} attach="material" />
        </mesh>
        {/* glass reflection layer */}
        <mesh position={[0, DEV.h / 2, DEV.d / 2 + 0.001]} material={MAT.glass()}>
          <planeGeometry args={[DEV.w - 0.009, DEV.h - 0.009]} />
        </mesh>
        {/* BNC connectors + probe boots */}
        {[-0.058, -0.024].map((x, i) => (
          <group key={i} position={[x, DEV.h, 0]}>
            <mesh position={[0, 0.004, 0]} material={MAT.chrome()}>
              <cylinderGeometry args={[0.0055, 0.0055, 0.008, 20]} />
            </mesh>
            <mesh position={[0, 0.012, 0]} material={MAT.chrome()}>
              <cylinderGeometry args={[0.0062, 0.0062, 0.006, 6]} />
            </mesh>
            <mesh position={[0, 0.021, 0]}>
              <cylinderGeometry args={[0.0035, 0.0058, 0.014, 16]} />
              <meshStandardMaterial color="#8b8f93" roughness={0.55} />
            </mesh>
            <mesh position={[0, 0.03, 0]}>
              <cylinderGeometry args={[0.0028, 0.0034, 0.006, 12]} />
              <meshStandardMaterial color={i === 0 ? "#e9d21e" : "#1fb6e0"} roughness={0.5} />
            </mesh>
          </group>
        ))}
        {/* USB-C power lead (white) */}
        <mesh position={[0.045, DEV.h + 0.006, 0]} material={MAT.whiteAbs()}>
          <boxGeometry args={[0.01, 0.012, 0.006]} />
        </mesh>
        {/* power button */}
        <mesh position={[0.07, DEV.h + 0.0015, 0]} material={MAT.darkGrey()}>
          <boxGeometry args={[0.012, 0.003, 0.004]} />
        </mesh>
        {/* kickstand */}
        <mesh position={[0, 0.05, -DEV.d / 2 - 0.022]} rotation={[0.72, 0, 0]} material={MAT.whiteAbs()} castShadow>
          <boxGeometry args={[0.12, 0.09, 0.003]} />
        </mesh>
      </group>
    </group>
  );
}
