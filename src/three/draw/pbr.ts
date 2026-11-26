"use client";
/**
 * Procedural PBR maps: fBm value noise -> height fields -> tangent-space normal maps,
 * plus roughness / grime maps. Everything is generated at start-up (no downloads).
 */
import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();
function cached(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/** deterministic PRNG */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

/** tileable value noise on a (period x period) lattice */
function valueNoise(size: number, period: number, seed: number): Float32Array {
  const r = rng(seed);
  const lat = new Float32Array(period * period);
  for (let i = 0; i < lat.length; i++) lat[i] = r();
  const out = new Float32Array(size * size);
  const f = period / size;
  for (let y = 0; y < size; y++) {
    const fy = y * f;
    const y0 = Math.floor(fy) % period,
      y1 = (y0 + 1) % period;
    let ty = fy - Math.floor(fy);
    ty = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < size; x++) {
      const fx = x * f;
      const x0 = Math.floor(fx) % period,
        x1 = (x0 + 1) % period;
      let tx = fx - Math.floor(fx);
      tx = tx * tx * (3 - 2 * tx);
      const a = lat[y0 * period + x0],
        b = lat[y0 * period + x1],
        c = lat[y1 * period + x0],
        d = lat[y1 * period + x1];
      out[y * size + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    }
  }
  return out;
}

/** fractal Brownian motion (tileable) */
export function fbm(size: number, basePeriod: number, octaves: number, seed: number, gain = 0.5): Float32Array {
  const out = new Float32Array(size * size);
  let amp = 1,
    total = 0,
    period = basePeriod;
  for (let o = 0; o < octaves; o++) {
    const n = valueNoise(size, Math.min(period, size), seed + o * 101);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    total += amp;
    amp *= gain;
    period *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** height field -> tangent-space normal map (tileable Sobel) */
export function normalFromHeight(h: Float32Array, size: number, strength: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const H = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1)) * strength;
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1)) * strength;
      let nx = -dx,
        ny = dy,
        nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function grayCanvas(v: Float32Array, size: number, lo: number, hi: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < v.length; i++) {
    const g = Math.max(0, Math.min(255, (lo + (hi - lo) * v[i]) * 255));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function dataTex(c: HTMLCanvasElement, repeat: [number, number], color = false) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/* ---------------------------------------------------------------- */
/* material detail maps                                               */
/* ---------------------------------------------------------------- */

/** fine "orange-peel" texture of moulded ABS / painted plastic */
export function plasticNormal(repeat: [number, number] = [1, 1]) {
  const key = `plasticN-${repeat}`;
  return cached(key, () => {
    const S = 256;
    const h = fbm(S, 32, 4, 11, 0.55);
    return dataTex(normalFromHeight(h, S, 1.6), repeat);
  });
}

/** low-frequency roughness variation (handling, wear) */
export function wearRoughness(repeat: [number, number] = [1, 1], lo = 0.45, hi = 0.7, seed = 5) {
  return cached(`wearR-${repeat}-${lo}-${hi}-${seed}`, () => {
    const S = 256;
    const n = fbm(S, 4, 5, seed, 0.6);
    return dataTex(grayCanvas(n, S, lo, hi), repeat);
  });
}

/** woven fabric of the vertical blinds */
export function fabricNormal(repeat: [number, number] = [1, 1]) {
  return cached(`fabricN-${repeat}`, () => {
    const S = 256;
    const h = new Float32Array(S * S);
    const n = fbm(S, 64, 2, 3, 0.5);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const wx = Math.sin((x / S) * Math.PI * 2 * 48) * 0.5 + 0.5;
        const wy = Math.sin((y / S) * Math.PI * 2 * 64) * 0.5 + 0.5;
        const over = ((Math.floor((x / S) * 48) + Math.floor((y / S) * 64)) & 1) === 0;
        h[y * S + x] = (over ? wx : wy) * 0.8 + n[y * S + x] * 0.4;
      }
    return dataTex(normalFromHeight(h, S, 2.2), repeat);
  });
}

/** painted plaster wall */
export function plasterNormal(repeat: [number, number] = [1, 1]) {
  return cached(`plasterN-${repeat}`, () => {
    const S = 512;
    const h = fbm(S, 16, 6, 21, 0.55);
    return dataTex(normalFromHeight(h, S, 1.2), repeat);
  });
}

/** laminate bench top: micro-stipple + faint wipe marks in the roughness */
export function laminateMaps() {
  return {
    normal: cached("lamN", () => {
      const S = 512;
      const h = fbm(S, 128, 3, 41, 0.5);
      return dataTex(normalFromHeight(h, S, 0.9), [6, 3]);
    }),
    rough: cached("lamR", () => {
      const S = 512;
      const n = fbm(S, 3, 6, 77, 0.62);
      const c = grayCanvas(n, S, 0.36, 0.62);
      const ctx = c.getContext("2d")!;
      // wipe arcs and hand smudges = slightly glossier
      const r = rng(9);
      ctx.globalCompositeOperation = "darken";
      for (let k = 0; k < 26; k++) {
        const x = r() * S,
          y = r() * S,
          rad = 18 + r() * 60;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, "rgba(60,60,60,0.55)");
        g.addColorStop(1, "rgba(60,60,60,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, rad, rad * (0.35 + r() * 0.5), r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      return dataTex(c, [1, 1]);
    }),
  };
}

/** polished terrazzo: chips are glossier than the matrix */
export function terrazzoMaps() {
  return {
    normal: cached("terrN", () => {
      const S = 512;
      const h = fbm(S, 64, 4, 63, 0.5);
      return dataTex(normalFromHeight(h, S, 0.6), [20, 16]);
    }),
    rough: cached("terrR", () => {
      const S = 512;
      const n = fbm(S, 8, 5, 91, 0.6);
      return dataTex(grayCanvas(n, S, 0.22, 0.5), [6, 5]);
    }),
  };
}

/** brushed / knurled metal */
export function brushedNormal(repeat: [number, number] = [1, 1]) {
  return cached(`brushN-${repeat}`, () => {
    const S = 256;
    const r = rng(17);
    const h = new Float32Array(S * S);
    const rowNoise = new Float32Array(S);
    for (let y = 0; y < S; y++) rowNoise[y] = r();
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = rowNoise[y] * 0.7 + r() * 0.3;
    return dataTex(normalFromHeight(h, S, 0.8), repeat);
  });
}
