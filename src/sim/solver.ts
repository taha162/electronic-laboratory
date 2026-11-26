/**
 * Modified Nodal Analysis (MNA) transient circuit solver.
 *
 *  - Linear elements: R, C (backward-Euler companion), L (backward-Euler companion)
 *  - Independent sources: V (with series resistance, own branch row), I
 *  - Nonlinear: Shockley diode with Zener breakdown, Ebers-Moll / Gummel-Poon-lite BJT
 *    with Early effect, op-amp (saturating VCVS with output resistance)
 *  - Newton-Raphson with SPICE-style pn-junction voltage limiting
 *  - DC operating point with gmin- and source-stepping fall-backs
 *  - Fixed step transient with automatic step subdivision on non-convergence
 */
import type {
  Circuit,
  Element,
  ProbeSpec,
  SimRequest,
  SimResult,
  Waveform,
  DiodeModel,
} from "./types";
import { opampMacro } from "./models";

const VT = 0.025852; // thermal voltage @ 27C
const GMIN = 1e-12;
const NODE_GMIN = 1e-10; // leak every node to ground so floating nets stay solvable

export function sourceValue(w: Waveform, t: number): number {
  if (w.kind === "dc") return w.v;
  const ph = w.phase ?? 0;
  const x = 2 * Math.PI * w.freq * t + ph;
  switch (w.kind) {
    case "sine":
      return w.offset + w.amp * Math.sin(x);
    case "square": {
      const duty = w.duty ?? 0.5;
      let frac = (x / (2 * Math.PI)) % 1;
      if (frac < 0) frac += 1;
      return w.offset + (frac < duty ? w.amp : -w.amp);
    }
    case "triangle": {
      let frac = (x / (2 * Math.PI) + 0.25) % 1;
      if (frac < 0) frac += 1;
      // 0 at t=0 rising, like sine
      const tri = frac < 0.5 ? -1 + 4 * frac : 3 - 4 * frac;
      return w.offset + w.amp * tri;
    }
  }
}

function pnjlim(vnew: number, vold: number, vt: number, vcrit: number): number {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    } else {
      vnew = vt * Math.log(Math.max(vnew / vt, 1e-30));
    }
  }
  return vnew;
}

/** limited exponential to avoid overflow */
function sexp(x: number): number {
  if (x > 80) return Math.exp(80) * (1 + (x - 80));
  return Math.exp(x);
}

interface DiodeEval {
  i: number;
  g: number;
}

function diodeEval(v: number, m: DiodeModel): DiodeEval {
  const nvt = m.n * VT;
  const e = sexp(v / nvt);
  let i = m.is * (e - 1) + GMIN * v;
  let g = (m.is * e) / nvt + GMIN;
  if (m.bv && m.bv > 0) {
    const ibv = m.ibv ?? 1e-3;
    const nbv = VT; // sharp knee
    const eb = sexp(-(v + m.bv) / nbv);
    i -= ibv * eb;
    g += (ibv * eb) / nbv;
  }
  return { i, g };
}

