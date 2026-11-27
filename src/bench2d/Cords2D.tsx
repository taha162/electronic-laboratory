"use client";
import { memo, useEffect, useState } from "react";
import { useBench } from "@/store/bench";
import { jackVoltage, useSim } from "@/lab/simController";
import { EXPERIMENT_BY_ID } from "@/lab/experiments";
import { checkStep } from "@/lab/experimentActions";
import type { LeadId, ModuleDef, Wire } from "@/lab/types";
import { PLASTIC_COLORS, fmtVolt } from "@/draw/colors";
import { useUi } from "@/ui/uiState";
import { sfx } from "@/audio/audio";
import { jackWorld, leadOrigin, type Layout, type P } from "./geometry";
import { usePointer } from "./Viewport";

const LEADS: LeadId[] = ["osc.ch1", "osc.ch2", "dmm.com", "dmm.v", "dmm2.com", "dmm2.v", "osc.ch1g", "osc.ch2g"];

/** a hanging cord between two points: both ends rise from their sockets, the middle sags */
function cordPath(a: P, b: P, lift = 10) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const sag = Math.min(70, 8 + d * 0.3);
  return { d: `M${a[0]} ${a[1]}C${a[0]} ${a[1] - lift + sag} ${b[0]} ${b[1] - lift + sag} ${b[0]} ${b[1]}`, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.75 * (sag - lift)] as P };
}

/** banana plug seen from above: coloured body around the socket, a lighter top */
function Plug({ p, col, small }: { p: P; col: string; small: boolean }) {
  const r = small ? 2.7 : 3.9;
  return (
    <g pointerEvents="none">
      <circle cx={p[0] + 0.5} cy={p[1] + 0.9} r={r} fill="rgba(0,0,0,0.35)" />
      <circle cx={p[0]} cy={p[1]} r={r} fill={col} stroke="rgba(0,0,0,0.55)" strokeWidth={0.4} />
      <circle cx={p[0] - r * 0.25} cy={p[1] - r * 0.3} r={r * 0.45} fill="#fff" opacity={0.22} />
      <circle cx={p[0]} cy={p[1]} r={r * 0.35} fill="rgba(0,0,0,0.35)" />
    </g>
  );
}

const WireView = memo(function WireView({ w, a, b, selected }: { w: Wire; a: P; b: P; selected: boolean }) {
  const col = PLASTIC_COLORS[w.color] ?? w.color;
  const select = (e: React.MouseEvent) => {
    e.stopPropagation();
    useBench.getState().selectWire(selected ? null : w.id);
  };
  if (w.kind === "clip") {
    // short-circuit clip bridging two neighbouring sockets
    const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return (
      <g data-hit className="cursor-pointer" onClick={select} transform={`rotate(${ang} ${a[0]} ${a[1]})`}>
        <rect x={a[0] - 3.4 + 0.5} y={a[1] - 2.6 + 1} width={L + 6.8} height={5.2} rx={2.2} fill="rgba(0,0,0,0.35)" />
        <rect x={a[0] - 3.4} y={a[1] - 2.6} width={L + 6.8} height={5.2} rx={2.2} fill={col} stroke={selected ? "#ffb000" : "rgba(0,0,0,0.55)"} strokeWidth={selected ? 1 : 0.4} />
        <rect x={a[0] - 2.6} y={a[1] - 2} width={L + 5.2} height={1.6} rx={0.8} fill="#fff" opacity={0.25} />
        <circle cx={a[0]} cy={a[1]} r={1.2} fill="rgba(0,0,0,0.45)" />
        <circle cx={a[0] + L} cy={a[1]} r={1.2} fill="rgba(0,0,0,0.45)" />
        {selected && <DeleteChip p={[a[0] + L / 2, a[1] - 7]} id={w.id} rot={-ang} />}
      </g>
    );
  }
  const small = a && b && (w.a.startsWith("m:") || w.b.startsWith("m:"));
  const { d, mid } = cordPath(a, b);
  const pa = w.a.startsWith("m:") ? 2.7 : 3.9,
    pb = w.b.startsWith("m:") ? 2.7 : 3.9;
  void small;
  return (
    <g>
      <path d={d} stroke="rgba(0,0,0,0.25)" strokeWidth={3.6} fill="none" transform="translate(1 2)" pointerEvents="none" />
      <path d={d} stroke={selected ? "#ffb000" : "rgba(0,0,0,0.6)"} strokeWidth={selected ? 4.6 : 3.4} fill="none" strokeLinecap="round" pointerEvents="none" />
      <path d={d} stroke={col} strokeWidth={2.6} fill="none" strokeLinecap="round" pointerEvents="none" />
      <path d={d} stroke="#fff" strokeOpacity={0.28} strokeWidth={0.7} fill="none" transform="translate(-0.5 -0.6)" pointerEvents="none" />
      <path d={d} data-hit className="cursor-pointer" stroke="transparent" strokeWidth={8} fill="none" onClick={select} />
      <Plug p={a} col={col} small={pa < 3} />
      <Plug p={b} col={col} small={pb < 3} />
      {selected && <DeleteChip p={mid} id={w.id} />}
    </g>
  );
});

