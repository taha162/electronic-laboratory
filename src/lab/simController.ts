"use client";
import { create } from "zustand";
import { useEffect } from "react";
import type { SimRequest, SimResult } from "@/sim/types";
import { measure, type Measurement } from "@/sim/measure";
import { buildCircuit, planTiming, SOURCE_LIMITS, type BuiltCircuit } from "./netlist";
import { useBench, snapshotOf, type DmmMode } from "@/store/bench";
import { getModule } from "./modules";
import type { PartDef } from "./types";
import { updateSpeaker } from "@/audio/audio";

export interface Stress {
  id: string; // global element id (m.R1 / u.U123)
  label: string;
  power: number;
  rating: number;
  /** "heat" = above rating, "burn" = destroyed */
  level: "warm" | "hot";
}

export interface Readings {
  dmm: { text: string; unit: string; value: number | null; mode: DmmMode };
  dvm: { v: number; a: number };
  meters: Record<"m1" | "m2" | "m3" | "m4", number>;
  led: Record<string, number>;
  /** supplies currently in current limit */
  overload: string[];
  stress: Stress[];
}

interface SimState {
  result: SimResult | null;
  built: BuiltCircuit | null;
  ch: [Measurement | null, Measurement | null];
  readings: Readings;
  busy: boolean;
  error: string | null;
  version: number;
}

const EMPTY_READINGS: Readings = {
  dmm: { text: "0.000", unit: "V", value: 0, mode: "dcv" },
  dvm: { v: 0, a: 0 },
  meters: { m1: 0, m2: 0, m3: 0, m4: 0 },
  led: {},
  overload: [],
  stress: [],
};

export const useSim = create<SimState>(() => ({
  result: null,
  built: null,
  ch: [null, null],
  readings: EMPTY_READINGS,
  busy: false,
  error: null,
  version: 0,
}));

/* ---------------------------------------------------------------- */
/* Multimeter display: 4000-count auto-ranging like the real DMM     */
/* ---------------------------------------------------------------- */
export function formatDmm(mode: DmmMode, value: number | null): { text: string; unit: string } {
  if (mode === "off") return { text: "", unit: "" };
  if (value === null || !Number.isFinite(value)) {
    const unit = mode === "ohm" ? "MΩ" : mode === "diode" ? "V" : mode === "dca" || mode === "aca" ? "mA" : "V";
    return { text: "OL", unit };
  }
  const counts = 3999;
  const pick = (v: number, ranges: [number, number, string][]) => {
    // ranges: [full scale, decimals, unit]; v already in base units of the first range's unit system
    for (const [fs, dec, unit] of ranges) if (Math.abs(v) <= fs * (counts / 4000)) return { fs, dec, unit };
    return null;
  };
  switch (mode) {
    case "dcv":
    case "acv": {
      const r = pick(value, [
        [0.4, 1, "mV"],
        [4, 3, "V"],
        [40, 2, "V"],
        [400, 1, "V"],
        [1000, 0, "V"],
      ]);
      if (!r) return { text: "OL", unit: "V" };
      const v = r.unit === "mV" ? value * 1000 : value;
      return { text: v.toFixed(r.dec), unit: r.unit };
    }
    case "dca":
    case "aca": {
      // value in mA
      const r = pick(value, [
        [40, 2, "mA"],
        [400, 1, "mA"],
      ]);
      if (!r) return { text: "OL", unit: "mA" };
      return { text: value.toFixed(r.dec), unit: "mA" };
    }
    case "ohm": {
      if (value > 40e6) return { text: "OL", unit: "MΩ" };
      if (value < 400) return { text: value.toFixed(1), unit: "Ω" };
      if (value < 4e3) return { text: (value / 1e3).toFixed(3), unit: "kΩ" };
      if (value < 40e3) return { text: (value / 1e3).toFixed(2), unit: "kΩ" };
      if (value < 400e3) return { text: (value / 1e3).toFixed(1), unit: "kΩ" };
      if (value < 4e6) return { text: (value / 1e6).toFixed(3), unit: "MΩ" };
      return { text: (value / 1e6).toFixed(2), unit: "MΩ" };
    }
    case "diode":
      return value > 2.0 ? { text: "OL", unit: "V" } : { text: value.toFixed(3), unit: "V" };
  }
}

/* ---------------------------------------------------------------- */
/* component ratings (W) for overheating / burn-out                  */
/* ---------------------------------------------------------------- */
function ratingOf(p: PartDef): number {
  switch (p.kind) {
    case "R":
    case "RV":
    case "POT":
      return 0.25;
    case "LED":
      return 0.075; // ~30 mA x 2.2 V
    case "Z":
      return 1;
    case "D":
      return p.model === "1N4001" ? 1.5 : p.model === "1N34A" ? 0.08 : 0.5;
    case "NPN":
    case "PNP":
      return 0.6;
    default:
      return Infinity;
  }
}

