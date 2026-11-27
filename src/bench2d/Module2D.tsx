"use client";
import { memo } from "react";
import { create } from "zustand";
import { useBench } from "@/store/bench";
import { useSim } from "@/lab/simController";
import type { CustomPart, JackDef, ModuleDef, PartDef, PropDef } from "@/lab/types";
import { PLASTIC_COLORS } from "@/draw/colors";
import { sfx } from "@/audio/audio";
import { moduleUrl } from "./prints";
import { moduleFrame, type Layout } from "./geometry";
import { hoverProps, Knob2D } from "./Trainer2D";

/** a part placed on the breadboard that was tapped (shows its remove button) */
export const usePartSel = create<{ id: string | null; set(id: string | null): void }>((set) => ({ id: null, set: (id) => set({ id }) }));

/** 2 mm gold socket of a KL module */
const PinSocket = memo(function PinSocket({ j }: { j: JackDef }) {
  const gid = `m:${j.id}`;
  const pending = useBench((s) => s.pending === gid);
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
      {...hoverProps(gid, j.label || j.id)}
    >
      <circle cx={j.x} cy={j.y} r={4.6} fill="transparent" />
      <circle cx={j.x + 0.35} cy={j.y + 0.55} r={3.15} fill="rgba(0,0,0,0.3)" />
      <circle cx={j.x} cy={j.y} r={3.05} fill="url(#pinHole)" stroke="#6b4f14" strokeWidth={0.25} />
      <circle cx={j.x} cy={j.y} r={1.35} fill="#140f06" />
      {pending && <circle cx={j.x} cy={j.y} r={4.4} fill="none" stroke="#ffb000" strokeWidth={0.9} />}
    </g>
  );
});

function Led2D({ p, x, y }: { p: PartDef; x: number; y: number }) {
  const i = useSim((s) => s.readings.led[`m.${p.id}`] ?? 0);
  const b = Math.min(Math.max(i / 0.01, 0), 1.6);
  const col = p.color ?? "#ff2020";
  return (
    <g pointerEvents="none">
      <circle cx={x + 0.5} cy={y + 0.8} r={2.9} fill="rgba(0,0,0,0.3)" />
      <circle cx={x} cy={y} r={2.8} fill={col} opacity={0.45 + 0.55 * Math.min(1, b)} stroke="rgba(0,0,0,0.4)" strokeWidth={0.3} />
      <circle cx={x - 0.8} cy={y - 0.9} r={0.9} fill="#fff" opacity={0.55} />
      {b > 0.02 && <circle cx={x} cy={y} r={7 + 5 * b} fill={col} opacity={0.35 * Math.min(1, b)} style={{ mixBlendMode: "screen" }} />}
      {b > 0.02 && <circle cx={x} cy={y} r={3.2} fill="url(#ledGlow)" opacity={Math.min(1, b)} />}
    </g>
  );
}

