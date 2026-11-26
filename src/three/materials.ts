"use client";
import * as THREE from "three";

const m = new Map<string, THREE.Material>();
function get<T extends THREE.Material>(k: string, make: () => T): T {
  let x = m.get(k) as T | undefined;
  if (!x) {
    x = make();
    m.set(k, x);
  }
  return x;
}

export const MAT = {
  beige: () => get("beige", () => new THREE.MeshStandardMaterial({ color: "#e3d9c0", roughness: 0.62, metalness: 0 })),
  beigeDark: () => get("beigeDark", () => new THREE.MeshStandardMaterial({ color: "#cdbf9f", roughness: 0.7 })),
  blackPlastic: () => get("blackPlastic", () => new THREE.MeshStandardMaterial({ color: "#141414", roughness: 0.38, metalness: 0 })),
  darkGrey: () => get("darkGrey", () => new THREE.MeshStandardMaterial({ color: "#2a2b2e", roughness: 0.5 })),
  chrome: () => get("chrome", () => new THREE.MeshStandardMaterial({ color: "#d6d8dc", roughness: 0.18, metalness: 1 })),
  brass: () => get("brass", () => new THREE.MeshStandardMaterial({ color: "#c9a85a", roughness: 0.3, metalness: 1 })),
  hole: () => get("hole", () => new THREE.MeshStandardMaterial({ color: "#050505", roughness: 0.9 })),
  whiteAbs: () => get("whiteAbs", () => new THREE.MeshStandardMaterial({ color: "#f1f1ee", roughness: 0.42 })),
  glass: () =>
    get(
      "glass",
      () =>
        new THREE.MeshPhysicalMaterial({
          color: "#ffffff",
          roughness: 0.04,
          metalness: 0,
          transmission: 0,
          transparent: true,
          opacity: 0.16,
          clearcoat: 1,
          depthWrite: false,
        }),
    ),
  blackGlass: () => get("blackGlass", () => new THREE.MeshPhysicalMaterial({ color: "#07080a", roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 })),
  aluminium: () => get("alu", () => new THREE.MeshStandardMaterial({ color: "#b9bcc0", roughness: 0.35, metalness: 0.85 })),
  rubberGreen: () => get("rubberGreen", () => new THREE.MeshStandardMaterial({ color: "#1f8a53", roughness: 0.75 })),
  white: () => get("white", () => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5 })),
};

export const PLASTIC_COLORS: Record<string, string> = {
  red: "#c8161a",
  black: "#151515",
  yellow: "#e8c414",
  blue: "#1d4fd0",
  green: "#178a3c",
  white: "#e9e9e6",
  greenyellow: "#9fc21c",
  pin: "#c9a85a",
};

export function plastic(color: string, emissive = 0) {
  return get(
    `plastic-${color}-${emissive}`,
    () =>
      new THREE.MeshStandardMaterial({
        color: PLASTIC_COLORS[color] ?? color,
        roughness: 0.42,
        emissive: PLASTIC_COLORS[color] ?? color,
        emissiveIntensity: emissive,
      }),
  );
}

const g = new Map<string, THREE.BufferGeometry>();
export function geo<T extends THREE.BufferGeometry>(k: string, make: () => T): T {
  let x = g.get(k) as T | undefined;
  if (!x) {
    x = make();
    g.set(k, x);
  }
  return x;
}
