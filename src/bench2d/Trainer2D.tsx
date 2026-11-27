"use client";
import { memo, useEffect, useRef } from "react";
import { useBench } from "@/store/bench";
import { useSim } from "@/lab/simController";
import { DVM_RECT, SCREWS, TRAINER_H, TRAINER_JACKS, TRAINER_KNOBS, TRAINER_METERS, TRAINER_W, type KnobDef } from "@/lab/trainer";
import type { JackDef } from "@/lab/types";
import { knobAngle, draw7seg } from "@/draw/panel";
import { drawToSvg } from "@/draw/svgctx";
import { PLASTIC_COLORS } from "@/draw/colors";
import { useUi } from "@/ui/uiState";
import { sfx } from "@/audio/audio";
import { meterUrl, panelUrl } from "./prints";
import { type Layout } from "./geometry";

const deg = (r: number) => (r * 180) / Math.PI;

/* ---------------------------------------------------------------- */
/* sockets                                                           */
/* ---------------------------------------------------------------- */
export function hoverProps(id: string, label: string) {
  return {
    onPointerEnter: () => useUi.getState().setHover({ id, label }),
    onPointerLeave: () => {
      if (useUi.getState().hover?.id === id) useUi.getState().setHover(null);
    },
  };
}

/** a 4 mm banana socket of the KL-21001 (coloured collar) or a small brass terminal */
export const BananaSocket = memo(function BananaSocket({ j, x, y }: { j: JackDef; x: number; y: number }) {
  const gid = `tr:${j.id}`;
  const pending = useBench((s) => s.pending === gid);
  const brass = j.style === "brass";
  const col = brass ? "#c9a24a" : PLASTIC_COLORS[j.style ?? "black"] ?? "#151515";
  const R = brass ? 3.6 : 5.2;
  return (
    <g
      data-hit
      data-jack={gid}
      className="cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        useBench.getState().clickJack(gid);
        sfx("plug");
      }}
      {...hoverProps(gid, j.label ?? j.id)}
    >
      <circle cx={x} cy={y} r={R + 2.2} fill="transparent" />
      {/* shadow, collar, metal ring, hole */}
      <circle cx={x + 0.5} cy={y + 0.8} r={R + 0.3} fill="rgba(0,0,0,0.28)" />
      <circle cx={x} cy={y} r={R} fill={brass ? "url(#brass)" : col} stroke="rgba(0,0,0,0.55)" strokeWidth={0.35} />
      {!brass && <circle cx={x - R * 0.25} cy={y - R * 0.3} r={R * 0.55} fill="rgba(255,255,255,0.16)" />}
      <circle cx={x} cy={y} r={brass ? 2 : 2.7} fill="url(#nickel)" />
      <circle cx={x} cy={y} r={brass ? 1.2 : 1.55} fill="#070707" />
      {pending && <circle cx={x} cy={y} r={R + 1.6} fill="none" stroke="#ffb000" strokeWidth={1} />}
    </g>
  );
});