function Prop2D({ p }: { p: PropDef }) {
  const w = p.w ?? 20,
    h = p.h ?? 20;
  switch (p.kind) {
    case "dip":
      // the black cap over the fault-simulation DIP switch, K&H logo moulded in
      return (
        <g pointerEvents="none">
          <rect x={p.x - w / 2 + 1} y={p.y - h / 2 + 2} width={w} height={h} rx={6} fill="rgba(0,0,0,0.35)" />
          <rect x={p.x - w / 2} y={p.y - h / 2} width={w} height={h} rx={6} fill="#151515" />
          <rect x={p.x - w / 2 + 2} y={p.y - h / 2 + 1.5} width={w - 4} height={h * 0.35} rx={4} fill="#ffffff" opacity={0.06} />
          <path
            d={`M${p.x - 13} ${p.y - 5}h24l-4 10h-24z`}
            fill="none"
            stroke="#2b2b2b"
            strokeWidth={0.9}
          />
          <circle cx={p.x + w / 2 - 7} cy={p.y} r={2.2} fill="#0b0b0b" stroke="#2e2e2e" strokeWidth={0.5} />
        </g>
      );
    case "relay":
      return (
        <g pointerEvents="none">
          <rect x={p.x - w / 2 + 1} y={p.y - h / 2 + 1.6} width={w} height={h} rx={1.2} fill="rgba(0,0,0,0.35)" />
          <rect x={p.x - w / 2} y={p.y - h / 2} width={w} height={h} rx={1.2} fill="#141414" />
          <g fill="#e6e6e6" fontFamily="Arial" textAnchor="middle">
            <text x={p.x} y={p.y - h * 0.22} fontSize={2.5} fontWeight="bold">
              SRD-12VDC-SL-C
            </text>
            <text x={p.x} y={p.y + 0.4} fontSize={1.8}>
              10A 250VAC 10A 30VDC
            </text>
            <text x={p.x} y={p.y + 3} fontSize={1.8}>
              10A 125VAC 10A 28VDC
            </text>
            <text x={p.x} y={p.y + h * 0.36} fontSize={2.6} fontWeight="bold">
              CE UL
            </text>
          </g>
        </g>
      );
    case "button":
      return (
        <g pointerEvents="none">
          <rect x={p.x - w * 0.56 + 1} y={p.y - h * 0.56 + 1.6} width={w * 1.12} height={h * 1.12} rx={1.6} fill="rgba(0,0,0,0.3)" />
          <rect x={p.x - w * 0.56} y={p.y - h * 0.56} width={w * 1.12} height={h * 1.12} rx={1.6} fill="#2a2a2a" />
          <rect x={p.x - w / 2} y={p.y - h / 2} width={w} height={h} rx={1.6} fill="#2f6be0" />
          <rect x={p.x - w / 2 + 1.2} y={p.y - h / 2 + 1} width={w - 2.4} height={h * 0.4} rx={1.2} fill="#ffffff" opacity={0.22} />
        </g>
      );
    case "photo":
      return (
        <g pointerEvents="none">
          <circle cx={p.x + 0.4} cy={p.y + 0.7} r={3.4} fill="rgba(0,0,0,0.3)" />
          <circle cx={p.x} cy={p.y} r={3.3} fill="url(#nickel)" />
          <circle cx={p.x} cy={p.y} r={1.9} fill="#e9e4d6" stroke="#a49c86" strokeWidth={0.3} />
          <circle cx={p.x - 0.5} cy={p.y - 0.6} r={0.6} fill="#fff" />
        </g>
      );
    case "led":
      return (
        <g pointerEvents="none">
          <circle cx={p.x + 0.5} cy={p.y + 0.8} r={2.9} fill="rgba(0,0,0,0.3)" />
          <circle cx={p.x} cy={p.y} r={2.8} fill={p.color ?? "#222"} />
          <circle cx={p.x - 0.8} cy={p.y - 0.9} r={0.9} fill="#fff" opacity={0.4} />
        </g>
      );
  }
  return null;
}

/** where a module part sits (board mm) */
export function partCentre(m: ModuleDef, p: PartDef): [number, number] | null {
  if (p.at) return p.at;
  const js = p.pins.map((id) => m.jacks.find((j) => j.id === id)).filter(Boolean) as JackDef[];
  if (!js.length) return null;
  return [js.reduce((s, j) => s + j.x, 0) / js.length, js.reduce((s, j) => s + j.y, 0) / js.length];
}

