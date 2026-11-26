"use client";
import { useState } from "react";
import { useBench } from "@/store/bench";
import type { PartKind } from "@/lab/types";
import { useT } from "./i18n";

interface Entry {
  kind: PartKind;
  name: { en: string; ar: string };
  values?: { v: number; label: string }[];
  models?: { m: string; label: string; color?: string }[];
}
const ENTRIES: Entry[] = [
  {
    kind: "R",
    name: { en: "Resistor", ar: "مقاومة" },
    values: [100, 220, 470, 1e3, 2.2e3, 4.7e3, 10e3, 22e3, 47e3, 100e3, 1e6].map((v) => ({ v, label: v >= 1e6 ? `${v / 1e6}M` : v >= 1e3 ? `${v / 1e3}K` : `${v}` })),
  },
  {
    kind: "C",
    name: { en: "Capacitor", ar: "متسعة" },
    values: [1e-9, 10e-9, 100e-9, 1e-6].map((v) => ({ v, label: v >= 1e-6 ? `${v * 1e6}µ` : `${Math.round(v * 1e9)}n` })),
  },
  { kind: "CP", name: { en: "Electrolytic", ar: "متسعة كيميائية" }, values: [10e-6, 47e-6, 100e-6, 220e-6].map((v) => ({ v, label: `${Math.round(v * 1e6)}µ` })) },
  { kind: "L", name: { en: "Inductor", ar: "ملف" }, values: [1e-3, 10e-3, 100e-3].map((v) => ({ v, label: `${v * 1e3}mH` })) },
  { kind: "D", name: { en: "Diode", ar: "دايود" }, models: [{ m: "1N4001", label: "1N4001" }, { m: "1N4148", label: "1N4148" }, { m: "1N34A", label: "1N34A Ge" }] },
  { kind: "Z", name: { en: "Zener", ar: "زينر" }, models: [{ m: "1N4733", label: "5.1V" }, { m: "1N4740", label: "10V" }] },
  { kind: "LED", name: { en: "LED", ar: "ثنائي ضوئي" }, models: [{ m: "LED_RED", label: "red", color: "#ff2a1a" }, { m: "LED_GRN", label: "green", color: "#22ff44" }, { m: "LED_YEL", label: "yellow", color: "#ffd21a" }] },
  { kind: "NPN", name: { en: "NPN (C,B,E)", ar: "NPN (C,B,E)" }, models: [{ m: "2N3904", label: "2N3904" }, { m: "C1815", label: "C1815" }] },
  { kind: "PNP", name: { en: "PNP (C,B,E)", ar: "PNP (C,B,E)" }, models: [{ m: "2N3906", label: "2N3906" }] },
];

export function PartsPanel() {
  const { t, lang } = useT();
  const placing = useBench((s) => s.placing);
  const moduleId = useBench((s) => s.moduleId);
  const parts = useBench((s) => s.customParts);
  const [sel, setSel] = useState<Record<string, number>>({});
  const st = useBench.getState();
  if (moduleId !== "breadboard") return null;
  return (
    <aside className="glass pointer-events-auto absolute start-3 top-[4.4rem] z-10 w-60 rounded-2xl p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("parts")}</h2>
        {placing && (
          <button className="btn !py-1" onClick={() => useBench.setState({ placing: null })}>
            ✕
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {ENTRIES.map((e) => {
          const opts = e.values ?? e.models ?? [];
          const i = sel[e.kind] ?? (e.kind === "R" ? 6 : 0);
          const active = placing?.kind === e.kind;
          return (
            <div key={e.kind} className="flex items-center gap-1.5">
              <span className="w-24 truncate">{e.name[lang]}</span>
              <select className="flex-1" value={i} onChange={(ev) => setSel({ ...sel, [e.kind]: +ev.target.value })}>
                {opts.map((o, k) => (
                  <option key={k} value={k}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                className="btn !px-2 !py-1"
                data-on={active}
                onClick={() => {
                  const v = e.values?.[i];
                  const m = e.models?.[i];
                  st.startPlacing({ kind: e.kind, value: v?.v, model: m?.m, color: m?.color, text: v?.label ?? m?.label });
                }}
              >
                {t("place")}
              </button>
            </div>
          );
        })}
      </div>
      {placing && (
        <div className="mt-2 rounded-lg bg-[var(--color-accent)]/10 p-2 text-[11px]">
          {t("hintPlacing")} ({placing.pins.length}/{placing.kind === "NPN" || placing.kind === "PNP" ? 3 : 2})
        </div>
      )}
      <div className="mt-2 text-[11px] text-[var(--color-mute)]">
        {parts.length} · {lang === "ar" ? "زر أيمن على القطعة لحذفها" : "right-click a part to remove it"}
      </div>
    </aside>
  );
}
