"use client";
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import CameraControlsImpl from "camera-controls";
import { useBench } from "@/store/bench";
import { useUi } from "./registry";

type V3 = [number, number, number];
/**
 * A view either places the camera absolutely, or frames a region: the camera
 * looks at `target` from elevation `el` (deg) / azimuth `az` (rad) and backs off
 * until a region of `w` x `h` metres fits the visible screen — so every view fills
 * a phone in portrait as well as a desktop monitor. Portrait screens get a steeper
 * angle (`elP`) so the panel print faces the reader, and their own region (`wP`, `hP`).
 */
interface Framed {
  target: V3;
  el: number;
  elP?: number;
  az?: number;
  w: number;
  h: number;
  wP?: number;
  hP?: number;
}
type Preset = { pos: V3; target: V3 } | Framed;

export const CAMERA_PRESETS: Record<string, () => Preset> = {
  seat: () => ({ target: [0.02, 0.8, -0.04], el: 29, elP: 52, w: 1.25, h: 0.55, wP: 0.68, hP: 0.5 }),
  bench: () => ({ target: [0.03, 0.82, -0.07], el: 32, elP: 58, w: 0.68, h: 0.5 }),
  meters: () => ({ target: [0.031, 0.948, -0.223], el: 45, elP: 62, w: 0.58, h: 0.12, wP: 0.3, hP: 0.12 }),
  module: () => ({ target: [0.031, 0.874, -0.04], el: 40, elP: 66, w: 0.38, h: 0.26 }),
  generator: () => ({ target: [-0.198, 0.855, -0.014], el: 45, elP: 66, w: 0.2, h: 0.32, wP: 0.13, hP: 0.33 }),
  power: () => ({ target: [0.259, 0.855, -0.014], el: 45, elP: 66, w: 0.2, h: 0.32, wP: 0.12, hP: 0.33 }),
  pots: () => ({ target: [0.032, 0.836, 0.112], el: 45, elP: 62, w: 0.38, h: 0.07, wP: 0.2, hP: 0.07 }),
  scope: () => {
    const p = useBench.getState().devices.osc;
    const c = Math.cos(p.rot),
      s = Math.sin(p.rot);
    return { target: [p.x + s * -0.02, 0.83, p.z + c * -0.02], el: 34, elP: 36, az: p.rot, w: 0.22, h: 0.15, wP: 0.2, hP: 0.15 };
  },
  dmm: () => {
    const p = useBench.getState().devices.dmm;
    return { target: [p.x, 0.785, p.z - 0.005], el: 56, elP: 64, az: p.rot, w: 0.1, h: 0.17 };
  },
};

/** screen space taken by the interface bars (px): the framed region avoids them */
function uiInsets(width: number, height: number) {
  const phone = Math.min(width, height) < 520;
  if (phone) return width < height ? { top: 86, bottom: 112 } : { top: 50, bottom: 62 };
  return { top: 70, bottom: 84 };
}

/** camera position for a view on the current screen */
export function resolvePreset(p: Preset, camera: THREE.PerspectiveCamera, size: { width: number; height: number }): { pos: V3; target: V3 } {
  if ("pos" in p) return p;
  const aspect = size.width / Math.max(size.height, 1);
  const portrait = aspect < 1;
  const el = THREE.MathUtils.degToRad(portrait ? (p.elP ?? p.el) : p.el);
  const az = p.az ?? 0;
  const w = portrait ? (p.wP ?? p.w) : p.w;
  const h = portrait ? (p.hP ?? p.h) : p.h;
  const ins = uiInsets(size.width, size.height);
  const usable = Math.max(0.35, (size.height - ins.top - ins.bottom) / size.height);
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const th = tv * aspect;
  const d = Math.max(w / 2 / th, h / 2 / (tv * usable)) * 1.08;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const target = new THREE.Vector3(...p.target);
  // centre the region in the part of the screen the bars leave free
  const up = new THREE.Vector3(0, 1, 0).sub(dir.clone().multiplyScalar(dir.y)).normalize();
  const shift = ((ins.bottom - ins.top) / 2 / size.height) * 2 * d * tv;
  target.addScaledVector(up, -shift);
  const pos = target.clone().addScaledVector(dir, d);
  return { pos: pos.toArray() as V3, target: target.toArray() as V3 };
}

