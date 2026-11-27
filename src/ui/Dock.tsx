"use client";
import { Icon } from "./icons";
import { useState } from "react";
import { useBench } from "@/store/bench";
import { MODULES } from "@/lab/modules";
import type { WireColor } from "@/lab/types";
import { PLASTIC_COLORS } from "@/draw/colors";
import { useUi } from "./uiState";
import { useT } from "./i18n";
import { usePhone } from "./usePhone";

const COLORS: WireColor[] = ["red", "black", "yellow", "blue", "green", "white", "greenyellow"];
const VIEWS = ["seat", "meters", "module", "generator", "power", "pots", "scope", "dmm"] as const;

export function Dock() {
  const { t, lang } = useT();
  const color = useBench((s) => s.wireColor);
  const power = useBench((s) => s.power);
  const moduleId = useBench((s) => s.moduleId);
  const nWires = useBench((s) => s.wires.length);
  const canUndo = useBench((s) => s.past.length > 0);
  const canRedo = useBench((s) => s.future.length > 0);
  const st = useBench.getState();
  const [view, setView] = useState<string>("seat");
  const [palette, setPalette] = useState(false);
  const { phone, landscape } = usePhone();
  const go = (v: string) => {
    setView(v);
    useUi.getState().view(v);
  };
  const swatch = (c: WireColor, size = "h-6 w-6") => (
    <button
      key={c}
      aria-label={c}
      onClick={() => {
        st.setWireColor(c);
        setPalette(false);
      }}
      className={`${size} shrink-0 rounded-full border-2 transition-transform hover:scale-110`}
      style={{ background: PLASTIC_COLORS[c], borderColor: color === c ? "#f2b33d" : "rgba(255,255,255,0.25)", transform: color === c ? "scale(1.15)" : undefined }}
    />
  );
  return (
    <>
    {/* phones: view chips and the bench controls (stacked in portrait, side by side in landscape) */}
    {phone && (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className={`glass pointer-events-auto rounded-2xl p-1.5 ${landscape ? "flex items-center gap-2" : ""}`}>
        <div className={`scroll-thin flex gap-1 overflow-x-auto ${landscape ? "min-w-0 flex-1" : "pb-1.5"}`}>
          {VIEWS.map((v) => (
            <button key={v} className="btn shrink-0 !px-2.5 !py-1 !text-[12px]" data-on={view === v} onClick={() => go(v)}>
              {t(`v_${v}` as "v_seat")}
            </button>
          ))}
        </div>
        {palette && (
          <div className={`flex justify-center gap-2.5 ${landscape ? "glass absolute bottom-[calc(100%+6px)] end-2 rounded-xl p-2" : "pb-2 pt-0.5"}`}>
            {COLORS.map((c) => swatch(c, "h-7 w-7"))}
          </div>
        )}
        <div className={`flex items-center gap-1 ${landscape ? "shrink-0" : ""}`}>
          <button className="btn !px-2" data-on={power} onClick={() => st.setPower(!power)} aria-label={t("power")}>
            <Icon name="power" size={16} style={{ color: power ? "#ff5a45" : undefined, filter: power ? "drop-shadow(0 0 4px #ff3b2f)" : undefined }} />
            {t("power")}
          </button>
          <button className="btn !px-2" data-on={palette} onClick={() => setPalette(!palette)} aria-label={t("wire")}>
            <span className="inline-block h-4 w-4 rounded-full border border-white/40" style={{ background: PLASTIC_COLORS[color] }} />
          </button>
          <button className="btn !px-2" disabled={!canUndo} onClick={() => st.undo()} style={{ opacity: canUndo ? 1 : 0.4 }} aria-label={t("undo")}>
            <Icon name="undo" />
          </button>
          <button className="btn !px-2" disabled={!nWires} onClick={() => st.clearWires()} aria-label={t("clearAll")}>
            <Icon name="clear" />
            {nWires}
          </button>
          <select value={moduleId} onChange={(e) => st.setModule(e.target.value)} className={`!text-[12px] ${landscape ? "w-40" : "min-w-0 flex-1"}`} title={t("module")}>
            {MODULES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name[lang]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
    )}
    {!phone && (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3">
      <div className="glass pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 overflow-x-auto rounded-2xl px-3 py-2 scroll-thin">
        <div className="flex items-center gap-1" title={t("wire")}>
          {COLORS.map((c) => swatch(c))}
        </div>
        <span className="h-6 w-px bg-white/10" />
        <button className="btn !px-2" disabled={!canUndo} onClick={() => st.undo()} title={`${t("undo")} (Ctrl+Z)`} style={{ opacity: canUndo ? 1 : 0.4 }}>
          <Icon name="undo" />
        </button>
        <button className="btn !px-2" disabled={!canRedo} onClick={() => st.redo()} title={`${t("redo")} (Ctrl+Y)`} style={{ opacity: canRedo ? 1 : 0.4 }}>
          <Icon name="redo" />
        </button>
        <button className="btn" disabled={!nWires} onClick={() => st.clearWires()} title={t("clearAll")}>
          <Icon name="clear" /> {nWires}
        </button>
        <button className="btn" data-on={power} onClick={() => st.setPower(!power)}>
          <Icon name="power" size={16} style={{ color: power ? "#ff5a45" : undefined, filter: power ? "drop-shadow(0 0 4px #ff3b2f)" : undefined }} />
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
            <button key={v} className="btn !px-2" data-on={view === v} onClick={() => go(v)}>
              {t(`v_${v}` as "v_seat")}
            </button>
          ))}
        </div>
        <select className="lg:hidden" defaultValue="" onChange={(e) => e.target.value && go(e.target.value)} title={t("views")}>
          <option value="" disabled>
            {t("views")}
          </option>
          {VIEWS.map((v) => (
            <option key={v} value={v}>
              {t(`v_${v}` as "v_seat")}
            </option>
          ))}
        </select>
      </div>
    </div>
    )}
    </>
  );
}
