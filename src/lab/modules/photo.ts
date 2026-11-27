/**
 * The KL module boards are laid out from straight-on photographs of the real
 * boards: every socket, symbol and printed line was measured in photo pixels
 * and is mapped here to board millimetres through the four corner screws
 * (a projective fit, so a slightly tilted photo still lands square).
 */
import type { JackDef, MarkDef, PropDef, TextDef } from "../types";

type P = [number, number];

/** all KL-230xx modules share one housing: 255 x 165 mm, drawn 1.443x so the print reads from the seat */
export const KL_BOARD: P = [368, 236];
/** corner screws on the board, TL TR BL BR (mm) */
export const KL_SCREWS: P[] = [
  [15.8, 16.2],
  [350.1, 16.2],
  [15.8, 219.4],
  [350.1, 219.4],
];

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

/** returns photo px -> board mm for a photo whose corner screws sit at `screws` (TL TR BL BR) */
export function photoMap(screws: P[]) {
  const A: number[][] = [];
  const b: number[] = [];
  screws.forEach(([x, y], i) => {
    const [u, v] = KL_SCREWS[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  });
  const h = solve(A, b);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return (x: number, y: number): P => {
    const w = h[6] * x + h[7] * y + 1;
    return [r1((h[0] * x + h[1] * y + h[2]) / w), r1((h[3] * x + h[4] * y + h[5]) / w)];
  };
}

/** shorthand builders for a board laid out on its photo */
export function photoKit(screws: P[]) {
  const P = photoMap(screws);
  const J = (id: string, x: number, y: number, label?: string, lp: JackDef["lp"] = "n"): JackDef => {
    const [mx, my] = P(x, y);
    return { id, x: mx, y: my, label, lp, style: "pin" };
  };
  return {
    P,
    J,
    /** internal node: where a printed symbol ends on a line (no socket) */
    N: (id: string, x: number, y: number): JackDef => ({ ...J(id, x, y), hidden: true }),
    T: (x: number, y: number, text: string, size = 4.6, align: CanvasTextAlign = "center", bold = true): TextDef => {
      const [mx, my] = P(x, y);
      return { x: mx, y: my, text, size, align, bold };
    },
    gnd: (x: number, y: number): MarkDef => ({ kind: "gnd", x: P(x, y)[0], y: P(x, y)[1] }),
    ac: (x: number, y: number): MarkDef => ({ kind: "ac", x: P(x, y)[0], y: P(x, y)[1] }),
    arrow: (x: number, y: number, dir: "e" | "w" | "n" | "s"): MarkDef => ({ kind: "arrow", x: P(x, y)[0], y: P(x, y)[1], dir }),
    light: (x: number, y: number, out = false): MarkDef => ({ kind: "light", x: P(x, y)[0], y: P(x, y)[1], out }),
    line: (pts: [number, number][], dash = false): MarkDef => ({ kind: "line", pts: pts.map(([x, y]) => P(x, y)), dash }),
    prop: (kind: PropDef["kind"], x: number, y: number, w?: number, h?: number, color?: string): PropDef => {
      const [mx, my] = P(x, y);
      return { kind, x: mx, y: my, w, h, color };
    },
  };
}

/**
 * Photo measurements scatter by a pixel or two; snap coordinates that are meant to line up
 * (a column of sockets, a rail and the parts hanging off it) to one value so printed lines run
 * straight instead of jogging by half a millimetre.
 */
export function snapModule<T extends { jacks: JackDef[]; traces: (string | [number, number])[][]; parts: { at?: [number, number] }[] }>(m: T, tol = 1.6): T {
  const refs: { get: () => number; set: (v: number) => void }[][] = [[], []];
  for (const j of m.jacks) {
    refs[0].push({ get: () => j.x, set: (v) => (j.x = v) });
    refs[1].push({ get: () => j.y, set: (v) => (j.y = v) });
  }
  for (const tr of m.traces)
    for (const p of tr)
      if (typeof p !== "string") {
        refs[0].push({ get: () => p[0], set: (v) => (p[0] = v) });
        refs[1].push({ get: () => p[1], set: (v) => (p[1] = v) });
      }
  for (const p of m.parts)
    if (p.at) {
      const a = p.at;
      refs[0].push({ get: () => a[0], set: (v) => (a[0] = v) });
      refs[1].push({ get: () => a[1], set: (v) => (a[1] = v) });
    }
  for (const axis of refs) {
    const s = [...axis].sort((a, b) => a.get() - b.get());
    for (let i = 0; i < s.length; ) {
      let k = i;
      while (k + 1 < s.length && s[k + 1].get() - s[i].get() < tol) k++;
      const mean = Math.round((s.slice(i, k + 1).reduce((t, r) => t + r.get(), 0) / (k - i + 1)) * 10) / 10;
      for (let q = i; q <= k; q++) s[q].set(mean);
      i = k + 1;
    }
  }
  return m;
}
