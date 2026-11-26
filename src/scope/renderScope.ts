/**
 * FNIRSI-1013D oscilloscope screen (7" 800 x 480 IPS), rendered to a 2D canvas.
 * Layout measured from a photograph of the lab's unit: 14 x 8 division
 * graticule of 50 px divisions, header bar, 8 soft keys, 4 measurement boxes.
 * The input is the simulator's sampled node voltages — the trigger, coupling,
 * scaling and all measurements are computed here exactly like a DSO would.
 */
import type { ScopeSettings } from "@/store/bench";
import type { SimResult } from "@/sim/types";
import { measure, fmtEng, type Measurement } from "@/sim/measure";

/** native panel resolution — all layout and touch coordinates use these pixels;
 *  the canvas may be larger (it is drawn scaled for crisp text) */
export const SCREEN_W = 800;
export const SCREEN_H = 480;
export const PLOT = { x: 6, y: 46, w: 700, h: 400 };
export const DIV_X = 14;
export const DIV_Y = 8;
/** soft-key column */
export const KEYS = { x: 714, y: 50, w: 82, h: 46, pitch: 50 };
export const SOFT_KEYS = ["CTRL", "RUN/\nSTOP", "AUTO\nSET", "T CU\nRSOR", "V CU\nRSOR", "MEAS\nURE", "SAVE\nPIC", "SAVE\nWAVE"];

export const CH_COLORS = ["#f7e521", "#22c3f0"];

export interface ScopeFrame {
  /** per channel: displayed sample times (s, relative to trigger) and volts */
  t: Float64Array | null;
  v: [Float64Array | null, Float64Array | null];
  triggered: boolean;
  meas: [Measurement | null, Measurement | null];
}

