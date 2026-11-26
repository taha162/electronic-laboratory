"use client";
import * as THREE from "three";
import {
  AC_BOX,
  BORDER,
  DC_BOX,
  DVM_BOX,
  FG_BOX,
  METER_BOXES,
  MODULE_SLOT,
  SPEAKER_BOX,
  TRAINER_H,
  TRAINER_JACKS,
  TRAINER_KNOBS,
  TRAINER_METERS,
  TRAINER_W,
  VR_BOXES,
  VR_LABELS,
} from "@/lab/trainer";
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
/* ageing / wear                                                   */
/* -------------------------------------------------------------- */
function srand(seed: number) {
  let x = seed;
  return () => {
    x = (x * 16807) % 2147483647;
    return x / 2147483647;
  };
}

/** years of use: yellowed edges, grime around touched spots, fine scratches */
export function ageSurface(ctx: CanvasRenderingContext2D, W: number, H: number, touched: [number, number, number][], seed = 7) {
  const r = srand(seed);
  ctx.save();
  // UV yellowing (stronger near the edges)
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, "rgba(200,170,90,0)");
  g.addColorStop(1, "rgba(190,155,70,0.16)");
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // grime where fingers go
  ctx.globalCompositeOperation = "source-over";
  for (const [x, y, rad] of touched) {
    const gg = ctx.createRadialGradient(x, y, rad * 0.3, x, y, rad);
    gg.addColorStop(0, "rgba(70,58,40,0.10)");
    gg.addColorStop(1, "rgba(70,58,40,0)");
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  // fingerprints / smudges
  for (let k = 0; k < 40; k++) {
    const x = r() * W,
      y = r() * H,
      rad = 3 + r() * 7;
    ctx.strokeStyle = `rgba(90,80,60,${0.02 + r() * 0.03})`;
    ctx.lineWidth = 0.25;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(x, y, rad - i * 0.5, (rad - i * 0.5) * 0.7, r(), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // scratches
  for (let k = 0; k < 70; k++) {
    const x = r() * W,
      y = r() * H,
      L = 4 + r() * 24,
      a = r() * Math.PI;
    ctx.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.1 + r() * 0.2})` : `rgba(60,50,40,${0.05 + r() * 0.08})`;
    ctx.lineWidth = 0.15 + r() * 0.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + r() * 2, y + Math.sin(a) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L);
    ctx.stroke();
  }
  ctx.restore();
}

/** hand-written ballpoint / marker note */
export function handNote(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, rot = -0.05) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.8;
  ctx.font = `${size}px "Segoe Print", "Bradley Hand", "Comic Sans MS", "Ink Free", cursive`;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0);
  ctx.restore();
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
  if (!bold) {
    // screen-printed legends are a little heavier than regular Arial
    const lw = ctx.lineWidth,
      ss = ctx.strokeStyle;
    ctx.lineWidth = size * 0.05;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineJoin = "round";
    ctx.strokeText(s, x, y);
    ctx.lineWidth = lw;
    ctx.strokeStyle = ss;
  }
}

export function trainerPanelTexture() {
  return cached("trainer-panel", () => {
    const S = 4; // px per mm
    const c = canvas(TRAINER_W * S, TRAINER_H * S);
    const ctx = c.getContext("2d")!;
    ctx.scale(S, S);
    // light grey printed aluminium panel (as photographed), faint grain
    ctx.fillStyle = "#e3e4e0";
    ctx.fillRect(0, 0, TRAINER_W, TRAINER_H);
    for (let i = 0; i < 14000; i++) {
      ctx.fillStyle = `rgba(70,72,80,${Math.random() * 0.025})`;
      ctx.fillRect(Math.random() * TRAINER_W, Math.random() * TRAINER_H, 0.45, 0.45);
    }
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    // thick black border line
    ctx.lineWidth = 1.5;
    rrect(ctx, BORDER.x, BORDER.y, BORDER.w, BORDER.h, 5);
    ctx.stroke();

    const box = (r: [number, number, number, number], lw = 0.45, rad = 2.6) => {
      ctx.lineWidth = lw;
      rrect(ctx, r[0], r[1], r[2], r[3], rad);
      ctx.stroke();
    };
    /** section with a title band separated by a rule (right column style) */
    const titled = (r: [number, number, number, number], title: string, band = 9) => {
      box(r);
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      ctx.moveTo(r[0], r[1] + band);
      ctx.lineTo(r[0] + r[2], r[1] + band);
      ctx.stroke();
      text(ctx, title, r[0] + r[2] / 2, r[1] + band / 2 + 0.3, 4.4, "center", false);
    };

    // ---- logo + model name (K&H style badge)
    ctx.lineWidth = 0.55;
    rrect(ctx, 16, 17, 17, 10, 1.6);
    ctx.stroke();
    ctx.save();
    ctx.translate(24.5, 22.4);
    ctx.transform(1, 0, -0.25, 1, 0, 0);
    text(ctx, "K&H", 0, 0, 5.4, "center", true);
    ctx.restore();
    ctx.save();
    ctx.translate(37, 22.6);
    ctx.transform(1, 0, -0.22, 1, 0, 0);
    text(ctx, "KL-21001 LINEAR CIRCUIT LAB", 0, 0, 5.6, "left", false);
    ctx.restore();

    // ---- digital meter section
    box(DVM_BOX);
    text(ctx, "DC VOLTAGE", 48, 104.5, 3.4, "center", false);
    text(ctx, "COM", 92, 104.5, 3.4, "center", false);
    text(ctx, "DC CURRENT", 136, 104.5, 3.4, "center", false);

    // ---- analog meter sections
    TRAINER_METERS.forEach((m, i) => {
      box(METER_BOXES[i]);
      text(ctx, m.title, METER_BOXES[i][0] + METER_BOXES[i][2] / 2, 22.2, 3.9, "center", false);
      // zero-adjust screw hole
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.arc(m.x + m.w / 2, 86, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
    });

    // ---- function generator
    box(FG_BOX);
    box([18, 129, 85, 11], 0.45, 2);
    text(ctx, "FUNCTION GENERATOR", 60.5, 134.8, 4.1, "center", false);
    text(ctx, "OUT/50Ω", 82, 147.5, 3.3, "center", false);

    // ---- right column
    titled(SPEAKER_BOX, "SPEAKER");
    text(ctx, "INPUT", 489, 167, 3.2, "center", false);
    ctx.lineWidth = 0.5;
    ctx.strokeRect(527, 157, 6, 16);
    ctx.beginPath();
    ctx.moveTo(533, 157);
    ctx.lineTo(546, 147);
    ctx.lineTo(546, 183);
    ctx.lineTo(533, 173);
    ctx.stroke();
    titled(AC_BOX, "AC SOURCE");
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 0; i <= 28; i++) {
      const x = 510 + i * 0.5;
      const y = 208 + Math.sin((i / 28) * Math.PI * 2) * 1.8;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(517, 208, 7.6, 3.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    titled(DC_BOX, "DC POWER SUPPLY");
    text(ctx, "FIXED POWER", 517, 260, 3.8, "center", false);
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(474, 265);
    ctx.lineTo(560, 265);
    ctx.stroke();
    // GND bus of the four black sockets
    ctx.beginPath();
    ctx.moveTo(484, 296);
    ctx.lineTo(549, 296);
    ctx.stroke();
    text(ctx, "GND", 517, 304, 3.4, "center", false);
    ctx.beginPath();
    ctx.moveTo(474, 310);
    ctx.lineTo(560, 310);
    ctx.moveTo(474, 322);
    ctx.lineTo(560, 322);
    ctx.stroke();
    text(ctx, "ADJUST POWER", 517, 316.3, 4.1, "center", false);
    text(ctx, "±3V~±18V", 517, 333, 3.8, "center", false);
    text(ctx, "OUTPUT", 517, 344.5, 3.6, "center", false);

    // ---- VR row
    VR_BOXES.forEach((r, i) => {
      box(r);
      const k = `vr${i + 1}`;
      const xs = TRAINER_JACKS.filter((j) => j.id.startsWith(`${k}.`)).map((j) => j.x);
      const lx = (TRAINER_KNOBS.find((kn) => kn.id === k)?.x ?? r[0] + 14) + 17;
      text(ctx, k.toUpperCase(), lx, 389.5, 3.6, "left", false);
      text(ctx, VR_LABELS[k], lx, 395.3, 3.3, "left", false);
      // potentiometer symbol over A B C with the wiper arrow from B
      const [xa, xb, xc] = xs;
      const yz = 397;
      ctx.lineWidth = 0.42;
      ctx.beginPath();
      ctx.moveTo(xa, 409);
      ctx.lineTo(xa, yz);
      ctx.lineTo(xb - 6, yz);
      for (let z = 0; z < 6; z++) ctx.lineTo(xb - 5 + z * 2, z % 2 ? yz + 1.6 : yz - 1.6);
      ctx.lineTo(xb + 6, yz);
      ctx.lineTo(xc, yz);
      ctx.lineTo(xc, 409);
      ctx.moveTo(xb, 409);
      ctx.lineTo(xb, yz + 2.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(xb, yz + 1.6);
      ctx.lineTo(xb - 1.1, yz + 3.6);
      ctx.lineTo(xb + 1.1, yz + 3.6);
      ctx.closePath();
      ctx.fill();
    });

    // ---- socket labels
    for (const j of TRAINER_JACKS) {
      if (!j.label || j.id.startsWith("dvm.")) continue;
      const lp = j.lp ?? "s";
      const off = j.style === "brass" ? 5.4 : 7.4;
      const dx = lp === "e" ? off : lp === "w" ? -off : 0;
      const dy = lp === "n" ? -off + 0.6 : lp === "s" ? off - 0.4 : 0;
      const sz = j.id.startsWith("vr") ? 3.4 : j.label.length > 5 ? 3.1 : 3.5;
      text(ctx, j.label, j.x + dx, j.y + dy, sz, lp === "e" ? "left" : lp === "w" ? "right" : "center", false);
    }

    // ---- knob scales
    for (const kn of TRAINER_KNOBS) {
      ctx.lineWidth = 0.4;
      const R = kn.r + 3.2;
      if (kn.label && !kn.id.startsWith("vr")) text(ctx, kn.label, kn.x, kn.y - kn.r - 6.5, 3.9, "center", false);
      if (kn.id.startsWith("vr")) continue;
      if (kn.detents && kn.marks) {
        for (let i = 0; i < kn.detents; i++) {
          const a = knobAngle(kn.detents, i) - Math.PI / 2;
          text(ctx, kn.marks[i], kn.x + Math.cos(a) * (R + 3.6), kn.y + Math.sin(a) * (R + 3.6), kn.id === "fg.func" ? 4.4 : 3.1, "center", false);
        }
      } else {
        if (kn.minLabel) text(ctx, kn.minLabel, kn.x - R + 1, kn.y + R + 1.8, 3.1, "right", false);
        if (kn.maxLabel) text(ctx, kn.maxLabel, kn.x + R - 1, kn.y + R + 1.8, 3.1, "left", false);
      }
    }
    // small black marks left of FUNCTION and RANGE (as on the unit)
    ctx.fillStyle = "#151515";
    for (const y of [225, 287]) {
      ctx.beginPath();
      ctx.arc(33, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = INK;

    // ---- years of student use
    const touched: [number, number, number][] = [
      ...TRAINER_KNOBS.map((k) => [k.x, k.y, k.r * 2.4] as [number, number, number]),
      ...TRAINER_JACKS.map((j) => [j.x, j.y, j.style === "brass" ? 6 : 8] as [number, number, number]),
      [MODULE_SLOT.x + 20, MODULE_SLOT.y + MODULE_SLOT.h, 26],
    ];
    ageSurface(ctx, TRAINER_W, TRAINER_H, touched, 13);
    // pencil marks students left on the generator column (seen in the photos)
    ctx.strokeStyle = "rgba(60,60,70,0.22)";
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(78, 211);
    ctx.quadraticCurveTo(84, 205, 90, 212);
    ctx.quadraticCurveTo(95, 218, 101, 210);
    ctx.moveTo(80, 273);
    ctx.lineTo(97, 271);
    ctx.stroke();
    return toTexture(c, { aniso: 16 });
  });
}

/** angle (rad) of a knob value, 0 = 12 o'clock, range -135°..+135° */
export function knobAngle(detents: number, v: number) {
  if (detents && detents > 1) {
    const span = detents === 3 ? 100 : 150;
    return ((-span / 2) * Math.PI) / 180 + (v / (detents - 1)) * ((span * Math.PI) / 180);
  }
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
    ageSurface(
      ctx,
      W,
      H,
      m.jacks.filter((j) => !j.hidden).map((j) => [j.x, j.y, 5] as [number, number, number]),
      m.id.length * 31,
    );
    // students' pen notes (like on the real boards)
    if (m.id === "kl23001") {
      handNote(ctx, "Vp=5V", 300, 128, 4.2, "#22348f", -0.06);
      handNote(ctx, "x", 129, 31, 4, "#22348f", 0.2);
      handNote(ctx, "+12", 6, 32, 3.4, "#a01818", -0.1);
    } else if (m.id === "kl23003") {
      handNote(ctx, "VCE=6V", 130, 160, 3.8, "#22348f", -0.04);
    }
    return toTexture(c, { aniso: 16 });
  });
}

/* -------------------------------------------------------------- */
export function meterFaceTexture(full: number, unit: string, ac: boolean) {
  return cached(`meter-${full}-${unit}-${ac}`, () => {
    // 74 x 44 mm dial
    const c = canvas(512, 304);
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 304);
    g.addColorStop(0, "#fbfbf6");
    g.addColorStop(1, "#ecebe4");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 304);
    const cx = 256,
      cy = 344,
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
    // numbered divisions as printed: 0-5-10-15-20 V, 0-5-10-15 V, 0-20-..-100 mA
    const major = full === 30 ? 6 : full === 15 ? 3 : full === 20 ? 4 : full === 100 ? 5 : 10;
    const minor = full === 100 ? 4 : 5;
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
    ctx.fillText(unit, cx, 238);
    ctx.font = "22px Arial";
    ctx.fillText(ac ? "AC ~" : "DC ⎓", cx, 276);
    ctx.font = "bold 20px Arial";
    ctx.fillText("KL", 50, 276);
    ctx.font = "16px Arial";
    ctx.fillText("CLASS 2.5", 452, 276);
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
  /** digit proportions relative to the height (defaults: classic LED digit) */
  shape: { w?: number; t?: number; gap?: number; skew?: number } = {},
) {
  // right-align into `digits` cells
  const chars: { ch: string; dot: boolean }[] = [];
  for (const ch of str) {
    if (ch === "." && chars.length) chars[chars.length - 1].dot = true;
    else chars.push({ ch, dot: false });
  }
  while (chars.length < digits) chars.unshift({ ch: " ", dot: false });
  const w = h * (shape.w ?? 0.55);
  const t = h * (shape.t ?? 0.11);
  const gap = h * (shape.gap ?? 0.22);
  const skew = h * (shape.skew ?? 0.08);
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
    // one 89 mm slat across (u) and 1.84 m along (v): ~1.4 px/mm both ways
    const W = 128,
      H = 2560;
    const c = canvas(W, H);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#e2cc9e";
    ctx.fillRect(0, 0, W, H);
    // lengthwise woven ribs of the fabric
    for (let x = 0; x < W; x += 2) {
      ctx.fillStyle = `rgba(255,248,228,${0.05 + Math.random() * 0.07})`;
      ctx.fillRect(x, 0, 1, H);
    }
    for (let y = 0; y < H; y += 3) {
      ctx.fillStyle = `rgba(120,95,55,${Math.random() * 0.035})`;
      ctx.fillRect(0, y, W, 1);
    }
    // jacquard motif: small wavy dashes in staggered rows (as photographed)
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const dash = (x: number, y: number, len: number, ang: number, col: string, lw: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-len / 2, 0);
      ctx.bezierCurveTo(-len / 6, -len * 0.32, len / 6, len * 0.32, len / 2, 0);
      ctx.stroke();
      ctx.restore();
    };
    for (let row = 0, y = 6; y < H - 20; row++, y += 17 + r() * 6) {
      for (let x = (row % 2) * 16 + 6; x < W + 10; x += 30 + r() * 6) {
        const ang = -0.45 + (r() - 0.5) * 0.5;
        const len = 11 + r() * 9;
        dash(x + (r() - 0.5) * 6, y + (r() - 0.5) * 5, len, ang, `rgba(168,128,62,${0.38 + r() * 0.2})`, 1.5 + r() * 0.6);
        if (r() < 0.45) dash(x + 7 + r() * 4, y + 5 + r() * 3, len * 0.55, ang + 0.2, `rgba(176,136,70,${0.3 + r() * 0.15})`, 1.2);
        // sheen of the brocade thread beside it
        dash(x + 1, y - 1.5, len * 0.8, ang, "rgba(255,250,232,0.22)", 1);
      }
    }
    noise(ctx, W, H, 9000, "80,60,30", 0.07);
    // weighted hem at the bottom
    ctx.fillStyle = "rgba(120,100,70,0.25)";
    ctx.fillRect(0, H - 22, W, 22);
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

/** hazy, over-exposed view out of the window: sky, a university building, date palms */
export function outdoorTexture() {
  return cached("outdoor", () => {
    const W = 2048,
      H = 512;
    const c = canvas(W, H);
    const ctx = c.getContext("2d")!;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#cfe0f2");
    sky.addColorStop(0.55, "#eef2f4");
    sky.addColorStop(1, "#f7f1e6");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const r = srand(91);
    // far buildings (hazy)
    for (let i = 0; i < 14; i++) {
      const x = r() * W,
        w = 120 + r() * 260,
        h = 80 + r() * 140;
      ctx.fillStyle = `rgba(${215 + r() * 20},${205 + r() * 20},${190 + r() * 20},0.55)`;
      ctx.fillRect(x, H - h - 40, w, h + 40);
    }
    // the faculty building across the courtyard
    ctx.fillStyle = "#e6d6bb";
    ctx.fillRect(260, 170, 1240, 342);
    ctx.fillStyle = "#d9c6a6";
    ctx.fillRect(260, 160, 1240, 14);
    for (let fl = 0; fl < 4; fl++)
      for (let k = 0; k < 22; k++) {
        const x = 290 + k * 55,
          y = 200 + fl * 75;
        ctx.fillStyle = "#9fb3c2";
        ctx.fillRect(x, y, 34, 44);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(x + 2, y + 2, 12, 40);
        ctx.fillStyle = "#cdb999";
        ctx.fillRect(x - 3, y + 44, 40, 5);
      }
    // date palms + bushes
    const palm = (x: number, base: number, hgt: number) => {
      ctx.strokeStyle = "#7d6a4f";
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.quadraticCurveTo(x + 12, base - hgt * 0.5, x + 6, base - hgt);
      ctx.stroke();
      ctx.strokeStyle = "#5f7d4a";
      ctx.lineWidth = 6;
      for (let a = 0; a < 11; a++) {
        const ang = -Math.PI + (a / 10) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(x + 6, base - hgt);
        ctx.quadraticCurveTo(x + 6 + Math.cos(ang) * 60, base - hgt - 30 + Math.sin(ang) * 25, x + 6 + Math.cos(ang) * 110, base - hgt + 40);
        ctx.stroke();
      }
    };
    palm(140, 512, 330);
    palm(1640, 512, 360);
    palm(1830, 512, 300);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${80 + r() * 30},${110 + r() * 30},${70 + r() * 20},0.9)`;
      ctx.beginPath();
      ctx.ellipse(r() * W, 470 + r() * 50, 30 + r() * 60, 18 + r() * 30, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // haze
    ctx.fillStyle = "rgba(250,248,240,0.25)";
    ctx.fillRect(0, 0, W, H);
    return toTexture(c);
  });
}

