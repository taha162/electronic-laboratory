/**
 * Converts the physical bench (trainer + module + patch cords + instrument leads)
 * into an MNA circuit for the solver.
 */
import type { Circuit, Element, ProbeSpec, Waveform } from "@/sim/types";
import { BJTS, DIODES, OPAMPS } from "@/sim/models";
import type { CustomPart, PartDef } from "./types";
import { TRAINER_JACKS, VR_VALUES, adjVoltage, fgAmplitudeVpp, fgFrequency } from "./trainer";
import { getModule } from "./modules";
import type { Snapshot } from "@/store/bench";

export const AC_FREQ = 50; // mains frequency (Iraq)
export const AC_VRMS = 9;

class UnionFind {
  parent = new Map<string, string>();
  add(a: string) {
    if (!this.parent.has(a)) this.parent.set(a, a);
  }
  find(a: string): string {
    this.add(a);
    let r = a;
    while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    let c = a;
    while (this.parent.get(c) !== r) {
      const n = this.parent.get(c)!;
      this.parent.set(c, r);
      c = n;
    }
    return r;
  }
  union(a: string, b: string) {
    const ra = this.find(a),
      rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export interface BuiltCircuit {
  circuit: Circuit;
  probes: ProbeSpec[];
  /** global jack id -> node index */
  nodeOf: (id: string) => number;
  /** frequencies of sources that actually drive something */
  activeFreqs: number[];
  ledIds: string[];
  hasReactive: boolean;
  /** rough slowest RC/L time constant of the connected circuit (s) */
  tau: number;
  /** signature used to skip identical re-simulations */
  key: string;
}

const EARTH = "earth";

function terminals(e: Element): number[] {
  switch (e.t) {
    case "D":
      return [e.a, e.k];
    case "Q":
      return [e.c, e.b, e.e];
    case "OA":
      return [e.inp, e.inn, e.out, ...(e.vcc != null ? [e.vcc] : []), ...(e.vee != null ? [e.vee] : [])];
    default:
      return [e.a, e.b];
  }
}

/**
 * Drop "islands" of the board that are not connected to ground or to any source:
 * they carry no current and only inflate the MNA matrix. Renumbers nodes.
 */
function prune(c0: Circuit, probes: ProbeSpec[]) {
  // 1) iteratively strip two-terminal elements hanging from an otherwise unconnected node
  let elems = c0.elements;
  for (let pass = 0; pass < 50; pass++) {
    const deg = new Int32Array(c0.nodeCount);
    for (const e of elems) for (const t of terminals(e)) deg[t]++;
    const next = elems.filter((e) => {
      const t = terminals(e);
      if (t.length !== 2) return true;
      return !((t[0] !== 0 && deg[t[0]] === 1) || (t[1] !== 0 && deg[t[1]] === 1));
    });
    if (next.length === elems.length) break;
    elems = next;
  }
  const c: Circuit = { nodeCount: c0.nodeCount, elements: elems };
  // 2) drop islands not tied to ground or to a source
  const parent = Array.from({ length: c.nodeCount }, (_, i) => i);
  const find = (a: number): number => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  for (const e of c.elements) {
    const t = terminals(e);
    for (let i = 1; i < t.length; i++) {
      const a = find(t[0]),
        b = find(t[i]);
      if (a !== b) parent[a] = b;
    }
  }
  const live = new Set<number>([find(0)]);
  for (const e of c.elements) if (e.t === "V" || e.t === "I" || e.t === "OA") live.add(find(terminals(e)[0]));
  const map = new Map<number, number>([[0, 0]]);
  let n = 1;
  const keepNode = (x: number) => live.has(find(x));
  const remap = (x: number) => {
    if (!keepNode(x)) return -1;
    let m = map.get(x);
    if (m === undefined) map.set(x, (m = n++));
    return m;
  };
  const els: Element[] = [];
  for (const e of c.elements) {
    const t = terminals(e);
    if (!t.every(keepNode)) continue;
    const r = remap;
    switch (e.t) {
      case "D":
        els.push({ ...e, a: r(e.a), k: r(e.k) });
        break;
      case "Q":
        els.push({ ...e, c: r(e.c), b: r(e.b), e: r(e.e) });
        break;
      case "OA":
        els.push({ ...e, inp: r(e.inp), inn: r(e.inn), out: r(e.out), vcc: e.vcc != null ? r(e.vcc) : null, vee: e.vee != null ? r(e.vee) : null });
        break;
      default:
        els.push({ ...e, a: r(e.a), b: r(e.b) } as Element);
    }
  }
  const kept = new Set(els.map((e) => e.id));
  const pr: ProbeSpec[] = [];
  for (const p of probes) {
    if (p.kind === "v") {
      const a = keepNode(p.a) ? remap(p.a) : 0;
      const b = keepNode(p.b) ? remap(p.b) : 0;
      pr.push({ ...p, a, b });
    } else if (kept.has(p.el)) pr.push(p);
    else pr.push({ id: p.id, kind: "v", a: 0, b: 0 });
  }
  // time-constant estimate: each C with the largest resistance touching its nodes
  const rAt = new Map<number, number>();
  for (const e of els)
    if (e.t === "R" && e.r < 5e6 && !e.id.startsWith("osc") && !e.id.startsWith("dmm")) {
      for (const x of [e.a, e.b]) rAt.set(x, Math.max(rAt.get(x) ?? 0, e.r));
    }
  let tau = 0;
  let reactive = false;
  for (const e of els) {
    if (e.t === "C") {
      reactive = true;
      const r = Math.max(rAt.get(e.a) ?? 0, rAt.get(e.b) ?? 0, 1e3);
      tau = Math.max(tau, e.c * r);
    } else if (e.t === "L") {
      reactive = true;
      tau = Math.max(tau, e.l / 10);
    }
  }
  return { circuit: { nodeCount: n, elements: els }, probes: pr, tau, reactive };
}

function fgWaveform(knobs: Record<string, number>): Waveform {
  const fn = Math.round(knobs["fg.func"] ?? 0);
  const kind = fn === 1 ? "triangle" : fn === 2 ? "square" : "sine";
  return {
    kind,
    amp: fgAmplitudeVpp(knobs["fg.amp"] ?? 0.5) / 2,
    freq: fgFrequency(Math.round(knobs["fg.range"] ?? 3), knobs["fg.freq"] ?? 0.4),
    offset: 0,
  };
}

export function fgSettings(knobs: Record<string, number>) {
  const w = fgWaveform(knobs);
  return w.kind === "dc" ? { kind: "dc", vpp: 0, freq: 0 } : { kind: w.kind, vpp: w.amp * 2, freq: w.freq };
}

export function buildCircuit(s: Snapshot): BuiltCircuit {
  const mod = getModule(s.moduleId);
  const uf = new UnionFind();
  uf.add(EARTH);
  for (const jk of TRAINER_JACKS) uf.add(`tr:${jk.id}`);
  for (const jk of mod.jacks) uf.add(`m:${jk.id}`);

  // printed traces on the module
  for (const tr of mod.traces) {
    const ids = tr.filter((p): p is string => typeof p === "string");
    for (let i = 1; i < ids.length; i++) uf.union(`m:${ids[0]}`, `m:${ids[i]}`);
  }
  for (const e of mod.earth ?? []) uf.union(`m:${e}`, EARTH);
  // trainer grounds
  for (const g of ["fg.gnd", "ps.gnd", "adj.gnd"]) uf.union(`tr:${g}`, EARTH);
  // scope ground clips are bonded to mains earth through the scope chassis
  uf.union("osc.ch1g", EARTH);
  uf.union("osc.ch2g", EARTH);
  uf.add("osc.ch1");
  uf.add("osc.ch2");
  uf.add("dmm.v");
  uf.add("dmm.com");

  // count of attachments per jack for "is this source used" detection
  const degree = new Map<string, number>();
  const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1);
  for (const w of s.wires) {
    uf.union(w.a, w.b);
    bump(w.a);
    bump(w.b);
  }
  for (const [lead, jack] of Object.entries(s.leads)) {
    if (jack) {
      uf.union(lead, jack);
      bump(jack);
    }
  }

