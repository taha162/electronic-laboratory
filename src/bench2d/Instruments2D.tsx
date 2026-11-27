"use client";
import { useEffect, useRef, useState } from "react";
import { useBench, type DmmMode } from "@/store/bench";
import { useSim, formatDmm } from "@/lab/simController";
import type { DmmId } from "@/lab/types";
import { drawToSvg } from "@/draw/svgctx";
import { DIAL, DIAL_ANG, DMM_FACE, DMM_MODES, drawLcd, JACK_U, JACK_V, KEY_U, KEY_V, LCD_PX, LCD_WIN, SCOPE_DEV, SCOPE_GLASS, SCOPE_LCD, SELECT_PAIR } from "@/draw/instruments";
import { SCREEN_H, SCREEN_W } from "@/scope/renderScope";
import { drawScopeTo, screenTouch } from "@/scope/scopeState";
import { useUi } from "@/ui/uiState";
import { sfx } from "@/audio/audio";
import { dmmFaceUrl, scopeGlassUrl } from "./prints";
import { DMM_BODY, DMM_FACE_AT, DMM_K, SCOPE_K, type Layout } from "./geometry";
import { hoverProps } from "./Trainer2D";

const deg = (r: number) => (r * 180) / Math.PI;

/* ---------------------------------------------------------------- */
/* FNIRSI-1013D                                                       */
/* ---------------------------------------------------------------- */
/** the tablet scope: white frame, black glass, BNC inputs on the top edge with the probes plugged in */
export function Scope2D({ L }: { L: Layout }) {
  const s = L.scope;
  const k = SCOPE_K;
  const gx = s.x + ((SCOPE_DEV.w - SCOPE_GLASS.w) / 2) * k,
    gy = s.y + ((SCOPE_DEV.h - SCOPE_GLASS.h) / 2) * k;
  const bnc = (dx: number, label: string) => {
    const x = s.x + (SCOPE_DEV.w / 2 + dx) * k;
    const y = s.y;
    return (
      <g key={label}>
        {/* panel nut + barrel + bayonet sleeve */}
        <rect x={x - 6.5} y={y - 3} width={13} height={4} rx={1} fill="url(#nickel)" />
        <rect x={x - 5.6} y={y - 9} width={11.2} height={6.5} rx={1} fill="url(#nickel)" />
        {/* grey strain-relief boot with grip rings */}
        <path d={`M${x - 6.4} ${y - 9}L${x - 5.8} ${y - 24}Q${x - 4.2} ${y - 30} ${x - 2.6} ${y - 30}H${x + 2.6}Q${x + 4.2} ${y - 30} ${x + 5.8} ${y - 24}L${x + 6.4} ${y - 9}Z`} fill="#8c9196" stroke="#5d6166" strokeWidth={0.4} />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={x - 6} x2={x + 6} y1={y - 11 - i * 3} y2={y - 11 - i * 3} stroke="#73787d" strokeWidth={0.7} />
        ))}
        <rect x={x - 4.4} y={y - 27} width={8.8} height={6} rx={0.6} fill="#e9efe6" />
        <rect x={x - 4.4} y={y - 27} width={8.8} height={1.8} fill="#1f7a46" />
        <text x={x} y={y - 22.2} fontSize={2.6} fontWeight="bold" fontFamily="Arial" textAnchor="middle" fill="#222">
          {label}
        </text>
      </g>
    );
  };
  return (
    <g>
      <rect x={s.x + 2} y={s.y + 4} width={s.w} height={s.h} rx={SCOPE_DEV.r * k} fill="rgba(0,0,0,0.28)" />
      <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={SCOPE_DEV.r * k} fill="#f2f2ef" stroke="#c9c9c4" strokeWidth={0.8} />
      <image href={scopeGlassUrl()} x={gx} y={gy} width={SCOPE_GLASS.w * k} height={SCOPE_GLASS.h * k} />
      {/* CH1 / CH2 legends on the top edge */}
      <g fontFamily="Arial" fontWeight="bold" fontSize={3.4} fill="#4d4f55" textAnchor="middle">
        <text x={s.x + (SCOPE_DEV.w / 2 - 46 + 9) * k} y={s.y + 3.6}>
          CH1
        </text>
        <text x={s.x + (SCOPE_DEV.w / 2 - 19 + 9) * k} y={s.y + 3.6}>
          CH2
        </text>
        <text x={s.x + (SCOPE_DEV.w / 2 + 34) * k} y={s.y + 3.6}>
          5V ⎓ 2A
        </text>
      </g>
      {bnc(-46, "CH1")}
      {bnc(-19, "CH2")}
      {/* USB-C charging lead and the power key */}
      <rect x={s.x + (SCOPE_DEV.w / 2 + 46) * k - 6} y={s.y - 14} width={12} height={14} rx={1.5} fill="#f2f2ef" stroke="#c4c4bf" strokeWidth={0.4} />
      <path d={`M${s.x + (SCOPE_DEV.w / 2 + 46) * k} ${s.y - 14}C${s.x + (SCOPE_DEV.w / 2 + 46) * k} ${s.y - 30} ${s.x + s.w + 10} ${s.y - 28} ${s.x + s.w + 6} ${s.y + 10}`} stroke="#f0f0ec" strokeWidth={3} fill="none" />
      <rect x={s.x + (SCOPE_DEV.w / 2 + 70) * k - 7} y={s.y - 2.4} width={14} height={2.6} rx={0.8} fill="#4a4c50" />
    </g>
  );
}