/* ---------------------------------------------------------------- */
/* knobs                                                             */
/* ---------------------------------------------------------------- */
/** black skirted knob with a white pointer: drag to turn, tap for the big control */
export function Knob2D({ k, x, y, trimmer }: { k: Pick<KnobDef, "id" | "r" | "detents" | "bare">; x: number; y: number; trimmer?: boolean }) {
  const v = useBench((s) => s.knobs[k.id] ?? 0);
  const drag = useRef<{ y0: number; v0: number; moved: boolean; id: number } | null>(null);
  const det = k.detents ?? 0;
  const a = deg(knobAngle(det, v));
  const set = (nv: number) => {
    const s = useBench.getState();
    const cur = s.knobs[k.id] ?? 0;
    const val = det ? Math.round(Math.min(det - 1, Math.max(0, nv))) : Math.min(1, Math.max(0, nv));
    if (val === cur) return;
    if (det) sfx("dial");
    s.setKnob(k.id, val);
  };
  const r = k.r;
  return (
    <g
      data-hit
      data-wheel
      data-knob={k.id}
      className="cursor-grab"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        drag.current = { y0: e.clientY, v0: useBench.getState().knobs[k.id] ?? 0, moved: false, id: e.pointerId };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        const dy = d.y0 - e.clientY;
        if (!d.moved && Math.abs(dy) < 5) return;
        d.moved = true;
        set(det ? d.v0 + dy / 34 : d.v0 + dy / 220);
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (d && !d.moved && d.id === e.pointerId) useUi.getState().setCtrl(k.id);
      }}
      onPointerCancel={() => (drag.current = null)}
      onWheel={(e) => {
        e.stopPropagation();
        const cur = useBench.getState().knobs[k.id] ?? 0;
        set(det ? cur + (e.deltaY < 0 ? 1 : -1) : cur + (e.deltaY < 0 ? 0.02 : -0.02));
      }}
      {...hoverProps(`knob:${k.id}`, k.id)}
    >
      <circle cx={x} cy={y} r={r * 1.25} fill="transparent" />
      {k.bare ? (
        // VR3 of this bench lost its cap: a knurled brass shaft with its flat
        <g>
          <circle cx={x + 0.6} cy={y + 1} r={r * 0.42} fill="rgba(0,0,0,0.3)" />
          <circle cx={x} cy={y} r={r * 0.4} fill="url(#brass)" stroke="#6d5a2a" strokeWidth={0.3} />
          <g transform={`rotate(${a} ${x} ${y})`}>
            <rect x={x - r * 0.4} y={y - r * 0.12} width={r * 0.8} height={r * 0.24} fill="#8a7232" opacity={0.7} />
          </g>
        </g>
      ) : trimmer ? (
        <g>
          <circle cx={x + 0.5} cy={y + 0.8} r={r} fill="rgba(0,0,0,0.25)" />
          <circle cx={x} cy={y} r={r} fill="#ecebe6" stroke="#a9a69c" strokeWidth={0.4} />
          <g transform={`rotate(${a} ${x} ${y})`}>
            <rect x={x - 0.6} y={y - r * 0.85} width={1.2} height={r * 1.7} fill="#3a3a3a" rx={0.3} />
          </g>
        </g>
      ) : (
        <g>
          <circle cx={x + 1} cy={y + 1.6} r={r * 1.17} fill="rgba(0,0,0,0.3)" />
          <circle cx={x} cy={y} r={r * 1.15} fill="#202022" stroke="#0a0a0a" strokeWidth={0.4} />
          <circle cx={x} cy={y} r={r * 0.92} fill="url(#knobTop)" />
          {/* grip ridges */}
          <circle cx={x} cy={y} r={r * 1.02} fill="none" stroke="#3b3b3e" strokeWidth={r * 0.2} strokeDasharray={`${(r * 0.12).toFixed(2)} ${(r * 0.12).toFixed(2)}`} />
          <g transform={`rotate(${a} ${x} ${y})`}>
            <rect x={x - 0.7} y={y - r * 1.05} width={1.4} height={r * 0.72} rx={0.4} fill="#f2f2f2" />
          </g>
        </g>
      )}
    </g>
  );
}

