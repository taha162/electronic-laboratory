"use client";
import * as THREE from "three";
import { TRAINER_H, TRAINER_W, TRAINER_JACKS, TRAINER_KNOBS, TRAINER_METERS, MODULE_SLOT, DVM_RECT } from "@/lab/trainer";
import type { ModuleDef } from "@/lab/types";
import { drawModuleFace } from "./schematic";

const cache = new Map<string, THREE.Texture>();

export function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function toTexture(c: HTMLCanvasElement, opts: { repeat?: [number, number]; srgb?: boolean; aniso?: number } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso ?? 8;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  t.needsUpdate = true;
  return t;
}

function cached(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/* -------------------------------------------------------------- */
/* KL-21001 front panel                                            */
/* -------------------------------------------------------------- */
const INK = "#161616";

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, align: CanvasTextAlign = "center", bold = true) {
  ctx.font = `${bold ? "bold " : ""}${size}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}

export function trainerPanelTexture() {
  return cached("trainer-panel", () => {
    const S = 3; // px per mm
    const c = canvas(TRAINER_W * S, TRAINER_H * S);
    const ctx = c.getContext("2d")!;
    ctx.scale(S, S);
    // base colour with slight grain
    ctx.fillStyle = "#ebe8de";
    ctx.fillRect(0, 0, TRAINER_W, TRAINER_H);
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `rgba(90,80,60,${Math.random() * 0.03})`;
      ctx.fillRect(Math.random() * TRAINER_W, Math.random() * TRAINER_H, 0.5, 0.5);
    }
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 0.55;
    rrect(ctx, 4, 4, TRAINER_W - 8, TRAINER_H - 8, 3);
    ctx.stroke();
    // top strip
    ctx.beginPath();
    ctx.moveTo(4, 96);
    ctx.lineTo(TRAINER_W - 4, 96);
    ctx.stroke();
    // logo
    ctx.lineWidth = 0.5;
    ctx.strokeRect(12, 6, 15, 9);
    text(ctx, "KL", 19.5, 10.7, 5.2);
    text(ctx, "KL-21001 LINEAR CIRCUIT LAB", 31, 10.8, 5.2, "left");
    // DVM area
    ctx.fillStyle = "#1a1a1a";
    rrect(ctx, DVM_RECT.x - 2, DVM_RECT.y - 2, DVM_RECT.w + 4, DVM_RECT.h + 4, 1.5);
    ctx.fill();
    ctx.fillStyle = INK;
    // meter sections
    for (const m of TRAINER_METERS) {
      ctx.beginPath();
      ctx.moveTo(m.x - 3, 4);
      ctx.lineTo(m.x - 3, 96);
      ctx.stroke();
      text(ctx, m.title, m.x + m.w / 2, 11.5, 4.1);
    }
    // jack labels
    for (const j of TRAINER_JACKS) {
      if (!j.label) continue;
      const off = 8.5;
      const lp = j.lp ?? "n";
      const dx = lp === "e" ? off - 2 : lp === "w" ? -off + 2 : 0;
      const dy = lp === "n" ? -off : lp === "s" ? off - 1 : 0;
      const sz = j.id.startsWith("vr") ? 3.6 : j.label.length > 6 ? 3.3 : 3.9;
      text(ctx, j.label, j.x + dx, j.y + dy, sz, lp === "e" ? "left" : lp === "w" ? "right" : "center");
    }
    // function generator column
    ctx.lineWidth = 0.55;
    ctx.strokeRect(9, 100, 112, 316);
    ctx.fillStyle = INK;
    ctx.fillRect(9, 100, 112, 10);
    ctx.fillStyle = "#f2efe6";
    text(ctx, "FUNCTION GENERATOR", 65, 105.3, 4.6);
    ctx.fillStyle = INK;
    // AC/sine icon under OUTPUT
    // module slot recess
    ctx.fillStyle = "#d8d4c8";
    ctx.fillRect(MODULE_SLOT.x, MODULE_SLOT.y, MODULE_SLOT.w, MODULE_SLOT.h);
    ctx.fillStyle = INK;
    // right column
    ctx.strokeRect(506, 100, 88, 316);
    const sec = (y: number, h: number, title: string) => {
      ctx.strokeRect(506, y, 88, h);
      ctx.fillRect(506, y, 88, 8.5);
      ctx.fillStyle = "#f2efe6";
      text(ctx, title, 550, y + 4.4, 4);
      ctx.fillStyle = INK;
    };
    sec(100, 56, "SPEAKER");
    // speaker icon
    ctx.lineWidth = 0.5;
    ctx.strokeRect(556, 126, 8, 12);
    ctx.beginPath();
    ctx.moveTo(564, 126);
    ctx.lineTo(576, 118);
    ctx.lineTo(576, 146);
    ctx.lineTo(564, 138);
    ctx.stroke();
    text(ctx, "INPUT", 520, 114, 3.4);
    sec(160, 44, "AC SOURCE");
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const x = 540 + i * 0.8;
      const y = 197 + Math.sin((i / 30) * Math.PI * 2) * 2.2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    sec(208, 84, "DC POWER SUPPLY");
    text(ctx, "FIXED POWER", 550, 222, 3.6);
    sec(296, 120, "ADJUST POWER");
    text(ctx, "±3V~±18V", 550, 312, 3.8);
    text(ctx, "OUTPUT", 552, 342, 3.4);
    // VR row
    for (let k = 0; k < 4; k++) {
      const x0 = 150 + k * 92;
      ctx.strokeRect(x0 - 16, 362, 90, 54);
      const names = ["VR1 1KΩ", "VR2 10KΩ", "VR3 100KΩ", "VR4 1MΩ"];
      text(ctx, names[k], x0 + 46, 370, 3.8);
      // resistor symbol above A-C
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      ctx.moveTo(x0 + 34, 396);
      ctx.lineTo(x0 + 34, 391);
      ctx.lineTo(x0 + 38, 391);
      for (let i = 0; i < 6; i++) ctx.lineTo(x0 + 39.5 + i * 3, i % 2 ? 389 : 393);
      ctx.lineTo(x0 + 62, 391);
      ctx.lineTo(x0 + 66, 391);
      ctx.lineTo(x0 + 66, 396);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x0 + 50, 396);
      ctx.lineTo(x0 + 50, 386);
      ctx.stroke();
    }
    // knob scales
    for (const kn of TRAINER_KNOBS) {
      ctx.lineWidth = 0.4;
      const R = kn.r + 3.5;
      if (kn.id.startsWith("vr")) continue;
      if (kn.label) text(ctx, kn.label, kn.x, kn.y - kn.r - 9, 4.1);
      if (kn.detents && kn.marks) {
        const n = kn.detents;
        for (let i = 0; i < n; i++) {
          const a = knobAngle(kn.detents, i) - Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(kn.x + Math.cos(a) * R, kn.y + Math.sin(a) * R);
          ctx.lineTo(kn.x + Math.cos(a) * (R + 2), kn.y + Math.sin(a) * (R + 2));
          ctx.stroke();
          text(ctx, kn.marks[i], kn.x + Math.cos(a) * (R + 5.5), kn.y + Math.sin(a) * (R + 5.5), 3.4);
        }
      } else {
        for (let i = 0; i <= 10; i++) {
          const a = knobAngle(0, i / 10) - Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(kn.x + Math.cos(a) * R, kn.y + Math.sin(a) * R);
          ctx.lineTo(kn.x + Math.cos(a) * (R + (i % 5 ? 1.2 : 2.2)), kn.y + Math.sin(a) * (R + (i % 5 ? 1.2 : 2.2)));
          ctx.stroke();
        }
        if (kn.minLabel) text(ctx, kn.minLabel, kn.x - R - 1, kn.y + R + 2, 3.2, "right", false);
        if (kn.maxLabel) text(ctx, kn.maxLabel, kn.x + R + 1, kn.y + R + 2, 3.2, "left", false);
      }
    }
    // function icons near FUNCTION knob already as marks
    return toTexture(c, { aniso: 16 });
  });
}

/** angle (rad) of a knob value, 0 = 12 o'clock, range -135°..+135° */
export function knobAngle(detents: number, v: number) {
  if (detents && detents > 1) return (-120 * Math.PI) / 180 + (v / (detents - 1)) * ((240 * Math.PI) / 180);
  const span = (270 * Math.PI) / 180;
  return -span / 2 + v * span;
}

/* -------------------------------------------------------------- */
export function moduleTexture(m: ModuleDef) {
  return cached(`module-${m.id}`, () => {
    const S = 4;
    const [W, H] = m.size;
    const c = canvas(W * S, H * S);
    const ctx = c.getContext("2d")!;
    ctx.scale(S, S);
    drawModuleFace(ctx, m);
    return toTexture(c, { aniso: 16 });
  });
}

/* -------------------------------------------------------------- */
export function meterFaceTexture(full: number, unit: string, ac: boolean) {
  return cached(`meter-${full}-${unit}-${ac}`, () => {
    const c = canvas(512, 290);
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 290);
    g.addColorStop(0, "#fbfbf6");
    g.addColorStop(1, "#ecebe4");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 290);
    const cx = 256,
      cy = 330,
      R = 250;
    const a0 = -Math.PI / 2 - 0.72,
      a1 = -Math.PI / 2 + 0.72;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, R, a0, a1);
    ctx.stroke();
    // mirror band
    ctx.lineWidth = 7;
    ctx.strokeStyle = "rgba(160,170,180,0.6)";
    ctx.beginPath();
    ctx.arc(cx, cy, R - 14, a0, a1);
    ctx.stroke();
    ctx.strokeStyle = "#111";
    ctx.fillStyle = "#111";
    const major = full === 30 ? 6 : full === 15 ? 3 : 10;
    const minor = 5;
    const n = major * minor;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      const L = i % minor === 0 ? 22 : 11;
      ctx.lineWidth = i % minor === 0 ? 3 : 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.lineTo(cx + Math.cos(a) * (R + L), cy + Math.sin(a) * (R + L));
      ctx.stroke();
      if (i % minor === 0) {
        const v = (full * i) / n;
        ctx.font = "bold 26px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${Math.round(v)}`, cx + Math.cos(a) * (R + 44), cy + Math.sin(a) * (R + 44));
      }
    }
    ctx.font = "bold 46px Arial";
    ctx.fillText(unit, cx, 230);
    ctx.font = "22px Arial";
    ctx.fillText(ac ? "AC ~" : "DC ⎓", cx, 268);
    ctx.font = "bold 20px Arial";
    ctx.fillText("KL", 50, 262);
    return toTexture(c);
  });
}

