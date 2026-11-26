"use client";
import * as THREE from "three";
import { useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useBench } from "@/store/bench";
import { useUi } from "./registry";

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.762);
const hit = new THREE.Vector3();

/**
 * Drag a device across the bench top. In explore mode a plain drag moves it;
 * in experiment mode hold Alt (or use the move handle) to move.
 * Rotating: drag with Shift.
 */
export function useDeviceDrag(id: "osc" | "dmm", _ref: React.RefObject<THREE.Group | null>) {
  const st = useRef<{ dx: number; dz: number; x: number; rot: number; rotate: boolean } | null>(null);
  void _ref;
  return {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      const s = useBench.getState();
      const movable = s.mode === "explore" || e.altKey || e.shiftKey;
      if (!movable || e.button !== 0) return;
      if (!e.ray.intersectPlane(plane, hit)) return;
      e.stopPropagation();
      (e.target as unknown as { setPointerCapture(id: number): void }).setPointerCapture(e.pointerId);
      const p = s.devices[id];
      st.current = { dx: p.x - hit.x, dz: p.z - hit.z, x: e.clientX, rot: p.rot, rotate: e.shiftKey };
      useUi.getState().setDragging(true);
      document.body.style.cursor = "grabbing";
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      if (!st.current) return;
      e.stopPropagation();
      if (st.current.rotate) {
        useBench.getState().moveDevice(id, { rot: st.current.rot + (e.clientX - st.current.x) / 120 });
        return;
      }
      if (!e.ray.intersectPlane(plane, hit)) return;
      const x = Math.min(Math.max(hit.x + st.current.dx, -0.85), 0.85);
      const z = Math.min(Math.max(hit.z + st.current.dz, -0.05), 0.34);
      // keep devices off the trainer footprint
      const inTrainer = Math.abs(x - 0.03) < 0.36 && z < 0.2;
      if (!inTrainer) useBench.getState().moveDevice(id, { x, z });
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      if (!st.current) return;
      e.stopPropagation();
      (e.target as unknown as { releasePointerCapture(id: number): void }).releasePointerCapture(e.pointerId);
      st.current = null;
      useUi.getState().setDragging(false);
      document.body.style.cursor = "auto";
    },
  };
}
