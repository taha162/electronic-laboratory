"use client";
import * as THREE from "three";
import { jackVoltage } from "@/lab/simController";

/** mean potential (V) of the node a jack belongs to; NaN if floating */
export function nodeVoltage(jack: string): number {
  const v = jackVoltage(jack);
  return v ? v.mean : NaN;
}

const NEG = new THREE.Color("#2f7bff");
const ZERO = new THREE.Color("#e8ecf2");
const POS = new THREE.Color("#ff3b1f");
/** blue (negative) — white (0 V) — red (positive), saturating at ±12 V */
export function voltageColor(v: number, out: THREE.Color) {
  if (!Number.isFinite(v)) return out.set("#55585e");
  const t = Math.max(-1, Math.min(1, v / 12));
  const k = Math.sqrt(Math.abs(t));
  return out.copy(ZERO).lerp(t >= 0 ? POS : NEG, k);
}

export function fmtVolt(v: number) {
  const a = Math.abs(v);
  if (a < 1e-3) return "0 V";
  if (a < 1) return `${(v * 1000).toFixed(0)} mV`;
  return `${v.toFixed(a < 10 ? 2 : 1)} V`;
}
