/**
 * KL-21001 LINEAR CIRCUIT LAB main unit — panel layout (mm).
 * u: left -> right (0..W), v: back (top of panel) -> front (0..H)
 */
import type { JackDef } from "./types";

export const TRAINER_W = 600;
export const TRAINER_H = 430;

/** module slot (where the experiment module plate sits) */
export const MODULE_SLOT = { x: 128, y: 98, w: 372, h: 256 };

export const TRAINER_JACKS: JackDef[] = [
  // digital DC meter
  { id: "dvm.v", x: 38, y: 84, label: "DC VOLTAGE", lp: "s", style: "red" },
  { id: "dvm.com", x: 78, y: 84, label: "COM", lp: "s", style: "black" },
  { id: "dvm.a", x: 118, y: 84, label: "DC CURRENT", lp: "s", style: "red" },
  // analog meters (- , +)
  { id: "m1.n", x: 196, y: 84, label: "0", lp: "s", style: "black" },
  { id: "m1.p", x: 252, y: 84, label: "+30V", lp: "s", style: "red" },
  { id: "m2.n", x: 302, y: 84, label: "0", lp: "s", style: "black" },
  { id: "m2.p", x: 358, y: 84, label: "+100mA", lp: "s", style: "red" },
  { id: "m3.n", x: 408, y: 84, label: "0", lp: "s", style: "black" },
  { id: "m3.p", x: 464, y: 84, label: "15V", lp: "s", style: "red" },
  { id: "m4.n", x: 514, y: 84, label: "0", lp: "s", style: "black" },
  { id: "m4.p", x: 570, y: 84, label: "100mA", lp: "s", style: "red" },
  // function generator
  { id: "fg.ttl", x: 26, y: 126, label: "TTL", lp: "n", style: "yellow" },
  { id: "fg.gnd", x: 62, y: 126, label: "GND", lp: "n", style: "green" },
  { id: "fg.out", x: 98, y: 126, label: "OUTPUT", lp: "n", style: "red" },
  // speaker
  { id: "spk.p", x: 532, y: 128, label: "+", lp: "w", style: "red" },
  { id: "spk.n", x: 532, y: 146, label: "-", lp: "w", style: "black" },
  // AC source (centre-tapped transformer secondary)
  { id: "ac.a", x: 526, y: 186, label: "9V", lp: "n", style: "red" },
  { id: "ac.ct", x: 552, y: 186, label: "0V", lp: "n", style: "white" },
  { id: "ac.b", x: 578, y: 186, label: "9V", lp: "n", style: "red" },
  // fixed DC power
  { id: "ps.p5", x: 532, y: 236, label: "+5V", lp: "w", style: "red" },
  { id: "ps.m5", x: 572, y: 236, label: "-5V", lp: "e", style: "blue" },
  { id: "ps.gnd", x: 532, y: 258, label: "GND", lp: "w", style: "black" },
  { id: "ps.p12", x: 532, y: 280, label: "+12V", lp: "w", style: "yellow" },
  { id: "ps.m12", x: 572, y: 280, label: "-12V", lp: "e", style: "white" },
  // adjustable power
  { id: "adj.vm", x: 526, y: 330, label: "V-", lp: "n", style: "blue" },
  { id: "adj.gnd", x: 552, y: 330, label: "GND", lp: "n", style: "black" },
  { id: "adj.vp", x: 578, y: 330, label: "V+", lp: "n", style: "red" },
  // potentiometers VR1..VR4 (A, B=wiper, C)
  ...[1, 2, 3, 4].flatMap((k) => {
    const x0 = 150 + (k - 1) * 92;
    return [
      { id: `vr${k}.a`, x: x0 + 34, y: 404, label: "A", lp: "n" as const, style: "black" as const },
      { id: `vr${k}.b`, x: x0 + 50, y: 404, label: "B", lp: "n" as const, style: "black" as const },
      { id: `vr${k}.c`, x: x0 + 66, y: 404, label: "C", lp: "n" as const, style: "black" as const },
    ];
  }),
];

export interface KnobDef {
  id: string;
  x: number;
  y: number;
  r: number;
  label: string;
  /** number of detent positions (0 = continuous) */
  detents?: number;
  /** labels printed around a detent knob */
  marks?: string[];
  minLabel?: string;
  maxLabel?: string;
  /** default value 0..1 (continuous) or index (detent) */
  def: number;
}

export const TRAINER_KNOBS: KnobDef[] = [
  { id: "fg.func", x: 62, y: 178, r: 13, label: "FUNCTION", detents: 3, marks: ["∿", "⋀", "⊓"], def: 0 },
  { id: "fg.range", x: 62, y: 234, r: 13, label: "RANGE", detents: 6, marks: ["1", "10", "100", "1k", "10k", "100k"], def: 3 },
  { id: "fg.amp", x: 62, y: 292, r: 13, label: "AMPLITUDE", minLabel: "min.", maxLabel: "max.", def: 0.7071 },
  { id: "fg.freq", x: 62, y: 350, r: 13, label: "FREQUENCY", minLabel: "min.", maxLabel: "max.", def: 0.4 },
  { id: "adj.v", x: 552, y: 386, r: 13, label: "", minLabel: "min.", maxLabel: "max.", def: 0 },
  { id: "vr1", x: 150 + 0 * 92 + 16, y: 384, r: 11, label: "VR1 1KΩ", def: 0.5 },
  { id: "vr2", x: 150 + 1 * 92 + 16, y: 384, r: 11, label: "VR2 10KΩ", def: 0.5 },
  { id: "vr3", x: 150 + 2 * 92 + 16, y: 384, r: 11, label: "VR3 100KΩ", def: 0.5 },
  { id: "vr4", x: 150 + 3 * 92 + 16, y: 384, r: 11, label: "VR4 1MΩ", def: 0.5 },
];

export const VR_VALUES: Record<string, number> = { vr1: 1e3, vr2: 10e3, vr3: 100e3, vr4: 1e6 };

/** analog meter windows */
export const TRAINER_METERS = [
  { id: "m1", x: 168, y: 18, w: 104, h: 58, title: "DC VOLTAGE METER", unit: "V", full: 30, kind: "dcv" as const },
  { id: "m2", x: 274, y: 18, w: 104, h: 58, title: "DC CURRENT METER", unit: "mA", full: 100, kind: "dca" as const },
  { id: "m3", x: 380, y: 18, w: 104, h: 58, title: "AC VOLTAGE METER", unit: "V", full: 15, kind: "acv" as const },
  { id: "m4", x: 486, y: 18, w: 104, h: 58, title: "AC CURRENT METER", unit: "mA", full: 100, kind: "aca" as const },
];

export const DVM_RECT = { x: 18, y: 26, w: 120, h: 40 };

/** Function generator: range multipliers and dial mapping */
export const FG_RANGES = [1, 10, 100, 1e3, 10e3, 100e3];
export function fgFrequency(rangeIdx: number, dial: number) {
  // dial 0..1 -> 0.1 .. 2.35 x range (1 kHz at range 1k, dial 0.4)
  return FG_RANGES[rangeIdx] * (0.1 + dial * 2.25);
}
export function fgAmplitudeVpp(dial: number) {
  // square-law (audio-taper style) amplitude pot: 0..20 Vpp open circuit
  const d = Math.min(Math.max(dial, 0), 1);
  return 20 * d * d;
}
export function adjVoltage(dial: number) {
  return 3 + dial * 15; // ±3 .. ±18 V
}
