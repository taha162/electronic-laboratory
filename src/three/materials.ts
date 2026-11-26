"use client";
import * as THREE from "three";
import { brushedNormal, plasticNormal, wearRoughness } from "./draw/pbr";

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
  // aged beige ABS of the KL-21001 cabinet (slightly yellowed, satin, moulded grain)
  beige: () =>
    get(
      "beige",
      () =>
        new THREE.MeshPhysicalMaterial({
          color: "#e2d6b9",
          roughness: 1,
          roughnessMap: wearRoughness([3, 3], 0.5, 0.72, 3),
          normalMap: plasticNormal([40, 40]),
          normalScale: new THREE.Vector2(0.1, 0.1),
          clearcoat: 0.12,
          clearcoatRoughness: 0.6,
        }),
    ),
  beigeDark: () => get("beigeDark", () => new THREE.MeshStandardMaterial({ color: "#cdbf9f", roughness: 0.7 })),
  blackPlastic: () =>
    get(
      "blackPlastic",
      () =>
        new THREE.MeshPhysicalMaterial({
          color: "#121212",
          roughness: 0.42,
          normalMap: plasticNormal([3, 3]),
          normalScale: new THREE.Vector2(0.25, 0.25),
          clearcoat: 0.25,
          clearcoatRoughness: 0.35,
        }),
    ),
  darkGrey: () => get("darkGrey", () => new THREE.MeshStandardMaterial({ color: "#2a2b2e", roughness: 0.5 })),
  chrome: () => get("chrome", () => new THREE.MeshStandardMaterial({ color: "#d9dbe0", roughness: 0.16, metalness: 1, normalMap: brushedNormal([2, 2]), normalScale: new THREE.Vector2(0.08, 0.08) })),
  brass: () => get("brass", () => new THREE.MeshStandardMaterial({ color: "#c9a85a", roughness: 0.3, metalness: 1 })),
  hole: () => get("hole", () => new THREE.MeshStandardMaterial({ color: "#050505", roughness: 0.9 })),
  whiteAbs: () =>
    get(
      "whiteAbs",
      () =>
        new THREE.MeshPhysicalMaterial({
          color: "#f2f2ef",
          roughness: 0.38,
          normalMap: plasticNormal([4, 4]),
          normalScale: new THREE.Vector2(0.2, 0.2),
          clearcoat: 0.3,
          clearcoatRoughness: 0.3,
        }),
    ),
  glass: () =>
    get(
      "glass",
      () =>
        new THREE.MeshPhysicalMaterial({
          color: "#ffffff",
          roughness: 0.03,
          metalness: 0,
          transparent: true,
          // mostly see-through; the Fresnel reflection (specular) carries the look of glass
          opacity: 0.045,
          specularIntensity: 1,
          clearcoat: 1,
          clearcoatRoughness: 0.02,
          envMapIntensity: 1.4,
          depthWrite: false,
        }),
    ),
  blackGlass: () => get("blackGlass", () => new THREE.MeshPhysicalMaterial({ color: "#07080a", roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 })),
  aluminium: () =>
    get("alu", () => new THREE.MeshStandardMaterial({ color: "#b9bcc0", roughness: 0.32, metalness: 0.85, normalMap: brushedNormal([1, 4]), normalScale: new THREE.Vector2(0.15, 0.15) })),
  // TPE rubber holster of the multimeter
  rubberGreen: () =>
    get(
      "rubberGreen",
      () =>
        new THREE.MeshPhysicalMaterial({
          color: "#1d8a52",
          roughness: 0.72,
          normalMap: plasticNormal([5, 5]),
          normalScale: new THREE.Vector2(0.6, 0.6),
          sheen: 0.4,
          sheenRoughness: 0.8,
          sheenColor: new THREE.Color("#7fdcab"),
        }),
    ),
  /** Pro'sKit holster: teal TPE rubber */
  rubberTeal: () =>
    get(
      "rubberTeal",
      () =>
        new THREE.MeshPhysicalMaterial({
          color: "#0f9c8d",
          roughness: 0.62,
          normalMap: plasticNormal([3, 3]),
          normalScale: new THREE.Vector2(0.14, 0.14),
          sheen: 0.45,
          sheenRoughness: 0.75,
          sheenColor: new THREE.Color("#8fe9dc"),
        }),
    ),
  white: () => get("white", () => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5 })),
};

export const PLASTIC_COLORS: Record<string, string> = {
  red: "#c8161a",
  black: "#151515",
  yellow: "#e8c414",
  blue: "#1d4fd0",
  green: "#178a3c",
  white: "#eeece4",
  greenyellow: "#9fc21c",
  pin: "#c9a85a",
  // KL-21001 socket colours as photographed (muted pink-red, sky cyan, cream white)
  pink: "#c4566a",
  cyan: "#3ea3d1",
};

export function plastic(color: string, emissive = 0) {
  return get(
    `plastic-${color}-${emissive}`,
    () =>
      new THREE.MeshPhysicalMaterial({
        color: PLASTIC_COLORS[color] ?? color,
        roughness: 0.34,
        clearcoat: 0.35,
        clearcoatRoughness: 0.25,
        normalMap: plasticNormal([2, 2]),
        normalScale: new THREE.Vector2(0.15, 0.15),
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
