"use client";
import * as THREE from "three";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { useBench } from "@/store/bench";
import { useSim } from "@/lab/simController";
import { Bench } from "./Bench";
import { Trainer } from "./Trainer";
import { Oscilloscope } from "./Oscilloscope";
import { Multimeter } from "./Multimeter";
import { Leads, PointerTracker, Wires, DESK_Y } from "./Cables";
import { CameraRig } from "./CameraRig";
import { anchorWorld, useUi } from "./registry";
import { Guide, Insight } from "./Overlays3D";
import { useLoad } from "@/ui/loadProgress";
import { preparePrints } from "./preparePrints";
import { MODULES } from "@/lab/modules";
import { moduleTexture } from "./draw/textures";

// post-processing (desktop "high" quality only) is a separate download, phones never fetch it
const Effects = lazy(() => import("./Effects"));

// this module arriving means the 3D engine and simulator code are loaded
if (typeof window !== "undefined") useLoad.getState().reach("engine", 30);


/**
 * In the light renderer (phones) the shadow map is refreshed a few times a
 * second instead of every frame — it only changes when something on the bench moves.
 */
function ShadowThrottle() {
  const gl = useThree((s) => s.gl);
  const quality = useBench((s) => s.quality);
  const n = useRef(0);
  useEffect(() => {
    gl.shadowMap.autoUpdate = quality === "high";
    gl.shadowMap.needsUpdate = true;
  }, [gl, quality]);
  useFrame(() => {
    if (quality === "high") return;
    if (++n.current % 12 === 0) gl.shadowMap.needsUpdate = true;
  });
  return null;
}

/**
 * Light renderer (phones): the canvas is not redrawn 60 times a second. Frames are
 * drawn while you touch / drag / zoom (and for a moment after), at 20 fps while
 * the trainer is powered (meters, scope and multimeter are live) or a guide /
 * X-ray overlay is animating, and not at all when the bench is idle.
 */
function DemandTicker() {
  const invalidate = useThree((s) => s.invalidate);
  const quality = useBench((s) => s.quality);
  useEffect(() => {
    if (quality === "high") return;
    let lastInput = performance.now();
    let lastLive = 0;
    const bump = () => {
      lastInput = performance.now();
      invalidate();
    };
    const evs = ["pointerdown", "pointermove", "pointerup", "wheel", "keydown", "touchmove"] as const;
    for (const e of evs) window.addEventListener(e, bump, { passive: true });
    const unsub = [useBench.subscribe(bump), useSim.subscribe(() => invalidate())];
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastInput < 1200) {
        invalidate();
        return;
      }
      const ui = useUi.getState();
      const live = useBench.getState().power || ui.insight || ui.guide || !ui.ready;
      if (live && now - lastLive > 50) {
        lastLive = now;
        invalidate();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      for (const e of evs) window.removeEventListener(e, bump);
      unsub.forEach((u) => u());
    };
  }, [quality, invalidate]);
  return null;
}

/** light renderer: a soft shadow under the equipment, drawn once instead of every frame */
function StaticShadows() {
  const quality = useBench((s) => s.quality);
  const devices = useBench((s) => s.devices);
  if (quality === "high") return null;
  return (
    <ContactShadows
      key={JSON.stringify(devices)}
      position={[0.02, DESK_Y + 0.0006, -0.02]}
      scale={[1.7, 0.92]}
      resolution={512}
      blur={2.2}
      far={0.35}
      opacity={0.55}
      frames={1}
      color="#2a2620"
    />
  );
}

function Lights() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const light = useBench((s) => s.quality) !== "high";
  return (
    <>
      <hemisphereLight args={["#f4f7ff", "#b9aa8e", 0.85]} />
      {/* daylight from the window wall (behind the equipment, as in the photographs) */}
      <directionalLight
        ref={sun}
        position={[-0.9, 3.6, -3.4]}
        intensity={1.2}
        color="#fff6ea"
        castShadow
        shadow-mapSize={light ? [1024, 1024] : [2048, 2048]}
        shadow-bias={-0.00025}
        shadow-normalBias={0.015}
        shadow-radius={4}
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
      {/* window band and ceiling tubes as two cheap directional fills */}
      <directionalLight position={[0.4, 2.2, -3]} intensity={0.6} color="#f3f6ff" />
      <directionalLight position={[-0.6, 3, 2.2]} intensity={0.55} color="#f8fbff" />
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


function KeyboardShortcuts() {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      const s = useBench.getState();
      if (e.key === "Escape") {
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
      renderer: gl,
      camera,
    };
  }, [camera, gl, scene]);
  useEffect(() => {
    // in "fast" mode there is no composer: let the renderer tone-map
    gl.toneMapping = THREE.AgXToneMapping;
    gl.toneMappingExposure = 1.0;
  }, [gl, quality]);
  return null;
}

/** portrait screens get a slightly wider lens; the views then frame their region at the right distance */
function ResponsiveFov() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    camera.fov = size.width < size.height ? 52 : 46;
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

