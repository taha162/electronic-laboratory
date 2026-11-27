/**
 * Schematic symbol drawing for the printed module boards.
 * All coordinates are in millimetres; the caller scales the context.
 */
import type { ModuleDef, PartDef } from "@/lab/types";

type P = [number, number];
const INK = "#101010";
/** line weight of the screen print (mm per nominal unit): heavy enough to read from the seat */
const LW = 1.75;

function seg(ctx: CanvasRenderingContext2D, a: P, b: P) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

/** run `body` in a frame where the symbol axis is +x, centred at origin */
function frame(ctx: CanvasRenderingContext2D, a: P, b: P, pos: number, body: (len: number) => void) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  const cx = a[0] + dx * pos,
    cy = a[1] + dy * pos;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.atan2(dy, dx));
  body(L);
  ctx.restore();
}

function leads(ctx: CanvasRenderingContext2D, L: number, pos: number, half: number) {
  // lead lines from both pins to the symbol body (in symbol frame)
  seg(ctx, [-L * pos, 0], [-half, 0]);
  seg(ctx, [half, 0], [L * (1 - pos), 0]);
}

function resistorBody(ctx: CanvasRenderingContext2D, half: number) {
  const n = 6;
  const w = (2 * half) / n;
  ctx.beginPath();
  ctx.moveTo(-half, 0);
  for (let i = 0; i < n; i++) ctx.lineTo(-half + w * (i + 0.5), i % 2 ? 1.6 : -1.6);
  ctx.lineTo(half, 0);
  ctx.stroke();
}

