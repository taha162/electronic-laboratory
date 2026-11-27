/**
 * KL-21001 LINEAR CIRCUIT LAB main unit — panel layout in millimetres.
 *
 * Measured from perspective-rectified photographs of the bench in the
 * University of Mosul lab (homography of the panel's black border; the
 * recovered panel axes come out orthogonal for the phone camera's focal
 * length, which validates the rectification). Border aspect = 1.31.
 *
 * u (x): left -> right (0..TRAINER_W), v (y): back/top of panel -> front (0..TRAINER_H)
 */
import type { JackDef } from "./types";

export const TRAINER_W = 576;
export const TRAINER_H = 443;
/** thick black border line printed on the panel */
export const BORDER = { x: 8, y: 8, w: 560, h: 427 };

/** module slot (the experiment module plate covers this area) */
export const MODULE_SLOT = { x: 110, y: 123, w: 358, h: 257 };

type Rect = [number, number, number, number];
/** printed section frames */
export const DVM_BOX: Rect = [14, 31, 156, 88];
/** black bezel of the digital meter (raised) */
export const DVM_RECT = { x: 29, y: 38, w: 129, h: 60 };
export const METER_BOXES: Rect[] = [
  [175, 15, 96, 104],
  [275, 15, 92, 104],
  [371, 15, 94, 104],
  [470, 15, 94, 104],
];
export const FG_BOX: Rect = [14, 125, 93, 306];
export const SPEAKER_BOX: Rect = [474, 125, 86, 61];
export const AC_BOX: Rect = [474, 190, 86, 50];
export const DC_BOX: Rect = [474, 244, 86, 187];
export const VR_BOXES: Rect[] = [
  [112, 382, 88, 49],
  [204, 382, 88, 49],
  [296, 382, 88, 49],
  [388, 382, 80, 49],
];
/** black Phillips screws holding the panel */
export const SCREWS: [number, number][] = [
  [158, 8],
  [288, 8],
  [427, 8],
  [158, 435],
  [288, 435],
  [427, 435],
  [8, 104],
  [8, 230],
  [8, 345],
  [568, 104],
  [568, 230],
  [568, 345],
];

const brass = (id: string, x: number, y: number, label?: string, lp: JackDef["lp"] = "s"): JackDef => ({ id, x, y, label, lp, style: "brass" });

export const TRAINER_JACKS: JackDef[] = [
  // digital DC meter (KL-DVM-6005A)
  { id: "dvm.v", x: 48, y: 112, label: "DC VOLTAGE", lp: "n", style: "black" },
  { id: "dvm.com", x: 92, y: 112, label: "COM", lp: "n", style: "black" },
  { id: "dvm.a", x: 136, y: 112, label: "DC CURRENT", lp: "n", style: "black" },
  // analog meters
  brass("m1.n", 199, 111, "0", "n"),
  brass("m1.p", 245, 111, "+20V", "n"),
  brass("m2.n", 297, 111, "0", "n"),
  brass("m2.p", 333, 111, "+100mA", "n"),
  brass("m2.p1a", 356, 111, "+1A", "n"),
  brass("m3.n", 395, 111, "0", "n"),
  brass("m3.p", 441, 111, "15V", "n"),
  brass("m4.n", 494, 111, "0", "n"),
  brass("m4.p", 530, 111, "100mA", "n"),
  brass("m4.p1a", 553, 111, "1A", "n"),
  // function generator: only GND and OUTPUT (OUT/50 ohm)
  { id: "fg.gnd", x: 38, y: 158, label: "GND", lp: "s", style: "black" },
  { id: "fg.out", x: 82, y: 158, label: "OUTPUT", lp: "s", style: "black" },
  // speaker
  brass("spk.p", 495, 158, "+", "e"),
  brass("spk.n", 495, 176, "−", "e"),
  // AC source (centre-tapped transformer secondary)
  { id: "ac.a", x: 490, y: 222, label: "9V", lp: "s", style: "pink" },
  { id: "ac.ct", x: 517, y: 222, label: "0V", lp: "s", style: "white" },
  { id: "ac.b", x: 544, y: 222, label: "9V", lp: "s", style: "pink" },
  // fixed DC power
  { id: "ps.p5", x: 484, y: 277, label: "+5V", lp: "s", style: "pink" },
  { id: "ps.m5", x: 505, y: 277, label: "−5V", lp: "s", style: "cyan" },
  { id: "ps.p12", x: 527, y: 277, label: "+12V", lp: "s", style: "yellow" },
  { id: "ps.m12", x: 549, y: 277, label: "−12V", lp: "s", style: "white" },
  { id: "ps.gnd", x: 484, y: 296, style: "black" },
  { id: "ps.gnd2", x: 505, y: 296, style: "black" },
  { id: "ps.gnd3", x: 527, y: 296, style: "black" },
  { id: "ps.gnd4", x: 549, y: 296, style: "black" },
  // adjustable power ±3V~±18V
  { id: "adj.vm", x: 489, y: 356, label: "V−", lp: "s", style: "cyan" },
  { id: "adj.gnd", x: 517, y: 356, label: "GND", lp: "s", style: "black" },
  { id: "adj.vp", x: 545, y: 356, label: "V+", lp: "s", style: "pink" },
  // potentiometers VR1..VR4 (A, B = wiper, C)
  ...([
    [162, 177, 191],
    [253, 267, 282],
    [341, 357, 372],
    [430, 444, 458],
  ] as const).flatMap((xs, k) => [
    brass(`vr${k + 1}.a`, xs[0], 413, "A"),
    brass(`vr${k + 1}.b`, xs[1], 413, "B"),
    brass(`vr${k + 1}.c`, xs[2], 413, "C"),
  ]),
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
  /** knob cap missing: bare knurled shaft (as on VR3 of this bench) */
  bare?: boolean;
}