/** Arabic / English lab safety notice */
export function noticeTexture() {
  return cached("notice", () => {
    const W = 600,
      H = 820;
    const c = canvas(W, H);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fbfbf6";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#b3241e";
    ctx.fillRect(0, 0, W, 110);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 46px 'IBM Plex Sans Arabic', Tahoma, Arial";
    ctx.fillText("تعليمات السلامة", W / 2, 70);
    ctx.fillStyle = "#1c1c1c";
    ctx.textAlign = "right";
    ctx.direction = "rtl";
    ctx.font = "28px 'IBM Plex Sans Arabic', Tahoma, Arial";
    const rules = [
      "١. أطفئ الجهاز قبل تغيير التوصيلات",
      "٢. لا تتجاوز الجهد المقرر للقطع",
      "٣. تأكد من قطبية المتسعات الكيميائية",
      "٤. لا تلمس الأطراف المكشوفة",
      "٥. أعد الأسلاك إلى مكانها بعد العمل",
      "٦. يمنع الأكل والشرب داخل المختبر",
    ];
    rules.forEach((t, i) => ctx.fillText(t, W - 40, 180 + i * 62));
    ctx.direction = "ltr";
    ctx.textAlign = "left";
    ctx.font = "italic 22px Arial";
    ctx.fillStyle = "#444";
    ctx.fillText("Electronic Circuits Laboratory", 40, 600);
    ctx.fillText("College of Engineering — University of Mosul", 40, 636);
    ctx.fillStyle = "#b3241e";
    ctx.fillRect(40, 700, W - 80, 6);
    return toTexture(c);
  });
}

/** wall clock face (hands are 3D) */
export function clockFaceTexture() {
  return cached("clock", () => {
    const S = 512;
    const c = canvas(S, S);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fdfdfb";
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 52px Arial";
    for (let h = 1; h <= 12; h++) {
      const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.fillText(String(h), S / 2 + Math.cos(a) * 190, S / 2 + Math.sin(a) * 190);
    }
    for (let m = 0; m < 60; m++) {
      const a = (m / 60) * Math.PI * 2;
      ctx.lineWidth = m % 5 ? 3 : 7;
      ctx.beginPath();
      ctx.moveTo(S / 2 + Math.cos(a) * 236, S / 2 + Math.sin(a) * 236);
      ctx.lineTo(S / 2 + Math.cos(a) * (m % 5 ? 224 : 214), S / 2 + Math.sin(a) * (m % 5 ? 224 : 214));
      ctx.strokeStyle = "#111";
      ctx.stroke();
    }
    ctx.font = "22px Arial";
    ctx.fillText("QUARTZ", S / 2, S / 2 + 90);
    return toTexture(c);
  });
}
