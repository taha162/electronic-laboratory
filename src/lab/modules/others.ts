import type { JackDef, ModuleDef, PartDef, TraceDef } from "../types";

const j = (id: string, x: number, y: number, label?: string, lp: JackDef["lp"] = "n"): JackDef => ({
  id,
  x,
  y,
  label,
  lp,
  style: "pin",
});

/* ------------------------------------------------------------------ */
/* KL-23002 TRANSISTOR CHARACTERISTICS (Experiment 4)                  */
/* ------------------------------------------------------------------ */
function bjtBlock(p: string, dx: number, pnp: boolean): { jacks: JackDef[]; parts: PartDef[]; traces: TraceDef[] } {
  const x = (v: number) => v + dx;
  const s = pnp ? "VEE" : "VCC";
  return {
    jacks: [
      j(`${p}.vbb`, x(20), 120, pnp ? "-VBB" : "VBB", "n"),
      j(`${p}.b1`, x(70), 120, "", "n"),
      j(`${p}.b2`, x(96), 120, "B", "n"),
      j(`${p}.vcc`, x(140), 40, pnp ? `-${s}` : s, "w"),
      j(`${p}.c1`, x(140), 70, "", "w"),
      // R3 1K (Fig. 4.3) beside R4 100Ω (Fig. 4.5): wire the one you need to the IC ammeter
      j(`${p}.v3`, x(164), 40),
      j(`${p}.c3`, x(164), 70),
      j(`${p}.c2`, x(140), 96, "C", "e"),
      j(`${p}.e1`, x(140), 146, "E", "e"),
      j(`${p}.e2`, x(140), 172, "", "e"),
      j(`${p}.gnd`, x(20), 206, "GND", "s"),
      j(`${p}.g1`, x(140), 206),
      j(`${p}.tb`, x(96), 160, "TP B", "s"),
    ],
    parts: [
      { id: `${p}R1`, kind: "R", value: 47e3, pins: [`${p}.vbb`, `${p}.b1`], label: "R1", text: "47K" },
      { id: `${p}R4`, kind: "R", value: 100, pins: [`${p}.vcc`, `${p}.c1`], label: "R4", text: "100Ω" },
      { id: `${p}R3`, kind: "R", value: 1e3, pins: [`${p}.v3`, `${p}.c3`], label: "R3", text: "1K" },
      {
        id: `${p}Q`,
        kind: pnp ? "PNP" : "NPN",
        model: pnp ? "2N2904" : "C1815",
        pins: [`${p}.c2`, `${p}.b2`, `${p}.e1`],
        at: [x(128), 120],
        label: pnp ? "Q2 PNP" : "Q1 NPN",
      },
    ],
    traces: [[`${p}.gnd`, `${p}.g1`], [`${p}.e2`, `${p}.g1`], [`${p}.b2`, `${p}.tb`], [`${p}.vcc`, `${p}.v3`]],
  };
}
const bA = bjtBlock("a", 0, false);
const bB = bjtBlock("b", 184, true);

export const KL23002: ModuleDef = {
  id: "kl23002",
  code: "KL-23002",
  title: "TRANSISTOR CHARACTERISTICS MODULE",
  name: { en: "KL-23002 Transistor Characteristics", ar: "KL-23002 خواص الترانزستور" },
  size: [368, 252],
  blocks: [
    { id: "a", label: "block a  (NPN)", rect: [6, 24, 172, 222] },
    { id: "b", label: "block b  (PNP)", rect: [190, 24, 172, 222] },
  ],
  jacks: [...bA.jacks, ...bB.jacks],
  parts: [...bA.parts, ...bB.parts],
  traces: [...bA.traces, ...bB.traces],
  earth: ["a.gnd", "b.gnd"],
  texts: [
    { x: 83, y: 104, text: "IB", size: 3.2, bold: true },
    { x: 152, y: 84, text: "IC", size: 3.2, bold: true, align: "left" },
    { x: 152, y: 160, text: "IE", size: 3.2, bold: true, align: "left" },
    { x: 267, y: 104, text: "IB", size: 3.2, bold: true },
    { x: 336, y: 84, text: "IC", size: 3.2, bold: true, align: "left" },
    { x: 336, y: 160, text: "IE", size: 3.2, bold: true, align: "left" },
  ],
};