/** let the UI know when the first frames are on screen */
function ReadySignal() {
  const n = useRef(0);
  useFrame(() => {
    n.current++;
    if (useLoad.getState().pct >= 88) useLoad.getState().reach("frames", 90 + n.current * 3);
    if (n.current === 3) useUi.getState().setReady(true);
  });
  return null;
}

/**
 * After the lab is open, draw and upload the other experiment boards in idle
 * moments, one at a time, so switching boards later is instant.
 */
function PrewarmBoards() {
  const get = useThree((s) => s.get);
  const ready = useUi((s) => s.ready);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const idle = (fn: () => void) =>
      "requestIdleCallback" in window ? (window as Window & { requestIdleCallback(cb: () => void, o?: object): number }).requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 600);
    const list = MODULES.slice();
    const next = () => {
      if (!alive) return;
      const m = list.shift();
      if (!m) return;
      const t = moduleTexture(m);
      get().gl.initTexture(t);
      idle(next);
    };
    const id = setTimeout(() => idle(next), 1500);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [ready, get]);
  return null;
}

/** compile every GPU program up front (behind the loading screen) instead of stuttering later */
function CompileWarmup() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene, camera, invalidate } = get();
    useLoad.getState().reach("shaders", 64);
    let alive = true;
    const t0 = performance.now();
    // creep the bar while the driver works, then finish the stage
    const id = setInterval(() => alive && useLoad.getState().reach("shaders", Math.min(87, 64 + (performance.now() - t0) / 120)), 150);
    const done = async () => {
      if (!alive) return;
      clearInterval(id);
      // upload the big textures to the GPU now, one per tick, instead of during the first frames
      const texs = new Set<THREE.Texture>();
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        for (const mm of m ? (Array.isArray(m) ? m : [m]) : []) {
          const map = (mm as THREE.MeshStandardMaterial).map;
          if (map && map.image) texs.add(map);
        }
      });
      let k = 0;
      for (const t of texs) {
        if (!alive) return;
        gl.initTexture(t);
        useLoad.getState().reach("shaders", 87 + (3 * ++k) / texs.size);
        await new Promise((r) => setTimeout(r, 0));
      }
      useLoad.getState().reach("frames", 90);
      invalidate();
    };
    (gl.compileAsync ? gl.compileAsync(scene, camera) : Promise.resolve(gl.compile(scene, camera))).then(done, done);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [get]);
  return null;
}

export default function LabScene() {
  const [prepared, setPrepared] = useState(false);
  useEffect(() => {
    let alive = true;
    preparePrints().then(() => alive && setPrepared(true));
    return () => {
      alive = false;
    };
  }, []);
  if (!prepared) return null;
  return <LabCanvas />;
}

function LabCanvas() {
  const quality = useBench((s) => s.quality);
  // the light renderer can afford the phone's 2x pixels (text on the panels stays legible)
  const maxDpr = (_q: string) => Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2);
  const [dpr, setDpr] = useState(() => Math.max(1, maxDpr(quality)));
  useEffect(() => setDpr(Math.max(1, maxDpr(quality))), [quality]);
  // ?dpr=… pins the render resolution (captures, testing)
  const [pinned] = useState(() => (typeof window === "undefined" ? NaN : parseFloat(new URLSearchParams(window.location.search).get("dpr") ?? "")));
  const renderDpr = Number.isFinite(pinned) ? Math.min(Math.max(pinned, 0.5), 3) : dpr;
  return (
    <Canvas
      shadows={quality === "high" ? "variance" : false}
      // light renderer: draw a frame only when something changes (see DemandTicker)
      frameloop={quality === "high" ? "always" : "demand"}
      dpr={renderDpr}
      gl={{ antialias: quality !== "high", powerPreference: "high-performance", preserveDrawingBuffer: true, stencil: false }}
      camera={{ fov: 46, near: 0.01, far: 40, position: [5.4, 1.62, 5.6] }}
      onPointerMissed={() => useBench.getState().cancel()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <PerformanceMonitor
        bounds={() => [38, 58]}
        flipflops={4}
        onDecline={() => setDpr((d) => Math.max(1, d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(Math.max(1, maxDpr(quality)), d + 0.25))}
      />
      <GlSettings />
      <ShadowThrottle />
      <DemandTicker />
      <ResponsiveFov />
      <color attach="background" args={["#e7e3da"]} />
      <Lights />
      <Suspense fallback={null}>
        <Env />
        <Bench />
        <StaticShadows />
        <Trainer position={[0.03, DESK_Y, -0.07]} />
        <Oscilloscope />
        <Multimeter />
        <Wires />
        <Leads />
        <Guide />
        <Insight />
        {quality === "high" && <Effects />}
        <CompileWarmup />
        <PrewarmBoards />
      </Suspense>
      <PointerTracker />
      <CameraRig />
      <KeyboardShortcuts />
      <ReadySignal />
    </Canvas>
  );
}

export { DESK_Y };
