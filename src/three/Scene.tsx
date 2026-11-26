"use client";
import * as THREE from "three";
import { Suspense, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Lightformer, AdaptiveDpr } from "@react-three/drei";
import { EffectComposer, N8AO, Bloom, SMAA } from "@react-three/postprocessing";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { useBench } from "@/store/bench";
import { Room } from "./Room";
import { Trainer } from "./Trainer";
import { Oscilloscope } from "./Oscilloscope";
import { Multimeter } from "./Multimeter";
import { Leads, PointerTracker, Wires, DESK_Y } from "./Cables";
import { CameraRig } from "./CameraRig";
import { anchorWorld } from "./registry";

if (typeof window !== "undefined") RectAreaLightUniformsLib.init();

function Lights() {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#b8a88a", 0.42]} />
      <ambientLight intensity={0.06} />
      {/* daylight through the window, behind the equipment (as in the photos) */}
      <directionalLight
        position={[-1.2, 4.2, -3.6]}
        intensity={1.0}
        color="#fff4e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-1.6}
        shadow-camera-right={1.6}
        shadow-camera-top={1.4}
        shadow-camera-bottom={-1.4}
        shadow-camera-near={1}
        shadow-camera-far={9}
      >
        <object3D attach="target" position={[0, DESK_Y, 0]} />
      </directionalLight>
      {/* the bright window band as a soft area light */}
      <rectAreaLight position={[2.6, 1.75, -0.55]} rotation={[0, Math.PI, 0]} width={8.5} height={1.8} intensity={1.1} color="#fff9ee" />
      {/* fluorescent ceiling fixtures */}
      <rectAreaLight position={[0, 2.95, 0.4]} rotation={[-Math.PI / 2, 0, 0]} width={1.2} height={0.3} intensity={4} color="#fffcf2" />
      <rectAreaLight position={[2.4, 2.95, 2.6]} rotation={[-Math.PI / 2, 0, 0]} width={1.2} height={0.3} intensity={3} color="#fffcf2" />
      <pointLight position={[0.1, 2.2, 0.9]} intensity={0.45} distance={4} decay={2} color="#fffaf0" />
    </>
  );
}

function Env() {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={0.55}>
      <color attach="background" args={["#d9d6cf"]} />
      <Lightformer form="rect" intensity={1.6} color="#fffaf0" position={[0, 1.8, -4]} scale={[10, 2.2, 1]} />
      <Lightformer form="rect" intensity={1} color="#ffffff" position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[3, 0.6, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#efe8dc" position={[-4, 1.5, 0]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
      <Lightformer form="rect" intensity={0.6} color="#efe8dc" position={[4, 1.5, 0]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
    </Environment>
  );
}

function Effects() {
  const quality = useBench((s) => s.quality);
  if (quality !== "high") return null;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={0.08} distanceFalloff={0.6} intensity={2.2} halfRes quality="medium" />
      <Bloom mipmapBlur intensity={0.35} luminanceThreshold={0.92} luminanceSmoothing={0.1} />
      <SMAA />
    </EffectComposer>
  );
}

function KeyboardShortcuts() {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      const s = useBench.getState();
      if (e.key === "Escape") s.cancel();
      if ((e.key === "Delete" || e.key === "Backspace") && s.selectedWire) s.removeWire(s.selectedWire);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return null;
}

function GlSettings() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
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
    };
  }, [camera, gl]);
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 0.82;
  }, [gl]);
  return null;
}

export default function LabScene() {
  const quality = useBench((s) => s.quality);
  return (
    <Canvas
      shadows="soft"
      dpr={quality === "high" ? [1, 1.75] : [0.75, 1.25]}
      gl={{ antialias: quality !== "high", powerPreference: "high-performance", preserveDrawingBuffer: true }}
      camera={{ fov: 48, near: 0.01, far: 40, position: [0.02, 1.24, 0.98] }}
      onPointerMissed={() => useBench.getState().cancel()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <GlSettings />
      <color attach="background" args={["#e7e3da"]} />
      <Lights />
      <Suspense fallback={null}>
        <Env />
        <Room />
        <Trainer position={[0.03, DESK_Y, -0.07]} />
        <Oscilloscope />
        <Multimeter />
        <Wires />
        <Leads />
        <Effects />
      </Suspense>
      <PointerTracker />
      <CameraRig />
      <KeyboardShortcuts />
      <AdaptiveDpr pixelated={false} />
    </Canvas>
  );
}