/** the scope's LCD: a canvas laid over the drawing, refreshed ~24 times a second */
export function ScopeScreen({ L }: { L: Layout }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const k = SCOPE_K;
  const gx = L.scope.x + ((SCOPE_DEV.w - SCOPE_GLASS.w) / 2) * k,
    gy = L.scope.y + ((SCOPE_DEV.h - SCOPE_GLASS.h) / 2) * k;
  const rect = { x: gx + SCOPE_LCD.x * k, y: gy + SCOPE_LCD.y * k, w: SCOPE_LCD.w * k, h: SCOPE_LCD.h * k };
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0,
      last = 0,
      lastVer = -1;
    const t0 = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const ver = useSim.getState().version;
      if (now - last < 1000 / 24 && ver === lastVer) return;
      last = now;
      lastVer = ver;
      drawScopeTo(ctx, (now - t0) / 1000);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const q = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches ? 1.25 : 2;
  return (
    <canvas
      ref={ref}
      data-hit
      width={SCREEN_W * q}
      height={SCREEN_H * q}
      className="absolute cursor-pointer"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: 1 }}
      onClick={(e) => {
        e.stopPropagation();
        const b = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
        const px = ((e.clientX - b.left) / b.width) * SCREEN_W,
          py = ((e.clientY - b.top) / b.height) * SCREEN_H;
        if (!screenTouch(px, py)) useBench.getState().setPanel("scope");
        sfx("button");
      }}
      {...hoverProps("osc.screen", "FNIRSI-1013D")}
    />
  );
}

/* ---------------------------------------------------------------- */
/* Pro'sKit MT-1232                                                   */
/* ---------------------------------------------------------------- */
const modeKey = (w: DmmId) => (w === "dmm2" ? "dmm2Mode" : "dmmMode") as "dmmMode" | "dmm2Mode";