/** overheating glow and smoke, scorch marks of burnt parts */
function PartFx2D({ mod }: { mod: ModuleDef }) {
  const stress = useSim((s) => s.readings.stress);
  const damaged = useBench((s) => s.damaged ?? []);
  const custom = useBench((s) => s.customParts);
  const at = (gid: string): [number, number] | null => {
    if (gid.startsWith("m.")) {
      const p = mod.parts.find((x) => `m.${x.id}` === gid);
      return p ? partCentre(mod, p) : null;
    }
    const p = custom.find((x) => `u.${x.id}` === gid);
    if (!p) return null;
    return partCentre(mod, { ...p, pins: p.gpins.map((g) => g.replace(/^m:/, "")) });
  };
  return (
    <g pointerEvents="none">
      {damaged.map((id) => {
        const p = at(id);
        return p ? <circle key={id} cx={p[0]} cy={p[1]} r={9} fill="url(#scorch)" /> : null;
      })}
      {stress.map((s) => {
        const p = at(s.id);
        if (!p) return null;
        const k = Math.min(2, s.power / s.rating / 2);
        return (
          <g key={s.id}>
            <circle cx={p[0]} cy={p[1]} r={6 + 4 * k} fill="#ff6a1a" opacity={0.35} className="animate-pulse" />
            {[0, 1, 2].map((i) => (
              <circle key={i} cx={p[0] + (i - 1) * 2.5} cy={p[1] - 4} r={2.4 + i} fill="#d6d2c8" className="smoke-puff" style={{ animationDelay: `${i * 0.45}s`, opacity: 0.5 * Math.min(1, k) }} />
            ))}
          </g>
        );
      })}
    </g>
  );
}

/* ---------------------------------------------------------------- */
/* parts the student placed on the breadboard                         */
/* ---------------------------------------------------------------- */
const BAND = ["#111", "#7a3b12", "#d21f1f", "#f07b12", "#f5d212", "#1c9a3a", "#1f4fd8", "#8a2fc2", "#888", "#f3f3f3"];
function bands(r: number) {
  const exp = Math.floor(Math.log10(r)) - 1;
  const sig = Math.round(r / Math.pow(10, exp));
  return [BAND[Math.floor(sig / 10) % 10], BAND[sig % 10], BAND[Math.max(0, Math.min(9, exp))], "#c9a03a"];
}
function CustomPart2D({ p, mod }: { p: CustomPart; mod: ModuleDef }) {
  const sel = usePartSel((s) => s.id === p.id);
  const pts = p.gpins.map((g) => mod.jacks.find((j) => `m:${j.id}` === g)).filter(Boolean) as JackDef[];
  if (pts.length < 2) return null;
  const a = pts[0],
    b = pts[pts.length - 1];
  const mx = pts.reduce((s, j) => s + j.x, 0) / pts.length,
    my = pts.reduce((s, j) => s + j.y, 0) / pts.length;
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const legs = pts.map((j) => <line key={j.id} x1={mx} y1={my} x2={j.x} y2={j.y} stroke="#b9bcc0" strokeWidth={0.7} />);
  let body: React.ReactNode = null;
  switch (p.kind) {
    case "R":
      body = (
        <g transform={`rotate(${ang} ${mx} ${my})`}>
          <rect x={mx - 5} y={my - 1.8} width={10} height={3.6} rx={1.6} fill="#d8c39a" stroke="#8b7a55" strokeWidth={0.25} />
          {bands(p.value ?? 1000).map((c, i) => (
            <rect key={i} x={mx - 3.3 + i * 1.8} y={my - 1.8} width={0.8} height={3.6} fill={c} />
          ))}
        </g>
      );
      break;
    case "C":
      body = <circle cx={mx} cy={my} r={2.8} fill="#d48a2a" stroke="#7a4d12" strokeWidth={0.3} />;
      break;
    case "CP":
      body = (
        <g>
          <circle cx={mx} cy={my} r={3.6} fill="#1d3fa8" stroke="#0e1f55" strokeWidth={0.3} />
          <path d={`M${mx + 1.2} ${my - 3.4}a3.6 3.6 0 0 1 0 6.8`} stroke="#cfd8ff" strokeWidth={0.9} fill="none" />
        </g>
      );
      break;
    case "L":
      body = (
        <g transform={`rotate(${ang} ${mx} ${my})`}>
          <rect x={mx - 4.5} y={my - 2.2} width={9} height={4.4} rx={2} fill="#2f7a3a" stroke="#174020" strokeWidth={0.3} />
        </g>
      );
      break;
    case "D":
    case "Z":
      body = (
        <g transform={`rotate(${ang} ${mx} ${my})`}>
          <rect x={mx - 3.4} y={my - 1.3} width={6.8} height={2.6} rx={1} fill={p.kind === "Z" ? "#d24a2a" : "#151515"} />
          <rect x={mx + 1.8} y={my - 1.3} width={0.9} height={2.6} fill="#e8e8e8" />
        </g>
      );
      break;
    case "LED":
      body = <circle cx={mx} cy={my} r={2.8} fill={p.color ?? "#ff2020"} stroke="rgba(0,0,0,0.4)" strokeWidth={0.3} />;
      break;
    case "NPN":
    case "PNP":
      body = (
        <g>
          <path d={`M${mx - 3} ${my + 1.6}h6a3 3 0 0 0 -6 0z`} transform={`rotate(180 ${mx} ${my})`} fill="#161616" />
          <text x={mx} y={my + 0.6} fontSize={1.6} textAnchor="middle" fill="#ccc">
            {p.kind}
          </text>
        </g>
      );
      break;
    default:
      body = <rect x={mx - 3} y={my - 3} width={6} height={6} rx={1} fill="#2c5ad6" />;
  }
  return (
    <g
      data-hit
      className="cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        usePartSel.getState().set(sel ? null : p.id);
      }}
    >
      {legs}
      {body}
      {sel && (
        <g
          onClick={(e) => {
            e.stopPropagation();
            useBench.getState().removeCustomPart(p.id);
            usePartSel.getState().set(null);
            sfx("unplug");
          }}
        >
          <circle cx={mx} cy={my - 7} r={3.4} fill="#c62828" stroke="#fff" strokeWidth={0.5} />
          <path d={`M${mx - 1.4} ${my - 8.4}l2.8 2.8M${mx + 1.4} ${my - 8.4}l-2.8 2.8`} stroke="#fff" strokeWidth={0.7} />
        </g>
      )}
    </g>
  );
}