  // node numbering
  const nodeIdx = new Map<string, number>();
  nodeIdx.set(uf.find(EARTH), 0);
  let next = 1;
  const nodeOf = (id: string): number => {
    const r = uf.find(id);
    let n = nodeIdx.get(r);
    if (n === undefined) {
      n = next++;
      nodeIdx.set(r, n);
    }
    return n;
  };
  const internal = () => next++;

  const els: Element[] = [];
  const probes: ProbeSpec[] = [];
  const activeFreqs: number[] = [];
  const ledIds: string[] = [];
  let hasReactive = false;
  const k = s.knobs;
  const T = (id: string) => nodeOf(`tr:${id}`);

  // ---------------- trainer sources ----------------
  if (s.power) {
    const fg = fgWaveform(k);
    els.push({ t: "V", id: "src.fg", a: T("fg.out"), b: 0, w: fg, rs: 50 });
    if (degree.get("tr:fg.out") && fg.kind !== "dc") activeFreqs.push(fg.freq);
    const ttlF = fg.kind === "dc" ? 1000 : fg.freq;
    els.push({ t: "V", id: "src.ttl", a: T("fg.ttl"), b: 0, w: { kind: "square", amp: 2.5, offset: 2.5, freq: ttlF }, rs: 50 });
    if (degree.get("tr:fg.ttl")) activeFreqs.push(ttlF);
    const dc = (id: string, v: number) =>
      els.push({ t: "V", id: `src.${id}`, a: T(id), b: 0, w: { kind: "dc", v }, rs: 0.05 });
    dc("ps.p5", 5);
    dc("ps.m5", -5);
    dc("ps.p12", 12);
    dc("ps.m12", -12);
    const va = adjVoltage(k["adj.v"] ?? 0);
    dc("adj.vp", va);
    dc("adj.vm", -va);
    const acAmp = AC_VRMS * Math.SQRT2;
    els.push({ t: "V", id: "src.ac1", a: T("ac.a"), b: T("ac.ct"), w: { kind: "sine", amp: acAmp, freq: AC_FREQ, offset: 0 }, rs: 0.8 });
    els.push({ t: "V", id: "src.ac2", a: T("ac.ct"), b: T("ac.b"), w: { kind: "sine", amp: acAmp, freq: AC_FREQ, offset: 0 }, rs: 0.8 });
    if (degree.get("tr:ac.a") || degree.get("tr:ac.b")) activeFreqs.push(AC_FREQ);
  }
  // potentiometers VR1..VR4 (wiper position 0 => at A)
  for (const vr of ["vr1", "vr2", "vr3", "vr4"]) {
    const pos = Math.min(Math.max(k[vr] ?? 0.5, 0), 1);
    const R = VR_VALUES[vr];
    els.push({ t: "R", id: `${vr}.ab`, a: T(`${vr}.a`), b: T(`${vr}.b`), r: Math.max(pos * R, 0.5) });
    els.push({ t: "R", id: `${vr}.bc`, a: T(`${vr}.b`), b: T(`${vr}.c`), r: Math.max((1 - pos) * R, 0.5) });
  }
  els.push({ t: "R", id: "spk", a: T("spk.p"), b: T("spk.n"), r: 8 });
  // built-in meters
  els.push({ t: "R", id: "dvm.r", a: T("dvm.v"), b: T("dvm.com"), r: 10e6 });
  els.push({ t: "AM", id: "dvm.am", a: T("dvm.a"), b: T("dvm.com") });
  els.push({ t: "R", id: "m1.r", a: T("m1.p"), b: T("m1.n"), r: 600e3 });
  els.push({ t: "AM", id: "m2.am", a: T("m2.p"), b: T("m2.n") });
  els.push({ t: "R", id: "m3.r", a: T("m3.p"), b: T("m3.n"), r: 150e3 });
  els.push({ t: "AM", id: "m4.am", a: T("m4.p"), b: T("m4.n") });
  probes.push(
    { id: "dvm.v", kind: "v", a: T("dvm.v"), b: T("dvm.com") },
    { id: "dvm.a", kind: "i", el: "dvm.am" },
    { id: "m1", kind: "v", a: T("m1.p"), b: T("m1.n") },
    { id: "m2", kind: "i", el: "m2.am" },
    { id: "m3", kind: "v", a: T("m3.p"), b: T("m3.n") },
    { id: "m4", kind: "i", el: "m4.am" },
  );