/** the multimeter in its teal holster: LCD, SELECT / HOLD / light keys, rotary selector, inputs */
export function Dmm2D({ L, which, label }: { L: Layout; which: DmmId; label: string }) {
  const d = L.dmm[which];
  const k = DMM_K;
  const mode = useBench((s) => (s[modeKey(which)] ?? "dca") as DmmMode);
  const [hold, setHold] = useState(false);
  const [light, setLight] = useState(false);
  const lcd = useRef<SVGGElement>(null);
  const fx = d.x + DMM_FACE_AT[0] * k,
    fy = d.y + DMM_FACE_AT[1] * k;
  const F = (u: number, v: number): [number, number] => [fx + u * k, fy + v * k];
  // a real DMM samples ~3 times per second and the last digit flickers
  useEffect(() => {
    let lastKey = "";
    const draw = () => {
      const m = (useBench.getState()[modeKey(which)] ?? "dca") as DmmMode;
      const r = useSim.getState().readings[which];
      let v = r.value;
      if (v !== null && m !== "off") {
        const f0 = formatDmm(m, v);
        const dec = (f0.text.split(".")[1] ?? "").length;
        const lsd = Math.pow(10, -dec) * (f0.unit === "mV" ? 1e-3 : f0.unit === "kΩ" ? 1e3 : f0.unit === "MΩ" ? 1e6 : 1);
        v = v + (Math.random() - 0.5) * 1.6 * lsd;
      }
      const f = formatDmm(m, v);
      const key = `${m}|${f.text}|${f.unit}|${hold}|${light}`;
      if (key === lastKey || !lcd.current) return;
      lastKey = key;
      const svg = drawToSvg(LCD_PX[0], LCD_PX[1], (ctx) => drawLcd(ctx, LCD_PX[0], LCD_PX[1], m, f.text, f.unit, hold, light && m !== "off"));
      lcd.current.innerHTML = svg.replace(/^<svg[^>]*>|<\/svg>$/g, "");
    };
    draw();
    if (hold) return;
    const id = setInterval(draw, 330);
    const un = useBench.subscribe((s, p) => {
      if (s[modeKey(which)] !== p[modeKey(which)]) draw();
    });
    return () => {
      clearInterval(id);
      un();
    };
  }, [which, hold, light]);
  const setMode = (m: DmmMode) => {
    useBench.getState().setDmmMode(m, which);
    sfx("dial");
  };
  const idx = DMM_MODES.indexOf(mode);
  const [dcx, dcy] = F(DIAL.u, DIAL.v);
  const keys = [
    {
      label: "SELECT",
      on: false,
      col: "#e8b81a",
      act: () => {
        const n = SELECT_PAIR[(useBench.getState()[modeKey(which)] ?? "dca") as DmmMode];
        if (n) setMode(n);
      },
    },
    { label: "HOLD", on: hold, col: "#3a3c40", act: () => setHold((h) => !h) },
    { label: "LIGHT", on: light, col: "#3a3c40", act: () => setLight((l) => !l) },
  ];
  return (
    <g>
      {/* holster */}
      <rect x={d.x + 2} y={d.y + 4} width={d.w} height={d.h} rx={12 * k} fill="rgba(0,0,0,0.28)" />
      <rect x={d.x} y={d.y} width={d.w} height={d.h} rx={12 * k} fill="#0f9c8d" stroke="#0a6f64" strokeWidth={0.8} />
      <rect x={d.x + 3 * k} y={d.y + 3 * k} width={d.w - 6 * k} height={d.h - 6 * k} rx={9 * k} fill="none" stroke="#5fd0c2" strokeOpacity={0.35} strokeWidth={1.2} />
      <image href={dmmFaceUrl()} x={fx} y={fy} width={DMM_FACE.w * k} height={DMM_FACE.h * k} />
      {/* number badge so the steps can say "multimeter 1 / 2" */}
      <g>
        <circle cx={d.x + d.w - 7} cy={d.y + 7} r={6} fill="#f2b33d" stroke="#5a4210" strokeWidth={0.6} />
        <text x={d.x + d.w - 7} y={d.y + 7} dominantBaseline="central" textAnchor="middle" fontFamily="Arial" fontWeight="bold" fontSize={7.5} fill="#1a1a1a">
          {label}
        </text>
      </g>
      {/* LCD */}
      <svg x={F(LCD_WIN.u, 0)[0] + 0.6} y={F(0, LCD_WIN.v)[1] + 0.6} width={LCD_WIN.w * k - 1.2} height={LCD_WIN.h * k - 1.2} viewBox={`0 0 ${LCD_PX[0]} ${LCD_PX[1]}`} preserveAspectRatio="none">
        <g ref={lcd} />
      </svg>
      {/* function keys */}
      {keys.map((b, i) => {
        const [x, y] = F(KEY_U[i], KEY_V);
        return (
          <g
            key={b.label}
            data-hit
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              b.act();
              sfx("button");
            }}
            {...hoverProps(`${which}.btn`, b.label)}
          >
            <rect x={x - 7.4 * k} y={y - 3.6 * k} width={14.8 * k} height={7.2 * k} rx={1.4 * k} fill={b.col} stroke="rgba(0,0,0,0.5)" strokeWidth={0.4} opacity={b.on ? 0.75 : 1} />
            {b.label === "LIGHT" && <text x={x} y={y + 1.2} textAnchor="middle" fontSize={4} fill="#f3f3f3">☀</text>}
          </g>
        );
      })}
      {/* rotary selector: tap a function's legend, or the knob to step */}
      <g
        data-hit
        data-wheel
        data-dial={which}
        className="cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          const svg = (e.currentTarget as SVGGElement).ownerSVGElement!;
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
          const dx = p.x - dcx,
            dy = p.y - dcy;
          if (Math.hypot(dx, dy) < DIAL.r * k * 0.55) return setMode(DMM_MODES[(idx + 1) % DMM_MODES.length]);
          // angle from "toward the display" (up), clockwise
          const a = Math.atan2(dx, -dy);
          let best = 0;
          DMM_MODES.forEach((_, i) => {
            if (Math.abs(DIAL_ANG(i) - a) < Math.abs(DIAL_ANG(best) - a)) best = i;
          });
          setMode(DMM_MODES[best]);
        }}
        onWheel={(e) => {
          e.stopPropagation();
          setMode(DMM_MODES[(idx + (e.deltaY > 0 ? 1 : -1) + DMM_MODES.length) % DMM_MODES.length]);
        }}
        {...hoverProps(`${which}.dial`, "MT-1232")}
      >
        <circle cx={dcx} cy={dcy} r={(DIAL.r + 9) * k} fill="transparent" />
        <circle cx={dcx + 0.8} cy={dcy + 1.4} r={DIAL.r * k} fill="rgba(0,0,0,0.45)" />
        <circle cx={dcx} cy={dcy} r={DIAL.r * k} fill="url(#knobTop)" stroke="#000" strokeWidth={0.5} />
        <g transform={`rotate(${deg(DIAL_ANG(idx))} ${dcx} ${dcy})`}>
          <rect x={dcx - 4.25 * k} y={dcy - 15.5 * k} width={8.5 * k} height={31 * k} rx={2 * k} fill="#1c1c1e" stroke="#000" strokeWidth={0.4} />
          <rect x={dcx - 0.8 * k} y={dcy - 14.5 * k} width={1.6 * k} height={6.8 * k} fill="#f4f4f4" />
        </g>
      </g>
      {/* input jacks: 10A, COM, VΩmA */}
      {JACK_U.map((u, i) => {
        const [x, y] = F(u, JACK_V);
        return (
          <g key={u} pointerEvents="none">
            <circle cx={x} cy={y} r={4.7 * k} fill={i === 1 ? "#161616" : "#c41f17"} />
            <circle cx={x} cy={y} r={2.1 * k} fill="#050505" />
          </g>
        );
      })}
    </g>
  );
}

/** open the big control sheet of a DMM function from the dock / readings (kept for parity with knobs) */
export function focusDmm() {
  useUi.getState().view("dmm");
}

export { DMM_BODY };