/** the experiment board in the trainer's slot */
export function Module2D({ L, mod }: { L: Layout; mod: ModuleDef }) {
  const f = moduleFrame(mod, L);
  const [W, H] = mod.size;
  const custom = useBench((s) => s.customParts);
  const leds = mod.parts.filter((p) => p.kind === "LED");
  const knobs = mod.parts.filter((p) => p.knob);
  return (
    <g transform={`translate(${f.x} ${f.y}) scale(${f.k})`}>
      <rect x={2} y={3.5} width={W} height={H} rx={5} fill="rgba(0,0,0,0.28)" />
      <rect x={-1.2} y={-1.2} width={W + 2.4} height={H + 2.4} rx={6} fill="#c9c9c3" />
      <image href={moduleUrl(mod)} width={W} height={H} />
      {(mod.props ?? []).map((p, i) => (
        <Prop2D key={i} p={p} />
      ))}
      {leds.map((p) => {
        const a = mod.jacks.find((j) => j.id === p.pins[0]),
          b = mod.jacks.find((j) => j.id === p.pins[1]);
        const at = p.mount ?? (a && b ? [(a.x + b.x) / 2, (a.y + b.y) / 2] : null);
        return at ? <Led2D key={p.id} p={p} x={at[0]} y={at[1]} /> : null;
      })}
      {knobs.map((p) => {
        const at = p.at ?? partCentre(mod, p);
        return at ? <Knob2D key={p.id} k={{ id: p.knob!, r: 5 }} x={at[0]} y={at[1]} trimmer /> : null;
      })}
      {mod.jacks
        .filter((j) => !j.hidden)
        .map((j) => (
          <PinSocket key={j.id} j={j} />
        ))}
      {custom.map((p) => (
        <CustomPart2D key={p.id} p={p} mod={mod} />
      ))}
      <PartFx2D mod={mod} />
    </g>
  );
}

export const PIN_COLORS = PLASTIC_COLORS;
