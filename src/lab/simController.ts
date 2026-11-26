"use client";
import { create } from "zustand";
import { useEffect } from "react";
import type { SimRequest, SimResult } from "@/sim/types";
import { measure, type Measurement } from "@/sim/measure";
import { buildCircuit, planTiming, type BuiltCircuit } from "./netlist";
import { useBench, snapshotOf } from "@/store/bench";

export interface Readings {
  dmm: { text: string; unit: string; value: number | null };
  dvm: { v: number; a: number };
  meters: Record<"m1" | "m2" | "m3" | "m4", number>;
  led: Record<string, number>;
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
  dmm: { text: "0.000", unit: "V", value: 0 },
  dvm: { v: 0, a: 0 },
  meters: { m1: 0, m2: 0, m3: 0, m4: 0 },
  led: {},
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

function fmtDmm(v: number, unit: string): string {
  const a = Math.abs(v);
  if (a >= 1000) return v.toFixed(0);
  if (a >= 100) return v.toFixed(1);
  if (a >= 10) return v.toFixed(2);
  return v.toFixed(3);
}

function computeReadings(res: SimResult, b: BuiltCircuit): Readings {
  const st = useBench.getState();
  const m = (id: string) => (res.data[id] ? measure(res.t, res.data[id]) : null);
  let dmm: Readings["dmm"] = { text: "", unit: "", value: null };
  const d = m("dmm");
  switch (st.dmmMode) {
    case "off":
      dmm = { text: "", unit: "", value: null };
      break;
    case "dcv":
      dmm = { text: fmtDmm(d?.mean ?? 0, "V"), unit: "V DC", value: d?.mean ?? 0 };
      break;
    case "acv":
      dmm = { text: fmtDmm(d?.acRms ?? 0, "V"), unit: "V AC", value: d?.acRms ?? 0 };
      break;
    case "dca": {
      const ma = (d?.mean ?? 0) * 1000;
      dmm = { text: fmtDmm(ma, "mA"), unit: "mA DC", value: ma };
      break;
    }
    case "aca": {
      const ma = (d?.acRms ?? 0) * 1000;
      dmm = { text: fmtDmm(ma, "mA"), unit: "mA AC", value: ma };
      break;
    }
    case "ohm": {
      const v = d?.mean ?? 0;
      const i = m("dmm.i")?.mean ?? 0;
      const r = i > 1e-10 ? v / i : Infinity;
      if (!Number.isFinite(r) || r > 40e6 || r < 0) dmm = { text: "OL", unit: "MΩ", value: null };
      else if (r >= 1e6) dmm = { text: fmtDmm(r / 1e6, ""), unit: "MΩ", value: r };
      else if (r >= 1e3) dmm = { text: fmtDmm(r / 1e3, ""), unit: "kΩ", value: r };
      else dmm = { text: fmtDmm(r, ""), unit: "Ω", value: r };
      break;
    }
    case "diode": {
      const v = d?.mean ?? 0;
      dmm = v > 2.0 ? { text: "OL", unit: "V ▶|", value: null } : { text: v.toFixed(3), unit: "V ▶|", value: v };
      break;
    }
  }
  const led: Record<string, number> = {};
  for (const id of b.ledIds) led[id] = m(`led:${id}`)?.mean ?? 0;
  return {
    dmm,
    dvm: { v: m("dvm.v")?.mean ?? 0, a: (m("dvm.a")?.mean ?? 0) * 1000 },
    meters: {
      m1: m("m1")?.mean ?? 0,
      m2: (m("m2")?.mean ?? 0) * 1000,
      m3: m("m3")?.rms ?? 0,
      m4: (m("m4")?.rms ?? 0) * 1000,
    },
    led,
  };
}

let worker: Worker | null = null;
let seq = 0;
let lastKey = "";
let pendingBuilt: Map<number, BuiltCircuit> = new Map();

function request() {
  const st = useBench.getState();
  const built = buildCircuit(snapshotOf(st));
  const timing = planTiming(built, st.scope.tdiv);
  const key = built.key + "|" + JSON.stringify(timing);
  if (key === lastKey) return;
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
      const ch: [Measurement | null, Measurement | null] = [
        res.data.ch1 ? measure(res.t, res.data.ch1) : null,
        res.data.ch2 ? measure(res.t, res.data.ch2) : null,
      ];
      useSim.setState({
        result: res,
        built,
        ch,
        readings: computeReadings(res, built),
        busy: res.seq !== seq,
        error: null,
        version: useSim.getState().version + 1,
      });
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
    return () => {
      unsub();
      worker?.terminate();
      worker = null;
    };
  }, []);
}
