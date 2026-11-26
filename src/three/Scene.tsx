"use client";
import * as THREE from "three";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, N8AO, Bloom, SMAA, ToneMapping, Vignette, Noise, DepthOfField, BrightnessContrast, HueSaturation } from "@react-three/postprocessing";
import { ToneMappingMode, BlendFunction, type DepthOfFieldEffect } from "postprocessing";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { useBench } from "@/store/bench";
import { Room } from "./Room";
import { Trainer } from "./Trainer";
import { Oscilloscope } from "./Oscilloscope";
import { Multimeter } from "./Multimeter";
import { Leads, PointerTracker, Wires, DESK_Y } from "./Cables";
import { CameraRig, camTarget } from "./CameraRig";
import { anchorWorld, useUi } from "./registry";
import { Atmosphere } from "./Atmosphere";
import { Guide, Insight } from "./Overlays3D";
import { PowerCords } from "./PowerCords";

if (typeof window !== "undefined") RectAreaLightUniformsLib.init();

function Lights() {
  const sun = useRef<THREE.DirectionalLight>(null);
  return (
    <>
      <hemisphereLight args={["#f4f7ff", "#b9aa8e", 0.55]} />
      {/* daylight from the window wall (behind the equipment, as in the photographs) */}
      <directionalLight
        ref={sun}
        position={[-0.9, 3.6, -3.4]}
        intensity={1.25}
        color="#fff6ea"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00025}
        shadow-normalBias={0.015}
        shadow-radius={7}
        shadow-blurSamples={18}
        shadow-camera-left={-1.4}
        shadow-camera-right={1.4}
        shadow-camera-top={1.15}
        shadow-camera-bottom={-1.15}
        shadow-camera-near={1.5}
        shadow-camera-far={8}
      >
        <object3D attach="target" position={[0, DESK_Y, 0.05]} />
      </directionalLight>
      {/* the bright, blind-diffused window band as a big soft area light */}
      <rectAreaLight position={[3.1, 1.78, -0.5]} rotation={[0, Math.PI, 0]} width={8.6} height={1.75} intensity={2.4} color="#f3f6ff" />
      {/* fluorescent ceiling fixtures (cool white) */}
      {[
        [0, 0.4],
        [2.4, 0.4],
        [0, 2.6],
        [2.4, 2.6],
        [4.8, 2.6],
      ].map(([x, z], i) => (
        <rectAreaLight key={i} position={[x, 2.94, z]} rotation={[-Math.PI / 2, 0, 0]} width={1.2} height={0.3} intensity={7} color="#f8fbff" />
      ))}
      {/* soft overhead fill so the bench never looks flat-black */}
      <spotLight position={[0.05, 2.9, 0.35]} angle={0.75} penumbra={1} intensity={6} distance={5} decay={2} color="#fffaf2" />
    </>
  );
}

