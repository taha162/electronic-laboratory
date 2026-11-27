"use client";
import * as THREE from "three";
import { create } from "zustand";

/** Jack anchors: world position of a jack mouth and its outward normal. */
interface Anchor {
  obj: THREE.Object3D;
  local: THREE.Vector3;
}
const anchors = new Map<string, Anchor>();
const tmpQ = new THREE.Quaternion();

export function registerAnchor(id: string, obj: THREE.Object3D, local: THREE.Vector3) {
  anchors.set(id, { obj, local });
}
export function unregisterAnchor(id: string) {
  anchors.delete(id);
}
export function anchorWorld(id: string, out = new THREE.Vector3()): THREE.Vector3 | null {
  const a = anchors.get(id);
  if (!a) return null;
  a.obj.updateWorldMatrix(true, false);
  return out.copy(a.local).applyMatrix4(a.obj.matrixWorld);
}
export function anchorNormal(id: string, out = new THREE.Vector3()): THREE.Vector3 {
  const a = anchors.get(id);
  if (!a) return out.set(0, 1, 0);
  a.obj.getWorldQuaternion(tmpQ);
  return out.set(0, 1, 0).applyQuaternion(tmpQ);
}
export function hasAnchor(id: string) {
  return anchors.has(id);
}

/** Objects the pointer "rests on" while dragging a wire / lead */
export const surfaces = new Set<THREE.Object3D>();
/** last pointer hit on a surface (world) */
export const pointerHit = { point: new THREE.Vector3(0, 0.85, 0), valid: false };

/** transient UI state that should not be persisted */
interface UiState {
  hover: { id: string; label: string } | null;
  dragging: boolean;
  /** knob whose touch-friendly control sheet is open */
  ctrl: string | null;
  camCmd: { name: string; t: number; slow?: boolean } | null;
  /** first frames rendered */
  ready: boolean;
  /** "X-ray": show node voltages and colour cords by potential */
  insight: boolean;
  /** highlight the sockets of the next missing connection of the current step */
  guide: boolean;
  setHover(h: UiState["hover"]): void;
  setDragging(d: boolean): void;
  setCtrl(id: string | null): void;
  cam(name: string, slow?: boolean): void;
  setReady(r: boolean): void;
  setInsight(v: boolean): void;
  setGuide(v: boolean): void;
}
export const useUi = create<UiState>((set) => ({
  hover: null,
  dragging: false,
  ctrl: null,
  camCmd: null,
  ready: false,
  insight: false,
  guide: true,
  setHover: (hover) => set({ hover }),
  setDragging: (dragging) => set({ dragging }),
  setCtrl: (ctrl) => set({ ctrl }),
  cam: (name, slow) => set({ camCmd: { name, t: Date.now(), slow } }),
  setReady: (ready) => set({ ready }),
  setInsight: (insight) => set({ insight }),
  setGuide: (guide) => set({ guide }),
}));

/** mm on a board -> local metres (x right, z toward the user) */
export const mm = (v: number) => v / 1000;