/* ---------------------------------------------------------------- */
/* meters                                                            */
/* ---------------------------------------------------------------- */
/** moving-coil panel meter: grey frame, white dial, damped needle */
function AnalogMeter2D({ m, x, y }: { m: (typeof TRAINER_METERS)[number]; x: number; y: number }) {
  const needle = useRef<SVGGElement>(null);
  const pivot = { x: x + m.w / 2, y: y + m.h + 8 };
  useEffect(() => {
    const S = { x: 0, v: 0 };
    let raf = 0,
      last = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const r = useSim.getState().readings.meters;
      const val = r[m.id as keyof typeof r] ?? 0;
      const target = Math.min(Math.max(val / m.full, -0.04), 1.08);
      const w0 = 2 * Math.PI * 1.6,
        zeta = 0.55;
      for (let i = 0; i < 4; i++) {
        const h = dt / 4;
        const acc = w0 * w0 * (target - S.x) - 2 * zeta * w0 * S.v;
        S.v += acc * h;
        S.x += S.v * h;
      }
      if (S.x < -0.05) (S.x = -0.05), (S.v = 0);
      if (S.x > 1.1) (S.x = 1.1), (S.v = 0);
      needle.current?.setAttribute("transform", `rotate(${deg(-0.72 + S.x * 1.44)} ${pivot.x - x} ${pivot.y - y})`);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [m.id, m.full, pivot.x, pivot.y, x, y]);
  const L = m.h + 8 - 6;
  return (
    <g>
      <rect x={x - 3.5} y={y - 3.5} width={m.w + 7} height={m.h + 7} rx={2} fill="#3a3c40" />
      <rect x={x - 1} y={y - 1} width={m.w + 2} height={m.h + 2} rx={1} fill="#1d1e21" />
      <svg x={x} y={y} width={m.w} height={m.h} viewBox="0 0 512 304" preserveAspectRatio="none">
        <image href={meterUrl(m.full, m.unit, m.kind.startsWith("ac"))} width={512} height={304} />
      </svg>
      <svg x={x} y={y} width={m.w} height={m.h} overflow="hidden">
        <g ref={needle} transform={`rotate(${deg(-0.72)} ${pivot.x - x} ${pivot.y - y})`}>
          <line x1={pivot.x - x} y1={pivot.y - y} x2={pivot.x - x} y2={pivot.y - y - L} stroke="#c01010" strokeWidth={0.55} />
        </g>
      </svg>
      {/* glass sheen */}
      <rect x={x} y={y} width={m.w} height={m.h * 0.42} fill="url(#glass)" />
    </g>
  );
}

/** the trainer's digital DC meter (KL-DVM-6005A) with its FUNC and RANGE slide switches */
function Dvm2D({ x, y }: { x: number; y: number }) {
  const g = useRef<SVGGElement>(null);
  const sel = useBench((s) => (s.knobs["dvm.sel"] ?? 0) > 0.5);
  const fine = useBench((s) => (s.knobs["dvm.rng"] ?? 0) > 0.5);
  useEffect(() => {
    let last = "";
    const draw = () => {
      const st = useBench.getState();
      const r = useSim.getState().readings;
      const v = sel ? r.dvm.a : r.dvm.v;
      let s = "";
      if (st.power) {
        const a = Math.abs(v);
        if (fine) s = a >= 9.995 ? "1  " : (v < -0.005 ? "-" : "") + a.toFixed(2);
        else s = a >= 99.95 ? "1  " : (v < -0.05 ? "-" : "") + a.toFixed(1).padStart(4, "0");
      }
      const key = s + st.power;
      if (key === last || !g.current) return;
      last = key;
      const svg = drawToSvg(77, 38, (ctx) => draw7seg(ctx, s, 7, 5, 26, "#ff2410", st.power ? "#2c0604" : "#1d0403", 3));
      g.current.innerHTML = svg.replace(/^<svg[^>]*>|<\/svg>$/g, "");
    };
    draw();
    const a = useSim.subscribe(draw);
    const b = useBench.subscribe(draw);
    return () => {
      a();
      b();
    };
  }, [sel, fine]);
  const W = DVM_RECT.w,
    H = DVM_RECT.h;
  const sw = (on: boolean, id: string, cx: number, label: string) => (
    <g
      data-hit
      className="cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        const k = useBench.getState().knobs[id] ?? 0;
        useBench.getState().setKnob(id, k > 0.5 ? 0 : 1);
        sfx("button");
      }}
      {...hoverProps(`dvm:${id}`, label)}
    >
      <rect x={x + cx - 7.5} y={y + 39 - 5} width={15} height={10} fill="transparent" />
      <rect x={x + cx - 6.5} y={y + 39 - 4} width={13} height={8} rx={1} fill="#070707" />
      <rect x={x + cx + (on ? 0.2 : -6.2)} y={y + 39 - 3.3} width={6} height={6.6} rx={0.8} fill="#e5bd2b" stroke="#9b7b12" strokeWidth={0.3} />
    </g>
  );
  return (
    <g>
      <rect x={x - 3} y={y - 3} width={W + 6} height={H + 6} rx={2.5} fill="#121214" />
      <rect x={x} y={y} width={W} height={H} fill="#0d0d0e" />
      <rect x={x + 4} y={y + 6} width={36} height={48} fill="#1b1c1e" />
      <g fill="none" stroke="#d8d8d8" strokeWidth={0.35}>
        <rect x={x + 6} y={y + 9} width={15} height={13} />
        <rect x={x + 23} y={y + 9} width={15} height={13} />
      </g>
      <g fill="#e8e8e8" fontFamily="Arial" fontWeight="bold" fontSize={3.1} textAnchor="middle">
        <text x={x + 10.2} y={y + 14.6}>
          V
        </text>
        <text x={x + 16.6} y={y + 14.6}>
          mA
        </text>
        <text x={x + 27.4} y={y + 14.6}>
          x.xx
        </text>
        <text x={x + 33.8} y={y + 14.6}>
          xx.x
        </text>
        <text x={x + 13.5} y={y + 20.6} fontWeight="normal" fontSize={2.6}>
          FUNC
        </text>
        <text x={x + 30.5} y={y + 20.6} fontWeight="normal" fontSize={2.6}>
          RANGE
        </text>
      </g>
      {sw(sel, "dvm.sel", 13.5, "V / mA")}
      {sw(fine, "dvm.rng", 30.5, "RANGE")}
      <rect x={x + 46} y={y + 9} width={77} height={38} fill="#1a0303" />
      <svg x={x + 46} y={y + 9} width={77} height={38} viewBox="0 0 77 38">
        <g ref={g} />
      </svg>
      <rect x={x + 46} y={y + 9} width={77} height={16} fill="url(#glass)" opacity={0.5} />
      <text x={x + 84.5} y={y + 54} fill="#8c8c8c" fontFamily="Arial" fontSize={2.9} textAnchor="middle">
        KL-DVM-6005A
      </text>
    </g>
  );
}

