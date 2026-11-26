/**
 * Converts the physical bench (trainer + module + patch cords + instrument leads)
 * into an MNA circuit for the solver.
 */
import type { Circuit, Element, ProbeSpec, Waveform } from "@/sim/types";
import { BJTS, DIODES, OPAMPS, opampMacro } from "@/sim/models";
import type { CustomPart, PartDef } from "./types";
import { TRAINER_JACKS, VR_VALUES, adjVoltage, fgAmplitudeVpp, fgFrequency } from "./trainer";
import { getModule } from "./modules";
import type { Snapshot } from "@/store/bench";

export const AC_FREQ = 50; // mains frequency (Iraq)
/** current limits of the KL-21001 supplies (A) — above this the supply folds back */
export const SOURCE_LIMITS: Record<string, { lim: number; name: string }> = {
  "src.ps.p5": { lim: 1, name: "+5V" },
  "src.ps.m5": { lim: 1, name: "-5V" },
  "src.ps.p12": { lim: 1, name: "+12V" },
  "src.ps.m12": { lim: 1, name: "-12V" },
  "src.adj.vp": { lim: 0.5, name: "ADJ V+" },
  "src.adj.vm": { lim: 0.5, name: "ADJ V-" },
  "src.ac1": { lim: 1, name: "9V AC" },
  "src.ac2": { lim: 1, name: "9V AC" },
};
export interface BuildOptions {
  /** supplies currently in current-limit (fold-back) */
  limited?: Set<string>;
}
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
  /** jack / terminal id -> node index in the solved (pruned) circuit, -1 if floating */
  nodeIndex: (id: string) => number;
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
      return [e.inp, e.inn, e.out, ...(e.vcc != null ? [e.vcc] : []), ...(e.vee != null ? [e.vee] : []), ...(e.int != null ? [e.int] : [])];
    default:
      return [e.a, e.b];
  }
}

/**
 * Drop "islands" of the board that are not connected to ground or to any source:
 * they carry no current and only inflate the MNA matrix. Renumbers nodes.
 */
function prune(c0: Circuit, probes: ProbeSpec[], userNodes: Set<number>) {
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
  // 2) partition into sub-circuits that only share ground (they are electrically
  //    independent) and keep those that contain a source AND something the student
  //    connected; op-amp supply pins are ideal sources, so they don't couple blocks.
  const parent = Array.from({ length: c.nodeCount }, (_, i) => i);
  const find = (a: number): number => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  const unionTerms = (e: Element): number[] => (e.t === "OA" ? [e.inp, e.inn, e.out, ...(e.int != null ? [e.int] : [])] : terminals(e));
  for (const e of c.elements) {
    const t = unionTerms(e).filter((x) => x !== 0);
    for (let i = 1; i < t.length; i++) {
      const a = find(t[0]),
        b = find(t[i]);
      if (a !== b) parent[a] = b;
    }
  }
  const hasSource = new Set<number>();
  for (const e of c.elements) {
    if (e.t === "V" || e.t === "I") for (const x of [e.a, e.b]) if (x) hasSource.add(find(x));
    if (e.t === "OA" && e.out) hasSource.add(find(e.out));
  }
  const relevant = new Set<number>();
  for (const x of userNodes) if (x > 0 && x < c.nodeCount) relevant.add(find(x));
  const keepRoots = new Set<number>([...relevant].filter((r) => hasSource.has(r)));
  // supplies of kept op-amps must be solved too
  for (const e of c.elements)
    if (e.t === "OA" && keepRoots.has(find(e.out))) for (const x of [e.vcc, e.vee]) if (x) keepRoots.add(find(x));
  const live = { has: (r: number) => r === find(0) || keepRoots.has(r) };
  const map = new Map<number, number>([[0, 0]]);
  let n = 1;
  const keepNode = (x: number) => x === 0 || live.has(find(x));
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
        els.push({
          ...e,
          inp: r(e.inp),
          inn: r(e.inn),
          out: r(e.out),
          vcc: e.vcc != null ? r(e.vcc) : null,
          vee: e.vee != null ? r(e.vee) : null,
          int: e.int != null ? r(e.int) : null,
        });
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
      // a capacitor settles through the lower-impedance side (coupling caps settle fast,
      // integrator / clamp capacitors between two high-impedance nodes settle slowly)
      const r = Math.max(Math.min(rAt.get(e.a) ?? 0, rAt.get(e.b) ?? 0), 1e3);
      tau = Math.max(tau, e.c * r);
    } else if (e.t === "L") {
      reactive = true;
      tau = Math.max(tau, e.l / 10);
    }
  }
  return { circuit: { nodeCount: n, elements: els }, probes: pr, tau, reactive, map };
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