/* ------------------------------------------------------------------ */
/* KL-23003 TRANSISTOR AMPLIFIER CIRCUIT (Experiments 5, 6)            */
/* ------------------------------------------------------------------ */
export const KL23003: ModuleDef = {
  id: "kl23003",
  code: "KL-23003",
  title: "TRANSISTOR AMPLIFIER CIRCUIT MODULE",
  name: { en: "KL-23003 Transistor Amplifier", ar: "KL-23003 مكبر الترانزستور" },
  size: [368, 252],
  blocks: [
    { id: "a", label: "block a  (C.E.)", rect: [6, 24, 180, 140] },
    { id: "b", label: "block b  (C.B.)", rect: [190, 24, 172, 140] },
    { id: "c", label: "block c", rect: [6, 168, 100, 80] },
    { id: "d", label: "block d", rect: [110, 168, 252, 80] },
  ],
  jacks: [
    // block a CE
    // block a — common emitter, Figs. 5.3 (fixed bias), 5.4 (emitter bias), 5.5 (divider bias)
    j("a.vcc", 14, 34, "+12V", "e"),
    j("a.vt1", 40, 34),
    j("a.vc1", 100, 34),
    j("a.vc2", 128, 34),
    j("a.vc3", 156, 34),
    j("a.r1t", 40, 58),
    j("a.c33", 100, 58),
    j("a.c22", 128, 58),
    j("a.c47", 156, 58),
    j("a.c", 120, 80, "C", "w"),
    j("a.out", 176, 80, "Vo", "n"),
    j("a.vi", 14, 96, "Vi", "n"),
    j("a.bb", 40, 96),
    j("a.ib", 62, 96, "IB", "n"),
    j("a.b", 92, 96, "B", "s"),
    j("a.eg", 100, 114, "GND", "s"),
    j("a.e", 120, 114, "E", "e"),
    j("a.v2t", 40, 116),
    j("a.r7t", 120, 132),
    j("a.c2t", 146, 132),
    j("a.v2b", 40, 136),
    j("a.gnd", 14, 156, "GND", "s"),
    j("a.g1", 40, 156),
    j("a.g2", 120, 156),
    j("a.g3", 146, 156),
    // block b — common base, Fig. 6.1
    j("b.vcc", 198, 34, "+12V", "e"),
    j("b.vt1", 262, 34),
    j("b.vt2", 326, 34),
    j("b.rt", 262, 64),
    j("b.rc", 326, 58),
    j("b.c", 306, 74, "C", "w"),
    j("b.out", 352, 74, "Vo", "n"),
    j("b.gv", 230, 96, "GND", "s"),
    j("b.b", 262, 96),
    j("b.b2", 262, 112),
    j("b.e", 306, 118, "E", "e"),
    j("b.gc", 262, 128, "GND", "e"),
    j("b.vi", 198, 144, "Vi", "n"),
    j("b.n1", 220, 144),
    j("b.vb", 246, 144, "Vb", "n"),
    j("b.va", 282, 144, "Va", "n"),
    j("b.gnd", 198, 158, "GND", "s"),
    j("b.g2", 246, 158),
    // block c — transistor as a switch, Fig. 6.2
    j("c.vcc", 14, 178, "+12V", "e"),
    j("c.vt", 80, 178),
    j("c.rc", 80, 196),
    j("c.c", 80, 210, "OUT", "e"),
    j("c.in", 14, 226, "IN", "n"),
    j("c.rb", 38, 226),
    j("c.b", 58, 226, "B", "s"),
    j("c.e", 80, 242),
    j("c.gnd", 14, 242, "GND", "s"),
    // block d: two-stage RC-coupled amplifier exactly as Fig. 6.3 of the lab manual
    j("d.vcc", 120, 176, "+12V", "e"),
    j("d.va", 166, 176),
    j("d.vb", 204, 176),
    j("d.vc", 250, 176),
    j("d.vd", 302, 176),
    j("d.vi", 120, 204, "Vi", "n"),
    j("d.r1", 142, 204),
    j("d.b1", 166, 204),
    j("d.c1", 204, 196, "C1", "e"),
    j("d.c1b", 226, 196),
    j("d.e1", 204, 226),
    j("d.b2", 250, 196),
    j("d.c2", 302, 196, "C2", "e"),
    j("d.out", 354, 196, "Vout1", "n"),
    j("d.e2", 302, 226),
    j("d.e2b", 326, 226),
    j("d.gnd", 120, 242, "GND", "s"),
    j("d.ga", 166, 242),
    j("d.gb", 204, 242),
    j("d.gc", 250, 242),
    j("d.gd", 302, 242),
    j("d.ge", 326, 242),
  ],
  parts: [
    // CE
    // block a
    { id: "aVR4", kind: "EXT", ext: "rheostat", pins: ["a.vt1", "a.r1t"], label: "VR4", text: "KL-21001" },
    { id: "aR1", kind: "R", value: 47e3, pins: ["a.r1t", "a.bb"], label: "R1", text: "47K" },
    { id: "aC1", kind: "CP", value: 22e-6, pins: ["a.bb", "a.vi"], label: "C1", text: "22μ" },
    { id: "aR5", kind: "R", value: 3.3e3, pins: ["a.vc1", "a.c33"], label: "R5", text: "3.3K" },
    { id: "aR6", kind: "R", value: 2.2e3, pins: ["a.vc2", "a.c22"], label: "R6", text: "2.2K" },
    { id: "aR4", kind: "R", value: 4.7e3, pins: ["a.vc3", "a.c47"], label: "R4", text: "4.7K" },
    { id: "aQ", kind: "NPN", model: "2N3904", pins: ["a.c", "a.b", "a.e"], at: [114, 96], label: "Q1" },
    { id: "aVR2", kind: "EXT", ext: "rheostat", pins: ["a.v2t", "a.v2b"], label: "VR2", text: "KL-21001" },
    { id: "aR2", kind: "R", value: 1e3, pins: ["a.v2b", "a.g1"], label: "R2", text: "1K" },
    { id: "aR7", kind: "R", value: 1e3, pins: ["a.r7t", "a.g2"], label: "R7", text: "1K" },
    { id: "aC2", kind: "CP", value: 22e-6, pins: ["a.c2t", "a.g3"], label: "C2", text: "22μ" },
    // block b
    { id: "bR3", kind: "R", value: 22e3, pins: ["b.vt1", "b.rt"], label: "R3", text: "22K" },
    { id: "bVR", kind: "EXT", ext: "rheostat", pins: ["b.gv", "b.b"], label: "VR2", text: "KL-21001" },
    { id: "bC2", kind: "CP", value: 100e-6, pins: ["b.b2", "b.gc"], label: "C2", text: "100μ" },
    { id: "bR4", kind: "R", value: 3.3e3, pins: ["b.vt2", "b.rc"], label: "R4", text: "3.3K" },
    { id: "bQ", kind: "NPN", model: "2N3904", pins: ["b.c", "b.b", "b.e"], at: [300, 96], label: "T4" },
    { id: "bC1", kind: "CP", value: 10e-6, pins: ["b.n1", "b.vi"], label: "C1", text: "10μ" },
    { id: "bR1", kind: "R", value: 2.2e3, pins: ["b.n1", "b.vb"], label: "R1", text: "2.2K" },
    { id: "bR2", kind: "R", value: 220, pins: ["b.vb", "b.g2"], label: "R2", text: "220Ω" },
    { id: "bR5", kind: "R", value: 100, pins: ["b.vb", "b.va"], label: "R5", text: "100Ω" },
    // block c
    { id: "cR17", kind: "R", value: 2.2e3, pins: ["c.vt", "c.rc"], label: "R17", text: "2.2K" },
    { id: "cR15", kind: "R", value: 22e3, pins: ["c.in", "c.rb"], label: "R15", text: "22K" },
    { id: "cQ", kind: "NPN", model: "C1815", pins: ["c.c", "c.b", "c.e"], at: [74, 226], label: "Q3" },
    { id: "dR1", kind: "R", value: 1e3, pins: ["d.vi", "d.r1"], label: "R1", text: "1K" },
    { id: "dC1", kind: "CP", value: 4.7e-6, pins: ["d.b1", "d.r1"], label: "C1", text: "4.7μ" },
    // VR4 (1MΩ) of the KL-21001 from +12V to the base of Q1
    { id: "dVR4", kind: "EXT", ext: "rheostat", pins: ["d.va", "d.b1"], label: "VR4", text: "KL-21001" },
    { id: "dR2", kind: "R", value: 150e3, pins: ["d.b1", "d.ga"], label: "R2", text: "150K" },
    { id: "dR3", kind: "R", value: 10e3, pins: ["d.vb", "d.c1"], label: "R3", text: "10K" },
    { id: "dQ1", kind: "NPN", model: "2N3904", pins: ["d.c1", "d.b1", "d.e1"], at: [190, 211], label: "Q1" },
    { id: "dR4", kind: "R", value: 5.1e3, pins: ["d.e1", "d.gb"], label: "R4", text: "5.1K" },
    { id: "dC2", kind: "CP", value: 10e-6, pins: ["d.c1b", "d.b2"], label: "C2", text: "10μ" },
    { id: "dR5", kind: "R", value: 220e3, pins: ["d.vc", "d.b2"], label: "R5", text: "220K" },
    // VR3 (100KΩ) of the KL-21001 from the base of Q2 to ground
    { id: "dVR3", kind: "EXT", ext: "rheostat", pins: ["d.b2", "d.gc"], label: "VR3", text: "KL-21001" },
    { id: "dR7", kind: "R", value: 3.3e3, pins: ["d.vd", "d.c2"], label: "R7", text: "3.3K" },
    { id: "dQ2", kind: "NPN", model: "2N3904", pins: ["d.c2", "d.b2", "d.e2"], at: [288, 211], label: "Q2" },
    { id: "dR8", kind: "R", value: 1e3, pins: ["d.e2", "d.gd"], label: "R8", text: "1K" },
    { id: "dC3", kind: "CP", value: 47e-6, pins: ["d.e2b", "d.ge"], label: "C3", text: "47μ" },
  ],
  traces: [
    ["a.vcc", "a.vt1", "a.vc1", "a.vc2", "a.vc3"],
    ["a.bb", "a.ib"],
    ["a.bb", "a.v2t"],
    ["a.c", "a.out"],
    ["a.gnd", "a.g1", "a.g2", "a.g3"],
    ["b.vcc", "b.vt1", "b.vt2"],
    ["b.rt", "b.b", "b.b2"],
    ["b.c", "b.out"],
    ["b.gnd", "b.g2"],
    ["c.vcc", "c.vt"],
    ["c.e", "c.gnd"],
    ["d.vcc", "d.va", "d.vb", "d.vc", "d.vd"],
    ["d.c1", "d.c1b"],
    ["d.c2", "d.out"],
    ["d.gnd", "d.ga", "d.gb", "d.gc", "d.gd", "d.ge"],
  ],
  // small ground sockets next to the parts that need them are wired to the board's GND
  earth: ["a.gnd", "a.eg", "b.gnd", "b.gv", "b.gc", "c.gnd", "d.gnd"],
};

