/* Applies each experiment step's reference wiring and simulates it. Run: npx tsx scripts/exp-test.ts */
import { EXPERIMENTS } from "../src/lab/experiments";
import { buildCircuit, planTiming } from "../src/lab/netlist";
import { runSimulation } from "../src/sim/solver";
import { measure } from "../src/sim/measure";
import { defaultKnobs, DEFAULT_LEADS, DEFAULT_SCOPE, type Snapshot } from "../src/store/bench";
import type { LeadId } from "../src/lab/types";

let fails = 0;
for (const ex of EXPERIMENTS) {
  let snap: Snapshot = {
    moduleId: ex.module, wires: [], leads: { ...DEFAULT_LEADS }, knobs: defaultKnobs(), power: true,
    scope: DEFAULT_SCOPE, dmmMode: "dcv", customParts: [],
  };
  for (const [i, st] of ex.steps.entries()) {
    if (st.wires) snap = { ...snap, wires: st.wires.map((w, k) => ({ id: "w" + k, a: w[0], b: w[1], color: w[2] ?? "red", kind: w[3] ?? "wire" })) };
    if (st.leads) snap = { ...snap, leads: { ...snap.leads, ...(st.leads as Record<LeadId, string | null>) } };
    if (st.knobs) snap = { ...snap, knobs: { ...snap.knobs, ...st.knobs } };
    if (st.dmmMode) snap = { ...snap, dmmMode: st.dmmMode };
    const tdiv = st.scope?.tdiv ?? 500e-6;
    const b = buildCircuit(snap);
    const tm = planTiming(b, tdiv);
    const r = runSimulation({ seq: 1, circuit: b.circuit, probes: b.probes, ...tm, maxPoints: 6000 });
    const f = (id: string) => {
      const d = r.data[id];
      if (!d) return "-";
      const m = measure(r.t, d);
      return `pp=${m.vpp.toFixed(3)} max=${m.max.toFixed(2)} min=${m.min.toFixed(2)} avg=${m.mean.toFixed(3)} f=${m.freq.toFixed(0)}`;
    };
    if (!r.ok) fails++;
    console.log(`${ex.id}.${i} ${r.ok ? "ok " : "ERR " + r.message} ${r.stats.ms.toFixed(0)}ms n=${r.stats.unknowns} steps=${r.stats.steps}`);
    console.log(`   ch1 ${f("ch1")}\n   ch2 ${f("ch2")}\n   dmm ${f("dmm")} dvm ${f("dvm.v")} m2 ${f("m2")}`);
  }
}
process.exit(fails ? 1 : 0);
