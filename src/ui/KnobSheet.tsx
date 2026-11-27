"use client";
import { useBench } from "@/store/bench";
import { useUi } from "./uiState";
import { TRAINER_KNOBS, VR_LABELS, VR_VALUES, adjVoltage, fgAmplitudeVpp, fgFrequency } from "@/lab/trainer";
import { fmtEng } from "@/sim/measure";
import { Icon } from "./icons";
import { useT } from "./i18n";
import { usePhone } from "./usePhone";

const WAVE_ICONS = ["sine", "triangle", "square"] as const;

/**
 * Large on-screen control for the knob that was tapped: a slider (or the
 * switch positions) with the physical value it sets — easy with a finger.
 */
export function KnobSheet() {
  const id = useUi((s) => s.ctrl);
  const knobs = useBench((s) => s.knobs);
  const { t } = useT();
  const { phone, landscape } = usePhone();
  if (!id) return null;
  const v = knobs[id] ?? 0;
  const def = TRAINER_KNOBS.find((k) => k.id === id);
  const set = (x: number) => useBench.getState().setKnob(id, x);
  const close = () => useUi.getState().setCtrl(null);

  let title = def?.label || id;
  let reading = `${Math.round(v * 100)} %`;
  if (id === "fg.amp") reading = `${fgAmplitudeVpp(v).toFixed(2)} Vpp`;
  if (id === "fg.freq") reading = fmtEng(fgFrequency(knobs["fg.range"] ?? 2, v), "Hz");
  if (id === "adj.v") {
    title = "ADJUST POWER";
    reading = `± ${adjVoltage(v).toFixed(1)} V`;
  }
  if (VR_VALUES[id]) {
    title = `${def?.label} · ${VR_LABELS[id]}`;
    const R = VR_VALUES[id];
    reading = `A–B ${fmtEng(v * R, "Ω")} · B–C ${fmtEng((1 - v) * R, "Ω")}`;
  }

  const detents = def?.detents ?? 0;
  const pos = phone ? (landscape ? "bottom-[4.4rem] end-2 w-[22rem]" : "inset-x-2 bottom-[7.6rem]") : "bottom-24 start-1/2 w-[26rem] -translate-x-1/2 rtl:translate-x-1/2";

  return (
    <div className={`glass pointer-events-auto absolute z-30 rounded-2xl p-3 ${pos}`} dir="ltr">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon name="knob" size={18} className="text-[var(--color-accent)]" />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <span className="font-mono text-sm text-[var(--color-accent)]">{detents ? (def?.marks?.[Math.round(v)] ?? Math.round(v)) : reading}</span>
        <button className="btn !px-2 !py-1" onClick={close} aria-label={t("close")}>
          <Icon name="close" size={16} />
        </button>
      </div>
      {detents ? (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${detents}, minmax(0, 1fr))` }}>
          {Array.from({ length: detents }).map((_, i) => (
            <button key={i} className="btn justify-center !py-2.5 font-mono" data-on={Math.round(v) === i} onClick={() => set(i)}>
              {id === "fg.func" ? <Icon name={WAVE_ICONS[i]} size={20} /> : (def?.marks?.[i] ?? i)}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button className="btn !px-2.5 !py-2" onClick={() => set(Math.max(0, v - 0.01))} aria-label="-">
            <Icon name="minus" size={16} />
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={v}
            onChange={(e) => set(+e.target.value)}
            className="h-8 flex-1 accent-[var(--color-accent)]"
          />
          <button className="btn !px-2.5 !py-2" onClick={() => set(Math.min(1, v + 0.01))} aria-label="+">
            <Icon name="plus" size={16} />
          </button>
        </div>
      )}
      {!detents && <div className="mt-1.5 text-center font-mono text-xs text-[var(--color-mute)]">{reading}</div>}
    </div>
  );
}