/** red rocker on the right side of the case */
function PowerSwitch({ x, y }: { x: number; y: number }) {
  const power = useBench((s) => s.power);
  return (
    <g
      data-hit
      className="cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        useBench.getState().setPower(!useBench.getState().power);
        sfx("switch");
      }}
      {...hoverProps("power", "POWER")}
    >
      <rect x={x - 6} y={y - 10} width={12} height={20} rx={2} fill="#141414" />
      <rect x={x - 4.2} y={y - 8.2} width={8.4} height={16.4} rx={1.2} fill={power ? "#e0251b" : "#8e1410"} />
      <rect x={x - 4.2} y={power ? y - 8.2 : y} width={8.4} height={8.2} rx={1.2} fill="rgba(0,0,0,0.25)" />
      {power && <circle cx={x} cy={y - 4} r={6} fill="#ff3b1f" opacity={0.25} />}
      <text x={x} y={y + 15} fontSize={3.2} fontWeight="bold" fontFamily="Arial" textAnchor="middle" fill="#3b3a36">
        POWER
      </text>
      <text x={x - 2} y={y - 11.5} fontSize={2.6} fontFamily="Arial" textAnchor="middle" fill="#3b3a36">
        I
      </text>
    </g>
  );
}

/** the KL-21001: beige case, printed panel, sockets, knobs, meters */
export function Trainer2D({ L }: { L: Layout }) {
  const [px, py] = L.panel;
  const T = L.trainer;
  return (
    <g>
      {/* case */}
      <rect x={T.x + 3} y={T.y + 5} width={T.w} height={T.h} rx={14} fill="rgba(60,50,30,0.22)" />
      <rect x={T.x} y={T.y} width={T.w} height={T.h} rx={14} fill="url(#caseBeige)" stroke="#b8ad92" strokeWidth={0.8} />
      <rect x={px - 1.5} y={py - 1.5} width={TRAINER_W + 3} height={TRAINER_H + 3} rx={6} fill="#9d998c" />
      <image href={panelUrl()} x={px} y={py} width={TRAINER_W} height={TRAINER_H} />
      {/* panel screws */}
      {SCREWS.map(([u, v], i) => (
        <g key={i}>
          <circle cx={px + u} cy={py + v} r={2.9} fill="url(#screw)" stroke="#0b0b0b" strokeWidth={0.3} />
          <path d={`M${px + u - 1.6} ${py + v}h3.2M${px + u} ${py + v - 1.6}v3.2`} stroke="#050505" strokeWidth={0.6} />
        </g>
      ))}
      <Dvm2D x={px + DVM_RECT.x} y={py + DVM_RECT.y} />
      {TRAINER_METERS.map((m) => (
        <AnalogMeter2D key={m.id} m={m} x={px + m.x} y={py + m.y} />
      ))}
      {TRAINER_KNOBS.map((k) => (
        <Knob2D key={k.id} k={k} x={px + k.x} y={py + k.y} />
      ))}
      {TRAINER_JACKS.map((j) => (
        <BananaSocket key={j.id} j={j} x={px + j.x} y={py + j.y} />
      ))}
      <PowerSwitch x={T.x + T.w - 4} y={T.y + T.h * 0.26} />
    </g>
  );
}

