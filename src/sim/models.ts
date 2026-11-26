import type { BjtModel, DiodeModel, OpAmpModel } from "./types";

/** Device model library (parameters tuned to datasheet-typical behaviour). */
export const DIODES: Record<string, DiodeModel & { label: string }> = {
  "1N4001": { label: "1N4001 Si rectifier", is: 1.4e-8, n: 1.98 }, // ~0.75 V @ 10 mA
  "1N4148": { label: "1N4148 Si signal", is: 2.52e-9, n: 1.75 }, // ~0.65 V @ 1 mA
  "1N34A": { label: "1N34A Ge", is: 2e-7, n: 1.3 }, // ~0.25 V @ 1 mA
  "1N4740": { label: "1N4740A Zener 10 V", is: 5e-9, n: 1.75, bv: 10, ibv: 1e-3 },
  "1N4733": { label: "1N4733A Zener 5.1 V", is: 5e-9, n: 1.75, bv: 5.1, ibv: 1e-3 },
  LED_RED: { label: "Red LED", is: 1e-19, n: 1.9 }, // ~1.85 V @ 10 mA
  LED_YEL: { label: "Yellow LED", is: 5e-20, n: 2.0 },
  LED_GRN: { label: "Green LED", is: 1e-21, n: 2.1 }, // ~2.1 V
};

export const BJTS: Record<string, BjtModel & { label: string }> = {
  "2N3904": { label: "2N3904 NPN", polarity: 1, is: 6.7e-15, bf: 180, br: 4, nf: 1, nr: 1, vaf: 74 },
  "C1815": { label: "2SC1815 NPN", polarity: 1, is: 1e-14, bf: 200, br: 3, nf: 1, nr: 1, vaf: 100 },
  "2N2904": { label: "2N2904 PNP", polarity: -1, is: 1e-14, bf: 120, br: 3, nf: 1, nr: 1, vaf: 60 },
  "2N3906": { label: "2N3906 PNP", polarity: -1, is: 1.4e-15, bf: 180, br: 4, nf: 1, nr: 1, vaf: 18.7 },
};

export const OPAMPS: Record<string, OpAmpModel & { label: string }> = {
  UA741: { label: "uA741", gain: 2e5, rout: 75, headroom: 1.5 },
};
