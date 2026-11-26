"use client";
import { create } from "zustand";
import { useBench, SEQ_TDIV, SEQ_VDIV, type ScopeSettings } from "@/store/bench";
import { useSim } from "@/lab/simController";
import { acquire, renderScope, SCREEN_H, SCREEN_W, type ScopeFrame } from "./renderScope";
import type { SimResult } from "@/sim/types";

/** UI-only scope state */
export const useScopeUi = create<{ measure: boolean; key: number | null; toggleMeasure(): void; flash(k: number): void }>((set) => ({
  measure: false,
  key: null,
  toggleMeasure: () => set((s) => ({ measure: !s.measure })),
  flash: (k) => {
    set({ key: k });
    setTimeout(() => set({ key: null }), 180);
  },
}));

let lastRes: SimResult | null = null;
let lastS: ScopeSettings | null = null;
let frame: ScopeFrame = { t: null, v: [null, null], triggered: false, meas: [null, null] };

/** current displayed acquisition (memoised; frozen while STOPped) */
export function getFrame(): ScopeFrame {
  const s = useBench.getState().scope;
  const res = useSim.getState().result;
  if (!s.run && frame.t) {
    if (s !== lastS) {
      // allow re-scaling of a stopped record
      lastS = s;
      frame = acquire(s, lastRes);
    }
    return frame;
  }
  if (res !== lastRes || s !== lastS) {
    lastRes = res;
    lastS = s;
    frame = acquire(s, res);
    if (s.trig.mode === "single" && frame.triggered) useBench.getState().setScope((x) => ({ ...x, run: false }));
  }
  return frame;
}

export function drawScopeTo(ctx: CanvasRenderingContext2D, time: number) {
  const s = useBench.getState().scope;
  const sim = useSim.getState();
  const ui = useScopeUi.getState();
  renderScope(ctx, { frame: getFrame(), s, on: true, busy: sim.busy, time, showMeasureTable: ui.measure, highlightKey: ui.key });
}

function nearest(seq: number[], target: number, roundUp = true) {
  for (const v of seq) if (roundUp ? v >= target : v >= target * 0.999) return v;
  return seq[seq.length - 1];
}

/** AUTO SET: choose V/div, time/div and trigger from the measured signals */
export function autoSet() {
  const st = useBench.getState();
  const sim = useSim.getState();
  const res = sim.result;
  if (!res) return;
  const ms = sim.ch;
  st.setScope((s) => {
    const ch = s.ch.map((c, i) => {
      const m = ms[i];
      if (!m) return c;
      const span = c.coupling === "AC" ? m.vpp : Math.max(Math.abs(m.max), Math.abs(m.min)) * 2;
      const vdiv = nearest(SEQ_VDIV, Math.max(span, 0.02) / 6);
      return { ...c, on: true, vdiv, pos: 0 };
    }) as ScopeSettings["ch"];
    const fs = [ms[0]?.freq ?? 0, ms[1]?.freq ?? 0].filter((f) => f > 0);
    let tdiv = s.tdiv;
    if (fs.length) tdiv = nearest(SEQ_TDIV, 2.5 / Math.min(...fs) / 12);
    const src: 0 | 1 = ms[0] && ms[0].vpp > 1e-3 ? 0 : 1;
    const m = ms[src];
    const level = m ? (ch[src].coupling === "AC" ? 0 : (m.max + m.min) / 2) : 0;
    return { ...s, ch, tdiv, hpos: 0, run: true, trig: { ...s.trig, src, level, mode: "auto" } };
  });
}

export function saveScreenshot() {
  const c = document.createElement("canvas");
  c.width = SCREEN_W;
  c.height = SCREEN_H;
  drawScopeTo(c.getContext("2d")!, performance.now() / 1000);
  const a = document.createElement("a");
  a.href = c.toDataURL("image/png");
  a.download = `FNIRSI_${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
  a.click();
}

export function saveWaveCsv() {
  const f = getFrame();
  if (!f.t) return;
  const rows = ["t_s,ch1_V,ch2_V"];
  for (let i = 0; i < f.t.length; i++) rows.push(`${f.t[i].toExponential(6)},${f.v[0]?.[i]?.toFixed(5) ?? ""},${f.v[1]?.[i]?.toFixed(5) ?? ""}`);
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `FNIRSI_wave_${Date.now()}.csv`;
  a.click();
}

/** handle a touch on the scope screen (screen pixel coordinates) — returns true if consumed */
export function screenTouch(px: number, py: number): boolean {
  const st = useBench.getState();
  const ui = useScopeUi.getState();
  if (px >= 906 && py >= 58 && py < 58 + 8 * 57) {
    const k = Math.floor((py - 58) / 57);
    ui.flash(k);
    switch (k) {
      case 0:
        st.setPanel("scope");
        break;
      case 1:
        st.setScope((s) => ({ ...s, run: !s.run }));
        break;
      case 2:
        autoSet();
        break;
      case 3:
        st.setScope((s) => ({ ...s, cursors: s.cursors === "t" ? "off" : "t" }));
        break;
      case 4:
        st.setScope((s) => ({ ...s, cursors: s.cursors === "v" ? "off" : "v" }));
        break;
      case 5:
        ui.toggleMeasure();
        break;
      case 6:
        saveScreenshot();
        break;
      case 7:
        saveWaveCsv();
        break;
    }
    return true;
  }
  if (py < 50) {
    if (px >= 222 && px < 400) st.setScope((s) => ({ ...s, ch: [{ ...s.ch[0], on: !s.ch[0].on }, s.ch[1]] }));
    else if (px >= 402 && px < 580) st.setScope((s) => ({ ...s, ch: [s.ch[0], { ...s.ch[1], on: !s.ch[1].on }] }));
    else if (px < 120) st.setPanel("scope");
    else if (px >= 120 && px < 210) st.setScope((s) => ({ ...s, run: !s.run }));
    else st.setPanel("scope");
    return true;
  }
  return false;
}