/** shared gradients */
export function Defs() {
  return (
    <defs>
      <linearGradient id="caseBeige" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ece4cf" />
        <stop offset="1" stopColor="#d9cfb6" />
      </linearGradient>
      <radialGradient id="brass" cx="0.38" cy="0.35" r="0.75">
        <stop offset="0" stopColor="#f4dc93" />
        <stop offset="0.55" stopColor="#c9a24a" />
        <stop offset="1" stopColor="#7d6124" />
      </radialGradient>
      <radialGradient id="nickel" cx="0.4" cy="0.35" r="0.8">
        <stop offset="0" stopColor="#f2f2f2" />
        <stop offset="1" stopColor="#7b7d80" />
      </radialGradient>
      <radialGradient id="screw" cx="0.38" cy="0.35" r="0.8">
        <stop offset="0" stopColor="#5a5a5a" />
        <stop offset="1" stopColor="#0e0e0e" />
      </radialGradient>
      <radialGradient id="knobTop" cx="0.4" cy="0.35" r="0.8">
        <stop offset="0" stopColor="#4a4a4e" />
        <stop offset="0.6" stopColor="#1e1e21" />
        <stop offset="1" stopColor="#0d0d0f" />
      </radialGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity={0.22} />
        <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
      </linearGradient>
      <radialGradient id="ledGlow">
        <stop offset="0" stopColor="#ffffff" stopOpacity={1} />
        <stop offset="0.25" stopColor="#ffffff" stopOpacity={0.55} />
        <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
      </radialGradient>
      <radialGradient id="scorch">
        <stop offset="0" stopColor="#140c06" stopOpacity={0.95} />
        <stop offset="0.45" stopColor="#3c240e" stopOpacity={0.55} />
        <stop offset="1" stopColor="#5a3c14" stopOpacity={0} />
      </radialGradient>
      <radialGradient id="pinHole" cx="0.45" cy="0.4" r="0.7">
        <stop offset="0" stopColor="#f7df8f" />
        <stop offset="0.55" stopColor="#c99a33" />
        <stop offset="1" stopColor="#7a5a17" />
      </radialGradient>
    </defs>
  );
}
