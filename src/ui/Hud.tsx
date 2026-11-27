"use client";
import { useEffect, useState } from "react";
import { useBench } from "@/store/bench";
import { useSim, jackVoltage } from "@/lab/simController";
import { jackLabel } from "@/lab/experimentActions";
import { fmtEng } from "@/sim/measure";
import { useUi } from "@/three/registry";
import { useT } from "./i18n";
import { usePhone } from "./usePhone";

export function HoverTip() {
  const hover = useUi((s) => s.hover);
  const moduleId = useBench((s) => s.moduleId);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const h = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", h);
    return () => window.removeEventListener("pointermove", h);
  }, []);
  if (!hover) return null;
  let label = hover.label;
  let volt: string | null = null;
  if (hover.id.startsWith("tr:") || hover.id.startsWith("m:")) {
    label = jackLabel(hover.id, moduleId);
    const v = jackVoltage(hover.id);
    if (v) {
      const pp = v.max - v.min;
      volt = `${fmtEng(v.mean, "V")} DC${pp > 0.05 ? ` · ${fmtEng(pp, "V")}pp` : ""}`;
    }
  }
  if (hover.id.startsWith("lead:")) label = jackLabel(hover.id.slice(5), moduleId);
  if (hover.id.startsWith("knob:")) {
    const k = hover.id.slice(5);
    const v = useBench.getState().knobs[k] ?? 0;
    label = `${k.toUpperCase()} · ${k.includes("range") || k.includes("func") ? v : `${Math.round(v * 100)}%`}`;
  }
  return (
    <div className="glass pointer-events-none fixed z-50 rounded-md px-2 py-1 font-mono text-[11px]" style={{ left: pos.x + 14, top: pos.y + 14 }} dir="ltr">
      {label}
      {volt && useUi.getState().insight && <div className="text-[var(--color-accent)]">{volt}</div>}
    </div>
  );
}

export function StatusHint() {
  const { t } = useT();
  const pending = useBench((s) => s.pending);
  const held = useBench((s) => s.heldLead);
  const placing = useBench((s) => s.placing);
  const sel = useBench((s) => s.selectedWire);
  const busy = useSim((s) => s.busy);
  const err = useSim((s) => s.error);
  const stats = useSim((s) => s.result?.stats);
  const hint = placing ? t("hintPlacing") : held ? t("hintHeld") : pending ? t("hintPending") : sel ? t("hintSelected") : null;
  const { phone, landscape } = usePhone();
  return (
    <div className={`pointer-events-none absolute inset-x-0 flex flex-col items-center gap-1.5 ${phone ? (landscape ? "bottom-[4.2rem]" : "bottom-[7.4rem]") : "bottom-[4.6rem]"}`}>
      {hint && <div className="glass max-w-[92vw] rounded-full px-4 py-1.5 text-center text-xs">{hint}</div>}
      <div className={`items-center gap-2 text-[10px] text-[var(--color-mute)] ${phone ? "hidden" : "flex"}`} dir="ltr">
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: err ? "#ff6464" : busy ? "#f2b33d" : "#3ccf7a" }} />
        {err ? err : busy ? t("simBusy") : stats ? `MNA ${stats.unknowns}×${stats.unknowns} · ${stats.steps} steps · ${stats.ms.toFixed(0)} ms` : ""}
      </div>
    </div>
  );
}

/** compact instrument readouts (useful when the camera is far from the instruments) */
export function Readings() {
  const { phone, landscape } = usePhone();
  const r = useSim((s) => s.readings);
  const ch = useSim((s) => s.ch);
  const dmmMode = useBench((s) => s.dmmMode);
  const scope = useBench((s) => s.scope);
  const { t } = useT();
  return (
    <>
    {/* phones: one compact line of readings under the top bar */}
    {phone && (
    <div className={`pointer-events-none absolute inset-x-0 flex justify-center ${landscape ? "top-[0.7rem]" : "top-[3.4rem]"}`} dir="ltr">
      <div className="glass flex max-w-[96vw] items-center gap-2.5 overflow-hidden whitespace-nowrap rounded-full px-3 py-1 font-mono text-[11px]">
        <span>
          <span className="text-[var(--color-mute)]">DMM </span>
          {dmmMode === "off" ? "OFF" : `${r.dmm.text} ${r.dmm.unit}`}
        </span>
        <span className="text-[#ff5a3c]">{r.dvm.v.toFixed(2)} V</span>
        {[0, 1].map((i) =>
          scope.ch[i].on && ch[i] ? (
            <span key={i} style={{ color: i ? "#22c3f0" : "#f7e521" }}>
              {fmtEng(ch[i]!.vpp, "Vpp")}
            </span>
          ) : null,
        )}
      </div>
    </div>
    )}
    <div className={`pointer-events-none absolute end-3 top-[4.4rem] flex-col items-end gap-1.5 ${phone ? "hidden" : "hidden md:flex"}`} dir="ltr">
      <div className="glass flex items-center gap-2 rounded-lg px-2.5 py-1.5">
        <span className="text-[10px] text-[var(--color-mute)]">{t("dmm")}</span>
        <span className="font-mono text-sm font-semibold">{dmmMode === "off" ? "OFF" : `${r.dmm.text} ${r.dmm.unit}`}</span>
      </div>
      <div className="glass flex items-center gap-2 rounded-lg px-2.5 py-1.5">
        <span className="text-[10px] text-[var(--color-mute)]">{t("dvm")}</span>
        <span className="font-mono text-sm font-semibold text-[#ff5a3c]">{r.dvm.v.toFixed(2)} V</span>
      </div>
      {[0, 1].map((i) =>
        scope.ch[i].on ? (
          <div key={i} className="glass flex items-center gap-2 rounded-lg px-2.5 py-1 font-mono text-[11px]">
            <span className="font-bold" style={{ color: i ? "#22c3f0" : "#f7e521" }}>
              CH{i + 1}
            </span>
            <span>{ch[i] ? `${fmtEng(ch[i]!.vpp, "Vpp")}` : "--"}</span>
            <span className="text-[var(--color-mute)]">{ch[i] && ch[i]!.freq > 0 ? fmtEng(ch[i]!.freq, "Hz") : ""}</span>
            <span className="text-[var(--color-mute)]">{ch[i] ? `avg ${fmtEng(ch[i]!.mean, "V")}` : ""}</span>
          </div>
        ) : null,
      )}
    </div>
    </>
  );
}

export function Toast() {
  const toast = useBench((s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(id);
  }, [toast]);
  if (!toast || !visible) return null;
  return (
    <div className="glass pointer-events-none absolute start-1/2 bottom-[10rem] z-30 sm:bottom-[7.6rem] max-w-[90vw] -translate-x-1/2 rounded-full px-4 py-2 text-center text-sm rtl:translate-x-1/2">
      {toast.text}
    </div>
  );
}