/** parts of the inserted module + custom parts, by global element id */
function partIndex() {
  const st = useBench.getState();
  const mod = getModule(st.moduleId);
  const idx = new Map<string, PartDef>();
  for (const p of mod.parts) {
    idx.set(`m.${p.id}`, p);
    idx.set(`m.${p.id}.ab`, p);
    idx.set(`m.${p.id}.bc`, p);
  }
  for (const p of st.customParts) idx.set(`u.${p.id}`, p);
  return idx;
}

function computeReadings(res: SimResult, b: BuiltCircuit): Readings {
  const st = useBench.getState();
  const m = (id: string) => (res.data[id] ? measure(res.t, res.data[id]) : null);
  const d = m("dmm");
  let value: number | null = 0;
  switch (st.dmmMode) {
    case "off":
      value = null;
      break;
    case "dcv":
      value = d?.mean ?? 0;
      break;
    case "acv":
      value = d?.acRms ?? 0; // true-RMS meter
      break;
    case "dca":
      value = (d?.mean ?? 0) * 1000;
      break;
    case "aca":
      value = (d?.acRms ?? 0) * 1000;
      break;
    case "ohm": {
      const v = d?.mean ?? 0;
      const i = m("dmm.i")?.mean ?? 0;
      const r = i > 1e-10 ? v / i : Infinity;
      value = Number.isFinite(r) && r >= 0 ? r : null;
      break;
    }
    case "diode": {
      value = d?.mean ?? 0;
      break;
    }
  }
  const f = formatDmm(st.dmmMode, value);
  const led: Record<string, number> = {};
  for (const id of b.ledIds) led[id] = m(`led:${id}`)?.mean ?? 0;

  // moving-coil AC meters are average-responding, calibrated for sine (x1.111)
  const avgResp = (id: string) => {
    const v = res.data[id];
    if (!v || v.length < 2) return 0;
    const mean = m(id)?.mean ?? 0;
    let s = 0;
    for (let i = 0; i < v.length; i++) s += Math.abs(v[i] - mean);
    return (1.1107 * s) / v.length;
  };

  // supplies in current limit
  const overload: string[] = [];
  for (const id of Object.keys(SOURCE_LIMITS)) {
    const pr = res.data[`src:${id}`];
    if (!pr) continue;
    let peak = 0;
    for (let i = 0; i < pr.length; i++) peak = Math.max(peak, Math.abs(pr[i]));
    if (peak > SOURCE_LIMITS[id].lim * 0.95) overload.push(id);
  }

  // overheating components
  const parts = partIndex();
  const agg = new Map<string, { p: PartDef; power: number }>();
  for (const [id, pw] of Object.entries(res.power)) {
    const part = parts.get(id);
    if (!part) continue;
    const key = id.replace(/\.(ab|bc)$/, "");
    const cur = agg.get(key);
    agg.set(key, { p: part, power: (cur?.power ?? 0) + pw });
  }
  const stress: Stress[] = [];
  for (const [id, { p, power }] of agg) {
    const rating = ratingOf(p);
    if (power > rating) stress.push({ id, label: p.label ?? p.id, power, rating, level: power > 2.5 * rating ? "hot" : "warm" });
  }

  return {
    dmm: { ...f, value, mode: st.dmmMode },
    dvm: { v: m("dvm.v")?.mean ?? 0, a: (m("dvm.a")?.mean ?? 0) * 1000 },
    // needle position in scale units: the 1 A sockets use the same 0..100 scale (x10 mA)
    meters: {
      m1: m("m1")?.mean ?? 0,
      m2: (m("m2")?.mean ?? 0) * 1000 + (m("m2.1a")?.mean ?? 0) * 100,
      m3: avgResp("m3"),
      m4: avgResp("m4") * 1000 + avgResp("m4.1a") * 100,
    },
    led,
    overload,
    stress,
  };
}

/** mean / min / max / rms voltage of the node a jack belongs to (null = floating / unknown) */
export function jackVoltage(jack: string): { mean: number; min: number; max: number; rms: number } | null {
  const { built, result } = useSim.getState();
  if (!built || !result || !result.nodeStats.length) return null;
  const i = built.nodeIndex(jack);
  if (i < 0) return null;
  if (i === 0) return { mean: 0, min: 0, max: 0, rms: 0 };
  const k = i * 4;
  if (k + 3 >= result.nodeStats.length) return null;
  const s = result.nodeStats;
  return { mean: s[k], min: s[k + 1], max: s[k + 2], rms: s[k + 3] };
}