function Env() {
  // reflections: window band, ceiling tubes and pale walls
  return (
    <Environment resolution={256} frames={1} environmentIntensity={0.6}>
      <color attach="background" args={["#d4d0c8"]} />
      <Lightformer form="rect" intensity={2.6} color="#f4f7ff" position={[0, 1.8, -4]} scale={[12, 2.0, 1]} />
      {[-2.4, 0, 2.4].map((x) => (
        <Lightformer key={x} form="rect" intensity={2.2} color="#ffffff" position={[x, 4, 0.5]} rotation-x={Math.PI / 2} scale={[1.2, 0.3, 1]} />
      ))}
      <Lightformer form="rect" intensity={0.7} color="#efe8dc" position={[-4, 1.5, 0]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
      <Lightformer form="rect" intensity={0.55} color="#efe8dc" position={[4, 1.5, 0]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
      <Lightformer form="rect" intensity={0.35} color="#d8cbb4" position={[0, -1, 0]} rotation-x={-Math.PI / 2} scale={[10, 10, 1]} />
    </Environment>
  );
}

function Effects() {
  const quality = useBench((s) => s.quality);
  const photo = useUi((s) => s.photo);
  const dof = useRef<DepthOfFieldEffect>(null);
  // focus on whatever the camera orbits (world units)
  useFrame(({ camera }) => {
    const e = dof.current;
    if (!photo || !e) return;
    const d = camera.position.distanceTo(camTarget);
    e.cocMaterial.focusDistance = d;
    e.cocMaterial.focusRange = Math.max(0.12, d * 0.35);
  });
  if (quality !== "high") return null;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
      <N8AO aoRadius={0.06} distanceFalloff={0.5} intensity={2.4} halfRes quality="medium" color="#2a241c" />
      {photo ? <DepthOfField ref={dof} focusDistance={0.8} focusRange={0.3} bokehScale={3.4} resolutionScale={0.6} /> : <></>}
      <Bloom mipmapBlur intensity={0.5} luminanceThreshold={2.6} luminanceSmoothing={0.4} radius={0.62} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <HueSaturation saturation={0.16} />
      <BrightnessContrast brightness={0.0} contrast={0.1} />
      <Vignette offset={0.32} darkness={0.42} blendFunction={BlendFunction.NORMAL} />
      <Noise opacity={photo ? 0.05 : 0.028} premultiply blendFunction={BlendFunction.SCREEN} />
      <SMAA />
    </EffectComposer>
  );
}

function KeyboardShortcuts() {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      const s = useBench.getState();
      if (e.key === "Escape") {
        if (useUi.getState().photo) useUi.getState().setPhoto(false);
        s.cancel();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && s.selectedWire) s.removeWire(s.selectedWire);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return null;
}

function GlSettings() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const quality = useBench((s) => s.quality);
  useEffect(() => {
    // automation / debugging handle: project jacks to screen
    const w = window as unknown as { __lab?: Record<string, unknown> };
    w.__lab = {
      ...(w.__lab ?? {}),
      project: (id: string) => {
        const p = anchorWorld(id);
        if (!p) return null;
        p.project(camera);
        const r = gl.domElement.getBoundingClientRect();
        return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
      },
      scene,
    };
  }, [camera, gl, scene]);
  useEffect(() => {
    // in "fast" mode there is no composer: let the renderer tone-map
    gl.toneMapping = THREE.AgXToneMapping;
    gl.toneMappingExposure = 1.0;
  }, [gl, quality]);
  return null;
}

/** keep the bench in view on portrait screens by widening the vertical field of view */
function ResponsiveFov() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const hTarget = (56 * Math.PI) / 180; // horizontal FOV we want on narrow screens
    let v = 46;
    if (aspect < 1.25) v = Math.min(80, (2 * Math.atan(Math.tan(hTarget / 2) / aspect) * 180) / Math.PI);
    camera.fov = Math.max(46, v);
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

/** let the UI know when the first frames are on screen */
function ReadySignal() {
  const n = useRef(0);
  useFrame(() => {
    n.current++;
    if (n.current === 3) useUi.getState().setReady(true);
  });
  return null;
}

export default function LabScene() {
  const quality = useBench((s) => s.quality);
  const [dpr, setDpr] = useState(quality === "high" ? 1.5 : 1);
  useEffect(() => setDpr(quality === "high" ? 1.5 : 1), [quality]);
  return (
    <Canvas
      shadows={quality === "high" ? "variance" : "soft"}
      dpr={dpr}
      gl={{ antialias: quality !== "high", powerPreference: "high-performance", preserveDrawingBuffer: true, stencil: false }}
      camera={{ fov: 46, near: 0.01, far: 40, position: [5.4, 1.62, 5.6] }}
      onPointerMissed={() => useBench.getState().cancel()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <PerformanceMonitor
        bounds={() => [38, 58]}
        flipflops={4}
        onDecline={() => setDpr((d) => Math.max(0.7, d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(quality === "high" ? 1.75 : 1.25, d + 0.25))}
      />
      <GlSettings />
      <ResponsiveFov />
      <color attach="background" args={["#e7e3da"]} />
      <Lights />
      <Suspense fallback={null}>
        <Env />
        <Room />
        <Atmosphere />
        <Trainer position={[0.03, DESK_Y, -0.07]} />
        <Oscilloscope />
        <Multimeter />
        <PowerCords />
        <Wires />
        <Leads />
        <Guide />
        <Insight />
        <Effects />
      </Suspense>
      <PointerTracker />
      <CameraRig />
      <KeyboardShortcuts />
      <ReadySignal />
    </Canvas>
  );
}

export { DESK_Y };
