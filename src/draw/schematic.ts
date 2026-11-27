/**
 * Screen print of the KL module boards, drawn like K&H prints them: a double frame,
 * corner screws, the slanted K&H logo with an italic title, dashed block borders and
 * plain black symbols with designators only (the real boards print no values).
 * All coordinates are in millimetres; the caller scales the context.
 */
import type { MarkDef, ModuleDef, PartDef } from "@/lab/types";
import { KL_SCREWS } from "@/lab/modules/photo";
import { grain } from "./grain";

type P = [number, number];
const INK = "#121212";
const FACE = "#e7e8e7";
/** line weight of the screen print (mm per nominal unit): heavy enough to read from the seat */
const LW = 1.75;
/** transistor symbol scale (radius 6.6 mm, as printed on the boards) */
const QS = 6.6 / 6.2;
const FONT = "Arial, Helvetica, sans-serif";

function seg(ctx: CanvasRenderingContext2D, a: P, b: P) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function poly(ctx: CanvasRenderingContext2D, pts: P[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

/** run `body` in a frame where the symbol axis is +x, centred at origin */
function frame(ctx: CanvasRenderingContext2D, a: P, b: P, pos: number, body: (len: number) => void) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  ctx.save();
  ctx.translate(a[0] + dx * pos, a[1] + dy * pos);
  ctx.rotate(Math.atan2(dy, dx));
  body(L);
  ctx.restore();
}

function leads(ctx: CanvasRenderingContext2D, L: number, pos: number, half: number) {
  seg(ctx, [-L * pos, 0], [-half, 0]);
  seg(ctx, [half, 0], [L * (1 - pos), 0]);
}

function resistorBody(ctx: CanvasRenderingContext2D, half: number) {
  const n = 6;
  const w = (2 * half) / n;
  ctx.beginPath();
  ctx.moveTo(-half, 0);
  for (let i = 0; i < n; i++) ctx.lineTo(-half + w * (i + 0.5), i % 2 ? 1.55 : -1.55);
  ctx.lineTo(half, 0);
  ctx.stroke();
}

function arrowHead(ctx: CanvasRenderingContext2D, tip: P, ang: number, size = 1.6) {
  ctx.beginPath();
  ctx.moveTo(tip[0], tip[1]);
  ctx.lineTo(tip[0] - size * Math.cos(ang - 0.42), tip[1] - size * Math.sin(ang - 0.42));
  ctx.lineTo(tip[0] - size * Math.cos(ang + 0.42), tip[1] - size * Math.sin(ang + 0.42));
  ctx.closePath();
  ctx.fill();
}

function diodeBody(ctx: CanvasRenderingContext2D, h: number, kind: "D" | "Z" | "LED") {
  ctx.beginPath();
  ctx.moveTo(-h, -h);
  ctx.lineTo(-h, h);
  ctx.lineTo(h * 0.85, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  if (kind === "Z") {
    ctx.moveTo(h * 0.85 - 1.1, -h - 0.7);
    ctx.lineTo(h * 0.85, -h);
    ctx.lineTo(h * 0.85, h);
    ctx.lineTo(h * 0.85 + 1.1, h + 0.7);
  } else {
    ctx.moveTo(h * 0.85, -h);
    ctx.lineTo(h * 0.85, h);
  }
  ctx.stroke();
}

/** two little light arrows (out of an LED, into a photodiode / phototransistor) */
function lightArrows(ctx: CanvasRenderingContext2D, x: number, y: number, out: boolean) {
  for (const o of [0, 2.2]) {
    const a: P = [x + o, y];
    const b: P = [x + o + 2.6, y - 2.6];
    if (out) {
      seg(ctx, a, b);
      arrowHead(ctx, b, -Math.PI / 4, 1.3);
    } else {
      seg(ctx, b, a);
      arrowHead(ctx, a, (3 * Math.PI) / 4, 1.3);
    }
  }
}

/** a rheostat as printed: zigzag with the wiper arrow from the side looped back to `tied`'s end */
function rheostat(ctx: CanvasRenderingContext2D, tied: P, other: P, pos: number, half: number) {
  const horizontal = Math.abs(other[0] - tied[0]) >= Math.abs(other[1] - tied[1]);
  frame(ctx, tied, other, pos, (L) => {
    resistorBody(ctx, half);
    leads(ctx, L, pos, half);
  });
  const c: P = [tied[0] + (other[0] - tied[0]) * pos, tied[1] + (other[1] - tied[1]) * pos];
  const sgn = horizontal ? Math.sign(tied[0] - c[0]) || -1 : Math.sign(tied[1] - c[1]) || -1;
  if (horizontal) {
    // wiper from above
    const top = c[1] - 4.6;
    arrowHead(ctx, [c[0], c[1] - 1.7], Math.PI / 2);
    seg(ctx, [c[0], top], [c[0], c[1] - 2.6]);
    const ex = c[0] + sgn * (half + 1.6);
    poly(ctx, [[c[0], top], [ex, top], [ex, c[1]]]);
  } else {
    // wiper from the right
    const side = c[0] + 4.6;
    arrowHead(ctx, [c[0] + 1.7, c[1]], Math.PI);
    seg(ctx, [side, c[1]], [c[0] + 2.6, c[1]]);
    const ey = c[1] + sgn * (half + 1.6);
    poly(ctx, [[side, c[1]], [side, ey], [c[0], ey]]);
  }
}

/** transistor terminal positions for the symbol's orientation */
function qTransform(p: PartDef) {
  const [cx, cy] = p.at ?? [0, 0];
  const face = p.face ?? "w";
  return (x: number, y: number): P => {
    let u = x * QS,
      v = (p.flip ? -y : y) * QS;
    if (face === "e") [u, v] = [-u, -v];
    else if (face === "s") [u, v] = [v, -u];
    else if (face === "n") [u, v] = [-v, u];
    return [cx + u, cy + v];
  };
}

/** a lead from a symbol terminal to its socket: straight when they line up, else one bend */
function leadTo(ctx: CanvasRenderingContext2D, t: P, j: P) {
  if (Math.abs(t[0] - j[0]) < 1.2 || Math.abs(t[1] - j[1]) < 1.2) seg(ctx, t, j);
  else poly(ctx, [t, [j[0], t[1]], j]);
}

export function drawPart(ctx: CanvasRenderingContext2D, p: PartDef, jackPos: (id: string) => P | null) {
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 0.5 * LW;
  const pins = p.pins.map((id) => (!id || id.startsWith("@") ? null : jackPos(id)));
  const pos = p.pos ?? 0.5;
  const a = pins[0],
    b = pins[1];
  let labelAt: P | null = null;
  const twoPinLabel = () => {
    if (!a || !b) return;
    const vertical = Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]);
    const c: P = [a[0] + (b[0] - a[0]) * pos, a[1] + (b[1] - a[1]) * pos];
    labelAt = vertical ? [c[0] - 6.5, c[1]] : [c[0], c[1] - 4.6];
  };
  const bodyLen = (L: number, def: number) => Math.min(p.len ?? def, L * 0.4);

  switch (p.kind) {
    case "R":
      if (!a || !b) break;
      frame(ctx, a, b, pos, (L) => {
        const half = bodyLen(L, 4.6);
        resistorBody(ctx, half);
        leads(ctx, L, pos, half);
      });
      twoPinLabel();
      break;
    case "RV":
      if (!a || !b) break;
      rheostat(ctx, a, b, pos, Math.min(p.len ?? 4.6, Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.35));
      twoPinLabel();
      break;
    case "EXT": {
      if (p.ext === "pot") {
        drawPart(ctx, { ...p, kind: "POT", label: undefined }, jackPos);
        const A = pins[0],
          C = pins[2];
        if (A && C) labelAt = [(A[0] + C[0]) / 2 - 7, (A[1] + C[1]) / 2];
      } else if (a && b) {
        rheostat(ctx, a, b, pos, Math.min(p.len ?? 4.6, Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.35));
        twoPinLabel();
      }
      break;
    }
    case "C":
    case "CP":
      if (!a || !b) break;
      frame(ctx, a, b, pos, (L) => {
        const g = 0.85;
        seg(ctx, [-g, -2.7], [-g, 2.7]);
        if (p.kind === "CP") {
          // electrolytic: hollow plate on the − side, "+" by the + plate
          ctx.strokeRect(g, -2.7, 1.0, 5.4);
          ctx.save();
          ctx.lineWidth = 0.32 * LW;
          seg(ctx, [-g - 2.6, -3.1], [-g - 1.0, -3.1]);
          seg(ctx, [-g - 1.8, -3.9], [-g - 1.8, -2.3]);
          ctx.restore();
          leads(ctx, L, pos, g + 0.05);
          seg(ctx, [g + 1.0, 0], [L * (1 - pos), 0]);
        } else {
          seg(ctx, [g, -2.7], [g, 2.7]);
          leads(ctx, L, pos, g);
        }
      });
      twoPinLabel();
      break;
    case "L":
      if (!a || !b) break;
      frame(ctx, a, b, pos, (L) => {
        const half = bodyLen(L, 4.8);
        const n = 4;
        const r = half / n;
        ctx.beginPath();
        for (let i = 0; i < n; i++) ctx.arc(-half + r * (2 * i + 1), 0, r, Math.PI, 0);
        ctx.stroke();
        leads(ctx, L, pos, half);
      });
      twoPinLabel();
      break;
    case "D":
    case "Z":
    case "LED":
      if (!a || !b) break;
      frame(ctx, a, b, pos, (L) => {
        diodeBody(ctx, 2.0, p.kind as "D" | "Z" | "LED");
        leads(ctx, L, pos, 2.0);
      });
      twoPinLabel();
      break;
    case "SW":
      if (!a || !b) break;
      // push button: two contacts and the plunger above them
      ctx.save();
      ctx.lineWidth = 0.4 * LW;
      for (const q of [a, b]) {
        ctx.beginPath();
        ctx.arc(q[0], q[1], 0.95, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      {
        const y = a[1] - 2.6;
        seg(ctx, [a[0] - 0.6, y], [b[0] + 0.6, y]);
        const mx = (a[0] + b[0]) / 2;
        seg(ctx, [mx, y], [mx, y - 2.4]);
        seg(ctx, [mx - 1.6, y - 2.4], [mx + 1.6, y - 2.4]);
      }
      labelAt = [(a[0] + b[0]) / 2, a[1] - 7];
      break;
    case "POT": {
      const A = pins[0],
        w = pins[1],
        C = pins[2];
      if (!A || !C) break;
      frame(ctx, A, C, 0.5, (L) => {
        resistorBody(ctx, 4.6);
        leads(ctx, L, 0.5, 4.6);
      });
      const mid: P = [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2];
      if (w) {
        const horizontal = Math.abs(C[0] - A[0]) > Math.abs(C[1] - A[1]);
        if (horizontal) {
          const dir = Math.sign(w[1] - mid[1]) || 1;
          leadTo(ctx, w, [mid[0], mid[1] + dir * 2.6]);
          arrowHead(ctx, [mid[0], mid[1] + dir * 1.6], dir > 0 ? -Math.PI / 2 : Math.PI / 2);
        } else {
          const dir = Math.sign(w[0] - mid[0]) || 1;
          leadTo(ctx, w, [mid[0] + dir * 2.6, mid[1]]);
          arrowHead(ctx, [mid[0] + dir * 1.6, mid[1]], dir > 0 ? Math.PI : 0);
        }
      }
      labelAt = [mid[0] - 7, mid[1]];
      break;
    }
    case "NPN":
    case "PNP": {
      const T = qTransform(p);
      const [x, y] = p.at ?? [0, 0];
      ctx.beginPath();
      ctx.arc(x, y, 6.2 * QS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 0.7 * LW;
      seg(ctx, T(-2.2, -3.4), T(-2.2, 3.4));
      ctx.lineWidth = 0.5 * LW;
      seg(ctx, T(-2.2, -1.2), T(2.6, -4.4)); // collector
      seg(ctx, T(-2.2, 1.2), T(2.6, 4.4)); // emitter
      const npn = p.kind === "NPN";
      const tip = npn ? T(2.6, 4.4) : T(-2.0, 1.3);
      const back = npn ? T(0.9, 3.3) : T(-0.3, 2.4);
      arrowHead(ctx, tip, Math.atan2(tip[1] - back[1], tip[0] - back[0]), 1.8);
      const [cj, bj, ej] = pins;
      if (cj) leadTo(ctx, T(2.6, -4.4), cj);
      if (bj) leadTo(ctx, T(-2.2, 0), bj);
      if (ej) leadTo(ctx, T(2.6, 4.4), ej);
      labelAt = [x - 8, y - 9];
      break;
    }
    case "OA": {
      const [x, y] = p.at ?? [0, 0];
      ctx.beginPath();
      ctx.moveTo(x - 7, y - 8);
      ctx.lineTo(x - 7, y + 8);
      ctx.lineTo(x + 8, y);
      ctx.closePath();
      ctx.stroke();
      ctx.font = `3px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("−", x - 5, y - 4);
      ctx.fillText("+", x - 5, y + 4);
      const [inn, inp, out] = pins;
      if (inn) leadTo(ctx, [x - 7, y - 4], inn);
      if (inp) leadTo(ctx, [x - 7, y + 4], inp);
      if (out) leadTo(ctx, [x + 8, y], out);
      labelAt = [x + 2, y + 11];
      break;
    }
  }
  if (!p.label) return;
  const L = p.lp ?? labelAt;
  if (!L) return;
  ctx.fillStyle = INK;
  ctx.font = `bold 4.3px ${FONT}`;
  ctx.textAlign = p.lp ? "center" : labelAt && a && b && Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]) ? "right" : "center";
  ctx.textBaseline = "middle";
  ctx.fillText(p.label, L[0], L[1]);
}

function drawMark(ctx: CanvasRenderingContext2D, mk: MarkDef, socketAt: (x: number, y: number) => boolean) {
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 0.5 * LW;
  switch (mk.kind) {
    case "gnd": {
      const y0 = socketAt(mk.x, mk.y) ? mk.y + 3.1 : mk.y;
      const y1 = y0 + 3;
      seg(ctx, [mk.x, y0], [mk.x, y1]);
      seg(ctx, [mk.x - 3, y1], [mk.x + 3, y1]);
      seg(ctx, [mk.x - 2, y1 + 1.15], [mk.x + 2, y1 + 1.15]);
      seg(ctx, [mk.x - 1, y1 + 2.3], [mk.x + 1, y1 + 2.3]);
      break;
    }
    case "arrow": {
      const d = { e: [1, 0], w: [-1, 0], n: [0, -1], s: [0, 1] }[mk.dir] as P;
      const r0 = socketAt(mk.x, mk.y) ? 3.1 : 0;
      const a: P = [mk.x + d[0] * r0, mk.y + d[1] * r0];
      const b: P = [a[0] + d[0] * 6, a[1] + d[1] * 6];
      seg(ctx, a, b);
      arrowHead(ctx, [b[0] + d[0] * 0.6, b[1] + d[1] * 0.6], Math.atan2(d[1], d[0]), 1.9);
      break;
    }
    case "ac": {
      // signal input: an arrow out to the left with a sine above it
      const x0 = mk.x - 3.1,
        x1 = mk.x - 12.5;
      seg(ctx, [x0, mk.y], [x1, mk.y]);
      arrowHead(ctx, [x1 - 0.6, mk.y], Math.PI, 1.9);
      ctx.beginPath();
      const ys = mk.y - 3.2;
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const px = x1 + 1.2 + t * 7.4,
          py = ys - Math.sin(t * Math.PI * 2) * 1.7;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.stroke();
      seg(ctx, [x1 + 1.2, ys - 2.4], [x1 + 1.2, mk.y]);
      break;
    }
    case "dot":
      ctx.beginPath();
      ctx.arc(mk.x, mk.y, 0.9, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "line":
      ctx.save();
      if (mk.dash) ctx.setLineDash([1.6, 1.1]);
      ctx.lineWidth = 0.42 * LW;
      poly(ctx, mk.pts);
      ctx.restore();
      break;
    case "light":
      lightArrows(ctx, mk.x, mk.y, !!mk.out);
      break;
  }
}

/** the slanted K&H logo */
function logo(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.lineWidth = 0.45 * LW;
  ctx.beginPath();
  ctx.moveTo(x + 2.6, y);
  ctx.lineTo(x + 20, y);
  ctx.lineTo(x + 17.4, y + 8.2);
  ctx.lineTo(x, y + 8.2);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 4.2, y + 1.3);
  ctx.lineTo(x + 18.2, y + 1.3);
  ctx.lineTo(x + 16.0, y + 6.9);
  ctx.lineTo(x + 1.9, y + 6.9);
  ctx.closePath();
  ctx.stroke();
  ctx.font = `italic bold 5.2px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("KH", x + 10, y + 4.3);
  ctx.restore();
}

/** draw the whole printed face of a module board */
export function drawModuleFace(ctx: CanvasRenderingContext2D, m: ModuleDef) {
  const [W, H] = m.size;
  ctx.fillStyle = FACE;
  ctx.fillRect(0, 0, W, H);
  grain(ctx, [0, 0, 0], 0.02, 0.03, 5);
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;

  // double frame around the face
  ctx.lineWidth = 0.55 * LW;
  ctx.strokeRect(4.2, 4.0, W - 8.4, H - 8.0);
  ctx.lineWidth = 0.3 * LW;
  ctx.strokeRect(6.0, 5.8, W - 12, H - 11.6);
  // corner screws
  const screws: P[] = m.breadboard ? [[11, 11], [W - 11, 11], [11, H - 11], [W - 11, H - 11]] : KL_SCREWS.map(([x, y]) => [x, (y * H) / 236] as P);
  for (const [sx, sy] of screws) {
    const g = ctx.createRadialGradient(sx - 1.2, sy - 1.2, 0.4, sx, sy, 4.4);
    g.addColorStop(0, "#5a5a5a");
    g.addColorStop(1, "#0c0c0c");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, 4.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 0.6;
    seg(ctx, [sx - 2.6, sy + 1.1], [sx + 2.6, sy - 1.1]);
    ctx.strokeStyle = INK;
  }
  ctx.fillStyle = INK;
  // logo and title
  logo(ctx, 23, 11);
  // the title stops short of the DIP-switch cap, as on the real boards
  const dip = m.props?.find((p) => p.kind === "dip");
  const room = (dip ? dip.x - (dip.w ?? 60) / 2 - 6 : W - 20) - 49;
  ctx.font = `italic bold 7.2px ${FONT}`;
  const tw = ctx.measureText(m.code).width + 7 + ctx.measureText(m.title).width;
  const fs = tw > room ? (7.2 * room) / tw : 7.2;
  ctx.font = `italic bold ${fs.toFixed(2)}px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText(m.code, 49, 18.6);
  ctx.fillText(m.title, 49 + ctx.measureText(m.code).width + 7 * (fs / 7.2), 18.6);

  const jmap = new Map(m.jacks.map((j) => [j.id, j]));
  const jp = (id: string): P | null => {
    const j = jmap.get(id);
    return j ? [j.x, j.y] : null;
  };
  const visible = m.jacks.filter((j) => !j.hidden);
  const socketAt = (x: number, y: number) => visible.some((j) => Math.abs(j.x - x) < 2 && Math.abs(j.y - y) < 2);

  // block borders (dashed) and their labels
  ctx.setLineDash([2.6, 1.6]);
  ctx.lineWidth = 0.42 * LW;
  if (m.dashes) for (const d of m.dashes) poly(ctx, d);
  ctx.font = `italic bold 6px ${FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  for (const b of m.blocks) {
    if (m.breadboard) continue;
    if (!m.dashes) {
      const [x, y, w, h] = b.rect;
      ctx.strokeRect(x, y, w, h);
    }
    const [lx, ly] = b.at ?? [b.rect[0] + b.rect[2] - 2, b.rect[1] + b.rect[3] - 2.6];
    ctx.fillText(b.label, lx, ly);
  }
  ctx.setLineDash([]);

  if (m.breadboard) {
    ctx.fillStyle = "#e9e9e2";
    ctx.fillRect(10, 22, 348, 224);
    ctx.fillStyle = "#d9d9d2";
    ctx.fillRect(10, 136, 348, 8);
    ctx.strokeStyle = "#c8312a";
    ctx.lineWidth = 0.5 * LW;
    seg(ctx, [24, 24], [340, 24]);
    seg(ctx, [24, 212], [340, 212]);
    ctx.strokeStyle = "#2c4fb8";
    seg(ctx, [24, 50], [340, 50]);
    seg(ctx, [24, 238], [340, 238]);
    ctx.fillStyle = INK;
  }

  // printed traces
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.5 * LW;
  ctx.lineJoin = "miter";
  for (const tr of m.traces) {
    if (m.breadboard) break;
    const pts = tr.map((p) => (typeof p === "string" ? jp(p) : p)).filter(Boolean) as P[];
    if (pts.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = pts[i - 1];
      const [x, y] = pts[i];
      // route orthogonally (horizontal first) between two sockets that do not line up
      if (Math.abs(px - x) > 1.2 && Math.abs(py - y) > 1.2 && typeof tr[i] === "string" && typeof tr[i - 1] === "string") ctx.lineTo(x, py);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (const mk of m.marks ?? []) drawMark(ctx, mk, socketAt);
  for (const p of m.parts) drawPart(ctx, p, jp);

  // socket holes + labels
  for (const j of visible) {
    ctx.fillStyle = "#1b1b1b";
    ctx.beginPath();
    ctx.arc(j.x, j.y, 3.0, 0, Math.PI * 2);
    ctx.fill();
    if (j.label) {
      ctx.fillStyle = INK;
      ctx.font = `bold 4.4px ${FONT}`;
      ctx.textBaseline = "middle";
      const off = 6.0;
      const lp = j.lp ?? "n";
      ctx.textAlign = lp === "e" ? "left" : lp === "w" ? "right" : "center";
      const dx = lp === "e" ? off - 1.2 : lp === "w" ? -off + 1.2 : 0;
      const dy = lp === "n" ? -off : lp === "s" ? off : 0;
      ctx.fillText(j.label, j.x + dx, j.y + dy);
    }
  }
  ctx.textBaseline = "middle";
  for (const t of m.texts ?? []) {
    ctx.fillStyle = t.color ?? INK;
    ctx.font = `${t.bold ? "bold " : ""}${t.size ?? 3}px ${FONT}`;
    ctx.textAlign = t.align ?? "center";
    ctx.fillText(t.text, t.x, t.y);
  }
}