/* ------------------------------------------------------------------ */
/* KL-25001 OP-AMP, INTEGRAL/DIFFERENTIAL & RLC MODULE                 */
/* ------------------------------------------------------------------ */
export const KL25001: ModuleDef = {
  id: "kl25001",
  code: "KL-25001",
  title: "OP-AMP, DIFFERENTIAL & INTEGRAL CIRCUIT MODULE",
  name: { en: "KL-25001 Op-Amp & RLC", ar: "KL-25001 المضخم العملياتي و RLC" },
  size: [368, 252],
  blocks: [
    { id: "a", label: "block a  (Amplifier)", rect: [6, 24, 176, 110] },
    { id: "b", label: "block b  (Integrator / Differentiator)", rect: [186, 24, 176, 110] },
    { id: "c", label: "block c  (R-L-C)", rect: [6, 138, 356, 108] },
  ],
  jacks: [
    j("a.vi", 16, 74, "Vi", "n"),
    j("a.inn", 64, 74),
    j("a.f1", 64, 40),
    j("a.f2", 140, 40),
    j("a.inp", 64, 100, "+IN", "w"),
    j("a.out", 140, 86, "Vo", "n"),
    j("a.out2", 168, 86),
    j("a.rl", 168, 108),
    j("a.gnd", 16, 124, "GND", "s"),
    j("a.g1", 64, 124),
    j("a.g2", 168, 124),
    // integrator (top): R2 into U2's inverting input, C1 ‖ R3 feedback, + input grounded below it
    j("b.vi", 196, 62, "Vi", "n"),
    j("b.inn", 236, 62),
    j("b.f1", 236, 34),
    j("b.f2", 316, 34),
    j("b.rf1", 236, 48),
    j("b.rf2", 316, 48),
    j("b.out", 316, 66, "Vo", "e"),
    j("b.g1", 256, 82, "GND", "e"),
    // differentiator (bottom): C2 + R5 into U3's inverting input, R4 feedback above U3
    j("b.vi2", 196, 108, "Vi", "n"),
    { id: "b.dm", x: 220, y: 108, hidden: true },
    j("b.inn2", 248, 108),
    j("b.f3", 248, 96),
    j("b.f4", 326, 96),
    j("b.out2", 346, 112, "Vo", "n"),
    j("b.g2", 262, 128),
    j("b.gnd", 196, 128, "GND", "s"),
    // RLC
    j("c.in", 16, 168, "IN", "n"),
    j("c.a", 64, 168),
    j("c.b", 88, 168),
    j("c.c", 140, 168),
    j("c.d", 164, 168),
    j("c.e", 216, 168, "", "n"),
    j("c.f", 240, 168),
    j("c.g", 292, 168, "", "n"),
    j("c.h", 316, 168, "OUT", "n"),
    j("c.l2a", 88, 210),
    j("c.l2b", 140, 210),
    j("c.c2a", 164, 210),
    j("c.c2b", 216, 210),
    j("c.gnd", 16, 236, "GND", "s"),
    j("c.g1", 64, 236),
    j("c.g2", 140, 236),
    j("c.g3", 216, 236),
    j("c.g4", 292, 236),
    j("c.g5", 316, 236),
  ],
  parts: [
    { id: "aR1", kind: "R", value: 10e3, pins: ["a.vi", "a.inn"], label: "R1", text: "10K" },
    { id: "aRf", kind: "R", value: 100e3, pins: ["a.f1", "a.f2"], label: "Rf", text: "100K" },
    { id: "aU", kind: "OA", model: "UA741", pins: ["a.inn", "a.inp", "a.out", "@+12", "@-12"], at: [100, 86], label: "U1 741" },
    { id: "aRL", kind: "R", value: 10e3, pins: ["a.rl", "a.g2"], label: "RL", text: "10K" },
    { id: "bR", kind: "R", value: 10e3, pins: ["b.vi", "b.inn"], label: "R2", text: "10K" },
    { id: "bC", kind: "C", value: 0.1e-6, pins: ["b.f1", "b.f2"], label: "C1", text: "0.1μ" },
    { id: "bRf", kind: "R", value: 1e6, pins: ["b.rf1", "b.rf2"], label: "R3", text: "1M" },
    { id: "bU", kind: "OA", model: "UA741", pins: ["b.inn", "b.g1", "b.out", "@+12", "@-12"], at: [276, 66], label: "U2" },
    { id: "bC2", kind: "C", value: 0.1e-6, pins: ["b.vi2", "b.dm"], label: "C2", text: "0.1μ" },
    { id: "bR5", kind: "R", value: 1e3, pins: ["b.dm", "b.inn2"], label: "R5", text: "1K" },
    { id: "bR4", kind: "R", value: 10e3, pins: ["b.f3", "b.f4"], label: "R4", text: "10K" },
    { id: "bU3", kind: "OA", model: "UA741", pins: ["b.inn2", "b.g2", "b.out2", "@+12", "@-12"], at: [288, 112], label: "U3" },
    { id: "cR", kind: "R", value: 1e3, pins: ["c.in", "c.a"], label: "R1", text: "1K" },
    { id: "cL", kind: "L", value: 10e-3, pins: ["c.b", "c.c"], label: "L1", text: "10mH" },
    { id: "cC", kind: "C", value: 0.1e-6, pins: ["c.d", "c.e"], label: "C1", text: "0.1μ" },
    { id: "cR2", kind: "R", value: 100, pins: ["c.f", "c.g"], label: "R2", text: "100Ω" },
    { id: "cL2", kind: "L", value: 100e-3, pins: ["c.l2a", "c.l2b"], label: "L2", text: "100mH" },
    { id: "cC2", kind: "C", value: 0.01e-6, pins: ["c.c2a", "c.c2b"], label: "C2", text: "0.01μ" },
  ],
  traces: [
    ["a.inn", "a.f1"],
    ["a.f2", "a.out"],
    ["a.out", "a.out2"],
    ["a.gnd", "a.g1", "a.g2"],
    ["b.inn", "b.rf1", "b.f1"],
    ["b.f2", "b.rf2", "b.out"],
    ["b.inn2", "b.f3"],
    ["b.f4", [326, 112], "b.out2"],
    ["b.gnd", "b.g2"],
    ["c.g", "c.h"],
    ["c.gnd", "c.g1", "c.g2", "c.g3", "c.g4", "c.g5"],
  ],
  // U2's + input is hard-wired to ground through the board, like the GND rails
  earth: ["a.gnd", "b.gnd", "b.g1", "c.gnd"],
};