export const TRAINER_KNOBS: KnobDef[] = [
  { id: "fg.func", x: 60, y: 219, r: 12.5, label: "FUNCTION", detents: 3, marks: ["∿", "⋀", "⊓"], def: 0 },
  { id: "fg.range", x: 60, y: 281, r: 12.5, label: "RANGE", detents: 4, marks: ["10", "100", "1K", "10K"], def: 2 },
  { id: "fg.amp", x: 60, y: 341, r: 12.5, label: "AMPLITUDE", minLabel: "min.", maxLabel: "max.", def: 0.7071 },
  { id: "fg.freq", x: 60, y: 400, r: 12.5, label: "FREQUENCY", minLabel: "min.", maxLabel: "max.", def: 0 },
  { id: "adj.v", x: 517, y: 397, r: 13.5, label: "", minLabel: "min.", maxLabel: "max.", def: 0 },
  { id: "vr1", x: 130, y: 404, r: 11.5, label: "VR1", def: 0.5 },
  { id: "vr2", x: 222, y: 404, r: 11.5, label: "VR2", def: 0.5 },
  { id: "vr3", x: 312, y: 404, r: 11.5, label: "VR3", def: 0.5 },
  { id: "vr4", x: 405, y: 404, r: 11.5, label: "VR4", def: 0.5 },
];

export const VR_VALUES: Record<string, number> = { vr1: 1e3, vr2: 10e3, vr3: 100e3, vr4: 1e6 };
export const VR_LABELS: Record<string, string> = { vr1: "1KΩ", vr2: "10KΩ", vr3: "100KΩ", vr4: "1MΩ" };

/** analog panel meters (window rectangles in mm) */
export const TRAINER_METERS = [
  { id: "m1", x: 186, y: 29, w: 74, h: 44, title: "DC VOLTAGE METER", unit: "V", full: 20, kind: "dcv" as const },
  { id: "m2", x: 284, y: 29, w: 74, h: 44, title: "DC CURRENT METER", unit: "mA", full: 100, kind: "dca" as const },
  { id: "m3", x: 381, y: 29, w: 74, h: 44, title: "AC VOLTAGE METER", unit: "V", full: 15, kind: "acv" as const },
  { id: "m4", x: 480, y: 29, w: 74, h: 44, title: "AC CURRENT METER", unit: "mA", full: 100, kind: "aca" as const },
];

/**
 * Function generator: 10 Hz ~ 100 kHz in 4 ranges, continuously adjustable.
 * RANGE selects x10 / x100 / x1K / x10K; the FREQUENCY dial spans 1..10 x range.
 */
export const FG_RANGES = [10, 100, 1e3, 10e3];
export function fgFrequency(rangeIdx: number, dial: number) {
  const r = FG_RANGES[Math.min(Math.max(Math.round(rangeIdx), 0), FG_RANGES.length - 1)];
  return r * (1 + 9 * Math.min(Math.max(dial, 0), 1));
}
/** inverse of fgFrequency: knob settings for a wanted frequency */
export function fgDialFor(freq: number) {
  let r = 0;
  while (r < FG_RANGES.length - 1 && freq / FG_RANGES[r] > 10) r++;
  const dial = Math.min(Math.max((freq / FG_RANGES[r] - 1) / 9, 0), 1);
  return { range: r, dial };
}
export function fgAmplitudeVpp(dial: number) {
  // square-law (audio-taper style) amplitude pot: 0..20 Vpp open circuit
  const d = Math.min(Math.max(dial, 0), 1);
  return 20 * d * d;
}
export function adjVoltage(dial: number) {
  return 3 + dial * 15; // ±3 .. ±18 V
}
