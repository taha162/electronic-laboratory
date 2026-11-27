/**
 * A recording stand-in for CanvasRenderingContext2D that writes SVG instead of pixels.
 * The bench's printed faces (trainer panel, module boards, meter scales, instrument
 * fronts) are drawn with the canvas API; replaying the same code into this context
 * turns them into vector art that stays sharp at any zoom.
 *
 * Paths are kept in device space (points transformed as they are added, as canvas
 * does), arcs become cubic Béziers (exact under affine maps), text keeps its own
 * transform. Only what the bench's drawing code uses is implemented.
 */
type M = [number, number, number, number, number, number];
type Cmd = ["M" | "L", number, number] | ["C", number, number, number, number, number, number] | ["Q", number, number, number, number] | ["Z"];

interface Grad {
  __grad: true;
  id: string;
  kind: "linear" | "radial";
  args: number[];
  stops: [number, string][];
  addColorStop(o: number, c: string): void;
}
type Style = string | Grad | { __pattern: true };

interface State {
  m: M;
  fillStyle: Style;
  strokeStyle: Style;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  miterLimit: number;
  dash: number[];
  dashOffset: number;
  globalAlpha: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  composite: string;
}

const num = (v: number) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let measurer: CanvasRenderingContext2D | null = null;
function measureCtx() {
  if (!measurer && typeof document !== "undefined") measurer = document.createElement("canvas").getContext("2d");
  return measurer;
}

let gradSeq = 0;

export class SvgCtx {
  canvas: { width: number; height: number };
  private st: State;
  private stack: State[] = [];
  private path: Cmd[] = [];
  private cur: [number, number] | null = null;
  private start: [number, number] | null = null;
  private out: string[] = [];
  private defs: string[] = [];
  private usedGrads = new Set<string>();

  constructor(width: number, height: number) {
    this.canvas = { width, height };
    this.st = {
      m: [1, 0, 0, 1, 0, 0],
      fillStyle: "#000",
      strokeStyle: "#000",
      lineWidth: 1,
      lineCap: "butt",
      lineJoin: "miter",
      miterLimit: 10,
      dash: [],
      dashOffset: 0,
      globalAlpha: 1,
      font: "10px sans-serif",
      textAlign: "start",
      textBaseline: "alphabetic",
      composite: "source-over",
    };
  }

  /* ---------------- state ---------------- */
  get fillStyle() {
    return this.st.fillStyle as unknown as string;
  }
  set fillStyle(v: string | CanvasGradient | CanvasPattern) {
    if (v) this.st.fillStyle = v as unknown as Style;
  }
  get strokeStyle() {
    return this.st.strokeStyle as unknown as string;
  }
  set strokeStyle(v: string | CanvasGradient | CanvasPattern) {
    if (v) this.st.strokeStyle = v as unknown as Style;
  }
  get lineWidth() {
    return this.st.lineWidth;
  }
  set lineWidth(v: number) {
    if (v > 0 && Number.isFinite(v)) this.st.lineWidth = v;
  }
  get lineCap() {
    return this.st.lineCap;
  }
  set lineCap(v: CanvasLineCap) {
    this.st.lineCap = v;
  }
  get lineJoin() {
    return this.st.lineJoin;
  }
  set lineJoin(v: CanvasLineJoin) {
    this.st.lineJoin = v;
  }
  get miterLimit() {
    return this.st.miterLimit;
  }
  set miterLimit(v: number) {
    this.st.miterLimit = v;
  }
  get globalAlpha() {
    return this.st.globalAlpha;
  }
  set globalAlpha(v: number) {
    this.st.globalAlpha = Math.min(Math.max(v, 0), 1);
  }
  get font() {
    return this.st.font;
  }
  set font(v: string) {
    this.st.font = v;
  }
  get textAlign() {
    return this.st.textAlign;
  }
  set textAlign(v: CanvasTextAlign) {
    this.st.textAlign = v;
  }
  get textBaseline() {
    return this.st.textBaseline;
  }
  set textBaseline(v: CanvasTextBaseline) {
    this.st.textBaseline = v;
  }
  get globalCompositeOperation() {
    return this.st.composite;
  }
  set globalCompositeOperation(v: string) {
    this.st.composite = v;
  }
  get lineDashOffset() {
    return this.st.dashOffset;
  }
  set lineDashOffset(v: number) {
    this.st.dashOffset = v;
  }
  // effects the prints do not need
  shadowBlur = 0;
  shadowColor = "transparent";
  shadowOffsetX = 0;
  shadowOffsetY = 0;
  filter = "none";
  imageSmoothingEnabled = true;