/** Dense LU solve with partial pivoting, in place. Returns false if singular. */
function solveDense(A: Float64Array, b: Float64Array, n: number, x: Float64Array): boolean {
  for (let k = 0; k < n; k++) {
    let piv = k;
    let max = Math.abs(A[k * n + k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(A[i * n + k]);
      if (v > max) {
        max = v;
        piv = i;
      }
    }
    if (max < 1e-30) return false;
    if (piv !== k) {
      for (let j = 0; j < n; j++) {
        const t = A[k * n + j];
        A[k * n + j] = A[piv * n + j];
        A[piv * n + j] = t;
      }
      const t = b[k];
      b[k] = b[piv];
      b[piv] = t;
    }
    const akk = A[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const f = A[i * n + k] / akk;
      if (f === 0) continue;
      A[i * n + k] = 0;
      for (let j = k + 1; j < n; j++) A[i * n + j] -= f * A[k * n + j];
      b[i] -= f * b[k];
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i * n + j] * x[j];
    x[i] = s / A[i * n + i];
  }
  return true;
}

export class MnaSolver {
  readonly n: number; // unknowns
  readonly nodes: number; // non-ground nodes
  readonly els: Element[];
  private branchOf = new Map<string, number>();
  private A: Float64Array;
  private rhs: Float64Array;
  x: Float64Array;
  private xNew: Float64Array;
  /** per-element state: capacitor voltage, inductor current */
  private capV = new Map<string, number>();
  private capI = new Map<string, number>();
  private indI = new Map<string, number>();
  private indV = new Map<string, number>();
  /** integration method for the step being solved */
  private trap = false;
  /** junction voltages for limiting */
  private junc = new Map<string, number[]>();
  /** op-amp rails cache */
  private rails = new Map<string, [number, number]>();
  iterations = 0;
  /** set during assemble when a junction voltage had to be limited */
  private limited = false;
  /** Newton iteration index within the current solve */
  private iterInNewton = 0;

  constructor(c: Circuit) {
    this.els = c.elements;
    this.nodes = c.nodeCount - 1;
    let k = this.nodes;
    for (const e of c.elements) {
      if (e.t === "V" || e.t === "AM" || e.t === "OA") this.branchOf.set(e.id, k++);
    }
    this.n = k;
    this.A = new Float64Array(k * k);
    this.rhs = new Float64Array(k);
    this.x = new Float64Array(k);
    this.xNew = new Float64Array(k);
  }

  /** node voltage from a solution vector */
  private nv(x: Float64Array, node: number): number {
    return node === 0 ? 0 : x[node - 1];
  }

  private stampG(a: number, b: number, g: number) {
    const n = this.n,
      A = this.A;
    if (a) A[(a - 1) * n + (a - 1)] += g;
    if (b) A[(b - 1) * n + (b - 1)] += g;
    if (a && b) {
      A[(a - 1) * n + (b - 1)] -= g;
      A[(b - 1) * n + (a - 1)] -= g;
    }
  }

  /** current source injecting `i` into node a and drawing it from node b */
  private stampI(a: number, b: number, i: number) {
    if (a) this.rhs[a - 1] += i;
    if (b) this.rhs[b - 1] -= i;
  }

  private stampAt(row: number, colNode: number, v: number) {
    // row is a matrix row (0-based) ; colNode is a circuit node
    if (colNode) this.A[row * this.n + (colNode - 1)] += v;
  }

  /**
   * Stamp a nonlinear multi-terminal device.
   * I[i]: current flowing INTO the device at terminal i, J[i][j] = dI_i/dV_j
   */
  private stampNonlinear(nodes: number[], I: number[], J: number[][], V: number[]) {
    for (let i = 0; i < nodes.length; i++) {
      const ni = nodes[i];
      if (!ni) continue;
      let ieq = I[i];
      for (let j = 0; j < nodes.length; j++) {
        ieq -= J[i][j] * V[j];
        const nj = nodes[j];
        if (nj) this.A[(ni - 1) * this.n + (nj - 1)] += J[i][j];
      }
      this.rhs[ni - 1] -= ieq;
    }
  }

  private getJ(id: string, k: number): number[] {
    let j = this.junc.get(id);
    if (!j) {
      j = new Array(k).fill(0);
      this.junc.set(id, j);
    }
    return j;
  }

  /**
   * Assemble the linearised system around the current guess `x`.
   * mode: "dc" => capacitors open, inductors ~short
   */
  private assemble(x: Float64Array, t: number, dt: number, mode: "dc" | "tran", srcScale: number, gminExtra: number) {
    this.A.fill(0);
    this.rhs.fill(0);
    const n = this.n;
    for (let i = 0; i < this.nodes; i++) this.A[i * n + i] += NODE_GMIN + gminExtra;

    for (const e of this.els) {
      switch (e.t) {
        case "R":
          this.stampG(e.a, e.b, 1 / Math.max(e.r, 1e-6));
          break;
        case "C": {
          if (mode === "dc") {
            this.stampG(e.a, e.b, 1e-12);
          } else {
            const vp = this.capV.get(e.id) ?? 0;
            if (this.trap) {
              const g = (2 * e.c) / dt;
              const ip = this.capI.get(e.id) ?? 0;
              this.stampG(e.a, e.b, g);
              this.stampI(e.a, e.b, g * vp + ip);
            } else {
              const g = e.c / dt;
              this.stampG(e.a, e.b, g);
              this.stampI(e.a, e.b, g * vp);
            }
          }
          break;
        }
        case "L": {
          if (mode === "dc") {
            this.stampG(e.a, e.b, 1e3);
          } else {
            const ip = this.indI.get(e.id) ?? 0;
            if (this.trap) {
              const g = dt / (2 * e.l);
              const vp = this.indV.get(e.id) ?? 0;
              this.stampG(e.a, e.b, g);
              this.stampI(e.a, e.b, -(ip + g * vp));
            } else {
              const g = dt / e.l;
              this.stampG(e.a, e.b, g);
              this.stampI(e.a, e.b, -ip);
            }
          }
          break;
        }
        case "V": {
          const k = this.branchOf.get(e.id)!;
          const val = sourceValue(e.w, t) * srcScale;
          this.stampAt(k, e.a, 1);
          this.stampAt(k, e.b, -1);
          if (e.a) this.A[(e.a - 1) * n + k] += 1;
          if (e.b) this.A[(e.b - 1) * n + k] -= 1;
          this.A[k * n + k] -= e.rs;
          this.rhs[k] = val;
          break;
        }
        case "AM": {
          const k = this.branchOf.get(e.id)!;
          this.stampAt(k, e.a, 1);
          this.stampAt(k, e.b, -1);
          if (e.a) this.A[(e.a - 1) * n + k] += 1;
          if (e.b) this.A[(e.b - 1) * n + k] -= 1;
          this.A[k * n + k] -= e.r ?? 1e-3; // shunt (burden) resistance
          break;
        }
        case "I": {
          const val = sourceValue(e.w, t) * srcScale;
          this.stampI(e.b, e.a, val);
          break;
        }
        case "D": {
          const m = e.m;
          const v = this.nv(x, e.a) - this.nv(x, e.k);
          const st = this.getJ(e.id, 2);
          const nvt = m.n * VT;
          const vcrit = nvt * Math.log(nvt / (Math.SQRT2 * m.is));
          let vl = pnjlim(v, st[0], nvt, vcrit);
          if (m.bv && m.bv > 0) {
            // limit in breakdown direction too
            const u = -(vl + m.bv);
            const uo = -(st[0] + m.bv);
            const ul = pnjlim(u, uo, VT, VT * Math.log(VT / (Math.SQRT2 * (m.ibv ?? 1e-3))));
            vl = -ul - m.bv;
          }
          if (Math.abs(vl - v) > 1e-9) this.limited = true;
          st[0] = vl;
          const { i, g } = diodeEval(vl, m);
          // linear companion: I = i + g (v - vl)
          this.stampG(e.a, e.k, g);
          this.stampI(e.k, e.a, i - g * vl);
          break;
        }
        case "Q": {
          const m = e.m;
          const s = m.polarity;
          const vb = this.nv(x, e.b),
            vc = this.nv(x, e.c),
            ve = this.nv(x, e.e);
          const st = this.getJ(e.id, 2);
          const nfv = m.nf * VT,
            nrv = m.nr * VT;
          const vcritF = nfv * Math.log(nfv / (Math.SQRT2 * m.is));
          const vcritR = nrv * Math.log(nrv / (Math.SQRT2 * m.is));
          const vbe0 = s * (vb - ve);
          const vbc0 = s * (vb - vc);
          const vbe = pnjlim(vbe0, st[0], nfv, vcritF);
          const vbc = pnjlim(vbc0, st[1], nrv, vcritR);
          if (Math.abs(vbe - vbe0) > 1e-9 || Math.abs(vbc - vbc0) > 1e-9) this.limited = true;
          st[0] = vbe;
          st[1] = vbc;
          const ef = sexp(vbe / nfv),
            er = sexp(vbc / nrv);
          const If = m.is * (ef - 1),
            Ir = m.is * (er - 1);
          const gif = (m.is * ef) / nfv + GMIN,
            gir = (m.is * er) / nrv + GMIN;
          const qf = Math.max(1 - vbc / m.vaf, 0.05);
          const Ic = (If - Ir) * qf - Ir / m.br;
          const Ib = If / m.bf + Ir / m.br;
          const dIc_dvbe = gif * qf;
          const dIc_dvbc = -gir * qf - (If - Ir) / m.vaf - gir / m.br;
          const dIb_dvbe = gif / m.bf;
          const dIb_dvbc = gir / m.br;
          // terminal currents into device: C: s*Ic, B: s*Ib, E: -s*(Ic+Ib)
          // dvbe/dVb = s, dvbe/dVe = -s ; dvbc/dVb = s, dvbc/dVc = -s  => s*s = 1
          const Jc = [-dIc_dvbc, dIc_dvbe + dIc_dvbc, -dIc_dvbe]; // wrt [Vc, Vb, Ve]
          const Jb = [-dIb_dvbc, dIb_dvbe + dIb_dvbc, -dIb_dvbe];
          const Je = [-(Jc[0] + Jb[0]), -(Jc[1] + Jb[1]), -(Jc[2] + Jb[2])];
          // terminal voltages consistent with the (limited) junction voltages
          const Vvec = [vb - s * vbc, vb, vb - s * vbe];
          this.stampNonlinear([e.c, e.b, e.e], [s * Ic, s * Ib, -s * (Ic + Ib)], [Jc, Jb, Je], Vvec);
          break;
        }
        case "OA": {
          const k = this.branchOf.get(e.id)!;
          const vdRaw = this.nv(x, e.inp) - this.nv(x, e.inn);
          let rail: [number, number];
          const vccV = e.vcc != null ? this.nv(x, e.vcc) : 15;
          const veeV = e.vee != null ? this.nv(x, e.vee) : -15;
          const hi = vccV - e.m.headroom;
          const lo = veeV + e.m.headroom;
          if (hi > lo) rail = [lo, hi];
          // supplies not solved yet on the very first Newton iteration: assume nominal rails
          else rail = this.iterInNewton === 0 && !this.rails.has(e.id) ? [-13.5, 13.5] : [0, 0];
          this.rails.set(e.id, rail);
          const mid = (rail[0] + rail[1]) / 2;
          const half = Math.max((rail[1] - rail[0]) / 2, 1e-6);
          const st = this.getJ(e.id, 1);
          if (e.int != null) {
            // ---- two-stage macromodel: gm stage (slew-limited) -> Cc/Rint -> output buffer
            const mm = opampMacro(e.m);
            // Newton limiting of the (tanh) input stage: walk through the linear region
            const stg = this.getJ(e.id + "#g", 1);
            let u = (mm.gm * vdRaw) / mm.imax;
            const uOld = stg[0];
            if (Math.sign(u) !== Math.sign(uOld) && Math.abs(uOld) > 2 && Math.abs(u) > 2) {
              u = 0;
              this.limited = true;
            } else if (Math.abs(uOld) < 3 && Math.abs(u - uOld) > 2.5) {
              u = uOld + Math.sign(u - uOld) * 2.5;
              this.limited = true;
            }
            stg[0] = u;
            const vdL = (u * mm.imax) / mm.gm;
            const thg = Math.tanh(u);
            const iIn = mm.imax * thg;
            const gIn = mm.gm * (1 - thg * thg) + 1e-15;
            // current injected into the internal node: iIn + gIn*(vd - vd0)
            if (e.int) {
              this.rhs[e.int - 1] += iIn - gIn * vdL;
              this.stampAt(e.int - 1, e.inp, -gIn);
              this.stampAt(e.int - 1, e.inn, gIn);
            }
            // internal node clamp (a real op-amp's second stage cannot swing beyond its rails;
            // this also gives microsecond saturation recovery)
            const vInt = this.nv(x, e.int);
            if (e.int) {
              const top = mid + 1.6 * half + 0.3,
                bot = mid - 1.6 * half - 0.3;
              const Gc = 1e-3,
                sw = 0.05;
              const sp = (z: number) => (z > 30 ? z : Math.log1p(Math.exp(z)));
              const sg = (z: number) => 1 / (1 + Math.exp(-z));
              const ic = Gc * sw * (sp((vInt - top) / sw) - sp((bot - vInt) / sw));
              const gc = Gc * (sg((vInt - top) / sw) + sg((bot - vInt) / sw)) + 1e-15;
              this.A[(e.int - 1) * n + (e.int - 1)] += gc;
              this.rhs[e.int - 1] -= ic - gc * vInt;
            }
            // output buffer: linear between the rails with a sharp soft knee
            let arg = (vInt - mid) / half;
            const argOld = st[0];
            if (Math.sign(arg) !== Math.sign(argOld) && Math.abs(argOld) > 1.5 && Math.abs(arg) > 1.5) {
              arg = 0;
              this.limited = true;
            } else if (Math.abs(argOld) < 3 && Math.abs(arg - argOld) > 2) {
              arg = argOld + Math.sign(arg - argOld) * 2;
              this.limited = true;
            }
            st[0] = arg;
            const vIntL = mid + arg * half;
            const P = 8;
            const q = 1 + Math.pow(Math.abs(arg), P);
            const sc = arg / Math.pow(q, 1 / P);
            const f = mid + half * sc;
            const fp = Math.pow(q, -(P + 1) / P) + 1e-9;
            // Vout - Rout*i - fp*vInt = f - fp*vIntL
            this.stampAt(k, e.out, 1);
            this.stampAt(k, e.int, -fp);
            this.A[k * n + k] -= e.m.rout;
            if (e.out) this.A[(e.out - 1) * n + k] += 1;
            this.rhs[k] = f - fp * vIntL;
            break;
          }
          // ---- single-stage model
          // Newton limiting for the saturating output (like pnjlim for junctions):
          // re-enter the linear region from the centre when flipping rails, and
          // leave it gradually.
          let arg = (e.m.gain * vdRaw) / half;
          const argOld = st[0];
          if (Math.sign(arg) !== Math.sign(argOld) && Math.abs(argOld) > 1.5 && Math.abs(arg) > 1.5) {
            arg = 0;
            this.limited = true;
          } else if (Math.abs(argOld) < 3 && Math.abs(arg - argOld) > 2) {
            arg = argOld + Math.sign(arg - argOld) * 2;
            this.limited = true;
          }
          st[0] = arg;
          const vd = (arg * half) / e.m.gain;
          const th = Math.tanh(arg);
          const f = mid + half * th;
          const fp = e.m.gain * (1 - th * th);
          // Vout - Rout*i - fp*(Vp - Vn) = f - fp*vd
          this.stampAt(k, e.out, 1);
          this.stampAt(k, e.inp, -fp);
          this.stampAt(k, e.inn, fp);
          this.A[k * n + k] -= e.m.rout;
          if (e.out) this.A[(e.out - 1) * n + k] += 1;
          this.rhs[k] = f - fp * vd;
          break;
        }
      }
    }
  }

  private newton(t: number, dt: number, mode: "dc" | "tran", srcScale = 1, gminExtra = 0, maxIt = 80): boolean {
    const n = this.n;
    for (let it = 0; it < maxIt; it++) {
      this.iterations++;
      this.limited = false;
      this.iterInNewton = it;
      this.assemble(this.x, t, dt, mode, srcScale, gminExtra);
      if (!solveDense(this.A, this.rhs, n, this.xNew)) return false;
      let conv = true;
      for (let i = 0; i < n; i++) {
        const xn = this.xNew[i];
        if (!Number.isFinite(xn)) return false;
        const d = Math.abs(xn - this.x[i]);
        const tol = i < this.nodes ? 1e-6 + 1e-4 * Math.abs(xn) : 1e-9 + 1e-4 * Math.abs(xn);
        if (d > tol) conv = false;
      }
      // damp very large node jumps (helps op-amp / bjt start-up)
      for (let i = 0; i < n; i++) {
        let d = this.xNew[i] - this.x[i];
        if (i < this.nodes && Math.abs(d) > 20) d = Math.sign(d) * 20;
        this.x[i] += d;
      }
      if (conv && it > 0 && !this.limited) return true;
    }
    return false;
  }

  /** Compute DC operating point at time t (sources evaluated at t). */
  operatingPoint(t = 0): boolean {
    this.x.fill(0);
    this.junc.clear();
    if (this.newton(t, 1, "dc")) return this.commitDc();
    // gmin stepping
    this.x.fill(0);
    this.junc.clear();
    let ok = true;
    for (let g = 1e-2; g > 1e-11; g /= 10) {
      if (!this.newton(t, 1, "dc", 1, g, 120)) {
        ok = false;
        break;
      }
    }
    if (ok && this.newton(t, 1, "dc")) return this.commitDc();
    // source stepping
    this.x.fill(0);
    this.junc.clear();
    for (let s = 0.05; s <= 1.0001; s += 0.05) {
      if (!this.newton(t, 1, "dc", Math.min(s, 1), 0, 150)) return false;
    }
    return this.commitDc();
  }

  private commitDc(): boolean {
    for (const e of this.els) {
      if (e.t === "C") {
        this.capV.set(e.id, this.nv(this.x, e.a) - this.nv(this.x, e.b));
        this.capI.set(e.id, 0);
      }
      if (e.t === "L") {
        const v = this.nv(this.x, e.a) - this.nv(this.x, e.b);
        this.indI.set(e.id, v * 1e3);
        this.indV.set(e.id, 0);
      }
    }
    return true;
  }

  private xSave: Float64Array | null = null;
  /**
   * advance one transient step from t to t+dt; returns success.
   * `useTrap` selects trapezoidal integration; backward Euler is used after
   * discontinuities to suppress trapezoidal ringing.
   */
  step(t: number, dt: number, useTrap = true): boolean {
    if (!this.xSave) this.xSave = new Float64Array(this.n);
    this.xSave.set(this.x);
    // junction states are small arrays; snapshot only their values
    const jvals: number[][] = [];
    for (const v of this.junc.values()) jvals.push(v.slice());
    this.trap = useTrap;
    if (this.newton(t + dt, dt, "tran")) {
      this.commitTran(dt);
      return true;
    }
    // subdivide with backward Euler
    this.x.set(this.xSave);
    let ji = 0;
    for (const v of this.junc.values()) {
      const sv = jvals[ji++];
      if (sv) for (let q = 0; q < v.length; q++) v[q] = sv[q];
    }
    this.trap = false;
    const sub = 10;
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      if (!this.newton(t + h * (i + 1), h, "tran", 1, 0, 300)) return false;
      this.commitTran(h);
    }
    return true;
  }

  private commitTran(dt: number) {
    for (const e of this.els) {
      if (e.t === "C") {
        const v = this.nv(this.x, e.a) - this.nv(this.x, e.b);
        const vp = this.capV.get(e.id) ?? 0;
        const ip = this.capI.get(e.id) ?? 0;
        const i = this.trap ? ((2 * e.c) / dt) * (v - vp) - ip : (e.c / dt) * (v - vp);
        this.capV.set(e.id, v);
        this.capI.set(e.id, i);
      } else if (e.t === "L") {
        const v = this.nv(this.x, e.a) - this.nv(this.x, e.b);
        const ip = this.indI.get(e.id) ?? 0;
        const vp = this.indV.get(e.id) ?? 0;
        const i = this.trap ? ip + (dt / (2 * e.l)) * (v + vp) : ip + (dt / e.l) * v;
        this.indI.set(e.id, i);
        this.indV.set(e.id, v);
      }
    }
  }

  /** true if any square-wave source jumps inside (t, t+dt] */
  hasEdge(t: number, dt: number): boolean {
    for (const e of this.els) {
      if ((e.t === "V" || e.t === "I") && e.w.kind === "square") {
        if (Math.sign(sourceValue(e.w, t) - e.w.offset) !== Math.sign(sourceValue(e.w, t + dt) - e.w.offset)) return true;
      }
    }
    return false;
  }

  /** read a probe value from the present solution */
  probe(p: ProbeSpec, t: number): number {
    if (p.kind === "v") return this.nv(this.x, p.a) - this.nv(this.x, p.b);
    const k = this.branchOf.get(p.el);
    if (k !== undefined) {
      const el = this.els.find((e) => e.id === p.el)!;
      // MNA branch current is current entering "+" node into the element;
      // for a source we report the current it DELIVERS (out of +).
      return el.t === "V" ? -this.x[k] : this.x[k];
    }
    const el = this.elById(p.el);
    if (!el) return 0;
    const x = this.x;
    switch (el.t) {
      case "R":
        return (this.nv(x, el.a) - this.nv(x, el.b)) / el.r;
      case "D": {
        const v = this.nv(x, el.a) - this.nv(x, el.k);
        return diodeEval(v, el.m).i;
      }
      case "L":
        return this.indI.get(el.id) ?? 0;
      case "C":
        return 0;
      case "Q": {
        // collector current (into collector)
        const s = el.m.polarity;
        const vbe = s * (this.nv(x, el.b) - this.nv(x, el.e));
        const vbc = s * (this.nv(x, el.b) - this.nv(x, el.c));
        const If = el.m.is * (sexp(vbe / (el.m.nf * VT)) - 1);
        const Ir = el.m.is * (sexp(vbc / (el.m.nr * VT)) - 1);
        return s * ((If - Ir) * Math.max(1 - vbc / el.m.vaf, 0.05) - Ir / el.m.br);
      }
      default:
        return 0;
    }
  }

  /** instantaneous power dissipated in a component (W) */
  elementPower(e: Element): number {
    const x = this.x;
    switch (e.t) {
      case "R": {
        const v = this.nv(x, e.a) - this.nv(x, e.b);
        return (v * v) / e.r;
      }
      case "D": {
        const v = this.nv(x, e.a) - this.nv(x, e.k);
        return Math.abs(v * diodeEval(v, e.m).i);
      }
      case "Q": {
        const s = e.m.polarity;
        const vb = this.nv(x, e.b),
          vc = this.nv(x, e.c),
          ve = this.nv(x, e.e);
        const vbe = s * (vb - ve),
          vbc = s * (vb - vc);
        const If = e.m.is * (sexp(vbe / (e.m.nf * VT)) - 1);
        const Ir = e.m.is * (sexp(vbc / (e.m.nr * VT)) - 1);
        const ic = (If - Ir) * Math.max(1 - vbc / e.m.vaf, 0.05) - Ir / e.m.br;
        const ib = If / e.m.bf + Ir / e.m.br;
        return Math.abs((vbe - vbc) * ic + vbe * ib);
      }
      default:
        return 0;
    }
  }

  nodeVoltage(i: number) {
    return this.nv(this.x, i);
  }

  private elCache: Map<string, Element> | null = null;
  private elById(id: string) {
    if (!this.elCache) {
      this.elCache = new Map();
      for (const e of this.els) this.elCache.set(e.id, e);
    }
    return this.elCache.get(id);
  }
}

