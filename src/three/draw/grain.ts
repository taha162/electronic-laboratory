/**
 * Fine surface grain as one repeated 128 px noise tile: the same look as
 * scattering tens of thousands of single dots, at a tiny fraction of the cost
 * (one fill instead of 60 000 fillRect calls that blocked the page while loading).
 */
const tiles = new Map<string, CanvasImageSource>();

function makeTile(rgb: [number, number, number], maxAlpha: number, density: number, seed: number): CanvasImageSource | null {
  const N = 128;
  let c: HTMLCanvasElement | OffscreenCanvas | null = null;
  if (typeof OffscreenCanvas !== "undefined") c = new OffscreenCanvas(N, N);
  else if (typeof document !== "undefined") {
    c = document.createElement("canvas");
    c.width = c.height = N;
  }
  if (!c) return null;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D | null;
  if (!ctx) return null;
  const img = ctx.createImageData(N, N);
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N * N; i++) {
    if (r() > density) continue;
    img.data[i * 4] = rgb[0];
    img.data[i * 4 + 1] = rgb[1];
    img.data[i * 4 + 2] = rgb[2];
    img.data[i * 4 + 3] = Math.round(r() * maxAlpha * 255);
  }
  ctx.putImageData(img, 0, 0);
  return c as CanvasImageSource;
}

/** cover the whole canvas (in device pixels, whatever the current transform) with grain */
export function grain(ctx: CanvasRenderingContext2D, rgb: [number, number, number], maxAlpha: number, density: number, seed = 7) {
  const key = `${rgb.join(",")}|${maxAlpha}|${density}|${seed}`;
  let t = tiles.get(key);
  if (t === undefined) {
    t = makeTile(rgb, maxAlpha, density, seed) ?? undefined;
    if (t) tiles.set(key, t);
  }
  if (!t) return;
  const pat = ctx.createPattern(t, "repeat");
  if (!pat) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}