  // ---------------- module + custom parts ----------------
  const pinNode = (pin: string, prefix: string) => {
    if (pin === "@+12") return s.power ? T("ps.p12") : internal();
    if (pin === "@-12") return s.power ? T("ps.m12") : internal();
    return nodeOf(pin.includes(":") ? pin : `${prefix}${pin}`);
  };
  const addPart = (p: PartDef, prefix: string, gid: string) => {
    const n = p.pins.map((pin) => pinNode(pin, prefix));
    switch (p.kind) {
      case "R":
        els.push({ t: "R", id: gid, a: n[0], b: n[1], r: p.value ?? 1000 });
        break;
      case "RV": {
        const pos = k[p.knob ?? ""] ?? 0.5;
        els.push({ t: "R", id: gid, a: n[0], b: n[1], r: (p.min ?? 0) + pos * (p.value ?? 1e4) + 1 });
        break;
      }
      case "POT": {
        const pos = Math.min(Math.max(k[p.knob ?? ""] ?? 0.5, 0), 1);
        const R = p.value ?? 1e3;
        els.push({ t: "R", id: `${gid}.ab`, a: n[0], b: n[1], r: Math.max(pos * R, 0.5) });
        els.push({ t: "R", id: `${gid}.bc`, a: n[1], b: n[2], r: Math.max((1 - pos) * R, 0.5) });
        break;
      }
      case "C":
      case "CP":
        hasReactive = true;
        els.push({ t: "C", id: gid, a: n[0], b: n[1], c: p.value ?? 1e-6 });
        break;
      case "L": {
        hasReactive = true;
        // winding resistance ~ 3 ohm per mH (min 1 ohm)
        const mid = internal();
        const L = p.value ?? 10e-3;
        els.push({ t: "R", id: `${gid}.rw`, a: n[0], b: mid, r: Math.max(1, L * 3e3) });
        els.push({ t: "L", id: gid, a: mid, b: n[1], l: L });
        break;
      }
      case "D":
      case "Z":
      case "LED": {
        const m = DIODES[p.model ?? (p.kind === "LED" ? "LED_RED" : p.kind === "Z" ? "1N4740" : "1N4148")];
        els.push({ t: "D", id: gid, a: n[0], k: n[1], m });
        if (p.kind === "LED") {
          ledIds.push(gid);
          probes.push({ id: `led:${gid}`, kind: "i", el: gid });
        }
        break;
      }
      case "NPN":
      case "PNP": {
        const m = BJTS[p.model ?? (p.kind === "NPN" ? "2N3904" : "2N3906")];
        els.push({ t: "Q", id: gid, c: n[0], b: n[1], e: n[2], m });
        break;
      }
      case "OA": {
        const m = OPAMPS[p.model ?? "UA741"];
        els.push({ t: "OA", id: gid, inn: n[0], inp: n[1], out: n[2], vcc: n[3], vee: n[4], m });
        break;
      }
    }
  };
  for (const p of mod.parts) addPart(p, "m:", `m.${p.id}`);
  for (const p of s.customParts as CustomPart[]) addPart({ ...p, pins: p.gpins }, "", `u.${p.id}`);