/** current orbit target (focus point for depth of field) */
export const camTarget = new THREE.Vector3(0, 0.8, -0.06);

export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null);
  const dragging = useUi((s) => s.dragging);
  const camCmd = useUi((s) => s.camCmd);

  const get = useThree((s) => s.get);
  const lastView = useRef("seat");
  const go = (name: string, smooth = true, slow = false) => {
    lastView.current = name;
    const preset = CAMERA_PRESETS[name]?.();
    const c = ref.current;
    if (!preset || !c) return;
    const { camera, size } = get();
    const p = resolvePreset(preset, camera as THREE.PerspectiveCamera, size);
    c.smoothTime = slow ? 1.25 : 0.35;
    c.setLookAt(...p.pos, ...p.target, smooth).then(() => {
      if (c) c.smoothTime = 0.35;
    });
  };

  // start at the student's seat
  const ready = useUi((s) => s.ready);
  useEffect(() => {
    if (ready) go("seat", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  useEffect(() => {
    if (camCmd) go(camCmd.name, true, camCmd.slow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camCmd]);
  useEffect(() => {
    if (ref.current) ref.current.enabled = !dragging;
  }, [dragging]);
  useEffect(
    () =>
      useUi.subscribe((s) => {
        if (ref.current && ref.current.enabled === s.dragging) ref.current.enabled = !s.dragging;
      }),
    [],
  );

  // turning the phone: re-frame the current view for the new screen shape
  const size = useThree((s) => s.size);
  const wasPortrait = useRef<boolean | null>(null);
  useEffect(() => {
    const portrait = size.width < size.height;
    if (wasPortrait.current !== null && wasPortrait.current !== portrait) go(lastView.current, true);
    wasPortrait.current = portrait;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  // double tap / double click on the bench zooms to that spot; again zooms back out
  useEffect(() => {
    const el = get().gl.domElement;
    let down = { x: 0, y: 0, t: 0 };
    let last = { x: 0, y: 0, t: 0 };
    const onDown = (e: PointerEvent) => {
      if (e.isPrimary) down = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onUp = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      const now = performance.now();
      if (now - down.t > 320 || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) return; // a drag, not a tap
      if (now - last.t < 340 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 36) {
        last.t = 0;
        focusAt(e.clientX, e.clientY);
      } else last = { x: e.clientX, y: e.clientY, t: now };
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const focusAt = (cx: number, cy: number) => {
    const c = ref.current;
    if (!c) return;
    const { camera, scene, gl } = get();
    const r = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(scene.children, true).find((h) => {
      for (let o: THREE.Object3D | null = h.object; o; o = o.parent) if (!o.visible) return false;
      return true;
    });
    if (!hit) return;
    // taps on sockets, knobs, probes… belong to them, not to the camera
    for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
      const hd = (o as unknown as { __r3f?: { handlers?: Record<string, unknown> } }).__r3f?.handlers;
      if (hd && (hd.onClick || hd.onPointerDown)) return;
    }
    const pos = new THREE.Vector3(),
      tgt = new THREE.Vector3();
    c.getPosition(pos);
    c.getTarget(tgt);
    const dist = pos.distanceTo(tgt);
    const dir = pos.sub(tgt).normalize();
    const nd = dist > 0.3 ? Math.max(0.15, dist * 0.32) : Math.min(0.75, dist * 3);
    const np = hit.point.clone().addScaledVector(dir, nd);
    c.smoothTime = 0.3;
    c.setLookAt(np.x, np.y, np.z, hit.point.x, hit.point.y, hit.point.z, true);
  };
  useFrame(() => {
    ref.current?.getTarget(camTarget);
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