let worker: Worker | null = null;
let seq = 0;
let lastKey = "";
const pendingBuilt: Map<number, BuiltCircuit> = new Map();
/** supplies switched into fold-back after an overload was detected */
let limited = new Set<string>();
let limitedFor = "";
/** time each part has been far above its rating (ms) */
const hotSince = new Map<string, number>();

function benchKey() {
  const st = useBench.getState();
  return JSON.stringify([st.moduleId, st.wires.map((w) => [w.a, w.b]), st.leads, st.knobs, st.power, st.dmmMode, st.customParts.length, st.damaged]);
}

function request(force = false) {
  const st = useBench.getState();
  const bk = benchKey();
  if (bk !== limitedFor) {
    limited = new Set();
    limitedFor = bk;
  }
  const built = buildCircuit(snapshotOf(st), { limited });
  const timing = planTiming(built, st.scope.tdiv);
  const key = built.key + "|" + JSON.stringify(timing);
  if (key === lastKey && !force) return;
  lastKey = key;
  const req: SimRequest = {
    seq: ++seq,
    circuit: built.circuit,
    probes: built.probes,
    ...timing,
    maxPoints: 8000,
  };
  pendingBuilt.set(req.seq, built);
  useSim.setState({ busy: true });
  worker?.postMessage(req);
}

function handleStress(readings: Readings) {
  const now = performance.now();
  const st = useBench.getState();
  const hotIds = new Set(readings.stress.filter((s) => s.level === "hot").map((s) => s.id));
  for (const id of [...hotSince.keys()]) if (!hotIds.has(id)) hotSince.delete(id);
  for (const s of readings.stress) {
    if (s.level !== "hot" || (st.damaged ?? []).includes(s.id)) continue;
    const t0 = hotSince.get(s.id);
    if (t0 === undefined) {
      hotSince.set(s.id, now);
      st.notify(st.lang === "ar" ? `⚠ ${s.label} يسخن بشدة (${s.power.toFixed(2)} W > ${s.rating} W)` : `⚠ ${s.label} is overheating (${s.power.toFixed(2)} W > ${s.rating} W)`);
    } else if (now - t0 > 2500 && !(st.damaged ?? []).includes(s.id)) {
      st.damage(s.id);
      hotSince.delete(s.id);
      st.notify(st.lang === "ar" ? `💥 احترق ${s.label}! استبدل القطعة لمتابعة العمل` : `💥 ${s.label} burnt out! Replace it to continue`);
    }
  }
}

/** Mount once: keeps the simulation in sync with the bench. */
export function useSimulationDriver() {
  useEffect(() => {
    worker = new Worker(new URL("../sim/sim.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<SimResult>) => {
      const res = e.data;
      const built = pendingBuilt.get(res.seq);
      for (const k of pendingBuilt.keys()) if (k <= res.seq) pendingBuilt.delete(k);
      if (!built) return;
      if (!res.ok) {
        useSim.setState({ busy: res.seq !== seq, error: res.message ?? "simulation failed", version: useSim.getState().version + 1 });
        return;
      }
      const readings = computeReadings(res, built);
      // supplies above their limit fold back: re-solve with the limited source impedance
      const newly = readings.overload.filter((id) => !limited.has(id));
      if (newly.length) {
        for (const id of newly) limited.add(id);
        const st = useBench.getState();
        const names = [...new Set(newly.map((id) => SOURCE_LIMITS[id].name))].join(", ");
        st.notify(st.lang === "ar" ? `⚡ قصر/حمل زائد على مصدر ${names} — دخل المصدر حالة تحديد التيار` : `⚡ Overload on the ${names} supply — current limit engaged`);
        request(true);
      }
      const ch: [Measurement | null, Measurement | null] = [
        res.data.ch1 ? measure(res.t, res.data.ch1) : null,
        res.data.ch2 ? measure(res.t, res.data.ch2) : null,
      ];
      useSim.setState({
        result: res,
        built,
        ch,
        readings,
        busy: res.seq !== seq,
        error: null,
        version: useSim.getState().version + 1,
      });
      handleStress(readings);
      // the trainer's loudspeaker plays the simulated voltage across its terminals
      const spk = res.data.spk;
      if (spk) {
        const ms = measure(res.t, spk);
        updateSpeaker(ms.vpp > 0.01 ? res.t : null, ms.vpp > 0.01 ? spk : null, ms.period);
      }
    };
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        request();
      }, 30);
    };
    lastKey = "";
    request();
    const unsub = useBench.subscribe(schedule);
    // components keep heating while overloaded even if nothing changes on the bench
    const heat = setInterval(() => {
      const r = useSim.getState().readings;
      if (r.stress.some((s) => s.level === "hot")) handleStress(r);
    }, 700);
    return () => {
      unsub();
      clearInterval(heat);
      worker?.terminate();
      worker = null;
    };
  }, []);
}
