/** Waveform measurements (computed on simulated samples, like the scope's own MEASURE engine). */
export interface Measurement {
  max: number;
  min: number;
  vpp: number;
  mean: number;
  /** true RMS including DC */
  rms: number;
  /** RMS of AC component only */
  acRms: number;
  freq: number; // Hz, 0 if not periodic
  period: number; // s
}

export function measure(t: ArrayLike<number>, v: ArrayLike<number>): Measurement {
  const n = Math.min(t.length, v.length);
  if (n < 2) {
    const x = n ? v[0] : 0;
    return { max: x, min: x, vpp: 0, mean: x, rms: Math.abs(x), acRms: 0, freq: 0, period: 0 };
  }
  let max = -Infinity,
    min = Infinity;
  for (let i = 0; i < n; i++) {
    const x = v[i];
    if (x > max) max = x;
    if (x < min) min = x;
  }
  const vpp = max - min;
  // frequency by threshold crossings with hysteresis at mid level
  let freq = 0,
    period = 0;
  if (vpp > 1e-3) {
    const mid = (max + min) / 2;
    const hyst = vpp * 0.1;
    let armed = false;
    const crossings: number[] = [];
    for (let i = 1; i < n; i++) {
      if (v[i] < mid - hyst) armed = true;
      if (armed && v[i - 1] < mid && v[i] >= mid) {
        const f = (mid - v[i - 1]) / (v[i] - v[i - 1] || 1);
        crossings.push(t[i - 1] + f * (t[i] - t[i - 1]));
        armed = false;
      }
    }
    if (crossings.length >= 2) {
      period = (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1);
      freq = period > 0 ? 1 / period : 0;
    }
  }
  // mean / rms over an integer number of periods when possible (trapezoidal integration)
  let i0 = 0,
    i1 = n - 1;
  if (period > 0) {
    const span = t[n - 1] - t[0];
    const k = Math.floor(span / period);
    if (k >= 1) {
      const tEnd = t[0] + k * period;
      while (i1 > 1 && t[i1] > tEnd) i1--;
    }
  }
  let s = 0,
    s2 = 0,
    T = 0;
  for (let i = i0 + 1; i <= i1; i++) {
    const h = t[i] - t[i - 1];
    s += 0.5 * (v[i] + v[i - 1]) * h;
    s2 += 0.5 * (v[i] * v[i] + v[i - 1] * v[i - 1]) * h;
    T += h;
  }
  const mean = T > 0 ? s / T : v[0];
  const rms = T > 0 ? Math.sqrt(Math.max(s2 / T, 0)) : Math.abs(v[0]);
  const acRms = Math.sqrt(Math.max(rms * rms - mean * mean, 0));
  return { max, min, vpp, mean, rms, acRms, freq, period };
}

/** Engineering formatting, e.g. 1.00KHz, 500uS, 10.0V */
export function fmtEng(x: number, unit: string, digits = 3): string {
  if (!Number.isFinite(x)) return "----";
  const ax = Math.abs(x);
  const pref: [number, string][] = [
    [1e6, "M"],
    [1e3, "K"],
    [1, ""],
    [1e-3, "m"],
    [1e-6, "u"],
    [1e-9, "n"],
  ];
  if (ax === 0) return `0.00${unit}`;
  for (const [m, p] of pref) {
    if (ax >= m * 0.9995) {
      const val = x / m;
      const d = Math.abs(val) >= 100 ? 0 : Math.abs(val) >= 10 ? 1 : 2;
      return `${val.toFixed(Math.max(0, Math.min(d, digits - 1)))}${p}${unit}`;
    }
  }
  return `${(x / 1e-9).toFixed(1)}n${unit}`;
}