  // ---------------- instruments ----------------
  els.push({ t: "R", id: "osc.r1", a: nodeOf("osc.ch1"), b: 0, r: 1e6 });
  els.push({ t: "R", id: "osc.r2", a: nodeOf("osc.ch2"), b: 0, r: 1e6 });
  probes.push({ id: "ch1", kind: "v", a: nodeOf("osc.ch1"), b: 0 }, { id: "ch2", kind: "v", a: nodeOf("osc.ch2"), b: 0 });

  const dv = nodeOf("dmm.v"),
    dc = nodeOf("dmm.com");
  switch (s.dmmMode) {
    case "dcv":
    case "acv":
      els.push({ t: "R", id: "dmm.r", a: dv, b: dc, r: 10e6 });
      probes.push({ id: "dmm", kind: "v", a: dv, b: dc });
      break;
    case "dca":
    case "aca":
      els.push({ t: "AM", id: "dmm.am", a: dv, b: dc });
      probes.push({ id: "dmm", kind: "i", el: "dmm.am" });
      break;
    case "ohm":
      els.push({ t: "V", id: "dmm.src", a: dv, b: dc, w: { kind: "dc", v: 0.6 }, rs: 1000 });
      probes.push({ id: "dmm", kind: "v", a: dv, b: dc }, { id: "dmm.i", kind: "i", el: "dmm.src" });
      break;
    case "diode":
      els.push({ t: "V", id: "dmm.src", a: dv, b: dc, w: { kind: "dc", v: 3 }, rs: 2200 });
      probes.push({ id: "dmm", kind: "v", a: dv, b: dc });
      break;
  }

  const { circuit, probes: pr, tau, reactive } = prune({ nodeCount: next, elements: els }, probes);
  hasReactive = reactive;
  const key = JSON.stringify([s.moduleId, s.wires.map((w) => [w.a, w.b]), s.leads, s.knobs, s.power, s.dmmMode, s.customParts.map((p) => [p.kind, p.value, p.model, p.gpins])]);
  return { circuit, probes: pr, nodeOf, activeFreqs, ledIds, hasReactive, tau, key };
}

/** choose settle / capture windows and steps for the transient run */
export function planTiming(b: BuiltCircuit, tdiv: number) {
  if (!b.activeFreqs.length) {
    // DC circuit: operating point only
    return { tStop: 0, tCapture: 0, dtMax: 1, dtSettle: 1 };
  }
  const fmin = Math.min(...b.activeFreqs);
  const fmax = Math.max(...b.activeFreqs);
  const T = 1 / fmin;
  const W = tdiv * 12;
  let capture = Math.max(W + 1.3 * T, 3 * T);
  capture = Math.min(capture, 400 / fmax + 1.3 * T, 1.0);
  let dt = Math.min(1 / (fmax * 400), W / 1500);
  const MAX_CAP_STEPS = 90000;
  if (capture / dt > MAX_CAP_STEPS) dt = capture / MAX_CAP_STEPS;
  let settle = b.hasReactive ? Math.min(Math.max(6 * T, 4 * b.tau), 0.25) : 2 * T;
  const dtSettle = Math.max(dt, 1 / (fmax * 80));
  settle = Math.min(settle, 40000 * dtSettle);
  settle = Math.ceil(settle / T) * T; // keep phase aligned
  return { tStop: settle + capture, tCapture: settle, dtMax: dt, dtSettle };
}