function DeleteChip({ p, id, rot = 0 }: { p: P; id: string; rot?: number }) {
  return (
    <g
      data-hit
      className="cursor-pointer"
      transform={rot ? `rotate(${rot} ${p[0]} ${p[1]})` : undefined}
      onClick={(e) => {
        e.stopPropagation();
        useBench.getState().removeWire(id);
        sfx("unplug");
      }}
    >
      <circle cx={p[0]} cy={p[1]} r={4.8} fill="#c62828" stroke="#fff" strokeWidth={0.7} />
      <path d={`M${p[0] - 2} ${p[1] - 2}l4 4M${p[0] + 2} ${p[1] - 2}l-4 4`} stroke="#fff" strokeWidth={1} strokeLinecap="round" />
    </g>
  );
}

/* ---------------------------------------------------------------- */
/* instrument leads                                                   */
/* ---------------------------------------------------------------- */
const LEAD_STYLE: Record<LeadId, { cable: string; ring: string; kind: "probe" | "clip" | "pen" }> = {
  "osc.ch1": { cable: "#2b2d31", ring: "#f7e521", kind: "probe" },
  "osc.ch2": { cable: "#2b2d31", ring: "#22c3f0", kind: "probe" },
  "osc.ch1g": { cable: "#161616", ring: "#161616", kind: "clip" },
  "osc.ch2g": { cable: "#161616", ring: "#161616", kind: "clip" },
  "dmm.v": { cable: "#c8161a", ring: "#c8161a", kind: "pen" },
  "dmm.com": { cable: "#151515", ring: "#151515", kind: "pen" },
  "dmm2.v": { cable: "#c8161a", ring: "#c8161a", kind: "pen" },
  "dmm2.com": { cable: "#151515", ring: "#151515", kind: "pen" },
};

/** the end of a lead: scope probe with hook, ground alligator clip, or multimeter pen */
function Tip({ p, dir, l, held, onTap }: { p: P; dir: P; l: LeadId; held: boolean; onTap: (e: React.MouseEvent) => void }) {
  const st = LEAD_STYLE[l];
  const ang = (Math.atan2(dir[1], dir[0]) * 180) / Math.PI; // body points back along the cable
  return (
    // the carried tip follows the pointer: it must not catch the click meant for the socket under it
    <g data-hit data-lead={l} className="cursor-pointer" onClick={onTap} pointerEvents={held ? "none" : undefined} transform={`rotate(${ang} ${p[0]} ${p[1]})`}>
      <rect x={p[0] - 2} y={p[1] - 7} width={26} height={14} fill="transparent" />
      {st.kind === "probe" && (
        <g>
          <rect x={p[0] + 4} y={p[1] - 2.4 + 0.8} width={17} height={4.8} rx={2.2} fill="rgba(0,0,0,0.3)" />
          <path d={`M${p[0]} ${p[1]}q2 -2.2 4.4 -0.6`} stroke="#c9ccd1" strokeWidth={0.9} fill="none" />
          <rect x={p[0] + 3} y={p[1] - 1} width={2.4} height={2} fill="#c9ccd1" />
          <rect x={p[0] + 5} y={p[1] - 2.3} width={16} height={4.6} rx={2.1} fill="#3a3d42" />
          <rect x={p[0] + 7} y={p[1] - 2.3} width={2.2} height={4.6} fill={st.ring} />
          <rect x={p[0] + 6} y={p[1] - 1.9} width={14} height={1.2} rx={0.6} fill="#fff" opacity={0.15} />
        </g>
      )}
      {st.kind === "clip" && (
        <g>
          <path d={`M${p[0]} ${p[1] - 1.6}l9 -1.2v5.6l-9 -1.2z`} fill="#202020" stroke="#000" strokeWidth={0.3} />
          <path d={`M${p[0] + 0.5} ${p[1] - 1.2}l7.5 -0.6M${p[0] + 0.5} ${p[1] + 1.2}l7.5 0.6`} stroke="#8a8d92" strokeWidth={0.5} />
          <rect x={p[0] + 9} y={p[1] - 1.4} width={4} height={2.8} rx={0.8} fill="#202020" />
        </g>
      )}
      {st.kind === "pen" && (
        <g>
          <rect x={p[0] + 3} y={p[1] - 2.2 + 0.8} width={20} height={4.4} rx={1.8} fill="rgba(0,0,0,0.3)" />
          <path d={`M${p[0]} ${p[1]}L${p[0] + 4} ${p[1] - 0.7}V${p[1] + 0.7}Z`} fill="#c9ccd1" />
          <rect x={p[0] + 4} y={p[1] - 2.1} width={18} height={4.2} rx={1.8} fill={st.ring} stroke="rgba(0,0,0,0.5)" strokeWidth={0.3} />
          <rect x={p[0] + 8} y={p[1] - 2.8} width={1.6} height={5.6} rx={0.6} fill={st.ring} stroke="rgba(0,0,0,0.5)" strokeWidth={0.3} />
          <rect x={p[0] + 5} y={p[1] - 1.7} width={16} height={1.1} rx={0.5} fill="#fff" opacity={0.18} />
        </g>
      )}
      {held && <circle cx={p[0]} cy={p[1]} r={4.5} fill="none" stroke="#ffb000" strokeWidth={0.9} />}
    </g>
  );
}

