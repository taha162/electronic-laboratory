/** Board / panel description types (all coordinates in millimetres on the board surface). */

export type JackStyle = "red" | "black" | "yellow" | "blue" | "green" | "white" | "pin" | "pink" | "cyan" | "brass";

export interface JackDef {
  id: string; // local id (unique within the board)
  x: number;
  y: number;
  label?: string;
  /** where the printed label goes */
  lp?: "n" | "s" | "e" | "w";
  style?: JackStyle;
  /** internal node (not drawn, not clickable) */
  hidden?: boolean;
}

export type PartKind =
  | "R"
  | "C"
  | "CP" // polarised (electrolytic) capacitor, pin0 = +
  | "L"
  | "D"
  | "Z"
  | "LED"
  | "NPN"
  | "PNP"
  | "POT" // pins: [A, wiper, C]
  | "RV" // rheostat on the module: value = min + knob * value
  | "OA"; // pins: [in-, in+, out, V+, V-]

export interface PartDef {
  id: string;
  kind: PartKind;
  /** ohm / farad / henry ; for POT total resistance */
  value?: number;
  /** semiconductor model key */
  model?: string;
  /** jack ids (local) */
  pins: string[];
  /** designator printed on the board (e.g. "R1") */
  label?: string;
  /** value text printed (e.g. "10K") */
  text?: string;
  /** symbol anchor for 3+ pin parts (mm) */
  at?: [number, number];
  /** LED colour */
  color?: string;
  /** printed symbol position along the pin segment (0..1, default 0.5) */
  pos?: number;
  /** RV: minimum (fixed) resistance */
  min?: number;
  /** RV / POT on module: knob id (global knob state key) */
  knob?: string;
  /** don't draw lead lines (used for custom/breadboard parts) */
  noLeads?: boolean;
}

/** polyline of jack ids and/or raw points; every jack on a trace is the same electrical node */
export type TraceDef = (string | [number, number])[];

export interface BlockDef {
  id: string;
  label: string;
  rect: [number, number, number, number];
}

export interface TextDef {
  x: number;
  y: number;
  text: string;
  size?: number;
  align?: CanvasTextAlign;
  bold?: boolean;
  color?: string;
}

export interface ModuleDef {
  id: string;
  code: string;
  title: string;
  name: { en: string; ar: string };
  size: [number, number];
  blocks: BlockDef[];
  jacks: JackDef[];
  parts: PartDef[];
  traces: TraceDef[];
  texts?: TextDef[];
  /** local jack ids that are hard-wired to the trainer earth through the module connector */
  earth?: string[];
  /** breadboard style module (accepts custom parts) */
  breadboard?: boolean;
}

export type WireColor = "red" | "black" | "blue" | "yellow" | "green" | "white" | "greenyellow";

export interface Wire {
  id: string;
  a: string; // global jack id
  b: string;
  color: WireColor;
  kind: "wire" | "clip";
}

/** instrument lead terminals that can be attached to a jack */
export type LeadId = "osc.ch1" | "osc.ch1g" | "osc.ch2" | "osc.ch2g" | "dmm.v" | "dmm.com";

export interface CustomPart extends PartDef {
  /** global jack ids */
  gpins: string[];
}