export function buildCircuit(s: Snapshot, opts: BuildOptions = {}): BuiltCircuit {
  const limited = opts.limited ?? new Set<string>();
  const damaged = new Set(s.damaged ?? []);
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
    // a supply in current limit behaves like a source behind a resistance V/Ilim
    const rsOf = (id: string, v: number, base: number) => {
      const L = SOURCE_LIMITS[id];
      return L && limited.has(id) ? Math.max(base, Math.abs(v) / L.lim) : base;
    };
    const dc = (id: string, v: number) => {
      els.push({ t: "V", id: `src.${id}`, a: T(id), b: 0, w: { kind: "dc", v }, rs: rsOf(`src.${id}`, v, 0.05) });
      probes.push({ id: `src:src.${id}`, kind: "i", el: `src.${id}` });
    };
    dc("ps.p5", 5);
    dc("ps.m5", -5);
    dc("ps.p12", 12);
    dc("ps.m12", -12);
    const va = adjVoltage(k["adj.v"] ?? 0);
    dc("adj.vp", va);
    dc("adj.vm", -va);
    const acAmp = AC_VRMS * Math.SQRT2;
    els.push({ t: "V", id: "src.ac1", a: T("ac.a"), b: T("ac.ct"), w: { kind: "sine", amp: acAmp, freq: AC_FREQ, offset: 0 }, rs: rsOf("src.ac1", acAmp, 0.8) });
    els.push({ t: "V", id: "src.ac2", a: T("ac.ct"), b: T("ac.b"), w: { kind: "sine", amp: acAmp, freq: AC_FREQ, offset: 0 }, rs: rsOf("src.ac2", acAmp, 0.8) });
    probes.push({ id: "src:src.ac1", kind: "i", el: "src.ac1" }, { id: "src:src.ac2", kind: "i", el: "src.ac2" });
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
  els.push({ t: "AM", id: "dvm.am", a: T("dvm.a"), b: T("dvm.com"), r: 1 });
  els.push({ t: "R", id: "m1.r", a: T("m1.p"), b: T("m1.n"), r: 600e3 });
  els.push({ t: "AM", id: "m2.am", a: T("m2.p"), b: T("m2.n"), r: 2.2 });
  els.push({ t: "R", id: "m3.r", a: T("m3.p"), b: T("m3.n"), r: 150e3 });
  els.push({ t: "AM", id: "m4.am", a: T("m4.p"), b: T("m4.n"), r: 2.2 });
  probes.push(
    { id: "dvm.v", kind: "v", a: T("dvm.v"), b: T("dvm.com") },
    { id: "dvm.a", kind: "i", el: "dvm.am" },
    { id: "m1", kind: "v", a: T("m1.p"), b: T("m1.n") },
    { id: "m2", kind: "i", el: "m2.am" },
    { id: "m3", kind: "v", a: T("m3.p"), b: T("m3.n") },
    { id: "m4", kind: "i", el: "m4.am" },
    { id: "spk", kind: "v", a: T("spk.p"), b: T("spk.n") },
  );

  // ---------------- module + custom parts ----------------
  const pinNode = (pin: string, prefix: string) => {
    if (pin === "@+12") return s.power ? T("ps.p12") : internal();
    if (pin === "@-12") return s.power ? T("ps.m12") : internal();
    return nodeOf(pin.includes(":") ? pin : `${prefix}${pin}`);
  };
  const addPart = (p: PartDef, prefix: string, gid: string) => {
    if (damaged.has(gid)) return; // burnt-out part = open circuit
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
        // two-stage macromodel: finite gain-bandwidth and slew rate
        const mm = opampMacro(m);
        const nInt = internal();
        els.push({ t: "R", id: `${gid}.rint`, a: nInt, b: 0, r: mm.rint });
        els.push({ t: "C", id: `${gid}.cc`, a: nInt, b: 0, c: mm.cc });
        els.push({ t: "OA", id: gid, inn: n[0], inp: n[1], out: n[2], vcc: n[3], vee: n[4], int: nInt, m });
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
      els.push({ t: "AM", id: "dmm.am", a: dv, b: dc, r: 4.7 }); // mA-range shunt (burden)
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

  // nodes the student touched (cords, clips, instrument leads)
  const userNodes = new Set<number>();
  for (const w of s.wires) {
    userNodes.add(nodeOf(w.a));
    userNodes.add(nodeOf(w.b));
  }
  for (const [lead, jack] of Object.entries(s.leads)) if (jack) userNodes.add(nodeOf(lead));
  for (const p of s.customParts as CustomPart[]) for (const g of p.gpins) userNodes.add(nodeOf(g));
  const { circuit, probes: pr, tau, reactive, map } = prune({ nodeCount: next, elements: els }, probes, userNodes);
  hasReactive = reactive;
  const key = JSON.stringify([
    s.moduleId,
    s.wires.map((w) => [w.a, w.b]),
    s.leads,
    s.knobs,
    s.power,
    s.dmmMode,
    s.customParts.map((p) => [p.kind, p.value, p.model, p.gpins]),
    [...damaged],
    [...limited],
  ]);
  const nodeIndex = (id: string) => {
    const n0 = nodeOf(id);
    if (n0 === 0) return 0;
    return map.get(n0) ?? -1;
  };
  return { circuit, probes: pr, nodeOf, nodeIndex, activeFreqs, ledIds, hasReactive, tau, key };
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
  // reach steady state: several time constants (bounded by a step budget)
  let settle = b.hasReactive ? Math.min(Math.max(6 * T, 6 * b.tau), 1.0) : 2 * T;
  const dtSettle = Math.max(dt, 1 / (fmax * 80));
  settle = Math.min(settle, 60000 * dtSettle);
  settle = Math.ceil(settle / T) * T; // keep phase aligned
  return { tStop: settle + capture, tCapture: settle, dtMax: dt, dtSettle };
}