/* ------------------------------------------------------------------ */
/* Universal breadboard (custom circuits)                              */
/* ------------------------------------------------------------------ */
const BB_COLS = 30;
const BB_PITCH = 10.4;
const BB_X0 = 30;
function buildBreadboard(): ModuleDef {
  const jacks: JackDef[] = [];
  const traces: TraceDef[] = [];
  const rows = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
  for (let c = 0; c < BB_COLS; c++) {
    const x = BB_X0 + c * BB_PITCH;
    const top: string[] = [];
    const bot: string[] = [];
    rows.forEach((r, i) => {
      const y = i < 5 ? 70 + i * 10.4 : 70 + i * 10.4 + 16;
      const id = `bb.${r}${c + 1}`;
      jacks.push({ id, x, y, style: "pin", label: i === 0 || i === 9 ? `${c + 1}` : undefined, lp: i === 0 ? "n" : "s" });
      (i < 5 ? top : bot).push(id);
    });
    traces.push(top, bot);
  }
  const rail = (name: string, y: number, label: string) => {
    const ids: string[] = [];
    for (let c = 0; c < BB_COLS; c++) {
      const id = `bb.${name}${c + 1}`;
      jacks.push({ id, x: BB_X0 + c * BB_PITCH, y, style: "pin" });
      ids.push(id);
    }
    traces.push(ids);
    jacks.push({ id: `bb.${name}`, x: 14, y, style: "pin", label, lp: "n" });
    traces.push([`bb.${name}`, ids[0]]);
  };
  rail("tp", 30, "+");
  rail("tn", 44, "−");
  rail("bp", 218, "+");
  rail("bn", 232, "−");
  return {
    id: "breadboard",
    code: "KL-BB",
    title: "UNIVERSAL CIRCUIT BOARD",
    name: { en: "Universal breadboard (custom circuits)", ar: "لوحة تجميع حرة (دوائر مخصصة)" },
    size: [368, 252],
    blocks: [{ id: "bb", label: "custom", rect: [6, 22, 356, 224] }],
    jacks,
    parts: [],
    traces,
    breadboard: true,
  };
}
export const BREADBOARD = buildBreadboard();
