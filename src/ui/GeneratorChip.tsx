"use client";
import { useState } from "react";
import { useBench } from "@/store/bench";
import { fgSettings } from "@/lab/netlist";
import { FG_RANGES, adjVoltage } from "@/lab/trainer";
import { fmtEng } from "@/sim/measure";
import { useT } from "./i18n";

const WAVES = ["∿ sine", "⋀ triangle", "⊓ square"];

/** Shows the function-generator / supply settings derived from the knob positions,
 *  and lets the student dial an exact value (the knobs move accordingly). */
export function GeneratorChip() {
  const { t } = useT();
  const knobs = useBench((s) => s.knobs);
  const power = useBench((s) => s.power);
  const [open, setOpen] = useState(false);
  const fg = fgSettings(knobs);
  const [f, setF] = useState("1000");
  const [a, setA] = useState("10");
  const st = useBench.getState();
  const apply = () => {
    const freq = Math.max(0.1, parseFloat(f) || 1000);
    // choose the range so that the dial sits within 0.1..2.35
    let r = 0;
    while (r < FG_RANGES.length - 1 && freq / FG_RANGES[r] > 2.35) r++;
    const dial = Math.min(Math.max((freq / FG_RANGES[r] - 0.1) / 2.25, 0), 1);
    const vpp = Math.min(Math.max(parseFloat(a) || 0, 0), 20);
    useBench.setState((s) => ({ knobs: { ...s.knobs, "fg.range": r, "fg.freq": dial, "fg.amp": Math.sqrt(vpp / 20) } }));
  };
  return (
    <div className="pointer-events-auto absolute start-3 bottom-[4.8rem] z-10 hidden md:block" dir="ltr">
      <button className="glass flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-mono text-[11px]" onClick={() => setOpen(!open)}>
        <span className="font-sans text-[10px] text-[var(--color-mute)]">FG</span>
        <span>{WAVES[Math.round(knobs["fg.func"] ?? 0)].split(" ")[0]}</span>
        <span>{fmtEng(fg.freq, "Hz")}</span>
        <span>{fg.vpp.toFixed(fg.vpp < 1 ? 3 : 2)} Vpp</span>
        <span className="text-[var(--color-mute)]">· ±{adjVoltage(knobs["adj.v"] ?? 0).toFixed(1)} V</span>
        {!power && <span className="text-[var(--color-bad)]">OFF</span>}
      </button>
      {open && (
        <div className="glass mt-1.5 w-64 rounded-xl p-3 text-xs">
          <div className="mb-2 font-semibold">{t("generator")}</div>
          <div className="mb-2 flex gap-1">
            {WAVES.map((w, i) => (
              <button key={w} className="btn !px-2 !py-1" data-on={Math.round(knobs["fg.func"] ?? 0) === i} onClick={() => st.setKnob("fg.func", i)}>
                {w.split(" ")[0]}
              </button>
            ))}
          </div>
          <label className="mb-1.5 flex items-center justify-between gap-2">
            {t("frequency")} (Hz)
            <input type="number" className="w-24" value={f} onChange={(e) => setF(e.target.value)} />
          </label>
          <label className="mb-2 flex items-center justify-between gap-2">
            {t("amplitude")} (Vpp)
            <input type="number" step="0.01" className="w-24" value={a} onChange={(e) => setA(e.target.value)} />
          </label>
          <button className="btn w-full justify-center" onClick={apply}>
            {t("setExact")}
          </button>
          <label className="mt-3 flex items-center justify-between gap-2">
            ADJUST ±V
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={knobs["adj.v"] ?? 0}
              onChange={(e) => st.setKnob("adj.v", +e.target.value)}
              className="flex-1 accent-[var(--color-accent)]"
            />
          </label>
        </div>
      )}
    </div>
  );
}
