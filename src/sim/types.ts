/**
 * Serializable circuit description consumed by the MNA solver.
 * Node 0 is always the reference (earth / chassis ground).
 */

export type Waveform =
  | { kind: "dc"; v: number }
  | {
      kind: "sine" | "square" | "triangle";
      /** peak amplitude (V) */
      amp: number;
      freq: number;
      offset: number;
      /** phase in radians */
      phase?: number;
      /** duty for square (0..1) */
      duty?: number;
    };

export interface DiodeModel {
  /** saturation current (A) */
  is: number;
  /** emission coefficient */
  n: number;
  /** reverse breakdown voltage (V, positive). 0 / undefined = none */
  bv?: number;
  /** current at breakdown knee (A) */
  ibv?: number;
  /** series resistance (ohm) */
  rs?: number;
}

export interface BjtModel {
  polarity: 1 | -1; // 1 = NPN, -1 = PNP
  is: number;
  bf: number;
  br: number;
  nf: number;
  nr: number;
  /** forward Early voltage (V) */
  vaf: number;
}

export interface OpAmpModel {
  /** open-loop DC gain */
  gain: number;
  rout: number;
  /** headroom from each rail (V) */
  headroom: number;
  /** gain-bandwidth product (Hz) */
  gbw: number;
  /** slew rate (V/s) */
  sr: number;
}

export type Element =
  | { t: "R"; id: string; a: number; b: number; r: number }
  | { t: "C"; id: string; a: number; b: number; c: number }
  | { t: "L"; id: string; a: number; b: number; l: number }
  /** voltage source, a = +, b = -, rs series resistance */
  | { t: "V"; id: string; a: number; b: number; w: Waveform; rs: number }
  /** current source pushing current from a, through the source, out of b */
  | { t: "I"; id: string; a: number; b: number; w: Waveform }
  | { t: "D"; id: string; a: number; k: number; m: DiodeModel }
  | { t: "Q"; id: string; c: number; b: number; e: number; m: BjtModel }
  | {
      t: "OA";
      id: string;
      inp: number;
      inn: number;
      out: number;
      vcc: number | null;
      vee: number | null;
      /**
       * internal compensation node of the two-stage macromodel (the netlist adds
       * Rint and Cc to ground). null = single-stage ideal-ish model.
       */
      int: number | null;
      m: OpAmpModel;
    }
  /** ammeter: current measured flowing a -> b through the meter; r = shunt (burden) resistance */
  | { t: "AM"; id: string; a: number; b: number; r?: number };

export interface Circuit {
  nodeCount: number;
  elements: Element[];
}

export type ProbeSpec =
  | { id: string; kind: "v"; a: number; b: number }
  /** branch current of a V / AM / OA element, or device current (D: anode->cathode, R, C, L: a->b) */
  | { id: string; kind: "i"; el: string };

export interface SimRequest {
  seq: number;
  circuit: Circuit;
  probes: ProbeSpec[];
  /** total simulated time after the operating point (s); 0 = DC only */
  tStop: number;
  /** start of recorded window */
  tCapture: number;
  /** max internal step during the recorded window */
  dtMax: number;
  /** (optional) coarser step used before tCapture to reach steady state quickly */
  dtSettle?: number;
  /** max points recorded per probe */
  maxPoints: number;
}

export interface SimResult {
  seq: number;
  ok: boolean;
  message?: string;
  /** recorded sample times (s), relative to tCapture */
  t: Float64Array;
  data: Record<string, Float64Array>;
  /** DC operating point values for each probe */
  op: Record<string, number>;
  /** solver statistics */
  stats: { steps: number; iterations: number; ms: number; nodes: number; unknowns: number };
  /** per node (index = node number): [mean, min, max, rms] over the recorded window */
  nodeStats: Float64Array;
  /** average power dissipated by resistors / semiconductors over the recorded window (W) */
  power: Record<string, number>;
}
