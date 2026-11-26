/**
 * FNIRSI-1014D style oscilloscope screen, rendered to a 2D canvas.
 * The input is the simulator's sampled node voltages — the trigger, coupling,
 * scaling and all measurements are computed here exactly like a DSO would.
 */
import type { ScopeSettings } from "@/store/bench";
import type { SimResult } from "@/sim/types";
import { measure, fmtEng, type Measurement } from "@/sim/measure";

export const SCREEN_W = 1024;
export const SCREEN_H = 600;
export const PLOT = { x: 18, y: 58, w: 880, h: 456 };
export const DIV_X = 12;
export const DIV_Y = 8;
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

function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = "#fff", align: CanvasTextAlign = "left", bold = false) {
  ctx.fillStyle = color;
  ctx.font = `${bold ? "bold " : ""}${size}px "Segoe UI", Tahoma, Arial, sans-serif`;
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
  ctx.save();
  ctx.fillStyle = "#03050c";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  if (!o.on) {
    ctx.restore();
    return;
  }
  // ---------------- header ----------------
  box(ctx, 6, 6, 112, 42, "#1a58c4");
  // menu icon
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) ctx.fillRect(16 + i * 11, 15 + j * 11, 9, 9);
  label(ctx, "MENU", 44, 28, 24, "#fff", "left");
  label(ctx, s.run ? "RUN" : "STOP", 136, 28, 24, s.run ? "#fff" : "#ff5050");
  const chHdr = (i: number, x: number) => {
    const c = s.ch[i];
    box(ctx, x, 10, 44, 34, c.on ? CH_COLORS[i] : "#555", 3);
    label(ctx, `CH${i + 1}`, x + 22, 27, 17, "#111", "center", true);
    label(ctx, `${c.coupling} ${c.probe}X`, x + 52, 18, 18);
    label(ctx, fmtVdiv(c.vdiv), x + 52, 38, 18);
  };
  chHdr(0, 222);
  chHdr(1, 402);
  label(ctx, fmtTdiv(s.tdiv), 584, 28, 21);
  box(ctx, 718, 8, 64, 38, "#3b2f96");
  label(ctx, "move", 750, 19, 15, "#fff", "center");
  label(ctx, "slow", 750, 36, 15, "#fff", "center");
  box(ctx, 796, 8, 34, 38, "#21c421", 3);
  label(ctx, "T", 813, 27, 18, "#111", "center", true);
  label(ctx, s.trig.mode === "auto" ? "Auto" : s.trig.mode === "normal" ? "Norm" : "Single", 838, 18, 16);
  box(ctx, 838, 30, 34, 15, CH_COLORS[s.trig.src], 2);
  label(ctx, `CH${s.trig.src + 1}`, 855, 38, 11, "#111", "center", true);
  label(ctx, s.trig.edge === "rise" ? "ƒ" : "ʇ", 880, 37, 18);
  // battery
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(944, 14, 34, 16);
  ctx.fillStyle = "#3ee04a";
  ctx.fillRect(947, 17, 26, 10);
  ctx.fillStyle = "#fff";
  ctx.fillRect(978, 18, 4, 8);

  // ---------------- grid ----------------
  const { x: px, y: py, w: pw, h: ph } = PLOT;
  const dx = pw / DIV_X,
    dy = ph / DIV_Y;
  ctx.fillStyle = "#04060e";
  ctx.fillRect(px, py, pw, ph);
  ctx.fillStyle = "rgba(150,155,170,0.55)";
  for (let i = 0; i <= DIV_X; i++) {
    for (let y = py; y <= py + ph; y += dy / 5) ctx.fillRect(px + i * dx - 0.8, y - 0.8, 1.6, 1.6);
  }
  for (let j = 0; j <= DIV_Y; j++) {
    for (let x = px; x <= px + pw; x += dx / 5) ctx.fillRect(x - 0.8, py + j * dy - 0.8, 1.6, 1.6);
  }
  ctx.strokeStyle = "rgba(170,175,190,0.6)";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(px + pw / 2, py);
  ctx.lineTo(px + pw / 2, py + ph);
  ctx.moveTo(px, py + ph / 2);
  ctx.lineTo(px + pw, py + ph / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(170,175,190,0.75)";
  for (let k = 0; k <= DIV_X * 5; k++) {
    const x = px + (k * dx) / 5;
    ctx.beginPath();
    ctx.moveTo(x, py + ph / 2 - 4);
    ctx.lineTo(x, py + ph / 2 + 4);
    ctx.stroke();
  }
  for (let k = 0; k <= DIV_Y * 5; k++) {
    const y = py + (k * dy) / 5;
    ctx.beginPath();
    ctx.moveTo(px + pw / 2 - 4, y);
    ctx.lineTo(px + pw / 2 + 4, y);
    ctx.stroke();
  }

  // ---------------- waveforms ----------------
  const W = s.tdiv * DIV_X;
  const t0 = -W / 2 + s.hpos * s.tdiv;
  const tx = (t: number) => px + ((t - t0) / W) * pw;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  noiseSeed = 1 + Math.floor(o.time * 30) % 1000;
  for (let i = 1; i >= 0; i--) {
    const c = s.ch[i];
    const v = frame.v[i];
    if (!c.on) continue;
    const vy = (val: number) => py + ph / 2 - (val / c.vdiv + c.pos) * dy;
    ctx.strokeStyle = CH_COLORS[i];
    ctx.lineWidth = 2.6;
    ctx.shadowColor = CH_COLORS[i];
    ctx.shadowBlur = 6;
    ctx.beginPath();
    const tArr = frame.t;
    const noiseAmp = 0.035 * dy;
    if (!v || !tArr || tArr.length < 2) {
      // no signal: flat trace at 0 V with noise
      for (let x = px; x <= px + pw; x += 3) {
        const y = vy(0) + rnd() * noiseAmp;
        if (x === px) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else {
      const n = tArr.length;
      const perPx = n / pw;
      if (perPx > 2) {
        // min/max decimation per pixel column
        let k = 0;
        for (let x = 0; x < pw; x++) {
          let mn = Infinity,
            mx = -Infinity;
          const tEnd = t0 + ((x + 1) / pw) * W;
          while (k < n && tArr[k] < tEnd) {
            if (v[k] < mn) mn = v[k];
            if (v[k] > mx) mx = v[k];
            k++;
          }
          if (mn === Infinity) continue;
          const y1 = vy(mx) + rnd() * noiseAmp,
            y2 = vy(mn) + rnd() * noiseAmp;
          if (x === 0) ctx.moveTo(px + x, y1);
          else ctx.lineTo(px + x, y1);
          ctx.lineTo(px + x, y2);
        }
      } else {
        for (let k = 0; k < n; k++) {
          const x = tx(tArr[k]);
          const y = vy(v[k]) + rnd() * noiseAmp;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  // channel ground markers
  for (let i = 0; i < 2; i++) {
    const c = s.ch[i];
    if (!c.on) continue;
    const y = Math.min(Math.max(py + ph / 2 - c.pos * dy, py + 8), py + ph - 8);
    ctx.fillStyle = CH_COLORS[i];
    ctx.beginPath();
    ctx.moveTo(px - 2, y - 9);
    ctx.lineTo(px + 12, y - 9);
    ctx.lineTo(px + 20, y);
    ctx.lineTo(px + 12, y + 9);
    ctx.lineTo(px - 2, y + 9);
    ctx.closePath();
    ctx.fill();
    label(ctx, `${i + 1}`, px + 7, y + 1, 14, "#111", "center", true);
  }
  // trigger level marker (right) and position marker (top)
  {
    const c = s.ch[s.trig.src];
    const y = Math.min(Math.max(py + ph / 2 - (s.trig.level / c.vdiv + c.pos) * dy, py + 8), py + ph - 8);
    ctx.fillStyle = "#21c421";
    ctx.beginPath();
    ctx.moveTo(px + pw + 2, y - 9);
    ctx.lineTo(px + pw - 12, y - 9);
    ctx.lineTo(px + pw - 20, y);
    ctx.lineTo(px + pw - 12, y + 9);
    ctx.lineTo(px + pw + 2, y + 9);
    ctx.closePath();
    ctx.fill();
    label(ctx, "T", px + pw - 7, y + 1, 13, "#111", "center", true);
    const tx0 = Math.min(Math.max(px + pw / 2 - s.hpos * dx, px + 10), px + pw - 10);
    ctx.beginPath();
    ctx.moveTo(tx0 - 9, py - 12);
    ctx.lineTo(tx0 + 9, py - 12);
    ctx.lineTo(tx0 + 9, py - 4);
    ctx.lineTo(tx0, py + 4);
    ctx.lineTo(tx0 - 9, py - 4);
    ctx.closePath();
    ctx.fill();
  }

  // cursors
  if (s.cursors !== "off") {
    ctx.strokeStyle = s.cursors === "t" ? "#35e035" : "#f08a2a";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
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
      info = [`T = ${fmtEng(dt, "S")}`, `F = ${dt > 0 ? fmtEng(1 / dt, "Hz") : "----"}`];
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
    ctx.setLineDash([]);
    box(ctx, px + 6, py + 6, 150, 56, "rgba(40,46,60,0.85)", 3);
    label(ctx, info[0], px + 14, py + 21, 19);
    label(ctx, info[1], px + 14, py + 46, 19);
  }

  if (!frame.triggered && frame.t && s.trig.mode !== "auto") {
    label(ctx, "Trig'd ?", px + pw - 110, py + 20, 18, "#ff6060");
  }
  if (o.busy) label(ctx, "◷", px + pw - 18, py + ph - 18, 18, "rgba(255,255,255,0.45)", "center");

  // ---------------- right soft keys ----------------
  for (let k = 0; k < SOFT_KEYS.length; k++) {
    const y = 58 + k * 57;
    box(ctx, 906, y, 112, 52, o.highlightKey === k ? "#3d4a66" : "#1d2231", 4);
    ctx.strokeStyle = "#3a4256";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(906, y, 112, 52, 4);
    ctx.stroke();
    const parts = SOFT_KEYS[k].split("\n");
    if (parts.length === 1) label(ctx, parts[0], 962, y + 26, 19, "#e8ecf5", "center", true);
    else {
      label(ctx, parts[0], 962, y + 16, 17, "#e8ecf5", "center", true);
      label(ctx, parts[1], 962, y + 36, 17, "#e8ecf5", "center", true);
    }
  }

  // ---------------- bottom measurements ----------------
  const mbox = (x: number, ch: number, txt: string) => {
    box(ctx, x, 528, 218, 34, "#1e3a66", 3);
    box(ctx, x + 4, 533, 24, 24, CH_COLORS[ch], 2);
    label(ctx, `${ch + 1}`, x + 16, 546, 16, "#111", "center", true);
    label(ctx, txt, x + 38, 546, 19, "#e9eefc");
  };
  const m2 = frame.meas[1],
    m1 = frame.meas[0];
  const vpp = (m: Measurement | null, on: boolean) => (on && m ? fmtV(m.vpp) : "----");
  const fq = (m: Measurement | null, on: boolean) => (on && m && m.freq > 0 ? fmtEng(m.freq, "Hz") : "----");
  mbox(4, 1, `VPP : ${vpp(m2, s.ch[1].on)}`);
  mbox(226, 1, `Freq : ${fq(m2, s.ch[1].on)}`);
  mbox(448, 0, `VPP : ${vpp(m1, s.ch[0].on)}`);
  mbox(670, 0, `Freq : ${fq(m1, s.ch[0].on)}`);

  if (o.showMeasureTable) {
    box(ctx, px + pw - 330, py + 70, 320, 300, "rgba(20,26,40,0.92)", 6);
    const rows: [string, (m: Measurement) => string][] = [
      ["Vmax", (m) => fmtV(m.max)],
      ["Vmin", (m) => fmtV(m.min)],
      ["Vpp", (m) => fmtV(m.vpp)],
      ["Vavg", (m) => fmtV(m.mean)],
      ["Vrms", (m) => fmtV(m.rms)],
      ["Freq", (m) => (m.freq > 0 ? fmtEng(m.freq, "Hz") : "----")],
      ["Period", (m) => (m.period > 0 ? fmtEng(m.period, "S") : "----")],
    ];
    label(ctx, "CH1", px + pw - 180, py + 92, 18, CH_COLORS[0], "center", true);
    label(ctx, "CH2", px + pw - 70, py + 92, 18, CH_COLORS[1], "center", true);
    rows.forEach(([name, f], i) => {
      const y = py + 128 + i * 34;
      label(ctx, name, px + pw - 316, y, 18, "#cfd6e6");
      label(ctx, m1 && s.ch[0].on ? f(m1) : "----", px + pw - 180, y, 18, "#fff", "center");
      label(ctx, m2 && s.ch[1].on ? f(m2) : "----", px + pw - 70, y, 18, "#fff", "center");
    });
  }
  ctx.restore();
}
