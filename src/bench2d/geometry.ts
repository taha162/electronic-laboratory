/**
 * Where everything sits on the 2D bench. World units are millimetres, seen from the
 * front: the KL-21001 (panel + its beige case) with the experiment board in its slot,
 * the FNIRSI-1013D oscilloscope and the two Pro'sKit MT-1232 multimeters.
 */
import { MODULE_SLOT, TRAINER_H, TRAINER_JACKS, TRAINER_W } from "@/lab/trainer";
import type { DmmId, LeadId, ModuleDef } from "@/lab/types";
import { DMM_FACE, JACK_U, JACK_V, SCOPE_DEV } from "@/draw/instruments";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type P = [number, number];

/** beige case margin around the printed panel */
export const CASE = 10;
/** the instruments are drawn a little larger than life so their displays read at a glance */
export const SCOPE_K = 1.3;
export const DMM_K = 1.45;
/** MT-1232 in its holster: 74 x 145 mm, the face plate inset */
export const DMM_BODY = { w: 74, h: 145 };
export const DMM_FACE_AT: P = [(DMM_BODY.w - DMM_FACE.w) / 2, 5.5];

export interface Layout {
  W: number;
  H: number;
  portrait: boolean;
  trainer: Rect;
  /** the panel's (0,0) in the world */
  panel: P;
  scope: Rect;
  dmm: Record<DmmId, Rect>;
  /** where unplugged leads rest */
  park: Record<LeadId, P>;
}

export function makeLayout(portrait: boolean): Layout {
  const trainer: Rect = { x: 0, y: 0, w: TRAINER_W + CASE * 2, h: TRAINER_H + CASE * 2 };
  const sw = SCOPE_DEV.w * SCOPE_K,
    sh = SCOPE_DEV.h * SCOPE_K;
  const dw = DMM_BODY.w * DMM_K,
    dh = DMM_BODY.h * DMM_K;
  let scope: Rect, d1: Rect, d2: Rect;
  if (!portrait) {
    const x0 = trainer.w + 26;
    scope = { x: x0, y: 64, w: sw, h: sh };
    const yd = scope.y + sh + 44;
    d1 = { x: x0, y: yd, w: dw, h: dh };
    d2 = { x: x0 + dw + 16, y: yd, w: dw, h: dh };
  } else {
    const y0 = trainer.h + 70;
    scope = { x: 4, y: y0, w: sw, h: sh };
    const xd = scope.x + sw + 22;
    d1 = { x: xd, y: y0, w: dw, h: dh };
    d2 = { x: xd + dw + 16, y: y0, w: dw, h: dh };
  }
  // probes hang by their BNCs (ground clips next to them), the pens below each meter
  const bx = (dx: number) => scope.x + (SCOPE_DEV.w / 2 + dx) * SCOPE_K;
  const pen = (d: Rect, k: number): P => [d.x + d.w * (k ? 0.68 : 0.32), d.y + d.h + 26];
  const park: Record<LeadId, P> = {
    "osc.ch1": [bx(-46) - 7, scope.y - 54],
    "osc.ch1g": [bx(-46) + 9, scope.y - 46],
    "osc.ch2": [bx(-19) - 7, scope.y - 54],
    "osc.ch2g": [bx(-19) + 9, scope.y - 46],
    "dmm.com": pen(d1, 0),
    "dmm.v": pen(d1, 1),
    "dmm2.com": pen(d2, 0),
    "dmm2.v": pen(d2, 1),
  };
  const py = 0;
  const W = Math.max(trainer.w, scope.x + sw, d2.x + dw) + 6;
  const H = Math.max(trainer.h, d2.y + dh + 44, py) + 4;
  return { W, H, portrait, trainer, panel: [CASE, CASE], scope, dmm: { dmm: d1, dmm2: d2 }, park };
}

/** the experiment board sits in the slot, scaled as on the real unit */
export function moduleFrame(m: ModuleDef, L: Layout) {
  const k = Math.min(MODULE_SLOT.w / 368, MODULE_SLOT.h / 252);
  const cx = L.panel[0] + MODULE_SLOT.x + MODULE_SLOT.w / 2,
    cy = L.panel[1] + MODULE_SLOT.y + MODULE_SLOT.h / 2;
  const [W, H] = m.size;
  return { k, x: cx - (W * k) / 2, y: cy - (H * k) / 2, w: W * k, h: H * k };
}

/** world position of a socket ("tr:…" / "m:…") */
export function jackWorld(id: string, m: ModuleDef, L: Layout): P | null {
  if (id.startsWith("tr:")) {
    const j = TRAINER_JACKS.find((x) => x.id === id.slice(3));
    return j ? [L.panel[0] + j.x, L.panel[1] + j.y] : null;
  }
  if (id.startsWith("m:")) {
    const j = m.jacks.find((x) => x.id === id.slice(2));
    if (!j) return null;
    const f = moduleFrame(m, L);
    return [f.x + j.x * f.k, f.y + j.y * f.k];
  }
  return null;
}

/** where an instrument lead leaves its instrument (BNC on the scope's top edge, DMM input jacks) */
export function leadOrigin(l: LeadId, L: Layout): P {
  if (l.startsWith("osc")) {
    const s = L.scope;
    // BNCs 46 / 19 mm left of centre on the top edge; the probe boots stand above them
    const x = s.x + (SCOPE_DEV.w / 2 + (l.startsWith("osc.ch1") ? -46 : -19)) * SCOPE_K;
    return [x, s.y - 30];
  }
  const d = L.dmm[l.startsWith("dmm2") ? "dmm2" : "dmm"];
  const u = l.endsWith(".com") ? JACK_U[1] : JACK_U[2];
  return [d.x + (DMM_FACE_AT[0] + u) * DMM_K, d.y + (DMM_FACE_AT[1] + JACK_V) * DMM_K];
}

/** named views for the Dock chips (world rects to frame) */
export function viewRect(name: string, m: ModuleDef, L: Layout): Rect {
  const p = L.panel;
  const tr = (x: number, y: number, w: number, h: number): Rect => ({ x: p[0] + x, y: p[1] + y, w, h });
  switch (name) {
    case "meters":
      return tr(6, 8, 564, 116);
    case "module": {
      const f = moduleFrame(m, L);
      return { x: f.x - 4, y: f.y - 4, w: f.w + 8, h: f.h + 8 };
    }
    case "generator":
      return tr(8, 120, 104, 318);
    case "power":
      return tr(468, 120, 100, 318);
    case "pots":
      return tr(104, 372, 372, 66);
    case "scope":
      return { x: L.scope.x - 8, y: L.scope.y - 40, w: L.scope.w + 16, h: L.scope.h + 80 };
    case "dmm": {
      const a = L.dmm.dmm,
        b = L.dmm.dmm2;
      return { x: a.x - 6, y: a.y - 6, w: b.x + b.w - a.x + 12, h: a.h + 48 };
    }
    default:
      return { x: 0, y: 0, w: L.W, h: L.H };
  }
}