  save() {
    this.stack.push({ ...this.st, m: [...this.st.m] as M, dash: [...this.st.dash] });
  }
  restore() {
    const s = this.stack.pop();
    if (s) this.st = s;
  }
  setLineDash(d: number[]) {
    this.st.dash = d.length % 2 ? [...d, ...d] : [...d];
  }
  getLineDash() {
    return [...this.st.dash];
  }

  /* ---------------- transforms ---------------- */
  private mul(n: M) {
    const [a, b, c, d, e, f] = this.st.m;
    const [A, B, C, D, E, F] = n;
    this.st.m = [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];
  }
  translate(x: number, y: number) {
    this.mul([1, 0, 0, 1, x, y]);
  }
  scale(x: number, y: number) {
    this.mul([x, 0, 0, y, 0, 0]);
  }
  rotate(t: number) {
    const c = Math.cos(t),
      s = Math.sin(t);
    this.mul([c, s, -s, c, 0, 0]);
  }
  transform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.mul([a, b, c, d, e, f]);
  }
  setTransform(a: number | DOMMatrix2DInit = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    if (typeof a === "object") {
      const o = a;
      this.st.m = [o.a ?? 1, o.b ?? 0, o.c ?? 0, o.d ?? 1, o.e ?? 0, o.f ?? 0];
    } else this.st.m = [a, b, c, d, e, f];
  }
  resetTransform() {
    this.st.m = [1, 0, 0, 1, 0, 0];
  }
  getTransform() {
    const [a, b, c, d, e, f] = this.st.m;
    return { a, b, c, d, e, f } as DOMMatrix;
  }
  private tp(x: number, y: number): [number, number] {
    const [a, b, c, d, e, f] = this.st.m;
    return [a * x + c * y + e, b * x + d * y + f];
  }
  private scaleOf() {
    const [a, b, c, d] = this.st.m;
    return Math.sqrt(Math.abs(a * d - b * c)) || 1;
  }

  /* ---------------- paths ---------------- */
  beginPath() {
    this.path = [];
    this.cur = null;
    this.start = null;
  }
  moveTo(x: number, y: number) {
    const p = this.tp(x, y);
    this.path.push(["M", p[0], p[1]]);
    this.cur = p;
    this.start = p;
  }
  lineTo(x: number, y: number) {
    if (!this.cur) return this.moveTo(x, y);
    const p = this.tp(x, y);
    this.path.push(["L", p[0], p[1]]);
    this.cur = p;
  }
  closePath() {
    if (!this.cur) return;
    this.path.push(["Z"]);
    if (this.start) this.cur = this.start;
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    if (!this.cur) this.moveTo(cx, cy);
    const c = this.tp(cx, cy),
      p = this.tp(x, y);
    this.path.push(["Q", c[0], c[1], p[0], p[1]]);
    this.cur = p;
  }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    if (!this.cur) this.moveTo(c1x, c1y);
    const a = this.tp(c1x, c1y),
      b = this.tp(c2x, c2y),
      p = this.tp(x, y);
    this.path.push(["C", a[0], a[1], b[0], b[1], p[0], p[1]]);
    this.cur = p;
  }
  rect(x: number, y: number, w: number, h: number) {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.closePath();
  }
  roundRect(x: number, y: number, w: number, h: number, r: number | number[] = 0) {
    const rr = Math.min(Array.isArray(r) ? (r[0] ?? 0) : r, Math.abs(w) / 2, Math.abs(h) / 2);
    if (rr <= 0) return this.rect(x, y, w, h);
    this.moveTo(x + rr, y);
    this.lineTo(x + w - rr, y);
    this.arc(x + w - rr, y + rr, rr, -Math.PI / 2, 0);
    this.lineTo(x + w, y + h - rr);
    this.arc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2);
    this.lineTo(x + rr, y + h);
    this.arc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI);
    this.lineTo(x, y + rr);
    this.arc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5);
    this.closePath();
  }
  /** elliptical arc in local space as Bézier segments (≤ 90° each) */
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw = false) {
    let sweep = a1 - a0;
    const TAU = Math.PI * 2;
    if (!ccw) {
      if (sweep >= TAU) sweep = TAU;
      else while (sweep < 0) sweep += TAU;
    } else {
      if (sweep <= -TAU) sweep = -TAU;
      else while (sweep > 0) sweep -= TAU;
    }
    const cr = Math.cos(rot),
      sr = Math.sin(rot);
    const pt = (t: number): [number, number] => {
      const ex = rx * Math.cos(t),
        ey = ry * Math.sin(t);
      return [x + ex * cr - ey * sr, y + ex * sr + ey * cr];
    };
    const d = (t: number): [number, number] => {
      const ex = -rx * Math.sin(t),
        ey = ry * Math.cos(t);
      return [ex * cr - ey * sr, ex * sr + ey * cr];
    };
    const p0 = pt(a0);
    if (this.cur) this.lineTo(p0[0], p0[1]);
    else this.moveTo(p0[0], p0[1]);
    const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9));
    const step = sweep / n;
    const k = (4 / 3) * Math.tan(step / 4);
    for (let i = 0; i < n; i++) {
      const t0 = a0 + i * step,
        t1 = t0 + step;
      const q0 = pt(t0),
        q1 = pt(t1),
        d0 = d(t0),
        d1 = d(t1);
      this.bezierCurveTo(q0[0] + k * d0[0], q0[1] + k * d0[1], q1[0] - k * d1[0], q1[1] - k * d1[1], q1[0], q1[1]);
    }
  }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false) {
    this.ellipse(x, y, r, r, 0, a0, a1, ccw);
  }
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number) {
    // needs the current point in local space: invert the transform
    if (!this.cur) return this.moveTo(x1, y1);
    const [a, b, c, d, e, f] = this.st.m;
    const det = a * d - b * c;
    const px = (d * (this.cur[0] - e) - c * (this.cur[1] - f)) / det,
      py = (-b * (this.cur[0] - e) + a * (this.cur[1] - f)) / det;
    const v1x = px - x1,
      v1y = py - y1,
      v2x = x2 - x1,
      v2y = y2 - y1;
    const l1 = Math.hypot(v1x, v1y),
      l2 = Math.hypot(v2x, v2y);
    if (!l1 || !l2 || r === 0) return this.lineTo(x1, y1);
    const ang = Math.acos(Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / (l1 * l2))));
    if (Math.abs(ang - Math.PI) < 1e-6 || ang < 1e-6) return this.lineTo(x1, y1);
    const t = r / Math.tan(ang / 2);
    const s1: [number, number] = [x1 + (v1x / l1) * t, y1 + (v1y / l1) * t];
    const s2: [number, number] = [x1 + (v2x / l2) * t, y1 + (v2y / l2) * t];
    // centre: along the bisector
    const bx = v1x / l1 + v2x / l2,
      by = v1y / l1 + v2y / l2;
    const bl = Math.hypot(bx, by);
    const dist = r / Math.sin(ang / 2);
    const cx = x1 + (bx / bl) * dist,
      cy = y1 + (by / bl) * dist;
    const a0 = Math.atan2(s1[1] - cy, s1[0] - cx),
      a1 = Math.atan2(s2[1] - cy, s2[0] - cx);
    const cross = v1x * v2y - v1y * v2x;
    this.lineTo(s1[0], s1[1]);
    this.arc(cx, cy, r, a0, a1, cross > 0);
  }

  private d() {
    return this.path
      .map((c) => (c[0] === "Z" ? "Z" : c[0] + c.slice(1).map((v) => num(v as number)).join(" ")))
      .join("");
  }

  /* ---------------- paint ---------------- */
  private paint(style: Style): string | null {
    if (typeof style === "string") return style;
    if ((style as { __pattern?: boolean }).__pattern) return null;
    const g = style as Grad;
    // gradients live in the user space at the time of painting
    const key = `${g.id}-${this.st.m.map(num).join("_")}`;
    if (!this.usedGrads.has(key)) {
      this.usedGrads.add(key);
      const stops = g.stops.map(([o, c]) => `<stop offset="${num(o)}" stop-color="${esc(c)}"/>`).join("");
      const tf = `gradientTransform="matrix(${this.st.m.map(num).join(" ")})" gradientUnits="userSpaceOnUse"`;
      if (g.kind === "linear") {
        const [x0, y0, x1, y1] = g.args;
        this.defs.push(`<linearGradient id="${key}" ${tf} x1="${num(x0)}" y1="${num(y0)}" x2="${num(x1)}" y2="${num(y1)}">${stops}</linearGradient>`);
      } else {
        const [x0, y0, r0, x1, y1, r1] = g.args;
        const fr = r1 > 0 ? Math.min(Math.max(r0 / r1, 0), 1) : 0;
        this.defs.push(
          `<radialGradient id="${key}" ${tf} fx="${num(x0)}" fy="${num(y0)}" cx="${num(x1)}" cy="${num(y1)}" r="${num(r1)}">${g.stops
            .map(([o, c]) => `<stop offset="${num(fr + o * (1 - fr))}" stop-color="${esc(c)}"/>`)
            .join("")}</radialGradient>`,
        );
      }
    }
    return `url(#${key})`;
  }
  private common() {
    let a = "";
    if (this.st.globalAlpha < 1) a += ` opacity="${num(this.st.globalAlpha)}"`;
    if (this.st.composite === "multiply" || this.st.composite === "screen") a += ` style="mix-blend-mode:${this.st.composite}"`;
    return a;
  }
  private strokeAttrs() {
    const s = this.scaleOf();
    let a = ` stroke-width="${num(this.st.lineWidth * s)}"`;
    if (this.st.lineCap !== "butt") a += ` stroke-linecap="${this.st.lineCap}"`;
    if (this.st.lineJoin !== "miter") a += ` stroke-linejoin="${this.st.lineJoin}"`;
    if (this.st.dash.length) a += ` stroke-dasharray="${this.st.dash.map((v) => num(v * s)).join(" ")}"` + (this.st.dashOffset ? ` stroke-dashoffset="${num(this.st.dashOffset * s)}"` : "");
    return a;
  }
  fill(rule?: CanvasFillRule | Path2D) {
    if (!this.path.length) return;
    const p = this.paint(this.st.fillStyle);
    if (!p) return;
    const r = rule === "evenodd" ? ` fill-rule="evenodd"` : "";
    this.out.push(`<path d="${this.d()}" fill="${esc(p)}"${r}${this.common()}/>`);
  }
  stroke() {
    if (!this.path.length) return;
    const p = this.paint(this.st.strokeStyle);
    if (!p) return;
    this.out.push(`<path d="${this.d()}" fill="none" stroke="${esc(p)}"${this.strokeAttrs()}${this.common()}/>`);
  }
  fillRect(x: number, y: number, w: number, h: number) {
    const saved = this.path;
    this.beginPath();
    this.rect(x, y, w, h);
    this.fill();
    this.path = saved;
  }
  strokeRect(x: number, y: number, w: number, h: number) {
    const saved = this.path;
    this.beginPath();
    this.rect(x, y, w, h);
    this.stroke();
    this.path = saved;
  }
  clearRect() {
    /* the prints never clear */
  }
  clip() {
    /* not used by the prints */
  }

  /* ---------------- text ---------------- */
  private textEl(s: string, x: number, y: number, mode: "fill" | "stroke") {
    if (!s) return;
    const p = this.paint(mode === "fill" ? this.st.fillStyle : this.st.strokeStyle);
    if (!p) return;
    const anchor = { start: "start", left: "start", center: "middle", right: "end", end: "end" }[this.st.textAlign] ?? "start";
    const base = { middle: "central", top: "hanging", hanging: "hanging", bottom: "text-after-edge", ideographic: "text-after-edge", alphabetic: "" }[this.st.textBaseline] ?? "";
    const paint = mode === "fill" ? `fill="${esc(p)}"` : `fill="none" stroke="${esc(p)}" stroke-width="${num(this.st.lineWidth)}" stroke-linejoin="round"`;
    this.out.push(
      `<text transform="matrix(${this.st.m.map(num).join(" ")})" x="${num(x)}" y="${num(y)}" style="font:${esc(this.st.font)};white-space:pre" text-anchor="${anchor}"${base ? ` dominant-baseline="${base}"` : ""} ${paint}${this.common()}>${esc(s)}</text>`,
    );
  }
  fillText(s: string, x: number, y: number) {
    this.textEl(s, x, y, "fill");
  }
  strokeText(s: string, x: number, y: number) {
    this.textEl(s, x, y, "stroke");
  }
  measureText(s: string): TextMetrics {
    const m = measureCtx();
    if (m) {
      m.font = this.st.font;
      return m.measureText(s);
    }
    const size = parseFloat(/([\d.]+)px/.exec(this.st.font)?.[1] ?? "10");
    return { width: s.length * size * 0.55 } as TextMetrics;
  }

  /* ---------------- paints / images ---------------- */
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient {
    return this.grad("linear", [x0, y0, x1, y1]);
  }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient {
    return this.grad("radial", [x0, y0, r0, x1, y1, r1]);
  }
  private grad(kind: "linear" | "radial", args: number[]): CanvasGradient {
    const g: Grad = {
      __grad: true,
      id: `g${(gradSeq++).toString(36)}`,
      kind,
      args,
      stops: [],
      addColorStop(o: number, c: string) {
        this.stops.push([o, c]);
      },
    };
    return g as unknown as CanvasGradient;
  }
  createPattern(): CanvasPattern | null {
    return null; // the fine grain textures are left out of the vector prints
  }
  drawImage() {}
  putImageData() {}
  getImageData(_x: number, _y: number, w: number, h: number) {
    return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) } as ImageData;
  }
  createImageData(w: number, h: number) {
    return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) } as ImageData;
  }

  /** the recorded drawing as a standalone SVG document */
  toSvg(viewBox = `0 0 ${this.canvas.width} ${this.canvas.height}`) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${this.canvas.width}" height="${this.canvas.height}"><defs>${this.defs.join("")}</defs>${this.out.join("")}</svg>`;
  }
}

/** run a canvas-style drawing function into SVG */
export function drawToSvg(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = new SvgCtx(width, height);
  draw(c as unknown as CanvasRenderingContext2D);
  return c.toSvg();
}

/** an object URL for an SVG document (cached by key) */
const urls = new Map<string, string>();
export function svgUrl(key: string, make: () => string) {
  let u = urls.get(key);
  if (!u) {
    const svg = make();
    u = typeof URL !== "undefined" && typeof Blob !== "undefined" ? URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })) : `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    urls.set(key, u);
  }
  return u;
}
