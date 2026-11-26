"use client";
import { useBench } from "@/store/bench";
import { MODULES } from "@/lab/modules";
import type { WireColor } from "@/lab/types";
import { PLASTIC_COLORS } from "@/three/materials";
import { useUi } from "@/three/registry";
import { useT } from "./i18n";

const COLORS: WireColor[] = ["red", "black", "yellow", "blue", "green", "white", "greenyellow"];
const VIEWS = ["seat", "module", "generator", "power", "scope", "dmm", "overview"] as const;

export function Dock() {
  const { t, lang } = useT();
  const color = useBench((s) => s.wireColor);
  const power = useBench((s) => s.power);
  const moduleId = useBench((s) => s.moduleId);
  const nWires = useBench((s) => s.wires.length);
  const canUndo = useBench((s) => s.past.length > 0);
  const canRedo = useBench((s) => s.future.length > 0);
  const st = useBench.getState();
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3">
      <div className="glass pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 overflow-x-auto rounded-2xl px-3 py-2 scroll-thin">
        <div className="flex items-center gap-1" title={t("wire")}>
          {COLORS.map((c) => (
            <button
              key={c}
              aria-label={c}
              onClick={() => st.setWireColor(c)}
              className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{ background: PLASTIC_COLORS[c], borderColor: color === c ? "#f2b33d" : "rgba(255,255,255,0.25)", transform: color === c ? "scale(1.15)" : undefined }}
            />
          ))}
        </div>
        <span className="h-6 w-px bg-white/10" />
        <button className="btn !px-2" disabled={!canUndo} onClick={() => st.undo()} title={`${t("undo")} (Ctrl+Z)`} style={{ opacity: canUndo ? 1 : 0.4 }}>
          ↶
        </button>
        <button className="btn !px-2" disabled={!canRedo} onClick={() => st.redo()} title={`${t("redo")} (Ctrl+Y)`} style={{ opacity: canRedo ? 1 : 0.4 }}>
          ↷
        </button>
        <button className="btn" disabled={!nWires} onClick={() => st.clearWires()} title={t("clearAll")}>
          ✕ {nWires}
        </button>
        <button className="btn" data-on={power} onClick={() => st.setPower(!power)}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: power ? "#ff3b2f" : "#555", boxShadow: power ? "0 0 6px #ff3b2f" : undefined }} />
          {t("power")}
        </button>
        <select value={moduleId} onChange={(e) => st.setModule(e.target.value)} className="max-w-[12rem]" title={t("module")}>
          {MODULES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name[lang]}
            </option>
          ))}
        </select>
        <span className="h-6 w-px bg-white/10" />
        <div className="hidden items-center gap-1 lg:flex">
          {VIEWS.map((v) => (
            <button key={v} className="btn !px-2" onClick={() => useUi.getState().cam(v)}>
              {t(`v_${v}` as "v_seat")}
            </button>
          ))}
        </div>
        <select className="lg:hidden" defaultValue="" onChange={(e) => e.target.value && useUi.getState().cam(e.target.value)} title={t("views")}>
          <option value="" disabled>
            👁 {t("views")}
          </option>
          {VIEWS.map((v) => (
            <option key={v} value={v}>
              {t(`v_${v}` as "v_seat")}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
