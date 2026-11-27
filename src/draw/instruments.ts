/**
 * Fronts of the instruments on the bench: the Pro'sKit MT-1232 multimeter face and its
 * LCD, and the FNIRSI-1013D front glass. Canvas-API drawings, replayed into SVG.
 */
import type { DmmMode } from "@/store/bench";
import { draw7seg } from "./panel";

/* ---------------------------------------------------------------- */
/* Pro'sKit MT-1232 (face plate 63.5 x 134 mm)                        */
/* ---------------------------------------------------------------- */
export const DMM_MODES: DmmMode[] = ["off", "dcv", "acv", "ohm", "diode", "dca", "aca"];
export const DIAL_ANG = (i: number) => -2.4 + i * 0.8; // radians, 0 = toward the display
/** SELECT toggles the second function printed on a dial position */
export const SELECT_PAIR: Partial<Record<DmmMode, DmmMode>> = { dcv: "acv", acv: "dcv", dca: "aca", aca: "dca", ohm: "diode", diode: "ohm" };
export const DMM_FACE = { w: 63.5, h: 134 };
export const LCD_WIN = { u: 4, v: 10.6, w: 55.5, h: 35 };
export const DIAL = { u: 31.75, v: 89, r: 16.5 };
export const JACK_V = 123;
export const JACK_U = [10.75, 31.75, 52.75];
export const KEY_V = 51.6;
export const KEY_U = [12.5, 31.75, 51];
/** LCD drawing box (drawLcd units) */
export const LCD_PX: [number, number] = [520, 320];

