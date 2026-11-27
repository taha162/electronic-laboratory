/** cord and socket plastics as photographed on the bench */
export const PLASTIC_COLORS: Record<string, string> = {
  red: "#c8161a",
  black: "#151515",
  yellow: "#e8c414",
  blue: "#1d4fd0",
  green: "#178a3c",
  white: "#eeece4",
  greenyellow: "#9fc21c",
  pin: "#c9a85a",
  // KL-21001 socket colours as photographed (muted pink-red, sky cyan, cream white)
  pink: "#c4566a",
  cyan: "#3ea3d1",
};

/** blue (negative) — white (0 V) — red (positive), saturating at ±12 V */
export function voltageColor(v: number): string {
  if (!Number.isFinite(v)) return "#55585e";
  const t = Math.max(-1, Math.min(1, v / 12));
  const k = Math.sqrt(Math.abs(t));
  const z = [232, 236, 242],
    to = t >= 0 ? [255, 59, 31] : [47, 123, 255];
  const c = z.map((a, i) => Math.round(a + (to[i] - a) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function fmtVolt(v: number) {
  const a = Math.abs(v);
  if (a < 1e-3) return "0 V";
  if (a < 1) return `${(v * 1000).toFixed(0)} mV`;
  return `${v.toFixed(a < 10 ? 2 : 1)} V`;
}