function Leads({ L, mod }: { L: Layout; mod: ModuleDef }) {
  const leads = useBench((s) => s.leads);
  const held = useBench((s) => s.heldLead);
  const ptr = usePointer((s) => (held ? s.p : null));
  // tip positions first (ground clips hang from their probe's head)
  const tip = (l: LeadId): P => {
    if (held === l && ptr) return ptr;
    const j = leads[l];
    const w = j ? jackWorld(j, mod, L) : null;
    if (w) return w;
    // an unclipped ground lead dangles from its probe wherever the probe is
    if (l === "osc.ch1g" || l === "osc.ch2g") {
      const pr = l === "osc.ch1g" ? "osc.ch1" : "osc.ch2";
      if (leads[pr] || held === pr) {
        const h = tip(pr);
        return [h[0] + 9, h[1] + 4];
      }
    }
    return L.park[l];
  };
  const out: React.ReactNode[] = [];
  for (const l of LEADS) {
    const st = LEAD_STYLE[l];
    const T = tip(l);
    let O: P, od: P;
    if (st.kind === "clip") {
      O = tip(l === "osc.ch1g" ? "osc.ch1" : "osc.ch2");
      O = [O[0], O[1] - 10];
      od = [0, -1];
    } else if (l.startsWith("osc")) {
      O = leadOrigin(l, L);
      od = [0, -1];
    } else {
      O = leadOrigin(l, L);
      od = [0, 1];
    }
    const len = Math.min(60, 12 + Math.hypot(T[0] - O[0], T[1] - O[1]) * 0.35);
    const sag = Math.min(40, Math.hypot(T[0] - O[0], T[1] - O[1]) * 0.18);
    const c1: P = [O[0] + od[0] * len, O[1] + od[1] * len + sag];
    // the probe / pen stands up out of the socket, its cable leaving from the top
    const back: P = [0, -1];
    const bodyLen = st.kind === "pen" ? 22 : st.kind === "probe" ? 21 : 13;
    const E: P = [T[0] + back[0] * bodyLen, T[1] + back[1] * bodyLen];
    const c2: P = [E[0], E[1] - len * 0.5 + sag];
    const d = `M${O[0]} ${O[1]}C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${E[0]} ${E[1]}`;
    const w = st.kind === "clip" ? 1.2 : 2.2;
    out.push(
      <g key={l}>
        <path d={d} stroke="rgba(0,0,0,0.22)" strokeWidth={w + 1} fill="none" transform="translate(1 2)" pointerEvents="none" />
        <path d={d} stroke={st.cable} strokeWidth={w} fill="none" strokeLinecap="round" pointerEvents="none" />
        <Tip
          p={T}
          dir={back}
          l={l}
          held={held === l}
          onTap={(e) => {
            e.stopPropagation();
            const s = useBench.getState();
            if (s.heldLead === l) {
              // tapping the carried lead again puts it back
              s.attachLead(l, null);
              return;
            }
            s.pickLead(l);
            sfx("unplug");
          }}
        />
      </g>,
    );
  }
  return <g>{out}</g>;
}

/* ---------------------------------------------------------------- */
/* guide, X-ray, carried cord                                          */
/* ---------------------------------------------------------------- */
function useMissingPairs(): [string, string][] {
  const [pairs, setPairs] = useState<[string, string][]>([]);
  useEffect(() => {
    const compute = () => {
      const s = useBench.getState();
      const exp = s.experimentId ? EXPERIMENT_BY_ID[s.experimentId] : null;
      const step = exp?.steps[s.step];
      if (!exp || !step || !useUi.getState().guide || s.moduleId !== exp.module) return setPairs([]);
      setPairs(checkStep(exp.module, step).pairs);
    };
    compute();
    const a = useBench.subscribe(compute);
    const b = useUi.subscribe(compute);
    return () => {
      a();
      b();
    };
  }, []);
  return pairs;
}