/* -------------------------------------------------------------- */
/* 7-segment rendering                                             */
/* -------------------------------------------------------------- */
const SEG: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
  " ": "",
  O: "abcdef",
  L: "def",
  E: "adefg",
  r: "eg",
};

export function draw7seg(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  h: number,
  on: string,
  off: string | null,
  digits: number,
) {
  // right-align into `digits` cells
  const chars: { ch: string; dot: boolean }[] = [];
  for (const ch of str) {
    if (ch === "." && chars.length) chars[chars.length - 1].dot = true;
    else chars.push({ ch, dot: false });
  }
  while (chars.length < digits) chars.unshift({ ch: " ", dot: false });
  const w = h * 0.55;
  const t = h * 0.11;
  const gap = h * 0.22;
  const skew = h * 0.08;
  chars.slice(-digits).forEach((c, i) => {
    const ox = x + i * (w + gap);
    const segs = SEG[c.ch] ?? "";
    const hseg = (sx: number, sy: number) => [sx + t * 0.5, sy, w - t, t] as const;
    const defs: Record<string, readonly number[]> = {
      a: hseg(ox, y),
      g: hseg(ox, y + h / 2 - t / 2),
      d: hseg(ox, y + h - t),
      f: [ox, y + t * 0.6, t, h / 2 - t * 0.8],
      b: [ox + w - t, y + t * 0.6, t, h / 2 - t * 0.8],
      e: [ox, y + h / 2 + t * 0.2, t, h / 2 - t * 0.8],
      c: [ox + w - t, y + h / 2 + t * 0.2, t, h / 2 - t * 0.8],
    };
    for (const k of "abcdefg") {
      const lit = segs.includes(k);
      if (!lit && !off) continue;
      ctx.fillStyle = lit ? on : off!;
      const [sx, sy, sw, sh] = defs[k];
      const sk = skew * (1 - (sy + sh / 2 - y) / h);
      ctx.beginPath();
      ctx.moveTo(sx + sk, sy);
      ctx.lineTo(sx + sw + sk, sy);
      ctx.lineTo(sx + sw + sk - (skew * sh) / h, sy + sh);
      ctx.lineTo(sx + sk - (skew * sh) / h, sy + sh);
      ctx.closePath();
      ctx.fill();
    }
    if (c.dot || (off && i < digits)) {
      ctx.fillStyle = c.dot ? on : off ?? "transparent";
      ctx.beginPath();
      ctx.arc(ox + w + gap * 0.45, y + h - t / 2, t * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/* -------------------------------------------------------------- */
/* Environment textures                                            */
/* -------------------------------------------------------------- */
function noise(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, rgb: string, a: number, s = 1) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `rgba(${rgb},${Math.random() * a})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}

export function blindsTexture() {
  return cached("blinds", () => {
    const W = 128,
      H = 1024;
    const c = canvas(W, H);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#d8c7a0";
    ctx.fillRect(0, 0, W, H);
    // woven texture
    for (let y = 0; y < H; y += 2) {
      ctx.fillStyle = `rgba(255,250,235,${0.08 + Math.random() * 0.06})`;
      ctx.fillRect(0, y, W, 1);
    }
    // leafy diagonal jacquard pattern (as in the photos)
    ctx.strokeStyle = "rgba(150,125,80,0.35)";
    ctx.lineWidth = 3;
    for (let k = 0; k < 26; k++) {
      const y0 = k * 42 + (k % 2) * 12;
      ctx.beginPath();
      ctx.moveTo(10, y0);
      ctx.bezierCurveTo(40, y0 - 20, 70, y0 + 10, 118, y0 - 26);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(64, y0 - 6, 18, 6, -0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,240,0.25)";
    ctx.lineWidth = 2;
    for (let k = 0; k < 26; k++) {
      const y0 = k * 42 + 22;
      ctx.beginPath();
      ctx.moveTo(4, y0 + 10);
      ctx.bezierCurveTo(30, y0 - 8, 90, y0 + 18, 124, y0);
      ctx.stroke();
    }
    noise(ctx, W, H, 6000, "80,60,30", 0.08);
    // weighted hem at the bottom
    ctx.fillStyle = "rgba(120,100,70,0.25)";
    ctx.fillRect(0, H - 14, W, 14);
    return toTexture(c);
  });
}

export function floorTexture() {
  return cached("floor", () => {
    const W = 512;
    const c = canvas(W, W);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#cdbfa8";
    ctx.fillRect(0, 0, W, W);
    // terrazzo chips
    const cols = ["#b7a68b", "#e2d7c3", "#9b8a70", "#f1ebe0", "#8c7b66", "#c4b394"];
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = cols[(Math.random() * cols.length) | 0];
      const s = Math.random() * 3.2 + 0.6;
      ctx.beginPath();
      ctx.ellipse(Math.random() * W, Math.random() * W, s, s * (0.5 + Math.random() * 0.5), Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    noise(ctx, W, W, 20000, "60,50,40", 0.06);
    // grout
    ctx.strokeStyle = "rgba(110,95,75,0.55)";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, W, W);
    return toTexture(c, { repeat: [20, 16] });
  });
}

export function deskTexture() {
  return cached("desk", () => {
    const W = 2048,
      H = 1024;
    const c = canvas(W, H);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#e9e8e4";
    ctx.fillRect(0, 0, W, H);
    noise(ctx, W, H, 60000, "120,120,115", 0.05, 2);
    // faint pencil scribbles & equations like on the real bench
    ctx.strokeStyle = "rgba(90,90,100,0.18)";
    ctx.lineWidth = 2;
    for (let k = 0; k < 14; k++) {
      const x = Math.random() * W,
        y = Math.random() * H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let i = 0; i < 12; i++) ctx.lineTo(x + i * 9 + Math.random() * 8, y + Math.sin(i) * 6 + Math.random() * 6);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(90,90,110,0.16)";
    ctx.font = "34px 'Comic Sans MS', cursive";
    ["Vrms = Vp/√2", "f = 1/T", "10Vpp", "R=1k", "Av = -Rc/re", "3.54 V"].forEach((s) => {
      ctx.fillText(s, Math.random() * (W - 300) + 50, Math.random() * (H - 100) + 60);
    });
    return toTexture(c);
  });
}

export function wallTexture() {
  return cached("wall", () => {
    const W = 512;
    const c = canvas(W, W);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#e9e6df";
    ctx.fillRect(0, 0, W, W);
    noise(ctx, W, W, 30000, "120,110,95", 0.04, 2);
    return toTexture(c, { repeat: [4, 2] });
  });
}

/** sheet of paper with hand-drawn waveforms */
export function waveformPaperTexture(kind: number) {
  return cached(`paper-${kind}`, () => {
    const W = 600,
      H = 840;
    const c = canvas(W, H);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fbfbf8";
    ctx.fillRect(0, 0, W, H);
    noise(ctx, W, H, 4000, "150,150,140", 0.05);
    ctx.strokeStyle = "rgba(25,25,35,0.85)";
    ctx.lineWidth = 2.4;
    ctx.lineJoin = ctx.lineCap = "round";
    const axis = (y: number) => {
      ctx.beginPath();
      ctx.moveTo(50, y);
      ctx.lineTo(W - 40, y + (Math.random() - 0.5) * 6);
      ctx.moveTo(60, y - 110);
      ctx.lineTo(60, y + 110);
      ctx.stroke();
    };
    const wave = (y: number, fn: (p: number) => number, amp: number) => {
      ctx.beginPath();
      for (let x = 60; x < W - 50; x += 2) {
        const p = ((x - 60) / 170) * Math.PI * 2;
        const yy = y - fn(p) * amp + Math.sin(x * 0.07) * 0.8;
        if (x === 60) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    };
    if (kind === 0) {
      axis(200);
      wave(200, Math.sin, 90);
      axis(520);
      wave(520, (p) => Math.max(Math.sin(p), 0) * 0.85, 90);
      ctx.font = "28px 'Comic Sans MS', cursive";
      ctx.fillStyle = "rgba(25,25,35,0.85)";
      ctx.fillText("Vin", 70, 90);
      ctx.fillText("Vout", 70, 410);
      ctx.fillText("Vp = 5V", 380, 700);
    } else {
      axis(260);
      wave(260, (p) => Math.sin(p), 100);
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(60, 170);
      ctx.lineTo(W - 40, 170);
      ctx.stroke();
      ctx.setLineDash([]);
      axis(600);
      wave(600, (p) => Math.min(Math.sin(p), 0.35), 100);
      ctx.font = "26px 'Comic Sans MS', cursive";
      ctx.fillStyle = "rgba(25,25,35,0.85)";
      ctx.fillText("V+ = 3V", 400, 520);
    }
    return toTexture(c);
  });
}

/** an open lab-manual spread (left & right pages) */
export function manualTexture() {
  return cached("manual", () => {
    const W = 1400,
      H = 1000;
    const c = canvas(W, H);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#f7f6f1";
    ctx.fillRect(0, 0, W, H);
    noise(ctx, W, H, 8000, "150,150,140", 0.05);
    const g = ctx.createLinearGradient(W / 2 - 60, 0, W / 2 + 60, 0);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.5, "rgba(0,0,0,0.18)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(W / 2 - 60, 0, 120, H);
    ctx.fillStyle = "#1d1d1d";
    ctx.font = "bold 30px 'Times New Roman', serif";
    ctx.fillText("2.6.2 Parallel Clipping Circuit", 80, 90);
    ctx.font = "24px 'Times New Roman', serif";
    const lines = [
      "1.  Use module KL-23001",
      "2.  Using oscilloscope, adjust function generator to 10 V p-p,",
      "     1kHz Sine wave. Make a good adjustment since this signal",
      "     is the common input signal that will be used during whole step.",
      "3.  Adjust oscilloscope divisions until you have a clear view",
      "     of input signal.",
      "4.  Disconnect function generator output from oscilloscope",
      "     and apply this to TP2.",
      "5.  Adjust DC voltage source to 3 v.",
      "6.  Examine the output signal by connecting the second",
      "     channel of oscilloscope to the output of the circuit.",
    ];
    lines.forEach((l, i) => ctx.fillText(l, 80, 150 + i * 38));
    // graticule boxes
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    for (const [x, y] of [
      [90, 600],
      [360, 600],
    ]) {
      ctx.strokeRect(x, y, 230, 170);
      ctx.lineWidth = 0.8;
      for (let i = 1; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * 23, y);
        ctx.lineTo(x + i * 23, y + 170);
        ctx.stroke();
      }
      for (let i = 1; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y + i * 21.25);
        ctx.lineTo(x + 230, y + i * 21.25);
        ctx.stroke();
      }
      ctx.lineWidth = 2;
    }
    // right page schematics
    ctx.lineWidth = 3;
    const sch = (x: number, y: number, flip: boolean) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 60, y);
      for (let i = 0; i < 6; i++) ctx.lineTo(x + 66 + i * 10, i % 2 ? y - 8 : y + 8);
      ctx.lineTo(x + 130, y);
      ctx.lineTo(x + 230, y);
      ctx.moveTo(x + 170, y);
      ctx.lineTo(x + 170, y + 40);
      ctx.moveTo(x, y + 120);
      ctx.lineTo(x + 230, y + 120);
      ctx.moveTo(x + 170, y + 80);
      ctx.lineTo(x + 170, y + 120);
      ctx.stroke();
      ctx.beginPath();
      if (flip) {
        ctx.moveTo(x + 158, y + 72);
        ctx.lineTo(x + 182, y + 72);
        ctx.lineTo(x + 170, y + 50);
      } else {
        ctx.moveTo(x + 158, y + 50);
        ctx.lineTo(x + 182, y + 50);
        ctx.lineTo(x + 170, y + 72);
      }
      ctx.closePath();
      ctx.fill();
      ctx.font = "22px serif";
      ctx.fillText("R", x + 90, y - 18);
      ctx.fillText("Vi", x + 10, y + 70);
      ctx.fillText("Vo", x + 205, y + 70);
    };
    sch(760, 120, false);
    sch(1060, 120, true);
    sch(760, 420, false);
    sch(1060, 420, true);
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    ctx.strokeRect(740, 80, 280, 260);
    ctx.strokeRect(1040, 80, 280, 260);
    ctx.strokeRect(740, 380, 280, 260);
    ctx.strokeRect(1040, 380, 280, 260);
    return toTexture(c);
  });
}

export function radialGlowTexture() {
  return cached("glow", () => {
    const c = canvas(128, 128);
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,0.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return toTexture(c);
  });
}
