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
      {
        id: `${p}Q`,
        kind: pnp ? "PNP" : "NPN",
        model: pnp ? "2N2904" : "C1815",
        pins: [`${p}.c2`, `${p}.b2`, `${p}.e1`],
        at: [x(128), 120],
        label: pnp ? "Q2 PNP" : "Q1 NPN",
      },
    ],
    traces: [[`${p}.gnd`, `${p}.g1`], [`${p}.e2`, `${p}.g1`], [`${p}.b2`, `${p}.tb`]],
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
    j("a.vcc", 14, 34, "+12V", "e"),
    j("a.v1", 40, 34),
    j("a.v2", 66, 34),
    j("a.v3", 120, 34),
    j("a.r2", 40, 62),
    j("a.r1", 66, 62),
    j("a.in", 14, 90, "Vi", "n"),
    j("a.bA", 40, 90),
    j("a.bB", 66, 90),
    j("a.base", 94, 90, "B", "s"),
    j("a.r3", 40, 114),
    j("a.c", 120, 64, "C", "w"),
    j("a.c2", 146, 64),
    j("a.out", 176, 64, "Vo"),
    j("a.e", 120, 116, "E", "w"),
    j("a.re", 120, 140),
    j("a.cb", 150, 116),
    j("a.rl", 176, 90),
    j("a.gnd", 14, 154, "GND", "s"),
    j("a.g1", 40, 154),
    j("a.g2", 120, 154),
    j("a.g3", 150, 154),
    j("a.g4", 176, 154),
    // block b CB
    j("b.vcc", 198, 34, "+12V", "e"),
    j("b.v1", 232, 34),
    j("b.v2", 314, 34),
    j("b.r1", 232, 62),
    j("b.bA", 232, 90),
    j("b.bB", 256, 90),
    j("b.base", 288, 90, "B", "s"),
    j("b.r3", 232, 114),
    j("b.cb", 256, 114),
    j("b.c", 314, 64, "C", "w"),
    j("b.c2", 334, 64),
    j("b.out", 356, 64, "Vo"),
    j("b.e", 314, 116, "E", "w"),
    j("b.e2", 346, 104, "Ve", "n"),
    j("b.vb", 346, 128, "Vb", "e"),
    j("b.va", 346, 152, "Va", "e"),
    j("b.gnd", 198, 154, "GND", "s"),
    j("b.g1", 232, 154),
    j("b.g2", 256, 154),
    j("b.g3", 314, 154),
    // block c switch
    j("c.vcc", 14, 178, "+12V", "e"),
    j("c.v1", 86, 178),
    j("c.l", 86, 196),
    j("c.c", 86, 214, "C", "e"),
    j("c.in", 14, 226, "Vin", "n"),
    j("c.base", 54, 226, "B", "n"),
    j("c.e", 86, 240),
    j("c.gnd", 14, 240, "GND", "s"),
    // block d cascade
    j("d.vcc", 120, 176, "+12V", "e"),
    j("d.va", 172, 176),
    j("d.vb", 204, 176),
    j("d.vc", 270, 176),
    j("d.vd", 302, 176),
    j("d.vs", 120, 202, "Vs", "n"),
    j("d.vi", 146, 202, "Vi", "n"),
    j("d.b1", 172, 202, "B1", "w"),
    j("d.c1", 204, 196, "C1", "e"),
    j("d.c1b", 236, 196),
    j("d.e1", 204, 226),
    j("d.e1b", 226, 226),
    j("d.b2", 270, 196, "B2", "w"),
    j("d.c2", 302, 196, "C2", "e"),
    j("d.c2b", 328, 196),
    j("d.out", 354, 196, "Vo", "n"),
    j("d.e2", 302, 226),
    j("d.e2b", 324, 226),
    j("d.gnd", 120, 242, "GND", "s"),
    j("d.ga", 146, 242),
    j("d.gb", 204, 242),
    j("d.gc", 226, 242),
    j("d.gd", 302, 242),
    j("d.ge", 324, 242),
  ],
  parts: [
    // CE
    { id: "aR2", kind: "R", value: 39e3, pins: ["a.v1", "a.r2"], label: "R2", text: "39K" },
    { id: "aR1", kind: "R", value: 100e3, pins: ["a.v2", "a.r1"], label: "R1", text: "100K" },
    { id: "aC1", kind: "CP", value: 10e-6, pins: ["a.bA", "a.in"], label: "C1", text: "10μ" },
    { id: "aR3", kind: "R", value: 8.2e3, pins: ["a.r3", "a.g1"], label: "R3", text: "8.2K" },
    { id: "aRC", kind: "R", value: 2.2e3, pins: ["a.v3", "a.c"], label: "RC", text: "2.2K" },
    { id: "aQ", kind: "NPN", model: "2N3904", pins: ["a.c", "a.base", "a.e"], at: [108, 90], label: "Q1" },
    { id: "aC3", kind: "CP", value: 10e-6, pins: ["a.c2", "a.out"], label: "C3", text: "10μ" },
    { id: "aRE", kind: "R", value: 470, pins: ["a.e", "a.re"], label: "RE", text: "470Ω" },
    { id: "aC2", kind: "CP", value: 22e-6, pins: ["a.cb", "a.g3"], label: "C2", text: "22μ" },
    { id: "aRL", kind: "R", value: 10e3, pins: ["a.rl", "a.g4"], label: "RL", text: "10K" },
    // CB
    { id: "bR1", kind: "R", value: 22e3, pins: ["b.v1", "b.r1"], label: "R1", text: "22K" },
    { id: "bR2", kind: "R", value: 10e3, pins: ["b.r3", "b.g1"], label: "R2", text: "10K" },
    { id: "bCB", kind: "CP", value: 47e-6, pins: ["b.cb", "b.g2"], label: "CB", text: "47μ" },
    { id: "bRC", kind: "R", value: 2.2e3, pins: ["b.v2", "b.c"], label: "RC", text: "2.2K" },
    { id: "bQ", kind: "NPN", model: "2N3904", pins: ["b.c", "b.base", "b.e"], at: [302, 90], label: "Q2" },
    { id: "bCo", kind: "CP", value: 10e-6, pins: ["b.c2", "b.out"], label: "C4", text: "10μ" },
    { id: "bRE", kind: "R", value: 1e3, pins: ["b.e", "b.g3"], label: "RE", text: "1K" },
    { id: "bCi", kind: "CP", value: 47e-6, pins: ["b.vb", "b.e2"], label: "C5", text: "47μ" },
    { id: "bRab", kind: "R", value: 1e3, pins: ["b.va", "b.vb"], label: "Rab", text: "1K" },
    // switch
    { id: "cRC", kind: "R", value: 1e3, pins: ["c.v1", "c.l"], label: "R1", text: "1K" },
    { id: "cLED", kind: "LED", model: "LED_RED", pins: ["c.l", "c.c"], label: "LED", color: "#ff2a1a" },
    { id: "cRB", kind: "R", value: 10e3, pins: ["c.in", "c.base"], label: "RB", text: "10K" },
    { id: "cQ", kind: "NPN", model: "C1815", pins: ["c.c", "c.base", "c.e"], at: [72, 226], label: "Q3" },
    // cascade
    { id: "dRa", kind: "R", value: 100e3, pins: ["d.vs", "d.vi"], label: "Ra", text: "100K" },
    { id: "dRb", kind: "R", value: 100, pins: ["d.vi", "d.ga"], label: "Rb", text: "100Ω" },
    { id: "dC1", kind: "CP", value: 10e-6, pins: ["d.b1", "d.vi"], label: "C1", text: "10μ" },
    { id: "dVR5", kind: "RV", value: 1e6, min: 47e3, pins: ["d.va", "d.b1"], label: "VR4", text: "1M", knob: "m.vr5" },
    { id: "dRC1", kind: "R", value: 2.2e3, pins: ["d.vb", "d.c1"], label: "RC1", text: "2.2K" },
    { id: "dQ1", kind: "NPN", model: "2N3904", pins: ["d.c1", "d.b1", "d.e1"], at: [194, 211], label: "Q4" },
    { id: "dRE1", kind: "R", value: 470, pins: ["d.e1", "d.gb"], label: "RE1", text: "470" },
    { id: "dC3", kind: "CP", value: 47e-6, pins: ["d.e1b", "d.gc"], label: "C3", text: "47μ" },
    { id: "dC2", kind: "CP", value: 10e-6, pins: ["d.c1b", "d.b2"], label: "C2", text: "10μ" },
    { id: "dVR6", kind: "RV", value: 1e6, min: 47e3, pins: ["d.vc", "d.b2"], label: "VR3", text: "1M", knob: "m.vr6" },
    { id: "dRC2", kind: "R", value: 2.2e3, pins: ["d.vd", "d.c2"], label: "RC2", text: "2.2K" },
    { id: "dQ2", kind: "NPN", model: "2N3904", pins: ["d.c2", "d.b2", "d.e2"], at: [292, 211], label: "Q5" },
    { id: "dRE2", kind: "R", value: 470, pins: ["d.e2", "d.gd"], label: "RE2", text: "470" },
    { id: "dC4", kind: "CP", value: 47e-6, pins: ["d.e2b", "d.ge"], label: "C4", text: "47μ" },
    { id: "dC5", kind: "CP", value: 10e-6, pins: ["d.c2b", "d.out"], label: "C5", text: "10μ" },
  ],
  traces: [
    ["a.vcc", "a.v1", "a.v2", "a.v3"],
    ["a.bA", "a.bB", "a.base"],
    ["a.c", "a.c2"],
    ["a.gnd", "a.g1", "a.g2", "a.g3", "a.g4"],
    ["b.vcc", "b.v1", "b.v2"],
    ["b.bA", "b.bB", "b.base"],
    ["b.c", "b.c2"],
    ["b.e", [314, 104], "b.e2"],
    ["b.gnd", "b.g1", "b.g2", "b.g3"],
    ["c.vcc", "c.v1"],
    ["c.e", "c.gnd"],
    ["d.vcc", "d.va", "d.vb", "d.vc", "d.vd"],
    ["d.c1", "d.c1b"],
    ["d.c2", "d.c2b"],
    ["d.gnd", "d.ga", "d.gb", "d.gc", "d.gd", "d.ge"],
  ],
  earth: ["a.gnd", "b.gnd", "c.gnd", "d.gnd"],
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
    // integrator
    j("b.vi", 196, 64, "Vi", "n"),
    j("b.inn", 236, 64),
    j("b.f1", 236, 38),
    j("b.f2", 300, 38),
    j("b.rf1", 236, 52),
    j("b.rf2", 300, 52),
    j("b.out", 300, 74, "Vo", "n"),
    // differentiator
    j("b.vi2", 196, 104, "Vi", "s"),
    j("b.inn2", 248, 104),
    { id: "b.dm", x: 220, y: 104, hidden: true },
    j("b.g2f1", 248, 128),
    j("b.out2", 352, 112, "Vo", "s"),
    j("b.ff1", 320, 128),
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
    { id: "bU", kind: "OA", model: "UA741", pins: ["b.inn", "b.g2f1", "b.out", "@+12", "@-12"], at: [270, 74], label: "U2" },
    { id: "bC2", kind: "C", value: 0.1e-6, pins: ["b.vi2", "b.dm"], label: "C2", text: "0.1μ" },
    { id: "bR5", kind: "R", value: 1e3, pins: ["b.dm", "b.inn2"], label: "R5", text: "1K" },
    { id: "bR4", kind: "R", value: 10e3, pins: ["b.inn2", "b.ff1"], label: "R4", text: "10K" },
    { id: "bU3", kind: "OA", model: "UA741", pins: ["b.inn2", "b.g2f1", "b.out2", "@+12", "@-12"], at: [290, 112], label: "U3" },
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
    ["b.inn", "b.f1"],
    ["b.inn", "b.rf1"],
    ["b.f2", "b.rf2", "b.out"],
    ["b.gnd", "b.g2f1"],
    ["b.ff1", [352, 128], "b.out2"],
    ["c.g", "c.h"],
    ["c.gnd", "c.g1", "c.g2", "c.g3", "c.g4", "c.g5"],
  ],
  earth: ["a.gnd", "b.gnd", "c.gnd"],
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
