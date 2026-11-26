/* Numerical sanity tests of the MNA solver against textbook results. Run: npm run test:sim */
import { runSimulation } from "../src/sim/solver";
import { DIODES, BJTS, OPAMPS, opampMacro } from "../src/sim/models";
import type { Element } from "../src/sim/types";

/** µA741 two-stage macromodel (internal node `int`) */
function opamp(id: string, inp: number, inn: number, out: number, vcc: number, vee: number, int: number): Element[] {
  const m = OPAMPS.UA741;
  const mm = opampMacro(m);
  return [
    { t: "R", id: `${id}.rint`, a: int, b: 0, r: mm.rint },
    { t: "C", id: `${id}.cc`, a: int, b: 0, c: mm.cc },
    { t: "OA", id, inp, inn, out, vcc, vee, int, m },
  ];
}
import type { Circuit, ProbeSpec } from "../src/sim/types";
import { measure } from "../src/sim/measure";

let failures = 0;
function check(name: string, got: number, want: number, tol: number) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: got ${got.toFixed(4)} want ${want} ±${tol}`);
}

function run(c: Circuit, probes: ProbeSpec[], tStop: number, tCap: number, dt: number) {
  const r = runSimulation({ seq: 1, circuit: c, probes, tStop, tCapture: tCap, dtMax: dt, maxPoints: 4000 });
  if (!r.ok) {
    failures++;
    console.log("SIM FAILED", r.message);
  }
  console.log(`   (${r.stats.steps} steps, ${r.stats.iterations} NR its, ${r.stats.ms.toFixed(0)} ms)`);
  return r;
}

// 1. Diode forward drop: 12 V -> 1k -> 1N4148
{
  const r = run(
    {
      nodeCount: 3,
      elements: [
        { t: "V", id: "v", a: 1, b: 0, w: { kind: "dc", v: 12 }, rs: 0 },
        { t: "R", id: "r", a: 1, b: 2, r: 1000 },
        { t: "D", id: "d", a: 2, k: 0, m: DIODES["1N4148"] },
      ],
    },
    [{ id: "vd", kind: "v", a: 2, b: 0 }, { id: "id", kind: "i", el: "d" }],
    0, 0, 1,
  );
  check("Si diode Vf @ ~11mA", r.op.vd, 0.72, 0.08);
  check("Si diode If (mA)", r.op.id * 1e3, 11.3, 0.3);
}

// 2. Zener regulation: 15 V -> 1k -> zener 10 V (reverse)
{
  const r = run(
    {
      nodeCount: 3,
      elements: [
        { t: "V", id: "v", a: 1, b: 0, w: { kind: "dc", v: 15 }, rs: 0 },
        { t: "R", id: "r", a: 1, b: 2, r: 1000 },
        { t: "D", id: "z", a: 0, k: 2, m: DIODES["1N4740"] },
      ],
    },
    [{ id: "vz", kind: "v", a: 2, b: 0 }],
    0, 0, 1,
  );
  check("Zener Vz", r.op.vz, 10.1, 0.25);
}

// 3. Half-wave rectifier 9 Vrms, 50 Hz, RL 1k
{
  const vp = 9 * Math.SQRT2;
  const r = run(
    {
      nodeCount: 3,
      elements: [
        { t: "V", id: "ac", a: 1, b: 0, w: { kind: "sine", amp: vp, freq: 50, offset: 0 }, rs: 0.5 },
        { t: "D", id: "d", a: 1, k: 2, m: DIODES["1N4001"] },
        { t: "R", id: "rl", a: 2, b: 0, r: 1000 },
      ],
    },
    [{ id: "vo", kind: "v", a: 2, b: 0 }],
    0.1, 0.06, 2e-5,
  );
  const m = measure(r.t, r.data.vo);
  check("HW rect Vdc ≈ (Vm-0.7)/π", m.mean, (vp - 0.7) / Math.PI, 0.25);
  check("HW rect Vmax", m.max, vp - 0.72, 0.15);
  check("HW rect frequency", m.freq, 50, 0.5);
}

// 4. Negative clamper: square ±5V 1 kHz, C 0.1u, diode to ground, R 1M
{
  const r = run(
    {
      nodeCount: 3,
      elements: [
        { t: "V", id: "sq", a: 1, b: 0, w: { kind: "square", amp: 5, freq: 1000, offset: 0 }, rs: 50 },
        { t: "C", id: "c1", a: 1, b: 2, c: 0.1e-6 },
        { t: "D", id: "d", a: 2, k: 0, m: DIODES["1N4148"] },
        { t: "R", id: "r", a: 2, b: 0, r: 1e6 },
      ],
    },
    [{ id: "vo", kind: "v", a: 2, b: 0 }],
    0.02, 0.015, 1e-6,
  );
  const m = measure(r.t, r.data.vo);
  check("Clamper max ≈ +0.6", m.max, 0.6, 0.25);
  check("Clamper min ≈ -9.4", m.min, -9.4, 0.4);
}

// 5. RC low-pass, sine 1 kHz, R 1k C 0.159u -> -3 dB
{
  const r = run(
    {
      nodeCount: 3,
      elements: [
        { t: "V", id: "s", a: 1, b: 0, w: { kind: "sine", amp: 5, freq: 1000, offset: 0 }, rs: 0 },
        { t: "R", id: "r", a: 1, b: 2, r: 1000 },
        { t: "C", id: "c", a: 2, b: 0, c: 0.159155e-6 },
      ],
    },
    [{ id: "vi", kind: "v", a: 1, b: 0 }, { id: "vo", kind: "v", a: 2, b: 0 }],
    0.01, 0.005, 1e-6,
  );
  const mo = measure(r.t, r.data.vo);
  check("RC -3dB amplitude ratio", mo.vpp / 10, 0.7071, 0.01);
}

// 6. Series RLC resonance: L 10mH C 1uF -> f0 = 1591.5 Hz, R 10
{
  const f0 = 1 / (2 * Math.PI * Math.sqrt(10e-3 * 1e-6));
  const r = run(
    {
      nodeCount: 4,
      elements: [
        { t: "V", id: "s", a: 1, b: 0, w: { kind: "sine", amp: 1, freq: f0, offset: 0 }, rs: 0 },
        { t: "L", id: "l", a: 1, b: 2, l: 10e-3 },
        { t: "C", id: "c", a: 2, b: 3, c: 1e-6 },
        { t: "R", id: "r", a: 3, b: 0, r: 10 },
      ],
    },
    [{ id: "vr", kind: "v", a: 3, b: 0 }],
    0.06, 0.05, 2e-6,
  );
  const m = measure(r.t, r.data.vr);
  check("RLC at resonance V_R ≈ V_in", m.vpp / 2, 1, 0.05);
}

// 7. CE amplifier, voltage divider bias
{
  const q = BJTS["2N3904"];
  const r = run(
    {
      nodeCount: 7,
      elements: [
        { t: "V", id: "vcc", a: 1, b: 0, w: { kind: "dc", v: 12 }, rs: 0 },
        { t: "V", id: "vs", a: 2, b: 0, w: { kind: "sine", amp: 0.01, freq: 1000, offset: 0 }, rs: 50 },
        { t: "C", id: "c1", a: 2, b: 3, c: 10e-6 },
        { t: "R", id: "r1", a: 1, b: 3, r: 47e3 },
        { t: "R", id: "r2", a: 3, b: 0, r: 10e3 },
        { t: "R", id: "rc", a: 1, b: 4, r: 2.2e3 },
        { t: "R", id: "re", a: 5, b: 0, r: 470 },
        { t: "C", id: "ce", a: 5, b: 0, c: 100e-6 },
        { t: "Q", id: "q", c: 4, b: 3, e: 5, m: q },
        { t: "C", id: "c2", a: 4, b: 6, c: 10e-6 },
        { t: "R", id: "rl", a: 6, b: 0, r: 100e3 },
      ],
    },
    [{ id: "vc", kind: "v", a: 4, b: 0 }, { id: "vo", kind: "v", a: 6, b: 0 }, { id: "vb", kind: "v", a: 3, b: 0 }],
    0.01, 0.007, 2e-6,
  );
  console.log("   Q-point VC =", r.op.vc.toFixed(3), " VB =", r.op.vb.toFixed(3));
  const m = measure(r.t, r.data.vo);
  const ic = (12 - r.op.vc) / 2200;
  const gm = ic / 0.02585;
  console.log("   gain =", (m.vpp / 0.02).toFixed(1), " theory ≈", (gm * 2200).toFixed(1));
  check("CE gain within 25% of gm*Rc", m.vpp / 0.02 / (gm * 2200), 1, 0.25);
}

// 8. Op-amp inverting amp gain -10
{
  const r = run(
    {
      nodeCount: 7,
      elements: [
        { t: "V", id: "vp", a: 4, b: 0, w: { kind: "dc", v: 12 }, rs: 0 },
        { t: "V", id: "vn", a: 5, b: 0, w: { kind: "dc", v: -12 }, rs: 0 },
        { t: "V", id: "s", a: 1, b: 0, w: { kind: "sine", amp: 0.5, freq: 1000, offset: 0 }, rs: 0 },
        { t: "R", id: "ri", a: 1, b: 2, r: 10e3 },
        { t: "R", id: "rf", a: 2, b: 3, r: 100e3 },
        ...opamp("u", 0, 2, 3, 4, 5, 6),
      ],
    },
    [{ id: "vo", kind: "v", a: 3, b: 0 }],
    0.004, 0.002, 2e-6,
  );
  const m = measure(r.t, r.data.vo);
  check("Inverting amp Vpp = 10", m.vpp, 10, 0.1);
  // saturation
  const r2 = run(
    {
      nodeCount: 7,
      elements: [
        { t: "V", id: "vp", a: 4, b: 0, w: { kind: "dc", v: 12 }, rs: 0 },
        { t: "V", id: "vn", a: 5, b: 0, w: { kind: "dc", v: -12 }, rs: 0 },
        { t: "V", id: "s", a: 1, b: 0, w: { kind: "sine", amp: 5, freq: 1000, offset: 0 }, rs: 0 },
        { t: "R", id: "ri", a: 1, b: 2, r: 10e3 },
        { t: "R", id: "rf", a: 2, b: 3, r: 100e3 },
        ...opamp("u", 0, 2, 3, 4, 5, 6),
      ],
    },
    [{ id: "vo", kind: "v", a: 3, b: 0 }],
    0.004, 0.002, 2e-6,
  );
  check("Op-amp saturates at +10.5", measure(r2.t, r2.data.vo).max, 10.5, 0.2);
}

// 8b. Slew rate: voltage follower, ±5 V 10 kHz square -> output edge slope = SR (0.5 V/µs)
{
  const r = run(
    {
      nodeCount: 6,
      elements: [
        { t: "V", id: "vp", a: 3, b: 0, w: { kind: "dc", v: 12 }, rs: 0 },
        { t: "V", id: "vn", a: 4, b: 0, w: { kind: "dc", v: -12 }, rs: 0 },
        { t: "V", id: "s", a: 1, b: 0, w: { kind: "square", amp: 5, freq: 10000, offset: 0 }, rs: 0 },
        ...opamp("u", 1, 2, 2, 3, 4, 5),
      ],
    },
    [{ id: "vo", kind: "v", a: 2, b: 0 }],
    0.0008, 0.0004, 0.1e-6,
  );
  const t = r.t,
    v = r.data.vo;
  let maxSlope = 0;
  for (let i = 10; i < t.length; i++) maxSlope = Math.max(maxSlope, Math.abs(v[i] - v[i - 10]) / (t[i] - t[i - 10]));
  check("741 slew rate (V/µs)", maxSlope / 1e6, 0.5, 0.06);
  check("follower reaches ±5 V", measure(r.t, r.data.vo).vpp, 10, 0.2);
}

// 8c. Gain-bandwidth: non-inverting gain 101 at 10 kHz -> |A| = 101/sqrt(1+(10k/9.9k)^2) ≈ 71
{
  const r = run(
    {
      nodeCount: 7,
      elements: [
        { t: "V", id: "vp", a: 4, b: 0, w: { kind: "dc", v: 12 }, rs: 0 },
        { t: "V", id: "vn", a: 5, b: 0, w: { kind: "dc", v: -12 }, rs: 0 },
        { t: "V", id: "s", a: 1, b: 0, w: { kind: "sine", amp: 0.01, freq: 10000, offset: 0 }, rs: 0 },
        { t: "R", id: "rf", a: 3, b: 2, r: 100e3 },
        { t: "R", id: "rg", a: 2, b: 0, r: 1e3 },
        ...opamp("u", 1, 2, 3, 4, 5, 6),
      ],
    },
    [{ id: "vo", kind: "v", a: 3, b: 0 }],
    0.003, 0.002, 0.2e-6,
  );
  const fc = 1e6 / 101;
  check("741 closed-loop gain @10kHz (GBW)", measure(r.t, r.data.vo).vpp / 0.02, 101 / Math.sqrt(1 + (10000 / fc) ** 2), 6);
}

// 9. Bridge rectifier with floating transformer & capacitor filter
{
  const vp = 18 * Math.SQRT2 / 2;
  const D = DIODES["1N4001"];
  const r = run(
    {
      nodeCount: 6,
      elements: [
        // centre tapped secondary: CT = node 5 floating (leak only)
        { t: "V", id: "s1", a: 1, b: 5, w: { kind: "sine", amp: vp, freq: 50, offset: 0 }, rs: 0.5 },
        { t: "V", id: "s2", a: 5, b: 2, w: { kind: "sine", amp: vp, freq: 50, offset: 0 }, rs: 0.5 },
        { t: "D", id: "d1", a: 1, k: 3, m: D },
        { t: "D", id: "d2", a: 2, k: 3, m: D },
        { t: "D", id: "d3", a: 0, k: 1, m: D },
        { t: "D", id: "d4", a: 0, k: 2, m: D },
        { t: "R", id: "rl", a: 3, b: 0, r: 1000 },
        { t: "C", id: "c", a: 3, b: 0, c: 220e-6 },
      ],
    },
    [{ id: "vo", kind: "v", a: 3, b: 0 }],
    0.3, 0.2, 2e-5,
  );
  const m = measure(r.t, r.data.vo);
  check("Bridge+C Vdc ≈ Vm-1.5-ripple/2", m.mean, 2 * vp - 1.6 - 1.0, 0.8);
  check("Bridge+C ripple freq 100 Hz", m.freq, 100, 2);
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);