/** the black face plate of the MT-1232 (63.5 x 134 mm) */
export function drawDmmFace(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#151619";
  ctx.fillRect(0, 0, 63.5, 134);
  ctx.textBaseline = "middle";
  // logo + model
  ctx.save();
  ctx.translate(4.6, 6.4);
  ctx.transform(1, 0, -0.18, 1, 0, 0);
  ctx.fillStyle = "#f3f3f3";
  ctx.font = "bold 5.6px Arial, Helvetica, sans-serif";
  ctx.fillText("Pro'sKit", 0, 0);
  ctx.restore();
  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 0.28;
  ctx.beginPath();
  ctx.roundRect(42.4, 3.9, 17.2, 5.2, 0.8);
  ctx.stroke();
  ctx.fillStyle = "#f3f3f3";
  ctx.font = "bold 3.5px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("MT-1232", 51, 6.6);
  // LCD window surround
  ctx.fillStyle = "#2b2d32";
  ctx.beginPath();
  ctx.roundRect(LCD_WIN.u - 0.9, LCD_WIN.v - 0.9, LCD_WIN.w + 1.8, LCD_WIN.h + 1.8, 2.4);
  ctx.fill();
  // key legends
  ctx.fillStyle = "#e9e9e9";
  ctx.font = "bold 2.6px Arial, sans-serif";
  ctx.fillText("SELECT", KEY_U[0], KEY_V + 6.3);
  ctx.fillText("HOLD", KEY_U[1], KEY_V + 6.3);
  ctx.fillText("☀", KEY_U[2], KEY_V + 6.4);
  // selector ring and legends
  ctx.strokeStyle = "#5d6068";
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.arc(DIAL.u, DIAL.v, DIAL.r + 1.6, 0, Math.PI * 2);
  ctx.stroke();
  const legend: Record<DmmMode, [string, string?]> = {
    off: ["OFF"],
    dcv: ["V", "⎓"],
    acv: ["V", "~"],
    ohm: ["Ω", "•))"],
    diode: ["▶|", "•))"],
    dca: ["mA", "⎓"],
    aca: ["mA", "~"],
  };
  DMM_MODES.forEach((m, i) => {
    const a = DIAL_ANG(i) - Math.PI / 2;
    const r1 = DIAL.r + 2.4,
      r2 = DIAL.r + 3.8;
    ctx.strokeStyle = "#e6e6e6";
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(DIAL.u + Math.cos(a) * r1, DIAL.v + Math.sin(a) * r1);
    ctx.lineTo(DIAL.u + Math.cos(a) * r2, DIAL.v + Math.sin(a) * r2);
    ctx.stroke();
    const [main, sub] = legend[m];
    const R = DIAL.r + 7.5;
    const x = DIAL.u + Math.cos(a) * R,
      y = DIAL.v + Math.sin(a) * R;
    ctx.fillStyle = "#f3f3f3";
    ctx.font = `bold ${m === "off" ? 2.9 : 3.6}px Arial, sans-serif`;
    ctx.fillText(main, x, sub ? y - 1.2 : y);
    if (sub) {
      ctx.fillStyle = m === "dcv" || m === "dca" ? "#f3f3f3" : "#f2c230";
      ctx.font = "bold 2.6px Arial, sans-serif";
      ctx.fillText(sub, x, y + 2.1);
    }
  });
  // input jacks: printed rings and legends
  const jl: [string, string][] = [
    ["10A", "#f3f3f3"],
    ["COM", "#f3f3f3"],
    ["VΩmA", "#f3f3f3"],
  ];
  JACK_U.forEach((u, i) => {
    ctx.fillStyle = jl[i][1];
    ctx.font = "bold 2.9px Arial, sans-serif";
    ctx.fillText(jl[i][0], u, JACK_V - 7.4);
    ctx.strokeStyle = i === 1 ? "#9a9da3" : "#d23a2c";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(u, JACK_V, 5.6, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.font = "1.9px Arial, sans-serif";
  ctx.fillStyle = "#c8c8c8";
  ctx.fillText("10A MAX", JACK_U[0], JACK_V + 7.6);
  ctx.fillText("FUSED", JACK_U[0], JACK_V + 9.8);
  ctx.fillText("600V MAX", JACK_U[2], JACK_V + 7.6);
  ctx.fillText("CAT III 600V", JACK_U[1], JACK_V + 8.7);
  ctx.fillStyle = "#f2c230";
  ctx.beginPath();
  const tx = JACK_U[1] - 10.4,
    ty = JACK_V + 8.6;
  ctx.moveTo(tx, ty - 1.4);
  ctx.lineTo(tx + 1.5, ty + 1.2);
  ctx.lineTo(tx - 1.5, ty + 1.2);
  ctx.closePath();
  ctx.fill();
}


/** big-digit LCD: annunciator row, four tall narrow digits, unit at the bottom right */
export function drawLcd(ctx: CanvasRenderingContext2D, W: number, H: number, m: DmmMode, text: string, unit: string, hold: boolean, light: boolean) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  if (light) {
    bg.addColorStop(0, "#d4eef3");
    bg.addColorStop(1, "#b5dde6");
  } else {
    bg.addColorStop(0, "#a9ae9f");
    bg.addColorStop(1, "#979c8e");
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  if (m === "off") return;
  const ink = "#0b0c07";
  const ghost = "rgba(0,0,0,0.03)";
  ctx.fillStyle = ink;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = "bold 22px Arial, sans-serif";
  ctx.fillText("AUTO", 14, 22);
  const kind = m === "acv" || m === "aca" ? "AC" : m === "dcv" || m === "dca" ? "DC" : "";
  if (kind) ctx.fillText(kind, 92, 22);
  if (m === "diode") ctx.fillText("▶|", 140, 22);
  if (m === "diode" || m === "ohm") ctx.fillText("•))", m === "diode" ? 186 : 140, 22);
  if (hold) {
    ctx.fillRect(330, 10, 30, 25);
    ctx.fillStyle = light ? "#d4eef3" : "#a3a899";
    ctx.fillText("H", 337, 23);
    ctx.fillStyle = ink;
  }
  // battery
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(460, 12, 40, 19);
  ctx.fillRect(500, 17, 5, 9);
  ctx.fillRect(464, 16, 26, 11);
  const disp = text === "OL" ? " OL" : text;
  draw7seg(ctx, disp, 40, 44, 214, ink, ghost, 4, { w: 0.43, t: 0.088, gap: 0.135, skew: 0.06 });
  ctx.fillStyle = ink;
  ctx.textAlign = "right";
  ctx.font = "bold 46px Arial, sans-serif";
  ctx.fillText(unit, W - 14, H - 32);
}


/* ---------------------------------------------------------------- */
/* FNIRSI-1013D (front glass 179.2 x 119.2 mm, LCD 154.2 x 92.6 mm)   */
/* ---------------------------------------------------------------- */
export const SCOPE_DEV = { w: 184, h: 124, r: 12.5 };
export const SCOPE_GLASS = { w: 179.2, h: 119.2 };
/** active LCD area inside the glass */
export const SCOPE_LCD = { x: 12.5, y: 9, w: 154.2, h: 92.6 };

/** the FNIRSI-1013D black front glass with its printed logo (179.2 x 119.2 mm) */
export function drawScopeGlass(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#060709";
  ctx.fillRect(0, 0, 179.2, 119.2);
  // inactive LCD border: a hair lighter than the printed black
  ctx.fillStyle = "#0b0c0f";
  ctx.fillRect(11.6, 8.2, 155.8, 94.2);
  ctx.textBaseline = "middle";
  // FNIRSI logo (wide, bold) + "oscilloscope"
  ctx.save();
  ctx.translate(13.2, 110.6);
  ctx.scale(1.18, 1);
  ctx.fillStyle = "#f4f4f4";
  ctx.font = "bold 7.4px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("FNIRSI", 0, 0);
  ctx.restore();
  ctx.fillStyle = "#d9d9d9";
  ctx.font = "4.3px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("oscilloscope", 47.6, 111.2);
  // performance badge (bottom right)
  ctx.textAlign = "right";
  ctx.fillStyle = "#a9abb0";
  ctx.font = "2.5px Arial, sans-serif";
  ctx.fillText("100MHz", 172, 107.4);
  ctx.fillText("1 GSa/s", 172, 111.2);
}