/** Run the full analysis requested. Pure function: usable in a worker or in Node tests. */
export function runSimulation(req: SimRequest): SimResult {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const solver = new MnaSolver(req.circuit);
  const empty: SimResult = {
    seq: req.seq,
    ok: false,
    t: new Float64Array(0),
    data: {},
    op: {},
    stats: { steps: 0, iterations: 0, ms: 0, nodes: solver.nodes, unknowns: solver.n },
    nodeStats: new Float64Array(0),
    power: {},
  };
  const watched = req.circuit.elements.filter((e) => (e.id.startsWith("m.") || e.id.startsWith("u.")) && (e.t === "R" || e.t === "D" || e.t === "Q"));
  const N = req.circuit.nodeCount;
  if (!solver.operatingPoint(0)) {
    return { ...empty, message: "DC operating point did not converge" };
  }
  const op: Record<string, number> = {};
  for (const p of req.probes) op[p.id] = solver.probe(p, 0);

  if (req.tStop <= 0) {
    const data: Record<string, Float64Array> = {};
    for (const p of req.probes) data[p.id] = Float64Array.of(op[p.id], op[p.id]);
    const ms = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
    const nodeStats = new Float64Array(N * 4);
    for (let i = 1; i < N; i++) {
      const v = solver.nodeVoltage(i);
      nodeStats.set([v, v, v, Math.abs(v)], i * 4);
    }
    const power: Record<string, number> = {};
    for (const e of watched) power[e.id] = solver.elementPower(e);
    return {
      seq: req.seq,
      ok: true,
      t: Float64Array.of(0, 1),
      data,
      op,
      stats: { steps: 0, iterations: solver.iterations, ms, nodes: solver.nodes, unknowns: solver.n },
      nodeStats,
      power,
    };
  }

  const dt = req.dtMax;
  const dtS = Math.max(req.dtSettle ?? dt, dt);
  const settleSteps = req.tCapture > 0 ? Math.max(1, Math.round(req.tCapture / dtS)) : 0;
  const dtS2 = settleSteps ? req.tCapture / settleSteps : dt;
  const capSteps = Math.max(1, Math.ceil((req.tStop - req.tCapture) / dt));
  const steps = settleSteps + capSteps;
  const stride = Math.max(1, Math.ceil(capSteps / req.maxPoints));
  const nPts = Math.floor(capSteps / stride) + 1;
  const tArr = new Float64Array(nPts);
  const data: Record<string, Float64Array> = {};
  for (const p of req.probes) data[p.id] = new Float64Array(nPts);
  let idx = 0;
  let t = 0;
  const nSum = new Float64Array(N),
    nSq = new Float64Array(N),
    nMin = new Float64Array(N).fill(Infinity),
    nMax = new Float64Array(N).fill(-Infinity);
  const pSum = new Float64Array(watched.length);
  let nCap = 0;
  let beSteps = 2; // start-up with backward Euler
  for (let s = 0; s < steps; s++) {
    const h = s < settleSteps ? dtS2 : dt;
    if (s === settleSteps) beSteps = Math.max(beSteps, 1);
    if (solver.hasEdge(t, h)) beSteps = 2;
    const useTrap = beSteps <= 0;
    beSteps--;
    if (!solver.step(t, h, useTrap)) {
      return { ...empty, op, message: `Transient failed at t=${t.toExponential(3)} s` };
    }
    t += h;
    if (s >= settleSteps) {
      nCap++;
      for (let i = 1; i < N; i++) {
        const v = solver.nodeVoltage(i);
        nSum[i] += v;
        nSq[i] += v * v;
        if (v < nMin[i]) nMin[i] = v;
        if (v > nMax[i]) nMax[i] = v;
      }
      for (let k = 0; k < watched.length; k++) pSum[k] += solver.elementPower(watched[k]);
      const ci = s - settleSteps;
      if (ci % stride === 0 && idx < nPts) {
        tArr[idx] = t - req.tCapture;
        for (const p of req.probes) data[p.id][idx] = solver.probe(p, t);
        idx++;
      }
    }
  }
  const ms = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
  const tt = tArr.subarray(0, idx);
  for (const k in data) data[k] = data[k].subarray(0, idx);
  const nodeStats = new Float64Array(N * 4);
  for (let i = 1; i < N; i++) {
    const c = Math.max(nCap, 1);
    nodeStats.set([nSum[i] / c, nMin[i], nMax[i], Math.sqrt(nSq[i] / c)], i * 4);
  }
  const power: Record<string, number> = {};
  watched.forEach((e, k) => (power[e.id] = pSum[k] / Math.max(nCap, 1)));
  return {
    seq: req.seq,
    ok: true,
    t: tt,
    data,
    op,
    stats: { steps, iterations: solver.iterations, ms, nodes: solver.nodes, unknowns: solver.n },
    nodeStats,
    power,
  };
}