/** Apply coupling and trigger; returns the window to display. */
export function acquire(s: ScopeSettings, res: SimResult | null): ScopeFrame {
  const empty: ScopeFrame = { t: null, v: [null, null], triggered: false, meas: [null, null] };
  if (!res || !res.ok || res.t.length < 2) return empty;
  const T = res.t;
  const n = T.length;
  const raw: (Float64Array | null)[] = [res.data.ch1 ?? null, res.data.ch2 ?? null];
  const coupled = raw.map((d, i) => {
    if (!d) return null;
    const c = s.ch[i].coupling;
    if (c === "GND") return new Float64Array(d.length);
    if (c === "AC") {
      const m = measure(T, d);
      const o = new Float64Array(d.length);
      for (let k = 0; k < d.length; k++) o[k] = d[k] - m.mean;
      return o;
    }
    return d;
  }) as [Float64Array | null, Float64Array | null];

  const W = s.tdiv * DIV_X;
  const span = T[n - 1] - T[0];
  // trigger search (needs W/2 of pre-trigger data)
  const src = coupled[s.trig.src] ?? coupled[0];
  let trigT = T[0] + Math.min(W / 2, span / 2);
  let triggered = false;
  if (src) {
    const lvl = s.trig.level;
    const start = T[0] + Math.min(W / 2, span * 0.4);
    const lastOk = W < span ? T[n - 1] - W / 2 : T[n - 1];
    for (let k = 1; k < n; k++) {
      if (T[k] < start) continue;
      if (T[k] > lastOk) break;
      const a = src[k - 1],
        b = src[k];
      const rise = a < lvl && b >= lvl;
      const fall = a > lvl && b <= lvl;
      if ((s.trig.edge === "rise" && rise) || (s.trig.edge === "fall" && fall)) {
        const f = (lvl - a) / (b - a || 1);
        trigT = T[k - 1] + f * (T[k] - T[k - 1]);
        triggered = true;
        break;
      }
    }
  }
  const t0 = trigT - W / 2 + s.hpos * s.tdiv;
  const t1 = t0 + W;
  // slice
  let i0 = 0,
    i1 = n - 1;
  while (i0 < n - 1 && T[i0 + 1] < t0) i0++;
  while (i1 > 0 && T[i1 - 1] > t1) i1--;
  const len = Math.max(0, i1 - i0 + 1);
  const tt = new Float64Array(len);
  for (let k = 0; k < len; k++) tt[k] = T[i0 + k] - trigT;
  const vv = coupled.map((d) => (d ? d.slice(i0, i0 + len) : null)) as [Float64Array | null, Float64Array | null];
  // measurements are taken over the whole acquired record (like the scope's memory)
  const meas = coupled.map((d) => (d ? measure(T, d) : null)) as [Measurement | null, Measurement | null];
  return { t: tt, v: vv, triggered, meas };
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, r = 4) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** the firmware uses a small bitmap-like face; a condensed sans reads closest */
function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = "#fff", align: CanvasTextAlign = "left", bold = false, mono = false) {
  ctx.fillStyle = color;
  ctx.font = mono
    ? `${bold ? "bold " : ""}${size}px "DejaVu Sans Mono", Consolas, "Lucida Console", monospace`
    : `${bold ? "bold " : ""}${size}px "DejaVu Sans", Verdana, Tahoma, Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}

function fmtV(v: number) {
  return fmtEng(v, "V").replace("KV", "kV");
}
function fmtVdiv(v: number) {
  return v >= 1 ? `${v}V/div` : `${Math.round(v * 1000)}mV/div`;
}
function fmtTdiv(t: number) {
  if (t >= 1e-3) return `${+(t * 1e3).toFixed(3)}mS/div`;
  return `${+(t * 1e6).toFixed(3)}uS/div`;
}

let noiseSeed = 1;
function rnd() {
  noiseSeed = (noiseSeed * 16807) % 2147483647;
  return noiseSeed / 2147483647 - 0.5;
}

export interface RenderOpts {
  frame: ScopeFrame;
  s: ScopeSettings;
  /** true when the instrument is switched on */
  on: boolean;
  busy?: boolean;
  time: number;
  showMeasureTable?: boolean;
  highlightKey?: number | null;
}

export function renderScope(ctx: CanvasRenderingContext2D, o: RenderOpts) {
  const { s, frame } = o;
  const k = ctx.canvas.width / SCREEN_W;
  ctx.save();
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  if (!o.on) {
    ctx.restore();
    return;
  }
  // ---------------- header ----------------
  box(ctx, 4, 4, 76, 36, "#1f5bd2", 3);
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) ctx.fillRect(10 + i * 9, 12 + j * 9, 7.5, 7.5);
  label(ctx, "MENU", 30, 23, 16, "#fff", "left", true);
  label(ctx, s.run ? "RUN" : "STOP", 102, 23, 16, s.run ? "#fff" : "#ff4a4a", "left", true);
  const chHdr = (i: number, x: number) => {
    const c = s.ch[i];
    box(ctx, x, 7, 26, 30, c.on ? CH_COLORS[i] : "#4b4b4b", 1.5);
    label(ctx, `CH${i + 1}`, x + 13, 23, 9.5, "#1a1a1a", "center", false, true);
    label(ctx, `${c.coupling}  ${c.probe}X`, x + 32, 14, 13, "#f2f2f2", "left", false, true);
    label(ctx, fmtVdiv(c.vdiv), x + 32, 31, 13, "#f2f2f2", "left", false, true);
  };
  chHdr(0, 150);
  chHdr(1, 290);
  label(ctx, fmtTdiv(s.tdiv), 430, 23, 14, "#f2f2f2", "left", false, true);
  box(ctx, 525, 4, 50, 36, "#4a3fb0", 2);
  label(ctx, "move", 550, 14.5, 13, "#fff", "center", false, true);
  label(ctx, "slow", 550, 30, 13, "#fff", "center", false, true);
  box(ctx, 590, 7, 22, 30, "#26c826", 1.5);
  label(ctx, "T", 601, 23, 13, "#132813", "center", false, true);
  label(ctx, s.trig.mode === "auto" ? "Auto" : s.trig.mode === "normal" ? "Norm" : "Single", 618, 13, 11, "#f2f2f2", "left", false, true);
  box(ctx, 618, 22, 26, 13, CH_COLORS[s.trig.src], 1);
  label(ctx, `CH${s.trig.src + 1}`, 631, 28.5, 9, "#1a1a1a", "center", false, true);
  label(ctx, s.trig.edge === "rise" ? "ƒ" : "ʇ", 652, 29, 14, "#f2f2f2", "center");
  // battery (charging from the USB-C lead)
  ctx.fillStyle = "#e9e9e9";
  ctx.fillRect(758, 10, 28, 13);
  ctx.fillRect(786, 13.5, 2.5, 6);
  ctx.fillStyle = "#000";
  ctx.fillRect(759.5, 11.5, 25, 10);
  ctx.fillStyle = "#38d640";
  ctx.fillRect(761, 13, 9 + (Math.floor(o.time * 1.2) % 3) * 6.5, 7);

  // ---------------- graticule ----------------
  const { x: px, y: py, w: pw, h: ph } = PLOT;
  const dx = pw / DIV_X,
    dy = ph / DIV_Y;
  ctx.fillStyle = "#000";
  ctx.fillRect(px, py, pw, ph);
  // dotted division lines (one dot every 5 px)
  ctx.fillStyle = "rgba(150,152,160,0.62)";
  for (let i = 1; i < DIV_X; i++) {
    const x = Math.round(px + i * dx);
    for (let y = py; y <= py + ph; y += 5) ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
  }
  for (let j = 1; j < DIV_Y; j++) {
    const y = Math.round(py + j * dy);
    for (let x = px; x <= px + pw; x += 5) ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
  }
  // frame
  ctx.strokeStyle = "rgba(170,172,180,0.8)";
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  // centre axes with 1/5 division ticks
  ctx.fillStyle = "rgba(185,188,196,0.85)";
  for (let x = px; x <= px + pw; x += dx / 5) ctx.fillRect(Math.round(x) - 0.5, py + ph / 2 - 2.5, 1, 5);
  for (let y = py; y <= py + ph; y += dy / 5) ctx.fillRect(px + pw / 2 - 2.5, Math.round(y) - 0.5, 5, 1);

  // ---------------- waveforms ----------------
  const W = s.tdiv * DIV_X;
  const t0 = -W / 2 + s.hpos * s.tdiv;
  const tx = (t: number) => px + ((t - t0) / W) * pw;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  noiseSeed = 1 + (Math.floor(o.time * 30) % 1000);
  for (let i = 1; i >= 0; i--) {
    const c = s.ch[i];
    const v = frame.v[i];
    if (!c.on) continue;
    const vy = (val: number) => py + ph / 2 - (val / c.vdiv + c.pos) * dy;
    ctx.strokeStyle = CH_COLORS[i];
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.shadowColor = CH_COLORS[i];
    ctx.shadowBlur = 3 * k;
    ctx.beginPath();
    const tArr = frame.t;
    const noiseAmp = 0.03 * dy;
    if (!v || !tArr || tArr.length < 2) {
      // no signal: flat trace at 0 V with noise
      for (let x = px; x <= px + pw; x += 2) {
        const y = vy(0) + rnd() * noiseAmp;
        if (x === px) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else {
      const n = tArr.length;
      const perPx = n / pw;
      if (perPx > 2) {
        // min/max decimation per pixel column
        let q = 0;
        for (let x = 0; x < pw; x++) {
          let mn = Infinity,
            mx = -Infinity;
          const tEnd = t0 + ((x + 1) / pw) * W;
          while (q < n && tArr[q] < tEnd) {
            if (v[q] < mn) mn = v[q];
            if (v[q] > mx) mx = v[q];
            q++;
          }
          if (mn === Infinity) continue;
          const y1 = vy(mx) + rnd() * noiseAmp,
            y2 = vy(mn) + rnd() * noiseAmp;
          if (x === 0) ctx.moveTo(px + x, y1);
          else ctx.lineTo(px + x, y1);
          ctx.lineTo(px + x, y2);
        }
      } else {
        for (let q = 0; q < n; q++) {
          const x = tx(tArr[q]);
          const y = vy(v[q]) + rnd() * noiseAmp;
          if (q === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  // channel ground markers (left edge)
  for (let i = 0; i < 2; i++) {
    const c = s.ch[i];
    if (!c.on) continue;
    const y = Math.min(Math.max(py + ph / 2 - c.pos * dy, py + 7), py + ph - 7);
    box(ctx, px, y - 6.5, 13, 13, CH_COLORS[i], 1);
    label(ctx, `${i + 1}`, px + 6.5, y + 0.5, 10, "#111", "center", true, true);
  }
  // trigger level marker (right edge) and trigger position marker (top)
  {
    const c = s.ch[s.trig.src];
    const y = Math.min(Math.max(py + ph / 2 - (s.trig.level / c.vdiv + c.pos) * dy, py + 7), py + ph - 7);
    box(ctx, px + pw - 13, y - 6.5, 13, 13, "#26c826", 1);
    label(ctx, "T", px + pw - 6.5, y + 0.5, 10, "#132813", "center", true, true);
    const tx0 = Math.min(Math.max(px + pw / 2 - s.hpos * dx, px + 8), px + pw - 8);
    ctx.fillStyle = "#26c826";
    ctx.beginPath();
    ctx.moveTo(tx0 - 7, py + 1);
    ctx.lineTo(tx0 + 7, py + 1);
    ctx.lineTo(tx0 + 7, py + 9);
    ctx.lineTo(tx0, py + 15);
    ctx.lineTo(tx0 - 7, py + 9);
    ctx.closePath();
    ctx.fill();
  }

  // cursors
  if (s.cursors !== "off") {
    ctx.strokeStyle = s.cursors === "t" ? "#2fd84a" : "#f08a2a";
    ctx.lineWidth = 1.2;
    let info: string[] = [];
    if (s.cursors === "t") {
      const xa = px + pw / 2 + s.cur.t1 * dx,
        xb = px + pw / 2 + s.cur.t2 * dx;
      for (const x of [xa, xb]) {
        ctx.beginPath();
        ctx.moveTo(x, py);
        ctx.lineTo(x, py + ph);
        ctx.stroke();
      }
      const dt = Math.abs(s.cur.t2 - s.cur.t1) * s.tdiv;
      info = [`T = ${fmtEng(dt, "S").replace("mS", "mS")}`, `F = ${dt > 0 ? fmtEng(1 / dt, "Hz") : "----"}`];
    } else {
      const ya = py + ph / 2 - s.cur.v1 * dy,
        yb = py + ph / 2 - s.cur.v2 * dy;
      for (const y of [ya, yb]) {
        ctx.beginPath();
        ctx.moveTo(px, y);
        ctx.lineTo(px + pw, y);
        ctx.stroke();
      }
      const c = s.ch[0];
      info = [`ΔV = ${fmtV(Math.abs(s.cur.v1 - s.cur.v2) * c.vdiv)}`, `V1 = ${fmtV((s.cur.v1 - c.pos) * c.vdiv)}`];
    }
    box(ctx, px + 3, py + 3, 122, 40, "rgba(92,96,108,0.88)", 2);
    label(ctx, info[0], px + 9, py + 14, 13, "#f4f4f4", "left", false, true);
    label(ctx, info[1], px + 9, py + 32, 13, "#f4f4f4", "left", false, true);
  }

  if (!frame.triggered && frame.t && s.trig.mode !== "auto") {
    label(ctx, "Trig'd ?", px + pw - 80, py + 16, 13, "#ff6060", "left", false, true);
  }
  if (o.busy) label(ctx, "◷", px + pw - 26, py + ph - 14, 13, "rgba(255,255,255,0.45)", "center");

  // ---------------- right soft keys ----------------
  for (let q = 0; q < SOFT_KEYS.length; q++) {
    const y = KEYS.y + q * KEYS.pitch;
    box(ctx, KEYS.x, y, KEYS.w, KEYS.h, o.highlightKey === q ? "#7d8394" : "#52565f", 3);
    const parts = SOFT_KEYS[q].split("\n");
    if (parts.length === 1) label(ctx, parts[0], KEYS.x + KEYS.w / 2, y + KEYS.h / 2, 14, "#f6f6f6", "center", true);
    else {
      label(ctx, parts[0], KEYS.x + KEYS.w / 2, y + 15, 13, "#f6f6f6", "center", true);
      label(ctx, parts[1], KEYS.x + KEYS.w / 2, y + 32, 13, "#f6f6f6", "center", true);
    }
  }

  // ---------------- bottom measurements ----------------
  const mbox = (x: number, ch: number, txt: string) => {
    box(ctx, x, 450, 170, 26, "#2b3a5c", 2);
    box(ctx, x + 4, 454, 18, 18, CH_COLORS[ch], 1);
    label(ctx, `${ch + 1}`, x + 13, 463.5, 12, "#1a1a1a", "center", false, true);
    label(ctx, txt, x + 32, 463.5, 13, "#e6ebf7", "left", false, true);
  };
  const m2 = frame.meas[1],
    m1 = frame.meas[0];
  const vpp = (m: Measurement | null, on: boolean) => (on && m ? fmtV(m.vpp) : "----");
  const fq = (m: Measurement | null, on: boolean) => (on && m && m.freq > 0 ? fmtEng(m.freq, "Hz").replace("kHz", "KHz") : "----");
  mbox(6, 1, `VPP : ${vpp(m2, s.ch[1].on)}`);
  mbox(180, 1, `Freq : ${fq(m2, s.ch[1].on)}`);
  mbox(354, 0, `VPP : ${vpp(m1, s.ch[0].on)}`);
  mbox(528, 0, `Freq : ${fq(m1, s.ch[0].on)}`);

  if (o.showMeasureTable) {
    box(ctx, px + pw - 262, py + 52, 254, 236, "rgba(24,30,44,0.94)", 4);
    const rows: [string, (m: Measurement) => string][] = [
      ["Vmax", (m) => fmtV(m.max)],
      ["Vmin", (m) => fmtV(m.min)],
      ["Vpp", (m) => fmtV(m.vpp)],
      ["Vavg", (m) => fmtV(m.mean)],
      ["Vrms", (m) => fmtV(m.rms)],
      ["Freq", (m) => (m.freq > 0 ? fmtEng(m.freq, "Hz") : "----")],
      ["Period", (m) => (m.period > 0 ? fmtEng(m.period, "S") : "----")],
    ];
    label(ctx, "CH1", px + pw - 136, py + 70, 13, CH_COLORS[0], "center", true, true);
    label(ctx, "CH2", px + pw - 52, py + 70, 13, CH_COLORS[1], "center", true, true);
    rows.forEach(([name, f], i) => {
      const y = py + 98 + i * 26;
      label(ctx, name, px + pw - 252, y, 13, "#cfd6e6", "left", false, true);
      label(ctx, m1 && s.ch[0].on ? f(m1) : "----", px + pw - 136, y, 13, "#fff", "center", false, true);
      label(ctx, m2 && s.ch[1].on ? f(m2) : "----", px + pw - 52, y, 13, "#fff", "center", false, true);
    });
  }
  ctx.restore();
}