function Ring({ p }: { p: P }) {
  return (
    <g pointerEvents="none">
      <circle cx={p[0]} cy={p[1]} r={5} fill="none" stroke="#ffb000" strokeWidth={1.2}>
        <animate attributeName="r" values="4.5;11" dur="1.1s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0" dur="1.1s" repeatCount="indefinite" />
      </circle>
      <circle cx={p[0]} cy={p[1]} r={5.2} fill="none" stroke="#ffb000" strokeWidth={1.1} />
      <path d={`M${p[0]} ${p[1] - 7}l-2.6 -5h5.2z`} fill="#ffb000">
        <animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="0.9s" repeatCount="indefinite" />
      </path>
    </g>
  );
}

function Guide({ L, mod }: { L: Layout; mod: ModuleDef }) {
  const pairs = useMissingPairs();
  const leads = useBench((s) => s.leads);
  if (!pairs.length) return null;
  const pos = (id: string): P | null => {
    if (id.includes(":")) return jackWorld(id, mod, L);
    const l = id as LeadId;
    const j = leads[l];
    return (j && jackWorld(j, mod, L)) || L.park[l] || null;
  };
  const [a, b] = pairs[0];
  const pa = pos(a),
    pb = pos(b);
  return (
    <g pointerEvents="none">
      {pa && pb && <path d={cordPath(pa, pb).d} stroke="#ffcf3a" strokeWidth={1.6} strokeDasharray="3 2.4" fill="none" opacity={0.85} />}
      {pa && <Ring p={pa} />}
      {pb && <Ring p={pb} />}
    </g>
  );
}

function Insight({ L, mod }: { L: Layout; mod: ModuleDef }) {
  const on = useUi((s) => s.insight);
  const wires = useBench((s) => s.wires);
  const leads = useBench((s) => s.leads);
  useSim((s) => s.version);
  if (!on) return null;
  const set = new Set<string>();
  for (const w of wires) {
    set.add(w.a);
    set.add(w.b);
  }
  for (const j of Object.values(leads)) if (j) set.add(j);
  return (
    <g pointerEvents="none">
      {[...set].slice(0, 60).map((j) => {
        const p = jackWorld(j, mod, L);
        if (!p) return null;
        const v = jackVoltage(j);
        let txt = "float",
          col = "#9aa4b2";
        if (v) {
          const pp = v.max - v.min;
          txt = pp > 0.05 ? `${fmtVolt(v.mean)} ~${fmtVolt(pp)}` : fmtVolt(v.mean);
          col = v.mean > 0.05 ? "#ff9a80" : v.mean < -0.05 ? "#8fbcff" : "#eef2f7";
        }
        const w = txt.length * 2.05 + 3;
        return (
          <g key={j}>
            <rect x={p[0] - w / 2} y={p[1] - 13} width={w} height={5.6} rx={1.6} fill="rgba(6,8,11,0.9)" stroke={col} strokeWidth={0.4} />
            <text x={p[0]} y={p[1] - 10.2} fontSize={3.4} fontFamily="ui-monospace, Menlo, monospace" fontWeight="bold" fill={col} textAnchor="middle" dominantBaseline="central">
              {txt}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** the cord being placed follows the finger / cursor */
function Carried({ L, mod }: { L: Layout; mod: ModuleDef }) {
  const pending = useBench((s) => s.pending);
  const color = useBench((s) => s.wireColor);
  const ptr = usePointer((s) => (pending ? s.p : null));
  if (!pending || !ptr) return null;
  const a = jackWorld(pending, mod, L);
  if (!a) return null;
  const col = PLASTIC_COLORS[color] ?? color;
  return (
    <g pointerEvents="none">
      <path d={cordPath(a, ptr, 4).d} stroke={col} strokeWidth={2.2} fill="none" strokeDasharray="4 2.5" opacity={0.9} />
      <circle cx={ptr[0]} cy={ptr[1]} r={2.6} fill={col} opacity={0.8} />
    </g>
  );
}

/** all cords, clips and instrument leads, the guide and the X-ray tags */
export function Cords2D({ L, mod }: { L: Layout; mod: ModuleDef }) {
  const wires = useBench((s) => s.wires);
  const sel = useBench((s) => s.selectedWire);
  // clips lie flat on the board: under the cords
  const sorted = [...wires].sort((a, b) => (a.kind === "clip" ? 0 : 1) - (b.kind === "clip" ? 0 : 1));
  return (
    <g>
      {sorted.map((w) => {
        const a = jackWorld(w.a, mod, L),
          b = jackWorld(w.b, mod, L);
        if (!a || !b) return null;
        return <WireView key={w.id} w={w} a={a} b={b} selected={sel === w.id} />;
      })}
      <Leads L={L} mod={mod} />
      <Carried L={L} mod={mod} />
      <Guide L={L} mod={mod} />
      <Insight L={L} mod={mod} />
    </g>
  );
}