function diodeBody(ctx: CanvasRenderingContext2D, h: number, kind: "D" | "Z" | "LED") {
  ctx.beginPath();
  ctx.moveTo(-h, -h);
  ctx.lineTo(-h, h);
  ctx.lineTo(h * 0.8, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  if (kind === "Z") {
    ctx.moveTo(h * 0.8 - 1, -h - 0.6);
    ctx.lineTo(h * 0.8, -h);
    ctx.lineTo(h * 0.8, h);
    ctx.lineTo(h * 0.8 + 1, h + 0.6);
  } else {
    ctx.moveTo(h * 0.8, -h);
    ctx.lineTo(h * 0.8, h);
  }
  ctx.stroke();
  if (kind === "LED") {
    for (const o of [0, 2]) {
      ctx.beginPath();
      ctx.moveTo(-0.5 + o, -h - 0.8);
      ctx.lineTo(1.5 + o, -h - 2.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(1.5 + o, -h - 2.8);
      ctx.lineTo(0.5 + o, -h - 2.4);
      ctx.lineTo(1.2 + o, -h - 1.8);
      ctx.closePath();
      ctx.fill();
    }
  }
}

export function drawPart(ctx: CanvasRenderingContext2D, p: PartDef, jackPos: (id: string) => P | null) {
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 0.5 * LW;
  const pins = p.pins.map((id) => (id.startsWith("@") ? null : jackPos(id)));
  const pos = p.pos ?? 0.5;
  let labelAt: P | null = null;
  let labelRot = 0;

  const twoPin = (body: (len: number) => number) => {
    const a = pins[0],
      b = pins[1];
    if (!a || !b) return;
    frame(ctx, a, b, pos, (L) => {
      const half = body(L);
      if (!p.noLeads) leads(ctx, L, pos, half);
    });
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L,
      ny = dx / L;
    const vertical = Math.abs(dy) > Math.abs(dx);
    const c: P = [a[0] + dx * pos, a[1] + dy * pos];
    labelAt = vertical ? [c[0] + 3.2, c[1]] : [c[0] + nx * 0 , c[1] - 4.2];
    labelRot = 0;
    void ny;
  };

  switch (p.kind) {
    case "EXT":
      // external part: printed dashed, completed with a patch cord to the KL-21001 VR
      ctx.save();
      ctx.setLineDash([1.6, 1.1]);
      drawPart(ctx, { ...p, kind: p.ext === "pot" ? "POT" : "RV", label: undefined, text: undefined }, jackPos);
      ctx.restore();
      if (pins[0] && pins[1]) {
        const a = pins[0],
          b = pins[p.ext === "pot" ? 2 : 1] ?? pins[1];
        const mid: P = p.at ?? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        ctx.fillStyle = "#b3261e";
        ctx.font = "bold 3.4px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        if (p.label) ctx.fillText(p.label, mid[0] - 7, mid[1] - 2);
        ctx.font = "bold 2.9px Arial";
        if (p.text) ctx.fillText(p.text, mid[0] - 7, mid[1] + 2.2);
        ctx.fillStyle = INK;
      }
      return;
    case "R":
    case "RV":
      twoPin((L) => {
        const half = Math.min(5, L * 0.3);
        resistorBody(ctx, half);
        if (p.kind === "RV") {
          seg(ctx, [-half, 3], [half, -3]);
          ctx.beginPath();
          ctx.moveTo(half, -3);
          ctx.lineTo(half - 1.6, -2.6);
          ctx.lineTo(half - 0.8, -1.6);
          ctx.closePath();
          ctx.fill();
        }
        return half;
      });
      break;
    case "C":
    case "CP":
      twoPin(() => {
        const g = 0.9;
        seg(ctx, [-g, -2.6], [-g, 2.6]);
        if (p.kind === "CP") {
          ctx.beginPath();
          ctx.arc(g + 3.2, 0, 3.2, Math.PI * 0.8, Math.PI * 1.2);
          ctx.stroke();
          ctx.font = "2.2px Arial";
          ctx.fillText("+", -g - 2.4, -1.4);
        } else seg(ctx, [g, -2.6], [g, 2.6]);
        return g;
      });
      break;
    case "L":
      twoPin((L) => {
        const half = Math.min(5.5, L * 0.32);
        const n = 4;
        const r = half / n;
        ctx.beginPath();
        for (let i = 0; i < n; i++) ctx.arc(-half + r * (2 * i + 1), 0, r, Math.PI, 0);
        ctx.stroke();
        return half;
      });
      break;
    case "D":
    case "Z":
    case "LED":
      twoPin(() => {
        diodeBody(ctx, 1.9, p.kind as "D" | "Z" | "LED");
        return 1.9;
      });
      break;
    case "POT": {
      const a = pins[0],
        w = pins[1],
        c = pins[2];
      if (!a || !c) break;
      frame(ctx, a, c, 0.5, (L) => {
        resistorBody(ctx, 5);
        leads(ctx, L, 0.5, 5);
      });
      const mid: P = p.at ?? [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
      if (w) {
        // wiper arrow from the wiper jack to the body
        const dir = Math.sign(w[0] - mid[0]) || 1;
        seg(ctx, w, [mid[0] + dir * 2.4, w[1]]);
        seg(ctx, [mid[0] + dir * 2.4, w[1]], [mid[0] + dir * 2.4, mid[1]]);
        ctx.beginPath();
        ctx.moveTo(mid[0] + dir * 1.7, mid[1]);
        ctx.lineTo(mid[0] + dir * 3.2, mid[1] - 0.8);
        ctx.lineTo(mid[0] + dir * 3.2, mid[1] + 0.8);
        ctx.closePath();
        ctx.fill();
      }
      labelAt = [mid[0] - 7, mid[1]];
      break;
    }
    case "NPN":
    case "PNP": {
      const at = p.at ?? [0, 0];
      const [x, y] = at;
      ctx.beginPath();
      ctx.arc(x, y, 6.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 0.6 * LW;
      seg(ctx, [x - 2.2, y - 3.4], [x - 2.2, y + 3.4]);
      ctx.lineWidth = 0.5 * LW;
      seg(ctx, [x - 2.2, y - 1.2], [x + 2.6, y - 4.4]); // collector
      seg(ctx, [x - 2.2, y + 1.2], [x + 2.6, y + 4.4]); // emitter
      // emitter arrow
      const npn = p.kind === "NPN";
      const tip: P = npn ? [x + 2.6, y + 4.4] : [x - 2.0, y + 1.3];
      const back: P = npn ? [x + 0.9, y + 3.3] : [x - 0.3, y + 2.4];
      const ang = Math.atan2(tip[1] - back[1], tip[0] - back[0]);
      ctx.beginPath();
      ctx.moveTo(tip[0], tip[1]);
      ctx.lineTo(tip[0] - 1.6 * Math.cos(ang - 0.45), tip[1] - 1.6 * Math.sin(ang - 0.45));
      ctx.lineTo(tip[0] - 1.6 * Math.cos(ang + 0.45), tip[1] - 1.6 * Math.sin(ang + 0.45));
      ctx.closePath();
      ctx.fill();
      // leads to jacks
      const [cj, bj, ej] = pins;
      if (cj) {
        seg(ctx, [x + 2.6, y - 4.4], [cj[0], y - 4.4]);
        seg(ctx, [cj[0], y - 4.4], cj);
      }
      if (bj) {
        seg(ctx, [x - 2.2, y], [bj[0], y]);
        if (Math.abs(bj[1] - y) > 0.1) seg(ctx, [bj[0], y], bj);
      }
      if (ej) {
        seg(ctx, [x + 2.6, y + 4.4], [ej[0], y + 4.4]);
        seg(ctx, [ej[0], y + 4.4], ej);
      }
      labelAt = [x - 6, y - 8.5];
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
      ctx.font = "3px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("−", x - 5, y - 4);
      ctx.fillText("+", x - 5, y + 4);
      const [inn, inp, out] = pins;
      if (inn) {
        seg(ctx, [x - 7, y - 4], [inn[0], y - 4]);
        seg(ctx, [inn[0], y - 4], inn);
      }
      if (inp) {
        seg(ctx, [x - 7, y + 4], [inp[0], y + 4]);
        seg(ctx, [inp[0], y + 4], inp);
      }
      if (out) {
        seg(ctx, [x + 8, y], [out[0], y]);
        seg(ctx, [out[0], y], out);
      }
      labelAt = [x + 2, y + 11];
      break;
    }
  }
  if (labelAt && (p.label || p.text)) {
    const [lx, ly] = labelAt as P;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(labelRot);
    ctx.fillStyle = INK;
    ctx.font = "bold 3.5px Arial";
    ctx.textAlign = p.kind === "NPN" || p.kind === "PNP" || p.kind === "OA" ? "left" : "left";
    ctx.textBaseline = "middle";
    const vertical = (() => {
      const a = pins[0],
        b = pins[1];
      return a && b ? Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]) : false;
    })();
    if (vertical || p.kind === "POT") {
      if (p.label) ctx.fillText(p.label, 0, -1.6);
      ctx.font = "bold 3.1px Arial";
      if (p.text) ctx.fillText(p.text, 0, 1.6);
    } else {
      ctx.textAlign = "center";
      const t = [p.label, p.text].filter(Boolean).join("  ");
      ctx.fillText(t, 0, 0);
    }
    ctx.restore();
  }
}

/** draw the whole printed face of a module board */
export function drawModuleFace(ctx: CanvasRenderingContext2D, m: ModuleDef) {
  const [W, H] = m.size;
  ctx.fillStyle = "#f4f4ef";
  ctx.fillRect(0, 0, W, H);
  // subtle paper / plastic grain
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.018})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 0.4, 0.4);
  }
  // title bar
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.35 * LW;
  ctx.strokeRect(6, 5, 16, 9);
  ctx.font = "bold 5px Arial";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText("KL", 14, 9.8);
  ctx.textAlign = "left";
  ctx.font = "bold 5.8px Arial";
  ctx.fillText(`${m.code}  ${m.title}`, 26, 10);

  const jmap = new Map(m.jacks.map((j) => [j.id, j]));
  const jp = (id: string): P | null => {
    const j = jmap.get(id);
    return j ? [j.x, j.y] : null;
  };

  // blocks (dashed frames)
  ctx.setLineDash([2.2, 1.4]);
  ctx.lineWidth = 0.45 * LW;
  for (const b of m.blocks) {
    if (m.breadboard) continue;
    const [x, y, w, h] = b.rect;
    ctx.strokeRect(x, y, w, h);
    ctx.font = "italic bold 4.6px Arial";
    ctx.textAlign = "right";
    ctx.fillText(b.label, x + w - 2, y + h - 2.6);
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
  for (const tr of m.traces) {
    if (m.breadboard) break;
    const pts = tr.map((p) => (typeof p === "string" ? jp(p) : p)).filter(Boolean) as P[];
    if (pts.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const [px, py] = pts[i - 1];
      const [x, y] = pts[i];
      if (px !== x && py !== y && typeof tr[i] === "string" && typeof tr[i - 1] === "string") {
        // route orthogonally (horizontal first)
        ctx.lineTo(x, py);
      }
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // parts
  for (const p of m.parts) drawPart(ctx, p, jp);

  // jack holes printed ring + labels
  for (const j of m.jacks) {
    if (j.hidden) continue;
    ctx.fillStyle = "#1b1b1b";
    ctx.beginPath();
    ctx.arc(j.x, j.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
    if (j.label) {
      ctx.fillStyle = INK;
      ctx.font = "bold 3.7px Arial";
      ctx.textBaseline = "middle";
      const off = 5.2;
      const lp = j.lp ?? "n";
      ctx.textAlign = lp === "e" ? "left" : lp === "w" ? "right" : "center";
      const dx = lp === "e" ? off - 1.5 : lp === "w" ? -off + 1.5 : 0;
      const dy = lp === "n" ? -off : lp === "s" ? off : 0;
      ctx.fillText(j.label, j.x + dx, j.y + dy);
    }
  }
  for (const t of m.texts ?? []) {
    ctx.fillStyle = t.color ?? INK;
    ctx.font = `${t.bold ? "bold " : ""}${t.size ?? 3}px Arial`;
    ctx.textAlign = t.align ?? "center";
    ctx.fillText(t.text, t.x, t.y);
  }
}
