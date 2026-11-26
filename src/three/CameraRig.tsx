"use client";
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import CameraControlsImpl from "camera-controls";
import { useBench } from "@/store/bench";
import { useUi } from "./registry";
import { ROOM } from "./Room";

type V3 = [number, number, number];
export const CAMERA_PRESETS: Record<string, () => { pos: V3; target: V3 }> = {
  seat: () => ({ pos: [0.0, 1.22, 0.72], target: [0.0, 0.79, -0.06] }),
  bench: () => ({ pos: [0.05, 1.12, 0.48], target: [0.05, 0.8, -0.06] }),
  module: () => ({ pos: [0.08, 1.06, 0.3], target: [0.08, 0.82, -0.05] }),
  generator: () => ({ pos: [-0.2, 1.0, 0.24], target: [-0.24, 0.83, -0.05] }),
  power: () => ({ pos: [0.36, 1.0, 0.26], target: [0.32, 0.83, -0.02] }),
  scope: () => {
    const p = useBench.getState().devices.osc;
    const c = Math.cos(p.rot),
      s = Math.sin(p.rot);
    const t: V3 = [p.x + s * -0.02, 0.83, p.z + c * -0.02];
    return { pos: [t[0] + s * 0.26, 0.98, t[2] + c * 0.26], target: t };
  },
  dmm: () => {
    const p = useBench.getState().devices.dmm;
    return { pos: [p.x + 0.02, 1.02, p.z + 0.17], target: [p.x, 0.78, p.z - 0.01] };
  },
  overview: () => ({ pos: [4.6, 2.35, 5.4], target: [1.6, 0.85, 0.6] }),
  door: () => ({ pos: [5.4, 1.62, 5.6], target: [0.3, 0.95, 0.0] }),
};

/** current orbit target (focus point for depth of field) */
export const camTarget = new THREE.Vector3(0, 0.8, -0.06);

let entered = false;

export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null);
  const mode = useBench((s) => s.mode);
  const dragging = useUi((s) => s.dragging);
  const camCmd = useUi((s) => s.camCmd);
  const keys = useRef<Record<string, boolean>>({});

  const go = (name: string, smooth = true, slow = false) => {
    const p = CAMERA_PRESETS[name]?.();
    const c = ref.current;
    if (!p || !c) return;
    c.smoothTime = slow ? 1.25 : 0.35;
    c.setLookAt(...p.pos, ...p.target, smooth).then(() => {
      if (c) c.smoothTime = 0.35;
    });
  };

  // cinematic entrance: from the lab door to the student's seat (once per session)
  const ready = useUi((s) => s.ready);
  useEffect(() => {
    if (!ready) return;
    if (entered || navigator.webdriver) {
      go("seat", false);
      entered = true;
      return;
    }
    entered = true;
    go("door", false);
    const id = setTimeout(() => go("seat", true, true), 450);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  useEffect(() => {
    if (camCmd) go(camCmd.name, true, camCmd.slow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camCmd]);
  useEffect(() => {
    if (ref.current) ref.current.enabled = !dragging;
  }, [dragging]);
  const firstMode = useRef(true);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    if (mode === "experiment") {
      c.minDistance = 0.12;
      c.maxDistance = 2.2;
      if (!firstMode.current) go("seat");
    } else {
      c.minDistance = 0.1;
      c.maxDistance = 9;
    }
    firstMode.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      keys.current[e.key.toLowerCase()] = true;
    };
    const up = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const tmp = new THREE.Vector3();
  useFrame((_, dt) => {
    const c = ref.current;
    if (!c) return;
    c.getTarget(camTarget);
    const k = keys.current;
    const speed = (k["shift"] ? 2.4 : 1.1) * dt;
    let f = 0,
      r = 0,
      u = 0;
    if (k["w"] || k["arrowup"]) f += speed;
    if (k["s"] || k["arrowdown"]) f -= speed;
    if (k["d"] || k["arrowright"]) r += speed;
    if (k["a"] || k["arrowleft"]) r -= speed;
    if (k["e"] || k["pageup"]) u += speed;
    if (k["q"] || k["pagedown"]) u -= speed;
    if (f || r || u) {
      c.forward(f, false);
      c.truck(r, 0, false);
      c.elevate(u, false);
      // keep inside the room
      c.getPosition(tmp);
      const cl = new THREE.Vector3(
        THREE.MathUtils.clamp(tmp.x, ROOM.x0 + 0.15, ROOM.x1 - 0.15),
        THREE.MathUtils.clamp(tmp.y, 0.3, ROOM.h - 0.15),
        THREE.MathUtils.clamp(tmp.z, ROOM.z0 + 0.2, ROOM.z1 - 0.15),
      );
      if (!cl.equals(tmp)) c.setPosition(cl.x, cl.y, cl.z, false);
    }
  });

  return (
    <CameraControls
      ref={ref}
      makeDefault
      smoothTime={0.35}
      draggingSmoothTime={0.08}
      dollyToCursor
      dollySpeed={0.6}
      truckSpeed={1.2}
      minDistance={0.12}
      maxDistance={2.2}
      maxPolarAngle={Math.PI * 0.62}
      mouseButtons={{ left: CameraControlsImpl.ACTION.ROTATE, middle: CameraControlsImpl.ACTION.DOLLY, right: CameraControlsImpl.ACTION.TRUCK, wheel: CameraControlsImpl.ACTION.DOLLY }}
      touches={{ one: CameraControlsImpl.ACTION.TOUCH_ROTATE, two: CameraControlsImpl.ACTION.TOUCH_DOLLY_TRUCK, three: CameraControlsImpl.ACTION.TOUCH_TRUCK }}
    />
  );
}
